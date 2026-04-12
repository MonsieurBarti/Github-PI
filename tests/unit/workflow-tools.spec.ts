import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GHClient } from "../../src/gh-client.js";
import { createWorkflowTools } from "../../src/workflow-tools.js";

describe("workflow-tools", () => {
	let mockClient: GHClient;
	let mockExec: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockExec = vi.fn();
		mockClient = { exec: mockExec } as unknown as GHClient;
	});

	describe("list", () => {
		it("lists all workflows with valid json fields only", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", stderr: "", data: [] });

			await tools.list({ repo: "owner/repo" });

			expect(mockExec).toHaveBeenCalledWith(
				["workflow", "list", "--repo", "owner/repo", "--json", "id,name,path"],
				undefined,
			);
		});

		it("limits results", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", stderr: "", data: [] });

			await tools.list({ repo: "owner/repo", limit: 10 });

			expect(mockExec).toHaveBeenCalledWith(
				["workflow", "list", "--repo", "owner/repo", "--limit", "10", "--json", "id,name,path"],
				undefined,
			);
		});
	});

	describe("view", () => {
		it("views workflow by name", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "yaml content", stderr: "" });

			const result = await tools.view({ repo: "owner/repo", workflow: "ci.yml" });

			expect(mockExec).toHaveBeenCalledWith(
				["workflow", "view", "ci.yml", "--repo", "owner/repo", "--yaml"],
				undefined,
			);
			expect(result.stdout).toBe("yaml content");
		});

		it("views workflow by ID", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "{}", stderr: "" });

			await tools.view({ repo: "owner/repo", workflow: "123456" });

			expect(mockExec).toHaveBeenCalledWith(
				["workflow", "view", "123456", "--repo", "owner/repo", "--yaml"],
				undefined,
			);
		});
	});

	describe("run", () => {
		it("triggers workflow_dispatch with branch and inputs", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.run({
				repo: "owner/repo",
				workflow: "deploy.yml",
				branch: "main",
				inputs: { environment: "production", version: "1.2.0" },
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"workflow",
					"run",
					"deploy.yml",
					"--repo",
					"owner/repo",
					"--ref",
					"main",
					"--field",
					"environment=production",
					"--field",
					"version=1.2.0",
				],
				undefined,
			);
		});

		it("runs without inputs", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.run({ repo: "owner/repo", workflow: "ci.yml" });

			expect(mockExec).toHaveBeenCalledWith(
				["workflow", "run", "ci.yml", "--repo", "owner/repo"],
				undefined,
			);
		});
	});

	describe("logs", () => {
		it("shows workflow run logs using --log flag", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "log output", stderr: "" });

			const result = await tools.logs({ repo: "owner/repo", run_id: "12345" });

			expect(mockExec).toHaveBeenCalledWith(
				["run", "view", "12345", "--repo", "owner/repo", "--log"],
				undefined,
			);
			expect(result.stdout).toBe("log output");
		});

		it("shows specific job logs", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.logs({ repo: "owner/repo", run_id: "12345", job: "test" });

			expect(mockExec).toHaveBeenCalledWith(
				["run", "view", "12345", "--repo", "owner/repo", "--log", "--job", "test"],
				undefined,
			);
		});
	});

	describe("disable", () => {
		it("disables workflow", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.disable({ repo: "owner/repo", workflow: "ci.yml" });

			expect(mockExec).toHaveBeenCalledWith(
				["workflow", "disable", "ci.yml", "--repo", "owner/repo"],
				undefined,
			);
		});
	});

	describe("enable", () => {
		it("enables workflow", async () => {
			const tools = createWorkflowTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.enable({ repo: "owner/repo", workflow: "ci.yml" });

			expect(mockExec).toHaveBeenCalledWith(
				["workflow", "enable", "ci.yml", "--repo", "owner/repo"],
				undefined,
			);
		});
	});
});
