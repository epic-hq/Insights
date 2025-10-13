import type { Chapter, Extraction, FacetCatalog } from "baml"
import { b } from "baml"

export type EvidenceCallArgs = {
	transcript: string
	chapters: Chapter[]
	language: string
	facet_catalog: FacetCatalog
}

export type StreamOptions = {
	signal?: AbortSignal
	onTick?: (reason: string, log: unknown | null) => void
}

// Primitive wrapper to generate/stream Evidence extraction results.
export async function generateEvidence(args: EvidenceCallArgs, opts: StreamOptions = {}): Promise<Extraction> {
	const { transcript, chapters, language, facet_catalog } = args
	return b.ExtractEvidenceFromTranscriptV2(transcript, chapters, language, facet_catalog, {
		signal: opts.signal,
		onTick: opts.onTick,
	})
}
