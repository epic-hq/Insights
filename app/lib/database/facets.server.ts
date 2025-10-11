import slugify from "@sindresorhus/slugify"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type {
	FacetCatalog,
	FacetCatalogEntry,
	FacetCatalogKind,
	PersonFacetObservation,
	PersonScaleObservation,
} from "~/../baml_client/types"
import type { Database } from "~/../supabase/types"

const GLOBAL_PREFIX = "g:"
const ACCOUNT_PREFIX = "a:"

export interface FacetCatalogOptions {
	db: SupabaseClient<Database>
	accountId: string
	projectId: string
}

export interface PersistFacetObservationsOptions {
	db: SupabaseClient<Database>
	accountId: string
	projectId: string
	observations: Array<{
		personId: string
		facets?: PersonFacetObservation[] | null
		scales?: PersonScaleObservation[] | null
	}>
	evidenceIds: string[]
	reviewerId?: string | null
}

export async function getFacetCatalog({ db, accountId, projectId }: FacetCatalogOptions): Promise<FacetCatalog> {
	const [{ data: kindRows, error: kindError }, { data: globalRows, error: globalError }] = await Promise.all([
		db.from("facet_kind_global").select("id, slug, label, updated_at").order("id"),
		db.from("facet_global").select("id, kind_id, slug, label, synonyms, updated_at"),
	])

	if (kindError) throw new Error(`Failed to load facet kinds: ${kindError.message}`)
	if (globalError) throw new Error(`Failed to load global facets: ${globalError.message}`)

	const [{ data: accountRows, error: accountError }, { data: projectRows, error: projectError }] = await Promise.all([
		db
			.from("facet_account")
			.select("id, kind_id, global_facet_id, slug, label, synonyms, updated_at")
			.eq("account_id", accountId),
		db
			.from("project_facet")
			.select("facet_ref, scope, kind_slug, label, synonyms, is_enabled, alias, pinned, sort_weight, updated_at")
			.eq("project_id", projectId),
	])

	if (accountError) throw new Error(`Failed to load account facets: ${accountError.message}`)
	if (projectError) throw new Error(`Failed to load project facet configuration: ${projectError.message}`)

	const kinds: FacetCatalogKind[] = (kindRows ?? []).map((row) => ({ slug: row.slug, label: row.label }))

	const kindIdToSlug = new Map<number, string>((kindRows ?? []).map((row) => [row.id, row.slug]))

	const entries = new Map<string, FacetCatalogEntry>()
	const disabled = new Set<string>()
	let newestTimestamp = getMaxTimestamp(kindRows ?? [])

	for (const row of globalRows ?? []) {
		const facetRef = `${GLOBAL_PREFIX}${row.id}`
		entries.set(facetRef, {
			facet_ref: facetRef,
			kind_slug: kindIdToSlug.get(row.kind_id) ?? "",
			label: row.label,
			synonyms: row.synonyms ?? [],
		})
		newestTimestamp = maxTimestamp(newestTimestamp, row.updated_at)
	}

	for (const row of accountRows ?? []) {
		const facetRef = `${ACCOUNT_PREFIX}${row.id}`
		entries.set(facetRef, {
			facet_ref: facetRef,
			kind_slug: kindIdToSlug.get(row.kind_id) ?? "",
			label: row.label,
			synonyms: row.synonyms ?? [],
		})
		newestTimestamp = maxTimestamp(newestTimestamp, row.updated_at)
	}

	const projectSpecific: FacetCatalogEntry[] = []

	for (const row of projectRows ?? []) {
		newestTimestamp = maxTimestamp(newestTimestamp, row.updated_at)
		if (row.scope === "catalog") {
			if (row.is_enabled === false) {
				disabled.add(row.facet_ref)
				continue
			}
			const base = entries.get(row.facet_ref)
			if (base) {
				entries.set(row.facet_ref, {
					...base,
					alias: row.alias ?? base.alias,
					synonyms: Array.isArray(row.synonyms) && row.synonyms.length ? row.synonyms : base.synonyms,
				})
			}
		} else if (row.scope === "project" && row.is_enabled !== false) {
			projectSpecific.push({
				facet_ref: row.facet_ref,
				kind_slug: row.kind_slug ?? "",
				label: row.label ?? "",
				synonyms: row.synonyms ?? [],
				alias: row.alias ?? undefined,
			})
		}
	}

	const facets: FacetCatalogEntry[] = []
	for (const [facetRef, entry] of entries) {
		if (disabled.has(facetRef)) continue
		if (!entry.kind_slug || !entry.label) continue
		facets.push(entry)
	}

	facets.push(...projectSpecific.filter((entry) => entry.label && entry.kind_slug))

	const version = `acct:${accountId}:proj:${projectId}:v${Number(newestTimestamp ?? Date.now())}`

	return {
		kinds,
		facets,
		version,
	}
}

