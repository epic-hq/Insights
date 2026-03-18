import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import {
	type ResearchLinkQuestion,
	ResearchLinkQuestionSchema,
	type ResearchLinkResponsePayload,
	ResearchLinkResponseSaveSchema,
} from "~/features/research-links/schemas";
import { applySurveyResponsesToPersonProfile } from "~/features/research-links/survey-person-attributes.server";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import type { ResearchLink, ResearchLinkResponse } from "~/types";

type ResearchLinkResponses = ResearchLinkResponsePayload["responses"];
type ExistingResearchLinkResponse = Pick<
	ResearchLinkResponse,
	"id" | "email" | "evidence_id" | "responses" | "response_mode" | "completed"
>;

type ExistingResearchLink = Pick<ResearchLink, "id" | "name" | "account_id" | "project_id" | "questions"> & {
	survey_owner_user_id: string | null;
};

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;
const STRUCTURAL_QUESTION_TYPES = ["likert", "matrix", "single_select", "multi_select", "image_select"];

function coerceSupabaseRow<T>(value: unknown): T {
	return value as T;
}

export const loader = () => Response.json({ message: "Method not allowed" }, { status: 405 });

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ message: "Method not allowed" }, { status: 405 });
	}

	const slug = params.slug;
	if (!slug) {
		return Response.json({ message: "Missing slug" }, { status: 400 });
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return Response.json({ message: "Invalid JSON payload" }, { status: 400 });
	}

	const parsed = ResearchLinkResponseSaveSchema.safeParse(payload);
	if (!parsed.success) {
		return Response.json({ message: "Invalid request" }, { status: 400 });
	}

	const supabase = createSupabaseAdminClient();
	let { data: listRaw, error: listError } = await supabase
		.from("research_links")
		.select("id, name, account_id, project_id, questions, survey_owner_user_id")
		.eq("slug", slug)
		.maybeSingle();

	if (listError?.message?.includes("survey_owner_user_id")) {
		const fallbackResult = await supabase
			.from("research_links")
			.select("id, name, account_id, project_id, questions")
			.eq("slug", slug)
			.maybeSingle();
		listRaw = fallbackResult.data
			? {
					...fallbackResult.data,
					survey_owner_user_id: null,
				}
			: null;
		listError = fallbackResult.error;
	}

	if (listError) {
		return Response.json({ message: listError.message }, { status: 500 });
	}

	if (!listRaw) {
		return Response.json({ message: "Research link not found" }, { status: 404 });
	}
	const list = coerceSupabaseRow<ExistingResearchLink>(listRaw);

	const { responseId, responses, completed, fullSnapshot } = parsed.data;
	const { data: existingRaw, error: existingError } = await supabase
		.from("research_link_responses")
		.select("id, email, evidence_id, responses, response_mode, completed")
		.eq("id", responseId)
		.eq("research_link_id", list.id)
		.maybeSingle();

	if (existingError) {
		return Response.json({ message: existingError.message }, { status: 500 });
	}

	if (!existingRaw) {
		return Response.json({ message: "Response not found" }, { status: 404 });
	}
	const existing = coerceSupabaseRow<ExistingResearchLinkResponse>(existingRaw);

	const existingParsed = ResearchLinkResponseSaveSchema.safeParse({
		responseId,
		responses: existing.responses,
	});
	const existingResponses: ResearchLinkResponses = existingParsed.success ? existingParsed.data.responses : {};

	// Safe by default: partial saves are treated as patches so callers cannot accidentally
	// wipe prior answers. Full replacement requires an explicit full snapshot from a trusted client.
	const nextResponses: ResearchLinkResponses = fullSnapshot ? responses : { ...existingResponses, ...responses };

	const was_completed = existing.completed ?? false;
	const is_completion_transition = was_completed === false && completed === true;
	if (was_completed === true && completed === true) {
		consola.warn("[survey] duplicate completion save; already completed", {
			response_id: responseId,
			survey_id: list.id,
		});
	}

	const update_payload: {
		responses: ResearchLinkResponses;
		completed?: boolean;
	} = {
		responses: nextResponses,
	};
	// Only set completed when the client explicitly provides it.
	// This prevents autosaves (which omit completed) from flipping completed back to false.
	if (typeof completed === "boolean") {
		update_payload.completed = completed;
	}

	const { error: updateError } = await supabase
		.from("research_link_responses")
		.update(update_payload)
		.eq("id", responseId);

	if (updateError) {
		return Response.json({ message: updateError.message }, { status: 500 });
	}

	if (is_completion_transition) {
		// Find or create person record for this respondent (skip for anonymous responses)
		let personId: string | null = null;
		if (existing.email) {
			personId = await findOrCreatePerson({
				supabase,
				accountId: list.account_id,
				projectId: list.project_id,
				email: existing.email,
			});

			if (personId) {
				await supabase.from("research_link_responses").update({ person_id: personId }).eq("id", responseId);
			}
		}

		const questionsParse = ResearchLinkQuestionSchema.array().safeParse(list.questions);
		const questions: ResearchLinkQuestion[] = questionsParse.success ? questionsParse.data : [];

		if (personId) {
			try {
				await applySurveyResponsesToPersonProfile({
					supabase,
					accountId: list.account_id,
					projectId: list.project_id,
					personId,
					questions,
					responses: nextResponses,
				});
			} catch (error) {
				consola.error("[survey-person-standardization] failed to sync person attributes", error);
			}
		}

		// Emit per-question evidence + survey_response facets for semantic parity.
		await emitSurveyQuestionEvidenceAndFacets({
			supabase,
			responseId,
			accountId: list.account_id,
			projectId: list.project_id,
			personId,
			questions,
			responses: nextResponses,
		});

		// Track survey completion in PostHog
		const posthog = getPostHogServerClient();
		if (posthog) {
			// Calculate text question count (questions that generate evidence)
			const textQuestionCount = questions.filter((q) => {
				const qType = q.type ?? "auto";
				return !STRUCTURAL_QUESTION_TYPES.includes(qType);
			}).length;

			const sharedProperties = {
				survey_id: list.id,
				survey_name: list.name,
				response_id: responseId,
				person_id: personId,
				account_id: list.account_id,
				project_id: list.project_id,
				survey_owner_user_id: list.survey_owner_user_id,
				response_mode: (existing.response_mode as string | undefined) ?? "form",
				question_count: questions.length,
				text_questions: textQuestionCount,
				has_person: !!personId,
			};

			// Fire and forget - don't block response
			void Promise.allSettled([
				// Capture on the respondent's identity for respondent-level funnels
				posthog.capture({
					distinctId: personId ?? existing.email ?? responseId,
					event: "survey_response_received",
					properties: sharedProperties,
				}),
				// Also capture on the workspace account so PLG nurture fires for the survey owner
				posthog.capture({
					distinctId: list.survey_owner_user_id ?? list.account_id,
					event: "survey_response_received",
					properties: sharedProperties,
				}),
			]).catch((error) => {
				consola.error("[PostHog] Failed to track survey_response_received", error);
			});
		}
	}

	return Response.json({ ok: true });
}

