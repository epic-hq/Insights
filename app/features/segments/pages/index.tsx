import { ChevronDown, Target, TrendingUp, Users } from "lucide-react"
import type React from "react"
import { useState } from "react"
import { Link, useLoaderData } from "react-router"
import { BackButton } from "~/components/ui/BackButton"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
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
			icon: Users,
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
	const [isExplainerOpen, setIsExplainerOpen] = useState(false)

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
			{/* Back Button */}
			<BackButton />

			{/* Header */}
			<div className="mb-8">
				<div className="mb-3 flex items-center gap-3">
					<Target className="h-8 w-8 text-primary" />
					<h1 className="text-balance font-bold text-4xl tracking-tight">Customer Segments</h1>
				</div>
				<p className="text-lg text-muted-foreground">
					Find your bullseye customer – the segment most likely to buy based on pain intensity and willingness to pay
				</p>
			</div>

			<div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
				{/* Segment type filter */}
				<div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
					<label className="shrink-0 font-medium text-muted-foreground text-sm">View:</label>
					<div className="relative flex-1 sm:max-w-xs">
						<select
							value={kindFilter}
							onChange={(e) => setKindFilter(e.target.value)}
							className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-10 font-medium text-sm transition-colors hover:border-primary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						>
							{filterViews.map((view) => (
								<option key={view.value} value={view.value} disabled={view.disabled}>
									{view.label} ({view.segments} seg • {view.people} people)
								</option>
							))}
						</select>
						<ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 h-4 w-4 text-muted-foreground" />
					</div>
				</div>

				{/* Inline stats - compact badges */}
				<div className="flex flex-wrap items-center gap-2 sm:gap-3">
					<Badge variant="outline" className="bg-background px-2.5 py-1">
						Showing <span className="ml-1 font-semibold">{filteredSegments.length}</span>
					</Badge>
					<Badge variant="outline" className="border-red-200 bg-red-50 px-2.5 py-1 text-red-900">
						Bullseye (75+) <span className="ml-1 font-semibold">{bullseyeCount}</span>
					</Badge>
					<Badge variant="outline" className="border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-900">
						High Potential (50+) <span className="ml-1 font-semibold">{highPotentialCount}</span>
					</Badge>
				</div>

				{/* Score filter */}
				<div className="flex items-center gap-2 border-muted-foreground/20 sm:border-l sm:pl-4">
					<label className="shrink-0 font-medium text-muted-foreground text-sm">Min:</label>
					<input
						type="range"
						min="0"
						max="100"
						step="25"
						value={minScore}
						onChange={(e) => setMinScore(Number.parseInt(e.target.value, 10))}
						className="w-24"
					/>
					<Badge variant={minScore > 0 ? "default" : "secondary"} className="min-w-[2.5rem] justify-center">
						{minScore}+
					</Badge>
					{minScore > 0 && (
						<Button variant="ghost" size="sm" onClick={() => setMinScore(0)} className="h-7 px-2 text-xs">
							Clear
						</Button>
					)}
				</div>
			</div>
			{/*
			<div className="mb-6 grid gap-3 sm:grid-cols-3">
				<Card className="border-primary/20 bg-primary/5">
					<CardContent className="flex items-center justify-between p-4">
						<div>
							<p className="mb-1 font-medium text-muted-foreground text-sm">Showing Segments</p>
							<p className="font-bold text-3xl">{filteredSegments.length}</p>
						</div>
						<div className="rounded-full bg-primary/10 p-3">
							<Target className="h-6 w-6 text-primary" />
						</div>
					</CardContent>
				</Card>
				<Card className="border-red-200 bg-red-50">
					<CardContent className="flex items-center justify-between p-4">
						<div>
							<p className="mb-1 font-medium text-red-800/70 text-sm">Bullseye (75+)</p>
							<p className="font-bold text-3xl text-red-900">{bullseyeCount}</p>
						</div>
						<div className="rounded-full bg-red-100 p-3">
							<Target className="h-6 w-6 text-red-600" />
						</div>
					</CardContent>
				</Card>
				<Card className="border-orange-200 bg-orange-50">
					<CardContent className="flex items-center justify-between p-4">
						<div>
							<p className="mb-1 font-medium text-orange-800/70 text-sm">High Potential (50+)</p>
							<p className="font-bold text-3xl text-orange-900">{highPotentialCount}</p>
						</div>
						<div className="rounded-full bg-orange-100 p-3">
							<TrendingUp className="h-6 w-6 text-orange-600" />
						</div>
					</CardContent>
				</Card>
			</div> */}

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
												className={`border-2 transition-shadow hover:shadow-lg ${
													segment.bullseye_score >= 75
														? "border-red-300 ring-2 ring-red-100"
														: "border-border hover:border-primary/50"
												}`}
											>
												<CardHeader>
													<div className="flex items-start justify-between gap-3">
														<div>
															<CardTitle className="flex items-center gap-2 text-lg">
																{segment.bullseye_score >= 75 && <Target className="h-5 w-5 text-red-600" />}
																{segment.label}
															</CardTitle>
															<p className="text-muted-foreground text-xs">
																{KIND_LABELS[segment.kind] || segment.kind}
															</p>
														</div>
														<Badge variant="outline" className={getBullseyeColor(segment.bullseye_score)}>
															{segment.bullseye_score}
														</Badge>
													</div>
												</CardHeader>
												<CardContent>
													<div className="flex items-center justify-between text-muted-foreground text-sm">
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
								className={`border-2 transition-shadow hover:shadow-lg ${
									segment.bullseye_score >= 75
										? "border-red-300 ring-2 ring-red-100"
										: "border-border hover:border-primary/50"
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
									<div className="flex items-center justify-between text-muted-foreground text-sm">
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
			<Collapsible open={isExplainerOpen} onOpenChange={setIsExplainerOpen}>
				<Card className="mt-8">
					<CollapsibleTrigger asChild>
						<CardHeader className="cursor-pointer transition-colors hover:bg-muted/50">
							<CardTitle className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Target className="h-5 w-5" />
									About Bullseye Scores
								</div>
								<ChevronDown className={`h-4 w-4 transition-transform ${isExplainerOpen ? "rotate-180" : ""}`} />
							</CardTitle>
						</CardHeader>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<CardContent className="space-y-4 text-muted-foreground text-sm">
							<p>
								The <strong>Bullseye Score</strong> (0-100) indicates how likely a segment is to buy your product based
								on three factors:
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
					</CollapsibleContent>
				</Card>
			</Collapsible>
		</div>
	)
}
