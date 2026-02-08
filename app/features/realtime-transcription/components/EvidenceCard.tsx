/**
 * Evidence card component for displaying individual evidence turns
 * extracted from real-time transcription.
 *
 * Design principles:
 * - Clean, scannable format: "SPEAKER: <gist>"
 * - Optional short tag for categorization (pain, goal, signal)
 * - Verbatim quote only on expand
 * - Minimal chrome, maximum information density
 */

import type { EvidenceTurn } from "baml_client"
import { ChevronDown, ChevronRight, Clock } from "lucide-react"
import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"
import { formatMs } from "../lib/audio"

interface EvidenceCardProps {
	evidence: EvidenceTurn
	index: number
	isNew?: boolean
	compact?: boolean
	/** Optional map of speaker keys to display names */
	speakerNames?: Record<string, string>
}

/**
 * Derive a short tag from evidence signals (pain, goal, buying signal, etc.)
 */
function deriveTag(evidence: EvidenceTurn): { label: string; color: string } | null {
	// Check for pain points
	if (evidence.pains?.length) {
		return {
			label: "pain",
			color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
		}
	}
	// Check for goals/gains
	if (evidence.gains?.length || evidence.facet_mentions?.some((f) => f.kind_slug === "goal")) {
		return {
			label: "goal",
			color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
		}
	}
	// Check for tool mentions
	if (evidence.facet_mentions?.some((f) => f.kind_slug === "tool")) {
		return {
			label: "tool",
			color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
		}
	}
	// Check for workflow
	if (evidence.facet_mentions?.some((f) => f.kind_slug === "workflow")) {
		return {
			label: "workflow",
			color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
		}
	}
	// Questions from interviewer
	if (evidence.isQuestion) {
		return {
			label: "probe",
			color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
		}
	}
	return null
}

export function EvidenceCard({ evidence, index, isNew, compact, speakerNames = {} }: EvidenceCardProps) {
	const [expanded, setExpanded] = useState(!compact)

	// Get speaker display name
	const speakerKey = evidence.person_key || evidence.speaker_label || "Unknown"
	const speakerDisplay = speakerNames[speakerKey] || evidence.speaker_label || speakerKey

	// Derive a category tag
	const tag = deriveTag(evidence)

	// Check if there's more detail to show
	const hasVerbatim = Boolean(evidence.verbatim)

	// Compact view: single line "SPEAKER: gist"
	if (compact && !expanded) {
		return (
			<div
				className={cn(
					"group flex cursor-pointer items-start gap-2 rounded-md border-l-2 py-2 pr-2 pl-3 transition-colors hover:bg-muted/50",
					evidence.isQuestion ? "border-l-blue-400" : "border-l-emerald-400",
					isNew && "slide-in-from-right-4 fade-in animate-in duration-500"
				)}
				onClick={() => setExpanded(true)}
			>
				{/* Tag badge */}
				{tag && (
					<Badge variant="secondary" className={cn("shrink-0 px-1.5 py-0 font-medium text-[10px]", tag.color)}>
						{tag.label}
					</Badge>
				)}

				{/* Speaker: Gist */}
				<p className="flex-1 text-sm">
					<span className="font-semibold text-muted-foreground">{speakerDisplay}:</span>{" "}
					<span className="text-foreground">{evidence.gist}</span>
				</p>

				{/* Timestamp + expand indicator */}
				<div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
					{evidence.anchors?.start_ms != null && (
						<span className="flex items-center gap-0.5 text-muted-foreground text-xs">
							<Clock className="h-3 w-3" />
							{formatMs(evidence.anchors.start_ms)}
						</span>
					)}
					{hasVerbatim && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
				</div>
			</div>
		)
	}

	// Expanded view: shows verbatim quote
	return (
		<div
			className={cn(
				"rounded-md border-l-2 py-2 pr-2 pl-3 transition-all",
				evidence.isQuestion ? "border-l-blue-400" : "border-l-emerald-400",
				isNew && "slide-in-from-right-4 fade-in animate-in duration-500"
			)}
		>
			{/* Header row */}
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-start gap-2">
					{/* Tag badge */}
					{tag && (
						<Badge variant="secondary" className={cn("shrink-0 px-1.5 py-0 font-medium text-[10px]", tag.color)}>
							{tag.label}
						</Badge>
					)}

					{/* Speaker: Gist */}
					<p className="text-sm">
						<span className="font-semibold text-muted-foreground">{speakerDisplay}:</span>{" "}
						<span className="text-foreground">{evidence.gist}</span>
					</p>
				</div>

				{/* Timestamp + collapse */}
				<div className="flex shrink-0 items-center gap-1">
					{evidence.anchors?.start_ms != null && (
						<span className="flex items-center gap-0.5 text-muted-foreground text-xs">
							<Clock className="h-3 w-3" />
							{formatMs(evidence.anchors.start_ms)}
						</span>
					)}
					{compact && (
						<button type="button" onClick={() => setExpanded(false)} className="rounded p-0.5 hover:bg-muted">
							<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
						</button>
					)}
				</div>
			</div>

			{/* Verbatim quote - only detail we show */}
			{evidence.verbatim && (
				<p className="mt-2 border-muted-foreground/30 border-l pl-2 text-muted-foreground text-xs italic">
					"{evidence.verbatim}"
				</p>
			)}
		</div>
	)
}
