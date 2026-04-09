<div align="center">
  <img src="https://raw.githubusercontent.com/MonsieurBarti/The-Forge-Flow-CC/refs/heads/main/assets/forge-banner.png" alt="The Forge Flow - GH-PI" width="100%">

  <h1>🔧 GH-PI</h1>

  <p>
    <strong>Native GitHub CLI (<code>gh</code>) integration for PI</strong>
  </p>

  <p>
    <a href="https://github.com/MonsieurBarti/GH-PI/actions/workflows/ci.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/MonsieurBarti/GH-PI/ci.yml?label=CI&style=flat-square" alt="CI Status">
    </a>
    <a href="https://www.npmjs.com/package/@the-forge-flow/gh-pi">
      <img src="https://img.shields.io/npm/v/@the-forge-flow/gh-pi?style=flat-square" alt="npm version">
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/github/license/MonsieurBarti/GH-PI?style=flat-square" alt="License">
    </a>
  </p>
</div>

---

## ✨ Features

- **📦 Repositories**: create, clone, fork, list, view, delete, sync
- **🐛 Issues**: create, list, view, close, reopen, comment, edit
- **🔀 Pull Requests**: create, list, view, diff, merge, review, close, checkout
- **⚡ GitHub Actions**: list, view, run, logs, disable, enable workflows
- **🤖 PI-native**: seamless integration with PI's tool system, abort-signal aware, output truncated to PI's limits

## 📦 Installation

### 1. Install the GitHub CLI

The extension shells out to the `gh` binary, so it must be on your `PATH`.

```bash
# macOS
brew install gh

# Ubuntu/Debian
sudo apt install gh

# Windows
winget install GitHub.cli

# Other: https://github.com/cli/cli#installation
```

Verify with `gh --version`. If it lives somewhere non-standard, set `GH_CLI_PATH` to its absolute path.

### 2. Authenticate with GitHub

```bash
gh auth login
```

The extension probes `gh auth status` on startup and will warn you if you're unauthenticated.

### 3. Install the extension with `pi install`

PI discovers the extension automatically once installed as a pi package. By default this installs globally into `~/.pi/agent/`; pass `-l` to install into the current project (`.pi/`) instead.

**From npm (recommended):**

```bash
pi install npm:@the-forge-flow/gh-pi
```

**From GitHub (tracks `main`):**

```bash
pi install git:github.com/MonsieurBarti/GH-PI
```

**Pin to a specific version:**

```bash
# npm — pin to a published version
pi install npm:@the-forge-flow/gh-pi@0.1.0

# git — pin to a release tag
pi install git:github.com/MonsieurBarti/GH-PI@gh-pi-v0.1.0
```

Then reload PI with `/reload` (or restart it). On the next session you should see a notification that the `GitHub CLI` is ready.

**Manage installed packages:**

```bash
pi list    # show installed packages
pi update  # update non-pinned packages
pi remove npm:@the-forge-flow/gh-pi
pi config  # enable/disable individual extensions, skills, prompts, themes
```

> For project-scoped installs, package filtering, and more, see the [pi packages doc](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md).

## 🚀 Usage

The LLM can call any of the four GitHub tools directly. Each tool takes an `action` plus the parameters that action needs.

> All four tool ids are namespaced with the `tff-` prefix (`tff-github_repo`, `tff-github_issue`, `tff-github_pr`, `tff-github_workflow`) to avoid collisions with other pi packages. The user-facing display labels ("GitHub Repository", "GitHub Issue", etc.) stay readable — only the LLM-facing ids are prefixed.

### `tff-github_repo`

```typescript
// Create a repository
tff-github_repo({
  action: "create",
  name: "my-new-project",
  visibility: "public",
  auto_init: true,
});

// List your repos (or those of an org)
tff-github_repo({ action: "list", owner: "the-forge-flow", limit: 20 });

// View details
tff-github_repo({ action: "view", owner: "octocat", name: "hello-world" });
```

