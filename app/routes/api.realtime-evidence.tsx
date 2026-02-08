/**
 * API endpoint for real-time evidence extraction from transcript segments.
 * Accepts a batch of speaker utterances and returns extracted evidence turns
 * using the BAML ExtractEvidenceFromTranscriptV2 function.
 */
import { b } from "baml_client";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { DEFAULT_FACET_KINDS } from "~/features/realtime-transcription/shared/facetKinds";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const body = await request.json();
		const { utterances, language } = body as {
			utterances: Array<{ speaker: string; text: string; start?: number; end?: number }>;
			language?: string;
		};

		if (!utterances?.length) {
			return Response.json({ error: "No utterances provided" }, { status: 400 });
		}

		consola.info(`[realtime-evidence] Extracting from ${utterances.length} utterances`);

		const result = await b.ExtractEvidenceFromTranscriptV2(
			utterances.map((u) => ({
				speaker: u.speaker,
				text: u.text,
				start: u.start ?? null,
				end: u.end ?? null,
			})),
			[], // no chapters for realtime
			language || "en",
			{ kinds: DEFAULT_FACET_KINDS, facets: [], version: "realtime-proto" }
		);

		consola.info(`[realtime-evidence] Extracted ${result.evidence?.length || 0} evidence turns`);

		return Response.json({
			evidence: result.evidence || [],
			people: result.people || [],
			scenes: result.scenes || [],
			interactionContext: result.interaction_context,
			contextConfidence: result.context_confidence,
			contextReasoning: result.context_reasoning,
		});
	} catch (error: any) {
		consola.error("[realtime-evidence] Extraction failed:", error);
		return Response.json({ error: error?.message || "Evidence extraction failed" }, { status: 500 });
	}
}
