/**
 * Extracts unique speaker keys from a transcript_formatted structure
 * and generates human-readable labels (e.g. "participant-0" -> "Speaker A").
 */
import { useMemo } from "react";

export type TranscriptSpeaker = { key: string; label: string };

export function useTranscriptSpeakers(
  transcriptFormatted: unknown,
): TranscriptSpeaker[] {
  return useMemo(() => {
    const transcriptData = transcriptFormatted as
      | {
          utterances?: Array<{ speaker: string }>;
          speaker_transcripts?: Array<{ speaker: string }>;
        }
      | null
      | undefined;

    const utterances =
      (Array.isArray(transcriptData?.utterances) &&
        transcriptData.utterances) ||
      (Array.isArray(transcriptData?.speaker_transcripts) &&
        transcriptData.speaker_transcripts) ||
      [];

    if (!utterances.length) return [];

    const uniqueSpeakers = new Set<string>();
    for (const utterance of utterances) {
      if (utterance.speaker) {
        uniqueSpeakers.add(utterance.speaker);
      }
    }

    return Array.from(uniqueSpeakers).map((key) => {
      let label = key;
      if (/^participant-\d+$/i.test(key)) {
        const num = Number.parseInt(key.split("-")[1], 10);
        const letter = String.fromCharCode(65 + num);
        label = `Speaker ${letter}`;
      } else if (/^[A-Z]$/i.test(key)) {
        label = `Speaker ${key.toUpperCase()}`;
      } else if (/^speaker[\s_-]?(\d+)$/i.test(key)) {
        const match = key.match(/(\d+)/);
        if (match) {
          const num = Number.parseInt(match[1], 10);
          const letter = String.fromCharCode(64 + num);
          label = `Speaker ${letter}`;
        }
      }
      return { key, label };
    });
  }, [transcriptFormatted]);
}
