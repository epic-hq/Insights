import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { getThemes } from "~/features/themes/db";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import { HOST } from "~/paths";
import { themeDetailSchema } from "~/schemas";
import type { Database } from "~/types";
import { createRouteDefinitions } from "~/utils/route-definitions";

export const fetchThemesTool = createTool({
	id: "fetch-themes",
	description:
		"Fetch themes from a project with filtering and evidence counts. Themes represent recurring patterns or topics identified in research data.",
	inputSchema: z.object({
		projectId: z
			.string()
			.nullish()
			.describe("Project ID to fetch themes from. Defaults to the current project in context."),
		themeSearch: z.string().nullish().describe("Case-insensitive search string to match theme names or statements."),
		limit: z.number().int().min(1).max(100).nullish().describe("Maximum number of themes to return."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable().optional(),
		themes: z.array(themeDetailSchema),
		totalCount: z.number(),
		searchApplied: z.string().nullable(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;
		const runtimeProjectId = context?.requestContext?.get?.("project_id");
		const runtimeAccountId = context?.requestContext?.get?.("account_id");

		const projectId = input.projectId ?? runtimeProjectId ?? null;
		const themeSearch = input.themeSearch ?? "";
		const limit = input.limit ?? 50;

		const sanitizedThemeSearch = themeSearch.trim().toLowerCase();

		consola.debug("fetch-themes: execute start", {
			projectId,
			accountId: runtimeAccountId,
			themeSearch: sanitizedThemeSearch,
			limit,
		});

		if (!projectId) {
			consola.warn("fetch-themes: missing projectId");
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				projectId: null,
				themes: [],
				totalCount: 0,
				searchApplied: null,
			};
		}

		try {
			// Use the centralized database function
			const projectIdStr = projectId as string;
			const accountIdStr = runtimeAccountId as string;
			const { data: themesData, error } = await getThemes({
				supabase,
				projectId: projectIdStr,
			});

			if (error) {
				consola.error("fetch-themes: failed to fetch themes", error);
				throw error;
			}

			// Generate route definitions for URL generation
			const projectPath = accountIdStr && projectIdStr ? `/a/${accountIdStr}/${projectIdStr}` : "";
			const routes = createRouteDefinitions(projectPath);

			let themes = (themesData || []).map((theme) => ({
				id: theme.id,
				name: theme.name,
				statement: theme.statement,
				inclusionCriteria: theme.inclusion_criteria,
				exclusionCriteria: theme.exclusion_criteria,
				synonyms: theme.synonyms,
				antiExamples: theme.anti_examples,
				evidenceCount: Array.isArray(theme.theme_evidence)
					? theme.theme_evidence.length
					: typeof theme.theme_evidence === "number"
						? theme.theme_evidence
						: 0,
				createdAt: theme.created_at ? new Date(theme.created_at).toISOString() : null,
				updatedAt: theme.updated_at ? new Date(theme.updated_at).toISOString() : null,
				url: projectPath ? `${HOST}${routes.themes.detail(theme.id)}` : null,
			}));

			// Apply search filtering if provided
			if (sanitizedThemeSearch) {
				themes = themes.filter((theme) => {
					const searchableText = [theme.name, theme.statement, theme.inclusionCriteria, theme.exclusionCriteria]
						.filter(Boolean)
						.join(" ")
						.toLowerCase();

					return (
						searchableText.includes(sanitizedThemeSearch) ||
						theme.synonyms?.some((synonym) => synonym.toLowerCase().includes(sanitizedThemeSearch)) ||
						theme.antiExamples?.some((example) => example.toLowerCase().includes(sanitizedThemeSearch))
					);
				});
			}

			// Apply limit
			const limitedThemes = themes.slice(0, limit);

			const message = sanitizedThemeSearch
				? `Found ${limitedThemes.length} themes matching "${themeSearch}".`
				: `Retrieved ${limitedThemes.length} themes.`;

			return {
				success: true,
				message,
				projectId: projectIdStr,
				themes: limitedThemes,
				totalCount: themes.length,
				searchApplied: sanitizedThemeSearch || null,
			};
		} catch (error) {
			consola.error("fetch-themes: unexpected error", error);
			return {
				success: false,
				message: "Unexpected error fetching themes.",
				projectId,
				themes: [],
				totalCount: 0,
				searchApplied: null,
			};
		}
	},
});
