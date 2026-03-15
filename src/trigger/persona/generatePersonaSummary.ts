import { task } from "@trigger.dev/sdk";
import consola from "consola";

import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import {
	runBamlWithBilling,
	systemBillingContext,
} from "~/lib/billing/instrumented-baml.server";
import type { Tables } from "~/types";
import { asQueryClient, asRows } from "../_shared/queryBoundary";
import { workflowRetryConfig } from "../interview/v2/config";

/** Payload for the persona summary generation task. */
type Payload = {
	personaId: string;
	projectId: string;
	accountId: string;
};

type PeoplePersonaWithPerson = {
	person_id: string | null;
	people: Tables<"people"> | null;
};

type PersonaInsightWithTheme = {
	insight_id: string | null;
	insights: Tables<"themes"> | null;
};

type InterviewPersonLink = {
	interview_id: string | null;
	person_id: string | null;
};

type PersonaExtractResult = Partial<Tables<"personas">> & Record<string, unknown>;

function asPersonaExtractResult(value: unknown): PersonaExtractResult {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("ExtractPersona returned an invalid payload");
	}

	return value as PersonaExtractResult;
}

/**
 * Trigger.dev task: regenerates a persona's summary from its linked data.
 *
 * Gathers people, themes (insights), interviews, and evidence associated with
 * the persona, then calls the `ExtractPersona` BAML function to produce an
 * updated profile. The result is persisted back to the `personas` table.
 *
 * **Data flow:**
 * 1. Fetch people linked via `people_personas`.
 * 2. Fetch theme-based insights via `persona_insights`.
 * 3. Resolve interviews through `interview_people` join.
 * 4. Fetch active (non-archived, non-deleted) evidence for the project.
 * 5. Call `ExtractPersona` (billed via `runBamlWithBilling`).
 * 6. Upsert all extracted fields on the persona row.
 *
 * @see {@link runBamlWithBilling} for billing instrumentation details.
 */
export const generatePersonaSummaryTask = task({
	id: "personas.generate-summary",
	retry: workflowRetryConfig,
	run: async ({ personaId, projectId, accountId }: Payload) => {
		const supabase = createSupabaseAdminClient();
		const querySupabase = asQueryClient(supabase);

		const { data: rawPeople, error: peopleError } = await querySupabase
			.from("people_personas")
			.select("person_id, people(*)")
			.eq("persona_id", personaId);
		const people = asRows<PeoplePersonaWithPerson>(rawPeople);
		if (peopleError) {
			throw new Error(
				`Failed to fetch people for persona: ${peopleError.message}`,
			);
		}

		const { data: rawPersonaInsights, error: insightsError } = await querySupabase
			.from("persona_insights")
			.select("insight_id, insights:themes(*)")
			.eq("persona_id", personaId);
		const personaInsights = asRows<PersonaInsightWithTheme>(rawPersonaInsights);
		if (insightsError) {
			throw new Error(
				`Failed to fetch persona insights: ${insightsError.message}`,
			);
		}

		const peopleIds = (people ?? [])
			.map((entry) => entry.person_id)
			.filter((value): value is string => Boolean(value));

		let interviewsRecords: Tables<"interviews">[] = [];
		if (peopleIds.length > 0) {
			const { data: rawInterviewPeopleData, error: interviewPeopleError } =
				await querySupabase
						.from("interview_people")
						.select("interview_id, person_id")
						.in("person_id", peopleIds);
			const interviewPeopleData = asRows<InterviewPersonLink>(rawInterviewPeopleData);
			if (interviewPeopleError) {
				throw new Error(
					`Failed to fetch interview_people: ${interviewPeopleError.message}`,
				);
			}

			const interviewIds = (interviewPeopleData ?? [])
				.map((record) => record.interview_id)
					.filter((value): value is string => Boolean(value));
				if (interviewIds.length > 0) {
					const { data: rawInterviewsData, error: interviewsError } = await querySupabase
						.from("interviews")
						.select("*")
						.in("id", interviewIds);
					if (interviewsError) {
						throw new Error(
							`Failed to fetch interviews: ${interviewsError.message}`,
						);
					}
					interviewsRecords = asRows<Tables<"interviews">>(rawInterviewsData);
				}
			}

			const { data: rawEvidenceData, error: evidenceError } = await querySupabase
				.from("evidence")
				.select("*")
				.eq("project_id", projectId)
				.is("deleted_at", null)
				.eq("is_archived", false);
			const evidenceData = asRows<Tables<"evidence">>(rawEvidenceData);
			if (evidenceError) {
				throw new Error(
					`Failed to fetch evidence for persona refresh: ${evidenceError.message}`,
			);
		}

		const peopleRecords = (people ?? [])
			.map((entry) => entry.people)
			.filter((value): value is Tables<"people"> => Boolean(value));
		const insightsRecords = (personaInsights ?? [])
			.map((entry) => entry.insights)
			.filter((value): value is Tables<"themes"> => Boolean(value));

		const billingCtx = systemBillingContext(
			accountId,
			"persona_summary",
			projectId,
		);
		const { result: bamlResult } = await runBamlWithBilling(
			billingCtx,
			{
				functionName: "ExtractPersona",
				traceName: "persona.extract",
				input: {
					peopleCount: peopleRecords.length,
					insightsCount: insightsRecords.length,
					interviewsCount: interviewsRecords.length,
					evidenceCount: evidenceData?.length ?? 0,
				},
				metadata: { personaId, projectId, accountId },
				resourceType: "persona",
				resourceId: personaId,
				bamlCall: (client) =>
					client.ExtractPersona(
						JSON.stringify(peopleRecords),
						JSON.stringify(insightsRecords),
						JSON.stringify(interviewsRecords),
						JSON.stringify(evidenceData ?? []),
					),
			},
			`persona:${personaId}:generate-summary`,
			);
			const personaResult = asPersonaExtractResult(bamlResult);

			const { error: updateError } = await supabase
				.from("personas")
				.update({
					name: personaResult.name,
					description: personaResult.description,
					age: personaResult.age,
					gender: personaResult.gender,
					location: personaResult.location,
					education: personaResult.education,
					occupation: personaResult.occupation,
					income: personaResult.income,
					languages: personaResult.languages,
					segment: personaResult.segment,
					role: personaResult.role,
					color_hex: personaResult.color_hex,
					image_url: personaResult.image_url,
					motivations: personaResult.motivations,
					values: personaResult.values,
					frustrations: personaResult.frustrations,
					preferences: personaResult.preferences,
					learning_style: personaResult.learning_style,
					tech_comfort_level: personaResult.tech_comfort_level,
					frequency_of_purchase: personaResult.frequency_of_purchase,
					frequency_of_use: personaResult.frequency_of_use,
					key_tasks: personaResult.key_tasks,
					tools_used: personaResult.tools_used,
					primary_goal: personaResult.primary_goal,
					secondary_goals: personaResult.secondary_goals,
					sources: personaResult.sources,
					quotes: personaResult.quotes,
					percentage: personaResult.percentage,
					updated_at: new Date().toISOString(),
				})
			.eq("id", personaId)
			.eq("account_id", accountId);

		if (updateError) {
			throw new Error(`Failed to update persona: ${updateError.message}`);
		}

		consola.info(`[Persona] refreshed persona ${personaId}`);

			return {
				personaId,
				updatedFields: Object.keys(personaResult),
			};
		},
	});
