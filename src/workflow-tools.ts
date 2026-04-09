/**
 * Workflow Tools
 *
 * GitHub Actions workflow operations: list, view, run, logs, disable, enable
 */

import type { GHClient } from "./gh-client";

export interface ListWorkflowsParams {
	repo: string;
	limit?: number;
}

export interface ViewWorkflowParams {
	repo: string;
	workflow: string; // name, ID, or filename
}

export interface RunWorkflowParams {
	repo: string;
	workflow: string;
	branch?: string;
	inputs?: Record<string, string>;
}

export interface WorkflowLogsParams {
	repo: string;
	run_id: string;
	job?: string;
}

export interface DisableWorkflowParams {
	repo: string;
	workflow: string;
}

export interface EnableWorkflowParams {
	repo: string;
	workflow: string;
}

export function createWorkflowTools(client: GHClient) {
	return {
		async list(params: ListWorkflowsParams) {
			const args = ["workflow", "list", "--repo", params.repo];

			if (params.limit) {
				args.push("--limit", String(params.limit));
			}

			args.push("--json", "id,name,path,state,timing");

			return client.exec(args);
		},

		async view(params: ViewWorkflowParams) {
			const args = ["workflow", "view", params.workflow, "--repo", params.repo, "--yaml"];

			return client.exec(args);
		},

		async run(params: RunWorkflowParams) {
			const args = ["workflow", "run", params.workflow, "--repo", params.repo];

			if (params.branch) {
				args.push("--ref", params.branch);
			}

			if (params.inputs) {
				for (const [key, value] of Object.entries(params.inputs)) {
					args.push("--field", `${key}=${value}`);
				}
			}

			return client.exec(args);
		},

		async logs(params: WorkflowLogsParams) {
			const args = ["run", "view", params.run_id, "--repo", params.repo, "--logs"];

			if (params.job) {
				args.push("--job", params.job);
			}

			return client.exec(args);
		},

		async disable(params: DisableWorkflowParams) {
			const args = ["workflow", "disable", params.workflow, "--repo", params.repo];
			return client.exec(args);
		},

		async enable(params: EnableWorkflowParams) {
			const args = ["workflow", "enable", params.workflow, "--repo", params.repo];
			return client.exec(args);
		},
	};
}
