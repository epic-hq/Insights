/**
 * Product Lens - Pain × User Matrix Analysis
 * Aggregates pain points and creates a 2x2 matrix of Pain Intensity vs Willingness to Pay
 */

import { useState } from "react"
import { LoaderFunctionArgs, useLoaderData, useNavigate } from "react-router"
import consola from "consola"
import { PainMatrixComponent } from "../components/PainMatrix"
import { generatePainMatrix, type PainMatrixCell } from "../services/generatePainMatrix.server"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select"
import { userContext } from "~/server/user-context"

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const projectId = params.projectId as string

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 })
	}

	// Get selected segment from query params
	const url = new URL(request.url)
	const segmentId = url.searchParams.get("segment")

	try {
		// Get segment-type facets only (not all facets like pains, goals, etc.)
		// Query facet_kind_global to get IDs for segment types
		const { data: segmentKinds } = await supabase
			.from("facet_kind_global")
			.select("id")
			.in("slug", ["persona", "job_function", "seniority_level", "title", "industry", "life_stage", "age_range"])

		const segmentKindIds = segmentKinds?.map((k) => k.id) || []

		// Get facets of these kinds only
		const { data: segmentFacets } = await supabase
			.from("facet_account")
			.select(
				`
				id,
				label,
				slug,
				kind_id,
				facet_kind_global!inner(slug)
			`
			)
			.eq("project_id", projectId)
			.in("kind_id", segmentKindIds)

		// Count people per segment
		const segments = await Promise.all(
			(segmentFacets || []).map(async (facet) => {
				const { count } = await supabase
					.from("person_facet")
					.select("*", { count: "exact", head: true })
					.eq("facet_account_id", facet.id)

				// Extract kind from joined facet_kind_global
				const facetKind = facet.facet_kind_global
				const kindSlug = facetKind && typeof facetKind === "object" && "slug" in facetKind ? facetKind.slug : "unknown"

				return {
					id: String(facet.id),
					label: facet.label,
					kind: String(kindSlug),
					person_count: count || 0,
				}
			})
		)

		const matrix = await generatePainMatrix({
			supabase,
			projectId,
			segmentId: segmentId || undefined,
			minEvidencePerPain: 2,
			minGroupSize: 1,
		})

		return { matrix, projectId, segments, selectedSegmentId: segmentId }
	} catch (error) {
		consola.error("Product Lens loader error:", error)
		throw new Response("Failed to generate pain matrix", { status: 500 })
	}
}

export default function ProductLens() {
	const { matrix, segments, selectedSegmentId } = useLoaderData<typeof loader>()
	const [selectedCell, setSelectedCell] = useState<PainMatrixCell | null>(null)
	const navigate = useNavigate()

	const handleSegmentChange = (segmentId: string) => {
		if (segmentId === "all") {
			navigate("?")
		} else {
			navigate(`?segment=${segmentId}`)
		}
	}

	if (!matrix) {
		return (
			<div className="rounded-lg border bg-muted p-6 text-center">
				<p className="text-muted-foreground">No pain matrix data available</p>
			</div>
		)
	}

	return (
		<div className="space-y-6 p-6">
			{/* Header with Segment Selector */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-bold text-3xl">Product Lens</h1>
					<p className="text-muted-foreground">Pain × User Type matrix to prioritize product features</p>
				</div>

				{/* Segment Selector */}
				<div className="min-w-[280px]">
					<label className="mb-2 block font-medium text-sm">Filter by Segment</label>
					<Select value={selectedSegmentId || "all"} onValueChange={handleSegmentChange}>
						<SelectTrigger>
							<SelectValue placeholder="All Segments" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Segments</SelectItem>
							{(() => {
								// Group segments by kind
								const segmentsByKind = segments
									.filter((s) => s.person_count > 0)
									.reduce(
										(acc, segment) => {
											if (!acc[segment.kind]) acc[segment.kind] = []
											acc[segment.kind].push(segment)
											return acc
										},
										{} as Record<string, typeof segments>
									)

								const kindLabels: Record<string, string> = {
									persona: "Personas",
									job_function: "Job Functions",
									seniority_level: "Seniority Levels",
									title: "Job Titles",
									industry: "Industries",
									life_stage: "Life Stages",
									age_range: "Age Ranges",
								}

								return Object.entries(segmentsByKind).map(([kind, kindSegments]) => (
									<div key={kind}>
										<div className="px-2 py-1.5 font-semibold text-muted-foreground text-xs">
											{kindLabels[kind] || kind}
										</div>
										{kindSegments.map((segment) => (
											<SelectItem key={segment.id} value={segment.id} className="pl-6">
												{segment.label} ({segment.person_count})
											</SelectItem>
										))}
									</div>
								))
							})()}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Pain Matrix */}
			<PainMatrixComponent matrix={matrix} onCellClick={setSelectedCell} />

			{/* Selected Cell Detail Modal */}
			{selectedCell && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setSelectedCell(null)}
				>
					<div
						className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg bg-background p-6 shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mb-4 flex items-start justify-between">
							<div>
								<h2 className="font-bold text-2xl">{selectedCell.pain_theme_name}</h2>
								<p className="text-muted-foreground">
									{selectedCell.user_group.name} ({selectedCell.user_group.member_count} people)
								</p>
							</div>
							<button onClick={() => setSelectedCell(null)} className="rounded p-2 hover:bg-muted">
								×
							</button>
						</div>

						<div className="space-y-4">
							{/* Metrics */}
							<div className="grid grid-cols-2 gap-4">
								<MetricDisplay label="Impact Score" value={selectedCell.metrics.impact_score.toFixed(2)} />
								<MetricDisplay label="Frequency" value={`${Math.round(selectedCell.metrics.frequency * 100)}%`} />
								<MetricDisplay label="Intensity" value={selectedCell.metrics.intensity || "N/A"} />
								<MetricDisplay label="WTP" value={selectedCell.metrics.willingness_to_pay || "N/A"} />
							</div>

							{/* Evidence */}
							<div>
								<h3 className="mb-2 font-semibold">Evidence</h3>
								<p className="text-muted-foreground text-sm">
									{selectedCell.evidence.count} items from {selectedCell.evidence.person_count} people
								</p>
								<div className="mt-4 space-y-3">
									{selectedCell.evidence.sample_verbatims.map((quote) => (
										<blockquote key={quote} className="border-primary border-l-2 pl-4 italic">
											"{quote}"
										</blockquote>
									))}
								</div>
							</div>

							{/* Actions */}
							<div className="flex gap-2">
								<button className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm hover:bg-primary/90">
									Create Feature Request
								</button>
								<button className="rounded-lg border px-4 py-2 font-semibold text-sm hover:bg-muted">
									View All Evidence
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

function MetricDisplay({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="text-muted-foreground text-sm">{label}</div>
			<div className="mt-1 font-bold text-2xl">{value}</div>
		</div>
	)
}
