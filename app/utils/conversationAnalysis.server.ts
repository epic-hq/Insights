import { b } from "baml_client";
import consola from "consola";
import { z } from "zod";
import { type ConversationAnalysis, conversationAnalysisSchema } from "~/lib/conversation-analyses/schema";

export const conversationContextSchema = z
	.object({
		meetingTitle: z.string().optional(),
		attendees: z.array(z.string().min(1)).optional(),
		notes: z.string().optional(),
	})
	.partial();

const clamp = (value: number | null | undefined) => {
	if (typeof value !== "number" || Number.isNaN(value)) return null;
	if (value < 0) return 0;
	if (value > 1) return 1;
	return Number(value.toFixed(2));
};

function buildContextString(context: ConversationContext | undefined) {
	if (!context) return "";

	const parts: string[] = [];
	if (context.meetingTitle) parts.push(`Title: ${context.meetingTitle}`);
	if (context.attendees?.length) parts.push(`Participants: ${context.attendees.join(", ")}`);
	if (context.notes) parts.push(`Notes: ${context.notes}`);
	return parts.join("\n");
}

export type ConversationAnalysisEvidenceRecord = {
	id: string;
	verbatim: string | null;
	gist: string | null;
};

function scoreSnippetAgainstEvidence(snippetLower: string, evidence: ConversationAnalysisEvidenceRecord): number {
	const verbatim = (evidence.verbatim || "").toLowerCase();
	const gist = (evidence.gist || "").toLowerCase();
	if (!snippetLower) return 0;

	if (verbatim.includes(snippetLower)) return snippetLower.length;
	if (snippetLower.includes(verbatim) && verbatim.length > 20) return verbatim.length;
	if (gist.includes(snippetLower)) return snippetLower.length * 0.8;
	return 0;
}

function pickBestEvidenceIdForSnippet(
	snippet: string,
	evidence: ConversationAnalysisEvidenceRecord[]
): string | undefined {
	const snippetLower = snippet.toLowerCase().trim();
	if (!snippetLower) return undefined;

	let bestId: string | undefined;
	let bestScore = 0;
	for (const candidate of evidence) {
		const score = scoreSnippetAgainstEvidence(snippetLower, candidate);
		if (score > bestScore) {
			bestScore = score;
			bestId = candidate.id;
		}
	}
	return bestId;
}

export function enrichConversationAnalysisWithEvidenceIds(
	analysis: ConversationAnalysis,
	evidence: ConversationAnalysisEvidenceRecord[]
): ConversationAnalysis {
	const normalizedEvidence = evidence.filter(
		(item): item is ConversationAnalysisEvidenceRecord =>
			!!item && typeof item.id === "string" && item.id.trim().length > 0
	);

	if (!analysis.key_takeaways.length) {
		return analysis;
	}

	const validEvidenceIds = new Set(normalizedEvidence.map((item) => item.id));

	return {
		...analysis,
		key_takeaways: analysis.key_takeaways.map((takeaway) => {
			const existingIds = Array.isArray(takeaway.supporting_evidence_ids)
				? takeaway.supporting_evidence_ids.filter(
						(id): id is string =>
							typeof id === "string" &&
							id.trim().length > 0 &&
							(validEvidenceIds.size === 0 || validEvidenceIds.has(id))
					)
				: [];

			const supportingEvidenceIds: string[] = [...new Set(existingIds)];
			if (supportingEvidenceIds.length || !normalizedEvidence.length || !takeaway.evidence_snippets.length) {
				return {
					...takeaway,
					supporting_evidence_ids: supportingEvidenceIds,
				};
			}

			for (const snippet of takeaway.evidence_snippets) {
				const matchedEvidenceId = pickBestEvidenceIdForSnippet(snippet, normalizedEvidence);
				if (matchedEvidenceId && !supportingEvidenceIds.includes(matchedEvidenceId)) {
					supportingEvidenceIds.push(matchedEvidenceId);
				}
			}

			return {
				...takeaway,
				supporting_evidence_ids: supportingEvidenceIds,
			};
		}),
	};
}

/**
 * Calls the BAML-powered analyzer and normalises the result so downstream storage/UI
 * can rely on consistent confidence ranges and non-null arrays.
 */
export type ConversationContext = z.infer<typeof conversationContextSchema>;

const MIN_TRANSCRIPT_LENGTH = 200;

export async function generateConversationAnalysis({
	transcript,
	context,
}: {
	transcript: string;
	context?: ConversationContext;
}): Promise<ConversationAnalysis> {
	if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
		consola.warn(
			`[conversationAnalysis] Transcript too short (${transcript.length} chars < ${MIN_TRANSCRIPT_LENGTH}), returning minimal analysis`
		);
		return {
			overview: transcript.trim() || "Transcript too short for meaningful analysis.",
			duration_estimate: null,
			questions: [],
			participant_goals: [],
			key_takeaways: [],
			open_questions: [],
			recommended_next_steps: [],
		};
	}

	const sanitizedContext = conversationContextSchema.parse(context ?? {});
	const contextString = buildContextString(sanitizedContext);

	consola.log("Triggering BAML conversation analysis", {
		hasContext: Boolean(contextString.length),
		transcriptCharacters: transcript.length,
	});

	const raw = await b.AnalyzeStandaloneConversation(transcript, contextString);
	const parsed = conversationAnalysisSchema.parse(raw);

	return {
		...parsed,
		questions: parsed.questions.map((question) => ({
			...question,
			asked_by: question.asked_by ?? null,
			intent: question.intent ?? null,
			evidence_snippet: question.evidence_snippet ?? null,
			confidence: clamp(question.confidence),
		})),
		participant_goals: parsed.participant_goals.map((goal) => ({
			...goal,
			speaker: goal.speaker ?? null,
			evidence_snippet: goal.evidence_snippet ?? null,
			confidence: clamp(goal.confidence),
		})),
		key_takeaways: parsed.key_takeaways.map((takeaway) => ({
			...takeaway,
			evidence_snippets: takeaway.evidence_snippets ?? [],
			supporting_evidence_ids: takeaway.supporting_evidence_ids ?? [],
		})),
		open_questions: parsed.open_questions ?? [],
		recommended_next_steps: parsed.recommended_next_steps,
	};
}
