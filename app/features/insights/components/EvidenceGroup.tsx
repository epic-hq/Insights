/**
 * EvidenceGroup - Groups evidence by interview/organization
 *
 * Clusters related quotes from the same conversation together,
 * with collapsible sections per interview source.
 */

import { Building2, ChevronDown, ChevronRight, FileText, Users } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { InsightEvidence } from "../pages/insight-detail"
import { FullEvidenceCard } from "./FullEvidenceCard"

interface EvidenceGroupProps {
	evidence: InsightEvidence[]
	projectPath: string
}

interface GroupedEvidence {
	key: string
	label: string
	organization: string | null
	interviewId: string | null
	thumbnail: string | null
	items: InsightEvidence[]
}

/** Group evidence by interview, with organization as secondary grouping key */
function groupEvidenceByInterview(evidence: InsightEvidence[]): GroupedEvidence[] {
	const groups = new Map<string, GroupedEvidence>()

	for (const ev of evidence) {
		// Use interview_id as primary key, fallback to a generic "ungrouped" key
		const key = ev.interview_id || "ungrouped"

		if (!groups.has(key)) {
			groups.set(key, {
				key,
				label: ev.interview?.title || ev.attribution || "Interview",
				organization: ev.organization,
				interviewId: ev.interview_id,
				thumbnail: ev.interview?.thumbnail_url || null,
				items: [],
			})
		}

		groups.get(key)!.items.push(ev)
	}

	// Sort groups by number of evidence items (most first)
	return Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length)
}

export function EvidenceGroupedByInterview({ evidence, projectPath }: EvidenceGroupProps) {
	const groups = groupEvidenceByInterview(evidence)
	const routes = useProjectRoutes(projectPath)

	// Track which groups are expanded (default: first 2 expanded)
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
		const initial = new Set<string>()
		groups.slice(0, 2).forEach((g) => initial.add(g.key))
		return initial
	})

	const toggleGroup = (key: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev)
			if (next.has(key)) {
				next.delete(key)
			} else {
				next.add(key)
			}
			return next
		})
	}

	if (groups.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center">
				<FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
				<p className="mt-2 text-muted-foreground text-sm">No evidence linked to this insight yet</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{/* Summary header */}
			<div className="flex items-center gap-4 text-muted-foreground text-sm">
				<div className="flex items-center gap-1.5">
					<FileText className="h-4 w-4" />
					<span>{evidence.length} quotes</span>
				</div>
				<div className="flex items-center gap-1.5">
					<Users className="h-4 w-4" />
					<span>{groups.length} interviews</span>
				</div>
			</div>

			{/* Grouped evidence */}
			<div className="space-y-3">
				{groups.map((group) => {
					const isExpanded = expandedGroups.has(group.key)

					return (
						<Collapsible
							key={group.key}
							open={isExpanded}
							onOpenChange={() => toggleGroup(group.key)}
						>
							{/* Group header */}
							<div className="rounded-lg border bg-card">
								<CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50">
									{/* Thumbnail */}
									<div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-muted">
										{group.thumbnail ? (
											<img
												src={group.thumbnail}
												alt=""
												className="h-full w-full object-cover"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center">
												<FileText className="h-5 w-5 text-muted-foreground/50" />
											</div>
										)}
									</div>

									{/* Label and org */}
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											{isExpanded ? (
												<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
											) : (
												<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
											)}
											<span className="truncate font-medium">{group.label}</span>
										</div>
										{group.organization && (
											<div className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
												<Building2 className="h-3 w-3" />
												{group.organization}
											</div>
										)}
									</div>

									{/* Count badge */}
									<Badge variant="secondary" className="shrink-0">
										{group.items.length} quote{group.items.length !== 1 ? "s" : ""}
									</Badge>
								</CollapsibleTrigger>

								<CollapsibleContent>
									<div className="space-y-3 border-t px-4 py-4">
										{group.items.map((ev) => (
											<FullEvidenceCard
												key={ev.id}
												evidence={ev}
												projectPath={projectPath}
												defaultExpanded={group.items.length === 1}
											/>
										))}

										{/* Link to full interview */}
										{group.interviewId && (
											<Link
												to={routes.interviews.detail(group.interviewId)}
												className="mt-2 block text-center text-primary text-sm hover:underline"
											>
												View full interview →
											</Link>
										)}
									</div>
								</CollapsibleContent>
							</div>
						</Collapsible>
					)
				})}
			</div>
		</div>
	)
}
