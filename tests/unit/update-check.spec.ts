import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkForUpdates } from "../../src/update-check.js";

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return { ...actual, readFileSync: vi.fn() };
});

describe("update-check", () => {
	describe("checkForUpdates", () => {
		let mockFetch: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			mockFetch = vi.fn();
			vi.stubGlobal("fetch", mockFetch);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: "1.0.0" }));
		});

		afterEach(() => {
			vi.unstubAllGlobals();
			vi.resetAllMocks();
		});

		it("returns UpdateInfo with updateAvailable true when newer version exists", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ version: "2.0.0" }),
			});

			const result = await checkForUpdates(null);

			expect(result).toEqual({
				currentVersion: "1.0.0",
				latestVersion: "2.0.0",
				updateAvailable: true,
			});
		});

		it("returns UpdateInfo with updateAvailable false when versions are equal", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ version: "1.0.0" }),
			});

			const result = await checkForUpdates(null);

			expect(result).toEqual({
				currentVersion: "1.0.0",
				latestVersion: "1.0.0",
				updateAvailable: false,
			});
		});

		it("returns UpdateInfo with updateAvailable false when current version is newer", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ version: "0.9.0" }),
			});

			const result = await checkForUpdates(null);

			expect(result).toEqual({
				currentVersion: "1.0.0",
				latestVersion: "0.9.0",
				updateAvailable: false,
			});
		});

		it("returns null when fetch throws", async () => {
			mockFetch.mockRejectedValue(new Error("network error"));

			const result = await checkForUpdates(null);

			expect(result).toBeNull();
		});

		it("returns null when response is not ok", async () => {
			mockFetch.mockResolvedValue({ ok: false, status: 404 });

			const result = await checkForUpdates(null);

			expect(result).toBeNull();
		});

		it("returns null when registry response lacks version field", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({}),
			});

			const result = await checkForUpdates(null);

			expect(result).toBeNull();
		});

		it("uses 0.0.0 as currentVersion when readFileSync throws", async () => {
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("ENOENT");
			});
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ version: "1.0.0" }),
			});

			const result = await checkForUpdates(null);

			expect(result).toEqual({
				currentVersion: "0.0.0",
				latestVersion: "1.0.0",
				updateAvailable: true,
			});
		});
	});
});
