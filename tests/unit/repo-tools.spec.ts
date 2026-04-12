import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GHClient } from "../../src/gh-client.js";
import { createRepoTools } from "../../src/repo-tools.js";

describe("repo-tools", () => {
	let mockClient: GHClient;
	let mockExec: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockExec = vi.fn();
		mockClient = { exec: mockExec } as unknown as GHClient;
	});

	describe("create", () => {
		it("builds create command with all options and no --json", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "https://github.com/user/my-repo",
				stderr: "",
			});

			await tools.create({
				name: "my-repo",
				visibility: "private",
				description: "My cool repo",
				auto_init: true,
				template: "owner/template-repo",
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"repo",
					"create",
					"my-repo",
					"--private",
					"--description",
					"My cool repo",
					"--add-readme",
					"--template",
					"owner/template-repo",
				],
				undefined,
			);
		});

		it("builds create command with minimal options", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "https://github.com/user/simple-repo",
				stderr: "",
			});

			await tools.create({ name: "simple-repo" });

			expect(mockExec).toHaveBeenCalledWith(["repo", "create", "simple-repo"], undefined);
		});

		it("propagates signal option", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			const controller = new AbortController();
			await tools.create({ name: "sig-repo" }, { signal: controller.signal });

			expect(mockExec).toHaveBeenCalledWith(["repo", "create", "sig-repo"], {
				signal: controller.signal,
			});
		});
	});

	describe("list", () => {
		it("lists repos with limit", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", stderr: "", data: [] });

			await tools.list({ limit: 10 });

			expect(mockExec).toHaveBeenCalledWith(
				["repo", "list", "--limit", "10", "--json", "name,description,visibility,updatedAt,owner"],
				undefined,
			);
		});

		it("lists repos for specific owner", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", stderr: "", data: [] });

			await tools.list({ owner: "octocat", limit: 5 });

			expect(mockExec).toHaveBeenCalledWith(
				[
					"repo",
					"list",
					"octocat",
					"--limit",
					"5",
					"--json",
					"name,description,visibility,updatedAt,owner",
				],
				undefined,
			);
		});

		it("filters by visibility", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", stderr: "", data: [] });

			await tools.list({ visibility: "public" });

			expect(mockExec).toHaveBeenCalledWith(
				[
					"repo",
					"list",
					"--visibility",
					"public",
					"--json",
					"name,description,visibility,updatedAt,owner",
				],
				undefined,
			);
		});
	});

	describe("clone", () => {
		it("builds clone command with directory", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.clone({
				owner: "octocat",
				name: "hello-world",
				directory: "my-clone",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["repo", "clone", "octocat/hello-world", "my-clone"],
				undefined,
			);
		});

		it("clones without directory", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.clone({ owner: "octocat", name: "hello-world" });

			expect(mockExec).toHaveBeenCalledWith(["repo", "clone", "octocat/hello-world"], undefined);
		});

		it("passes --branch through the git-flags separator", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.clone({
				owner: "octocat",
				name: "hello-world",
				branch: "develop",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["repo", "clone", "octocat/hello-world", "--", "--branch", "develop"],
				undefined,
			);
		});

		it("combines directory and branch correctly", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.clone({
				owner: "octocat",
				name: "hello-world",
				directory: "my-clone",
				branch: "develop",
			});

			// Directory comes before the -- separator; branch comes after as a git flag.
			expect(mockExec).toHaveBeenCalledWith(
				["repo", "clone", "octocat/hello-world", "my-clone", "--", "--branch", "develop"],
				undefined,
			);
		});
	});

	describe("fork", () => {
		it("forks a repo without --json", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.fork({
				owner: "octocat",
				name: "hello-world",
				default_branch_only: true,
			});

			expect(mockExec).toHaveBeenCalledWith(
				["repo", "fork", "octocat/hello-world", "--default-branch-only"],
				undefined,
			);
		});

		it("forks with clone option", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.fork({ owner: "octocat", name: "hello-world", clone: true });

			expect(mockExec).toHaveBeenCalledWith(
				["repo", "fork", "octocat/hello-world", "--clone"],
				undefined,
			);
		});
	});

	describe("view", () => {
		it("views repo details", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "{}", stderr: "", data: {} });

			await tools.view({ owner: "octocat", name: "hello-world" });

			expect(mockExec).toHaveBeenCalledWith(
				[
					"repo",
					"view",
					"octocat/hello-world",
					"--json",
					"name,description,visibility,updatedAt,createdAt,stargazerCount,forkCount,owner,defaultBranchRef",
				],
				undefined,
			);
		});
	});

	describe("delete", () => {
		it("deletes a repo with yes flag", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.delete({ owner: "user", name: "old-repo", confirm: true });

			expect(mockExec).toHaveBeenCalledWith(
				["repo", "delete", "user/old-repo", "--yes"],
				undefined,
			);
		});

		it("throws error without confirmation", async () => {
			const tools = createRepoTools(mockClient);

			await expect(
				tools.delete({ owner: "user", name: "old-repo", confirm: false }),
			).rejects.toThrow("confirm: true");
		});
	});

	describe("sync", () => {
		it("syncs repo", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.sync();

			expect(mockExec).toHaveBeenCalledWith(["repo", "sync"], undefined);
		});

		it("syncs specific branch", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.sync({ branch: "main" });

			expect(mockExec).toHaveBeenCalledWith(["repo", "sync", "--branch", "main"], undefined);
		});
	});
});
