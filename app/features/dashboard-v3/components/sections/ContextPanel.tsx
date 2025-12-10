/**
 * ContextPanel - Project context sidebar for dashboard
 *
 * Displays project setup progress, quick stats, and add conversation CTA.
 * Uses progressive disclosure with accordion for details.
 */

import { ChevronDown, FileAudio, Glasses, Plus, Settings } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Progress } from "~/components/ui/progress"
import { cn } from "~/lib/utils"

/** Setup fields we track for completion */
const SETUP_FIELDS = [
	{ key: "research_goal", label: "Research Goal" },
	{ key: "target_roles", label: "Target Roles" },
	{ key: "target_orgs", label: "Target Organizations" },
	{ key: "assumptions", label: "Assumptions" },
	{ key: "unknowns", label: "Unknowns" },
] as const

export interface ProjectContext {
	research_goal?: string | null
	target_roles?: string[] | null
	target_orgs?: string[] | null
	assumptions?: string[] | null
	unknowns?: string[] | null
}

export interface ContextPanelProps {
	/** Project research goal text (legacy prop) */
	researchGoal?: string
	/** Full project context for % complete calculation */
	projectContext?: ProjectContext
	/** Total conversation count */
	conversationCount: number
	/** Number of active lenses */
	activeLensCount: number
	/** Base path for project routes */
	projectPath: string
	/** Additional CSS classes */
	className?: string
}

/** Calculate setup completion percentage */
function calculateSetupCompletion(context?: ProjectContext, researchGoal?: string): number {
	if (!context && !researchGoal) return 0

	let filled = 0
	const total = SETUP_FIELDS.length

	// Check each field
	if (context?.research_goal || researchGoal) filled++
	if (context?.target_roles && context.target_roles.length > 0) filled++
	if (context?.target_orgs && context.target_orgs.length > 0) filled++
	if (context?.assumptions && context.assumptions.length > 0) filled++
	if (context?.unknowns && context.unknowns.length > 0) filled++

	return Math.round((filled / total) * 100)
}

/** Get list of filled fields for display */
function getFilledFields(context?: ProjectContext, researchGoal?: string): string[] {
	const filled: string[] = []

	if (context?.research_goal || researchGoal) filled.push("Research Goal")
	if (context?.target_roles && context.target_roles.length > 0) filled.push("Target Roles")
	if (context?.target_orgs && context.target_orgs.length > 0) filled.push("Target Orgs")
	if (context?.assumptions && context.assumptions.length > 0) filled.push("Assumptions")
	if (context?.unknowns && context.unknowns.length > 0) filled.push("Unknowns")

	return filled
}

export function ContextPanel({
	researchGoal,
	projectContext,
	conversationCount,
	activeLensCount,
	projectPath,
	className,
}: ContextPanelProps) {
	const [isOpen, setIsOpen] = useState(false)
	const completionPercent = calculateSetupCompletion(projectContext, researchGoal)
	const filledFields = getFilledFields(projectContext, researchGoal)
	const displayGoal = projectContext?.research_goal || researchGoal

	return (
		<aside className={cn("space-y-3", className)}>
			{/* Add Conversation - Compact */}
			<Button asChild size="sm" className="w-full">
				<Link to={`${projectPath}/interviews/upload`}>
					<Plus className="mr-1.5 h-3.5 w-3.5" />
					Add Conversation
				</Link>
			</Button>

			{/* Quick Stats - Inline */}
			<div className="flex gap-2">
				<Link
					to={`${projectPath}/interviews`}
					className="flex flex-1 items-center justify-center gap-1.5 rounded-md border bg-card p-2 transition-colors hover:bg-muted/50"
				>
					<FileAudio className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="font-medium text-foreground text-sm">{conversationCount}</span>
				</Link>
				<Link
					to={`${projectPath}/lens-library`}
					className="flex flex-1 items-center justify-center gap-1.5 rounded-md border bg-card p-2 transition-colors hover:bg-muted/50"
				>
					<Glasses className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="font-medium text-foreground text-sm">{activeLensCount}</span>
				</Link>
			</div>

			{/* Project Setup Progress - Collapsible */}
			<Card>
				<Collapsible open={isOpen} onOpenChange={setIsOpen}>
					<CollapsibleTrigger asChild>
						<button
							type="button"
							className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/50"
						>
							<Settings className="h-4 w-4 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<div className="flex items-center justify-between">
									<span className="font-medium text-foreground text-sm">Project Setup</span>
									<span className="text-muted-foreground text-xs">{completionPercent}%</span>
								</div>
								<Progress value={completionPercent} className="mt-1.5 h-1" />
							</div>
							<ChevronDown
								className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
							/>
						</button>
					</CollapsibleTrigger>

					<CollapsibleContent>
						<CardContent className="border-t px-3 pt-2 pb-3">
							{/* Show filled fields */}
							{filledFields.length > 0 ? (
								<div className="space-y-2">
									{displayGoal && (
										<div>
											<p className="text-muted-foreground text-xs">Goal</p>
											<p className="line-clamp-2 text-foreground text-xs leading-relaxed">{displayGoal}</p>
										</div>
									)}
									{filledFields.length > 1 && (
										<p className="text-muted-foreground text-xs">
											+{filledFields.length - 1} more field{filledFields.length > 2 ? "s" : ""} set
										</p>
									)}
								</div>
							) : (
								<p className="text-muted-foreground text-xs">No setup completed yet</p>
							)}

							<Button asChild variant="outline" size="sm" className="mt-2 w-full">
								<Link to={`${projectPath}/setup`}>{completionPercent < 100 ? "Complete Setup" : "Edit Setup"}</Link>
							</Button>
						</CardContent>
					</CollapsibleContent>
				</Collapsible>
			</Card>
		</aside>
	)
}

export default ContextPanel
