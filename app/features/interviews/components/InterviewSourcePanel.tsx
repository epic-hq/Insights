/**
 * InterviewSourcePanel — right column of the 2-col interview detail layout.
 * Contains: media player, evidence timeline (chapters), transcript, and questions.
 * Evidence items include "Verify" affordance that opens the verification drawer.
 */
import { Clock, Eye, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
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
}

export function InterviewSourcePanel({
	interview,
	evidence,
	evidenceVoteCounts,
	accountId,
	projectId,
	onSpeakerClick,
	onEvidenceSelect,
}: InterviewSourcePanelProps) {
	const [playbackTime, setPlaybackTime] = useState<number | null>(null);

	const handleChapterClick = (seconds: number | null) => {
		if (seconds !== null) {
			setPlaybackTime(seconds);
		}
	};

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

			{/* Evidence items with verification affordance */}
			{evidence.length > 0 && onEvidenceSelect && (
				<div className="space-y-2">
					<h3 className="font-semibold text-foreground text-lg">Evidence ({evidence.length})</h3>
					<div className="max-h-[400px] space-y-1.5 overflow-y-auto">
						{evidence.slice(0, 50).map((item) => {
							const seconds = extractAnchorSeconds(item.anchors);
							const votes = evidenceVoteCounts?.[item.id];
							const hasVotes = votes && (votes.upvotes > 0 || votes.downvotes > 0);
							return (
								<button
									key={item.id}
									id={`evidence-${item.id}`}
									type="button"
									onClick={() => onEvidenceSelect(item.id)}
									className="group flex w-full scroll-mt-4 items-start gap-2 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/40"
								>
									<div className="min-w-0 flex-1">
										<p className="line-clamp-2 text-foreground text-sm">{item.gist || item.verbatim || "Evidence"}</p>
										<div className="mt-1 flex items-center gap-2">
											{item.topic && (
												<Badge variant="outline" className="text-[10px] leading-tight">
													{item.topic}
												</Badge>
											)}
											{seconds !== null && (
												<span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
													<Clock className="h-2.5 w-2.5" />
													{formatTimestamp(seconds)}
												</span>
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
									</div>
									<Eye
										className={cn(
											"mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-primary"
										)}
									/>
								</button>
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
