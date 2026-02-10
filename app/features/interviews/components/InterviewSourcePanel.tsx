/**
 * InterviewSourcePanel — right column of the 2-col interview detail layout.
 * Contains: media player, evidence timeline (chapters), transcript, and questions.
 * Evidence items include "Verify" affordance that opens the verification drawer.
 */
import { ArrowRight, Clock, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { MediaPlayer } from "~/components/ui/MediaPlayer";
import type { VoteCounts } from "~/features/annotations/db";
import { cn } from "~/lib/utils";
import type { Evidence } from "~/types";
import { InterviewChapters } from "./InterviewChapters";
import { InterviewQuestionsAccordion } from "./InterviewQuestionsAccordion";
import { LazyTranscriptResults } from "./LazyTranscriptResults";

// Derive media format from file extension and source type
const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "flac", "wma", "webm"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "m4v"];

function deriveMediaFormat(
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

function extractAnchorSeconds(anchors: unknown): number | null {
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

function formatTimestamp(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Participant {
	id: number;
	role: string | null;
	transcript_key: string | null;
	display_name: string | null;
	people?: {
		id?: string;
		name?: string | null;
	};
}

interface InterviewSourcePanelProps {
	interview: {
		id: string;
		media_url: string | null;
		thumbnail_url?: string | null;
		file_extension?: string | null;
		source_type?: string | null;
		media_type?: string | null;
		hasTranscript?: boolean;
		hasFormattedTranscript?: boolean;
		duration_sec: number | null;
		participants: Participant[];
	};
	evidence: Evidence[];
	/** Pre-fetched vote counts keyed by evidence ID */
	evidenceVoteCounts?: Record<string, VoteCounts>;
	accountId: string;
	projectId: string;
	onSpeakerClick: () => void;
	/** Called when user clicks "Verify" on an evidence item */
	onEvidenceSelect?: (evidenceId: string) => void;
	/** Evidence ID to scroll to and highlight (from Key Insights "See source") */
	highlightedEvidenceId?: string | null;
	/** Callback to clear the highlight (called after animation completes) */
	onClearHighlight?: () => void;
}

export function InterviewSourcePanel({
	interview,
	evidence,
	evidenceVoteCounts,
	accountId,
	projectId,
	onSpeakerClick,
	onEvidenceSelect,
	highlightedEvidenceId,
	onClearHighlight,
}: InterviewSourcePanelProps) {
	const [playbackTime, setPlaybackTime] = useState<number | null>(null);

	const handleChapterClick = (seconds: number | null) => {
		if (seconds !== null) {
			setPlaybackTime(seconds);
		}
	};

	useEffect(() => {
		if (!highlightedEvidenceId) return;

		// Wait for React to render the element, then scroll
		const timer = setTimeout(() => {
			const el = document.getElementById(`evidence-${highlightedEvidenceId}`);
			if (el) {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		}, 50);

		const clearTimer = setTimeout(() => {
			onClearHighlight?.();
		}, 2500);

		return () => {
			clearTimeout(timer);
			clearTimeout(clearTimer);
		};
	}, [highlightedEvidenceId, onClearHighlight]);

	return (
		<div className="space-y-6">
			{/* Media Player */}
			{interview.media_url && (
				<div>
					<MediaPlayer
						mediaUrl={interview.media_url}
						thumbnailUrl={interview.thumbnail_url}
						startTime={playbackTime ?? undefined}
						mediaType={deriveMediaFormat(interview.file_extension, interview.source_type, interview.media_type)}
						className="w-full"
					/>
				</div>
			)}

			{/* Evidence Timeline (Chapters) */}
			{evidence.length > 0 && <InterviewChapters evidence={evidence} onChapterClick={handleChapterClick} />}

			{/* Evidence items with quotes and verification */}
			{evidence.length > 0 && onEvidenceSelect && (
				<div className="space-y-3">
					<h3 className="font-semibold text-base text-foreground">Evidence ({evidence.length})</h3>
					<div className="max-h-[600px] space-y-2 overflow-y-auto">
						{evidence.slice(0, 50).map((item) => {
							const seconds = extractAnchorSeconds(item.anchors);
							const votes = evidenceVoteCounts?.[item.id];
							const hasVotes = votes && (votes.upvotes > 0 || votes.downvotes > 0);
							const isHighlighted = highlightedEvidenceId === item.id;

							return (
								<div
									key={item.id}
									id={`evidence-${item.id}`}
									className={cn(
										"scroll-mt-4 rounded-lg border p-3 transition-all duration-500",
										isHighlighted
											? "border-primary bg-primary/10 ring-1 ring-primary/30"
											: "border-border bg-card hover:border-muted-foreground/30"
									)}
								>
									{/* Gist / summary */}
									<p className="mb-2 text-foreground text-sm leading-relaxed">{item.gist || "Evidence"}</p>

									{/* Verbatim quote */}
									{item.verbatim && (
										<blockquote className="mb-2 rounded-r border-l-[3px] border-l-primary/60 bg-muted/30 px-3 py-2 text-muted-foreground text-sm italic leading-relaxed">
											{item.verbatim.length > 200 ? `${item.verbatim.slice(0, 200)}…` : item.verbatim}
										</blockquote>
									)}

									{/* Footer: topic, timestamp, votes, verify link */}
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											{item.topic && (
												<Badge variant="outline" className="text-[10px] leading-tight">
													{item.topic}
												</Badge>
											)}
											{seconds !== null && (
												<button
													type="button"
													onClick={() => handleChapterClick(seconds)}
													className="flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
												>
													<Clock className="h-3 w-3" />
													{formatTimestamp(seconds)}
												</button>
											)}
											{hasVotes && (
												<span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
													{votes.upvotes > 0 && (
														<span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
															<ThumbsUp className="h-2.5 w-2.5" />
															{votes.upvotes}
														</span>
													)}
													{votes.downvotes > 0 && (
														<span className="flex items-center gap-0.5 text-red-500 dark:text-red-400">
															<ThumbsDown className="h-2.5 w-2.5" />
															{votes.downvotes}
														</span>
													)}
												</span>
											)}
										</div>
										<button
											type="button"
											onClick={() => onEvidenceSelect(item.id)}
											className="inline-flex items-center gap-1 font-medium text-primary text-xs transition-colors hover:text-primary/80"
										>
											View evidence
											<ArrowRight className="h-3 w-3" />
										</button>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Transcript */}
			<div>
				<h3 className="mb-3 font-semibold text-foreground text-lg">Transcript</h3>
				<LazyTranscriptResults
					interviewId={interview.id}
					hasTranscript={interview.hasTranscript}
					hasFormattedTranscript={interview.hasFormattedTranscript}
					durationSec={interview.duration_sec}
					participants={interview.participants}
					onSpeakerClick={onSpeakerClick}
				/>
			</div>

			{/* Questions Asked */}
			<InterviewQuestionsAccordion interviewId={interview.id} projectId={projectId} accountId={accountId} />
		</div>
	);
}
