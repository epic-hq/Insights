import { b } from "baml_client";
import type { PersonaAdvisorThemeInput } from "baml_client/types";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";

const toStringArray = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
	}
	if (typeof value === "string" && value.trim().length > 0) {
		return [value.trim()];
	}
	return [];
};

const toNumberOrNull = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

const splitEvidence = (text: string | null | undefined): string[] => {
	if (!text) return [];
	return text
		.split(/\s*[-*•]\s*/g)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
};

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext);
	const userId = ctx.userId;
	consola.debug("Persona Advisor requested", { userId });
	const formData = await request.formData();
	const accountId = formData.get("accountId")?.toString();
	const projectId = formData.get("projectId")?.toString();

	if (!accountId || !projectId) {
		consola.warn("Persona Advisor missing context");
		return Response.json({ ok: false, error: "Missing account or project" }, { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	try {
		const [{ data: project, error: projectError }, { data: personas, error: personasError }] = await Promise.all([
			supabase
				.from("projects")
				.select("id, name, description")
				.eq("id", projectId)
				.eq("account_id", accountId)
				.single(),
			supabase
				.from("personas")
				.select("*")
				.eq("project_id", projectId)
				.eq("account_id", accountId)
				.order("updated_at", { ascending: false }),
		]);

		if (projectError) {
			consola.debug("Persona Advisor project metadata not found", projectError);
		}

		if (personasError) {
			consola.error("Persona Advisor failed to load personas", personasError);
			return Response.json({ ok: false, error: personasError.message }, { status: 500 });
		}

		if (!personas || personas.length === 0) {
			return Response.json({ ok: false, message: "No personas available yet" });
		}

		const personaIds = personas.map((persona) => persona.id);
		const { data: peoplePersonas } = await supabase
			.from("people_personas")
			.select("person_id, persona_id")
			.in("persona_id", personaIds)
			.eq("account_id", accountId)
			.eq("project_id", projectId);

		const personToPersonas = new Map<string, Set<string>>();
		const personaPeople = new Map<string, Set<string>>();
		const personIdsSet = new Set<string>();

		for (const row of peoplePersonas ?? []) {
			const personId = row.person_id;
			const personaId = row.persona_id;
			if (!personId || !personaId) continue;

			personIdsSet.add(personId);

			if (!personToPersonas.has(personId)) {
				personToPersonas.set(personId, new Set());
			}
			personToPersonas.get(personId)?.add(personaId);

			if (!personaPeople.has(personaId)) {
				personaPeople.set(personaId, new Set());
			}
			personaPeople.get(personaId)?.add(personId);
		}

		const personIds = Array.from(personIdsSet);

		const facetPromise = personIds.length
			? supabase
					.from("person_facet")
					.select(`
					person_id,
					source,
					confidence,
					facet_account_id,
					facet:facet_account!inner(
						id,
						label,
						slug,
						facet_kind_global:facet_kind_global!inner(
							slug
						)
					)
				`)
					.in("person_id", personIds)
					.eq("project_id", projectId)
					.eq("account_id", accountId)
			: Promise.resolve({ data: [], error: null });

		const scalePromise = personIds.length
			? supabase
					.from("person_scale")
					.select("person_id, kind_slug, score, band, source, confidence")
					.in("person_id", personIds)
					.eq("project_id", projectId)
					.eq("account_id", accountId)
			: Promise.resolve({ data: [], error: null });

		const personaInsightsPromise = personIds.length
			? supabase
					.from("persona_insights")
					.select(`
					persona_id,
					insight:insights_with_priority!inner(
						id,
						name,
						details,
						pain,
						desired_outcome,
						emotional_response,
						journey_stage,
						category,
						evidence,
						priority
					)
				`)
					.in("persona_id", personaIds)
					.eq("project_id", projectId)
					.eq("account_id", accountId)
			: Promise.resolve({ data: [], error: null });

		const researchPromise = supabase
			.from("insights_with_priority")
			.select(
				"id, name, details, pain, desired_outcome, emotional_response, journey_stage, category, evidence, priority"
			)
			.eq("project_id", projectId)
			.order("priority", { ascending: false, nulls: "last" })
			.order("created_at", { ascending: false })
			.limit(3);

		const [
			{ data: facetRows = [], error: facetError },
			{ data: scaleRows = [], error: scaleError },
			{ data: personaInsightsRows = [], error: personaInsightsError },
			{ data: researchRows = [], error: researchError },
		] = await Promise.all([facetPromise, scalePromise, personaInsightsPromise, researchPromise]);

		if (facetError) consola.warn("Persona Advisor facet query error", facetError);
		if (scaleError) consola.warn("Persona Advisor scale query error", scaleError);
		if (personaInsightsError) consola.warn("Persona Advisor persona insights error", personaInsightsError);
		if (researchError) consola.warn("Persona Advisor research insights error", researchError);

		const personaFacetBuckets = new Map<
			string,
			Map<string, { label: string; kind_slug: string; totalConfidence: number; count: number; sources: Set<string> }>
		>();
		for (const row of facetRows ?? []) {
			const personId = row.person_id;
			if (!personId) continue;
			const kindSlug = row.facet?.facet_kind_global?.slug ?? row.facet?.slug ?? "other";
			const label = row.facet?.label ?? `Facet ${row.facet_account_id}`;
			const confidence = toNumberOrNull(row.confidence) ?? 0.5;
			const facets = personToPersonas.get(personId);
			if (!facets) continue;

			for (const personaId of facets) {
				if (!personaFacetBuckets.has(personaId)) {
					personaFacetBuckets.set(personaId, new Map());
				}

				const bucket = personaFacetBuckets.get(personaId) as Map<
					string,
					{ label: string; kind_slug: string; totalConfidence: number; count: number; sources: Set<string> }
				>;
				const key = `${kindSlug}|${label}`;
				const existing = bucket.get(key);
				if (existing) {
					existing.totalConfidence += confidence;
					existing.count += 1;
					existing.sources.add(row.source || "unspecified");
				} else {
					bucket.set(key, {
						label,
						kind_slug: kindSlug,
						totalConfidence: confidence,
						count: 1,
						sources: new Set(row.source ? [row.source] : ["unspecified"]),
					});
				}
			}
		}

		const personaScaleBuckets = new Map<
			string,
			Map<
				string,
				{
					kind_slug: string;
					scoreTotal: number;
					scoreCount: number;
					band?: string | null;
					sources: Set<string>;
					confidenceTotal: number;
					confidenceCount: number;
				}
			>
		>();
		for (const row of scaleRows ?? []) {
			const personId = row.person_id;
			if (!personId) continue;
			const facets = personToPersonas.get(personId);
			if (!facets) continue;
			const score = toNumberOrNull(row.score);
			const confidence = toNumberOrNull(row.confidence);

			for (const personaId of facets) {
				if (!personaScaleBuckets.has(personaId)) {
					personaScaleBuckets.set(personaId, new Map());
				}

				const bucket = personaScaleBuckets.get(personaId) as Map<
					string,
					{
						kind_slug: string;
						scoreTotal: number;
						scoreCount: number;
						band?: string | null;
						sources: Set<string>;
						confidenceTotal: number;
						confidenceCount: number;
					}
				>;
				const key = row.kind_slug || "scale";
				const existing = bucket.get(key);
				if (existing) {
					if (typeof row.band === "string" && row.band.length > 0) {
						existing.band = row.band;
					}
					if (typeof score === "number") {
						existing.scoreTotal += score;
						existing.scoreCount += 1;
					}
					if (typeof confidence === "number") {
						existing.confidenceTotal += confidence;
						existing.confidenceCount += 1;
					}
					existing.sources.add(row.source || "unspecified");
				} else {
					bucket.set(key, {
						kind_slug: key,
						scoreTotal: typeof score === "number" ? score : 0,
						scoreCount: typeof score === "number" ? 1 : 0,
						band: typeof row.band === "string" && row.band.length > 0 ? row.band : null,
						sources: new Set(row.source ? [row.source] : ["unspecified"]),
						confidenceTotal: typeof confidence === "number" ? confidence : 0,
						confidenceCount: typeof confidence === "number" ? 1 : 0,
					});
				}
			}
		}

		const personaThemes = new Map<string, PersonaAdvisorThemeInput[]>();
		const sharedThemeTrack = new Map<string, { theme: PersonaAdvisorThemeInput; personas: Set<string> }>();

		for (const row of personaInsightsRows ?? []) {
			const personaId = row.persona_id;
			const detail = row.insight;
			if (!personaId || !detail || !detail.id) continue;

			const themeInput: PersonaAdvisorThemeInput = {
				title: detail.name || "Unnamed theme",
				description: detail.details ?? null,
				pain: detail.pain ?? null,
				desired_outcome: detail.desired_outcome ?? null,
				emotional_response: detail.emotional_response ?? null,
				journey_stage: detail.journey_stage ?? null,
				category: detail.category ?? null,
				evidence: splitEvidence(detail.evidence),
				persona_count: null,
				priority: detail.priority ?? null,
			};

			if (!personaThemes.has(personaId)) {
				personaThemes.set(personaId, []);
			}
			personaThemes.get(personaId)?.push(themeInput);

			const shared = sharedThemeTrack.get(detail.id);
			if (shared) {
				shared.personas.add(personaId);
			} else {
				sharedThemeTrack.set(detail.id, { theme: themeInput, personas: new Set([personaId]) });
			}
		}

		const sharedThemes = Array.from(sharedThemeTrack.values())
			.sort((a, b) => b.personas.size - a.personas.size)
			.slice(0, 4)
			.map((entry) => ({
				...entry.theme,
				persona_count: entry.personas.size,
			}));

		const researchInsights = (researchRows ?? [])
			.map((insight) => {
				const summaryCandidate = (insight.details ?? insight.pain ?? insight.desired_outcome ?? "").trim();
				return {
					title: insight.name || "Research finding",
					summary: summaryCandidate,
					source: insight.journey_stage || insight.category || null,
					evidence: splitEvidence(insight.evidence),
				};
			})
			.filter((entry) => entry.summary.length > 0)
			.slice(0, 3);

		const personaInputs = personas.map((persona) => {
			const facts: string[] = [];
			const appendFact = (label: string, value?: string | null) => {
				if (!value || value.trim().length === 0) return;
				facts.push(`${label}: ${value.trim()}`);
			};

			appendFact("Segment", persona.segment);
			appendFact("Role", persona.role || persona.occupation);
			appendFact("Age", persona.age);
			appendFact("Gender", persona.gender);
			appendFact("Location", persona.location);
			appendFact("Education", persona.education);
			appendFact("Income", persona.income);
			appendFact("Primary goal", persona.primary_goal);

			const facets = Array.from(personaFacetBuckets.get(persona.id)?.values() ?? [])
				.sort((a, b) => b.totalConfidence - a.totalConfidence)
				.slice(0, 6)
				.map((facet) => ({
					label: facet.label,
					kind_slug: facet.kind_slug,
					confidence: facet.totalConfidence / facet.count,
					source: Array.from(facet.sources).join(", "),
				}));

			const scales = Array.from(personaScaleBuckets.get(persona.id)?.values() ?? [])
				.sort((a, b) => b.scoreTotal / Math.max(b.scoreCount, 1) - a.scoreTotal / Math.max(a.scoreCount, 1))
				.slice(0, 4)
				.map((scale) => ({
					kind_slug: scale.kind_slug,
					score: scale.scoreCount ? scale.scoreTotal / scale.scoreCount : null,
					band: scale.band ?? null,
					source: Array.from(scale.sources).join(", "),
					confidence: scale.confidenceCount ? scale.confidenceTotal / scale.confidenceCount : null,
				}));

			const personaThemeInputs = (personaThemes.get(persona.id) ?? [])
				.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
				.slice(0, 4);

			return {
				name: persona.name,
				tagline: persona.description,
				description: persona.description,
				quick_facts: facts,
				people_count: personaPeople.get(persona.id)?.size ?? 0,
				percent: typeof persona.percentage === "number" ? persona.percentage : null,
				motivations: toStringArray(persona.motivations),
				frustrations: toStringArray(persona.frustrations),
				values: toStringArray(persona.values),
				goals: toStringArray(persona.goals),
				primary_goal: persona.primary_goal ?? null,
				secondary_goals: toStringArray(persona.secondary_goals),
				preferences: persona.preferences ?? null,
				tech_comfort_level: persona.tech_comfort_level ?? null,
				key_tasks: toStringArray(persona.key_tasks),
				tools_used: toStringArray(persona.tools_used),
				quotes: toStringArray(persona.quotes),
				facets,
				scales,
				themes: personaThemeInputs,
			};
		});

		const reportInput = {
			project_name: project?.name ?? "Your product",
			project_description: project?.description ?? null,
			personas: personaInputs,
			research_insights: researchInsights,
			shared_themes: sharedThemes,
			total_personas: personaInputs.length,
			total_people: personIds.length,
		};

		const report = await b.GeneratePersonaAdvisorReport(reportInput);
		consola.info("Persona Advisor report generated", { userId, personaCount: personaInputs.length });

		return Response.json({ ok: true, report: report.markdown });
	} catch (error) {
		consola.error("Persona Advisor failed", error);
		return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unknown" }, { status: 500 });
	}
}
