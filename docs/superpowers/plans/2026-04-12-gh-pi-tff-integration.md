# gh-pi TFF Integration Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose gh-pi's tool factories as a library surface so TFF can import them, add `pr.checks()` with watch/required support, and include `comments` in `pr.view()` output.

**Architecture:** Extend `GHError` with `stdout` so failure-details survive exception propagation. Add a `createGHClient()` factory that works outside PI by defaulting to a Node `child_process.execFile` wrapper. Add `pr.checks()` that returns an `ExecResult` on check failure (instead of throwing) so callers can read which checks failed. Extend `pr.view()` JSON fields. Re-export factories and param types from `src/index.ts`.

**Tech Stack:** TypeScript, vitest, biome, Node `child_process`, release-please (auto-versioning via conventional commits).

---

## File Structure

- Modify: `src/error-handler.ts` — add optional `stdout` to `GHError`.
- Modify: `src/gh-client.ts` — plumb `stdout` into `GHError`; add `createGHClient` factory with Node-default exec.
- Modify: `src/pr-tools.ts` — add `ChecksParams` + `checks()`; append `,comments` to `view()` JSON fields.
- Modify: `src/index.ts` — named re-exports for library consumers.
- Modify: `tests/unit/gh-client.spec.ts` — cover `GHError.stdout` + `createGHClient`.
- Modify: `tests/unit/pr-tools.spec.ts` — update `view()` expectation; add `checks()` tests.

No new files. Each module change is self-contained.

---

## Task 1: Extend `GHError` with `stdout` and populate it from `GHClient.exec`

**Files:**
- Modify: `src/error-handler.ts`
- Modify: `src/gh-client.ts`
- Test: `tests/unit/gh-client.spec.ts`

### Step 1: Write the failing test

Append this test inside the existing `describe("exec", …)` block in `tests/unit/gh-client.spec.ts`, after the "throws GHError on other non-zero exits" test:

```typescript
it("attaches stdout to GHError when command fails with stdout output", async () => {
    mockExec.mockResolvedValue({
        code: 1,
        stdout: "check-lint failed\ncheck-typecheck failed",
        stderr: "some checks were not successful",
    });

    try {
        await client.exec(["pr", "checks", "5"]);
        throw new Error("expected GHError to be thrown");
    } catch (err) {
        expect(err).toBeInstanceOf(GHError);
        expect((err as GHError).code).toBe(1);
        expect((err as GHError).stdout).toBe("check-lint failed\ncheck-typecheck failed");
    }
});
```

### Step 2: Run the test and confirm it fails

Run: `bun run test -- tests/unit/gh-client.spec.ts`
Expected: the new test fails with `expect(received).toBeInstanceOf(expected)` — it throws but `stdout` is `undefined` on the `GHError` instance.

### Step 3: Add `stdout` to `GHError`

Edit `src/error-handler.ts`. Replace the `GHError` class with:

```typescript
/**
 * Generic gh CLI error for any non-zero exit that is not auth, rate limit,
 * or a user cancellation.
 */
export class GHError extends Error {
    code: number;
    stdout: string;

    constructor(code: number, stderr: string, stdout = "") {
        super(stderr.trim() || `gh CLI failed with exit code ${code}`);
        this.name = "GHError";
        this.code = code;
        this.stdout = stdout;
    }
}
```

### Step 4: Populate `stdout` when throwing from `GHClient.exec`

Edit `src/gh-client.ts`. Replace the single throw line `throw new GHError(result.code, result.stderr);` with:

```typescript
throw new GHError(result.code, result.stderr, result.stdout);
```

### Step 5: Run the test and confirm it passes

Run: `bun run test -- tests/unit/gh-client.spec.ts`
Expected: all `gh-client` tests pass, including the new one.

### Step 6: Commit

```bash
git add src/error-handler.ts src/gh-client.ts tests/unit/gh-client.spec.ts
git commit -m "feat(gh-client): attach stdout to GHError for failure-details preservation"
```

