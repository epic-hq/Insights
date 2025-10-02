import { CalendarIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Timeline, type TimelineItem } from "~/components/ui/timeline"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import type { Evidence } from "~/types"

interface ChronologicalEvidenceListProps {
	evidence: Evidence[]
	projectPath?: string
	interviewTitle?: string | null
	className?: string
	baseUrl?: string
}

export function PlayByPlayTimeline({ evidence, className = "" }: ChronologicalEvidenceListProps) {
	const [isExpanded, setIsExpanded] = useState(false)
	const { accountId, projectId } = useCurrentProject()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)

	// Sort evidence by created_at in chronological order (oldest first)
	const sortedEvidence = [...evidence].sort(
		(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
	)

	// Limit displayed evidence when not expanded
	const displayedEvidence = isExpanded ? sortedEvidence : sortedEvidence.slice(0, 5)

	// Get empathy map item if available (prioritize short phrases)
	const getEmpathyMapContent = (item: Evidence) => {
		// Check for empathy map items in priority order
		const empathyItems = [
			...(item.says || []),
			...(item.does || []),
			...(item.thinks || []),
			...(item.feels || []),
			...(item.pains || []),
			...(item.gains || []),
		].filter(Boolean)

		if (empathyItems.length === 0) return null

		// Return first empathy map item with icon
		const empathyItem = empathyItems[0]
		let icon = "💬" // Default icon

		// Determine icon based on which array contained the item
		if (item.says?.includes(empathyItem)) icon = "💬"
		else if (item.does?.includes(empathyItem)) icon = "⚡"
		else if (item.thinks?.includes(empathyItem)) icon = "💭"
		else if (item.feels?.includes(empathyItem)) icon = "❤️"
		else if (item.pains?.includes(empathyItem)) icon = "😣"
		else if (item.gains?.includes(empathyItem)) icon = "🎯"

		return (
			<div className="flex items-start gap-2">
				<span className="text-lg">{icon}</span>
				<p className="text-foreground">{empathyItem}</p>
			</div>
		)
	}

	// Create a link component that preserves the original appearance
	const createLinkWrapper = (item: Evidence, children: React.ReactNode) => {
		// If we have anchors, use the first one for linking
		const hasAnchors = item.anchors && item.anchors.length > 0
		const anchorParam = hasAnchors ? `?anchor=${encodeURIComponent(JSON.stringify(item.anchors[0]))}` : ""
		const url = `${routes.evidence.detail(item.id)}${anchorParam}`

		return (
			<Link to={url} className="text-inherit no-underline hover:no-underline">
				{children}
			</Link>
		)
	}

	// Convert evidence items to timeline items
	const timelineItems: TimelineItem[] = displayedEvidence.map((item) => ({
		id: item.id,
		title: createLinkWrapper(item, item.independence_key || ""),
		status: "default",
	}))

	return (
		<Card className={cn("overflow-hidden", className)}>
			<CardHeader className="bg-muted/30 pb-3">
				<CardTitle className="flex items-center gap-2 text-lg">
					<CalendarIcon className="h-5 w-5 text-muted-foreground" />
					Play-by-Play Timeline
					<Badge variant="secondary" className="ml-2">
						{sortedEvidence.length}
					</Badge>
				</CardTitle>
			</CardHeader>

			<CardContent className="p-0">
				{sortedEvidence.length === 0 ? (
					<div className="flex h-32 items-center justify-center text-muted-foreground">None</div>
				) : (
					<div className="px-4 py-2">
						<Timeline items={timelineItems} showTimestamps={false} variant="compact" />
					</div>
				)}

				{/* Show more/less button */}
				{sortedEvidence.length > 5 && (
					<div className="flex justify-center border-t p-2">
						<Button
							variant="ghost"
							size="sm"
							className="flex items-center gap-1 text-muted-foreground text-sm"
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? (
								<>
									<ChevronUpIcon className="h-4 w-4" />
									Show less
								</>
							) : (
								<>
									<ChevronDownIcon className="h-4 w-4" />
									Show {sortedEvidence.length - 5} more
								</>
							)}
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

export default PlayByPlayTimeline
