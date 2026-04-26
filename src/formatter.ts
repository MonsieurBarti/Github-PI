export interface ResponseFormatterOptions {
	fields?: string[];
	preserveKeys?: string[];
}

const STRIP_KEYS = new Set(["node_id", "performed_via_github_app"]);
const TRUNCATE_KEYS = new Set(["body", "description", "content", "message"]);
const TRUNCATE_MAX = 500;

function cleanDeep(data: unknown, preserveKeys: Set<string>): unknown {
	if (data === null || data === undefined || typeof data !== "object") return data;
	if (Array.isArray(data)) return data.map((item) => cleanDeep(item, preserveKeys));
	const obj = data as Record<string, unknown>;
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (STRIP_KEYS.has(key)) continue;
		if (
			TRUNCATE_KEYS.has(key) &&
			!preserveKeys.has(key) &&
			typeof value === "string" &&
			value.length > TRUNCATE_MAX
		) {
			result[key] = `${value.slice(0, TRUNCATE_MAX)}...`;
		} else {
			result[key] = cleanDeep(value, preserveKeys);
		}
	}
	return result;
}

export function formatResponse(data: unknown, opts?: ResponseFormatterOptions): unknown {
	const cleaned = cleanDeep(data, new Set(opts?.preserveKeys ?? []));
	const fields = opts?.fields;
	if (!fields || fields.length === 0) return cleaned;
	if (Array.isArray(cleaned)) {
		return cleaned.map((item) =>
			item !== null && typeof item === "object" && !Array.isArray(item)
				? Object.fromEntries(
						Object.entries(item as Record<string, unknown>).filter(([k]) => fields.includes(k)),
					)
				: item,
		);
	}
	if (cleaned !== null && typeof cleaned === "object") {
		return Object.fromEntries(
			Object.entries(cleaned as Record<string, unknown>).filter(([k]) => fields.includes(k)),
		);
	}
	return cleaned;
}
