import { describe, expect, it } from "vitest";
import {
	GHAuthError,
	GHError,
	GHNotFoundError,
	GHRateLimitError,
	getInstallInstructions,
} from "../../src/error-handler.js";

describe("getInstallInstructions", () => {
	it("returns install instructions for macOS", () => {
		const instructions = getInstallInstructions();
		expect(instructions).toContain("brew install gh");
	});

	it("returns install instructions for Linux", () => {
		const instructions = getInstallInstructions();
		expect(instructions).toContain("apt install gh");
	});

	it("returns install instructions for Windows", () => {
		const instructions = getInstallInstructions();
		expect(instructions).toContain("winget");
	});
});

describe("GHNotFoundError", () => {
	it("has correct name", () => {
		const error = new GHNotFoundError();
		expect(error.name).toBe("GHNotFoundError");
	});

	it("includes install instructions in message", () => {
		const error = new GHNotFoundError();
		expect(error.message).toContain("gh CLI not found");
		expect(error.message).toContain("brew install gh");
	});

	it("includes custom prefix when provided", () => {
		const error = new GHNotFoundError("Custom prefix message");
		expect(error.message).toContain("Custom prefix message");
		expect(error.message).toContain("brew install gh");
	});
});

describe("GHAuthError", () => {
	it("has correct name", () => {
		const error = new GHAuthError();
		expect(error.name).toBe("GHAuthError");
	});

	it("suggests gh auth login by default", () => {
		const error = new GHAuthError();
		expect(error.message).toContain("gh auth login");
	});

	it("accepts custom message", () => {
		const error = new GHAuthError("Custom auth error");
		expect(error.message).toBe("Custom auth error");
	});
});

describe("GHRateLimitError", () => {
	it("has correct name", () => {
		const error = new GHRateLimitError();
		expect(error.name).toBe("GHRateLimitError");
	});

	it("has a default message without detail", () => {
		const error = new GHRateLimitError();
		expect(error.message).toContain("rate limit");
	});

	it("embeds stderr detail when provided", () => {
		const error = new GHRateLimitError("API rate limit exceeded for user ID 1");
		expect(error.message).toContain("API rate limit exceeded for user ID 1");
	});
});

describe("GHError", () => {
	it("has correct name", () => {
		const error = new GHError(1, "something went wrong");
		expect(error.name).toBe("GHError");
	});

	it("preserves the exit code", () => {
		const error = new GHError(1, "oops");
		expect(error.code).toBe(1);
	});

	it("uses stderr as the message when non-empty", () => {
		const error = new GHError(1, "not a git repository\n");
		expect(error.message).toBe("not a git repository");
	});

	it("falls back to a generic message when stderr is empty", () => {
		const error = new GHError(1, "");
		expect(error.message).toContain("exit code 1");
	});
});