---

## Task 2: Add `createGHClient` factory with Node default exec

**Files:**
- Modify: `src/gh-client.ts`
- Test: `tests/unit/gh-client.spec.ts`

### Step 1: Write the failing tests

Append a new top-level `describe` to `tests/unit/gh-client.spec.ts` (outside the existing `describe("GHClient", …)` block):

```typescript
import { createGHClient } from "../../src/gh-client";
import * as childProcess from "node:child_process";

describe("createGHClient", () => {
    it("returns a GHClient using the injected exec when provided", async () => {
        const injectedExec = vi.fn().mockResolvedValue({
            code: 0,
            stdout: "ok",
            stderr: "",
        });

        const client = createGHClient({ exec: injectedExec as unknown as PiExecFn });
        const result = await client.exec(["--version"]);

        expect(result.stdout).toBe("ok");
        expect(injectedExec).toHaveBeenCalledWith("gh", ["--version"], expect.any(Object));
    });

    it("honors binaryPath override", async () => {
        const injectedExec = vi.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" });
        const client = createGHClient({
            exec: injectedExec as unknown as PiExecFn,
            binaryPath: "/custom/gh",
        });
        await client.exec(["--version"]);
        expect(injectedExec).toHaveBeenCalledWith("/custom/gh", ["--version"], expect.any(Object));
    });

    it("falls back to a node execFile-based exec when none is provided", async () => {
        const execFileSpy = vi
            .spyOn(childProcess, "execFile")
            // biome-ignore lint/suspicious/noExplicitAny: signature matches overloads
            .mockImplementation(((
                _file: string,
                _args: readonly string[],
                _opts: unknown,
                cb: (err: Error | null, stdout: string, stderr: string) => void,
            ) => {
                cb(null, "default-exec-ok", "");
                return {} as ReturnType<typeof childProcess.execFile>;
            }) as unknown as typeof childProcess.execFile);

        try {
            const client = createGHClient();
            const result = await client.exec(["--version"]);
            expect(result.code).toBe(0);
            expect(result.stdout).toBe("default-exec-ok");
            expect(execFileSpy).toHaveBeenCalledWith(
                "gh",
                ["--version"],
                expect.any(Object),
                expect.any(Function),
            );
        } finally {
            execFileSpy.mockRestore();
        }
    });

    it("default exec normalizes non-zero exits into {code, stdout, stderr}", async () => {
        const execFileSpy = vi
            .spyOn(childProcess, "execFile")
            .mockImplementation(((
                _file: string,
                _args: readonly string[],
                _opts: unknown,
                cb: (
                    err: (Error & { code?: number; stdout?: string; stderr?: string }) | null,
                    stdout: string,
                    stderr: string,
                ) => void,
            ) => {
                const err = new Error("fail") as Error & {
                    code?: number;
                    stdout?: string;
                    stderr?: string;
                };
                err.code = 1;
                err.stdout = "failing-check";
                err.stderr = "boom";
                cb(err, "failing-check", "boom");
                return {} as ReturnType<typeof childProcess.execFile>;
            }) as unknown as typeof childProcess.execFile);

        try {
            const client = createGHClient();
            // GHClient.exec throws GHError on non-zero; we assert it preserves stdout/stderr.
            await expect(client.exec(["pr", "checks", "5"])).rejects.toMatchObject({
                name: "GHError",
                code: 1,
                stdout: "failing-check",
            });
        } finally {
            execFileSpy.mockRestore();
        }
    });
});
```

### Step 2: Run the tests and confirm they fail

Run: `bun run test -- tests/unit/gh-client.spec.ts`
Expected: all four `createGHClient` tests fail with an import error because `createGHClient` is not exported from `../../src/gh-client`.

### Step 3: Add the factory

Edit `src/gh-client.ts`. Append to the end of the file:

