import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorCode(error: unknown): string | null {
	if (!error || typeof error !== "object") return null;
	const code = (error as { code?: unknown }).code;
	return typeof code === "string" ? code : null;
}

function extractErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object") return "";
	const message = (error as { message?: unknown }).message;
	return typeof message === "string" ? message : "";
}

export function isRetryableSurveyMutationError(error: unknown): boolean {
	const code = extractErrorCode(error);
	if (code && ["40001", "40P01", "55P03", "57014", "08006", "08000", "53300"].includes(code)) {
		return true;
	}

	const message = extractErrorMessage(error).toLowerCase();
	if (!message) return false;
	return [
		"timeout",
		"timed out",
		"temporar",
		"network",
		"connection",
		"rate limit",
		"too many requests",
		"deadlock",
		"could not serialize",
		"service unavailable",
	].some((pattern) => message.includes(pattern));
}

export async function withSurveyMutationRetry<T>(params: {
	operation: string;
	run: () => Promise<T>;
	maxAttempts?: number;
}): Promise<T> {
	const { operation, run, maxAttempts = 2 } = params;
	let attempt = 0;

	while (attempt < maxAttempts) {
		attempt += 1;
		try {
			return await run();
		} catch (error) {
			const retryable = isRetryableSurveyMutationError(error);
			if (!retryable || attempt >= maxAttempts) {
				throw error;
			}
			const waitMs = 120 * 2 ** (attempt - 1);
			consola.warn("survey-mutation: transient failure, retrying", {
				operation,
				attempt,
				maxAttempts,
				waitMs,
				error: extractErrorMessage(error) || String(error),
			});
			await sleep(waitMs);
		}
	}

	// Unreachable, but keeps TypeScript satisfied.
	throw new Error(`Failed ${operation} after ${maxAttempts} attempts`);
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

	const { data: survey, error } = await withSurveyMutationRetry({
		operation: `${toolName}.load-survey`,
		run: async () => {
			const result = await supabase
				.from("research_links")
				.select(select)
				.eq("id", surveyId)
				.eq("project_id", projectId)
				.maybeSingle();
			if (result.error && isRetryableSurveyMutationError(result.error)) {
				throw result.error;
			}
			return result;
		},
	});

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
