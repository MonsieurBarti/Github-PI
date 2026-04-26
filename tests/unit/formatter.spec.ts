import { describe, expect, it } from "vitest";
import { formatResponse } from "../../src/formatter.js";

describe("formatResponse", () => {
	describe("cleanDeep — strip keys", () => {
		it("strips node_id from a shallow object", () => {
			const input = { id: 1, node_id: "abc123", title: "Hello" };
			const result = formatResponse(input);
			expect(result).toEqual({ id: 1, title: "Hello" });
		});

		it("strips node_id from a nested object", () => {
			const input = {
				id: 1,
				author: { login: "user", node_id: "nested123" },
				node_id: "top123",
			};
			const result = formatResponse(input);
			expect(result).toEqual({ id: 1, author: { login: "user" } });
		});

		it("strips performed_via_github_app", () => {
			const input = {
				id: 42,
				performed_via_github_app: { name: "some-app" },
				body: "A comment",
			};
			const result = formatResponse(input);
			expect(result).toEqual({ id: 42, body: "A comment" });
		});
	});

	describe("cleanDeep — body/description/content/message truncation", () => {
		it("truncates body longer than 500 chars to exactly slice(0, 500) + '...'", () => {
			const longBody = "B".repeat(600);
			const input = { body: longBody };
			const result = formatResponse(input) as { body: string };
			expect(result.body).toBe(`${"B".repeat(500)}...`);
		});

		it("does NOT truncate body at exactly 500 chars", () => {
			const exactBody = "C".repeat(500);
			const input = { body: exactBody };
			const result = formatResponse(input) as { body: string };
			expect(result.body).toBe(exactBody);
		});

		it("does NOT truncate body shorter than 500 chars", () => {
			const shortBody = "D".repeat(200);
			const input = { body: shortBody };
			const result = formatResponse(input) as { body: string };
			expect(result.body).toBe(shortBody);
		});

		it("preserves configured keys without truncating them", () => {
			const longBody = "E".repeat(600);
			const input = { body: longBody };
			const result = formatResponse(input, { preserveKeys: ["body"] }) as { body: string };
			expect(result.body).toBe(longBody);
		});
	});

	describe("fields allowlist", () => {
		it("retains only listed keys on a plain object", () => {
			const input = { id: 1, title: "PR title", state: "OPEN", node_id: "n1" };
			const result = formatResponse(input, { fields: ["id", "title"] });
			expect(result).toEqual({ id: 1, title: "PR title" });
		});

		it("applies fields allowlist per element on an array", () => {
			const input = [
				{ id: 1, title: "First", state: "OPEN" },
				{ id: 2, title: "Second", state: "CLOSED" },
			];
			const result = formatResponse(input, { fields: ["id", "title"] });
			expect(result).toEqual([
				{ id: 1, title: "First" },
				{ id: 2, title: "Second" },
			]);
		});

		it("passes non-object array elements through unchanged", () => {
			const input = [1, "hello", true];
			const result = formatResponse(input, { fields: ["id"] });
			expect(result).toEqual([1, "hello", true]);
		});
	});

	describe("edge cases — null / undefined / primitives", () => {
		it("returns null for null input", () => {
			expect(formatResponse(null)).toBeNull();
		});

		it("returns undefined for undefined input", () => {
			expect(formatResponse(undefined)).toBeUndefined();
		});

		it("returns primitive values (number, string, boolean) unchanged", () => {
			expect(formatResponse(42)).toBe(42);
			expect(formatResponse("hello")).toBe("hello");
			expect(formatResponse(true)).toBe(true);
		});
	});
});
