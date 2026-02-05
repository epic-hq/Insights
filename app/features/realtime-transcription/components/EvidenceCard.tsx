/**
 * Evidence card component for displaying individual evidence turns
 * extracted from real-time transcription. Shows gist, verbatim quote,
 * facet tags, empathy map signals, and timestamp anchor.
 */
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"
import type { EvidenceTurn, FacetMention } from "baml_client"
import { Lightbulb, MessageCircleQuestion, Clock } from "lucide-react"

interface EvidenceCardProps {
	evidence: EvidenceTurn
	index: number
	isNew?: boolean
}

function formatMs(ms: number | null | undefined): string {
	if (ms == null) return "--:--"
	const totalSec = Math.floor(ms / 1000)
	const min = Math.floor(totalSec / 60)
	const sec = totalSec % 60
	return `${min}:${sec.toString().padStart(2, "0")}`
}

const FACET_COLORS: Record<string, string> = {
	goal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	pain: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
	behavior: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	tool: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
	value: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
	preference: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
	workflow: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
	feature: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
	emotion: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
	context: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
	demographic: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
	artifact: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
}

export function EvidenceCard({ evidence, index, isNew }: EvidenceCardProps) {
	const facets = evidence.facet_mentions || []
	const empathySignals: Array<{ label: string; items: string[] }> = []

	if (evidence.says?.length) empathySignals.push({ label: "Says", items: evidence.says })
	if (evidence.does?.length) empathySignals.push({ label: "Does", items: evidence.does })
	if (evidence.thinks?.length) empathySignals.push({ label: "Thinks", items: evidence.thinks })
	if (evidence.feels?.length) empathySignals.push({ label: "Feels", items: evidence.feels })
	if (evidence.pains?.length) empathySignals.push({ label: "Pains", items: evidence.pains })
	if (evidence.gains?.length) empathySignals.push({ label: "Gains", items: evidence.gains })

	return (
		<Card
			className={cn(
				"transition-all duration-500 border-l-4",
				evidence.isQuestion ? "border-l-blue-400" : "border-l-emerald-400",
				isNew && "animate-in slide-in-from-right-4 fade-in duration-500",
			)}
		>
			<CardContent className="p-4 space-y-3">
				{/* Header: gist + question badge */}
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-start gap-2 min-w-0">
						{evidence.isQuestion ? (
							<MessageCircleQuestion className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
						) : (
							<Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
						)}
						<h4 className="text-sm font-semibold leading-tight">{evidence.gist}</h4>
					</div>
					{evidence.anchors?.start_ms != null && (
						<span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
							<Clock className="h-3 w-3" />
							{formatMs(evidence.anchors.start_ms)}
						</span>
					)}
				</div>

				{/* Verbatim quote */}
				<blockquote className="text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
					&ldquo;{evidence.verbatim}&rdquo;
				</blockquote>

				{/* Speaker */}
				{evidence.person_key && (
					<p className="text-xs text-muted-foreground">
						Speaker: <span className="font-medium">{evidence.speaker_label || evidence.person_key}</span>
					</p>
				)}

				{/* Why it matters */}
				{evidence.why_it_matters && (
					<p className="text-xs text-muted-foreground">
						<span className="font-medium">Why it matters:</span> {evidence.why_it_matters}
					</p>
				)}

				{/* Empathy map signals */}
				{empathySignals.length > 0 && (
					<div className="space-y-1">
						{empathySignals.map((signal) => (
							<div key={signal.label} className="flex items-start gap-1.5">
								<span className="text-xs font-medium text-muted-foreground w-12 shrink-0">{signal.label}:</span>
								<span className="text-xs text-muted-foreground">{signal.items.join("; ")}</span>
							</div>
						))}
					</div>
				)}

				{/* Facet tags */}
				{facets.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{facets.map((facet: FacetMention, i: number) => (
							<Badge
								key={`${facet.kind_slug}-${facet.value}-${i}`}
								variant="secondary"
								className={cn("text-xs px-1.5 py-0", FACET_COLORS[facet.kind_slug] || FACET_COLORS.context)}
							>
								{facet.kind_slug}: {facet.value}
							</Badge>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
