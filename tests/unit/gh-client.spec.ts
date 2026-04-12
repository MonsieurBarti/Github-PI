import * as childProcess from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GHAuthError, GHError, GHRateLimitError } from "../../src/error-handler";
import { GHClient, type PiExecFn, createGHClient } from "../../src/gh-client";

vi.mock("node:child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:child_process")>();
	return { ...actual };
});

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

		it("attaches stdout to GHError when command fails with stdout output", async () => {
			mockExec.mockResolvedValue({
				code: 1,
				stdout: "check-lint failed\ncheck-typecheck failed",
				stderr: "some checks were not successful",
			});

			try {
				await client.exec(["pr", "checks", "5"]);
				throw new Error("expected GHError to be thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(GHError);
				expect((err as GHError).code).toBe(1);
				expect((err as GHError).stdout).toBe("check-lint failed\ncheck-typecheck failed");
			}
		});

		it("defaults GHError.stdout to empty string when command fails with no stdout", async () => {
			mockExec.mockResolvedValue({
				code: 1,
				stdout: "",
				stderr: "boom",
			});

			try {
				await client.exec(["repo", "view", "nope/nope"]);
				throw new Error("expected GHError to be thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(GHError);
				expect((err as GHError).stdout).toBe("");
			}
		});
	});
});

describe("createGHClient", () => {
	it("returns a GHClient using the injected exec when provided", async () => {
		const injectedExec = vi.fn().mockResolvedValue({
			code: 0,
			stdout: "ok",
			stderr: "",
		});

		const client = createGHClient({ exec: injectedExec as unknown as PiExecFn });
		const result = await client.exec(["--version"]);

		expect(result.stdout).toBe("ok");
		expect(injectedExec).toHaveBeenCalledWith("gh", ["--version"], expect.any(Object));
	});

	it("honors binaryPath override", async () => {
		const injectedExec = vi.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" });
		const client = createGHClient({
			exec: injectedExec as unknown as PiExecFn,
			binaryPath: "/custom/gh",
		});
		await client.exec(["--version"]);
		expect(injectedExec).toHaveBeenCalledWith("/custom/gh", ["--version"], expect.any(Object));
	});

	it("falls back to a node execFile-based exec when none is provided", async () => {
		const execFileSpy = vi.spyOn(childProcess, "execFile").mockImplementation(((
			_file: string,
			_args: readonly string[],
			_opts: unknown,
			cb: (err: Error | null, stdout: string, stderr: string) => void,
		) => {
			cb(null, "default-exec-ok", "");
			return {} as ReturnType<typeof childProcess.execFile>;
		}) as unknown as typeof childProcess.execFile);

		try {
			const client = createGHClient();
			const result = await client.exec(["--version"]);
			expect(result.code).toBe(0);
			expect(result.stdout).toBe("default-exec-ok");
			expect(execFileSpy).toHaveBeenCalledWith(
				"gh",
				["--version"],
				expect.any(Object),
				expect.any(Function),
			);
		} finally {
			execFileSpy.mockRestore();
		}
	});

	it("default exec normalizes non-zero exits into {code, stdout, stderr}", async () => {
		const execFileSpy = vi.spyOn(childProcess, "execFile").mockImplementation(((
			_file: string,
			_args: readonly string[],
			_opts: unknown,
			cb: (
				err: (Error & { code?: number; stdout?: string; stderr?: string }) | null,
				stdout: string,
				stderr: string,
			) => void,
		) => {
			const err = new Error("fail") as Error & {
				code?: number;
				stdout?: string;
				stderr?: string;
			};
			err.code = 1;
			err.stdout = "failing-check";
			err.stderr = "boom";
			cb(err, "failing-check", "boom");
			return {} as ReturnType<typeof childProcess.execFile>;
		}) as unknown as typeof childProcess.execFile);

		try {
			const client = createGHClient();
			await expect(client.exec(["pr", "checks", "5"])).rejects.toMatchObject({
				name: "GHError",
				code: 1,
				stdout: "failing-check",
			});
		} finally {
			execFileSpy.mockRestore();
		}
	});

	it("default exec removes the abort listener after normal completion", async () => {
		const execFileSpy = vi.spyOn(childProcess, "execFile").mockImplementation(((
			_file: string,
			_args: readonly string[],
			_opts: unknown,
			cb: (err: Error | null, stdout: string, stderr: string) => void,
		) => {
			setImmediate(() => cb(null, "ok", ""));
			return { kill: () => {} } as unknown as ReturnType<typeof childProcess.execFile>;
		}) as unknown as typeof childProcess.execFile);

		try {
			const controller = new AbortController();
			const addSpy = vi.spyOn(controller.signal, "addEventListener");
			const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

			const client = createGHClient();
			await client.exec(["--version"], { signal: controller.signal });

			expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function), { once: true });
			expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
		} finally {
			execFileSpy.mockRestore();
		}
	});
});
