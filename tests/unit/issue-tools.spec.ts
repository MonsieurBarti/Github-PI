import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GHClient } from "../../src/gh-client";
import { createIssueTools } from "../../src/issue-tools";

describe("issue-tools", () => {
	let mockClient: GHClient;
	let mockExec: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockExec = vi.fn();
		mockClient = { exec: mockExec } as unknown as GHClient;
	});

	describe("create", () => {
		it("creates issue with title and body", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: '{"number": 42}', data: { number: 42 } });

			await tools.create({
				repo: "owner/repo",
				title: "Bug report",
				body: "Something is broken",
				labels: ["bug", "urgent"],
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"issue",
					"create",
					"--repo",
					"owner/repo",
					"--title",
					"Bug report",
					"--body",
					"Something is broken",
					"--label",
					"bug,urgent",
				],
				undefined,
			);
		});

		it("creates issue with assignees and milestone", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "{}", data: {} });

			await tools.create({
				repo: "owner/repo",
				title: "Feature request",
				assignees: ["user1", "user2"],
				milestone: "v1.0",
				projects: ["my-project"],
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"issue",
					"create",
					"--repo",
					"owner/repo",
					"--title",
					"Feature request",
					"--assignee",
					"user1,user2",
					"--milestone",
					"v1.0",
					"--project",
					"my-project",
				],
				undefined,
			);
		});
	});

	describe("list", () => {
		it("clamps an excessive limit to 200", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", data: [] });

			await tools.list({ repo: "owner/repo", limit: 5000 });

			expect(mockExec).toHaveBeenCalledWith(expect.arrayContaining(["--limit", "200"]), undefined);
		});

		it("lists open issues", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", data: [] });

			await tools.list({
				repo: "owner/repo",
				state: "open",
				assignee: "@me",
				limit: 30,
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"issue",
					"list",
					"--repo",
					"owner/repo",
					"--state",
					"open",
					"--assignee",
					"@me",
					"--limit",
					"30",
					"--json",
					"number,title,state,author,updatedAt,createdAt,labels",
				],
				undefined,
			);
		});

		it("lists issues with search query", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", data: [] });

			await tools.list({
				repo: "owner/repo",
				search: "login bug in:title",
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"issue",
					"list",
					"--repo",
					"owner/repo",
					"--search",
					"login bug in:title",
					"--json",
					"number,title,state,author,updatedAt,createdAt,labels",
				],
				undefined,
			);
		});

		it("lists with author and label filters", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "[]", data: [] });

			await tools.list({
				repo: "owner/repo",
				author: "octocat",
				labels: ["bug", "help wanted"],
				milestone: "v2.0",
				project: "roadmap",
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"issue",
					"list",
					"--repo",
					"owner/repo",
					"--author",
					"octocat",
					"--label",
					"bug,help wanted",
					"--milestone",
					"v2.0",
					"--project",
					"roadmap",
					"--json",
					"number,title,state,author,updatedAt,createdAt,labels",
				],
				undefined,
			);
		});
	});

	describe("view", () => {
		it("views single issue", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "{}", data: {} });

			await tools.view({
				repo: "owner/repo",
				number: 42,
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"issue",
					"view",
					"42",
					"--repo",
					"owner/repo",
					"--json",
					"number,title,body,state,author,createdAt,updatedAt,comments,labels,assignees",
				],
				undefined,
			);
		});
	});

	describe("close", () => {
		it("closes issue", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.close({
				repo: "owner/repo",
				number: 42,
				comment: "Fixed in v1.2.0",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["issue", "close", "42", "--repo", "owner/repo", "--comment", "Fixed in v1.2.0"],
				undefined,
			);
		});

		it("closes with reason", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.close({
				repo: "owner/repo",
				number: 42,
				reason: "not_planned",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["issue", "close", "42", "--repo", "owner/repo", "--reason", "not_planned"],
				undefined,
			);
		});
	});

	describe("reopen", () => {
		it("reopens issue", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.reopen({
				repo: "owner/repo",
				number: 42,
			});

			expect(mockExec).toHaveBeenCalledWith(
				["issue", "reopen", "42", "--repo", "owner/repo"],
				undefined,
			);
		});
	});

	describe("comment", () => {
		it("adds comment to issue", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.comment({
				repo: "owner/repo",
				number: 42,
				body: "Thanks for reporting!",
			});

			expect(mockExec).toHaveBeenCalledWith(
				["issue", "comment", "42", "--repo", "owner/repo", "--body", "Thanks for reporting!"],
				undefined,
			);
		});
	});

	describe("edit", () => {
		it("edits issue title and body", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.edit({
				repo: "owner/repo",
				number: 42,
				title: "Updated title",
				body: "Updated body",
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"issue",
					"edit",
					"42",
					"--repo",
					"owner/repo",
					"--title",
					"Updated title",
					"--body",
					"Updated body",
				],
				undefined,
			);
		});

		it("edits labels and assignees", async () => {
			const tools = createIssueTools(mockClient);
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

			await tools.edit({
				repo: "owner/repo",
				number: 42,
				add_labels: ["confirmed"],
				remove_labels: ["triage"],
				add_assignees: ["user1"],
				remove_assignees: ["user2"],
			});

			expect(mockExec).toHaveBeenCalledWith(
				[
					"issue",
					"edit",
					"42",
					"--repo",
					"owner/repo",
					"--add-label",
					"confirmed",
					"--remove-label",
					"triage",
					"--add-assignee",
					"user1",
					"--remove-assignee",
					"user2",
				],
				undefined,
			);
		});
	});
});
