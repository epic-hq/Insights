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

	const extractAnchorSeconds = (item: Evidence): number | null => {
		const anchors = Array.isArray(item.anchors) ? (item.anchors as Array<Record<string, any>>) : []
		const anchor = anchors.find((value) => value && typeof value === "object")
		if (!anchor) return null

		const rawStart =
			anchor.start_seconds ??
			anchor.startSeconds ??
			anchor.start_sec ??
			anchor.start ??
			anchor.start_ms ??
			anchor.startMs ??
			anchor.start_time

		if (typeof rawStart === "number" && Number.isFinite(rawStart)) {
			return rawStart > 500 ? rawStart / 1000 : rawStart
		}

		if (typeof rawStart === "string") {
			if (rawStart.endsWith("ms")) {
				return Number.parseFloat(rawStart.replace("ms", "")) / 1000
			}
			if (rawStart.includes(":")) {
				const [minutes, seconds] = rawStart.split(":").map((part) => Number.parseFloat(part))
				if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
					return minutes * 60 + seconds
				}
			}
			const numeric = Number.parseFloat(rawStart)
			if (Number.isFinite(numeric)) {
				return numeric > 500 ? numeric / 1000 : numeric
			}
		}

		return null
	}
	// Sort evidence by created_at in chronological order (oldest first)
	const sortedEvidence = [...evidence].sort(
		(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
	)

	// Group by scene topic (only where topic exists)
	type TopicGroup = { topic: string; first: Evidence; firstSeconds: number | null; count: number }
	const byTopic = new Map<string, TopicGroup>()
	for (const item of sortedEvidence) {
		const topic = (item as any)?.topic
		if (!topic || typeof topic !== "string" || topic.trim().length === 0) continue
		const seconds = extractAnchorSeconds(item)
		const existing = byTopic.get(topic)
		if (!existing) {
			byTopic.set(topic, { topic, first: item, firstSeconds: seconds, count: 1 })
		} else {
			existing.count += 1
			// pick earliest timestamp if available
			if (
				(seconds !== null && existing.firstSeconds === null) ||
				(seconds !== null && existing.firstSeconds !== null && seconds < existing.firstSeconds)
			) {
				existing.first = item
				existing.firstSeconds = seconds
			}
		}
	}

	const topicGroups = Array.from(byTopic.values()).sort((a, b) => {
		const aKey = a.firstSeconds ?? new Date(a.first.created_at).getTime() / 1000
		const bKey = b.firstSeconds ?? new Date(b.first.created_at).getTime() / 1000
		return aKey - bKey
	})

	// Limit displayed topics when not expanded
	const displayedTopics = isExpanded ? topicGroups : topicGroups.slice(0, 5)

	// Get empathy map item if available (prioritize short phrases)
	const _getEmpathyMapContent = (item: Evidence) => {
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

	const formatSeconds = (value: number): string => {
		if (!Number.isFinite(value) || value < 0) return ""
		const totalSeconds = Math.round(value)
		const minutes = Math.floor(totalSeconds / 60)
		const seconds = totalSeconds % 60
		return `${minutes}:${seconds.toString().padStart(2, "0")}`
	}

	// Create a link to internal evidence detail with optional time param
	const createLinkWrapper = (item: Evidence, children: React.ReactNode) => {
		let url = routes.evidence.detail(item.id)
		const seconds = extractAnchorSeconds(item)
		if (seconds !== null && seconds >= 0) {
			url = `${url}?t=${Math.round(seconds)}`
		}
		return (
			<Link to={url} className="group inline-flex w-full flex-col gap-1 text-inherit no-underline hover:no-underline">
				{children}
			</Link>
		)
	}

	// No verbose content in compact, scene-based timeline

	// Convert scene topics to compact timeline items
	const timelineItems: TimelineItem[] = displayedTopics.map(({ topic, first, firstSeconds, count }) => {
		const timeChip =
			firstSeconds !== null ? (
				<span key={first.id} className="ml-2 flex shrink-0 rounded bg-background/5 px-1.5 py-0.5 font-medium text-[#FF8A66] text-[10px] uppercase tracking-wide">
					{formatSeconds(firstSeconds)}
				</span>
			) : null
		return {
			id: `${first.id}`,
			title: createLinkWrapper(
				first,
				<div className="flex items-center justify-between gap-2">
					<span className="line-clamp-1 font-medium text-foreground group-hover:text-foreground">{topic}</span>
					<div className="flex items-center gap-2">
						{timeChip}
						<span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70">{count}</span>
					</div>
				</div>
			),
			status: "default",
		}
	})

	return (
		<Card className={cn("overflow-hidden", className)}>
			<CardHeader className="bg-muted/30 pb-3">
				<CardTitle className="flex items-center gap-2 text-lg">
					<CalendarIcon className="h-5 w-5 text-muted-foreground" />
					Conversation Timeline
					<Badge variant="secondary" className="ml-2">
						{topicGroups.length}
					</Badge>
				</CardTitle>
			</CardHeader>

			<CardContent className="p-0">
				{topicGroups.length === 0 ? (
					<div className="flex h-32 items-center justify-center text-muted-foreground">None</div>
				) : (
					<div className="px-4 py-2">
						<Timeline items={timelineItems} showTimestamps={false} variant="compact" />
					</div>
				)}

				{/* Show more/less button */}
				{topicGroups.length > 5 && (
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
									Show {topicGroups.length - 5} more
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
