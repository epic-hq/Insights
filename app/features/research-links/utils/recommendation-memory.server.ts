import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/types";
import type { ProjectResearchContext } from "../db";
import type { Recommendation, RecommendationHistoryEntry, RecommendationResponse } from "./recommendation-rules";

const NEXT_ACTION_SUGGESTION_TYPE = "next_action";

type JsonObject = Record<string, unknown>;

function asRecord(value: unknown): JsonObject {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toResponse(value: unknown): RecommendationResponse | null {
	if (value === "accepted" || value === "declined" || value === "deferred") return value;
	return null;
}

export function buildRecommendationStateSignature(context: ProjectResearchContext): string {
	const topThemeSignature = context.themes
		.slice(0, 5)
		.map((theme) => `${theme.id}:${theme.evidence_count}`)
		.join("|");

	return JSON.stringify({
		hasGoals: context.hasGoals,
		interviewCount: context.interviewCount,
		surveyCount: context.surveyCount,
		themeCount: context.themes.length,
		peopleNeedingSegments: context.dataQuality.peopleNeedingSegments,
		topThemeSignature,
	});
}

export async function fetchRecommendationHistory({
	supabase,
	projectId,
	limit = 40,
}: {
	supabase: SupabaseClient<Database>;
	projectId: string;
	limit?: number;
}): Promise<RecommendationHistoryEntry[]> {
	const { data, error } = await supabase
		.from("annotations")
		.select("id, created_at, status, content_jsonb, metadata")
		.eq("project_id", projectId)
		.eq("entity_type", "project")
		.eq("annotation_type", "ai_suggestion")
		.eq("metadata->>suggestion_type", NEXT_ACTION_SUGGESTION_TYPE)
		.order("created_at", { ascending: false })
		.limit(limit);

	if (error) {
		consola.warn("recommendation-memory: failed to load history", {
			projectId,
			error: error.message,
		});
		return [];
	}

	const history: RecommendationHistoryEntry[] = [];
	for (const row of data ?? []) {
		const content = asRecord(row.content_jsonb);
		const metadata = asRecord(row.metadata);
		const projectState = asRecord(content.project_state);

		const recommendationId = asString(content.recommendation_id) ?? asString(metadata.recommendation_id);
		if (!recommendationId) continue;

		const response = toResponse(content.response) ?? toResponse(row.status);
		const actionType = asString(content.action_type) as Recommendation["actionType"] | null;
		const interviewCount = asNumber(projectState.interview_count);
		const surveyCount = asNumber(projectState.survey_count);
		const themeCount = asNumber(projectState.theme_count);

		history.push({
			annotationId: row.id,
			recommendationId,
			title: asString(content.title),
			actionType,
			response,
			respondedAt: asString(content.responded_at),
			createdAt: row.created_at,
			navigateTo: asString(content.navigate_to),
			stateSignature: asString(content.state_signature) ?? asString(metadata.state_signature),
			batchId: asString(content.recommendation_batch_id) ?? asString(metadata.batch_id),
			projectState: {
				interviewCount: interviewCount ?? 0,
				surveyCount: surveyCount ?? 0,
				themeCount: themeCount ?? 0,
				hasGoals: Boolean(projectState.has_goals),
			},
		});
	}

	return history;
}

export async function createRecommendationBatchAnnotations({
	supabase,
	accountId,
	projectId,
	userId,
	threadId,
	stage,
	stateSignature,
	batchId,
	recommendations,
	context,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
	userId?: string | null;
	threadId?: string | null;
	stage: string;
	stateSignature: string;
	batchId: string;
	recommendations: Recommendation[];
	context: ProjectResearchContext;
}): Promise<Map<string, string>> {
	if (!accountId || recommendations.length === 0) return new Map();

	const projectStateSnapshot = {
		has_goals: context.hasGoals,
		interview_count: context.interviewCount,
		survey_count: context.surveyCount,
		theme_count: context.themes.length,
	};

	const annotations = recommendations.map((recommendation, index) => ({
		account_id: accountId,
		project_id: projectId,
		entity_type: "project",
		entity_id: projectId,
		annotation_type: "ai_suggestion",
		content: recommendation.title,
		content_jsonb: {
			recommendation_id: recommendation.id,
			title: recommendation.title,
			description: recommendation.description,
			reasoning: recommendation.reasoning,
			action_type: recommendation.actionType,
			navigate_to: recommendation.navigateTo ?? null,
			focus_theme: recommendation.focusTheme ?? null,
			priority: recommendation.priority,
			project_stage: stage,
			project_state: projectStateSnapshot,
			state_signature: stateSignature,
			recommendation_batch_id: batchId,
			chat_thread_id: threadId ?? null,
			response: null,
			responded_at: null,
		},
		metadata: {
			suggestion_type: NEXT_ACTION_SUGGESTION_TYPE,
			recommendation_id: recommendation.id,
			batch_id: batchId,
			batch_position: index + 1,
			batch_size: recommendations.length,
			state_signature: stateSignature,
		},
		status: "pending",
		created_by_ai: true,
		ai_model: "chief-of-staff",
		created_by_user_id: userId ?? null,
	}));

	const { data, error } = await supabase.from("annotations").insert(annotations).select("id, content_jsonb, metadata");

	if (error) {
		consola.warn("recommendation-memory: failed to write annotations", {
			projectId,
			error: error.message,
		});
		return new Map();
	}

	const annotationIdsByRecommendationId = new Map<string, string>();
	for (const row of data ?? []) {
		const content = asRecord(row.content_jsonb);
		const metadata = asRecord(row.metadata);
		const recommendationId = asString(content.recommendation_id) ?? asString(metadata.recommendation_id);
		if (!recommendationId) continue;
		annotationIdsByRecommendationId.set(recommendationId, row.id);
	}

	return annotationIdsByRecommendationId;
}

async function upsertRecommendationVote({
	supabase,
	accountId,
	projectId,
	annotationId,
	userId,
	response,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
	annotationId: string;
	userId: string;
	response: RecommendationResponse;
}) {
	await supabase
		.from("votes")
		.delete()
		.eq("project_id", projectId)
		.eq("entity_type", "project")
		.eq("entity_id", annotationId)
		.eq("user_id", userId);

	if (response === "deferred") return;

	const voteValue = response === "accepted" ? 1 : -1;
	await supabase.from("votes").insert({
		account_id: accountId,
		project_id: projectId,
		entity_type: "project",
		entity_id: annotationId,
		user_id: userId,
		vote_value: voteValue,
	});
}

async function markAnnotationResponse({
	supabase,
	projectId,
	annotationId,
	userId,
	response,
}: {
	supabase: SupabaseClient<Database>;
	projectId: string;
	annotationId: string;
	userId: string;
	response: RecommendationResponse;
}) {
	const { data, error } = await supabase
		.from("annotations")
		.select("id, content_jsonb, metadata")
		.eq("id", annotationId)
		.eq("project_id", projectId)
		.eq("entity_type", "project")
		.eq("annotation_type", "ai_suggestion")
		.eq("metadata->>suggestion_type", NEXT_ACTION_SUGGESTION_TYPE)
		.maybeSingle();

	if (error || !data) {
		return null;
	}

	const content = asRecord(data.content_jsonb);
	const metadata = asRecord(data.metadata);
	const now = new Date().toISOString();
	const nextContent = {
		...content,
		response,
		responded_at: now,
		responded_by_user_id: userId,
	};
	const nextMetadata = {
		...metadata,
		response,
		responded_at: now,
		responded_by_user_id: userId,
	};

	const { error: updateError } = await supabase
		.from("annotations")
		.update({
			status: response,
			content_jsonb: nextContent,
			metadata: nextMetadata,
			updated_at: now,
			updated_by_user_id: userId,
		})
		.eq("id", annotationId)
		.eq("project_id", projectId);

	if (updateError) {
		consola.warn("recommendation-memory: failed to update annotation response", {
			projectId,
			annotationId,
			response,
			error: updateError.message,
		});
		return null;
	}

	return {
		batchId: asString(content.recommendation_batch_id) ?? asString(metadata.batch_id),
	};
}

async function deferAnnotationIds({
	supabase,
	projectId,
	annotationIds,
	userId,
}: {
	supabase: SupabaseClient<Database>;
	projectId: string;
	annotationIds: string[];
	userId: string;
}) {
	for (const annotationId of annotationIds) {
		await markAnnotationResponse({
			supabase,
			projectId,
			annotationId,
			userId,
			response: "deferred",
		});
	}
}

async function deferPendingRecommendationBatch({
	supabase,
	projectId,
	batchId,
	userId,
	excludeAnnotationId,
}: {
	supabase: SupabaseClient<Database>;
	projectId: string;
	batchId: string;
	userId: string;
	excludeAnnotationId: string;
}) {
	const { data, error } = await supabase
		.from("annotations")
		.select("id")
		.eq("project_id", projectId)
		.eq("entity_type", "project")
		.eq("annotation_type", "ai_suggestion")
		.eq("status", "pending")
		.eq("metadata->>suggestion_type", NEXT_ACTION_SUGGESTION_TYPE)
		.eq("metadata->>batch_id", batchId);

	if (error) return;

	const ids = (data ?? [])
		.map((row) => row.id)
		.filter((id): id is string => typeof id === "string" && id.length > 0 && id !== excludeAnnotationId);

	if (ids.length === 0) return;
	await deferAnnotationIds({ supabase, projectId, annotationIds: ids, userId });
}

export async function recordRecommendationResponse({
	supabase,
	accountId,
	projectId,
	annotationId,
	userId,
	response,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
	annotationId: string;
	userId: string;
	response: RecommendationResponse;
}) {
	const updated = await markAnnotationResponse({
		supabase,
		projectId,
		annotationId,
		userId,
		response,
	});
	if (!updated) return false;

	await upsertRecommendationVote({
		supabase,
		accountId,
		projectId,
		annotationId,
		userId,
		response,
	});

	if (response === "accepted" && updated.batchId) {
		await deferPendingRecommendationBatch({
			supabase,
			projectId,
			batchId: updated.batchId,
			userId,
			excludeAnnotationId: annotationId,
		});
	}

	return true;
}

export async function deferPendingRecommendationsForThread({
	supabase,
	projectId,
	threadId,
	userId,
	excludeAnnotationIds = [],
}: {
	supabase: SupabaseClient<Database>;
	projectId: string;
	threadId: string;
	userId: string;
	excludeAnnotationIds?: string[];
}) {
	if (!threadId) return;

	const { data, error } = await supabase
		.from("annotations")
		.select("id")
		.eq("project_id", projectId)
		.eq("entity_type", "project")
		.eq("annotation_type", "ai_suggestion")
		.eq("status", "pending")
		.eq("metadata->>suggestion_type", NEXT_ACTION_SUGGESTION_TYPE)
		.eq("content_jsonb->>chat_thread_id", threadId);

	if (error) {
		consola.warn("recommendation-memory: failed to defer thread pending suggestions", {
			projectId,
			threadId,
			error: error.message,
		});
		return;
	}

	const excludedSet = new Set(excludeAnnotationIds);
	const ids = (data ?? [])
		.map((row) => row.id)
		.filter((id): id is string => typeof id === "string" && id.length > 0 && !excludedSet.has(id));

	if (ids.length === 0) return;
	await deferAnnotationIds({ supabase, projectId, annotationIds: ids, userId });
}
