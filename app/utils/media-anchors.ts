/**
 * Shared media anchor types and pure utility functions.
 * Safe for both server and client (no browser APIs).
 */

export interface MediaAnchor {
	start_ms?: number;
	end_ms?: number;
	media_key?: string;
	chapter_title?: string;
	char_span?: any;
	// Legacy fields (for backwards compatibility)
	target?: string;
	start_seconds?: number;
}

/**
 * Get start time in seconds from anchor
 */
export function getAnchorStartSeconds(anchor: MediaAnchor): number {
	if (anchor.start_ms !== undefined) {
		return Math.floor(anchor.start_ms / 1000);
	}
	if (anchor.start_seconds !== undefined) {
		return anchor.start_seconds;
	}
	return 0;
}
