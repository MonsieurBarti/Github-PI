import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GHClient } from "../../src/gh-client";
import { createPRTools } from "../../src/pr-tools";

describe("pr-tools", () => {
	let mockClient: GHClient;
	let mockExec: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockExec = vi.fn();
		mockClient = { exec: mockExec } as unknown as GHClient;
	});

	describe("create", () => {
		it("creates PR from head to base without --json", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "https://github.com/owner/repo/pull/5",
				stderr: "",
			});

			await tools.create({
				repo: "owner/repo",
				title: "Add feature",
				body: "This PR adds...",
				head: "feature-branch",
				base: "main",
				draft: false,
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"pr",
					"create",
					"--repo",
					"owner/repo",
					"--title",
					"Add feature",
					"--head",
					"feature-branch",
					"--base",
					"main",
					"--body",
					"This PR adds...",
				],
				undefined,
			);
		});

		it("creates draft PR", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.create({
				repo: "owner/repo",
				title: "WIP: Feature",
				head: "feature-branch",
				base: "main",
				draft: true,
			});

			expect(mockExec).toHaveBeenCalledWith(expect.arrayContaining(["--draft"]), undefined);
		});
	});

	describe("list", () => {
		it("lists open PRs", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", stderr: "", data: [] });

			await tools.list({ repo: "owner/repo", state: "open", limit: 20 });

			expect(mockExec).toHaveBeenCalledWith(
				[
					"pr",
					"list",
					"--repo",
					"owner/repo",
					"--state",
					"open",
					"--limit",
					"20",
					"--json",
					"number,title,state,author,headRefName,baseRefName,updatedAt,createdAt,url",
				],
				undefined,
			);
		});

		it("clamps an excessive limit to 200", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", stderr: "", data: [] });

			await tools.list({ repo: "owner/repo", limit: 5000 });

			expect(mockExec).toHaveBeenCalledWith(expect.arrayContaining(["--limit", "200"]), undefined);
		});

		it("lists PRs with search query", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", stderr: "", data: [] });

			await tools.list({
				repo: "owner/repo",
				search: "auth in:title",
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"pr",
					"list",
					"--repo",
					"owner/repo",
					"--search",
					"auth in:title",
					"--json",
					"number,title,state,author,headRefName,baseRefName,updatedAt,createdAt,url",
				],
				undefined,
			);
		});

		it("filters by head and base", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", stderr: "", data: [] });

			await tools.list({
				repo: "owner/repo",
				head: "feature",
				base: "develop",
				author: "octocat",
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"pr",
					"list",
					"--repo",
					"owner/repo",
					"--head",
					"feature",
					"--base",
					"develop",
					"--author",
					"octocat",
					"--json",
					"number,title,state,author,headRefName,baseRefName,updatedAt,createdAt,url",
				],
				undefined,
			);
		});
	});

	describe("view", () => {
		it("views PR by number with merge and check status fields", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "{}", stderr: "", data: {} });

			await tools.view({ repo: "owner/repo", number: 5 });

			expect(mockExec).toHaveBeenCalledWith(
				[
					"pr",
					"view",
					"5",
					"--repo",
					"owner/repo",
					"--json",
					"number,title,body,state,author,headRefName,baseRefName,additions,deletions,files,mergedAt,mergedBy,mergeable,statusCheckRollup",
				],
				undefined,
			);
		});
	});

	describe("diff", () => {
		it("shows PR diff", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "diff content", stderr: "" });

			const result = await tools.diff({ repo: "owner/repo", number: 5 });

			expect(mockExec).toHaveBeenCalledWith(["pr", "diff", "5", "--repo", "owner/repo"], undefined);
			expect(result.stdout).toBe("diff content");
		});
	});

	describe("merge", () => {
		it("merges PR with squash", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.merge({
				repo: "owner/repo",
				number: 5,
				method: "squash",
				delete_branch: true,
			});

			expect(mockExec).toHaveBeenCalledWith(
				["pr", "merge", "5", "--repo", "owner/repo", "--squash", "--delete-branch"],
				undefined,
			);
		});

		it("auto merges with rebase", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.merge({
				repo: "owner/repo",
				number: 5,
				method: "rebase",
				auto: true,
			});

			expect(mockExec).toHaveBeenCalledWith(
				["pr", "merge", "5", "--repo", "owner/repo", "--rebase", "--auto"],
				undefined,
			);
		});
	});

	describe("review", () => {
		it("approves PR", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.review({
				repo: "owner/repo",
				number: 5,
				action: "approve",
				body: "LGTM!",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["pr", "review", "5", "--repo", "owner/repo", "--approve", "--body", "LGTM!"],
				undefined,
			);
		});

		it("approves without a body", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.review({ repo: "owner/repo", number: 5, action: "approve" });

			expect(mockExec).toHaveBeenCalledWith(
				["pr", "review", "5", "--repo", "owner/repo", "--approve"],
				undefined,
			);
		});

		it("requests changes", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.review({
				repo: "owner/repo",
				number: 5,
				action: "request-changes",
				body: "Needs fixes",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["pr", "review", "5", "--repo", "owner/repo", "--request-changes", "--body", "Needs fixes"],
				undefined,
			);
		});

		it("throws when request-changes is called without a body", async () => {
			const tools = createPRTools(mockClient);

			await expect(
				tools.review({
					repo: "owner/repo",
					number: 5,
					action: "request-changes",
				}),
			).rejects.toThrow(/requires a non-empty body/);

			expect(mockExec).not.toHaveBeenCalled();
		});

		it("throws when comment is called without a body", async () => {
			const tools = createPRTools(mockClient);

			await expect(
				tools.review({
					repo: "owner/repo",
					number: 5,
					action: "comment",
				}),
			).rejects.toThrow(/requires a non-empty body/);

			expect(mockExec).not.toHaveBeenCalled();
		});

		it("comments with body", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.review({
				repo: "owner/repo",
				number: 5,
				action: "comment",
				body: "Just a comment",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["pr", "review", "5", "--repo", "owner/repo", "--comment", "--body", "Just a comment"],
				undefined,
			);
		});
	});

	describe("close", () => {
		it("closes PR", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.close({
				repo: "owner/repo",
				number: 5,
				comment: "Closing as duplicate",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["pr", "close", "5", "--repo", "owner/repo", "--comment", "Closing as duplicate"],
				undefined,
			);
		});
	});

	describe("checkout", () => {
		it("checks out PR branch", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.checkout({ repo: "owner/repo", number: 5 });

			expect(mockExec).toHaveBeenCalledWith(
				["pr", "checkout", "5", "--repo", "owner/repo"],
				undefined,
			);
		});

		it("checks out to specific branch name", async () => {
			const tools = createPRTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.checkout({
				repo: "owner/repo",
				number: 5,
				branch: "pr-review",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["pr", "checkout", "5", "--repo", "owner/repo", "--branch", "pr-review"],
				undefined,
			);
		});
	});
});
