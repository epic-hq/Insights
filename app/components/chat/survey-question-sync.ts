import type { UpsightMessage } from "~/mastra/message-types";

export interface SurveyQuestionUpdateDetail {
	surveyId?: string;
	action?: string;
	updatedCount?: number;
}

function normalizeToolName(value: string | undefined): string {
	if (!value) return "";
	return value.replace(/[-_]/g, "").toLowerCase();
}

export function extractSurveyQuestionUpdateDetails(message: UpsightMessage): SurveyQuestionUpdateDetail[] {
	if (!message.parts) return [];

	const updates: SurveyQuestionUpdateDetail[] = [];

	for (const part of message.parts) {
		const anyPart = part as Record<string, unknown>;
		const partType = typeof anyPart.type === "string" ? anyPart.type : undefined;
		const partToolName = typeof anyPart.toolName === "string" ? anyPart.toolName : undefined;
		const toolInvocation =
			anyPart.toolInvocation && typeof anyPart.toolInvocation === "object"
				? (anyPart.toolInvocation as Record<string, unknown>)
				: undefined;
		const invocationToolName =
			typeof toolInvocation?.toolName === "string" ? (toolInvocation.toolName as string) : undefined;
		const inferredToolName = partType?.startsWith("tool-") ? partType.replace(/^tool-/, "") : undefined;
		const normalizedToolName = normalizeToolName(partToolName ?? invocationToolName ?? inferredToolName);
		const partState =
			typeof anyPart.state === "string"
				? anyPart.state
				: typeof toolInvocation?.state === "string"
					? (toolInvocation.state as string)
					: undefined;

		if (normalizedToolName !== "updatesurveyquestions" || partState !== "output-available") continue;

		const outputCandidate =
			anyPart.output ??
			anyPart.result ??
			anyPart.toolResult ??
			toolInvocation?.output ??
			(typeof anyPart.data === "object" ? anyPart.data : null);
		if (!outputCandidate || typeof outputCandidate !== "object") continue;

		const output = outputCandidate as Record<string, unknown>;
		if (output.success !== true) continue;

		const inputCandidate =
			anyPart.input ?? anyPart.args ?? toolInvocation?.input ?? toolInvocation?.args ?? (undefined as unknown);
		const input =
			inputCandidate && typeof inputCandidate === "object" ? (inputCandidate as Record<string, unknown>) : null;

		updates.push({
			surveyId:
				typeof input?.surveyId === "string"
					? input.surveyId
					: typeof output.surveyId === "string"
						? output.surveyId
						: undefined,
			action: typeof input?.action === "string" ? input.action : undefined,
			updatedCount: typeof output.updatedCount === "number" ? output.updatedCount : undefined,
		});
	}

	return updates;
}