export async function persistFacetObservations({
	db,
	accountId,
	projectId,
	observations,
	evidenceIds,
	reviewerId = null,
}: PersistFacetObservationsOptions): Promise<void> {
	const facetRows: Array<
		{
			person_id: string
			facet_ref: string
			source: string
			evidence_id: string | null
			confidence: number
			noted_at: string
		} & { account_id: string; project_id: string }
	> = []
	const scaleRows: Array<
		{
			person_id: string
			kind_slug: string
			score: number
			band: string | null
			source: string
			evidence_id: string | null
			confidence: number
			noted_at: string
		} & { account_id: string; project_id: string }
	> = []
	const candidatePayloads: Array<{
		account_id: string
		project_id: string
		person_id?: string | null
		kind_slug: string
		label: string
		synonyms: string[]
		source: string
		evidence_id?: string | null
		notes?: string | null
	}> = []

	for (const { personId, facets, scales } of observations) {
		if (Array.isArray(facets)) {
			for (const obs of facets) {
				const source = obs.source ?? "interview"
				const evidenceIndex = obs.evidence_unit_index ?? null
				const evidenceId =
					evidenceIndex !== null && evidenceIndex !== undefined ? (evidenceIds[evidenceIndex] ?? null) : null
				const confidence = normalizeConfidence(obs.confidence)
				if (obs.facet_ref?.trim().length) {
					facetRows.push({
						account_id: accountId,
						project_id: projectId,
						person_id: personId,
						facet_ref: obs.facet_ref.trim(),
						source,
						evidence_id: evidenceId,
						confidence,
						noted_at: new Date().toISOString(),
					})
				} else if (obs.candidate?.label && obs.candidate.kind_slug) {
					candidatePayloads.push({
						account_id: accountId,
						project_id: projectId,
						person_id: personId,
						kind_slug: obs.candidate.kind_slug,
						label: obs.candidate.label,
						synonyms: obs.candidate.synonyms ?? [],
						source,
						evidence_id: evidenceId,
						notes: obs.candidate.notes ? obs.candidate.notes.filter(Boolean).join("\n") : null,
					})
				}
			}
		}

		if (Array.isArray(scales)) {
			for (const scale of scales) {
				if (!scale.kind_slug) continue
				const evidenceIndex = scale.evidence_unit_index ?? null
				const evidenceId =
					evidenceIndex !== null && evidenceIndex !== undefined ? (evidenceIds[evidenceIndex] ?? null) : null
				scaleRows.push({
					account_id: accountId,
					project_id: projectId,
					person_id: personId,
					kind_slug: scale.kind_slug,
					score: clampScore(scale.score),
					band: scale.band ?? null,
					source: scale.source ?? "interview",
					evidence_id: evidenceId,
					confidence: normalizeConfidence(scale.confidence),
					noted_at: new Date().toISOString(),
				})
			}
		}
	}

	if (candidatePayloads.length) {
		const { data: insertedCandidates, error: candidateError } = await db
			.from("facet_candidate")
			.upsert(candidatePayloads, { onConflict: "account_id,project_id,kind_slug,label", ignoreDuplicates: false })
			.select("id, account_id, project_id, person_id, kind_slug, label, synonyms, notes, status, source")

		if (candidateError) {
			consola.warn("Failed to upsert facet candidates", candidateError.message)
		}

		if (insertedCandidates?.length) {
			await autoApproveCandidates({
				db,
				candidates: insertedCandidates,
				reviewerId,
			})
		}
	}

	if (facetRows.length) {
		const { error: facetError } = await db.from("person_facet").upsert(
			facetRows.map((row) => ({
				account_id: row.account_id,
				project_id: row.project_id,
				person_id: row.person_id,
				facet_ref: row.facet_ref,
				source: row.source,
				evidence_id: row.evidence_id,
				confidence: row.confidence,
				noted_at: row.noted_at,
			})),
			{ onConflict: "person_id,facet_ref" }
		)
		if (facetError) consola.warn("Failed to upsert person facets", facetError.message)
	}

	if (scaleRows.length) {
		const { error: scaleError } = await db.from("person_scale").upsert(
			scaleRows.map((row) => ({
				account_id: row.account_id,
				project_id: row.project_id,
				person_id: row.person_id,
				kind_slug: row.kind_slug,
				score: row.score,
				band: row.band,
				source: row.source,
				evidence_id: row.evidence_id,
				confidence: row.confidence,
				noted_at: row.noted_at,
			})),
			{ onConflict: "person_id,kind_slug" }
		)
		if (scaleError) consola.warn("Failed to upsert person scales", scaleError.message)
	}
}

