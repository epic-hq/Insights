import type { Chapter, Extraction, SpeakerUtterance } from "baml";
import { b } from "baml";

export type EvidenceCallArgs = {
	speaker_transcripts: SpeakerUtterance[];
	chapters: Chapter[];
	language: string;
};

export type StreamOptions = {
	signal?: AbortSignal;
	onTick?: (reason: string, log: unknown | null) => void;
};

// Primitive wrapper to generate/stream Evidence extraction results.
export async function generateEvidence(args: EvidenceCallArgs, opts: StreamOptions = {}): Promise<Extraction> {
	const { speaker_transcripts, chapters, language } = args;
	return b.ExtractEvidenceFromTranscriptV2(speaker_transcripts, chapters, language, {
		signal: opts.signal,
		onTick: opts.onTick,
	});
}
