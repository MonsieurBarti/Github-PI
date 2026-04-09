import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ghExtension from "../../src/index";

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
		expect(registeredTools.has("github_repo")).toBe(true);
		expect(registeredTools.has("github_issue")).toBe(true);
		expect(registeredTools.has("github_pr")).toBe(true);
		expect(registeredTools.has("github_workflow")).toBe(true);
	});

	it("registers session_start and session_shutdown handlers", () => {
		ghExtension(mockPi);
		expect(eventHandlers.has("session_start")).toBe(true);
		expect(eventHandlers.has("session_shutdown")).toBe(true);
	});

	describe("github_repo tool", () => {
		it("exposes the expected actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_repo");
			expect(tool).toBeDefined();
			expect(tool?.name).toBe("github_repo");
			expect(tool?.label).toBe("GitHub Repository");
			for (const action of ["create", "list", "clone", "fork", "view", "delete", "sync"]) {
				expect(tool?.parameters.properties.action.enum).toContain(action);
			}
		});

		it("has prompt guidelines", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_repo");
			expect(tool?.promptGuidelines?.length).toBeGreaterThan(0);
		});
	});

	describe("github_issue tool", () => {
		it("has correct actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_issue");
			expect(tool?.name).toBe("github_issue");
			for (const action of ["create", "list", "view", "close", "reopen", "comment", "edit"]) {
				expect(tool?.parameters.properties.action.enum).toContain(action);
			}
		});
	});

	describe("github_pr tool", () => {
		it("has correct actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_pr");
			expect(tool?.name).toBe("github_pr");
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
	});

	describe("github_workflow tool", () => {
		it("has correct actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_workflow");
			expect(tool?.name).toBe("github_workflow");
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

			const tool = registeredTools.get("github_repo");
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

			const tool = registeredTools.get("github_repo");
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

			const tool = registeredTools.get("github_pr");
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

			const tool = registeredTools.get("github_pr");
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
	});
});
