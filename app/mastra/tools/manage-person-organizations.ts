import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import type { Database } from "~/types";

const relationshipSchema = z.object({
	organizationName: z.string().min(1, "Organization name is required"),
	role: z.string().nullish(), // Allow null, undefined, or string
	relationshipStatus: z.string().nullish(),
	isPrimary: z.boolean().nullish(),
	notes: z.string().nullish(),
	location: z.string().nullish(),
});

const extractionSchema = z.object({
	summary: z.string().optional(),
	relationships: z.array(relationshipSchema).default([]),
});

const toolInputSchema = z
	.object({
		personId: z.string(),
		accountId: z.string().optional(),
		projectId: z.string().optional(),
		transcript: z
			.string()
			.nullish()
			.describe("Natural language text describing one or more organization relationships."),
		relationships: z.array(relationshipSchema).optional(),
		defaultIsPrimary: z
			.boolean()
			.nullish()
			.describe("Fallback flag applied when a relationship omits isPrimary (defaults to false)."),
		dryRun: z.boolean().optional(),
	})
	.refine(
		(value) => {
			const hasTranscript = typeof value.transcript === "string" && value.transcript.trim().length > 0;
			const hasRelationships = Array.isArray(value.relationships) && value.relationships.length > 0;
			return hasTranscript || hasRelationships;
		},
		{
			message: "Provide either a transcript or at least one relationship.",
			path: ["transcript"],
		}
	);

const toolOutputSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	personId: z.string().nullable(),
	accountId: z.string().nullable(),
	projectId: z.string().nullable(),
	generatedSummary: z.string().nullable().optional(),
	createdOrganizations: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
			})
		)
		.optional(),
	linkedOrganizations: z
		.array(
			z.object({
				organizationId: z.string(),
				name: z.string(),
				role: z.string().nullable(),
				relationshipStatus: z.string().nullable(),
				isPrimary: z.boolean(),
				action: z.enum(["inserted", "updated"]),
			})
		)
		.optional(),
	warnings: z.array(z.string()).optional(),
	dryRun: z.boolean().optional(),
});

type ToolInput = z.infer<typeof toolInputSchema>;
type Relationship = z.infer<typeof relationshipSchema>;

function normalizeName(name: string | null | undefined): string {
	return (name ?? "").trim();
}

async function fetchPerson(
	db: SupabaseClient<Database>,
	personId: string
): Promise<Pick<Database["public"]["Tables"]["people"]["Row"], "id" | "name" | "account_id" | "project_id"> | null> {
	const { data, error } = await db
		.from("people")
		.select("id, name, account_id, project_id")
		.eq("id", personId)
		.maybeSingle();
	if (error) throw new Error(`Failed to load person: ${error.message}`);
	return data ?? null;
}

async function ensureOrganization(
	db: SupabaseClient<Database>,
	{
		accountId,
		projectId,
		name,
		location,
	}: {
		accountId: string;
		projectId: string | null;
		name: string;
		location?: string | null;
	}
) {
	const trimmed = normalizeName(name);
	if (!trimmed) return null;

	const { data: existing } = await db
		.from("organizations")
		.select("id, name")
		.eq("account_id", accountId)
		.ilike("name", trimmed)
		.order("updated_at", { ascending: false })
		.limit(1);

	if (existing && existing.length > 0) {
		return { ...existing[0], created: false as const };
	}

	const insertPayload: Database["public"]["Tables"]["organizations"]["Insert"] = {
		account_id: accountId,
		project_id: projectId,
		name: trimmed,
		headquarters_location: location ?? null,
	};

	const { data: inserted, error } = await db.from("organizations").insert(insertPayload).select("id, name").single();
	if (error) throw new Error(`Failed to create organization "${trimmed}": ${error.message}`);
	return { ...inserted, created: true as const };
}

async function upsertPersonOrganizationLink(
	db: SupabaseClient<Database>,
	{
		accountId,
		projectId,
		personId,
		organizationId,
		relationship,
		defaultIsPrimary = false,
	}: {
		accountId: string;
		projectId: string | null;
		personId: string;
		organizationId: string;
		relationship: Relationship;
		defaultIsPrimary?: boolean;
	}
) {
	const { data: existing } = await db
		.from("people_organizations")
		.select("id")
		.eq("person_id", personId)
		.eq("organization_id", organizationId)
		.maybeSingle();

	const payload: Database["public"]["Tables"]["people_organizations"]["Insert"] = {
		account_id: accountId,
		project_id: projectId,
		person_id: personId,
		organization_id: organizationId,
		job_title: relationship.role ?? null,
		relationship_status: relationship.relationshipStatus ?? null,
		is_primary: relationship.isPrimary ?? defaultIsPrimary ?? false,
		notes: relationship.notes ?? null,
	};

	const { data, error } = await db
		.from("people_organizations")
		.upsert(payload, { onConflict: "person_id,organization_id" })
		.select("id")
		.single();

	if (error) throw new Error(`Failed to link person to organization: ${error.message}`);
	return {
		id: data.id,
		action: existing ? ("updated" as const) : ("inserted" as const),
	};
}

async function extractRelationships(personName: string, transcript: string) {
	const prompt = `
You maintain CRM style organization data for a research participant.

Identify each organization the person is affiliated with based on the text. Include their role/title with the org, whether it appears to be a current or past relationship, if they appear to be the primary employer, and any helpful notes (include dates or divisions if mentioned).

Person name: ${personName || "Unknown"}

Transcript:
"""
${transcript}
"""
`;

	const { object } = await generateObject({
		model: openai("gpt-4o-mini"),
		mode: "json",
		schema: extractionSchema,
		prompt,
	});

	return object;
}

