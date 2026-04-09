/**
 * GH CLI Client
 *
 * Manages the GitHub CLI binary detection and command execution
 */

import { execSync } from "node:child_process";
import { GHAuthError, GHNotFoundError, GHRateLimitError, GHValidationError } from "./error-handler";

export interface GHClientOptions {
	binaryPath?: string;
}

export interface ExecResult {
	code: number;
	stdout: string;
	stderr: string;
	data?: unknown;
}

export type PiExecFn = (
	command: string,
	args: string[],
	options?: {
		timeout?: number;
		signal?: AbortSignal;
	},
) => Promise<{ code: number; stdout: string; stderr: string }>;

export class GHClient {
	private binaryPath: string | null = null;
	private execSyncFn: (command: string) => Buffer;
	private piExecFn: PiExecFn | null = null;

	constructor(options: GHClientOptions = {}) {
		this.binaryPath = options.binaryPath || null;
		this.execSyncFn = execSync;
	}

	/**
	 * Set a custom execSync function (for testing)
	 */
	setExecSyncFn(fn: (command: string) => Buffer): void {
		this.execSyncFn = fn;
	}

	/**
	 * Set the pi.exec function (required for actual execution)
	 */
	setPiExecFn(fn: PiExecFn): void {
		this.piExecFn = fn;
	}

	/**
	 * Detect gh binary in PATH or from env var (sync version)
	 */
	detectBinarySync(): string {
		// Check env var first
		const envPath = process.env.GH_CLI_PATH;
		if (envPath) {
			this.binaryPath = envPath;
			return envPath;
		}

		// Check if 'gh' is in PATH
		try {
			const result = this.execSyncFn("which gh");
			const path = result.toString().trim();
			if (path) {
				this.binaryPath = "gh";
				return "gh";
			}
		} catch {
			// Binary not found in PATH
		}

		throw new GHNotFoundError();
	}

	/**
	 * Detect gh binary (async version)
	 */
	async detectBinary(): Promise<string> {
		return this.detectBinarySync();
	}

	/**
	 * Get the detected binary path
	 */
	getBinaryPath(): string {
		if (!this.binaryPath) {
			throw new GHNotFoundError("Binary not detected. Call detectBinary() first.");
		}
		return this.binaryPath;
	}

	/**
	 * Execute a gh command
	 */
	async exec(
		args: string[],
		options?: {
			timeout?: number;
			signal?: AbortSignal;
		},
	): Promise<ExecResult> {
		const binary = this.getBinaryPath();

		if (!this.piExecFn) {
			throw new Error("PI exec function not set. Call setPiExecFn() or use with ExtensionAPI.");
		}

		const result = await this.piExecFn(binary, args, {
			timeout: options?.timeout ?? 30000,
			signal: options?.signal,
		});

		// Handle error codes
		if (result.code !== 0) {
			if (result.code === 4) {
				throw new GHAuthError(result.stderr || "Authentication required");
			}
			if (result.code === 8) {
				// Parse retry-after from headers if available
				// For now, default to 60 seconds
				throw new GHRateLimitError(60);
			}
			if (result.code === 2) {
				throw new GHValidationError("args", result.stderr || "Invalid arguments");
			}
		}

		// Parse JSON if --json flag was used
		const hasJsonFlag = args.includes("--json");
		let data: unknown | undefined;

		if (hasJsonFlag && result.stdout) {
			try {
				data = JSON.parse(result.stdout);
			} catch {
				// JSON parse failed, return raw stdout
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
