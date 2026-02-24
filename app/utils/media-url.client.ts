/**
 * Client-side utility for generating fresh media URLs with time parameters
 * from stable anchor data (R2 key + timing)
 */

export type { MediaAnchor } from "./media-anchors";
export { getAnchorStartSeconds } from "./media-anchors";

import type { MediaAnchor } from "./media-anchors";

/**
 * Generate a fresh signed URL for media playback with time parameter
 * @param anchor - Anchor data with media_key and timing
 * @param fallbackMediaUrl - Fallback media URL if anchor doesn't have media_key
 * @returns URL with time parameter (e.g., "https://...?t=120")
 */
export async function generateMediaUrl(anchor: MediaAnchor, fallbackMediaUrl?: string | null): Promise<string | null> {
	// Handle legacy anchors with full URL in target
	if (anchor.target && typeof anchor.target === "string" && anchor.target.startsWith("http")) {
		return anchor.target;
	}

	// Get media key (stable R2 object path)
	const mediaKey = anchor.media_key;
	if (!mediaKey) {
		return fallbackMediaUrl || null;
	}

	try {
		// Call existing API to get fresh signed URL
		const response = await fetch("/api/media/signed-url", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: mediaKey,
				expiresInSeconds: 3600, // 1 hour
				intent: "playback",
			}),
		});

		if (!response.ok) {
			console.error("Failed to generate signed URL:", response.statusText);
			return fallbackMediaUrl || null;
		}

		const { signedUrl } = await response.json();

		// Append time parameter if we have timing data
		if (signedUrl && anchor.start_ms !== undefined) {
			const startSeconds = Math.floor(anchor.start_ms / 1000);
			return `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}t=${startSeconds}`;
		}

		return signedUrl || fallbackMediaUrl || null;
	} catch (error) {
		console.error("Error generating media URL:", error);
		return fallbackMediaUrl || null;
	}
}
