import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ghExtension from "../../src/index";

// Type definitions for tool structure
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
}

type SessionStartHandler = (
	_event: unknown,
	ctx: { hasUI: boolean; ui: { notify: unknown } },
) => Promise<void>;

describe("gh-extension", () => {
	let mockPi: ExtensionAPI;
	let registeredTools: Map<string, unknown>;
	let registeredCommands: Map<string, unknown>;
	let eventHandlers: Map<string, unknown>;
	let mockExec: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		registeredTools = new Map();
		registeredCommands = new Map();
		eventHandlers = new Map();
		mockExec = vi.fn();

		mockPi = {
			registerTool: vi.fn((tool) => {
				registeredTools.set(tool.name, tool);
			}),
			registerCommand: vi.fn((name, config) => {
				registeredCommands.set(name, config);
			}),
			on: vi.fn((event, handler) => {
				eventHandlers.set(event, handler);
			}),
			exec: mockExec,
		} as unknown as ExtensionAPI;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("registers github_repo tool", () => {
		ghExtension(mockPi);
		expect(registeredTools.has("github_repo")).toBe(true);
	});

	it("registers github_issue tool", () => {
		ghExtension(mockPi);
		expect(registeredTools.has("github_issue")).toBe(true);
	});

	it("registers github_pr tool", () => {
		ghExtension(mockPi);
		expect(registeredTools.has("github_pr")).toBe(true);
	});

	it("registers github_workflow tool", () => {
		ghExtension(mockPi);
		expect(registeredTools.has("github_workflow")).toBe(true);
	});

	it("registers session_start event handler", () => {
		ghExtension(mockPi);
		expect(eventHandlers.has("session_start")).toBe(true);
	});

	it("registers session_shutdown event handler", () => {
		ghExtension(mockPi);
		expect(eventHandlers.has("session_shutdown")).toBe(true);
	});

	describe("github_repo tool", () => {
		it("has correct structure", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_repo") as Tool | undefined;
			expect(tool).toBeDefined();

			expect(tool?.name).toBe("github_repo");
			expect(tool?.label).toBe("GitHub Repository");
			expect(tool?.parameters.properties.action.enum).toContain("create");
			expect(tool?.parameters.properties.action.enum).toContain("list");
			expect(tool?.parameters.properties.action.enum).toContain("clone");
			expect(tool?.parameters.properties.action.enum).toContain("fork");
			expect(tool?.parameters.properties.action.enum).toContain("view");
			expect(tool?.parameters.properties.action.enum).toContain("delete");
			expect(tool?.parameters.properties.action.enum).toContain("sync");
		});

		it("has prompt guidelines", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_repo") as Tool | undefined;
			expect(tool).toBeDefined();
			expect(tool?.promptGuidelines).toBeDefined();
			expect(tool?.promptGuidelines?.length).toBeGreaterThan(0);
		});
	});

	describe("github_issue tool", () => {
		it("has correct actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_issue") as Tool | undefined;
			expect(tool).toBeDefined();

			expect(tool?.name).toBe("github_issue");
			expect(tool?.parameters.properties.action.enum).toContain("create");
			expect(tool?.parameters.properties.action.enum).toContain("list");
			expect(tool?.parameters.properties.action.enum).toContain("view");
			expect(tool?.parameters.properties.action.enum).toContain("close");
			expect(tool?.parameters.properties.action.enum).toContain("reopen");
			expect(tool?.parameters.properties.action.enum).toContain("comment");
			expect(tool?.parameters.properties.action.enum).toContain("edit");
		});
	});

	describe("github_pr tool", () => {
		it("has correct actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_pr") as Tool | undefined;
			expect(tool).toBeDefined();

			expect(tool?.name).toBe("github_pr");
			expect(tool?.parameters.properties.action.enum).toContain("create");
			expect(tool?.parameters.properties.action.enum).toContain("list");
			expect(tool?.parameters.properties.action.enum).toContain("view");
			expect(tool?.parameters.properties.action.enum).toContain("diff");
			expect(tool?.parameters.properties.action.enum).toContain("merge");
			expect(tool?.parameters.properties.action.enum).toContain("review");
			expect(tool?.parameters.properties.action.enum).toContain("close");
			expect(tool?.parameters.properties.action.enum).toContain("checkout");
		});
	});

	describe("github_workflow tool", () => {
		it("has correct actions", () => {
			ghExtension(mockPi);
			const tool = registeredTools.get("github_workflow") as Tool | undefined;
			expect(tool).toBeDefined();

			expect(tool?.name).toBe("github_workflow");
			expect(tool?.parameters.properties.action.enum).toContain("list");
			expect(tool?.parameters.properties.action.enum).toContain("view");
			expect(tool?.parameters.properties.action.enum).toContain("run");
			expect(tool?.parameters.properties.action.enum).toContain("logs");
			expect(tool?.parameters.properties.action.enum).toContain("disable");
			expect(tool?.parameters.properties.action.enum).toContain("enable");
		});
	});

	describe("session_start handler", () => {
		it("detects binary and notifies on success", async () => {
			ghExtension(mockPi);
			const handler = eventHandlers.get("session_start") as SessionStartHandler | undefined;
			expect(handler).toBeDefined();

			// Mock successful binary detection
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "/usr/bin/gh",
				stderr: "",
			});

			const mockNotify = vi.fn();
			const mockCtx = {
				hasUI: true,
				ui: { notify: mockNotify },
			};

			await handler?.({}, mockCtx);

			// Should notify that CLI is ready (or show install if gh not found)
			expect(mockNotify).toHaveBeenCalled();
			const call = mockNotify.mock.calls[0];
			expect(["info", "warning", "error"]).toContain(call[1]);
		});
	});
});
