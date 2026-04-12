# gh-pi additions for TFF integration — design

**Date:** 2026-04-12
**Status:** Approved for planning

## Purpose

Expose the internals of `@the-forge-flow/gh-pi` as a library surface so the
Forge Flow (TFF) extension can import its tool factories instead of shelling
out to `gh` directly. Adds one missing primitive (`pr.checks()`) and one
missing field (`comments` in `pr.view()`) needed by TFF's ship phase.

Non-goal: changing any existing PI extension behavior. The default export
(`ghExtension`) and all registered tools must remain byte-identical in
observable behavior.

## Design

### 1. `src/gh-client.ts` — add `createGHClient` factory

Motivation: TFF runs outside a PI host and therefore has no `pi.exec`
function to pass to the `GHClient` constructor. The package should be
usable as a library with zero configuration.

**Changes:**

- Add `export function createGHClient(options?: { exec?: PiExecFn; binaryPath?: string }): GHClient`.
- When `options.exec` is omitted, build a default `PiExecFn` that wraps
  Node's `child_process.execFile`, honoring `timeout` and `signal` and
  returning `{ code, stdout, stderr, killed }` with the same shape the
  class already expects.
- When `options.binaryPath` is omitted, fall back to `"gh"` (same default
  as the class).
- No working-directory injection, no env-var magic: the default exec
  inherits the caller's process environment and cwd.
- Extend `GHError` with an optional `stdout: string` field and populate
  it from `result.stdout` inside `GHClient.exec` before throwing. This is
  required so `pr.checks()` can surface *why* checks failed (the failing
  check names are printed on stdout by `gh pr checks`).

**Non-changes:**

- The `GHClient` class keeps its current constructor signature.
- The existing PI extension path (`index.ts` creating `new GHClient({ exec: pi.exec.bind(pi), binaryPath })`) is untouched.

### 2. `src/pr-tools.ts` — add `checks()` and extend `view()`

**New `ChecksParams` interface:**

```ts
export interface ChecksParams {
  repo: string;
  number: number;
  /** If true, blocks until all checks complete (uses `gh pr checks --watch`). */
  watch?: boolean;
  /** If true, only consider required checks (uses `--required`). */
  required?: boolean;
}
```

**New `checks` method on the object returned by `createPRTools(client)`:**

- Build argv: `["pr", "checks", String(params.number), "--repo", params.repo]`,
  appending `"--watch"` and/or `"--required"` when set.
- Default timeout: when `watch` is true, build the effective options as
  `{ timeout: 600_000, ...options }` so a caller-supplied `timeout`
  wins and `signal` (or anything else on options) is preserved. When
  `watch` is false, pass `options` through unchanged and inherit the
  client's normal 30s default.
- Error handling (failure-returns-info): wrap `client.exec` in `try/catch`.
  - On `GHError` (non-zero exit from a failing check): return a synthesized
    `ExecResult` `{ code: err.code, stdout: err.stdout ?? "", stderr: err.message }` so callers can inspect *which* checks failed.
  - `GHAuthError`, `GHRateLimitError`, and any other thrown error propagate
    (those are not "check failures").
- Exit code 2 (user cancellation) is passed through unchanged by
  `client.exec`, same as every other tool method.

**Updated `view` method:**

- Append `,comments` to the existing `--json` field list:
  `"number,title,body,state,author,headRefName,baseRefName,additions,deletions,files,mergedAt,mergedBy,mergeable,statusCheckRollup,comments"`.
- No other behavior change.

### 3. `src/index.ts` — library-style named exports

Add named re-exports above the existing default export. The default
export (`ghExtension`) stays put and must remain the default.

- Value exports: `createGHClient`, `GHClient`, `createPRTools`,
  `createIssueTools`, `createRepoTools`, `createWorkflowTools`.
- Type exports: `ExecOptions`, `ExecResult`, `PiExecFn` from `gh-client`;
  every `*Params` interface currently exported from the four `*-tools.ts`
  files (including new `ChecksParams`).
- Error classes already exported? Re-export them anyway:
  `GHError`, `GHAuthError`, `GHRateLimitError`, `GHNotFoundError` from
  `error-handler`, so library consumers can `instanceof`-check them.

After build, `dist/index.d.ts` must advertise all of the above.

### 4. Tests

**`tests/unit/pr-tools.spec.ts`:**

- Extend the existing `view()` test fixture to expect `,comments` at the
  end of the `--json` argument.
- New `describe("checks", …)` block:
  - Builds correct argv for each flag combo: neither / `watch` / `required` / both.
  - When `watch: true` and no caller timeout, `client.exec` is called
    with `timeout: 600_000`.
  - When `watch: true` and the caller passes `options.timeout`, the
    caller's value wins.
  - On `GHError` thrown by `client.exec`, `checks()` returns an
    `ExecResult` carrying `code`, `stdout`, and the error message on
    `stderr` (no throw).
  - On `GHAuthError`, `checks()` still throws.
  - Forwards `options.signal` unchanged.

**`tests/unit/gh-client.spec.ts`:**

- New test for `createGHClient()` with an injected `exec` mock: confirm
  it constructs a `GHClient`, uses `options.binaryPath` when given,
  and defaults to `"gh"` when omitted.
- New test for the default-exec path: mock `child_process.execFile`
  (or its promisified form) at the module boundary and confirm a call
  to `createGHClient().exec(["--version"])` routes through it and
  returns the normalized `{code, stdout, stderr}` shape.
- New test: when a command exits non-zero, `GHError` thrown by
  `GHClient.exec` now carries `stdout` alongside `code` and message.

### 5. Version + changelog

- No manual version bump. Release-please handles versioning from
  conventional-commit messages. Use `feat:` for the three additions.
- CHANGELOG is generated by release-please; no manual edit.

### 6. Verification

Gate before PR:

- `bun run test` — all green.
- `bun run typecheck` — clean.
- `bun run check` — biome clean.
- `bun run build` — succeeds, produces `dist/`.
- Inspect `dist/index.d.ts` to confirm the new named exports and
  types are advertised.

## Out of scope

- No new PI tool (`tff-github_pr` action list is unchanged; `checks` is
  a library-only primitive TFF calls directly via `createPRTools`).
- No cwd/env plumbing in `createGHClient`; callers control process
  state.
- No changes to `issue-tools`, `repo-tools`, `workflow-tools` beyond
  being re-exported from `index.ts`.