/**
 * Find an existing person by email or create a new person record
 */
async function findOrCreatePerson({
	supabase,
	accountId,
	projectId,
	email,
}: {
	supabase: AdminSupabaseClient;
	accountId: string;
	projectId: string | null;
	email: string;
}): Promise<string | null> {
	const normalizedEmail = email.toLowerCase().trim();

	// Try to find existing person by email
	const { data: existingPerson } = await supabase
		.from("people")
		.select("id")
		.eq("account_id", accountId)
		.eq("primary_email", normalizedEmail)
		.maybeSingle();

	if (existingPerson?.id) {
		return existingPerson.id;
	}

	// Parse name from email (use part before @)
	const emailName = normalizedEmail.split("@")[0] || "Unknown";
	const nameParts = emailName.replace(/[._-]/g, " ").split(/\s+/);
	const firstname = nameParts[0]?.charAt(0).toUpperCase() + (nameParts[0]?.slice(1) || "");
	const lastname =
		nameParts.length > 1
			? nameParts
					.slice(1)
					.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
					.join(" ")
			: null;

	// Create new person
	const { data: newPerson, error: createError } = await supabase
		.from("people")
		.insert({
			account_id: accountId,
			project_id: projectId,
			primary_email: normalizedEmail,
			firstname,
			lastname,
			person_type: "respondent",
		})
		.select("id")
		.maybeSingle();

	if (createError) {
		// Handle unique constraint violation - person may have been created concurrently
		if (createError.code === "23505") {
			const { data: retryPerson } = await supabase
				.from("people")
				.select("id")
				.eq("account_id", accountId)
				.eq("primary_email", normalizedEmail)
				.maybeSingle();
			return retryPerson?.id ?? null;
		}
		consola.error("Failed to create person for response", createError);
		return null;
	}

	return newPerson?.id ?? null;
}

