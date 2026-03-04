import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProjectContext, validateUUID } from "./context-utils";

type RequestContextLike = {
	requestContext?: {
		get?: (key: string) => unknown;
	};
};

export type SurveyMutationTargetRow = {
	id: string;
	project_id?: string | null;
	account_id?: string | null;
	name?: string | null;
	questions?: unknown;
	[key: string]: unknown;
};

export type ResolveBoundSurveyTargetOptions = {
	context: RequestContextLike | undefined;
	toolName: string;
	supabase: SupabaseClient<any, "public", any>;
	surveyIdInput?: unknown;
	select: string;
};

export function toNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function canonicalizeJson(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => canonicalizeJson(item));
	}
	if (value && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, entryValue]) => entryValue !== undefined)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, entryValue]) => [key, canonicalizeJson(entryValue)]);
		return Object.fromEntries(entries);
	}
	return value;
}

export function areCanonicallyEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(canonicalizeJson(left)) === JSON.stringify(canonicalizeJson(right));
}

export function asQuestionArray(value: unknown): Array<Record<string, unknown>> {
	return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

export async function resolveBoundSurveyTarget(options: ResolveBoundSurveyTargetOptions): Promise<{
	survey: SurveyMutationTargetRow;
	surveyId: string;
	projectId: string;
	accountId: string;
	activeSurveyId: string | null;
}> {
	const { context, toolName, supabase, surveyIdInput, select } = options;
	const { projectId, accountId } = await resolveProjectContext(context, toolName);

	const activeSurveyId = validateUUID(context?.requestContext?.get?.("survey_id"), "context.survey_id", toolName);
	const inputSurveyId = validateUUID(surveyIdInput, "surveyId", toolName);

	if (activeSurveyId && inputSurveyId && activeSurveyId !== inputSurveyId) {
		throw new Error(
			`Survey context mismatch. Active survey is ${activeSurveyId}, but request targeted ${inputSurveyId}. Re-run from the current survey canvas.`
		);
	}

	const surveyId = activeSurveyId ?? inputSurveyId;
	if (!surveyId) {
		throw new Error("Missing surveyId. Open a survey canvas or provide a valid surveyId.");
	}

	const { data: survey, error } = await supabase
		.from("research_links")
		.select(select)
		.eq("id", surveyId)
		.eq("project_id", projectId)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to load survey ${surveyId}: ${error.message}`);
	}
	if (!survey) {
		throw new Error(`Survey ${surveyId} not found in the current project context.`);
	}

	const surveyRecord = survey as unknown as SurveyMutationTargetRow;
	const surveyAccountId = toNonEmptyString(surveyRecord.account_id);
	if (surveyAccountId && surveyAccountId !== accountId) {
		throw new Error(
			`Survey account mismatch. Survey belongs to account ${surveyAccountId}, but active project belongs to ${accountId}.`
		);
	}

	return {
		survey: surveyRecord,
		surveyId,
		projectId,
		accountId,
		activeSurveyId,
	};
}