### `tff-github_issue`

```typescript
// Open an issue
tff-github_issue({
  action: "create",
  repo: "owner/repo",
  title: "Flaky integration test",
  body: "Steps to reproduce…",
  labels: ["bug"],
});

// List open issues assigned to you
tff-github_issue({
  action: "list",
  repo: "owner/repo",
  state: "open",
  assignee: "@me",
});

// Close with a reason
tff-github_issue({
  action: "close",
  repo: "owner/repo",
  number: 42,
  reason: "completed",
});
```

### `tff-github_pr`

```typescript
// Open a PR
tff-github_pr({
  action: "create",
  repo: "owner/repo",
  title: "Add rate-limit backoff",
  head: "feat/rate-limit",
  base: "main",
});

// Review a PR (request-changes and comment REQUIRE a body)
tff-github_pr({
  action: "review",
  repo: "owner/repo",
  number: 17,
  review_action: "request-changes",
  body: "Please add a test for the retry path.",
});

// Merge with squash and delete the source branch
tff-github_pr({
  action: "merge",
  repo: "owner/repo",
  number: 17,
  method: "squash",
  delete_branch: true,
});
```

### `tff-github_workflow`

```typescript
// List workflows
tff-github_workflow({ action: "list", repo: "owner/repo" });

// Trigger a workflow_dispatch with inputs
tff-github_workflow({
  action: "run",
  repo: "owner/repo",
  workflow: "deploy.yml",
  branch: "main",
  inputs: { environment: "production", version: "1.2.0" },
});

// Read the log for a specific run
tff-github_workflow({
  action: "logs",
  repo: "owner/repo",
  run_id: "1234567890",
});
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GH_CLI_PATH` | Custom path to the `gh` binary |

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  LLM Request│────▶│  GH Tool     │────▶│   gh CLI    │
│  (via PI)   │     │  (defineTool)│     │  (pi.exec)  │
└─────────────┘     └──────────────┘     └──────┬──────┘
                           │                     │
                           │              ┌──────▼──────┐
                           │              │  GitHub API │
                           │              │  (via gh)   │
                           │              └──────┬──────┘
                           │                     │
                    ┌──────▼──────┐              │
                    │  Truncated  │◀─────────────┘
                    │  Response   │
                    │  (JSON/text)│
                    └─────────────┘
```

Every tool call:

1. Auto-detects `gh` and verifies `gh auth status` on first use (cached for the session).
2. Builds the exact argv for the underlying `gh` subcommand.
3. Executes via `pi.exec`, propagating the abort signal so Ctrl+C actually interrupts long-running calls.
4. Maps `gh` exit codes to typed errors (`GHAuthError`, `GHRateLimitError`, `GHError`).
5. Truncates output to PI's ~50KB/2000-line limit via `truncateHead`, with a trailing notice.

## 🧪 Development

```bash
# Install dependencies (also wires lefthook git hooks)
bun install

# Run tests
bun test

# Lint & format
bun run check

# Build for publish
bun run build
```

## 📁 Project Structure

```
src/
├── index.ts           # Extension entry, tool registration, state, truncation
├── gh-client.ts       # Thin pi.exec wrapper with exit-code → error mapping
├── error-handler.ts   # GHNotFoundError / GHAuthError / GHRateLimitError / GHError
├── repo-tools.ts      # gh repo *
├── issue-tools.ts     # gh issue *
├── pr-tools.ts        # gh pr *
└── workflow-tools.ts  # gh workflow * and gh run view --log
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing`)
3. Commit with conventional commits (`git commit -m "feat: add something"`)
4. Push to the branch (`git push origin feat/amazing`)
5. Open a Pull Request

## 📜 License

MIT © [MonsieurBarti](https://github.com/MonsieurBarti)

---

<div align="center">
  <sub>Built with ⚡ by <a href="https://github.com/MonsieurBarti">MonsieurBarti</a></sub>
</div>
