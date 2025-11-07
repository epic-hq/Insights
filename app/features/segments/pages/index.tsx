import { Filter, Target, TrendingUp, Users } from "lucide-react"
import type React from "react"
import { useState } from "react"
import { Link, useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { userContext } from "~/server/user-context"
import { getSegmentsSummary, type SegmentSummary } from "../services/segmentData.server"
import type { Route } from "./+types/index"

export async function loader({ context, params }: Route.LoaderArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Get project ID from params (since we're nested under project route)
	const projectId = params.projectId as string

	if (!projectId) {
		throw new Response("No project found", { status: 404 })
	}

	const segments = await getSegmentsSummary(supabase, projectId)

	return {
		segments,
		projectId,
	}
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
	const { segments } = loaderData
	const [kindFilter, setKindFilter] = useState<string>("all")
	const [minScore, setMinScore] = useState(0)

	// Calculate counts per kind for badges
	const kindCounts = segments.reduce(
		(acc, segment) => {
			acc[segment.kind] = (acc[segment.kind] || 0) + 1
			return acc
		},
		{} as Record<string, number>
	)

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
						<label className="mb-3 block font-medium text-sm">Segment Type</label>
						<ToggleGroup type="single" value={kindFilter} onValueChange={setKindFilter} className="flex-wrap justify-start gap-2">
							<ToggleGroupItem value="all" className="gap-2">
								All
								<Badge variant="secondary" className="ml-1">
									{segments.length}
								</Badge>
							</ToggleGroupItem>
							<ToggleGroupItem value="persona" className="gap-2" disabled={!kindCounts.persona}>
								Personas
								{kindCounts.persona > 0 && (
									<Badge variant="secondary" className="ml-1">
										{kindCounts.persona}
									</Badge>
								)}
							</ToggleGroupItem>
							<ToggleGroupItem value="job_function" className="gap-2" disabled={!kindCounts.job_function}>
								Job Function
								{kindCounts.job_function > 0 && (
									<Badge variant="secondary" className="ml-1">
										{kindCounts.job_function}
									</Badge>
								)}
							</ToggleGroupItem>
							<ToggleGroupItem value="seniority_level" className="gap-2" disabled={!kindCounts.seniority_level}>
								Seniority
								{kindCounts.seniority_level > 0 && (
									<Badge variant="secondary" className="ml-1">
										{kindCounts.seniority_level}
									</Badge>
								)}
							</ToggleGroupItem>
							<ToggleGroupItem value="title" className="gap-2" disabled={!kindCounts.title}>
								Titles
								{kindCounts.title > 0 && (
									<Badge variant="secondary" className="ml-1">
										{kindCounts.title}
									</Badge>
								)}
							</ToggleGroupItem>
							<ToggleGroupItem value="industry" className="gap-2" disabled={!kindCounts.industry}>
								Industry
								{kindCounts.industry > 0 && (
									<Badge variant="secondary" className="ml-1">
										{kindCounts.industry}
									</Badge>
								)}
							</ToggleGroupItem>
							<ToggleGroupItem value="life_stage" className="gap-2" disabled={!kindCounts.life_stage}>
								Life Stage
								{kindCounts.life_stage > 0 && (
									<Badge variant="secondary" className="ml-1">
										{kindCounts.life_stage}
									</Badge>
								)}
							</ToggleGroupItem>
							<ToggleGroupItem value="age_range" className="gap-2" disabled={!kindCounts.age_range}>
								Age Range
								{kindCounts.age_range > 0 && (
									<Badge variant="secondary" className="ml-1">
										{kindCounts.age_range}
									</Badge>
								)}
							</ToggleGroupItem>
						</ToggleGroup>
					</div>

					{/* Bullseye Score Filter */}
					<div className="max-w-md">
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
					</div>

					{/* Results Count */}
					<div className="text-center text-muted-foreground text-sm">
						Showing {filteredSegments.length} of {segments.length} segments
					</div>
				</CardContent>
			</Card>

			{/* Stats Overview */}
			<div className="mb-8 grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm">Total Segments</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{segments.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm">Bullseye Segments (75+)</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{segments.filter((s) => s.bullseye_score >= 75).length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm">High Potential (50+)</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{segments.filter((s) => s.bullseye_score >= 50).length}</div>
					</CardContent>
				</Card>
			</div>

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
						const kindLabels: Record<string, string> = {
							persona: "Personas",
							job_function: "Job Functions",
							seniority_level: "Seniority Levels",
							title: "Job Titles",
							industry: "Industries",
							life_stage: "Life Stages",
							age_range: "Age Ranges",
						}
						return (
							<div key={kind}>
								<h2 className="mb-4 font-semibold text-xl">{kindLabels[kind] || kind}</h2>
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									{kindSegments.map((segment) => (
										<Link key={segment.id} to={segment.id}>
											<Card
												className={`transition-shadow hover:shadow-lg ${
													segment.bullseye_score >= 75 ? "border-red-200 ring-2 ring-red-100" : ""
												}`}
											>
												<CardHeader>
													<div className="mb-2 flex items-start justify-between">
														<CardTitle className="flex items-center gap-2 text-lg">
															{segment.bullseye_score >= 75 && <Target className="h-5 w-5 text-red-600" />}
															{segment.label}
														</CardTitle>
														<Badge variant="outline" className={`${getBullseyeColor(segment.bullseye_score)}`}>
															{segment.bullseye_score}
														</Badge>
													</div>
													<CardDescription className="flex items-center gap-1.5">
													{(() => {
														const { icon: Icon, label } = getBullseyeLabel(segment.bullseye_score)
														return (
															<>
																<Icon className="h-4 w-4" />
																{label}
															</>
														)
													})()}
												</CardDescription>
												</CardHeader>
												<CardContent>
													<div className="space-y-2 text-sm">
														<div className="flex items-center justify-between">
															<span className="flex items-center gap-1 text-muted-foreground">
																<Users className="h-4 w-4" />
																People
															</span>
															<span className="font-medium">{segment.person_count}</span>
														</div>
														<div className="flex items-center justify-between">
															<span className="flex items-center gap-1 text-muted-foreground">
																<TrendingUp className="h-4 w-4" />
																Evidence
															</span>
															<span className="font-medium">{segment.evidence_count}</span>
														</div>
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
									<div className="mb-2 flex items-start justify-between">
										<CardTitle className="flex items-center gap-2 text-lg">
											{segment.bullseye_score >= 75 && <Target className="h-5 w-5 text-red-600" />}
											{segment.label}
										</CardTitle>
										<Badge variant="outline" className={`${getBullseyeColor(segment.bullseye_score)}`}>
											{segment.bullseye_score}
										</Badge>
									</div>
									<CardDescription className="flex items-center gap-1.5">
										{(() => {
											const { icon: Icon, label } = getBullseyeLabel(segment.bullseye_score)
											return (
												<>
													<Icon className="h-4 w-4" />
													{label}
												</>
											)
										})()}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2 text-sm">
										<div className="flex items-center justify-between">
											<span className="flex items-center gap-1 text-muted-foreground">
												<Users className="h-4 w-4" />
												People
											</span>
											<span className="font-medium">{segment.person_count}</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="flex items-center gap-1 text-muted-foreground">
												<TrendingUp className="h-4 w-4" />
												Evidence
											</span>
											<span className="font-medium">{segment.evidence_count}</span>
										</div>
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
