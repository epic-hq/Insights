/**
 * InterviewSourcePanel — right column of the 2-col interview detail layout.
 * Contains: media player, evidence timeline (chapters), transcript, and questions.
 */
import { MediaPlayer } from "~/components/ui/MediaPlayer";
import { PlayByPlayTimeline } from "~/features/evidence/components/ChronologicalEvidenceList";
import type { Evidence } from "~/types";
import { InterviewQuestionsAccordion } from "./InterviewQuestionsAccordion";
import { LazyTranscriptResults } from "./LazyTranscriptResults";

// Derive media format from file extension and source type
const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "flac",
  "wma",
  "webm",
];
const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "m4v"];

function deriveMediaFormat(
  fileExtension: string | null | undefined,
  sourceType: string | null | undefined,
  mediaType: string | null | undefined,
): "audio" | "video" | null {
  if (fileExtension) {
    const ext = fileExtension.toLowerCase().replace(/^\./, "");
    if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
    if (VIDEO_EXTENSIONS.includes(ext)) return "video";
    if (ext === "webm") {
      if (sourceType === "audio_upload" || sourceType === "audio_url")
        return "audio";
      if (sourceType === "video_upload" || sourceType === "video_url")
        return "video";
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
}

export function InterviewSourcePanel({
  interview,
  evidence,
  accountId,
  projectId,
  onSpeakerClick,
}: InterviewSourcePanelProps) {
  return (
    <div className="space-y-6">
      {/* Media Player */}
      {interview.media_url && (
        <div>
          <MediaPlayer
            mediaUrl={interview.media_url}
            thumbnailUrl={interview.thumbnail_url}
            mediaType={deriveMediaFormat(
              interview.file_extension,
              interview.source_type,
              interview.media_type,
            )}
            className="w-full"
          />
        </div>
      )}

      {/* Evidence Timeline (Chapters) */}
      {evidence.length > 0 && <PlayByPlayTimeline evidence={evidence} />}

      {/* Transcript */}
      <div>
        <h3 className="mb-3 font-semibold text-foreground text-lg">
          Transcript
        </h3>
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
      <InterviewQuestionsAccordion
        interviewId={interview.id}
        projectId={projectId}
        accountId={accountId}
      />
    </div>
  );
}
