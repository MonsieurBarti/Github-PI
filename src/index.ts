/**
 * GitHub CLI Extension for PI
 *
 * Wraps the `gh` CLI to provide GitHub operations as PI tools.
 */

import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { GHNotFoundError, getInstallInstructions } from "./error-handler";
import { GHClient } from "./gh-client";
import { createIssueTools } from "./issue-tools";
import { createPRTools } from "./pr-tools";
import { createRepoTools } from "./repo-tools";
import { createWorkflowTools } from "./workflow-tools";

// Extension state
interface ExtensionState {
	client: GHClient | null;
	binaryPath: string | null;
}

const state: ExtensionState = {
	client: null,
	binaryPath: null,
};

/**
 * Main extension export
 */
export default function ghExtension(pi: ExtensionAPI) {
	// Initialize client
	const client = new GHClient();
	state.client = client;

	// Register session_start handler for binary detection
	pi.on("session_start", async (_event, ctx) => {
		try {
			const binaryPath = client.detectBinarySync();
			state.binaryPath = binaryPath;

			// Set up the pi.exec function for the client
			client.setPiExecFn(pi.exec.bind(pi));

			if (ctx.hasUI) {
				ctx.ui.notify(`GitHub CLI ready (${binaryPath})`, "info");
			}
		} catch (error) {
			if (error instanceof GHNotFoundError) {
				if (ctx.hasUI) {
					ctx.ui.notify(getInstallInstructions(), "warning");
				}
			} else {
				if (ctx.hasUI) {
					ctx.ui.notify(
						`GitHub CLI init error: ${error instanceof Error ? error.message : String(error)}`,
						"error",
					);
				}
			}
		}
	});

	// Register session_shutdown handler
	pi.on("session_shutdown", async () => {
		state.client = null;
		state.binaryPath = null;
	});

	// Get tools bound to client
	const getRepoTools = () => createRepoTools(client);
	const getIssueTools = () => createIssueTools(client);
	const getPRTools = () => createPRTools(client);
	const getWorkflowTools = () => createWorkflowTools(client);

	// Register github_repo tool
	const repoTool = defineTool({
		name: "github_repo",
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
				Type.String({ description: "Repository owner (for fork, clone, view, delete)" }),
			),
			visibility: Type.Optional(StringEnum(["public", "private", "internal"] as const)),
			description: Type.Optional(Type.String({ description: "Repository description" })),
			template: Type.Optional(
				Type.String({ description: "Template repository to use (owner/repo)" }),
			),
			auto_init: Type.Optional(Type.Boolean({ description: "Initialize with README" })),
			directory: Type.Optional(Type.String({ description: "Clone directory" })),
			branch: Type.Optional(Type.String({ description: "Branch to clone or sync" })),
			default_branch_only: Type.Optional(Type.Boolean({ description: "Fork only default branch" })),
			confirm: Type.Optional(Type.Boolean({ description: "Confirm destructive actions" })),
			limit: Type.Optional(Type.Number({ description: "Max results for list" })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			if (!state.binaryPath) {
				throw new GHNotFoundError();
			}

			const tools = getRepoTools();
			let result: any;

			switch (params.action) {
				case "create":
					if (!params.name) throw new Error("name is required for create");
					result = await tools.create({
						name: params.name,
						visibility: params.visibility,
						description: params.description,
						auto_init: params.auto_init,
						template: params.template,
					});
					break;

				case "clone":
					if (!params.owner || !params.name)
						throw new Error("owner and name are required for clone");
					result = await tools.clone({
						owner: params.owner,
						name: params.name,
						directory: params.directory,
						branch: params.branch,
					});
					break;

				case "fork":
					if (!params.owner || !params.name)
						throw new Error("owner and name are required for fork");
					result = await tools.fork({
						owner: params.owner,
						name: params.name,
						default_branch_only: params.default_branch_only,
					});
					break;

				case "list":
					result = await tools.list({
						owner: params.owner,
						limit: params.limit,
						visibility: params.visibility,
					});
					break;

				case "view":
					if (!params.owner || !params.name)
						throw new Error("owner and name are required for view");
					result = await tools.view({
						owner: params.owner,
						name: params.name,
					});
					break;

				case "delete":
					if (!params.owner || !params.name)
						throw new Error("owner and name are required for delete");
					result = await tools.delete({
						owner: params.owner,
						name: params.name,
						confirm: params.confirm ?? false,
					});
					break;

				case "sync":
					result = await tools.sync({
						branch: params.branch,
					});
					break;

				default:
					throw new Error(`Unknown action: ${params.action}`);
			}

			const output = result.data
				? JSON.stringify(result.data, null, 2)
				: result.stdout || "Success";

			return {
				content: [{ type: "text", text: output }],
				details: {
					action: params.action,
					code: result.code,
				},
			};
		},
	});

	// Register github_issue tool
	const issueTool = defineTool({
		name: "github_issue",
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
				{
					description: "Issue action to perform",
				},
			),
			repo: Type.String({ description: "Repository in owner/name format" }),
			title: Type.Optional(Type.String({ description: "Issue title (for create)" })),
			body: Type.Optional(Type.String({ description: "Issue body (markdown supported)" })),
			number: Type.Optional(Type.Number({ description: "Issue number (for view, close, etc.)" })),
			state: Type.Optional(StringEnum(["open", "closed", "all"] as const)),
			assignee: Type.Optional(Type.String({ description: "Filter by assignee" })),
			author: Type.Optional(Type.String({ description: "Filter by author" })),
			labels: Type.Optional(Type.Array(Type.String(), { description: "Label names" })),
			limit: Type.Optional(Type.Number({ description: "Max results for list" })),
			milestone: Type.Optional(Type.String({ description: "Milestone name" })),
			comment_text: Type.Optional(Type.String({ description: "Comment text" })),
			reason: Type.Optional(StringEnum(["completed", "not_planned"] as const)),
			add_labels: Type.Optional(Type.Array(Type.String())),
			remove_labels: Type.Optional(Type.Array(Type.String())),
			add_assignees: Type.Optional(Type.Array(Type.String())),
			remove_assignees: Type.Optional(Type.Array(Type.String())),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			if (!state.binaryPath) {
				throw new GHNotFoundError();
			}

			const tools = getIssueTools();
			let result: any;

			switch (params.action) {
				case "create":
					if (!params.title) throw new Error("title is required for create");
					result = await tools.create({
						repo: params.repo,
						title: params.title,
						body: params.body,
						labels: params.labels,
					});
					break;

				case "list":
					result = await tools.list({
						repo: params.repo,
						state: params.state,
						assignee: params.assignee,
						author: params.author,
						label: params.labels,
						limit: params.limit,
						milestone: params.milestone,
					});
					break;

				case "view":
					if (!params.number) throw new Error("number is required for view");
					result = await tools.view({
						repo: params.repo,
						number: params.number,
					});
					break;

				case "close":
					if (!params.number) throw new Error("number is required for close");
					result = await tools.close({
						repo: params.repo,
						number: params.number,
						comment: params.comment_text,
						reason: params.reason,
					});
					break;

				case "reopen":
					if (!params.number) throw new Error("number is required for reopen");
					result = await tools.reopen({
						repo: params.repo,
						number: params.number,
					});
					break;

				case "comment":
					if (!params.number) throw new Error("number is required for comment");
					if (!params.comment_text) throw new Error("comment_text is required for comment");
					result = await tools.comment({
						repo: params.repo,
						number: params.number,
						body: params.comment_text,
					});
					break;

				case "edit":
					if (!params.number) throw new Error("number is required for edit");
					result = await tools.edit({
						repo: params.repo,
						number: params.number,
						title: params.title,
						body: params.body,
						add_labels: params.add_labels,
						remove_labels: params.remove_labels,
						add_assignees: params.add_assignees,
						remove_assignees: params.remove_assignees,
					});
					break;

				default:
					throw new Error(`Unknown action: ${params.action}`);
			}

			const output = result.data
				? JSON.stringify(result.data, null, 2)
				: result.stdout || "Success";

			return {
				content: [{ type: "text", text: output }],
				details: {
					action: params.action,
					code: result.code,
				},
			};
		},
	});

	// Register github_pr tool
	const prTool = defineTool({
		name: "github_pr",
		label: "GitHub Pull Request",
		description:
			"Manage GitHub pull requests: create, list, view, diff, merge, review, close, checkout.",
		promptSnippet: "Work with GitHub pull requests",
		promptGuidelines: [
			"Use for PR operations like creating, merging, reviewing",
			"Always specify the repo in owner/name format",
			"PR numbers are required for view, merge, review, close, checkout",
		],
		parameters: Type.Object({
			action: StringEnum(
				["create", "list", "view", "diff", "merge", "review", "close", "checkout"] as const,
				{
					description: "PR action to perform",
				},
			),
			repo: Type.String({ description: "Repository in owner/name format" }),
			title: Type.Optional(Type.String({ description: "PR title (for create)" })),
			body: Type.Optional(Type.String({ description: "PR body" })),
			head: Type.Optional(Type.String({ description: "Head branch (for create)" })),
			base: Type.Optional(Type.String({ description: "Base branch (for create)" })),
			number: Type.Optional(Type.Number({ description: "PR number" })),
			state: Type.Optional(StringEnum(["open", "closed", "merged", "all"] as const)),
			draft: Type.Optional(Type.Boolean()),
			method: Type.Optional(StringEnum(["merge", "squash", "rebase"] as const)),
			auto: Type.Optional(Type.Boolean({ description: "Enable auto-merge" })),
			delete_branch: Type.Optional(Type.Boolean()),
			review_action: Type.Optional(StringEnum(["approve", "request-changes", "comment"] as const)),
			branch: Type.Optional(Type.String({ description: "Checkout branch name" })),
			limit: Type.Optional(Type.Number({ description: "Max results for list" })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			if (!state.binaryPath) {
				throw new GHNotFoundError();
			}

			const tools = getPRTools();
			let result: any;

			switch (params.action) {
				case "create":
					if (!params.title) throw new Error("title is required for create");
					if (!params.head) throw new Error("head is required for create");
					if (!params.base) throw new Error("base is required for create");
					result = await tools.create({
						repo: params.repo,
						title: params.title,
						body: params.body,
						head: params.head,
						base: params.base,
						draft: params.draft,
					});
					break;

				case "list":
					result = await tools.list({
						repo: params.repo,
						state: params.state,
						limit: params.limit,
					});
					break;

				case "view":
					if (!params.number) throw new Error("number is required for view");
					result = await tools.view({
						repo: params.repo,
						number: params.number,
					});
					break;

				case "diff":
					if (!params.number) throw new Error("number is required for diff");
					result = await tools.diff({
						repo: params.repo,
						number: params.number,
					});
					break;

				case "merge":
					if (!params.number) throw new Error("number is required for merge");
					result = await tools.merge({
						repo: params.repo,
						number: params.number,
						method: params.method,
						auto: params.auto,
						delete_branch: params.delete_branch,
					});
					break;

				case "review":
					if (!params.number) throw new Error("number is required for review");
					if (!params.review_action) throw new Error("review_action is required for review");
					result = await tools.review({
						repo: params.repo,
						number: params.number,
						action: params.review_action,
						body: params.body,
					});
					break;

				case "close":
					if (!params.number) throw new Error("number is required for close");
					result = await tools.close({
						repo: params.repo,
						number: params.number,
						comment: params.body,
					});
					break;

				case "checkout":
					if (!params.number) throw new Error("number is required for checkout");
					result = await tools.checkout({
						repo: params.repo,
						number: params.number,
						branch: params.branch,
					});
					break;

				default:
					throw new Error(`Unknown action: ${params.action}`);
			}

			const output = result.data
				? JSON.stringify(result.data, null, 2)
				: result.stdout || "Success";

			return {
				content: [{ type: "text", text: output }],
				details: {
					action: params.action,
					code: result.code,
				},
			};
		},
	});

	// Register github_workflow tool
	const workflowTool = defineTool({
		name: "github_workflow",
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

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			if (!state.binaryPath) {
				throw new GHNotFoundError();
			}

			const tools = getWorkflowTools();
			let result: any;

			switch (params.action) {
				case "list":
					result = await tools.list({
						repo: params.repo,
						limit: params.limit,
					});
					break;

				case "view":
					if (!params.workflow) throw new Error("workflow is required for view");
					result = await tools.view({
						repo: params.repo,
						workflow: params.workflow,
					});
					break;

				case "run":
					if (!params.workflow) throw new Error("workflow is required for run");
					result = await tools.run({
						repo: params.repo,
						workflow: params.workflow,
						branch: params.branch,
						inputs: params.inputs,
					});
					break;

				case "logs":
					if (!params.run_id) throw new Error("run_id is required for logs");
					result = await tools.logs({
						repo: params.repo,
						run_id: params.run_id,
					});
					break;

				case "disable":
					if (!params.workflow) throw new Error("workflow is required for disable");
					result = await tools.disable({
						repo: params.repo,
						workflow: params.workflow,
					});
					break;

				case "enable":
					if (!params.workflow) throw new Error("workflow is required for enable");
					result = await tools.enable({
						repo: params.repo,
						workflow: params.workflow,
					});
					break;

				default:
					throw new Error(`Unknown action: ${params.action}`);
			}

			const output = result.data
				? JSON.stringify(result.data, null, 2)
				: result.stdout || "Success";

			return {
				content: [{ type: "text", text: output }],
				details: {
					action: params.action,
					code: result.code,
				},
			};
		},
	});

	// Register all tools
	pi.registerTool(repoTool);
	pi.registerTool(issueTool);
	pi.registerTool(prTool);
	pi.registerTool(workflowTool);
}
