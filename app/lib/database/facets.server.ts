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

function normalizeLabel(label: string | null | undefined): string | null {
	if (!label) return null
	const trimmed = label.replace(/\s+/g, " ").trim()
	return trimmed.length ? trimmed : null
}

function normalizeSynonyms(synonyms: string[] | null | undefined): string[] {
	const seen = new Set<string>()
	for (const value of synonyms ?? []) {
		if (!value) continue
		const trimmed = value.replace(/\s+/g, " ").trim()
		if (trimmed.length) seen.add(trimmed)
	}
	return Array.from(seen)
}

export class FacetResolver {
	private kindSlugToId: Map<string, number> | null = null
	private kindIdToSlug: Map<number, string> | null = null
	private facetCacheBySlug = new Map<string, number>()
	private globalFacetCache = new Map<number, { label: string; kind_id: number; synonyms: string[] | null }>()

	constructor(
		private db: SupabaseClient<Database>,
		private accountId: string
	) {}

	private async loadKindMaps() {
		if (this.kindSlugToId && this.kindIdToSlug) return
		const { data, error } = await this.db.from("facet_kind_global").select("id, slug")
		if (error) throw new Error(`Failed to load facet kinds: ${error.message}`)
		const slugToId = new Map<string, number>()
		const idToSlug = new Map<number, string>()
		for (const row of data ?? []) {
			if (!row.slug) continue
			slugToId.set(row.slug, row.id)
			idToSlug.set(row.id, row.slug)
		}
		this.kindSlugToId = slugToId
		this.kindIdToSlug = idToSlug
	}

	private ensureSlug(kindId: number, label: string): string {
		const base = slugify(label, { separator: "_" }) || `facet_${kindId}_${Date.now()}`
		return base.toLowerCase()
	}

	async ensureFacetForRef(
		ref: string,
		fallback: { kindSlug?: string; label?: string; synonyms?: string[] } = {}
	): Promise<number | null> {
		if (!ref) return null
		const [prefix, rawId] = ref.split(":")
		if (!rawId) {
			return this.ensureFacet({
				kindSlug: fallback.kindSlug,
				label: fallback.label,
				synonyms: fallback.synonyms,
			})
		}
		const numericId = Number.parseInt(rawId, 10)
		if (Number.isNaN(numericId)) {
			return this.ensureFacet({
				kindSlug: fallback.kindSlug,
				label: fallback.label,
				synonyms: fallback.synonyms,
			})
		}

		if (prefix === ACCOUNT_PREFIX.slice(0, 1)) {
			const { data } = await this.db
				.from("facet_account")
				.select("id")
				.eq("id", numericId)
				.eq("account_id", this.accountId)
				.maybeSingle()
			return data?.id ?? null
		}

		if (prefix === GLOBAL_PREFIX.slice(0, 1)) {
			const globalFacet = await this.loadGlobalFacet(numericId)
			const label = normalizeLabel(globalFacet?.label ?? fallback.label)
			await this.loadKindMaps()
			const kindSlug = fallback.kindSlug ?? (globalFacet ? this.kindIdToSlug?.get(globalFacet.kind_id) : undefined)
			if (!label || !kindSlug) return null
			return this.ensureFacet({
				kindSlug,
				label,
				synonyms: globalFacet?.synonyms ?? fallback.synonyms ?? [],
				globalFacetId: numericId,
				isActive: true,
			})
		}

		return this.ensureFacet({
			kindSlug: fallback.kindSlug,
			label: fallback.label,
			synonyms: fallback.synonyms,
		})
	}

	async ensureFacet(options: {
		kindSlug?: string
		label?: string
		synonyms?: string[]
		globalFacetId?: number
		isActive?: boolean
	}): Promise<number | null> {
		const label = normalizeLabel(options.label)
		const kindSlug = options.kindSlug
		if (!label || !kindSlug) return null
		await this.loadKindMaps()
		const kindId = this.kindSlugToId?.get(kindSlug)
		if (!kindId) {
			consola.warn(`Unknown facet kind '${kindSlug}'`)
			return null
		}

		const slug = this.ensureSlug(kindId, label)
		const cacheKey = `${kindId}|${slug}`
		if (this.facetCacheBySlug.has(cacheKey)) {
			return this.facetCacheBySlug.get(cacheKey) ?? null
		}

		const normalizedSynonyms = normalizeSynonyms(options.synonyms)

		const { data: existing, error: selectError } = await this.db
			.from("facet_account")
			.select("id, synonyms, label")
			.eq("account_id", this.accountId)
			.eq("kind_id", kindId)
			.eq("slug", slug)
			.maybeSingle()
		if (selectError) {
			consola.warn("Failed to load existing facet_account", selectError.message)
			return null
		}

		if (existing?.id) {
			const mergedSynonyms = normalizeSynonyms([...(existing.synonyms ?? []), ...normalizedSynonyms])
			if (mergedSynonyms.length !== (existing.synonyms ?? []).length) {
				await this.db.from("facet_account").update({ synonyms: mergedSynonyms }).eq("id", existing.id)
			}
			this.facetCacheBySlug.set(cacheKey, existing.id)
			return existing.id
		}

		const insertPayload: Database["public"]["Tables"]["facet_account"]["Insert"] = {
			account_id: this.accountId,
			kind_id: kindId,
			global_facet_id: options.globalFacetId ?? null,
			label,
			slug,
			synonyms: normalizedSynonyms,
			is_active: options.isActive ?? false,
		}

		const { data: inserted, error: insertError } = await this.db
			.from("facet_account")
			.insert(insertPayload)
			.select("id")
			.single()
		if (insertError) {
			consola.warn("Failed to insert facet_account", insertError.message)
			return null
		}

		this.facetCacheBySlug.set(cacheKey, inserted.id)
		return inserted.id
	}

