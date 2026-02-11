/**
 * Pure helper functions extracted from the interview detail page for testability.
 * These handle data transformation, media format detection, and evidence matching.
 */

// --- Name parsing ---

export function parseFullName(fullName: string): {
	firstname: string;
	lastname: string | null;
} {
	const trimmed = fullName.trim();
	if (!trimmed) return { firstname: "", lastname: null };
	const parts = trimmed.split(/\s+/);
	if (parts.length === 1) {
		return { firstname: parts[0], lastname: null };
	}
	return {
		firstname: parts[0],
		lastname: parts.slice(1).join(" "),
	};
}

// --- Text normalization ---

export function normalizeMultilineText(value: unknown): string {
	try {
		if (Array.isArray(value)) {
			const lines = value.filter((v) => typeof v === "string" && v.trim()) as string[];
			return lines
				.map((line) => {
					const t = (typeof line === "string" ? line : String(line)).trim();
					if (/^([-*+]|\d+\.)\s+/.test(t)) return t;
					return `- ${t}`;
				})
				.join("\n");
		}
		if (typeof value === "string") {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) {
				const lines = parsed.filter((v) => typeof v === "string" && v.trim()) as string[];
				return lines
					.map((line) => {
						const t = (typeof line === "string" ? line : String(line)).trim();
						if (/^([-*+]|\d+\.)\s+/.test(t)) return t;
						return `- ${t}`;
					})
					.join("\n");
			}
			return value;
		}
		return "";
	} catch {
		return typeof value === "string" ? value : "";
	}
}

// --- Media format detection ---

const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "flac", "wma"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "m4v"];

export function deriveMediaFormat(
	fileExtension: string | null | undefined,
	sourceType: string | null | undefined,
	mediaType: string | null | undefined
): "audio" | "video" | null {
	if (fileExtension) {
		const ext = fileExtension.toLowerCase().replace(/^\./, "");
		if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
		if (VIDEO_EXTENSIONS.includes(ext)) return "video";
		if (ext === "webm") {
			if (sourceType === "audio_upload" || sourceType === "audio_url") return "audio";
			if (sourceType === "video_upload" || sourceType === "video_url") return "video";
			return "video";
		}
	}
	if (sourceType) {
		if (sourceType.includes("audio")) return "audio";
		if (sourceType.includes("video")) return "video";
		if (sourceType === "recall") return "video";
		if (sourceType === "realtime_recording") return "video";
	}
	if (mediaType === "voice_memo") return "audio";
	return null;
}

// --- Analysis extraction ---

export interface AnalysisJobSummary {
	id: string;
	status: string | null;
	status_detail: string | null;
	progress: number | null;
	trigger_run_id: string | null;
	created_at: string | null;
	updated_at: string | null;
}

export function extractAnalysisFromInterview(interview: {
	id: string;
	conversation_analysis: unknown;
	processing_metadata?: unknown;
	created_at: string | null;
	updated_at: string | null;
}): AnalysisJobSummary | null {
	const metadata =
		((interview.processing_metadata as Record<string, unknown> | null) ??
			(interview.conversation_analysis as Record<string, unknown> | null)) ||
		null;
	if (!metadata) return null;

	return {
		id: interview.id,
		status: (metadata.status as string) || null,
		status_detail: (metadata.status_detail as string) || null,
		progress: (metadata.progress as number) || null,
		trigger_run_id: (metadata.trigger_run_id as string) || null,
		created_at: interview.created_at,
		updated_at: interview.updated_at,
	};
}

// --- Evidence-to-takeaway snippet matching ---

export interface KeyTakeaway {
	priority: "high" | "medium" | "low";
	summary: string;
	evidenceSnippets: string[];
	evidenceId?: string;
}

export interface EvidenceRecord {
	id: string;
	verbatim: string | null;
	gist: string | null;
}

export function matchTakeawaysToEvidence(takeaways: KeyTakeaway[], evidence: EvidenceRecord[]): void {
	for (const takeaway of takeaways) {
		if (takeaway.evidenceId) continue; // already matched
		if (!takeaway.evidenceSnippets?.length) continue;

		let bestMatch: string | undefined;
		let bestScore = 0;
		for (const snippet of takeaway.evidenceSnippets) {
			const snippetLower = snippet.toLowerCase();
			for (const ev of evidence) {
				const verbatim = (ev.verbatim || "").toLowerCase();
				const gist = (ev.gist || "").toLowerCase();
				const score = verbatim.includes(snippetLower)
					? snippetLower.length
					: snippetLower.includes(verbatim) && verbatim.length > 20
						? verbatim.length
						: gist.includes(snippetLower)
							? snippetLower.length * 0.8
							: 0;
				if (score > bestScore) {
					bestScore = score;
					bestMatch = ev.id;
				}
			}
		}
		if (bestMatch) {
			takeaway.evidenceId = bestMatch;
		}
	}
}

// --- Source panel helpers ---

export function extractAnchorSeconds(anchors: unknown): number | null {
	const arr = Array.isArray(anchors) ? (anchors as Array<Record<string, unknown>>) : [];
	const anchor = arr.find((a) => a && typeof a === "object");
	if (!anchor) return null;

	const rawStart =
		(anchor.start_ms as number) ??
		(anchor.startMs as number) ??
		(anchor.start_seconds as number) ??
		(anchor.startSeconds as number) ??
		(anchor.start_sec as number) ??
		(anchor.start as number) ??
		(anchor.start_time as number);

	if (typeof rawStart === "number" && Number.isFinite(rawStart)) {
		return rawStart > 500 ? rawStart / 1000 : rawStart;
	}
	return null;
}

export function formatTimestamp(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

// --- Focus area color (from InterviewRecommendations) ---

export function getFocusAreaColor(focusArea: string): string {
	const lower = focusArea.toLowerCase();
	if (lower.includes("product")) return "bg-blue-500/10 text-blue-600";
	if (lower.includes("partner")) return "bg-emerald-500/10 text-emerald-600";
	if (lower.includes("research")) return "bg-purple-500/10 text-purple-600";
	if (lower.includes("sales")) return "bg-amber-500/10 text-amber-600";
	return "bg-primary/10 text-primary";
}
