import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ghExtension from "../../src/index.js";

interface ToolParameter {
	type: string;
	enum?: string[];
}

interface ToolParameters {
	properties: {
		action: ToolParameter;
	};
}

interface Tool {
	name: string;
	label: string;
	parameters: ToolParameters;
	promptGuidelines?: string[];
	execute: (
		toolCallId: string,
		params: Record<string, unknown>,
		signal: AbortSignal | undefined,
		onUpdate: unknown,
		ctx: unknown,
	) => Promise<{ content: Array<{ type: string; text: string }>; details: unknown }>;
}

type SessionStartHandler = (
	_event: unknown,
	ctx: { hasUI: boolean; ui: { notify: ReturnType<typeof vi.fn> } },
) => Promise<void>;

describe("gh-extension", () => {
	let mockPi: ExtensionAPI;
	let registeredTools: Map<string, Tool>;
	let eventHandlers: Map<string, unknown>;
	let mockExec: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		registeredTools = new Map();
		eventHandlers = new Map();
		mockExec = vi.fn();

		mockPi = {
			registerTool: vi.fn((tool: Tool) => {
				registeredTools.set(tool.name, tool);
			}),
			registerCommand: vi.fn(),
			on: vi.fn((event: string, handler: unknown) => {
				eventHandlers.set(event, handler);
			}),
			exec: mockExec,
		} as unknown as ExtensionAPI;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("registers all github_* tools", () => {
		ghExtension(mockPi);
		expect(registeredTools.has("tff-github_repo")).toBe(true);
		expect(registeredTools.has("tff-github_issue")).toBe(true);
		expect(registeredTools.has("tff-github_pr")).toBe(true);
		expect(registeredTools.has("tff-github_workflow")).toBe(true);
	});

	it("registers session_start and session_shutdown handlers", () => {
		ghExtension(mockPi);
		expect(eventHandlers.has("session_start")).toBe(true);
		expect(eventHandlers.has("session_shutdown")).toBe(true);
	});

	describe("github_repo tool", () => {
		it("exposes the expected actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("tff-github_repo");
			expect(tool).toBeDefined();
			expect(tool?.name).toBe("tff-github_repo");
			expect(tool?.label).toBe("GitHub Repository");
			for (const action of ["create", "list", "clone", "fork", "view", "delete", "sync"]) {
				expect(tool?.parameters.properties.action.enum).toContain(action);
			}
		});

		it("has prompt guidelines", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("tff-github_repo");
			expect(tool?.promptGuidelines?.length).toBeGreaterThan(0);
		});
	});

	describe("github_issue tool", () => {
		it("has correct actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("tff-github_issue");
			expect(tool?.name).toBe("tff-github_issue");
			for (const action of ["create", "list", "view", "close", "reopen", "comment", "edit"]) {
				expect(tool?.parameters.properties.action.enum).toContain(action);
			}
		});
	});

	describe("github_pr tool", () => {
		it("has correct actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("tff-github_pr");
			expect(tool?.name).toBe("tff-github_pr");
			for (const action of [
				"create",
				"list",
				"view",
				"diff",
				"merge",
				"review",
				"close",
				"checkout",
			]) {
				expect(tool?.parameters.properties.action.enum).toContain(action);
			}
		});

		it("contains checks in action enum", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("tff-github_pr");
			expect(tool?.parameters.properties.action.enum).toContain("checks");
		});

		it("routes checks action and forwards number to gh pr checks", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
				return { code: 0, stdout: "✓ all checks passed", stderr: "" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_pr");
			if (!tool) throw new Error("github_pr tool not registered");
			await tool.execute(
				"call-pr-checks",
				{ action: "checks", repo: "owner/repo", number: 42 },
				undefined,
				undefined,
				{},
			);

			const checksCall = mockExec.mock.calls.find(
				([, args]) => Array.isArray(args) && args[0] === "pr" && args[1] === "checks",
			);
			expect(checksCall).toBeDefined();
			const args = checksCall?.[1] as string[];
			expect(args).toContain("42");
			expect(args).not.toContain("--watch");
			expect(args).not.toContain("--required");
		});

		it("throws when checks called without number", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
				return { code: 0, stdout: "", stderr: "" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_pr");
			if (!tool) throw new Error("github_pr tool not registered");
			await expect(
				tool.execute(
					"call-pr-checks",
					{ action: "checks", repo: "owner/repo" },
					undefined,
					undefined,
					{},
				),
			).rejects.toThrow("number is required for checks");
		});
	});

	describe("github_workflow tool", () => {
		it("has correct actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("tff-github_workflow");
			expect(tool?.name).toBe("tff-github_workflow");
			for (const action of ["list", "view", "run", "logs", "disable", "enable"]) {
				expect(tool?.parameters.properties.action.enum).toContain(action);
			}
		});
	});

	describe("session_start handler", () => {
		async function runSessionStart(): Promise<ReturnType<typeof vi.fn>> {
			ghExtension(mockPi);
			const handler = eventHandlers.get("session_start") as SessionStartHandler;
			const notify = vi.fn();
			await handler({}, { hasUI: true, ui: { notify } });
			return notify;
		}

		it("notifies info when gh is installed and authenticated", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") {
					return { code: 0, stdout: "gh version 2.0.0", stderr: "" };
				}
				if (args[0] === "auth" && args[1] === "status") {
					return { code: 0, stdout: "Logged in", stderr: "" };
				}
				return { code: 1, stdout: "", stderr: "" };
			});

			const notify = await runSessionStart();
			expect(notify).toHaveBeenCalledWith(expect.stringContaining("GitHub CLI ready"), "info");
		});

		it("notifies warning when gh is missing", async () => {
			mockExec.mockImplementation(async () => {
				throw new Error("ENOENT");
			});

			const notify = await runSessionStart();
			expect(notify).toHaveBeenCalledWith(expect.stringContaining("GitHub CLI"), "warning");
		});

		it("notifies warning when gh is installed but unauthenticated", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") {
					return { code: 0, stdout: "gh version 2.0.0", stderr: "" };
				}
				if (args[0] === "auth") {
					return { code: 1, stdout: "", stderr: "You are not logged into" };
				}
				return { code: 1, stdout: "", stderr: "" };
			});

			const notify = await runSessionStart();
			expect(notify).toHaveBeenCalledWith(expect.stringContaining("not authenticated"), "warning");
		});

		it("is silent when hasUI is false", async () => {
			mockExec.mockImplementation(async () => ({
				code: 0,
				stdout: "",
				stderr: "",
			}));

			ghExtension(mockPi);
			const handler = eventHandlers.get("session_start") as SessionStartHandler;
			const notify = vi.fn();
			await handler({}, { hasUI: false, ui: { notify } });
			expect(notify).not.toHaveBeenCalled();
		});
	});

	describe("tool execution gating", () => {
		it("throws GHNotFoundError from a tool when gh is missing", async () => {
			mockExec.mockImplementation(async () => {
				throw new Error("ENOENT");
			});

			ghExtension(mockPi);
			// Session start sets detectionStatus = "missing".
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_repo");
			if (!tool) throw new Error("github_repo tool not registered");

			await expect(
				tool.execute("call-1", { action: "list" }, undefined, undefined, {}),
			).rejects.toThrow(/gh CLI not found/);
		});

		it("propagates signal into pi.exec", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
				// gh repo list call
				return { code: 0, stdout: "[]", stderr: "" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_repo");
			if (!tool) throw new Error("github_repo tool not registered");
			const controller = new AbortController();
			await tool.execute("call-2", { action: "list" }, controller.signal, undefined, {});

			// Find the gh repo list call and assert it carried the signal.
			const repoListCall = mockExec.mock.calls.find(
				([, args]) => Array.isArray(args) && args[0] === "repo" && args[1] === "list",
			);
			expect(repoListCall).toBeDefined();
			expect(repoListCall?.[2]?.signal).toBe(controller.signal);
		});

		it("rejects pr review 'request-changes' without a body", async () => {
			mockExec.mockImplementation(async () => ({ code: 0, stdout: "", stderr: "" }));

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_pr");
			if (!tool) throw new Error("github_pr tool not registered");
			await expect(
				tool.execute(
					"call-3",
					{
						action: "review",
						repo: "owner/repo",
						number: 1,
						review_action: "request-changes",
					},
					undefined,
					undefined,
					{},
				),
			).rejects.toThrow(/requires a non-empty body/);
		});

		it("truncates very large tool output", async () => {
			const giant = "x".repeat(100 * 1024); // 100KB > 50KB default
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
				return { code: 0, stdout: giant, stderr: "" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_pr");
			if (!tool) throw new Error("github_pr tool not registered");
			const result = await tool.execute(
				"call-4",
				{ action: "diff", repo: "owner/repo", number: 1 },
				undefined,
				undefined,
				{},
			);

			expect(result.content[0].text.length).toBeLessThan(giant.length);
			expect(result.content[0].text).toContain("truncated");
		});

		it("treats `gh --version` exit code != 0 as missing (not throwing)", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") {
					return { code: 127, stdout: "", stderr: "command not found" };
				}
				return { code: 0, stdout: "", stderr: "" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_repo");
			if (!tool) throw new Error("github_repo tool not registered");

			await expect(
				tool.execute("call-a", { action: "list" }, undefined, undefined, {}),
			).rejects.toThrow(/gh CLI not found/);

			// And auth should never have been probed because version failed first
			const authCalled = mockExec.mock.calls.some(
				([, args]) => Array.isArray(args) && args[0] === "auth",
			);
			expect(authCalled).toBe(false);
		});

		it("renders cancelled (exit 2) as a cancellation message, not Success", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
				return { code: 2, stdout: "", stderr: "operation cancelled by user" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_repo");
			if (!tool) throw new Error("github_repo tool not registered");
			const result = await tool.execute("call-b", { action: "list" }, undefined, undefined, {});

			expect(result.content[0].text).toMatch(/cancelled/);
			expect(result.content[0].text).not.toBe("Success");
			expect(result.details).toMatchObject({ code: 2 });
		});

		it("propagates GHAuthError through tool.execute", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth" && args[1] === "status") {
					return { code: 0, stdout: "Logged in", stderr: "" };
				}
				// gh repo list rejects with auth failure
				return { code: 4, stdout: "", stderr: "authentication required" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_repo");
			if (!tool) throw new Error("github_repo tool not registered");

			await expect(
				tool.execute("call-c", { action: "list" }, undefined, undefined, {}),
			).rejects.toThrow(/authentication required/);
		});

		it("propagates GHRateLimitError through tool.execute", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth" && args[1] === "status") {
					return { code: 0, stdout: "Logged in", stderr: "" };
				}
				return {
					code: 1,
					stdout: "",
					stderr: "API rate limit exceeded for user ID 1",
				};
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_repo");
			if (!tool) throw new Error("github_repo tool not registered");

			await expect(
				tool.execute("call-d", { action: "list" }, undefined, undefined, {}),
			).rejects.toThrow(/rate limit/i);
		});

		it("caches the binary probe across multiple tool calls", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
				return { code: 0, stdout: "[]", stderr: "" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_repo");
			if (!tool) throw new Error("github_repo tool not registered");

			// Two back-to-back calls
			await tool.execute("call-e1", { action: "list" }, undefined, undefined, {});
			await tool.execute("call-e2", { action: "list" }, undefined, undefined, {});

			const versionCalls = mockExec.mock.calls.filter(
				([, args]) => Array.isArray(args) && args[0] === "--version",
			);
			const authCalls = mockExec.mock.calls.filter(
				([, args]) => Array.isArray(args) && args[0] === "auth",
			);
			// Probe ran once (at session_start) and was cached
			expect(versionCalls.length).toBe(1);
			expect(authCalls.length).toBe(1);
		});

		it("re-probes after session_shutdown resets detection", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
				return { code: 0, stdout: "[]", stderr: "" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_repo");
			if (!tool) throw new Error("github_repo tool not registered");
			await tool.execute("call-f1", { action: "list" }, undefined, undefined, {});

			// Trigger shutdown handler
			const shutdown = eventHandlers.get("session_shutdown") as () => void;
			shutdown();

			// Next tool call should re-probe (detectionStatus was reset to "unchecked")
			await tool.execute("call-f2", { action: "list" }, undefined, undefined, {});

			const versionCalls = mockExec.mock.calls.filter(
				([, args]) => Array.isArray(args) && args[0] === "--version",
			);
			expect(versionCalls.length).toBe(2);
		});

		it("forwards github_pr list head/base/author filters to gh", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
				return { code: 0, stdout: "[]", stderr: "" };
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_pr");
			if (!tool) throw new Error("github_pr tool not registered");
			await tool.execute(
				"call-pr-list",
				{
					action: "list",
					repo: "owner/repo",
					head: "feature",
					base: "main",
					author: "octocat",
					limit: 5,
				},
				undefined,
				undefined,
				{},
			);

			const listCall = mockExec.mock.calls.find(
				([, args]) => Array.isArray(args) && args[0] === "pr" && args[1] === "list",
			);
			expect(listCall).toBeDefined();
			const args = listCall?.[1] as string[];
			expect(args).toContain("--head");
			expect(args).toContain("feature");
			expect(args).toContain("--base");
			expect(args).toContain("main");
			expect(args).toContain("--author");
			expect(args).toContain("octocat");
		});

		it("forwards github_issue create assignees/milestone/projects to gh", async () => {
			mockExec.mockImplementation(async (_cmd, args) => {
				if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
				if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
				return {
					code: 0,
					stdout: "https://github.com/owner/repo/issues/1",
					stderr: "",
				};
			});

			ghExtension(mockPi);
			const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
			await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

			const tool = registeredTools.get("tff-github_issue");
			if (!tool) throw new Error("github_issue tool not registered");
			await tool.execute(
				"call-issue-create",
				{
					action: "create",
					repo: "owner/repo",
					title: "Bug",
					assignees: ["alice", "bob"],
					milestone: "v1.0",
					projects: ["roadmap"],
				},
				undefined,
				undefined,
				{},
			);

			const createCall = mockExec.mock.calls.find(
				([, args]) => Array.isArray(args) && args[0] === "issue" && args[1] === "create",
			);
			expect(createCall).toBeDefined();
			const args = createCall?.[1] as string[];
			expect(args).toContain("--assignee");
			expect(args).toContain("alice,bob");
			expect(args).toContain("--milestone");
			expect(args).toContain("v1.0");
			expect(args).toContain("--project");
			expect(args).toContain("roadmap");
		});

		it("honors GH_CLI_PATH for both probe and tool calls", async () => {
			const original = process.env.GH_CLI_PATH;
			process.env.GH_CLI_PATH = "/opt/homebrew/bin/gh";
			try {
				mockExec.mockImplementation(async (_cmd, args) => {
					if (args[0] === "--version") return { code: 0, stdout: "", stderr: "" };
					if (args[0] === "auth") return { code: 0, stdout: "", stderr: "" };
					return { code: 0, stdout: "[]", stderr: "" };
				});

				ghExtension(mockPi);
				const sessionStart = eventHandlers.get("session_start") as SessionStartHandler;
				await sessionStart({}, { hasUI: false, ui: { notify: vi.fn() } });

				const tool = registeredTools.get("tff-github_repo");
				if (!tool) throw new Error("github_repo tool not registered");
				await tool.execute("call-g", { action: "list" }, undefined, undefined, {});

				// Every pi.exec call should have used the custom binary path
				for (const call of mockExec.mock.calls) {
					expect(call[0]).toBe("/opt/homebrew/bin/gh");
				}
			} finally {
				if (original === undefined) {
					// Avoid `delete` (biome perf/noDelete); Reflect is the functional form.
					Reflect.deleteProperty(process.env, "GH_CLI_PATH");
				} else {
					process.env.GH_CLI_PATH = original;
				}
			}
		});
	});
});