function normalizeSurveyAnswerValue(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "number") return String(value);
	if (Array.isArray(value)) {
		const normalized = value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
		return normalized.length > 0 ? normalized.join("; ") : null;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	try {
		const asJson = JSON.stringify(value);
		return asJson && asJson !== "{}" && asJson !== "[]" ? asJson : null;
	} catch {
		return null;
	}
}

function buildSurveyQuestionFacetSlug(questionId: string, prompt: string): string {
	const idPart = questionId
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "")
		.slice(0, 20);
	const promptPart = prompt
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 30);
	const base = promptPart ? `survey_q_${idPart}_${promptPart}` : `survey_q_${idPart}`;
	return base.slice(0, 63);
}

async function resolveSurveyResponseFacetKindId(supabase: AdminSupabaseClient): Promise<number | null> {
	const { data: surveyKind, error: surveyKindError } = await supabase
		.from("facet_kind_global")
		.select("id")
		.eq("slug", "survey_response")
		.maybeSingle();

	if (surveyKindError) {
		consola.warn("[survey-response-facets] Failed loading survey_response kind", surveyKindError.message);
		return null;
	}

	if (surveyKind?.id) {
		return surveyKind.id;
	}

	const createResult = await supabase
		.from("facet_kind_global")
		.insert({
			slug: "survey_response",
			label: "Survey Response",
			description: "Answer to a survey or form question",
		})
		.select("id")
		.single();

	if (createResult.error) {
		if (createResult.error.code === "23505") {
			const retryResult = await supabase.from("facet_kind_global").select("id").eq("slug", "survey_response").single();
			if (retryResult.error) {
				consola.warn("[survey-response-facets] Failed reloading survey_response kind", retryResult.error.message);
				return null;
			}
			return retryResult.data?.id ?? null;
		}

		consola.warn("[survey-response-facets] Failed creating survey_response kind", createResult.error.message);
		return null;
	}

	return createResult.data?.id ?? null;
}

async function resolveSurveyQuestionFacetAccountId({
	supabase,
	accountId,
	surveyKindId,
	questionId,
	prompt,
	cache,
}: {
	supabase: AdminSupabaseClient;
	accountId: string;
	surveyKindId: number;
	questionId: string;
	prompt: string;
	cache: Map<string, number>;
}): Promise<number | null> {
	const cacheKey = questionId;
	const cached = cache.get(cacheKey);
	if (cached) return cached;

	const slug = buildSurveyQuestionFacetSlug(questionId, prompt);
	const label = prompt.trim();

	const { data: existing, error: existingError } = await supabase
		.from("facet_account")
		.select("id, label")
		.eq("account_id", accountId)
		.eq("kind_id", surveyKindId)
		.eq("slug", slug)
		.maybeSingle();

	if (existingError) {
		consola.warn("[survey-response-facets] Failed loading facet_account", { questionId, error: existingError.message });
		return null;
	}

	if (existing?.id) {
		if (label.length > 0 && existing.label !== label) {
			await supabase.from("facet_account").update({ label }).eq("id", existing.id);
		}
		cache.set(cacheKey, existing.id);
		return existing.id;
	}

	let { data: created, error: createError } = await supabase
		.from("facet_account")
		.insert({
			account_id: accountId,
			kind_id: surveyKindId,
			slug,
			label: label.length > 0 ? label : questionId,
			is_active: true,
		})
		.select("id")
		.single();

	if (createError?.message?.includes("is_active")) {
		const fallbackCreateResult = await supabase
			.from("facet_account")
			.insert({
				account_id: accountId,
				kind_id: surveyKindId,
				slug,
				label: label.length > 0 ? label : questionId,
			})
			.select("id")
			.single();
		created = fallbackCreateResult.data;
		createError = fallbackCreateResult.error;
	}

	if (createError || !created?.id) {
		consola.warn("[survey-response-facets] Failed creating facet_account", {
			questionId,
			error: createError?.message ?? "unknown",
		});
		return null;
	}

	cache.set(cacheKey, created.id);
	return created.id;
}

/**
 * Emit per-question evidence + evidence_facet(kind_slug='survey_response') rows
 * for every answered survey question so semantic retrieval and person timelines
 * can consume survey data through the same facet pipeline as other sources.
 */
