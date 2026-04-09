import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	GHAuthError,
	GHNotFoundError,
	GHRateLimitError,
	GHValidationError,
} from "../../src/error-handler";
import { GHClient } from "../../src/gh-client";

describe("GHClient", () => {
	let client: GHClient;
	let mockExecSync: ReturnType<typeof vi.fn>;
	const originalEnv = process.env;

	beforeEach(() => {
		client = new GHClient();
		mockExecSync = vi.fn();
		client.setExecSyncFn(mockExecSync);
		// Clear GH_CLI_PATH for clean state
		process.env.GH_CLI_PATH = undefined;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("detectBinarySync", () => {
		it("returns path from GH_CLI_PATH env var", () => {
			process.env.GH_CLI_PATH = "/custom/gh";
			const path = client.detectBinarySync();
			expect(path).toBe("/custom/gh");
		});

		it('returns "gh" when found in PATH', () => {
			mockExecSync.mockReturnValue(Buffer.from("/usr/bin/gh\n"));
			const path = client.detectBinarySync();
			expect(path).toBe("gh");
		});

		it("throws GHNotFoundError when not found", () => {
			mockExecSync.mockImplementation(() => {
				throw new Error("not found");
			});
			expect(() => client.detectBinarySync()).toThrow(GHNotFoundError);
		});

		it("does not call which when env var is set", () => {
			process.env.GH_CLI_PATH = "/custom/gh";
			client.detectBinarySync();
			expect(mockExecSync).not.toHaveBeenCalled();
		});
	});

	describe("exec", () => {
		beforeEach(() => {
			// Set up binary path for exec tests
			mockExecSync.mockReturnValue(Buffer.from("/usr/bin/gh\n"));
			client.detectBinarySync();
		});

		it("parses JSON output when --json flag present", async () => {
			const mockPiExec = vi.fn().mockResolvedValue({
				code: 0,
				stdout: '{"id": 123, "name": "test"}',
				stderr: "",
			});
			client.setPiExecFn(mockPiExec);

			const result = await client.exec(["repo", "view", "--json", "name"]);
			expect(result.data).toEqual({ id: 123, name: "test" });
			expect(result.stdout).toBe('{"id": 123, "name": "test"}');
		});

		it("returns text output for non-JSON commands", async () => {
			const mockPiExec = vi.fn().mockResolvedValue({
				code: 0,
				stdout: "Hello world",
				stderr: "",
			});
			client.setPiExecFn(mockPiExec);

			const result = await client.exec(["--version"]);
			expect(result.stdout).toBe("Hello world");
			expect(result.data).toBeUndefined();
		});

		it("throws GHAuthError on exit code 4", async () => {
			const mockPiExec = vi.fn().mockResolvedValue({
				code: 4,
				stdout: "",
				stderr: "authentication required",
			});
			client.setPiExecFn(mockPiExec);

			await expect(client.exec(["repo", "list"])).rejects.toThrow(GHAuthError);
		});

		it("throws GHRateLimitError on exit code 8", async () => {
			const mockPiExec = vi.fn().mockResolvedValue({
				code: 8,
				stdout: "",
				stderr: "rate limit exceeded",
			});
			client.setPiExecFn(mockPiExec);

			await expect(client.exec(["api", "/user"])).rejects.toThrow(GHRateLimitError);
		});

		it("throws GHValidationError on exit code 2", async () => {
			const mockPiExec = vi.fn().mockResolvedValue({
				code: 2,
				stdout: "",
				stderr: "invalid arguments",
			});
			client.setPiExecFn(mockPiExec);

			await expect(client.exec(["repo", "create"])).rejects.toThrow(GHValidationError);
		});

		it("passes timeout to pi.exec", async () => {
			const mockPiExec = vi.fn().mockResolvedValue({
				code: 0,
				stdout: "{}",
				stderr: "",
			});
			client.setPiExecFn(mockPiExec);

			await client.exec(["repo", "list"], { timeout: 60000 });
			expect(mockPiExec).toHaveBeenCalledWith(
				"gh",
				["repo", "list"],
				expect.objectContaining({ timeout: 60000 }),
			);
		});

		it("passes signal to pi.exec", async () => {
			const mockPiExec = vi.fn().mockResolvedValue({
				code: 0,
				stdout: "{}",
				stderr: "",
			});
			client.setPiExecFn(mockPiExec);

			const controller = new AbortController();
			await client.exec(["repo", "list"], { signal: controller.signal });
			expect(mockPiExec).toHaveBeenCalledWith(
				"gh",
				["repo", "list"],
				expect.objectContaining({ signal: controller.signal }),
			);
		});

		it("handles invalid JSON gracefully", async () => {
			const mockPiExec = vi.fn().mockResolvedValue({
				code: 0,
				stdout: "not valid json",
				stderr: "",
			});
			client.setPiExecFn(mockPiExec);

			const result = await client.exec(["repo", "view", "--json", "name"]);
			expect(result.data).toBeUndefined();
			expect(result.stdout).toBe("not valid json");
		});

		it("throws error when piExecFn not set", async () => {
			await expect(client.exec(["repo", "list"])).rejects.toThrow("PI exec function not set");
		});

		it("throws error when binary not detected", async () => {
			const newClient = new GHClient();
			await expect(newClient.exec(["repo", "list"])).rejects.toThrow("Binary not detected");
		});
	});

	describe("getBinaryPath", () => {
		it("returns detected binary path", () => {
			mockExecSync.mockReturnValue(Buffer.from("/usr/bin/gh\n"));
			client.detectBinarySync();
			expect(client.getBinaryPath()).toBe("gh");
		});

		it("throws when binary not detected", () => {
			expect(() => client.getBinaryPath()).toThrow(GHNotFoundError);
		});
	});
});
