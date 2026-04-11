/**
 * Summary Formatters
 *
 * Compact text formatters for tool output. Each formatter takes parsed JSON
 * data from a gh CLI call and returns a human-readable summary optimized
 * for minimal token usage.
 */

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "";
	return iso.slice(0, 10);
}

function authorLogin(author: unknown): string {
	if (author && typeof author === "object" && "login" in author) {
		return (author as { login: string }).login;
	}
	return "unknown";
}

// -- PR formatters --

export function formatPRList(data: unknown): string {
	if (!Array.isArray(data) || data.length === 0) {
		return "No pull requests found.";
	}

	const lines = data.map((pr) => {
		const num = `#${pr.number}`;
		const title = pr.title ?? "";
		const state = pr.state ?? "";
		const author = authorLogin(pr.author);
		const branches = `${pr.headRefName ?? ""} -> ${pr.baseRefName ?? ""}`;
		const date = formatDate(pr.updatedAt);
		return `${num}  ${title}  ${state}  ${author}  ${branches}  ${date}`;
	});

	return lines.join("\n");
}

export function formatPRView(data: unknown): string {
	if (!data || typeof data !== "object") {
		return "No pull request data.";
	}

	const pr = data as Record<string, unknown>;
	const header = `PR #${pr.number}: ${pr.title} [${pr.state}]`;

	const mergeDate = typeof pr.mergedAt === "string" ? pr.mergedAt : null;
	const mergeInfo = mergeDate
		? ` merged ${formatDate(mergeDate)} by ${authorLogin(pr.mergedBy)}`
		: ` by ${authorLogin(pr.author)}`;

	const branches = `${pr.headRefName ?? ""} -> ${pr.baseRefName ?? ""}`;
	const changes = `+${pr.additions ?? 0} -${pr.deletions ?? 0}`;
	const fileCount = Array.isArray(pr.files) ? `${pr.files.length} files` : "0 files";

	const passingStates = ["SUCCESS", "SKIPPED", "NEUTRAL"];
	const checks =
		Array.isArray(pr.statusCheckRollup) && pr.statusCheckRollup.length > 0
			? pr.statusCheckRollup.every(
					(c: Record<string, unknown>) =>
						passingStates.includes(c.state as string) ||
						passingStates.includes(c.conclusion as string),
				)
				? "checks: passing"
				: "checks: pending/failing"
			: "";

	const mergeable = pr.mergeable ? `mergeable: ${String(pr.mergeable).toLowerCase()}` : "";

	const statusParts = [mergeable, checks].filter(Boolean).join(" | ");
	const detailLine = `${branches} | ${changes} | ${fileCount}`;

	const lines = [header + mergeInfo, detailLine];
	if (statusParts) lines.push(statusParts);

	if (pr.body && typeof pr.body === "string" && pr.body.trim()) {
		const bodyPreview =
			pr.body.trim().length > 200 ? `${pr.body.trim().slice(0, 200)}...` : pr.body.trim();
		lines.push("", bodyPreview);
	}

	return lines.join("\n");
}

// -- Issue formatters --

export function formatIssueList(data: unknown): string {
	if (!Array.isArray(data) || data.length === 0) {
		return "No issues found.";
	}

	const lines = data.map((issue) => {
		const num = `#${issue.number}`;
		const title = issue.title ?? "";
		const state = issue.state ?? "";
		const labels = Array.isArray(issue.labels)
			? issue.labels.map((l: Record<string, string>) => l.name).join(",")
			: "";
		const date = formatDate(issue.updatedAt);
		return `${num}  ${title}  ${state}  ${labels}  ${date}`;
	});

	return lines.join("\n");
}

export function formatIssueView(data: unknown): string {
	if (!data || typeof data !== "object") {
		return "No issue data.";
	}

	const issue = data as Record<string, unknown>;
	const header = `Issue #${issue.number}: ${issue.title} [${issue.state}]`;

	const labels =
		Array.isArray(issue.labels) && issue.labels.length > 0
			? `Labels: ${issue.labels.map((l: Record<string, string>) => l.name).join(", ")}`
			: "";

	const assignees =
		Array.isArray(issue.assignees) && issue.assignees.length > 0
			? `Assignees: ${issue.assignees.map((a: Record<string, string>) => a.login).join(", ")}`
			: "";

	const commentCount = Array.isArray(issue.comments) ? `${issue.comments.length} comments` : "";
	const createdAt = typeof issue.createdAt === "string" ? issue.createdAt : null;
	const created = `Created: ${formatDate(createdAt)} by ${authorLogin(issue.author)}`;

	const metaParts = [labels, assignees, commentCount].filter(Boolean).join(" | ");
	const lines = [header];
	if (metaParts) lines.push(metaParts);
	lines.push(created);

	if (issue.body && typeof issue.body === "string" && issue.body.trim()) {
		const bodyPreview =
			issue.body.trim().length > 200 ? `${issue.body.trim().slice(0, 200)}...` : issue.body.trim();
		lines.push("", bodyPreview);
	}

	return lines.join("\n");
}