async function emitSurveyQuestionEvidenceAndFacets({
	supabase,
	responseId,
	accountId,
	projectId,
	personId,
	questions,
	responses,
}: {
	supabase: AdminSupabaseClient;
	responseId: string;
	accountId: string;
	projectId: string | null;
	personId: string | null;
	questions: ResearchLinkQuestion[];
	responses: ResearchLinkResponses;
}): Promise<void> {
	const surveyKindId = await resolveSurveyResponseFacetKindId(supabase);
	const facetAccountCache = new Map<string, number>();
	let evidenceCreated = 0;
	let evidenceLinksCreated = 0;
	let facetsCreated = 0;
	const facet_diagnostics: Array<Record<string, unknown>> = [];

	for (let i = 0; i < questions.length; i++) {
		const question = questions[i];
		if (!question.id || !question.prompt) continue;
		if (question.type === "matrix") continue;

		const answerText = normalizeSurveyAnswerValue(responses[question.id]);
		if (!answerText) continue;

		const verbatim = `${question.prompt}\n\n"${answerText}"`;

		const { data: evidence, error: evidenceError } = await supabase
			.from("evidence")
			.insert({
				account_id: accountId,
				project_id: projectId,
				research_link_response_id: responseId,
				method: "survey",
				modality: "qual",
				verbatim,
				context_summary: `Survey response to: ${question.prompt}`,
				anchors: [
					{
						type: "survey_question",
						question_id: question.id,
						question_index: i,
						question_type: question.type ?? "auto",
					},
				],
			})
			.select("id")
			.maybeSingle();

		if (evidenceError) {
			facet_diagnostics.push({
				stage: "evidence",
				question_id: question.id,
				error: evidenceError.message,
			});
			consola.error("Failed to create evidence for question", {
				questionId: question.id,
				error: evidenceError,
			});
			continue;
		}
		evidenceCreated += 1;

		if (evidence?.id && personId) {
			const { error: linkError } = await supabase.from("evidence_people").upsert(
				{
					evidence_id: evidence.id,
					person_id: personId,
					account_id: accountId,
					project_id: projectId,
					role: "respondent",
				},
				{ onConflict: "evidence_id,person_id,account_id" }
			);

			if (linkError) {
				facet_diagnostics.push({
					stage: "evidence_people",
					question_id: question.id,
					evidence_id: evidence.id,
					error: linkError.message,
				});
				consola.error("Failed to link evidence to person", {
					evidenceId: evidence.id,
					personId,
					error: linkError,
				});
			} else {
				evidenceLinksCreated += 1;
			}
		}

		if (!surveyKindId || !evidence?.id) {
			if (!surveyKindId) {
				facet_diagnostics.push({
					stage: "facet_kind",
					question_id: question.id,
					error: "survey_response kind unavailable",
				});
			}
			continue;
		}

		const facetAccountId = await resolveSurveyQuestionFacetAccountId({
			supabase,
			accountId,
			surveyKindId,
			questionId: question.id,
			prompt: question.prompt,
			cache: facetAccountCache,
		});

		if (!facetAccountId) {
			facet_diagnostics.push({
				stage: "facet_account",
				question_id: question.id,
				error: "facet account unavailable",
			});
			continue;
		}

		let { error: facetError } = await supabase.from("evidence_facet").insert({
			evidence_id: evidence.id,
			account_id: accountId,
			project_id: projectId,
			person_id: personId,
			kind_slug: "survey_response",
			facet_account_id: facetAccountId,
			label: question.prompt,
			quote: answerText,
			source: "survey",
			confidence: 0.95,
		});

		if (facetError?.message?.includes("facet_account_id")) {
			const legacyFacetRef = `a:${facetAccountId}`;
			const legacyFacetResult = await supabase.from("evidence_facet").insert({
				evidence_id: evidence.id,
				account_id: accountId,
				project_id: projectId,
				person_id: personId,
				kind_slug: "survey_response",
				facet_ref: legacyFacetRef,
				label: question.prompt,
				quote: answerText,
				source: "survey",
				confidence: 0.95,
			});
			facetError = legacyFacetResult.error;
		}

		if (facetError) {
			facet_diagnostics.push({
				stage: "evidence_facet",
				question_id: question.id,
				evidence_id: evidence.id,
				facet_account_id: facetAccountId,
				error: facetError.message,
			});
			consola.error("Failed to create survey_response evidence_facet", {
				questionId: question.id,
				evidenceId: evidence.id,
				error: facetError.message,
			});
			continue;
		}
		facetsCreated += 1;
	}

	if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
		consola.info("[survey-response-facets] emitted", {
			responseId,
			evidenceCreated,
			evidenceLinksCreated,
			facetsCreated,
			questionCount: questions.length,
		});
	}
}
