import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";

type ThemeLinkRow = {
	theme_id: string | null;
	evidence_id: string | null;
};

type ThemeRow = {
	id: string;
	name: string;
	statement: string | null;
	updated_at: string | null;
};

type EvidenceRow = {
	id: string;
	interview_id: string | null;
};

type PersonLinkRow = {
	evidence_id: string | null;
	person_id: string | null;
};

type InterviewPersonRow = {
	interview_id: string;
	person_id: string | null;
};

type PersonRow = {
	id: string;
	name: string | null;
};

function normalizeDate(value: string | null): string | null {
	if (!value) return null;
	const timestamp = Date.parse(value);
	if (Number.isNaN(timestamp)) return null;
	return new Date(timestamp).toISOString();
}

export const fetchTopThemesWithPeopleTool = createTool({
	id: "fetch-top-themes-with-people",
	description: "Deterministically fetch top themes (by evidence mentions) and the people associated with each theme.",
	inputSchema: z.object({
		projectId: z.string().nullish().describe("Project ID to analyze. Defaults to runtime context project_id."),
		limit: z.number().int().min(1).max(10).nullish().describe("How many top themes to return. Default 2."),
		peoplePerTheme: z
			.number()
			.int()
			.min(1)
			.max(20)
			.nullish()
			.describe("How many people to include per theme. Default 5."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable(),
		totalThemes: z.number(),
		topThemes: z.array(
			z.object({
				themeId: z.string(),
				name: z.string(),
				statement: z.string().nullable(),
				evidenceCount: z.number(),
				peopleCount: z.number(),
				updatedAt: z.string().nullable(),
				url: z.string().nullable(),
				people: z.array(
					z.object({
						personId: z.string(),
						name: z.string().nullable(),
						mentionCount: z.number(),
					})
				),
			})
		),
	}),
	execute: async (input, context?) => {
		const { supabaseAdmin } = await import("~/lib/supabase/client.server");
		const { createRouteDefinitions } = await import("~/utils/route-definitions");
		const { HOST } = await import("~/paths");

		const supabase = supabaseAdmin as SupabaseClient<unknown>;
		const runtimeProjectId = context?.requestContext?.get?.("project_id");
		const runtimeAccountId = context?.requestContext?.get?.("account_id");

		const projectId = String(input.projectId ?? runtimeProjectId ?? "").trim();
		const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : "";
		const limit = input.limit ?? 2;
		const peoplePerTheme = input.peoplePerTheme ?? 5;

		if (!projectId) {
			return {
				success: false,
				message: "Missing projectId. Provide projectId or ensure runtime project context is set.",
				projectId: null,
				totalThemes: 0,
				topThemes: [],
			};
		}

		try {
			const { data: themeLinks, error: themeLinksError } = await supabase
				.from("theme_evidence")
				.select("theme_id, evidence_id")
				.eq("project_id", projectId);

			if (themeLinksError) {
				throw themeLinksError;
			}

			const evidenceIdsByTheme = new Map<string, Set<string>>();
			for (const row of (themeLinks ?? []) as ThemeLinkRow[]) {
				if (!row.theme_id || !row.evidence_id) continue;
				const existing = evidenceIdsByTheme.get(row.theme_id) ?? new Set<string>();
				existing.add(row.evidence_id);
				evidenceIdsByTheme.set(row.theme_id, existing);
			}

			const themeIds = Array.from(evidenceIdsByTheme.keys());
			if (themeIds.length === 0) {
				return {
					success: true,
					message: "No themes with evidence links were found for this project.",
					projectId,
					totalThemes: 0,
					topThemes: [],
				};
			}

			const { data: themes, error: themesError } = await supabase
				.from("themes")
				.select("id, name, statement, updated_at")
				.eq("project_id", projectId)
				.in("id", themeIds);

			if (themesError) {
				throw themesError;
			}

			const sortedThemes = ((themes ?? []) as ThemeRow[])
				.map((theme) => ({
					...theme,
					evidenceCount: evidenceIdsByTheme.get(theme.id)?.size ?? 0,
				}))
				.sort((a, b) => {
					if (b.evidenceCount !== a.evidenceCount) {
						return b.evidenceCount - a.evidenceCount;
					}
					const aDate = a.updated_at ? Date.parse(a.updated_at) : 0;
					const bDate = b.updated_at ? Date.parse(b.updated_at) : 0;
					return bDate - aDate;
				});

			const selectedThemes = sortedThemes.slice(0, limit);
			const selectedThemeIds = new Set(selectedThemes.map((theme) => theme.id));

			const selectedEvidenceIds = new Set<string>();
			for (const themeId of selectedThemeIds) {
				const evidenceIds = evidenceIdsByTheme.get(themeId);
				if (!evidenceIds) continue;
				for (const evidenceId of evidenceIds) {
					selectedEvidenceIds.add(evidenceId);
				}
			}

			const selectedEvidenceIdList = Array.from(selectedEvidenceIds);
			const { data: evidenceRows, error: evidenceError } = selectedEvidenceIdList.length
				? await supabase.from("evidence").select("id, interview_id").in("id", selectedEvidenceIdList)
				: { data: [], error: null };

			if (evidenceError) {
				throw evidenceError;
			}

			const evidenceInterviewMap = new Map<string, string>();
			const interviewIds = new Set<string>();
			for (const evidence of (evidenceRows ?? []) as EvidenceRow[]) {
				if (!evidence.id || !evidence.interview_id) continue;
				evidenceInterviewMap.set(evidence.id, evidence.interview_id);
				interviewIds.add(evidence.interview_id);
			}

			const [facetPeopleResult, evidencePeopleResult, interviewPeopleResult] = await Promise.all([
				selectedEvidenceIdList.length
					? supabase
							.from("evidence_facet")
							.select("evidence_id, person_id")
							.eq("project_id", projectId)
							.in("evidence_id", selectedEvidenceIdList)
							.not("person_id", "is", null)
					: Promise.resolve({ data: [], error: null }),
				selectedEvidenceIdList.length
					? supabase
							.from("evidence_people")
							.select("evidence_id, person_id")
							.eq("project_id", projectId)
							.in("evidence_id", selectedEvidenceIdList)
					: Promise.resolve({ data: [], error: null }),
				interviewIds.size
					? supabase
							.from("interview_people")
							.select("interview_id, person_id")
							.eq("project_id", projectId)
							.in("interview_id", Array.from(interviewIds))
					: Promise.resolve({ data: [], error: null }),
			]);

			if (facetPeopleResult.error) throw facetPeopleResult.error;
			if (evidencePeopleResult.error) throw evidencePeopleResult.error;
			if (interviewPeopleResult.error) throw interviewPeopleResult.error;

			const evidenceToPersons = new Map<string, Set<string>>();
			for (const row of (facetPeopleResult.data ?? []) as PersonLinkRow[]) {
				if (!row.evidence_id || !row.person_id) continue;
				const existing = evidenceToPersons.get(row.evidence_id) ?? new Set<string>();
				existing.add(row.person_id);
				evidenceToPersons.set(row.evidence_id, existing);
			}
			for (const row of (evidencePeopleResult.data ?? []) as PersonLinkRow[]) {
				if (!row.evidence_id || !row.person_id) continue;
				const existing = evidenceToPersons.get(row.evidence_id) ?? new Set<string>();
				existing.add(row.person_id);
				evidenceToPersons.set(row.evidence_id, existing);
			}

			const interviewToPersons = new Map<string, Set<string>>();
			for (const row of (interviewPeopleResult.data ?? []) as InterviewPersonRow[]) {
				if (!row.interview_id || !row.person_id) continue;
				const existing = interviewToPersons.get(row.interview_id) ?? new Set<string>();
				existing.add(row.person_id);
				interviewToPersons.set(row.interview_id, existing);
			}

			for (const evidenceId of selectedEvidenceIdList) {
				const interviewId = evidenceInterviewMap.get(evidenceId);
				if (!interviewId) continue;
				const interviewPersonIds = interviewToPersons.get(interviewId);
				if (!interviewPersonIds || interviewPersonIds.size === 0) continue;
				const existing = evidenceToPersons.get(evidenceId) ?? new Set<string>();
				for (const personId of interviewPersonIds) {
					existing.add(personId);
				}
				evidenceToPersons.set(evidenceId, existing);
			}

			const allPersonIds = new Set<string>();
			for (const personIds of evidenceToPersons.values()) {
				for (const personId of personIds) {
					allPersonIds.add(personId);
				}
			}

			const peopleById = new Map<string, PersonRow>();
			const personIdList = Array.from(allPersonIds);
			if (personIdList.length > 0) {
				const { data: peopleRows, error: peopleError } = await supabase
					.from("people")
					.select("id, name")
					.in("id", personIdList);
				if (peopleError) throw peopleError;
				for (const row of (peopleRows ?? []) as PersonRow[]) {
					peopleById.set(row.id, row);
				}
			}

			const projectPath = accountId ? `/a/${accountId}/${projectId}` : "";
			const routes = projectPath ? createRouteDefinitions(projectPath) : null;

			const topThemes = selectedThemes.map((theme) => {
				const evidenceIds = evidenceIdsByTheme.get(theme.id) ?? new Set<string>();
				const personMentions = new Map<string, number>();

				for (const evidenceId of evidenceIds) {
					const personIds = evidenceToPersons.get(evidenceId);
					if (!personIds) continue;
					for (const personId of personIds) {
						personMentions.set(personId, (personMentions.get(personId) ?? 0) + 1);
					}
				}

				const sortedPeople = Array.from(personMentions.entries())
					.sort((a, b) => b[1] - a[1])
					.slice(0, peoplePerTheme)
					.map(([personId, mentionCount]) => ({
						personId,
						name: peopleById.get(personId)?.name ?? null,
						mentionCount,
					}));

				return {
					themeId: theme.id,
					name: theme.name,
					statement: theme.statement ?? null,
					evidenceCount: theme.evidenceCount,
					peopleCount: personMentions.size,
					updatedAt: normalizeDate(theme.updated_at),
					url: routes ? `${HOST}${routes.themes.detail(theme.id)}` : null,
					people: sortedPeople,
				};
			});

			return {
				success: true,
				message: `Found ${sortedThemes.length} total themes. Returning top ${topThemes.length}.`,
				projectId,
				totalThemes: sortedThemes.length,
				topThemes,
			};
		} catch (error) {
			consola.error("fetch-top-themes-with-people: unexpected error", error);
			return {
				success: false,
				message: "Unexpected error while fetching top themes and people.",
				projectId,
				totalThemes: 0,
				topThemes: [],
			};
		}
	},
});
