/**
 * Enrich Person Data Tool
 *
 * Mastra agent tool that researches a person via web search to fill
 * missing professional fields. Used by the ICP agent and batch
 * enrichment pipeline.
 *
 * IMPORTANT: Uses dynamic imports for ~/  paths per Mastra tool rules.
 */

import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";

export const enrichPersonDataTool = createTool({
	id: "enrich-person-data",
	description:
		"Research a person via web to fill missing professional data (title, company, role, industry). Use when ICP scoring is limited by incomplete data. Only fills null fields — never overwrites user-entered data.",
	inputSchema: z.object({
		personId: z.string().describe("Person ID to enrich"),
		accountId: z.string().nullish().describe("Account ID (from context if not provided)"),
		projectId: z.string().nullish().describe("Project ID (from context if not provided)"),
		writeToDb: z
			.boolean()
			.nullish()
			.transform((v) => v ?? true)
			.describe("Whether to persist enriched data to the database (default: true)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		enriched: z.boolean(),
		fieldsUpdated: z.array(z.string()),
		source: z.string(),
		confidence: z.number(),
		data: z.object({
			title: z.string().nullish(),
			role: z.string().nullish(),
			company: z.string().nullish(),
			industry: z.string().nullish(),
			companySize: z.string().nullish(),
			linkedinUrl: z.string().nullish(),
		}),
		error: z.string().optional(),
	}),
	execute: async (input, context?) => {
		const { enrichPersonData } = await import("../../features/people/services/enrichPersonData.server");
		const { createSupabaseAdminClient } = await import("../../lib/supabase/client.server");

		const accountId = input.accountId || context?.requestContext?.get?.("account_id");
		const projectId = input.projectId || context?.requestContext?.get?.("project_id");

		if (!accountId || !projectId) {
			return {
				success: false,
				enriched: false,
				fieldsUpdated: [],
				source: "none",
				confidence: 0,
				data: {},
				error: "Missing accountId or projectId",
			};
		}

		const supabase = createSupabaseAdminClient();

		// Load current person data for hints
		const { data: person, error: fetchError } = await supabase
			.from("people")
			.select("id, name, firstname, lastname, title, role, primary_email, linkedin_url, default_organization_id")
			.eq("id", input.personId)
			.eq("account_id", accountId)
			.single();

		if (fetchError || !person) {
			return {
				success: false,
				enriched: false,
				fieldsUpdated: [],
				source: "none",
				confidence: 0,
				data: {},
				error: fetchError?.message || "Person not found",
			};
		}

		// Get org name if linked
		let orgName: string | null = null;
		if (person.default_organization_id) {
			const { data: org } = await supabase
				.from("organizations")
				.select("name")
				.eq("id", person.default_organization_id)
				.single();
			orgName = org?.name ?? null;
		}

		// If person already has all key fields, skip
		if (person.title && orgName) {
			return {
				success: true,
				enriched: false,
				fieldsUpdated: [],
				source: "none",
				confidence: 1,
				data: {},
			};
		}

		// Run enrichment
		const result = await enrichPersonData({
			personId: person.id,
			accountId,
			knownName: person.name || [person.firstname, person.lastname].filter(Boolean).join(" ") || null,
			knownEmail: person.primary_email,
			knownCompany: orgName,
			knownTitle: person.title,
			knownLinkedIn: person.linkedin_url,
		});

		// Persist to DB if requested and enrichment found data
		if (input.writeToDb && result.enriched) {
			const updates: Record<string, string | null> = {};

			// Only fill null fields — never overwrite existing data
			if (result.data.title && !person.title) {
				updates.title = result.data.title;
			}
			if (result.data.role && !person.role) {
				updates.role = result.data.role;
			}
			if (result.data.linkedinUrl && !person.linkedin_url) {
				updates.linkedin_url = result.data.linkedinUrl;
			}

			if (Object.keys(updates).length > 0) {
				const { error: updateError } = await supabase
					.from("people")
					.update({
						...updates,
						updated_at: new Date().toISOString(),
					})
					.eq("id", person.id)
					.eq("account_id", accountId);

				if (updateError) {
					consola.error(`[enrich-person-data] Failed to update person ${person.id}:`, updateError);
					return {
						success: false,
						...result,
						error: `Enrichment found data but failed to save: ${updateError.message}`,
					};
				}

				consola.success(`[enrich-person-data] Updated person ${person.id}:`, Object.keys(updates));
			}
		}

		return {
			success: true,
			...result,
		};
	},
});
