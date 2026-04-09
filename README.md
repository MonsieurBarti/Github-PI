# 🔧 GH PI Extension

PI extension for native GitHub CLI (`gh`) integration.

## ✨ Features

- **📦 Repository Management**: Create, clone, fork, list, view, delete repos
- **🐛 Issue Tracking**: Create, list, view, close, reopen, comment, edit issues
- **🔀 Pull Requests**: Create, list, view, diff, merge, review PRs
- **⚡ GitHub Actions**: List, view, run, disable/enable workflows
- **🤖 PI-Native**: Seamless integration with PI's tool system

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

### 3. Install the extension with `pi install`

**From npm (recommended):**

```bash
pi install npm:@the-forge-flow/gh-pi
```

**From GitHub (tracks `main`):**

```bash
pi install git:github.com/MonsieurBarti/gh-pi
```

Then reload PI with `/reload` (or restart it).

## 🚀 Usage

### As Tools

The LLM can call GitHub operations directly:

```typescript
// Create a repository
await github_repo({
  action: "create",
  name: "my-new-project",
  visibility: "public",
  auto_init: true
});

// List open issues
await github_issue({
  action: "list",
  repo: "owner/repo",
  state: "open"
});

// Create a pull request
await github_pr({
  action: "create",
  repo: "owner/repo",
  title: "Add new feature",
  head: "feature-branch",
  base: "main"
});

// List workflows
await github_workflow({
  action: "list",
  repo: "owner/repo"
});
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GH_CLI_PATH` | Custom path to `gh` binary |

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  LLM Request│────▶│  GH Tool     │────▶│   gh CLI    │
│  (via PI)   │     │  (defineTool)│     │  (spawn)    │
└─────────────┘     └──────────────┘     └──────┬──────┘
                           │                     │
                           │              ┌──────▼──────┐
                           │              │  GitHub API │
                           │              │  (via gh)   │
                           │              └──────┬──────┘
                           │                     │
                    ┌──────▼──────┐              │
                    │  Parsed     │◀─────────────┘
                    │  Response   │
                    │  (JSON/text)│
                    └─────────────┘
```

## 🧪 Development

```bash
# Install dependencies
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
├── index.ts              # Extension entry & tool registration
├── gh-client.ts          # Binary detection & pi.exec wrapper
├── error-handler.ts      # Error messages & install help
├── repo-tools.ts         # Repository operations
├── issue-tools.ts        # Issue operations
├── pr-tools.ts           # Pull request operations
└── workflow-tools.ts     # GitHub Actions operations
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit with conventional commits (`git commit -m "feat: add something"`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📜 License

MIT © [MonsieurBarti](https://github.com/MonsieurBarti)
