import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { ResearchLinkResponseSaveSchema } from "~/features/research-links/schemas";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { getPostHogServerClient } from "~/lib/posthog.server";
import type { Database } from "~/types";

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
	const { data: list, error: listError } = await supabase
		.from("research_links")
		.select("id, name, account_id, project_id, questions")
		.eq("slug", slug)
		.maybeSingle();

	if (listError) {
		return Response.json({ message: listError.message }, { status: 500 });
	}

	if (!list) {
		return Response.json({ message: "Research link not found" }, { status: 404 });
	}

	const { responseId, responses, completed, merge } = parsed.data;
	const { data: existing, error: existingError } = await supabase
		.from("research_link_responses")
		.select("id, email, evidence_id, responses, response_mode")
		.eq("id", responseId)
		.eq("research_link_id", list.id)
		.maybeSingle();

	if (existingError) {
		return Response.json({ message: existingError.message }, { status: 500 });
	}

	if (!existing) {
		return Response.json({ message: "Response not found" }, { status: 404 });
	}

	// If merge is true, combine with existing responses instead of replacing
	let nextResponses = responses ?? {};
	if (merge && existing.responses) {
		const existingResponses = (existing.responses as Record<string, unknown>) ?? {};
		nextResponses = { ...existingResponses, ...responses };
	}
	const { error: updateError } = await supabase
		.from("research_link_responses")
		.update({
			responses: nextResponses,
			completed: completed ?? false,
		})
		.eq("id", responseId);

	if (updateError) {
		return Response.json({ message: updateError.message }, { status: 500 });
	}

	if (completed) {
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

		const questions = Array.isArray(list.questions) ? list.questions : [];

		// Extract evidence per text question for theme clustering
		await extractTextQuestionEvidence({
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

			// Use person_id if available, fallback to email, then responseId
			const distinctId = personId ?? existing.email ?? responseId;

			// Fire and forget - don't block response
			posthog
				.capture({
					distinctId,
					event: "survey_response_received",
					properties: {
						survey_id: list.id,
						survey_name: list.name,
						response_id: responseId,
						person_id: personId,
						account_id: list.account_id,
						project_id: list.project_id,
						response_mode: (existing.response_mode as string | undefined) ?? "form",
						question_count: questions.length,
						text_questions: textQuestionCount,
						has_person: !!personId,
						completion_time: new Date().toISOString(),
					},
				})
				.catch((error) => {
					consola.error("[PostHog] Failed to track survey_response_received", error);
				});
		}
	}

	return { ok: true };
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
	supabase: SupabaseClient<Database>;
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

/**
 * Question types that should NOT create evidence records
 * (stats computed directly from JSONB)
 */
const STRUCTURAL_QUESTION_TYPES = ["likert", "single_select", "multi_select", "image_select"];

/**
 * Extract evidence records per text question for theme clustering.
 * Only creates evidence for text questions (short_text, long_text, auto with text answers).
 */
async function extractTextQuestionEvidence({
	supabase,
	responseId,
	accountId,
	projectId,
	personId,
	questions,
	responses,
}: {
	supabase: SupabaseClient<Database>;
	responseId: string;
	accountId: string;
	projectId: string | null;
	personId: string | null;
	questions: Array<{ id?: string; prompt?: string; type?: string }>;
	responses: Record<string, unknown>;
}): Promise<void> {
	for (let i = 0; i < questions.length; i++) {
		const question = questions[i];
		if (!question.id || !question.prompt) continue;

		const answer = responses[question.id];
		if (answer === undefined || answer === null || answer === "") continue;

		// Skip structural types - stats computed from JSONB
		if (question.type && STRUCTURAL_QUESTION_TYPES.includes(question.type)) {
			continue;
		}

		// For "auto" type, check if answer is numeric (skip) or text (extract)
		if (question.type === "auto") {
			if (typeof answer === "number") continue;
			if (
				typeof answer === "string" &&
				!Number.isNaN(Number.parseFloat(answer)) &&
				Number.parseFloat(answer) >= 1 &&
				Number.parseFloat(answer) <= 10
			) {
				continue; // Numeric rating, skip
			}
		}

		// Only extract evidence for text answers
		if (typeof answer !== "string" || answer.trim().length === 0) continue;

		const verbatim = `${question.prompt}\n\n"${answer}"`;

		// Create evidence record linked to response
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
					},
				],
			})
			.select("id")
			.maybeSingle();

		if (evidenceError) {
			consola.error("Failed to create evidence for question", {
				questionId: question.id,
				error: evidenceError,
			});
			continue;
		}

		// Link evidence to person if we have one
		if (evidence?.id && personId) {
			const { error: linkError } = await supabase.from("evidence_people").insert({
				evidence_id: evidence.id,
				person_id: personId,
				account_id: accountId,
				project_id: projectId,
				role: "respondent",
			});

			if (linkError) {
				consola.error("Failed to link evidence to person", {
					evidenceId: evidence.id,
					personId,
					error: linkError,
				});
			}
		}
	}
}
