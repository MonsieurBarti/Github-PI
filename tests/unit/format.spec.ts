import { describe, expect, it } from "vitest";
import {
	formatIssueList,
	formatIssueView,
	formatPRList,
	formatPRReviewComments,
	formatPRView,
	formatRepoList,
	formatRepoView,
	formatWorkflowList,
} from "../../src/format.js";

describe("format", () => {
	describe("formatPRList", () => {
		it("formats a list of PRs as compact lines", () => {
			const data = [
				{
					number: 42,
					title: "Fix auth middleware",
					state: "MERGED",
					author: { login: "monsieurbarti" },
					headRefName: "feat/auth",
					baseRefName: "main",
					updatedAt: "2025-04-10T12:00:00Z",
				},
				{
					number: 41,
					title: "Add rate limiting",
					state: "OPEN",
					author: { login: "octocat" },
					headRefName: "feat/rate",
					baseRefName: "main",
					updatedAt: "2025-04-09T08:30:00Z",
				},
			];

			const result = formatPRList(data);

			expect(result).toContain("#42");
			expect(result).toContain("Fix auth middleware");
			expect(result).toContain("MERGED");
			expect(result).toContain("monsieurbarti");
			expect(result).toContain("feat/auth");
			expect(result).toContain("main");
			expect(result).toContain("#41");
			expect(result).toContain("Add rate limiting");
			expect(result).toContain("OPEN");
		});

		it("returns 'No pull requests found.' for empty list", () => {
			expect(formatPRList([])).toBe("No pull requests found.");
		});
	});

	describe("formatPRView", () => {
		it("formats a single PR as a compact summary", () => {
			const data = {
				number: 42,
				title: "Fix auth middleware",
				state: "MERGED",
				author: { login: "monsieurbarti" },
				headRefName: "feat/auth",
				baseRefName: "main",
				additions: 12,
				deletions: 5,
				files: [
					{ path: "src/auth.ts" },
					{ path: "src/middleware.ts" },
					{ path: "tests/auth.spec.ts" },
				],
				mergedAt: "2025-04-10T12:00:00Z",
				mergedBy: { login: "reviewer" },
				mergeable: "MERGEABLE",
				statusCheckRollup: [{ state: "SUCCESS" }],
				body: "This PR fixes the auth middleware to handle edge cases.",
			};

			const result = formatPRView(data);

			expect(result).toContain("PR #42: Fix auth middleware");
			expect(result).toContain("MERGED");
			expect(result).toContain("feat/auth");
			expect(result).toContain("main");
			expect(result).toContain("+12");
			expect(result).toContain("-5");
			expect(result).toContain("3 files");
		});

		it("handles PR with no merge info", () => {
			const data = {
				number: 41,
				title: "Add rate limiting",
				state: "OPEN",
				author: { login: "octocat" },
				headRefName: "feat/rate",
				baseRefName: "main",
				additions: 100,
				deletions: 20,
				files: [{ path: "src/rate.ts" }],
				mergedAt: null,
				mergedBy: null,
				mergeable: "MERGEABLE",
				statusCheckRollup: [],
				body: "Adds rate limiting support.",
			};

			const result = formatPRView(data);

			expect(result).toContain("PR #41: Add rate limiting");
			expect(result).toContain("OPEN");
			expect(result).not.toContain("null");
		});
	});

	describe("formatIssueList", () => {
		it("formats a list of issues as compact lines", () => {
			const data = [
				{
					number: 15,
					title: "Bug: login fails on Safari",
					state: "OPEN",
					author: { login: "user123" },
					labels: [{ name: "bug" }, { name: "frontend" }],
					updatedAt: "2025-04-10T12:00:00Z",
				},
				{
					number: 14,
					title: "Add dark mode support",
					state: "OPEN",
					author: { login: "user456" },
					labels: [{ name: "enhancement" }],
					updatedAt: "2025-04-09T08:30:00Z",
				},
			];

			const result = formatIssueList(data);

			expect(result).toContain("#15");
			expect(result).toContain("Bug: login fails on Safari");
			expect(result).toContain("bug,frontend");
			expect(result).toContain("#14");
		});

		it("returns 'No issues found.' for empty list", () => {
			expect(formatIssueList([])).toBe("No issues found.");
		});
	});

	describe("formatIssueView", () => {
		it("formats a single issue as a compact summary", () => {
			const data = {
				number: 15,
				title: "Bug: login fails on Safari",
				state: "OPEN",
				author: { login: "user123" },
				labels: [{ name: "bug" }, { name: "frontend" }],
				assignees: [{ login: "monsieurbarti" }],
				createdAt: "2025-04-10T12:00:00Z",
				body: "Login fails when using Safari 17.x on macOS.",
				comments: [{ body: "Can reproduce" }, { body: "Looking into it" }],
			};

			const result = formatIssueView(data);

			expect(result).toContain("Issue #15: Bug: login fails on Safari");
			expect(result).toContain("OPEN");
			expect(result).toContain("bug, frontend");
			expect(result).toContain("monsieurbarti");
			expect(result).toContain("2 comments");
		});

		it("handles issue with no labels or assignees", () => {
			const data = {
				number: 10,
				title: "Simple issue",
				state: "CLOSED",
				author: { login: "user" },
				labels: [],
				assignees: [],
				createdAt: "2025-04-01T00:00:00Z",
				body: "",
				comments: [],
			};

			const result = formatIssueView(data);

			expect(result).toContain("Issue #10: Simple issue");
			expect(result).toContain("CLOSED");
		});

		it("does not truncate long issue bodies", () => {
			const longBody = "A".repeat(600);
			const data = {
				number: 16,
				title: "Long body",
				state: "OPEN",
				author: { login: "user123" },
				labels: [],
				assignees: [],
				createdAt: "2025-04-10T12:00:00Z",
				body: longBody,
				comments: [],
			};

			const result = formatIssueView(data);

			expect(result).toContain(longBody);
			expect(result).not.toContain(`${"A".repeat(200)}...`);
		});
	});

	describe("formatRepoList", () => {
		it("formats a list of repos as compact lines", () => {
			const data = [
				{
					name: "GH-PI",
					owner: { login: "MonsieurBarti" },
					visibility: "PUBLIC",
					description: "PI extension for GitHub CLI",
					updatedAt: "2025-04-10T12:00:00Z",
				},
				{
					name: "other-project",
					owner: { login: "MonsieurBarti" },
					visibility: "PRIVATE",
					description: null,
					updatedAt: "2025-03-15T00:00:00Z",
				},
			];

			const result = formatRepoList(data);

			expect(result).toContain("MonsieurBarti/GH-PI");
			expect(result).toContain("PUBLIC");
			expect(result).toContain("MonsieurBarti/other-project");
			expect(result).toContain("PRIVATE");
		});

		it("returns 'No repositories found.' for empty list", () => {
			expect(formatRepoList([])).toBe("No repositories found.");
		});
	});

	describe("formatRepoView", () => {
		it("formats a single repo as a compact summary", () => {
			const data = {
				name: "GH-PI",
				owner: { login: "MonsieurBarti" },
				description: "PI extension for GitHub CLI",
				visibility: "PUBLIC",
				stargazerCount: 3,
				forkCount: 1,
				defaultBranchRef: { name: "main" },
				createdAt: "2025-01-01T00:00:00Z",
				updatedAt: "2025-04-10T12:00:00Z",
			};

			const result = formatRepoView(data);

			expect(result).toContain("MonsieurBarti/GH-PI");
			expect(result).toContain("PUBLIC");
			expect(result).toContain("PI extension for GitHub CLI");
			expect(result).toContain("3");
			expect(result).toContain("main");
		});
	});

	describe("formatWorkflowList", () => {
		it("formats a list of workflows as compact lines", () => {
			const data = [
				{ id: 1001, name: "CI Pipeline", path: ".github/workflows/ci.yml" },
				{ id: 1002, name: "Release", path: ".github/workflows/release.yml" },
			];

			const result = formatWorkflowList(data);

			expect(result).toContain("CI Pipeline");
			expect(result).toContain("ci.yml");
			expect(result).toContain("Release");
			expect(result).toContain("release.yml");
		});

		it("returns 'No workflows found.' for empty list", () => {
			expect(formatWorkflowList([])).toBe("No workflows found.");
		});
	});

	describe("edge cases", () => {
		it("formatPRView reports pending/failing when any check is not passing", () => {
			const data = {
				number: 7,
				title: "WIP",
				state: "OPEN",
				author: { login: "user" },
				headRefName: "wip",
				baseRefName: "main",
				additions: 1,
				deletions: 0,
				files: [],
				mergedAt: null,
				mergeable: "MERGEABLE",
				statusCheckRollup: [{ state: "SUCCESS" }, { conclusion: "FAILURE" }],
				body: "",
			};

			const result = formatPRView(data);

			expect(result).toContain("checks: pending/failing");
			expect(result).not.toContain("checks: passing");
		});

		it("formatPRView truncates body over 200 chars with ellipsis", () => {
			const longBody = "A".repeat(250);
			const data = {
				number: 8,
				title: "Long",
				state: "OPEN",
				author: { login: "user" },
				headRefName: "x",
				baseRefName: "main",
				additions: 0,
				deletions: 0,
				files: [],
				mergedAt: null,
				mergeable: "MERGEABLE",
				statusCheckRollup: [],
				body: longBody,
			};

			const result = formatPRView(data);

			expect(result).toContain(`${"A".repeat(200)}...`);
			expect(result).not.toContain("A".repeat(201));
		});

		it("formatPRList handles missing author object", () => {
			const data = [
				{
					number: 9,
					title: "Orphan PR",
					state: "OPEN",
					author: null,
					headRefName: "feat/x",
					baseRefName: "main",
					updatedAt: "2025-04-10T12:00:00Z",
				},
			];

			const result = formatPRList(data);

			expect(result).toContain("#9");
			expect(result).toContain("Orphan PR");
			expect(result).toContain("unknown");
			expect(result).not.toContain("null");
		});
	});

	describe("formatPRReviewComments", () => {
		it("returns 'No review comments.' for empty array", () => {
			expect(formatPRReviewComments([])).toBe("No review comments.");
		});

		it("formats a comment with path, line, author, and body", () => {
			const data = [
				{ path: "src/foo.ts", line: 42, user: { login: "reviewer" }, body: "Consider X" },
			];
			expect(formatPRReviewComments(data)).toBe("src/foo.ts:42  reviewer  Consider X");
		});

		it("uses '(general)' placeholder for null path and line", () => {
			const data = [
				{ path: null, line: null, user: { login: "reviewer" }, body: "General comment" },
			];
			expect(formatPRReviewComments(data)).toBe("(general)  reviewer  General comment");
		});

		it("truncates body longer than 500 chars", () => {
			const longBody = "A".repeat(600);
			const data = [{ path: "src/foo.ts", line: 1, user: { login: "u" }, body: longBody }];
			const result = formatPRReviewComments(data);
			expect(result).toContain("A".repeat(500));
			expect(result).toContain("...");
		});

		it("handles missing user login gracefully", () => {
			const data = [{ path: "src/foo.ts", line: 1, user: null, body: "comment" }];
			expect(formatPRReviewComments(data)).toContain("unknown");
		});

		it("formats multiple comments as separate lines", () => {
			const data = [
				{ path: "a.ts", line: 1, user: { login: "u1" }, body: "first" },
				{ path: "b.ts", line: 2, user: { login: "u2" }, body: "second" },
			];
			const result = formatPRReviewComments(data);
			expect(result).toContain("a.ts:1");
			expect(result).toContain("b.ts:2");
		});
	});
});
