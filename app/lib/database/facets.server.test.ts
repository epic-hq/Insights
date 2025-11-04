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

		it("returns global and account facets with IDs", async () => {
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
					is_active: true,
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
					is_active: true,
				},
				{
					id: 22,
					kind_id: 1,
					global_facet_id: null,
					slug: "goal_win",
					label: "Win More Deals",
					synonyms: ["close deals"],
					updated_at: "2025-01-05T00:00:00.000Z",
					is_active: false, // Inactive, should be filtered out
				},
			]

			const eqCalls: { facetAccount?: string } = {}

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
						default:
							throw new Error(`Unexpected table: ${table}`)
					}
				}),
			} as unknown as MockDb

			const catalog = await getFacetCatalog({ db: mockDb, accountId: "account-1", projectId: null })

			expect(eqCalls).toEqual({ facetAccount: "account-1" })
			expect(catalog.kinds).toEqual([
				{ slug: "goal", label: "Goal" },
				{ slug: "pain", label: "Pain" },
			])
			expect(catalog.facets).toEqual([
				{
					facet_account_id: 11,
					kind_slug: "goal",
					label: "Speed Up",
					synonyms: ["faster"],
				},
				{
					facet_account_id: 21,
					kind_slug: "pain",
					label: "Manual Work",
					synonyms: ["tedious"],
				},
			])
			expect(catalog.version).toMatch(/^acct:account-1:v\d+$/)
		})
	})

	describe("persistFacetObservations", () => {
		beforeEach(() => {
			vi.restoreAllMocks()
		})

		it("stores facet observations with IDs and scales with normalized values", async () => {
			vi.useFakeTimers()
			vi.setSystemTime(new Date("2025-02-01T12:34:56.000Z"))

			const facetUpserts: any[] = []
			const scaleUpserts: any[] = []

			const mockDb = {
				from: vi.fn((table: string) => {
					switch (table) {
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
								facet_account_id: 11,
								kind_slug: "goal",
								value: "Finish faster",
								source: "interview",
								evidence_unit_index: 0,
								confidence: 0.92,
								notes: ["clear signal"],
							},
							{
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

			expect(facetUpserts).toHaveLength(1)
			expect(facetUpserts[0]).toEqual([
				{
					account_id: "acct-1",
					project_id: "proj-1",
					person_id: "person-1",
					facet_account_id: 11,
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
