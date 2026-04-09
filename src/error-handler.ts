/**
 * Error classes and messages for GH PI extension
 */

export const INSTALL_INSTRUCTIONS = `
⚠️  GitHub CLI (gh) not found in PATH

Install:
  macOS:    brew install gh
  Ubuntu:   sudo apt install gh
  Windows:  winget install GitHub.cli
  Other:    https://github.com/cli/cli#installation

Authenticate:
  gh auth login

See: https://cli.github.com/
`;

export function getInstallInstructions(): string {
	return INSTALL_INSTRUCTIONS.trim();
}

export class GHNotFoundError extends Error {
	constructor(prefix = "") {
		const baseMessage = "gh CLI not found in PATH";
		const instructions = getInstallInstructions();
		const message = prefix
			? `${prefix}\n${baseMessage}\n${instructions}`
			: `${baseMessage}\n${instructions}`;
		super(message);
		this.name = "GHNotFoundError";
	}
}

export class GHAuthError extends Error {
	constructor(message = "Authentication failed. Run: gh auth login") {
		super(message);
		this.name = "GHAuthError";
	}
}

export class GHRateLimitError extends Error {
	retryAfter: number;

	constructor(retryAfter: number) {
		super(`Rate limited. Retry after ${retryAfter} seconds.`);
		this.name = "GHRateLimitError";
		this.retryAfter = retryAfter;
	}
}

export class GHValidationError extends Error {
	field: string;

	constructor(field: string, reason: string) {
		super(`Validation failed for '${field}': ${reason}`);
		this.name = "GHValidationError";
		this.field = field;
	}
}
