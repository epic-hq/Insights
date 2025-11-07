import { AlertCircle, ArrowLeft, DollarSign, Target, TrendingUp, Users } from "lucide-react"
import { Link, useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { userContext } from "~/server/user-context"
import { getSegmentDetail } from "../services/segmentData.server"
import type { Route } from "./+types/detail"

export async function loader({ context, params }: Route.LoaderArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const { segmentId } = params

	if (!segmentId) {
		throw new Response("Segment ID required", { status: 400 })
	}

	const segment = await getSegmentDetail(supabase, segmentId)

	if (!segment) {
		throw new Response("Segment not found", { status: 404 })
	}

	return { segment }
}

function calculateBullseyeScore(segment: {
	person_count: number
	evidence_count: number
	high_willingness_to_pay_count: number
	avg_pain_intensity: number
}): number {
	const sampleSizeScore = Math.min(((segment.person_count / 3) * 30 + (segment.evidence_count / 10) * 20) / 2, 25)
	const wtpScore =
		segment.evidence_count > 0 ? (segment.high_willingness_to_pay_count / segment.evidence_count) * 40 : 0
	const painScore = segment.avg_pain_intensity * 35
	return Math.round(sampleSizeScore + wtpScore + painScore)
}

function getBullseyeColor(score: number): string {
	if (score >= 75) return "bg-red-600"
	if (score >= 50) return "bg-orange-500"
	if (score >= 25) return "bg-yellow-500"
	return "bg-gray-400"
}

function getBullseyeLabel(score: number): string {
	if (score >= 75) return "🎯 Bullseye Customer"
	if (score >= 50) return "🔥 High Potential"
	if (score >= 25) return "⚡ Promising Segment"
	return "🔍 Need More Data"
}

function getImpactColor(score: number): string {
	if (score >= 2.0) return "rgba(239, 68, 68, 0.3)"
	if (score >= 1.5) return "rgba(249, 115, 22, 0.3)"
	if (score >= 1.0) return "rgba(234, 179, 8, 0.3)"
	if (score >= 0.5) return "rgba(34, 197, 94, 0.3)"
	return "rgba(148, 163, 184, 0.1)"
}

export default function SegmentDetail({ loaderData }: Route.ComponentProps) {
	const { segment } = loaderData

	const bullseyeScore = calculateBullseyeScore(segment)
	const wtpPercentage =
		segment.evidence_count > 0 ? Math.round((segment.high_willingness_to_pay_count / segment.evidence_count) * 100) : 0

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			{/* Back Button */}
			<Link to="..">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Segments
				</Button>
			</Link>

			{/* Header */}
			<div className="mb-8">
				<div className="mb-4 flex flex-wrap items-start justify-between gap-4">
					<div>
						<Badge variant="outline" className="mb-2 capitalize">
							{segment.kind}
						</Badge>
						<h1 className="mb-2 flex items-center gap-3 font-bold text-4xl tracking-tight">
							{bullseyeScore >= 75 && <Target className="h-10 w-10 text-red-600" />}
							{segment.label}
						</h1>
						{segment.definition && <p className="text-lg text-muted-foreground">{segment.definition}</p>}
					</div>
					<div className="text-right">
						<div className="mb-2 text-muted-foreground text-sm">Bullseye Score</div>
						<div className="mb-1 flex items-center justify-end gap-2 font-bold text-4xl">
							{bullseyeScore >= 75 && <Target className="h-8 w-8 text-red-600" />}
							{bullseyeScore}
						</div>
						<Badge
							variant="outline"
							className={`${getBullseyeColor(bullseyeScore) === "bg-red-600" ? "border-red-200 bg-red-50 text-red-700" : getBullseyeColor(bullseyeScore) === "bg-orange-500" ? "border-orange-200 bg-orange-50 text-orange-700" : getBullseyeColor(bullseyeScore) === "bg-yellow-500" ? "border-yellow-200 bg-yellow-50 text-yellow-700" : "border-gray-200 bg-gray-50 text-gray-700"}`}
						>
							{getBullseyeLabel(bullseyeScore)}
						</Badge>
					</div>
				</div>
			</div>

			{/* Key Metrics */}
			<div className="mb-8 grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-sm">
							<Users className="h-4 w-4" />
							People
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{segment.person_count}</div>
						<p className="text-muted-foreground text-xs">
							{segment.person_count < 3 ? "⚠️ Low sample" : "✓ Sufficient data"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-sm">
							<TrendingUp className="h-4 w-4" />
							Evidence
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{segment.evidence_count}</div>
						<p className="text-muted-foreground text-xs">
							{segment.evidence_count < 10 ? "⚠️ Low confidence" : "✓ High confidence"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-sm">
							<DollarSign className="h-4 w-4" />
							Willingness to Pay
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{wtpPercentage}%</div>
						<p className="text-muted-foreground text-xs">
							{segment.high_willingness_to_pay_count} / {segment.evidence_count} signals
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-sm">
							<AlertCircle className="h-4 w-4" />
							Pain Intensity
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{(segment.avg_pain_intensity * 100).toFixed(0)}%</div>
						<p className="text-muted-foreground text-xs">
							{segment.avg_pain_intensity >= 0.7
								? "🔥 Critical"
								: segment.avg_pain_intensity >= 0.4
									? "⚡ High"
									: "Low"}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Buying Signal Analysis */}
			{bullseyeScore >= 50 && (
				<Card className="mb-8 border-primary/50 bg-primary/5">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5 text-primary" />
							Why This Is Your Bullseye Customer
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						{segment.person_count >= 3 && (
							<p>
								✓ <strong>Sufficient sample size</strong> ({segment.person_count} people, {segment.evidence_count}{" "}
								evidence) gives you confidence in the data
							</p>
						)}
						{wtpPercentage >= 40 && (
							<p>
								✓ <strong>High willingness to pay</strong> ({wtpPercentage}%) – they're actively looking for solutions
								and will pay for them
							</p>
						)}
						{segment.avg_pain_intensity >= 0.5 && (
							<p>
								✓ <strong>High pain intensity</strong> ({(segment.avg_pain_intensity * 100).toFixed(0)}
								%) – the problem is urgent and top-of-mind
							</p>
						)}
						<p className="pt-2 font-medium text-primary">
							→ Prioritize this segment for early customer interviews, beta testing, and initial GTM.
						</p>
					</CardContent>
				</Card>
			)}

			{bullseyeScore < 25 && (
				<Card className="mb-8 border-yellow-500/50 bg-yellow-50">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-yellow-800">
							<AlertCircle className="h-5 w-5" />
							Low Confidence Signal
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-yellow-900">
						{segment.person_count < 3 && (
							<p>⚠️ Only {segment.person_count} people in this segment – add more interviews</p>
						)}
						{segment.evidence_count < 10 && (
							<p>⚠️ Only {segment.evidence_count} evidence items – need more data points</p>
						)}
						{wtpPercentage < 20 && <p>⚠️ Low willingness to pay signals – may not convert</p>}
						<p className="pt-2 font-medium">→ Collect more customer data before prioritizing this segment.</p>
					</CardContent>
				</Card>
			)}

			{/* Top Pain Themes */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle>Top Pain Themes</CardTitle>
					<CardDescription>What this segment struggles with most</CardDescription>
				</CardHeader>
				<CardContent>
					{segment.top_pains.length === 0 ? (
						<p className="text-center text-muted-foreground text-sm">
							No pain themes identified yet. Add more interviews with this segment.
						</p>
					) : (
						<div className="space-y-3">
							{segment.top_pains.map((pain, idx) => {
								// Link to first evidence ID, or to pain matrix if no evidence IDs
								const linkTo = pain.evidence_ids?.[0]
									? `../../evidence/${pain.evidence_ids[0]}`
									: `../../pain-matrix`
								return (
									<Link key={pain.pain_theme} to={linkTo}>
									<div
										className="group flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md"
										style={{
											backgroundColor: getImpactColor(pain.impact_score),
										}}
									>
										<div className="flex-1">
											<div className="flex items-center gap-3">
												<span className="font-semibold text-muted-foreground text-sm">#{idx + 1}</span>
												<span className="font-medium group-hover:text-primary">{pain.pain_theme}</span>
											</div>
											<div className="mt-1 flex gap-4 text-muted-foreground text-xs">
												<span>{pain.evidence_count} evidence</span>
												<span>{(pain.frequency * 100).toFixed(0)}% of segment</span>
											</div>
										</div>
										<div className="text-right">
											<div className="font-bold">{pain.impact_score.toFixed(1)}</div>
											<div className="text-muted-foreground text-xs">impact</div>
										</div>
									</div>
								</Link>
								)
							})}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Related Insights */}
			{segment.insight_count > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Related Insights</CardTitle>
						<CardDescription>
							{segment.insight_count} insight{segment.insight_count !== 1 ? "s" : ""} tagged with this segment
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link to={`../../insights?segment=${segment.label}`}>
							<Button>View All Insights →</Button>
						</Link>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
