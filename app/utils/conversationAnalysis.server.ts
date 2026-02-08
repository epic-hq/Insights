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

/**
 * Calls the BAML-powered analyzer and normalises the result so downstream storage/UI
 * can rely on consistent confidence ranges and non-null arrays.
 */
export type ConversationContext = z.infer<typeof conversationContextSchema>;

export async function generateConversationAnalysis({
	transcript,
	context,
}: {
	transcript: string;
	context?: ConversationContext;
}): Promise<ConversationAnalysis> {
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
		})),
		open_questions: parsed.open_questions ?? [],
		recommended_next_steps: parsed.recommended_next_steps,
	};
}
