import { Filter, Target, TrendingUp, Users } from "lucide-react"
import type React from "react"
import { useState } from "react"
import { Link, useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { cn } from "~/lib/utils"
import { userContext } from "~/server/user-context"
import { getSegmentKindSummaries, getSegmentsSummary, type SegmentSummary } from "../services/segmentData.server"
import type { Route } from "./+types/index"

export async function loader({ context, params }: Route.LoaderArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Get project ID from params (since we're nested under project route)
	const projectId = params.projectId as string

	if (!projectId) {
		throw new Response("No project found", { status: 404 })
	}

	const [segments, segmentKinds] = await Promise.all([
		getSegmentsSummary(supabase, projectId),
		getSegmentKindSummaries(supabase, projectId),
	])

	return {
		segments,
		segmentKinds,
		projectId,
	}
}

const KIND_LABELS: Record<string, string> = {
	persona: "Personas",
	job_function: "Job Functions",
	seniority_level: "Seniority Levels",
	title: "Job Titles",
	industry: "Industries",
	life_stage: "Life Stages",
	age_range: "Age Ranges",
}

function getBullseyeColor(score: number): string {
	if (score >= 75) return "text-red-600 bg-red-50 border-red-200"
	if (score >= 50) return "text-orange-600 bg-orange-50 border-orange-200"
	if (score >= 25) return "text-yellow-600 bg-yellow-50 border-yellow-200"
	return "text-gray-600 bg-gray-50 border-gray-200"
}

function getBullseyeLabel(score: number): { label: string; icon: React.ComponentType<{ className?: string }> } {
	if (score >= 75)
		return {
			label: "Bullseye",
			icon: Target,
		}
	if (score >= 50)
		return {
			label: "High Potential",
			icon: TrendingUp,
		}
	if (score >= 25)
		return {
			label: "Promising",
			icon: Filter,
		}
	return {
		label: "Explore",
		icon: Users,
	}
}

export default function SegmentsIndex({ loaderData }: Route.ComponentProps) {
	const { segments, segmentKinds } = loaderData
	const [kindFilter, setKindFilter] = useState<string>("all")
	const [minScore, setMinScore] = useState(0)

	const segmentCounts = segments.reduce(
		(acc, segment) => {
			acc[segment.kind] = (acc[segment.kind] || 0) + 1
			return acc
		},
		{} as Record<string, number>
	)

	const totalPeopleAcrossKinds = segmentKinds.reduce((sum, kind) => sum + kind.person_count, 0)
	const bullseyeCount = segments.filter((s) => s.bullseye_score >= 75).length
	const highPotentialCount = segments.filter((s) => s.bullseye_score >= 50).length

	const filterViews = [
		{
			value: "all",
			label: "All Segments",
			people: totalPeopleAcrossKinds,
			segments: segments.length,
			disabled: segments.length === 0,
		},
		...segmentKinds.map((kind) => ({
			value: kind.kind,
			label: kind.label,
			people: kind.person_count,
			segments: segmentCounts[kind.kind] || 0,
			disabled: (segmentCounts[kind.kind] || 0) === 0 && kind.person_count === 0,
		})),
	]

	// Filter segments
	const filteredSegments = segments.filter((s) => {
		if (kindFilter !== "all" && s.kind !== kindFilter) return false
		if (s.bullseye_score < minScore) return false
		return true
	})

	// Group by kind
	const segmentsByKind = filteredSegments.reduce(
		(acc, segment) => {
			if (!acc[segment.kind]) acc[segment.kind] = []
			acc[segment.kind].push(segment)
			return acc
		},
		{} as Record<string, SegmentSummary[]>
	)

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			{/* Header */}
			<div className="mb-8">
				<div className="mb-3 flex items-center gap-3">
					<Target className="h-8 w-8 text-primary" />
					<h1 className="font-bold text-4xl tracking-tight">Customer Segments</h1>
				</div>
				<p className="text-lg text-muted-foreground">
					Find your bullseye customer – the segment most likely to buy based on pain intensity and willingness to pay
				</p>
			</div>

			{/* Filters */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Filter className="h-5 w-5" />
						Filters
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Segment Type Filter */}
					<div>
				<label className="mb-2 block font-medium text-sm">Segment Views</label>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{filterViews.map((view) => {
						const isActive = kindFilter === view.value
						return (
							<button
								key={view.value}
								type="button"
								onClick={() => {
									if (view.disabled) return
									setKindFilter(view.value)
								}}
								className={cn(
									"rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
									view.disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/60 hover:shadow-sm",
									isActive ? "border-primary bg-primary/5" : "border-border bg-background"
								)}
								aria-pressed={isActive}
								disabled={view.disabled}
							>
								<div className="flex items-center justify-between gap-2">
									<span className="font-semibold">{view.label}</span>
									{isActive && <Badge variant="secondary">Active</Badge>}
								</div>
								<div className="mt-4 flex items-center justify-between text-sm font-medium">
									<span>
										{view.segments} {view.segments === 1 ? "segment" : "segments"}
									</span>
									<span>{view.people} people</span>
								</div>
							</button>
						)
					})}
				</div>
			</div>

				{/* Bullseye Score Filter */}
				<div className="max-w-md space-y-4">
					<div className="mb-2 flex items-center justify-between">
						<label className="font-medium text-sm">Minimum Bullseye Score: {minScore}</label>
						<Button variant="ghost" size="sm" onClick={() => setMinScore(0)} disabled={minScore === 0}>
							Reset
						</Button>
						</div>
						<input
							type="range"
							min="0"
							max="100"
							step="5"
							value={minScore}
							onChange={(e) => setMinScore(Number.parseInt(e.target.value, 10))}
							className="w-full"
						/>
					<div className="mt-2 flex justify-between text-muted-foreground text-xs">
						<span>0</span>
						<span>25</span>
						<span>50</span>
						<span>75</span>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="rounded-lg border bg-muted/30 p-3">
							<p className="text-muted-foreground text-xs">Bullseye segments (75+)</p>
							<p className="font-bold text-2xl">{bullseyeCount}</p>
						</div>
						<div className="rounded-lg border bg-muted/30 p-3">
							<p className="text-muted-foreground text-xs">High potential (50+)</p>
							<p className="font-bold text-2xl">{highPotentialCount}</p>
						</div>
					</div>
				</div>

					{/* Results Count */}
					<div className="text-center text-muted-foreground text-sm">
						Showing {filteredSegments.length} of {segments.length} segments
					</div>
				</CardContent>
			</Card>

		{/* Segments List */}
			{filteredSegments.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
						<h3 className="mb-2 font-semibold text-lg">No segments found</h3>
						<p className="text-muted-foreground text-sm">
							Try adjusting your filters or add more interviews to generate segments.
						</p>
					</CardContent>
				</Card>
			) : kindFilter === "all" ? (
				<div className="space-y-8">
					{Object.entries(segmentsByKind).map(([kind, kindSegments]) => {
						return (
							<div key={kind}>
								<h2 className="mb-4 font-semibold text-xl">{KIND_LABELS[kind] || kind}</h2>
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									{kindSegments.map((segment) => (
										<Link key={segment.id} to={segment.id}>
											<Card
												className={`transition-shadow hover:shadow-lg ${
													segment.bullseye_score >= 75 ? "border-red-200 ring-2 ring-red-100" : ""
												}`}
											>
												<CardHeader>
													<div className="flex items-start justify-between gap-3">
														<div>
															<CardTitle className="flex items-center gap-2 text-lg">
																{segment.bullseye_score >= 75 && <Target className="h-5 w-5 text-red-600" />}
																{segment.label}
															</CardTitle>
															<p className="text-muted-foreground text-xs">{KIND_LABELS[segment.kind] || segment.kind}</p>
														</div>
														<Badge variant="outline" className={getBullseyeColor(segment.bullseye_score)}>
															{segment.bullseye_score}
														</Badge>
													</div>
												</CardHeader>
												<CardContent>
													<div className="flex items-center justify-between text-sm text-muted-foreground">
														<span className="flex items-center gap-1">
															<Users className="h-4 w-4" />
															{segment.person_count} people
														</span>
														<span className="flex items-center gap-1">
															<TrendingUp className="h-4 w-4" />
															{segment.evidence_count} notes
														</span>
													</div>
												</CardContent>
											</Card>
										</Link>
									))}
								</div>
							</div>
						)
					})}
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{filteredSegments.map((segment) => (
						<Link key={segment.id} to={segment.id}>
							<Card
								className={`transition-shadow hover:shadow-lg ${
									segment.bullseye_score >= 75 ? "border-red-200 ring-2 ring-red-100" : ""
								}`}
							>
								<CardHeader>
									<div className="flex items-start justify-between gap-3">
										<div>
											<CardTitle className="flex items-center gap-2 text-lg">
												{segment.bullseye_score >= 75 && <Target className="h-5 w-5 text-red-600" />}
												{segment.label}
											</CardTitle>
											<p className="text-muted-foreground text-xs">{KIND_LABELS[segment.kind] || segment.kind}</p>
										</div>
										<Badge variant="outline" className={getBullseyeColor(segment.bullseye_score)}>
											{segment.bullseye_score}
										</Badge>
									</div>
								</CardHeader>
								<CardContent>
									<div className="flex items-center justify-between text-sm text-muted-foreground">
										<span className="flex items-center gap-1">
											<Users className="h-4 w-4" />
											{segment.person_count} people
										</span>
										<span className="flex items-center gap-1">
											<TrendingUp className="h-4 w-4" />
											{segment.evidence_count} notes
										</span>
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			)}

			{/* Bullseye Score Explainer */}
			<Card className="mt-8">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Target className="h-5 w-5" />
						About Bullseye Scores
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-muted-foreground text-sm">
					<p>
						The <strong>Bullseye Score</strong> (0-100) indicates how likely a segment is to buy your product based on
						three factors:
					</p>
					<ul className="space-y-2 pl-6">
						<li className="list-disc">
							<strong>Sample Size</strong> (25 points) – Confidence increases with more people and evidence
						</li>
						<li className="list-disc">
							<strong>Willingness to Pay</strong> (40 points) – Signals they'll pay for a solution
						</li>
						<li className="list-disc">
							<strong>Pain Intensity</strong> (35 points) – Higher pain = more urgency to solve
						</li>
					</ul>
					<p>
						Focus on <strong>75+ scores</strong> for your initial target market. Expand to 50+ once you've validated
						product-market fit with the bullseye segment.
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
