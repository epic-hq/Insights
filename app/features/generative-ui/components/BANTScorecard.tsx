/**
 * BANTScorecard - Real-time BANT qualification display
 *
 * Demonstrates streaming UI concept:
 * - Updates in real-time as evidence is extracted from voice/chat
 * - Shows evidence chips with timestamps (clickable to play clips)
 * - Calculates overall deal score automatically
 */

import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, CheckCircle2, Clock, DollarSign, Target, TrendingUp, User, Video } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { cn } from "~/lib/utils"

interface EvidenceClip {
	verbatim: string
	timestamp: number // seconds
	confidence: number // 0-1
}

interface BANTFacet {
	score: number // 0-100
	evidence: EvidenceClip[]
	status: "empty" | "partial" | "complete"
	updating?: boolean // streaming in progress
}

interface BANTScorecardProps {
	/** Budget facet */
	budget?: BANTFacet
	/** Authority facet */
	authority?: BANTFacet
	/** Need facet */
	need?: BANTFacet
	/** Timeline facet */
	timeline?: BANTFacet
	/** Overall qualification score (auto-calculated from facets) */
	overallScore?: number
	/** Whether the scorecard is currently receiving updates */
	isStreaming?: boolean
	/** Callback when user clicks an evidence chip */
	onPlayClip?: (timestamp: number) => void
}

const FACET_CONFIGS = {
	budget: {
		icon: DollarSign,
		label: "Budget",
		color: "emerald",
		emptyMessage: "No budget info captured yet",
	},
	authority: {
		icon: User,
		label: "Authority",
		color: "blue",
		emptyMessage: "No decision maker identified",
	},
	need: {
		icon: Target,
		label: "Need",
		color: "orange",
		emptyMessage: "No pain points captured",
	},
	timeline: {
		icon: Clock,
		label: "Timeline",
		color: "purple",
		emptyMessage: "No timeline discussed",
	},
} as const

function formatTimestamp(seconds: number): string {
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, "0")}`
}

function FacetCard({
	facet,
	config,
	onPlayClip,
}: {
	facet: BANTFacet
	config: (typeof FACET_CONFIGS)[keyof typeof FACET_CONFIGS]
	onPlayClip?: (timestamp: number) => void
}) {
	const Icon = config.icon
	const isEmpty = facet.status === "empty"
	const isPartial = facet.status === "partial"

	return (
		<Card className={cn("relative transition-all", facet.updating && "ring-2 ring-primary/50")}>
			{facet.updating && (
				<div className="absolute top-2 right-2">
					<div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
				</div>
			)}
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Icon className={cn("h-5 w-5", `text-${config.color}-500`)} />
						<CardTitle className="text-base">{config.label}</CardTitle>
					</div>
					<div className="flex items-center gap-1.5">
						{isEmpty ? (
							<AlertCircle className="h-4 w-4 text-muted-foreground" />
						) : (
							<>
								<span className="font-semibold text-lg">{facet.score}</span>
								<span className="text-muted-foreground text-xs">/ 100</span>
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{/* Progress Bar */}
				<Progress value={facet.score} className={cn("h-2", isEmpty && "opacity-30", isPartial && "bg-yellow-100")} />

				{/* Evidence Chips */}
				{facet.evidence.length > 0 ? (
					<div className="space-y-2">
						<p className="font-medium text-muted-foreground text-xs">Evidence:</p>
						<div className="space-y-1.5">
							<AnimatePresence>
								{facet.evidence.map((clip, index) => (
									<motion.button
										key={index}
										type="button"
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: index * 0.1 }}
										onClick={() => onPlayClip?.(clip.timestamp)}
										className="group flex w-full items-start gap-2 rounded-md border bg-muted/50 p-2 text-left transition-colors hover:bg-muted"
									>
										<Video className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground group-hover:text-primary" />
										<div className="min-w-0 flex-1">
											<p className="text-foreground text-xs leading-snug">"{clip.verbatim}"</p>
											<div className="mt-1 flex items-center gap-2">
												<span className="font-mono text-[10px] text-primary">{formatTimestamp(clip.timestamp)}</span>
												<span className="text-[10px] text-muted-foreground">
													{Math.round(clip.confidence * 100)}% confidence
												</span>
											</div>
										</div>
									</motion.button>
								))}
							</AnimatePresence>
						</div>
					</div>
				) : (
					<p className="text-muted-foreground text-xs italic">{config.emptyMessage}</p>
				)}
			</CardContent>
		</Card>
	)
}

export function BANTScorecard({
	budget = { score: 0, evidence: [], status: "empty" },
	authority = { score: 0, evidence: [], status: "empty" },
	need = { score: 0, evidence: [], status: "empty" },
	timeline = { score: 0, evidence: [], status: "empty" },
	overallScore = 0,
	isStreaming = false,
	onPlayClip,
}: BANTScorecardProps) {
	// Determine deal temperature based on score
	const temperature =
		overallScore >= 70
			? { label: "Hot", color: "text-emerald-500", icon: "🔥" }
			: overallScore >= 40
				? { label: "Warm", color: "text-yellow-500", icon: "☀️" }
				: { label: "Cold", color: "text-blue-500", icon: "❄️" }

	const facets = { budget, authority, need, timeline }

	return (
		<div className="space-y-4">
			{/* Overall Score Header */}
			<Card className="border-2">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5 text-primary" />
								BANT Qualification Score
							</CardTitle>
							<CardDescription className="mt-1">
								{isStreaming ? "Analyzing conversation..." : "Based on captured evidence"}
							</CardDescription>
						</div>
						<div className="flex items-center gap-3">
							<div className="text-center">
								<div className="flex items-baseline gap-1">
									<span className="font-bold text-4xl">{overallScore}</span>
									<span className="text-muted-foreground text-sm">/ 100</span>
								</div>
								<div className={cn("mt-1 flex items-center gap-1 font-medium text-sm", temperature.color)}>
									<span>{temperature.icon}</span>
									<span>{temperature.label} Deal</span>
								</div>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Progress value={overallScore} className="h-3" />
					{isStreaming && (
						<p className="mt-2 animate-pulse text-muted-foreground text-xs">Extracting evidence from conversation...</p>
					)}
				</CardContent>
			</Card>

			{/* BANT Facets Grid */}
			<div className="grid grid-cols-2 gap-4">
				{(Object.keys(facets) as Array<keyof typeof facets>).map((facetKey) => (
					<FacetCard key={facetKey} facet={facets[facetKey]} config={FACET_CONFIGS[facetKey]} onPlayClip={onPlayClip} />
				))}
			</div>

			{/* Next Steps */}
			{overallScore >= 70 && !isStreaming && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="rounded-lg border border-emerald-500/20 bg-emerald-50 p-4 dark:bg-emerald-950/20"
				>
					<div className="flex items-start gap-2">
						<CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
						<div>
							<p className="font-medium text-emerald-900 text-sm dark:text-emerald-100">
								Hot Deal - Ready for Next Steps
							</p>
							<p className="mt-1 text-emerald-700 text-xs dark:text-emerald-300">
								Strong qualification signals across all BANT criteria. Consider scheduling a proposal review or demo.
							</p>
						</div>
					</div>
				</motion.div>
			)}
		</div>
	)
}
