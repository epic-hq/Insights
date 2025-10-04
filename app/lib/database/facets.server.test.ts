import type { SupabaseClient } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Database } from "~/../supabase/types"
import { getFacetCatalog, persistFacetObservations } from "./facets.server"

type MockDb = SupabaseClient<Database>

describe("facets.server", () => {
	describe("getFacetCatalog", () => {
		beforeEach(() => {
			vi.restoreAllMocks()
		})

		it("merges global, account, and project facets with overrides", async () => {
			const kindRows = [
				{ id: 1, slug: "goal", label: "Goal", updated_at: "2025-01-01T00:00:00.000Z" },
				{ id: 2, slug: "pain", label: "Pain", updated_at: "2025-01-02T00:00:00.000Z" },
			]
			const globalRows = [
				{
					id: 11,
					kind_id: 1,
					slug: "goal_speed",
					label: "Speed Up",
					synonyms: ["faster"],
					updated_at: "2025-01-03T00:00:00.000Z",
				},
			]
			const accountRows = [
				{
					id: 21,
					kind_id: 2,
					global_facet_id: null,
					slug: "pain_manual",
					label: "Manual Work",
					synonyms: ["tedious"],
					updated_at: "2025-01-04T00:00:00.000Z",
				},
			]
			const projectRows = [
				{
					facet_ref: "g:11",
					scope: "catalog",
					kind_slug: null,
					label: null,
					synonyms: ["fast lane"],
					is_enabled: true,
					alias: "Move Fast",
					pinned: false,
					sort_weight: 0,
					updated_at: "2025-01-05T00:00:00.000Z",
				},
				{
					facet_ref: "a:21",
					scope: "catalog",
					kind_slug: null,
					label: null,
					synonyms: null,
					is_enabled: false,
					alias: null,
					pinned: false,
					sort_weight: 0,
					updated_at: "2025-01-06T00:00:00.000Z",
				},
				{
					facet_ref: "p:123e4567-e89b-12d3-a456-426614174000",
					scope: "project",
					kind_slug: "goal",
					label: "Win More Deals",
					synonyms: ["close deals"],
					is_enabled: true,
					alias: "Win Deals",
					pinned: true,
					sort_weight: 10,
					updated_at: "2025-01-07T00:00:00.000Z",
				},
			]

			const eqCalls: { facetAccount?: string; projectFacet?: string } = {}

			const mockDb = {
				from: vi.fn((table: string) => {
					switch (table) {
						case "facet_kind_global":
							return {
								select: vi.fn(() => ({
									order: vi.fn().mockResolvedValue({ data: kindRows, error: null }),
								})),
							}
						case "facet_global":
							return {
								select: vi.fn().mockResolvedValue({ data: globalRows, error: null }),
							}
						case "facet_account":
							return {
								select: vi.fn(() => ({
									eq: vi.fn().mockImplementation((column: string, value: string) => {
										expect(column).toBe("account_id")
										eqCalls.facetAccount = value
										return Promise.resolve({ data: accountRows, error: null })
									}),
								})),
							}
						case "project_facet":
							return {
								select: vi.fn(() => ({
									eq: vi.fn().mockImplementation((column: string, value: string) => {
										expect(column).toBe("project_id")
										eqCalls.projectFacet = value
										return Promise.resolve({ data: projectRows, error: null })
									}),
								})),
							}
						default:
							throw new Error(`Unexpected table: ${table}`)
					}
				}),
			} as unknown as MockDb

			const catalog = await getFacetCatalog({ db: mockDb, accountId: "account-1", projectId: "project-1" })

			expect(eqCalls).toEqual({ facetAccount: "account-1", projectFacet: "project-1" })
			expect(catalog.kinds).toEqual([
				{ slug: "goal", label: "Goal" },
				{ slug: "pain", label: "Pain" },
			])
			expect(catalog.facets).toEqual([
				{
					facet_ref: "g:11",
					kind_slug: "goal",
					label: "Speed Up",
					synonyms: ["fast lane"],
					alias: "Move Fast",
				},
				{
					facet_ref: "p:123e4567-e89b-12d3-a456-426614174000",
					kind_slug: "goal",
					label: "Win More Deals",
					synonyms: ["close deals"],
					alias: "Win Deals",
				},
			])
			expect(catalog.version).toMatch(/^acct:account-1:proj:project-1:v\d+$/)
		})
	})

	describe("persistFacetObservations", () => {
		beforeEach(() => {
			vi.restoreAllMocks()
		})

		it("stores facet matches, scales, and candidates with normalized values", async () => {
			vi.useFakeTimers()
			vi.setSystemTime(new Date("2025-02-01T12:34:56.000Z"))

			const candidateUpserts: any[] = []
			const facetUpserts: any[] = []
			const scaleUpserts: any[] = []

			const mockDb = {
				from: vi.fn((table: string) => {
					switch (table) {
						case "facet_candidate":
							return {
								upsert: vi.fn((payload: any) => {
									candidateUpserts.push(payload)
									return {
										select: vi.fn().mockResolvedValue({ data: [], error: null }),
									}
								}),
							}
						case "person_facet":
							return {
								upsert: vi.fn((payload: any[]) => {
									facetUpserts.push(payload)
									return Promise.resolve({ error: null })
								}),
							}
						case "person_scale":
							return {
								upsert: vi.fn((payload: any[]) => {
									scaleUpserts.push(payload)
									return Promise.resolve({ error: null })
								}),
							}
						default:
							throw new Error(`Unexpected table: ${table}`)
					}
				}),
			} as unknown as MockDb

			await persistFacetObservations({
				db: mockDb,
				accountId: "acct-1",
				projectId: "proj-1",
				observations: [
					{
						personId: "person-1",
						facets: [
							{
								facet_ref: "g:11",
								candidate: undefined,
								kind_slug: "goal",
								value: "Finish faster",
								source: "interview",
								evidence_unit_index: 0,
								confidence: 0.92,
								notes: ["clear signal"],
							},
							{
								facet_ref: "",
								candidate: {
									kind_slug: "goal",
									label: "Win More Deals",
									synonyms: ["close deals"],
									notes: ["explicit ask"],
								},
								kind_slug: "goal",
								value: "wants more wins",
								source: "interview",
								evidence_unit_index: 1,
								confidence: null,
								notes: null,
							},
						],
						scales: [
							{
								kind_slug: "price_sensitivity",
								score: 1.2,
								band: "high",
								source: "survey",
								evidence_unit_index: 0,
								confidence: 1.3,
								rationale: "mentioned several times",
							},
						],
					},
				],
				evidenceIds: ["ev-1", "ev-2"],
			})

			expect(candidateUpserts).toHaveLength(1)
			expect(candidateUpserts[0]).toEqual([
				{
					account_id: "acct-1",
					project_id: "proj-1",
					person_id: "person-1",
					kind_slug: "goal",
					label: "Win More Deals",
					synonyms: ["close deals"],
					source: "interview",
					evidence_id: "ev-2",
					notes: "explicit ask",
				},
			])

			expect(facetUpserts).toHaveLength(1)
			expect(facetUpserts[0]).toEqual([
				{
					account_id: "acct-1",
					project_id: "proj-1",
					person_id: "person-1",
					facet_ref: "g:11",
					source: "interview",
					evidence_id: "ev-1",
					confidence: 0.92,
					noted_at: "2025-02-01T12:34:56.000Z",
				},
			])

			expect(scaleUpserts).toHaveLength(1)
			expect(scaleUpserts[0]).toEqual([
				{
					account_id: "acct-1",
					project_id: "proj-1",
					person_id: "person-1",
					kind_slug: "price_sensitivity",
					score: 1,
					band: "high",
					source: "survey",
					evidence_id: "ev-1",
					confidence: 1,
					noted_at: "2025-02-01T12:34:56.000Z",
				},
			])

			vi.useRealTimers()
		})
	})
})