```typescript
/**
 * Build a default PiExecFn that shells out via node:child_process.execFile.
 * Used when the library is consumed outside a PI host (no pi.exec available).
 *
 * Returns `{code, stdout, stderr, killed}` regardless of exit code — errors
 * from execFile are normalized into the return shape, matching the contract
 * that GHClient expects.
 */
function defaultNodeExec(): PiExecFn {
    return async (command, args, options) => {
        const { execFile } = await import("node:child_process");
        return new Promise((resolve) => {
            const child = execFile(
                command,
                args,
                {
                    timeout: options?.timeout,
                    maxBuffer: 64 * 1024 * 1024,
                },
                (err, stdout, stderr) => {
                    if (err) {
                        const e = err as Error & {
                            code?: number | string;
                            killed?: boolean;
                            signal?: string;
                        };
                        const numericCode = typeof e.code === "number" ? e.code : 1;
                        resolve({
                            code: numericCode,
                            stdout: stdout ?? "",
                            stderr: stderr ?? "",
                            killed: Boolean(e.killed),
                        });
                        return;
                    }
                    resolve({
                        code: 0,
                        stdout: stdout ?? "",
                        stderr: stderr ?? "",
                        killed: false,
                    });
                },
            );

            if (options?.signal) {
                const onAbort = () => {
                    child.kill();
                };
                if (options.signal.aborted) {
                    child.kill();
                } else {
                    options.signal.addEventListener("abort", onAbort, { once: true });
                }
            }
        });
    };
}

/**
 * Library-friendly factory. Defaults `exec` to a node:child_process-based
 * implementation, making the package usable outside a PI host.
 */
export function createGHClient(options?: { exec?: PiExecFn; binaryPath?: string }): GHClient {
    return new GHClient({
        exec: options?.exec ?? defaultNodeExec(),
        binaryPath: options?.binaryPath,
    });
}
```

### Step 4: Run the tests and confirm they pass

Run: `bun run test -- tests/unit/gh-client.spec.ts`
Expected: all `createGHClient` tests pass, plus all existing `GHClient` tests still pass.

### Step 5: Typecheck

Run: `bun run typecheck`
Expected: clean exit, no errors.

### Step 6: Commit

```bash
git add src/gh-client.ts tests/unit/gh-client.spec.ts
git commit -m "feat(gh-client): add createGHClient factory with Node default exec"
```

---

## Task 3: Update `pr.view()` to include `comments` field

**Files:**
- Modify: `src/pr-tools.ts`
- Test: `tests/unit/pr-tools.spec.ts`

### Step 1: Update the failing test

Edit `tests/unit/pr-tools.spec.ts`. In the `describe("view", …)` block, update the expected `--json` string to end with `,comments`:

Replace:
```typescript
"number,title,body,state,author,headRefName,baseRefName,additions,deletions,files,mergedAt,mergedBy,mergeable,statusCheckRollup",
```

With:
```typescript
"number,title,body,state,author,headRefName,baseRefName,additions,deletions,files,mergedAt,mergedBy,mergeable,statusCheckRollup,comments",
```

### Step 2: Run the test and confirm it fails

Run: `bun run test -- tests/unit/pr-tools.spec.ts -t "view"`
Expected: the `view` test fails because the current implementation does not include `,comments`.

### Step 3: Update the implementation

Edit `src/pr-tools.ts`. In the `view` method, replace:
```typescript
"number,title,body,state,author,headRefName,baseRefName,additions,deletions,files,mergedAt,mergedBy,mergeable,statusCheckRollup",
```

With:
```typescript
"number,title,body,state,author,headRefName,baseRefName,additions,deletions,files,mergedAt,mergedBy,mergeable,statusCheckRollup,comments",
```

### Step 4: Run the test and confirm it passes

Run: `bun run test -- tests/unit/pr-tools.spec.ts -t "view"`
Expected: pass.

### Step 5: Commit

