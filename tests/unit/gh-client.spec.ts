import { beforeEach, describe, expect, it, vi } from "vitest";
import { GHAuthError, GHError, GHRateLimitError } from "../../src/error-handler";
import { GHClient, type PiExecFn } from "../../src/gh-client";

describe("GHClient", () => {
	let mockExec: ReturnType<typeof vi.fn>;
	let client: GHClient;

	beforeEach(() => {
		mockExec = vi.fn();
		client = new GHClient({ exec: mockExec as unknown as PiExecFn });
	});

	describe("exec", () => {
		it("parses JSON output when --json flag present", async () => {
			mockExec.mockResolvedValue({
				code: 0,
				stdout: '{"id": 123, "name": "test"}',
				stderr: "",
			});

			const result = await client.exec(["repo", "view", "--json", "name"]);
			expect(result.data).toEqual({ id: 123, name: "test" });
			expect(result.stdout).toBe('{"id": 123, "name": "test"}');
		});

		it("returns text output for non-JSON commands", async () => {
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "Hello world",
				stderr: "",
			});

			const result = await client.exec(["--version"]);
			expect(result.stdout).toBe("Hello world");
			expect(result.data).toBeUndefined();
		});

		it("throws GHAuthError on exit code 4", async () => {
			mockExec.mockResolvedValue({
				code: 4,
				stdout: "",
				stderr: "authentication required",
			});

			await expect(client.exec(["repo", "list"])).rejects.toThrow(GHAuthError);
		});

		it("throws GHRateLimitError when stderr mentions API rate limit", async () => {
			mockExec.mockResolvedValue({
				code: 1,
				stdout: "",
				stderr: "API rate limit exceeded for user ID 1",
			});

			await expect(client.exec(["api", "/user"])).rejects.toThrow(GHRateLimitError);
		});

		it("throws GHError on other non-zero exits with stderr message", async () => {
			mockExec.mockResolvedValue({
				code: 1,
				stdout: "",
				stderr: "HTTP 404: Not Found",
			});

			await expect(client.exec(["repo", "view", "nope/nope"])).rejects.toThrow(/HTTP 404/);
		});

		it("passes through exit code 2 (cancelled) without throwing", async () => {
			mockExec.mockResolvedValue({
				code: 2,
				stdout: "",
				stderr: "cancelled",
			});

			const result = await client.exec(["repo", "list"]);
			expect(result.code).toBe(2);
		});

		it("passes timeout to pi.exec", async () => {
			mockExec.mockResolvedValue({ code: 0, stdout: "{}", stderr: "" });

			await client.exec(["repo", "list"], { timeout: 60000 });
			expect(mockExec).toHaveBeenCalledWith(
				"gh",
				["repo", "list"],
				expect.objectContaining({ timeout: 60000 }),
			);
		});

		it("passes signal to pi.exec", async () => {
			mockExec.mockResolvedValue({ code: 0, stdout: "{}", stderr: "" });

			const controller = new AbortController();
			await client.exec(["repo", "list"], { signal: controller.signal });
			expect(mockExec).toHaveBeenCalledWith(
				"gh",
				["repo", "list"],
				expect.objectContaining({ signal: controller.signal }),
			);
		});

		it("handles invalid JSON gracefully", async () => {
			mockExec.mockResolvedValue({
				code: 0,
				stdout: "not valid json",
				stderr: "",
			});

			const result = await client.exec(["repo", "view", "--json", "name"]);
			expect(result.data).toBeUndefined();
			expect(result.stdout).toBe("not valid json");
		});

		it("defaults binary to 'gh'", async () => {
			mockExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
			await client.exec(["--version"]);
			expect(mockExec).toHaveBeenCalledWith("gh", ["--version"], expect.any(Object));
		});

		it("honors custom binaryPath", async () => {
			const customExec = vi.fn().mockResolvedValue({
				code: 0,
				stdout: "",
				stderr: "",
			});
			const customClient = new GHClient({
				exec: customExec as unknown as PiExecFn,
				binaryPath: "/opt/homebrew/bin/gh",
			});

			await customClient.exec(["--version"]);
			expect(customExec).toHaveBeenCalledWith(
				"/opt/homebrew/bin/gh",
				["--version"],
				expect.any(Object),
			);
		});
	});
});
