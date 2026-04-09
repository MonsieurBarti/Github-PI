import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GHClient } from "../../src/gh-client";
import { createRepoTools } from "../../src/repo-tools";

describe("repo-tools", () => {
	let mockClient: GHClient;
	let mockExec: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockExec = vi.fn();
		mockClient = {
			exec: mockExec,
		} as unknown as GHClient;
	});

	describe("create", () => {
		it("builds create command with all options", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({
				code: 0,
				stdout: '{"name": "my-repo", "url": "https://github.com/user/my-repo"}',
				stderr: "",
				data: { name: "my-repo", url: "https://github.com/user/my-repo" },
			});

			const result = await tools.create({
				name: "my-repo",
				visibility: "private",
				description: "My cool repo",
				auto_init: true,
				template: "owner/template-repo",
			});

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"create",
				"my-repo",
				"--private",
				"--description",
				"My cool repo",
				"--add-readme",
				"--template",
				"owner/template-repo",
				"--json",
				"name,url,owner,description,visibility",
			]);
			expect(result.data).toEqual({ name: "my-repo", url: "https://github.com/user/my-repo" });
		});

		it("builds create command with minimal options", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "{}",
				data: {},
			});

			await tools.create({
				name: "simple-repo",
			});

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"create",
				"simple-repo",
				"--json",
				"name,url,owner,description,visibility",
			]);
		});

		it("supports disabling issues and wiki", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "{}",
				data: {},
			});

			await tools.create({
				name: "minimal-repo",
				enable_issues: false,
				enable_wiki: false,
			});

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"create",
				"minimal-repo",
				"--disable-issues",
				"--disable-wiki",
				"--json",
				"name,url,owner,description,visibility",
			]);
		});
	});

	describe("list", () => {
		it("lists repos with limit", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "[]",
				data: [],
			});

			await tools.list({ limit: 10 });

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"list",
				"--limit",
				"10",
				"--json",
				"name,description,visibility,updatedAt,owner",
			]);
		});

		it("lists repos for specific owner", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", data: [] });

			await tools.list({ owner: "octocat", limit: 5 });

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"list",
				"octocat",
				"--limit",
				"5",
				"--json",
				"name,description,visibility,updatedAt,owner",
			]);
		});

		it("filters by visibility", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", data: [] });

			await tools.list({ visibility: "public" });

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"list",
				"--visibility",
				"public",
				"--json",
				"name,description,visibility,updatedAt,owner",
			]);
		});
	});

	describe("clone", () => {
		it("builds clone command", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.clone({
				owner: "octocat",
				name: "hello-world",
				directory: "my-clone",
			});

			expect(mockExec).toHaveBeenCalledWith(["repo", "clone", "octocat/hello-world", "my-clone"]);
		});

		it("clones without directory", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.clone({
				owner: "octocat",
				name: "hello-world",
			});

			expect(mockExec).toHaveBeenCalledWith(["repo", "clone", "octocat/hello-world"]);
		});

		it("clones specific branch", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.clone({
				owner: "octocat",
				name: "hello-world",
				branch: "develop",
			});

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"clone",
				"octocat/hello-world",
				"--branch",
				"develop",
			]);
		});
	});

	describe("fork", () => {
		it("forks a repo", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({
				code: 0,
				stdout: '{"name": "hello-world"}',
				data: { name: "hello-world" },
			});

			await tools.fork({
				owner: "octocat",
				name: "hello-world",
				default_branch_only: true,
			});

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"fork",
				"octocat/hello-world",
				"--default-branch-only",
				"--json",
				"name,url,owner,parent",
			]);
		});

		it("forks with clone option", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "{}", data: {} });

			await tools.fork({
				owner: "octocat",
				name: "hello-world",
				clone: true,
			});

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"fork",
				"octocat/hello-world",
				"--clone",
				"--json",
				"name,url,owner,parent",
			]);
		});
	});

	describe("view", () => {
		it("views repo details", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "{}",
				data: {},
			});

			await tools.view({ owner: "octocat", name: "hello-world" });

			expect(mockExec).toHaveBeenCalledWith([
				"repo",
				"view",
				"octocat/hello-world",
				"--json",
				"name,description,visibility,updatedAt,createdAt,stargazerCount,forkCount,owner,defaultBranchRef",
			]);
		});
	});

	describe("delete", () => {
		it("deletes a repo with yes flag", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.delete({ owner: "user", name: "old-repo", confirm: true });

			expect(mockExec).toHaveBeenCalledWith(["repo", "delete", "user/old-repo", "--yes"]);
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

			expect(mockExec).toHaveBeenCalledWith(["repo", "sync"]);
		});

		it("syncs specific branch", async () => {
			const tools = createRepoTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.sync({ branch: "main" });

			expect(mockExec).toHaveBeenCalledWith(["repo", "sync", "--branch", "main"]);
		});
	});
});
