/**
 * InterviewSourcePanel — right column of the 2-col interview detail layout.
 * Tabbed: Media (player + chapters) | Transcript (lazy-loaded + questions).
 * Evidence list has been removed — access via the Evidence page link in the header.
 */
import { useState } from "react";
import { MediaPlayer } from "~/components/ui/MediaPlayer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { Evidence } from "~/types";
import { deriveMediaFormat } from "../lib/interviewDetailHelpers";
import { InterviewChapters } from "./InterviewChapters";
import { InterviewQuestionsAccordion } from "./InterviewQuestionsAccordion";
import { LazyTranscriptResults } from "./LazyTranscriptResults";

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
	accountId: string;
	projectId: string;
	onSpeakerClick: () => void;
	/** Active source tab from URL state */
	activeSource: string;
	/** Callback to change source tab (updates URL) */
	onSourceChange: (source: string) => void;
}

export function InterviewSourcePanel({
	interview,
	evidence,
	accountId,
	projectId,
	onSpeakerClick,
	activeSource,
	onSourceChange,
}: InterviewSourcePanelProps) {
	const [playbackTime, setPlaybackTime] = useState<number | null>(null);

	const handleChapterClick = (seconds: number | null) => {
		if (seconds !== null) {
			setPlaybackTime(seconds);
		}
	};

	const hasMedia = !!interview.media_url;
	const mediaUrl = interview.media_url;

	return (
		<div className="space-y-4">
			{/* Media player always visible when available */}
			{hasMedia && mediaUrl && (
				<MediaPlayer
					key={`${interview.id}:${mediaUrl}:${interview.thumbnail_url ?? ""}`}
					mediaUrl={mediaUrl}
					thumbnailUrl={interview.thumbnail_url}
					startTime={playbackTime ?? undefined}
					mediaType={deriveMediaFormat(
						interview.file_extension,
						interview.source_type,
						interview.media_type,
						interview.media_url
					)}
					className="w-full"
				/>
			)}

			<Tabs value={activeSource} onValueChange={onSourceChange}>
				<TabsList>
					<TabsTrigger value="media">Chapters</TabsTrigger>
					<TabsTrigger value="transcript">Transcript</TabsTrigger>
				</TabsList>

				<TabsContent value="media" className="space-y-4">
					{evidence.length > 0 ? (
						<InterviewChapters evidence={evidence} onChapterClick={handleChapterClick} />
					) : (
						<div className="rounded-lg border border-dashed p-6 text-center">
							<p className="text-muted-foreground text-sm">Chapters will appear once analysis is complete</p>
						</div>
					)}
				</TabsContent>

				<TabsContent value="transcript" className="space-y-4">
					<LazyTranscriptResults
						key={interview.id}
						interviewId={interview.id}
						hasTranscript={interview.hasTranscript}
						hasFormattedTranscript={interview.hasFormattedTranscript}
						durationSec={interview.duration_sec}
						participants={interview.participants}
						onSpeakerClick={onSpeakerClick}
					/>
					<InterviewQuestionsAccordion interviewId={interview.id} projectId={projectId} accountId={accountId} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