```bash
git add src/pr-tools.ts tests/unit/pr-tools.spec.ts
git commit -m "feat(pr-tools): include comments field in pr.view JSON response"
```

---

## Task 4: Add `pr.checks()` with watch/required and failure-returns-info

**Files:**
- Modify: `src/pr-tools.ts`
- Test: `tests/unit/pr-tools.spec.ts`

### Step 1: Write the failing tests

Append a new `describe("checks", …)` block to `tests/unit/pr-tools.spec.ts`, after the existing `describe("checkout", …)` block and inside the top-level `describe("pr-tools", …)`:

```typescript
describe("checks", () => {
    it("builds argv with no flags by default", async () => {
        const tools = createPRTools(mockClient);
        mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

        await tools.checks({ repo: "owner/repo", number: 5 });

        expect(mockExec).toHaveBeenCalledWith(
            ["pr", "checks", "5", "--repo", "owner/repo"],
            undefined,
        );
    });

    it("adds --watch when watch is true", async () => {
        const tools = createPRTools(mockClient);
        mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

        await tools.checks({ repo: "owner/repo", number: 5, watch: true });

        expect(mockExec).toHaveBeenCalledWith(
            ["pr", "checks", "5", "--repo", "owner/repo", "--watch"],
            expect.objectContaining({ timeout: 600_000 }),
        );
    });

    it("adds --required when required is true", async () => {
        const tools = createPRTools(mockClient);
        mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

        await tools.checks({ repo: "owner/repo", number: 5, required: true });

        expect(mockExec).toHaveBeenCalledWith(
            ["pr", "checks", "5", "--repo", "owner/repo", "--required"],
            undefined,
        );
    });

    it("adds both --watch and --required when both set", async () => {
        const tools = createPRTools(mockClient);
        mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

        await tools.checks({
            repo: "owner/repo",
            number: 5,
            watch: true,
            required: true,
        });

        expect(mockExec).toHaveBeenCalledWith(
            ["pr", "checks", "5", "--repo", "owner/repo", "--watch", "--required"],
            expect.objectContaining({ timeout: 600_000 }),
        );
    });

    it("caller-provided timeout wins over the watch default", async () => {
        const tools = createPRTools(mockClient);
        mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

        await tools.checks(
            { repo: "owner/repo", number: 5, watch: true },
            { timeout: 5000 },
        );

        expect(mockExec).toHaveBeenCalledWith(
            ["pr", "checks", "5", "--repo", "owner/repo", "--watch"],
            expect.objectContaining({ timeout: 5000 }),
        );
    });

    it("forwards signal through to client.exec", async () => {
        const tools = createPRTools(mockClient);
        mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

        const controller = new AbortController();
        await tools.checks(
            { repo: "owner/repo", number: 5, watch: true },
            { signal: controller.signal },
        );

        expect(mockExec).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({ signal: controller.signal, timeout: 600_000 }),
        );
    });

    it("returns ExecResult on check failure (GHError) instead of throwing", async () => {
        const tools = createPRTools(mockClient);
        const err = new GHError(1, "some checks were not successful", "check-lint\tfail");
        mockExec.mockRejectedValue(err);

        const result = await tools.checks({ repo: "owner/repo", number: 5 });

        expect(result.code).toBe(1);
        expect(result.stdout).toBe("check-lint\tfail");
        expect(result.stderr).toContain("some checks were not successful");
    });

    it("still throws on auth errors", async () => {
        const tools = createPRTools(mockClient);
        mockExec.mockRejectedValue(new GHAuthError());

        await expect(tools.checks({ repo: "owner/repo", number: 5 })).rejects.toThrow(
            GHAuthError,
        );
    });
});
```