	private async loadGlobalFacet(id: number) {
		if (this.globalFacetCache.has(id)) return this.globalFacetCache.get(id) ?? null
		const { data, error } = await this.db
			.from("facet_global")
			.select("id, kind_id, label, synonyms")
			.eq("id", id)
			.maybeSingle()
		if (error) {
			consola.warn("Failed to load global facet", error.message)
			return null
		}
		if (data) {
			this.globalFacetCache.set(id, data)
			return data
		}
		return null
	}
}

interface FacetCatalogOptions {
	db: SupabaseClient<Database>
	accountId: string
}

interface PersistFacetObservationsOptions {
	db: SupabaseClient<Database>
	accountId: string
	projectId: string | null | undefined
	observations: Array<{
		personId: string
		facets?: PersonFacetObservation[] | null
		scales?: PersonScaleObservation[] | null
	}>
	evidenceIds: string[]
}

export async function getFacetCatalog({ db, accountId }: FacetCatalogOptions): Promise<FacetCatalog> {
	const [
		{ data: kindRows, error: kindError },
		{ data: globalRows, error: globalError },
		{ data: accountRows, error: accountError },
	] = await Promise.all([
		db.from("facet_kind_global").select("id, slug, label, updated_at").order("id"),
		db.from("facet_global").select("id, kind_id, label, synonyms, updated_at"),
		db.from("facet_account").select("id, kind_id, label, synonyms, updated_at, is_active").eq("account_id", accountId),
	])

	if (kindError) throw new Error(`Failed to load facet kinds: ${kindError.message}`)
	if (globalError) throw new Error(`Failed to load global facets: ${globalError.message}`)
	if (accountError) throw new Error(`Failed to load account facets: ${accountError.message}`)

	const kinds: FacetCatalogKind[] = (kindRows ?? []).map((row) => ({ slug: row.slug, label: row.label }))
	const kindIdToSlug = new Map<number, string>((kindRows ?? []).map((row) => [row.id, row.slug]))

	const entries = new Map<number, FacetCatalogEntry>()
	let newestTimestamp = getMaxTimestamp(kindRows ?? [])

	for (const row of globalRows ?? []) {
		entries.set(row.id, {
			facet_account_id: row.id,
			kind_slug: kindIdToSlug.get(row.kind_id) ?? "",
			label: row.label,
			synonyms: row.synonyms ?? [],
		})
		newestTimestamp = maxTimestamp(newestTimestamp, row.updated_at)
	}

	for (const row of accountRows ?? []) {
		// Include all facets in catalog for display purposes
		// is_active controls whether they're used in new processing, not visibility
		entries.set(row.id, {
			facet_account_id: row.id,
			kind_slug: kindIdToSlug.get(row.kind_id) ?? "",
			label: row.label,
			synonyms: row.synonyms ?? [],
			alias: undefined, // Account facets don't have aliases (yet)
		})
		newestTimestamp = maxTimestamp(newestTimestamp, row.updated_at)
	}

	const facets = Array.from(entries.values()).filter((entry) => entry.kind_slug && entry.label)
	const version = `acct:${accountId}:v${Number(newestTimestamp ?? Date.now())}`

	return { kinds, facets, version }
}

export async function persistFacetObservations({
	db,
	accountId,
	projectId,
	observations,
	evidenceIds,
}: PersistFacetObservationsOptions): Promise<void> {
	const resolver = new FacetResolver(db, accountId)
	const projectIdValue = projectId ?? null
	const facetRows: Array<
		{
			person_id: string
			facet_account_id: number
			source: string
			evidence_id: string | null
			confidence: number
			noted_at: string
		} & { account_id: string; project_id: string | null }
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
		} & { account_id: string; project_id: string | null }
	> = []

	for (const { personId, facets, scales } of observations) {
		if (Array.isArray(facets)) {
			for (const obs of facets) {
				const source = obs.source ?? "interview"
				const evidenceIndex = obs.evidence_unit_index ?? null
				const evidenceId =
					evidenceIndex !== null && evidenceIndex !== undefined ? (evidenceIds[evidenceIndex] ?? null) : null
				const confidence = normalizeConfidence(obs.confidence)

				let facetAccountId: number | null = obs.facet_account_id ?? null

				// If no ID provided, create/find facet by label
				if (!facetAccountId && obs.kind_slug && (obs.candidate?.label || obs.value)) {
					const label = obs.candidate?.label ?? obs.value ?? ""
					facetAccountId = await resolver.ensureFacet({
						kindSlug: obs.kind_slug,
						label,
						synonyms: obs.candidate?.synonyms ?? [],
					})
				}

				if (!facetAccountId) continue

				facetRows.push({
					account_id: accountId,
					project_id: projectIdValue,
					person_id: personId,
					facet_account_id: facetAccountId,
					source,
					evidence_id: evidenceId,
					confidence,
					noted_at: new Date().toISOString(),
				})
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
					project_id: projectIdValue,
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

	// const projectId = projectIdOrNull(projectIdOrUndefined(projectIdOrUndefined as any))

	if (facetRows.length) {
		const { error: facetError } = await db.from("person_facet").upsert(
			facetRows.map((row) => ({
				account_id: row.account_id,
				project_id: row.project_id,
				person_id: row.person_id,
				facet_account_id: row.facet_account_id,
				source: row.source,
				evidence_id: row.evidence_id,
				confidence: row.confidence,
				noted_at: row.noted_at,
			})),
			{ onConflict: "person_id,facet_account_id" }
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
