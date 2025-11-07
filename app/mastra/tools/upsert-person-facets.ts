import { openai } from "@ai-sdk/openai"
import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import { generateObject } from "ai"
import consola from "consola"
import { z } from "zod"
import { FacetResolver } from "~/lib/database/facets.server"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const DEFAULT_CONFIDENCE = 0.78
const ALLOWED_SOURCES = ["interview", "survey", "telemetry", "inferred", "manual", "document"] as const
type PersonFacetSource = (typeof ALLOWED_SOURCES)[number]

const manualFacetSchema = z.object({
	label: z.string().optional(),
	kindSlug: z.string().optional(),
	facetAccountId: z.number().optional(),
	synonyms: z.array(z.string()).optional(),
	confidence: z.number().min(0).max(1).optional(),
	action: z.enum(["add", "remove"]).optional(),
	reason: z.string().optional(),
})

const extractionSchema = z.object({
	summary: z.string().describe("One or two sentence recap of the participant facts."),
	facets: z
		.array(
			z.object({
				label: z.string(),
				kindSlug: z.string(),
				synonyms: z.array(z.string()).optional(),
				confidence: z.number().min(0).max(1).optional(),
				action: z.enum(["add", "remove"]).optional(),
				rationale: z.string().optional(),
			})
		)
		.default([]),
})

const outputFacetSchema = z.object({
	facetAccountId: z.number(),
	label: z.string(),
	kindSlug: z.string(),
	status: z.enum(["inserted", "updated", "skipped"]).optional(),
	confidence: z.number().optional(),
	source: z.string().optional(),
})

const toolInputSchema = z
	.object({
		personId: z.string().describe("ID of the person record to update."),
		projectId: z
			.string()
			.optional()
			.describe("Project context for the facet rows. Defaults to the runtime or person record project."),
		accountId: z.string().optional().describe("Account context. Defaults to runtime headers or the person record."),
		transcript: z
			.string()
			.optional()
			.describe("Free-form text or transcript describing the person. Used when explicit facets are not provided."),
		facts: z.array(manualFacetSchema).optional().describe("Optional structured facet facts to apply directly."),
		source: z.string().optional().describe("Source label to store on person_facet rows. Defaults to 'voice_note'."),
		mode: z
			.enum(["merge", "replace"])
			.optional()
			.describe("Merge keeps existing facets; replace removes unspecified ones after applying the new set."),
		confidence: z.number().min(0).max(1).optional().describe("Override default confidence for added facets."),
		dryRun: z.boolean().optional().describe("When true, returns the plan without writing to the database."),
	})
	.refine(
		(value) => {
			const hasTranscript = Boolean(value.transcript && value.transcript.trim().length > 0)
			const hasFacts = Array.isArray(value.facts) && value.facts.length > 0
			return hasTranscript || hasFacts
		},
		{
			message: "Provide either a transcript or at least one structured facet fact.",
			path: ["transcript"],
		}
	)

const toolOutputSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	personId: z.string().nullable(),
	projectId: z.string().nullable(),
	accountId: z.string().nullable(),
	generatedSummary: z.string().nullable().optional(),
	appliedFacets: z.array(outputFacetSchema).optional(),
	removedFacets: z
		.array(
			z.object({
				facetAccountId: z.number(),
				label: z.string().optional(),
				kindSlug: z.string().optional(),
				reason: z.string().optional(),
			})
		)
		.optional(),
	dryRun: z.boolean().optional(),
	warnings: z.array(z.string()).optional(),
})

type ToolInput = z.infer<typeof toolInputSchema>
type ManualFacet = z.infer<typeof manualFacetSchema>
type ExtractedFacet = z.infer<typeof extractionSchema>["facets"][number]

function normalizeLabel(value: string | null | undefined): string {
	return (value ?? "").replace(/\s+/g, " ").trim()
}

function labelKey(kindSlug: string, label: string): string {
	return `${kindSlug.toLowerCase()}|${normalizeLabel(label).toLowerCase()}`
}

function dedupStrings(values?: string[] | null): string[] {
	const seen = new Set<string>()
	for (const value of values ?? []) {
		const trimmed = normalizeLabel(value)
		if (trimmed) seen.add(trimmed)
	}
	return Array.from(seen)
}

function resolveSourceLabel(rawSource?: string | null): { source: PersonFacetSource; normalizedFrom?: string | null } {
	const candidate = normalizeLabel(rawSource)?.toLowerCase().replace(/\s+/g, "_")
	if (candidate && (ALLOWED_SOURCES as readonly string[]).includes(candidate)) {
		return { source: candidate as PersonFacetSource }
	}
	return { source: "manual", normalizedFrom: rawSource ?? null }
}

