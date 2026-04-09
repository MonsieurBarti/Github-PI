/**
 * GH CLI Client
 *
 * Thin wrapper around pi.exec for running the `gh` binary with consistent
 * error handling and opt-in JSON parsing.
 */

import { GHAuthError, GHError, GHRateLimitError } from "./error-handler";

export interface ExecResult {
	code: number;
	stdout: string;
	stderr: string;
	data?: unknown;
}

export interface ExecOptions {
	timeout?: number;
	signal?: AbortSignal;
}

export type PiExecFn = (
	command: string,
	args: string[],
	options?: ExecOptions,
) => Promise<{ code: number; stdout: string; stderr: string; killed?: boolean }>;

export interface GHClientOptions {
	exec: PiExecFn;
	binaryPath?: string;
}

// gh exit codes (from `gh help exit-codes`):
//   0  success
//   1  general failure (includes rate limits, API errors, validation failures)
//   2  command cancelled
//   4  authentication required
const EXIT_AUTH = 4;
const EXIT_CANCELLED = 2;

// Rate limit detection: gh emits exit 1 with one of these substrings on stderr.
const RATE_LIMIT_PATTERNS = [
	"api rate limit exceeded",
	"rate limit exceeded",
	"secondary rate limit",
];

export class GHClient {
	private readonly piExec: PiExecFn;
	readonly binaryPath: string;

	constructor(options: GHClientOptions) {
		this.piExec = options.exec;
		this.binaryPath = options.binaryPath ?? "gh";
	}

	/**
	 * Execute a gh command.
	 *
	 * Throws GHAuthError / GHRateLimitError / GHError on non-zero exits other
	 * than exit 2 (cancelled), which is passed through as a non-throwing result
	 * so the caller can decide how to surface a cancel.
	 */
	async exec(args: string[], options?: ExecOptions): Promise<ExecResult> {
		const result = await this.piExec(this.binaryPath, args, {
			timeout: options?.timeout ?? 30000,
			signal: options?.signal,
		});

		if (result.code !== 0 && result.code !== EXIT_CANCELLED) {
			if (result.code === EXIT_AUTH) {
				throw new GHAuthError(result.stderr.trim() || undefined);
			}

			const stderrLower = result.stderr.toLowerCase();
			if (RATE_LIMIT_PATTERNS.some((p) => stderrLower.includes(p))) {
				throw new GHRateLimitError(result.stderr.trim());
			}

			throw new GHError(result.code, result.stderr);
		}

		// Parse JSON if --json flag was used and we have stdout.
		let data: unknown | undefined;
		if (args.includes("--json") && result.stdout) {
			try {
				data = JSON.parse(result.stdout);
			} catch {
				// Not JSON; fall through with raw stdout.
			}
		}

		return {
			code: result.code,
			stdout: result.stdout,
			stderr: result.stderr,
			data,
		};
	}
}