interface CandidateRow
	extends Pick<
		Database["public"]["Tables"]["facet_candidate"]["Row"],
		| "id"
		| "account_id"
		| "project_id"
		| "person_id"
		| "kind_slug"
		| "label"
		| "synonyms"
		| "notes"
		| "status"
		| "source"
	> {}

interface AutoApproveOptions {
	db: SupabaseClient<Database>
	candidates: CandidateRow[]
	reviewerId: string | null
}

async function autoApproveCandidates({ db, candidates, reviewerId }: AutoApproveOptions) {
	if (!candidates.length) return

	const { data: kindRows, error: kindError } = await db.from("facet_kind_global").select("id, slug")
	if (kindError || !kindRows?.length) {
		consola.warn("Skipping auto-approval; unable to load facet kinds", kindError?.message)
		return
	}

	const kindMap = new Map<string, number>()
	kindRows.forEach((row) => {
		if (row.slug) kindMap.set(row.slug, row.id)
	})

	for (const candidate of candidates) {
		if (candidate.status === "approved") continue
		const kindId = kindMap.get(candidate.kind_slug)
		if (!kindId) {
			consola.warn("Unknown facet kind; skipping candidate", candidate.kind_slug)
			continue
		}

		const baseSlug = slugify(candidate.label, { separator: "_" }) || `facet-${candidate.id.slice(0, 8)}`
		let slugCandidate = baseSlug
		let accountFacetId: number | null = null

		// Check for existing account facet with same slug
		const { data: existingFacet } = await db
			.from("facet_account")
			.select("id, slug")
			.eq("account_id", candidate.account_id)
			.eq("kind_id", kindId)
			.eq("slug", slugCandidate)
			.maybeSingle()

		if (existingFacet?.id) {
			accountFacetId = existingFacet.id
			slugCandidate = existingFacet.slug
		} else {
			// Attempt to insert, retrying with numeric suffix if slug conflict
			for (let attempt = 0; attempt < 5 && !accountFacetId; attempt++) {
				const slugWithSuffix = attempt === 0 ? slugCandidate : `${slugCandidate}-${attempt + 1}`
				const { data: insertedFacet, error: insertError } = await db
					.from("facet_account")
					.insert({
						account_id: candidate.account_id,
						kind_id: kindId,
						slug: slugWithSuffix,
						label: candidate.label,
						synonyms: candidate.synonyms ?? [],
						description: candidate.notes ?? null,
					})
					.select("id, slug")
					.single()

				if (insertError) {
					if (insertError.code === "23505") {
						continue
					}
					consola.warn("Failed to insert account facet", insertError.message)
					break
				}

				if (insertedFacet?.id) {
					accountFacetId = insertedFacet.id
					slugCandidate = insertedFacet.slug
				}
			}
		}

		if (!accountFacetId) {
			consola.warn("Unable to create or find account facet for candidate", candidate.id)
			continue
		}

		const facetRef = `a:${accountFacetId}`

		await db.from("project_facet").upsert(
			{
				project_id: candidate.project_id,
				account_id: candidate.account_id,
				facet_ref: facetRef,
				scope: "catalog",
				is_enabled: true,
				alias: candidate.label,
				synonyms: candidate.synonyms ?? [],
			},
			{ onConflict: "project_id,facet_ref" }
		)

		await db
			.from("facet_candidate")
			.update({
				status: "approved",
				reviewed_at: new Date().toISOString(),
				reviewed_by: reviewerId,
				resolved_facet_ref: facetRef,
			})
			.eq("id", candidate.id)

		if (candidate.person_id) {
			await db.from("person_facet").upsert(
				{
					account_id: candidate.account_id,
					project_id: candidate.project_id,
					person_id: candidate.person_id,
					facet_ref: facetRef,
					source: candidate.source ?? "interview",
					confidence: 0.8,
					noted_at: new Date().toISOString(),
				},
				{ onConflict: "person_id,facet_ref" }
			)
		}

		consola.log("Auto-approved facet candidate", candidate.id, facetRef)
	}
}

function normalizeConfidence(conf?: number | null): number {
	if (typeof conf === "number" && !Number.isNaN(conf)) {
		return clampScore(conf)
	}
	return 0.8
}

function clampScore(value?: number | null): number {
	if (typeof value !== "number" || Number.isNaN(value)) return 0.8
	return Math.min(1, Math.max(0, value))
}

function getMaxTimestamp(rows: Array<{ updated_at?: string | null }> = []): number | null {
	let max: number | null = null
	for (const row of rows) {
		max = maxTimestamp(max, row.updated_at)
	}
	return max
}

function maxTimestamp(current: number | null, incoming?: string | null): number | null {
	if (!incoming) return current
	const next = new Date(incoming).getTime()
	if (Number.isNaN(next)) return current
	if (current === null || next > current) return next
	return current
}