export const managePersonOrganizationsTool = createTool({
	id: "manage-person-organizations",
	description:
		"Link a person to organizations (employers, affiliations, partnerships). Use this when updating where someone works or their organizational relationships. Parses transcripts to find employer/affiliation info, creates organization entities if needed, and records the relationship details (role, status, primary flag).",
	inputSchema: toolInputSchema,
	outputSchema: toolOutputSchema,
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;

		const {
			personId,
			accountId: accountOverride,
			projectId: projectOverride,
			transcript,
			relationships,
			dryRun,
		} = input as ToolInput;

		const defaultIsPrimary =
			typeof (input as ToolInput).defaultIsPrimary === "boolean" ? (input as ToolInput).defaultIsPrimary : false;

		const runtimeAccountId = context?.requestContext?.get?.("account_id");
		const runtimeProjectId = context?.requestContext?.get?.("project_id");

		if (!personId?.trim()) {
			return {
				success: false,
				message: "personId is required.",
				personId: null,
				accountId: null,
				projectId: null,
			};
		}

		try {
			const person = await fetchPerson(supabase, personId);
			if (!person) {
				return {
					success: false,
					message: "Person not found.",
					personId,
					accountId: accountOverride ?? runtimeAccountId ?? null,
					projectId: projectOverride ?? runtimeProjectId ?? null,
				};
			}

			const resolvedAccountId = accountOverride || runtimeAccountId || person.account_id || "";
			const resolvedProjectId = projectOverride || runtimeProjectId || person.project_id || null;

			if (!resolvedAccountId) {
				return {
					success: false,
					message: "Unable to determine account context for this person.",
					personId,
					accountId: null,
					projectId: resolvedProjectId,
				};
			}

			let extractedSummary: string | null = null;
			let relationshipSpecs: Relationship[] = [];

			if (Array.isArray(relationships) && relationships.length > 0) {
				relationshipSpecs = relationships;
			} else if (transcript?.trim()) {
				const extraction = await extractRelationships(person.name ?? "", transcript.trim());
				extractedSummary = extraction.summary ?? null;
				relationshipSpecs = extraction.relationships;
			}

			const normalizedRelationships = relationshipSpecs
				.map((rel) => ({
					...rel,
					organizationName: normalizeName(rel.organizationName),
					role: normalizeName(rel.role),
					relationshipStatus: normalizeName(rel.relationshipStatus),
					notes: rel.notes?.trim() || undefined,
					location: normalizeName(rel.location),
				}))
				.filter((rel) => rel.organizationName.length > 0);

			if (!normalizedRelationships.length) {
				return {
					success: false,
					message: "No organization relationships were detected in the provided input.",
					personId,
					accountId: resolvedAccountId,
					projectId: resolvedProjectId,
					generatedSummary: extractedSummary,
				};
			}

			const createdOrganizations: Array<{ id: string; name: string }> = [];
			const linkedOrganizations: Array<{
				organizationId: string;
				name: string;
				role: string | null;
				relationshipStatus: string | null;
				isPrimary: boolean;
				action: "inserted" | "updated";
			}> = [];

			const warnings: string[] = [];

			for (const rel of normalizedRelationships) {
				try {
					const organization = await ensureOrganization(supabase, {
						accountId: resolvedAccountId,
						projectId: resolvedProjectId,
						name: rel.organizationName,
						location: rel.location,
					});

					if (!organization) {
						warnings.push("Skipped empty organization name entry.");
						continue;
					}

					if (!dryRun) {
						const { action } = await upsertPersonOrganizationLink(supabase, {
							accountId: resolvedAccountId,
							projectId: resolvedProjectId,
							personId: person.id,
							organizationId: organization.id,
							relationship: rel,
							defaultIsPrimary,
						});

						linkedOrganizations.push({
							organizationId: organization.id,
							name: organization.name,
							role: rel.role ?? null,
							relationshipStatus: rel.relationshipStatus ?? null,
							isPrimary: rel.isPrimary ?? defaultIsPrimary ?? false,
							action,
						});
					} else {
						linkedOrganizations.push({
							organizationId: organization.id,
							name: organization.name,
							role: rel.role ?? null,
							relationshipStatus: rel.relationshipStatus ?? null,
							isPrimary: rel.isPrimary ?? defaultIsPrimary ?? false,
							action: "inserted",
						});
					}

					if (organization.created && !createdOrganizations.find((org) => org.id === organization.id)) {
						createdOrganizations.push({
							id: organization.id,
							name: organization.name,
						});
					}
				} catch (error) {
					consola.warn("manage-person-organizations: failed to process relationship", {
						personId,
						organizationName: rel.organizationName,
						error,
					});
					warnings.push(
						`Failed to process organization "${rel.organizationName}": ${
							error instanceof Error ? error.message : "Unknown error"
						}`
					);
				}
			}

			return {
				success: warnings.length === 0,
				message: dryRun
					? "Dry run complete. Relationships were parsed but not saved."
					: "Person organization links updated.",
				personId: person.id,
				accountId: resolvedAccountId,
				projectId: resolvedProjectId,
				generatedSummary: extractedSummary,
				createdOrganizations,
				linkedOrganizations,
				warnings,
				dryRun: Boolean(dryRun),
			};
		} catch (error) {
			consola.error("manage-person-organizations: unexpected failure", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to update person organizations.",
				personId,
				accountId: accountOverride ?? runtimeAccountId ?? null,
				projectId: projectOverride ?? runtimeProjectId ?? null,
			};
		}
	},
});
