/**
 * AI-Powered Person Next Steps
 *
 * Gathers context about a person (themes, evidence, ICP, contact recency)
 * and calls BAML to generate 3 prioritized, person-specific recommendations.
 * Falls back gracefully — callers should use heuristic steps when this fails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { differenceInDays } from "date-fns";
import { b } from "~/../baml_client";
import type { PersonNextStepsInput } from "~/../baml_client/types";
import type { Database } from "~/types";

export interface AINextStep {
	action: string;
	reasoning: string;
	priority: number;
}

export async function generatePersonNextSteps(opts: {
	supabase: SupabaseClient<Database>;
	personId: string;
	projectId: string;
	person: {
		name: string | null;
		title: string | null;
		description: string | null;
	};
	companyName: string | null;
	icpMatch: { band: string | null; score: number | null } | null;
	lastContactDate: Date | null;
	conversationCount: number;
	surveyCount: number;
	themes: Array<{ name: string; evidence_count: number }>;
}): Promise<AINextStep[] | null> {
	const {
		supabase,
		personId,
		projectId,
		person,
		companyName,
		icpMatch,
		lastContactDate,
		conversationCount,
		surveyCount,
		themes,
	} = opts;

	try {
		// Fetch recent evidence gists for this person (up to 5)
		const { data: evidenceRows } = await supabase
			.from("evidence_people")
			.select(
				`
				evidence:evidence!inner(
					gist,
					context_summary,
					project_id
				)
			`
			)
			.eq("person_id", personId)
			.eq("evidence.project_id", projectId)
			.limit(5);

		const recentEvidence: string[] = [];
		for (const row of evidenceRows ?? []) {
			const ev = row.evidence as {
				gist: string | null;
				context_summary: string | null;
			} | null;
			if (!ev) continue;
			const text = ev.gist || ev.context_summary;
			if (text) recentEvidence.push(text.slice(0, 200));
		}

		// Fetch person facet labels
		const { data: facetRows } = await supabase
			.from("person_facet")
			.select(
				`
				facet:facet_account_id(label)
			`
			)
			.eq("person_id", personId);

		const facetLabels: string[] = [];
		for (const row of facetRows ?? []) {
			const facet = row.facet as { label: string } | null;
			if (facet?.label) facetLabels.push(facet.label);
		}

		const daysSinceContact = lastContactDate ? differenceInDays(new Date(), lastContactDate) : null;

		const input: PersonNextStepsInput = {
			name: person.name,
			title: person.title,
			company: companyName,
			description: person.description,
			icp_band: icpMatch?.band ?? null,
			icp_score: icpMatch?.score ?? null,
			days_since_last_contact: daysSinceContact,
			conversation_count: conversationCount,
			survey_count: surveyCount,
			themes: themes.map((t) => t.name),
			recent_evidence: recentEvidence,
			facets: facetLabels,
		};

		const result = await b.GeneratePersonNextSteps(input);

		if (!result?.steps?.length) {
			consola.warn("generatePersonNextSteps: BAML returned empty steps", {
				personId,
			});
			return null;
		}

		return result.steps.map((step) => ({
			action: step.action,
			reasoning: step.reasoning,
			priority: step.priority,
		}));
	} catch (error) {
		consola.warn("generatePersonNextSteps: failed, caller should use heuristic fallback", {
			personId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}
