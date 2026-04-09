/**
 * PR Tools
 *
 * GitHub pull request operations: create, list, view, diff, merge, review, close, checkout
 */

import type { GHClient } from "./gh-client";

export interface CreatePRParams {
	repo: string;
	title: string;
	body?: string;
	head: string;
	base: string;
	draft?: boolean;
}

export interface ListPRsParams {
	repo: string;
	state?: "open" | "closed" | "merged" | "all";
	head?: string;
	base?: string;
	author?: string;
	limit?: number;
}

export interface ViewPRParams {
	repo: string;
	number: number;
}

export interface DiffPRParams {
	repo: string;
	number: number;
}

export interface MergePRParams {
	repo: string;
	number: number;
	method?: "merge" | "squash" | "rebase";
	auto?: boolean;
	delete_branch?: boolean;
}

export interface ReviewPRParams {
	repo: string;
	number: number;
	action: "approve" | "request-changes" | "comment";
	body?: string;
}

export interface ClosePRParams {
	repo: string;
	number: number;
	comment?: string;
}

export interface CheckoutPRParams {
	repo: string;
	number: number;
	branch?: string;
}

export function createPRTools(client: GHClient) {
	return {
		async create(params: CreatePRParams) {
			const args = ["pr", "create", "--repo", params.repo];

			args.push("--title", params.title);
			args.push("--head", params.head);
			args.push("--base", params.base);

			if (params.body) {
				args.push("--body", params.body);
			}
			if (params.draft) {
				args.push("--draft");
			}

			args.push("--json", "number,title,url,state,headRefName,baseRefName,createdAt");

			return client.exec(args);
		},

		async list(params: ListPRsParams) {
			const args = ["pr", "list", "--repo", params.repo];

			if (params.state) {
				args.push("--state", params.state);
			}
			if (params.head) {
				args.push("--head", params.head);
			}
			if (params.base) {
				args.push("--base", params.base);
			}
			if (params.author) {
				args.push("--author", params.author);
			}
			if (params.limit) {
				args.push("--limit", String(params.limit));
			}

			args.push("--json", "number,title,state,author,headRefName,baseRefName,updatedAt,createdAt");

			return client.exec(args);
		},

		async view(params: ViewPRParams) {
			const args = [
				"pr",
				"view",
				String(params.number),
				"--repo",
				params.repo,
				"--json",
				"number,title,body,state,author,headRefName,baseRefName,additions,deletions,files,merged,mergeable,checksState",
			];

			return client.exec(args);
		},

		async diff(params: DiffPRParams) {
			const args = ["pr", "diff", String(params.number), "--repo", params.repo];

			// Note: diff returns plain text, not JSON
			return client.exec(args);
		},

		async merge(params: MergePRParams) {
			const args = ["pr", "merge", String(params.number), "--repo", params.repo];

			if (params.method) {
				args.push(`--${params.method}`);
			}
			if (params.auto) {
				args.push("--auto");
			}
			if (params.delete_branch) {
				args.push("--delete-branch");
			}

			return client.exec(args);
		},

		async review(params: ReviewPRParams) {
			const args = ["pr", "review", String(params.number), "--repo", params.repo];

			switch (params.action) {
				case "approve":
					args.push("--approve");
					break;
				case "request-changes":
					args.push("--request-changes");
					break;
				case "comment":
					args.push("--comment");
					break;
			}

			if (params.body) {
				args.push("--body", params.body);
			}

			return client.exec(args);
		},

		async close(params: ClosePRParams) {
			const args = ["pr", "close", String(params.number), "--repo", params.repo];

			if (params.comment) {
				args.push("--comment", params.comment);
			}

			return client.exec(args);
		},

		async checkout(params: CheckoutPRParams) {
			const args = ["pr", "checkout", String(params.number), "--repo", params.repo];

			if (params.branch) {
				args.push("--branch", params.branch);
			}

			return client.exec(args);
		},
	};
}
