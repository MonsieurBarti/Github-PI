/**
 * Update check for GH-PI extension
 *
 * Fetches the latest release from GitHub and compares with current version
 * to notify users when an update is available.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface UpdateInfo {
	currentVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
	releaseUrl: string;
}

/**
 * Read current version from package.json
 */
function getCurrentVersion(): string {
	try {
		const packageJsonPath = join(__dirname, "..", "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
		return packageJson.version || "0.0.0";
	} catch {
		return "0.0.0";
	}
}

/**
 * Compare semantic versions (returns true if latest > current)
 */
function compareVersions(current: string, latest: string): boolean {
	const cleanVersion = (v: string) => v.replace(/^v/, "");
	const currentParts = cleanVersion(current).split(".").map(Number);
	const latestParts = cleanVersion(latest).split(".").map(Number);

	for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
		const curr = currentParts[i] || 0;
		const lat = latestParts[i] || 0;
		if (lat > curr) return true;
		if (lat < curr) return false;
	}
	return false;
}

/**
 * Fetch latest release from GitHub API
 * Uses gh CLI if available, falls back to curl
 */
async function fetchLatestRelease(): Promise<{ version: string; url: string } | null> {
	const repo = "MonsieurBarti/GH-PI";
	const url = `https://api.github.com/repos/${repo}/releases/latest`;

	try {
		// Try using gh CLI first (authenticated, better rate limits)
		const result = execSync(
			"gh api repos/MonsieurBarti/GH-PI/releases/latest --jq '.tag_name,.html_url'",
			{
				encoding: "utf-8",
				timeout: 5000,
				stdio: ["pipe", "pipe", "pipe"],
			},
		);

		const lines = result.trim().split("\n");
		if (lines.length >= 2) {
			return {
				version: lines[0],
				url: lines[1],
			};
		}
	} catch {
		// gh CLI not available or failed, fall back to curl
		try {
			const result = execSync(`curl -s ${url}`, {
				encoding: "utf-8",
				timeout: 5000,
			});

			const release = JSON.parse(result);
			if (release.tag_name && release.html_url) {
				return {
					version: release.tag_name,
					url: release.html_url,
				};
			}
		} catch {
			// Silently fail - update check is not critical
		}
	}

	return null;
}

/**
 * Check if an update is available
 * Returns null if check fails (silently)
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
	const currentVersion = getCurrentVersion();
	const latest = await fetchLatestRelease();

	if (!latest) {
		return null;
	}

	const updateAvailable = compareVersions(currentVersion, latest.version);

	return {
		currentVersion,
		latestVersion: latest.version,
		updateAvailable,
		releaseUrl: latest.url,
	};
}