async function loadFacetKinds(db: SupabaseClient<Database>) {
	const { data, error } = await db.from("facet_kind_global").select("slug,label,description").order("id")
	if (error) throw new Error(`Failed to load facet kinds: ${error.message}`)
	return data ?? []
}

async function fetchExistingFacets(
	db: SupabaseClient<Database>,
	personId: string,
	accountId: string,
	projectId: string
) {
	const { data, error } = await db
		.from("person_facet")
		.select(
			"facet_account_id, source, confidence, facet:facet_account!inner(id,label,synonyms,facet_kind_global:facet_kind_global!inner(slug,label))"
		)
		.eq("person_id", personId)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
	if (error) throw new Error(`Failed to load existing person facets: ${error.message}`)
	return data ?? []
}

function buildPrompt({
	personName,
	transcript,
	kindSummaries,
}: {
	personName: string
	transcript: string
	kindSummaries: string
}) {
	return `
You extract durable person facets (stable attributes, demographics, roles, goals, affiliations) for a research CRM.

Allowed facet kinds:
${kindSummaries}

Rules:
- Prefer concrete nouns such as "Actor", "President of Joe's Writing Guild", or "Lives in Los Angeles".
- Use the most specific available kind slug. Geographic or demographic facts usually map to "demographic" or another explicit slug like "location" if present.
- Split multiple roles/titles into separate facets.
- Ignore temporary states, emotions, or speculative statements.
- Use action "remove" only if the transcript explicitly says the person no longer fits a previously known facet; otherwise default to "add".

Participant name: ${personName || "Unknown"}

Transcript:
"""
${transcript}
"""
`
}

async function runExtraction({
	personName,
	transcript,
	kindSummaries,
	allowedKindSlugs,
}: {
	personName: string
	transcript: string
	kindSummaries: string
	allowedKindSlugs: Set<string>
}) {
	const prompt = buildPrompt({ personName, transcript, kindSummaries })
	const { object } = await generateObject({
		model: openai("gpt-4o-mini"),
		mode: "json",
		schema: extractionSchema,
		prompt,
	})
	const filtered = (object.facets ?? []).filter((facet) => allowedKindSlugs.has(facet.kindSlug))
	return {
		summary: object.summary,
		facets: filtered,
	}
}

function normalizeManualFacets(facts: ManualFacet[] = []): ManualFacet[] {
	return facts
		.map((fact) => ({
			...fact,
			label: normalizeLabel(fact.label ?? ""),
			kindSlug: fact.kindSlug?.trim(),
			synonyms: dedupStrings(fact.synonyms),
		}))
		.filter((fact) => fact.action === "remove" || Boolean(fact.label && fact.kindSlug))
}

