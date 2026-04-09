import { describe, expect, it } from "vitest";
import {
	GHAuthError,
	GHNotFoundError,
	GHRateLimitError,
	GHValidationError,
	getInstallInstructions,
} from "../../src/error-handler";

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
		const error = new GHRateLimitError(60);
		expect(error.name).toBe("GHRateLimitError");
	});

	it("includes retry after info", () => {
		const error = new GHRateLimitError(60);
		expect(error.message).toContain("60 seconds");
		expect(error.retryAfter).toBe(60);
	});

	it("handles different retry values", () => {
		const error = new GHRateLimitError(300);
		expect(error.message).toContain("300 seconds");
		expect(error.retryAfter).toBe(300);
	});
});

describe("GHValidationError", () => {
	it("has correct name", () => {
		const error = new GHValidationError("name", "already exists");
		expect(error.name).toBe("GHValidationError");
	});

	it("includes field info", () => {
		const error = new GHValidationError("name", "already exists");
		expect(error.field).toBe("name");
		expect(error.message).toContain("name");
		expect(error.message).toContain("already exists");
	});

	it("handles different fields", () => {
		const error = new GHValidationError("description", "is required");
		expect(error.field).toBe("description");
		expect(error.message).toContain("description");
		expect(error.message).toContain("is required");
	});
});