Also add these imports to the top of `tests/unit/pr-tools.spec.ts` (merge into the existing import block, don't duplicate):

```typescript
import { GHAuthError, GHError } from "../../src/error-handler";
```

### Step 2: Run the tests and confirm they fail

Run: `bun run test -- tests/unit/pr-tools.spec.ts -t "checks"`
Expected: every test in the new `checks` block fails — `tools.checks is not a function`.

### Step 3: Implement `checks()`

Edit `src/pr-tools.ts`. At the top, update the import to pull in `GHError`:

```typescript
import { GHError } from "./error-handler";
import type { ExecOptions, ExecResult, GHClient } from "./gh-client";
```

Add this interface next to the other `*Params` interfaces (after `CheckoutPRParams`):

```typescript
export interface ChecksParams {
    repo: string;
    number: number;
    /** If true, blocks until all checks complete (uses `gh pr checks --watch`). */
    watch?: boolean;
    /** If true, only consider required checks (uses `--required`). */
    required?: boolean;
}
```

Then add this method inside the object returned by `createPRTools(client)`, after `checkout`:

```typescript
async checks(params: ChecksParams, options?: ExecOptions): Promise<ExecResult> {
    const args = ["pr", "checks", String(params.number), "--repo", params.repo];
    if (params.watch) args.push("--watch");
    if (params.required) args.push("--required");

    // --watch can run for minutes; default to 10 min, caller-provided
    // options.timeout wins via the spread ordering below.
    const effectiveOptions: ExecOptions | undefined = params.watch
        ? { timeout: 600_000, ...options }
        : options;

    try {
        return await client.exec(args, effectiveOptions);
    } catch (err) {
        // Surface failing checks as a structured ExecResult so the caller
        // can read which checks failed (gh prints them on stdout). Other
        // error types (auth, rate limit, not found) still propagate.
        if (err instanceof GHError) {
            return {
                code: err.code,
                stdout: err.stdout,
                stderr: err.message,
            };
        }
        throw err;
    }
},
```

### Step 4: Run the tests and confirm they pass

Run: `bun run test -- tests/unit/pr-tools.spec.ts`
Expected: all `pr-tools` tests pass including the new `checks` block.

### Step 5: Typecheck

Run: `bun run typecheck`
Expected: clean.

### Step 6: Commit

```bash
git add src/pr-tools.ts tests/unit/pr-tools.spec.ts
git commit -m "feat(pr-tools): add checks() with watch/required and failure-returns-info"
```

---

## Task 5: Add library-style named exports from `src/index.ts`

**Files:**
- Modify: `src/index.ts`

### Step 1: Add named re-exports

Edit `src/index.ts`. Immediately after the existing top-of-file imports (around line 27, after the `createWorkflowTools` import) and **before** the `export default function ghExtension(pi: ExtensionAPI): void {` line, insert this block:

```typescript
/**
 * Library surface — named exports for consumers who want to use gh-pi's
 * tool factories outside of a PI host (e.g., another PI extension wrapping
 * GitHub operations). The default export below keeps the PI extension
 * behavior unchanged.
 */
export { createGHClient, GHClient } from "./gh-client";
export type { ExecOptions, ExecResult, PiExecFn } from "./gh-client";

export { createPRTools } from "./pr-tools";
export type {
    ChecksParams,
    CheckoutPRParams,
    ClosePRParams,
    CreatePRParams,
    DiffPRParams,
    ListPRsParams,
    MergePRParams,
    ReviewPRParams,
    ViewPRParams,
} from "./pr-tools";

export { createIssueTools } from "./issue-tools";
export type {
    CloseIssueParams,
    CommentOnIssueParams,
    CreateIssueParams,
    EditIssueParams,
    ListIssuesParams,
    ReopenIssueParams,
    ViewIssueParams,
} from "./issue-tools";

export { createRepoTools } from "./repo-tools";
export type {
    CloneRepoParams,
    CreateRepoParams,
    DeleteRepoParams,
    ForkRepoParams,
    ListReposParams,
    SyncRepoParams,
    ViewRepoParams,
} from "./repo-tools";

export { createWorkflowTools } from "./workflow-tools";
export type {
    DisableWorkflowParams,
    EnableWorkflowParams,
    ListWorkflowsParams,
    RunWorkflowParams,
    ViewWorkflowParams,
    WorkflowLogsParams,
} from "./workflow-tools";

export { GHAuthError, GHError, GHNotFoundError, GHRateLimitError } from "./error-handler";
```

Leave the `export default function ghExtension(pi: ExtensionAPI): void {` and everything below it untouched.

### Step 2: Typecheck

Run: `bun run typecheck`
Expected: clean. If any param type name doesn't match the actual export (e.g., a typo in issue-tools), the typecheck will fail with a clear error — fix by cross-checking against the `src/*-tools.ts` exports.

### Step 3: Build and inspect `dist/index.d.ts`

Run: `bun run build`
Expected: exits 0, writes `dist/`.

Run: `grep -E "^export (declare )?(function|class|type|\{)" dist/index.d.ts | sort`

Expected to include lines mentioning: `createGHClient`, `GHClient`, `createPRTools`, `createIssueTools`, `createRepoTools`, `createWorkflowTools`, `ChecksParams`, `ExecOptions`, `ExecResult`, `PiExecFn`, `GHError`, `GHAuthError`, `GHRateLimitError`, `GHNotFoundError`, and the default export `ghExtension`.

### Step 4: Run the full test suite

Run: `bun run test`
Expected: all tests pass.

### Step 5: Lint

Run: `bun run check`
Expected: biome clean.

### Step 6: Commit

```bash
git add src/index.ts
git commit -m "feat(index): add library-style named exports for TFF consumers"
```

---

## Task 6: Final verification gate

**Files:** none (checks-only).

### Step 1: Run every verification target

Run each command, one at a time, and confirm the expected outcome:

- `bun run test` → all tests pass.
- `bun run typecheck` → clean exit.
- `bun run check` → biome clean.
- `bun run build` → `dist/` produced without errors.

### Step 2: Sanity-check the shipped surface

Run: `node -e "import('./dist/index.js').then(m => console.log(Object.keys(m).sort()))"`

Expected output (order matches the sort): an array containing at minimum
`createGHClient`, `GHClient`, `createPRTools`, `createIssueTools`,
`createRepoTools`, `createWorkflowTools`, `GHError`, `GHAuthError`,
`GHRateLimitError`, `GHNotFoundError`, `default`.

### Step 3: Confirm no manual version bump was made

Run: `git diff main -- package.json`
Expected: no change to the `version` field. Release-please will bump it on merge.

### Step 4: Write the PR-ready summary

Draft (for the eventual PR body, keep it with the task notes):

```
Adds the library surface TFF needs to use gh-pi without shelling out:

- createGHClient() factory (Node-default exec)
- GHError now carries stdout for failure-details
- pr.checks() with --watch (10min default timeout) and --required; returns
  ExecResult on check failure so callers can inspect which checks failed
- pr.view() JSON now includes `comments`
- Named re-exports of every tool factory, param type, and error class

No behavior change for the existing PI extension.
```

No commit needed for this task — it's pure verification.

---

## Self-Review Notes (from author)

**Spec coverage check:**
- §1 `createGHClient` + `GHError.stdout` → Tasks 1, 2.
- §2 `pr.checks` + `pr.view` comments → Tasks 3, 4.
- §3 library exports → Task 5.
- §4 tests → covered by TDD steps in Tasks 1–4.
- §5 no manual bump → Task 6, Step 3.
- §6 verification gate → Task 6, Steps 1–2.

**Type consistency check:**
- `ChecksParams` name is stable across Tasks 4 and 5.
- `PiExecFn`, `ExecOptions`, `ExecResult` referenced only where already exported from `gh-client.ts`.
- Every `*Params` name in Task 5's export list cross-checked against `grep ^export` output from the source files.

No outstanding gaps.
