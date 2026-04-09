/**
 * GitHub CLI Extension for PI
 *
 * Wraps the `gh` CLI to provide GitHub operations as PI tools.
 */

import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { defineTool, truncateHead } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { GHNotFoundError, getInstallInstructions } from "./error-handler";
import { type ExecResult, GHClient } from "./gh-client";
import { createIssueTools } from "./issue-tools";
import { createPRTools } from "./pr-tools";
import { createRepoTools } from "./repo-tools";
import { createWorkflowTools } from "./workflow-tools";

/**
 * Main extension export
 */
export default function ghExtension(pi: ExtensionAPI): void {
	// Per-extension state — scoped to this invocation of the factory so that
	// PI's `/reload` gives us a fresh slate instead of leaking into old
	// handler closures. The `gh` binary path is taken from GH_CLI_PATH when
	// set, so users with a non-standard install can point us at it.
	const binaryPath = process.env.GH_CLI_PATH ?? "gh";
	const state = {
		client: new GHClient({ exec: pi.exec.bind(pi), binaryPath }),
		detectionStatus: "unchecked" as "unchecked" | "missing" | "unauthenticated" | "ready",
	};

	/**
	 * Probe the gh binary (and optionally auth). Caches the result on state.
	 * Never throws — returns the outcome so callers can decide what to do.
	 *
	 * Uses the same binary path as the GHClient so GH_CLI_PATH is honored
	 * end-to-end (probe and tool calls hit the same binary).
	 */
	async function probeBinary(): Promise<typeof state.detectionStatus> {
		const bin = state.client.binaryPath;
		try {
			const versionResult = await pi.exec(bin, ["--version"], { timeout: 5000 });
			if (versionResult.code !== 0) {
				state.detectionStatus = "missing";
				return state.detectionStatus;
			}
		} catch {
			state.detectionStatus = "missing";
			return state.detectionStatus;
		}

		try {
			const authResult = await pi.exec(bin, ["auth", "status"], { timeout: 5000 });
			state.detectionStatus = authResult.code === 0 ? "ready" : "unauthenticated";
		} catch {
			state.detectionStatus = "unauthenticated";
		}

		return state.detectionStatus;
	}

	/**
	 * Guard used by every tool: ensures `gh` is installed and authenticated
	 * before running anything, auto-detecting on first call.
	 */
	async function ensureReady(): Promise<void> {
		if (state.detectionStatus === "unchecked") {
			await probeBinary();
		}
		if (state.detectionStatus === "missing") {
			throw new GHNotFoundError();
		}
		if (state.detectionStatus === "unauthenticated") {
			throw new Error("gh CLI is installed but not authenticated. Run: gh auth login");
		}
	}

	// Session lifecycle — probe on start so we can surface a nice notification,
	// and reset detection on shutdown so a future reload re-probes.
	pi.on("session_start", async (_event, ctx) => {
		const status = await probeBinary();

		if (!ctx.hasUI) return;

		switch (status) {
			case "ready":
				ctx.ui.notify("GitHub CLI ready (authenticated)", "info");
				break;
			case "missing":
				ctx.ui.notify(getInstallInstructions(), "warning");
				break;
			case "unauthenticated":
				ctx.ui.notify("gh CLI is installed but not authenticated. Run: gh auth login", "warning");
				break;
		}
	});

	pi.on("session_shutdown", () => {
		state.detectionStatus = "unchecked";
	});

	/**
	 * Render a tool result's stdout/data as a truncated text block.
	 *
	 * PI's extension contract requires outputs to fit in ~50KB/2000 lines;
	 * large gh outputs (pr diff, run logs, json listings) are truncated here
	 * with a trailing notice. Cancelled runs (exit 2) are surfaced explicitly
	 * instead of masquerading as "Success".
	 */
	function formatOutput(result: ExecResult): string {
		if (result.code === 2) {
			const detail = result.stderr.trim() || result.stdout.trim();
			return detail ? `gh command cancelled: ${detail}` : "gh command cancelled";
		}

		const raw = result.data ? JSON.stringify(result.data, null, 2) : result.stdout || "Success";

		const truncation = truncateHead(raw);
		if (!truncation.truncated) {
			return raw;
		}

		const reason =
			truncation.truncatedBy === "lines"
				? `${truncation.outputLines} of ${truncation.totalLines} lines`
				: `${truncation.outputBytes} of ${truncation.totalBytes} bytes`;
		return `${truncation.content}\n\n[truncated: showing ${reason}]`;
	}

	// ---------------------------------------------------------------------
	// tff-github_repo
	// ---------------------------------------------------------------------
	pi.registerTool(
		defineTool({
			// Namespaced with tff- prefix so it can coexist with other pi
			// packages that might ship a similarly-named tool. The LLM-facing
			// id is the only thing that changes; the display label stays
			// readable.
			name: "tff-github_repo",
			label: "GitHub Repository",
			description: "Manage GitHub repositories: create, clone, fork, list, view, delete, sync.",
			promptSnippet: "Work with GitHub repositories",
			promptGuidelines: [
				"Use for repository operations like creating, cloning, forking",
				"Always specify the action parameter",
				"For delete action, confirm: true is required",
				"Repo names should be in owner/name format when required",
			],
			parameters: Type.Object({
				action: StringEnum(["create", "clone", "fork", "list", "view", "delete", "sync"] as const, {
					description: "Repository action to perform",
				}),
				name: Type.Optional(
					Type.String({ description: "Repository name (for create, view, delete)" }),
				),
				owner: Type.Optional(
					Type.String({
						description: "Repository owner (for fork, clone, view, delete)",
					}),
				),
				visibility: Type.Optional(StringEnum(["public", "private", "internal"] as const)),
				description: Type.Optional(Type.String({ description: "Repository description" })),
				template: Type.Optional(
					Type.String({ description: "Template repository to use (owner/repo)" }),
				),
				auto_init: Type.Optional(Type.Boolean({ description: "Initialize with README" })),
				directory: Type.Optional(Type.String({ description: "Clone directory" })),
				branch: Type.Optional(Type.String({ description: "Branch to clone or sync" })),
				default_branch_only: Type.Optional(
					Type.Boolean({ description: "Fork only default branch" }),
				),
				confirm: Type.Optional(Type.Boolean({ description: "Confirm destructive actions" })),
				limit: Type.Optional(Type.Number({ description: "Max results for list" })),
			}),

			async execute(_toolCallId, params, signal) {
				await ensureReady();

				const tools = createRepoTools(state.client);
				let result: ExecResult;

				switch (params.action) {
					case "create":
						if (!params.name) throw new Error("name is required for create");
						result = await tools.create(
							{
								name: params.name,
								visibility: params.visibility,
								description: params.description,
								auto_init: params.auto_init,
								template: params.template,
							},
							{ signal },
						);
						break;

					case "clone":
						if (!params.owner || !params.name)
							throw new Error("owner and name are required for clone");
						result = await tools.clone(
							{
								owner: params.owner,
								name: params.name,
								directory: params.directory,
								branch: params.branch,
							},
							{ signal },
						);
						break;

					case "fork":
						if (!params.owner || !params.name)
							throw new Error("owner and name are required for fork");
						result = await tools.fork(
							{
								owner: params.owner,
								name: params.name,
								default_branch_only: params.default_branch_only,
							},
							{ signal },
						);
						break;

					case "list":
						result = await tools.list(
							{
								owner: params.owner,
								limit: params.limit,
								visibility: params.visibility,
							},
							{ signal },
						);
						break;

					case "view":
						if (!params.owner || !params.name)
							throw new Error("owner and name are required for view");
						result = await tools.view({ owner: params.owner, name: params.name }, { signal });
						break;

					case "delete":
						if (!params.owner || !params.name)
							throw new Error("owner and name are required for delete");
						result = await tools.delete(
							{
								owner: params.owner,
								name: params.name,
								confirm: params.confirm ?? false,
							},
							{ signal },
						);
						break;

					case "sync":
						result = await tools.sync({ branch: params.branch }, { signal });
						break;

					default:
						throw new Error(`Unknown action: ${params.action}`);
				}

				return {
					content: [{ type: "text", text: formatOutput(result) }],
					details: { action: params.action, code: result.code },
				};
			},
		}),
	);

	// ---------------------------------------------------------------------
	// tff-github_issue
	// ---------------------------------------------------------------------
	pi.registerTool(
		defineTool({
			name: "tff-github_issue",
			label: "GitHub Issue",
			description: "Manage GitHub issues: create, list, view, close, reopen, comment, edit.",
			promptSnippet: "Work with GitHub issues",
			promptGuidelines: [
				"Use for issue operations like creating, listing, closing",
				"Always specify the repo in owner/name format",
				"Issue numbers are required for view, close, reopen, comment, edit",
			],
			parameters: Type.Object({
				action: StringEnum(
					["create", "list", "view", "close", "reopen", "comment", "edit"] as const,
					{ description: "Issue action to perform" },
				),
				repo: Type.String({ description: "Repository in owner/name format" }),
				title: Type.Optional(Type.String({ description: "Issue title (for create)" })),
				body: Type.Optional(Type.String({ description: "Issue body (markdown supported)" })),
				number: Type.Optional(Type.Number({ description: "Issue number (for view, close, etc.)" })),
				state: Type.Optional(StringEnum(["open", "closed", "all"] as const)),
				assignee: Type.Optional(Type.String({ description: "Filter by assignee (list)" })),
				assignees: Type.Optional(Type.Array(Type.String(), { description: "Assignees (create)" })),
				author: Type.Optional(Type.String({ description: "Filter by author" })),
				labels: Type.Optional(Type.Array(Type.String(), { description: "Label names" })),
				limit: Type.Optional(Type.Number({ description: "Max results for list" })),
				milestone: Type.Optional(
					Type.String({ description: "Milestone name (create or list filter)" }),
				),
				projects: Type.Optional(
					Type.Array(Type.String(), { description: "Project names (create)" }),
				),
				comment_text: Type.Optional(Type.String({ description: "Comment text" })),
				reason: Type.Optional(StringEnum(["completed", "not_planned"] as const)),
				add_labels: Type.Optional(Type.Array(Type.String())),
				remove_labels: Type.Optional(Type.Array(Type.String())),
				add_assignees: Type.Optional(Type.Array(Type.String())),
				remove_assignees: Type.Optional(Type.Array(Type.String())),
			}),

			async execute(_toolCallId, params, signal) {
				await ensureReady();

				const tools = createIssueTools(state.client);
				let result: ExecResult;

				switch (params.action) {
					case "create":
						if (!params.title) throw new Error("title is required for create");
						result = await tools.create(
							{
								repo: params.repo,
								title: params.title,
								body: params.body,
								labels: params.labels,
								assignees: params.assignees,
								milestone: params.milestone,
								projects: params.projects,
							},
							{ signal },
						);
						break;

					case "list":
						result = await tools.list(
							{
								repo: params.repo,
								state: params.state,
								assignee: params.assignee,
								author: params.author,
								labels: params.labels,
								limit: params.limit,
								milestone: params.milestone,
							},
							{ signal },
						);
						break;

					case "view":
						if (!params.number) throw new Error("number is required for view");
						result = await tools.view({ repo: params.repo, number: params.number }, { signal });
						break;

					case "close":
						if (!params.number) throw new Error("number is required for close");
						result = await tools.close(
							{
								repo: params.repo,
								number: params.number,
								comment: params.comment_text,
								reason: params.reason,
							},
							{ signal },
						);
						break;

					case "reopen":
						if (!params.number) throw new Error("number is required for reopen");
						result = await tools.reopen({ repo: params.repo, number: params.number }, { signal });
						break;

					case "comment":
						if (!params.number) throw new Error("number is required for comment");
						if (!params.comment_text) throw new Error("comment_text is required for comment");
						result = await tools.comment(
							{
								repo: params.repo,
								number: params.number,
								body: params.comment_text,
							},
							{ signal },
						);
						break;

					case "edit":
						if (!params.number) throw new Error("number is required for edit");
						result = await tools.edit(
							{
								repo: params.repo,
								number: params.number,
								title: params.title,
								body: params.body,
								add_labels: params.add_labels,
								remove_labels: params.remove_labels,
								add_assignees: params.add_assignees,
								remove_assignees: params.remove_assignees,
							},
							{ signal },
						);
						break;

					default:
						throw new Error(`Unknown action: ${params.action}`);
				}

				return {
					content: [{ type: "text", text: formatOutput(result) }],
					details: { action: params.action, code: result.code },
				};
			},
		}),
	);

	// ---------------------------------------------------------------------
	// tff-github_pr
	// ---------------------------------------------------------------------
	pi.registerTool(
		defineTool({
			name: "tff-github_pr",
			label: "GitHub Pull Request",
			description:
				"Manage GitHub pull requests: create, list, view, diff, merge, review, close, checkout.",
			promptSnippet: "Work with GitHub pull requests",
			promptGuidelines: [
				"Use for PR operations like creating, merging, reviewing",
				"Always specify the repo in owner/name format",
				"PR numbers are required for view, merge, review, close, checkout",
				"review_action 'request-changes' and 'comment' require a non-empty body",
			],
			parameters: Type.Object({
				action: StringEnum(
					["create", "list", "view", "diff", "merge", "review", "close", "checkout"] as const,
					{ description: "PR action to perform" },
				),
				repo: Type.String({ description: "Repository in owner/name format" }),
				title: Type.Optional(Type.String({ description: "PR title (for create)" })),
				body: Type.Optional(Type.String({ description: "PR body or review body" })),
				head: Type.Optional(Type.String({ description: "Head branch (create, or list filter)" })),
				base: Type.Optional(Type.String({ description: "Base branch (create, or list filter)" })),
				author: Type.Optional(Type.String({ description: "Filter by author (list)" })),
				number: Type.Optional(Type.Number({ description: "PR number" })),
				state: Type.Optional(StringEnum(["open", "closed", "merged", "all"] as const)),
				draft: Type.Optional(Type.Boolean()),
				method: Type.Optional(StringEnum(["merge", "squash", "rebase"] as const)),
				auto: Type.Optional(Type.Boolean({ description: "Enable auto-merge" })),
				delete_branch: Type.Optional(Type.Boolean()),
				review_action: Type.Optional(
					StringEnum(["approve", "request-changes", "comment"] as const),
				),
				comment_text: Type.Optional(Type.String({ description: "Comment for close" })),
				branch: Type.Optional(Type.String({ description: "Checkout branch name" })),
				limit: Type.Optional(Type.Number({ description: "Max results for list" })),
			}),

			async execute(_toolCallId, params, signal) {
				await ensureReady();

				const tools = createPRTools(state.client);
				let result: ExecResult;

				switch (params.action) {
					case "create":
						if (!params.title) throw new Error("title is required for create");
						if (!params.head) throw new Error("head is required for create");
						if (!params.base) throw new Error("base is required for create");
						result = await tools.create(
							{
								repo: params.repo,
								title: params.title,
								body: params.body,
								head: params.head,
								base: params.base,
								draft: params.draft,
							},
							{ signal },
						);
						break;

					case "list":
						result = await tools.list(
							{
								repo: params.repo,
								state: params.state,
								head: params.head,
								base: params.base,
								author: params.author,
								limit: params.limit,
							},
							{ signal },
						);
						break;

					case "view":
						if (!params.number) throw new Error("number is required for view");
						result = await tools.view({ repo: params.repo, number: params.number }, { signal });
						break;

					case "diff":
						if (!params.number) throw new Error("number is required for diff");
						result = await tools.diff({ repo: params.repo, number: params.number }, { signal });
						break;

					case "merge":
						if (!params.number) throw new Error("number is required for merge");
						result = await tools.merge(
							{
								repo: params.repo,
								number: params.number,
								method: params.method,
								auto: params.auto,
								delete_branch: params.delete_branch,
							},
							{ signal },
						);
						break;

					case "review": {
						if (!params.number) throw new Error("number is required for review");
						if (!params.review_action) throw new Error("review_action is required for review");
						if (params.review_action !== "approve" && !params.body) {
							throw new Error(`review_action '${params.review_action}' requires a non-empty body`);
						}
						result = await tools.review(
							{
								repo: params.repo,
								number: params.number,
								action: params.review_action,
								body: params.body,
							},
							{ signal },
						);
						break;
					}

					case "close":
						if (!params.number) throw new Error("number is required for close");
						result = await tools.close(
							{
								repo: params.repo,
								number: params.number,
								comment: params.comment_text,
							},
							{ signal },
						);
						break;

					case "checkout":
						if (!params.number) throw new Error("number is required for checkout");
						result = await tools.checkout(
							{
								repo: params.repo,
								number: params.number,
								branch: params.branch,
							},
							{ signal },
						);
						break;

					default:
						throw new Error(`Unknown action: ${params.action}`);
				}

				return {
					content: [{ type: "text", text: formatOutput(result) }],
					details: { action: params.action, code: result.code },
				};
			},
		}),
	);

	// ---------------------------------------------------------------------
	// tff-github_workflow
	// ---------------------------------------------------------------------
	pi.registerTool(
		defineTool({
			name: "tff-github_workflow",
			label: "GitHub Workflow",
			description: "Manage GitHub Actions workflows: list, view, run, logs, disable, enable.",
			promptSnippet: "Work with GitHub Actions workflows",
			promptGuidelines: [
				"Use for workflow operations like running, viewing logs",
				"Always specify the repo in owner/name format",
				"run_id is required for logs action",
			],
			parameters: Type.Object({
				action: StringEnum(["list", "view", "run", "logs", "disable", "enable"] as const, {
					description: "Workflow action to perform",
				}),
				repo: Type.String({ description: "Repository in owner/name format" }),
				workflow: Type.Optional(Type.String({ description: "Workflow name, ID, or filename" })),
				branch: Type.Optional(Type.String({ description: "Branch for workflow run" })),
				inputs: Type.Optional(
					Type.Record(Type.String(), Type.String(), { description: "Workflow inputs" }),
				),
				run_id: Type.Optional(Type.String({ description: "Run ID for logs" })),
				limit: Type.Optional(Type.Number({ description: "Max results for list" })),
			}),

			async execute(_toolCallId, params, signal) {
				await ensureReady();

				const tools = createWorkflowTools(state.client);
				let result: ExecResult;

				switch (params.action) {
					case "list":
						result = await tools.list({ repo: params.repo, limit: params.limit }, { signal });
						break;

					case "view":
						if (!params.workflow) throw new Error("workflow is required for view");
						result = await tools.view({ repo: params.repo, workflow: params.workflow }, { signal });
						break;

					case "run":
						if (!params.workflow) throw new Error("workflow is required for run");
						result = await tools.run(
							{
								repo: params.repo,
								workflow: params.workflow,
								branch: params.branch,
								inputs: params.inputs,
							},
							{ signal },
						);
						break;

					case "logs":
						if (!params.run_id) throw new Error("run_id is required for logs");
						result = await tools.logs({ repo: params.repo, run_id: params.run_id }, { signal });
						break;

					case "disable":
						if (!params.workflow) throw new Error("workflow is required for disable");
						result = await tools.disable(
							{ repo: params.repo, workflow: params.workflow },
							{ signal },
						);
						break;

					case "enable":
						if (!params.workflow) throw new Error("workflow is required for enable");
						result = await tools.enable(
							{ repo: params.repo, workflow: params.workflow },
							{ signal },
						);
						break;

					default:
						throw new Error(`Unknown action: ${params.action}`);
				}

				return {
					content: [{ type: "text", text: formatOutput(result) }],
					details: { action: params.action, code: result.code },
				};
			},
		}),
	);
}