export const upsertPersonFacetsTool = createTool({
	id: "upsert-person-facets",
	description:
		"Extracts structured person facets from a transcript or structured facts and upserts them into the person_facet table, creating account facets when needed.",
	inputSchema: toolInputSchema,
	outputSchema: toolOutputSchema,
	execute: async ({ context, runtimeContext }) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>

		const runtimeProjectId = runtimeContext?.get?.("project_id")
		const runtimeAccountId = runtimeContext?.get?.("account_id")

		const {
			personId,
			transcript,
			facts,
			source: sourceInput,
			confidence,
			mode = "merge",
			projectId: projectIdInput,
			accountId: accountIdInput,
			dryRun = false,
		} = context as ToolInput

		const sourceResolution = resolveSourceLabel(sourceInput)
		const source = sourceResolution.source

		const personIdTrimmed = personId?.trim()
		if (!personIdTrimmed) {
			return {
				success: false,
				message: "personId is required.",
				personId: null,
				projectId: null,
				accountId: null,
			}
		}

		try {
			const { data: person, error: personError } = await supabase
				.from("people")
				.select("id, name, account_id, project_id")
				.eq("id", personIdTrimmed)
				.maybeSingle()
			if (personError) throw new Error(`Failed to load person: ${personError.message}`)
			if (!person) {
				return {
					success: false,
					message: `Person ${personIdTrimmed} not found.`,
					personId: personIdTrimmed,
					projectId: null,
					accountId: null,
				}
			}

			const resolvedAccountId = accountIdInput || runtimeAccountId || person.account_id
			const resolvedProjectId = projectIdInput || runtimeProjectId || person.project_id

			if (!resolvedAccountId || !resolvedProjectId) {
				return {
					success: false,
					message: "Missing account or project context for person facets.",
					personId: personIdTrimmed,
					projectId: resolvedProjectId ?? null,
					accountId: resolvedAccountId ?? null,
				}
			}

			const kindRows = await loadFacetKinds(supabase)
			const allowedKindSlugs = new Set(kindRows.map((row) => row.slug).filter(Boolean) as string[])
			const kindSummaries = kindRows
				.map((row) => `- ${row.slug}: ${row.label}${row.description ? ` — ${row.description}` : ""}`)
				.join("\n")

			const normalizedFacts = normalizeManualFacets(facts)
			let generatedSummary: string | null = null
			let generatedFacets: ExtractedFacet[] = []

			if (!normalizedFacts.length && transcript?.trim()) {
				try {
					const extraction = await runExtraction({
						personName: person.name ?? "",
						transcript: transcript.trim(),
						kindSummaries,
						allowedKindSlugs,
					})
					generatedSummary = extraction.summary
					generatedFacets = extraction.facets
				} catch (error) {
					consola.warn("upsert-person-facets: extraction failed", error)
					return {
						success: false,
						message: "Failed to extract facets from transcript.",
						personId: personIdTrimmed,
						projectId: resolvedProjectId,
						accountId: resolvedAccountId,
						warnings: ["LLM extraction failed. Provide structured facts or retry."],
					}
				}
			}

			const allFacetSpecs = [
				...generatedFacets.map<ManualFacet>((facet) => ({
					label: facet.label,
					kindSlug: facet.kindSlug,
					synonyms: facet.synonyms,
					confidence: facet.confidence,
					action: facet.action,
					reason: facet.rationale,
				})),
				...normalizedFacts,
			]

			const filteredSpecs: ManualFacet[] = []
			const seenKeys = new Set<string>()
			for (const spec of allFacetSpecs) {
				const action = spec.action ?? "add"
				const kindSlug = spec.kindSlug?.trim()
				const label = spec.label ?? ""
				if (action === "remove") {
					filteredSpecs.push({ ...spec, action })
					continue
				}
				if (!kindSlug || !label) continue
				if (!allowedKindSlugs.has(kindSlug)) continue
				const key = labelKey(kindSlug, label)
				if (seenKeys.has(key)) continue
				seenKeys.add(key)
				filteredSpecs.push({
					...spec,
					label,
					kindSlug,
					action: "add",
				})
			}

			if (!filteredSpecs.length) {
				return {
					success: false,
					message: "No actionable facets were found in the provided input.",
					personId: personIdTrimmed,
					projectId: resolvedProjectId,
					accountId: resolvedAccountId,
					generatedSummary,
				}
			}

			const existingFacetRows = await fetchExistingFacets(
				supabase,
				personIdTrimmed,
				resolvedAccountId,
				resolvedProjectId
			)
			const existingFacetIdSet = new Set(
				existingFacetRows
					.map((row) => row.facet_account_id)
					.filter((value): value is number => typeof value === "number")
			)
			const existingFacetLookup = new Map<string, number>()
			for (const row of existingFacetRows) {
				const facet = row.facet as {
					label?: string | null
					facet_kind_global?: { slug?: string | null } | null
				} | null
				const slug = facet?.facet_kind_global?.slug
				const label = facet?.label
				if (slug && label) {
					existingFacetLookup.set(labelKey(slug, label), row.facet_account_id)
				}
			}

			const resolver = new FacetResolver(supabase, resolvedAccountId)
			const additions: Array<{
				facetAccountId: number
				label: string
				kindSlug: string
				confidence: number
				status: "inserted" | "updated"
			}> = []
			const desiredFacetAccountIds = new Set<number>()
			const removalRecords: Array<{ facetAccountId: number; label?: string; kindSlug?: string; reason?: string }> = []
			const warnings: string[] = []
			if (sourceResolution.normalizedFrom) {
				warnings.push(
					`Source "${sourceResolution.normalizedFrom}" is not allowed; using "${source}" to satisfy database constraint.`
				)
			}

			for (const spec of filteredSpecs) {
				const action = spec.action ?? "add"
				if (action === "remove") {
					if (spec.facetAccountId) {
						removalRecords.push({
							facetAccountId: spec.facetAccountId,
							label: spec.label,
							kindSlug: spec.kindSlug,
							reason: spec.reason || "Marked for removal via tool input.",
						})
						continue
					}
					const key = spec.kindSlug && spec.label ? labelKey(spec.kindSlug, spec.label) : null
					if (key) {
						const existingId = existingFacetLookup.get(key)
						if (existingId) {
							removalRecords.push({
								facetAccountId: existingId,
								label: spec.label,
								kindSlug: spec.kindSlug,
								reason: spec.reason || "Matched existing facet for removal.",
							})
							continue
						}
					}
					warnings.push(
						`Removal request for "${spec.label ?? "unknown"}" (${spec.kindSlug ?? "unknown kind"}) did not match an existing facet.`
					)
					continue
				}

				const label = spec.label ?? ""
				const kindSlug = spec.kindSlug ?? ""
				const synonyms = dedupStrings(spec.synonyms)
				const confidenceValue =
					typeof spec.confidence === "number" ? spec.confidence : (confidence ?? DEFAULT_CONFIDENCE)

				const facetAccountId = await resolver.ensureFacet({
					kindSlug,
					label,
					synonyms,
				})

				if (!facetAccountId) {
					warnings.push(`Failed to ensure facet for "${label}" (${kindSlug}).`)
					continue
				}

				desiredFacetAccountIds.add(facetAccountId)
				additions.push({
					facetAccountId,
					label,
					kindSlug,
					confidence: confidenceValue,
					status: existingFacetIdSet.has(facetAccountId) ? "updated" : "inserted",
				})
			}

			let replaceRemovals: number[] = []
			if (mode === "replace") {
				const keepIds = new Set(desiredFacetAccountIds)
				replaceRemovals = Array.from(existingFacetIdSet).filter((id) => !keepIds.has(id))
				if (replaceRemovals.length) {
					removalRecords.push(
						...replaceRemovals.map((facetAccountId) => ({ facetAccountId, reason: "Replace mode cleanup" }))
					)
				}
			}

			const removalById = new Map<
				number,
				{ facetAccountId: number; label?: string; kindSlug?: string; reason?: string }
			>()
			for (const record of removalRecords) {
				removalById.set(record.facetAccountId, {
					facetAccountId: record.facetAccountId,
					label: record.label ?? removalById.get(record.facetAccountId)?.label,
					kindSlug: record.kindSlug ?? removalById.get(record.facetAccountId)?.kindSlug,
					reason: record.reason ?? removalById.get(record.facetAccountId)?.reason,
				})
			}
			const finalRemovals = Array.from(removalById.values())

			const now = new Date().toISOString()
			const rowsToUpsert = additions.map((entry) => ({
				account_id: resolvedAccountId,
				project_id: resolvedProjectId,
				person_id: personIdTrimmed,
				facet_account_id: entry.facetAccountId,
				source,
				confidence: entry.confidence,
				evidence_id: null,
				noted_at: now,
			}))

			if (!dryRun) {
				if (rowsToUpsert.length) {
					const { error: upsertError } = await supabase
						.from("person_facet")
						.upsert(rowsToUpsert, { onConflict: "person_id,facet_account_id" })
					if (upsertError) throw new Error(`Failed to upsert person facets: ${upsertError.message}`)
				}

				const removalIds = finalRemovals.map((item) => item.facetAccountId)
				if (removalIds.length) {
					const { error: deleteError } = await supabase
						.from("person_facet")
						.delete()
						.eq("person_id", personIdTrimmed)
						.eq("account_id", resolvedAccountId)
						.eq("project_id", resolvedProjectId)
						.in("facet_account_id", removalIds)
					if (deleteError) throw new Error(`Failed to remove person facets: ${deleteError.message}`)
				}
			}

			return {
				success: true,
				message: dryRun
					? "Dry run complete. Facet changes were calculated but not written."
					: "Person facets updated successfully.",
				personId: personIdTrimmed,
				projectId: resolvedProjectId,
				accountId: resolvedAccountId,
				generatedSummary,
				appliedFacets: additions.map((entry) => ({
					facetAccountId: entry.facetAccountId,
					label: entry.label,
					kindSlug: entry.kindSlug,
					status: entry.status,
					confidence: entry.confidence,
					source,
				})),
				removedFacets: finalRemovals,
				dryRun,
				warnings,
			}
		} catch (error) {
			consola.error("upsert-person-facets: unexpected failure", error)
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to upsert person facets.",
				personId: personIdTrimmed ?? null,
				projectId: projectIdInput ?? runtimeProjectId ?? null,
				accountId: accountIdInput ?? runtimeAccountId ?? null,
			}
		}
	},
})
