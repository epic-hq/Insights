/**
 * ContextPanel - Project context sidebar for dashboard
 *
 * Displays project setup progress, quick stats, and add conversation CTA.
 * Uses progressive disclosure with accordion for details.
 */

import { Check, ChevronDown, FileAudio, Glasses, Plus, StickyNote } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Progress } from "~/components/ui/progress"
import { cn } from "~/lib/utils"

/** Setup fields we track for completion - with user-friendly labels */
const SETUP_FIELDS = [
	{ key: "research_goal", label: "Research Goal", shortLabel: "Goal" },
	{ key: "target_roles", label: "Target Roles", shortLabel: "Roles" },
	{ key: "target_orgs", label: "Target Organizations", shortLabel: "Orgs" },
	{ key: "assumptions", label: "Assumptions", shortLabel: "Assumptions" },
	{ key: "unknowns", label: "Unknowns", shortLabel: "Unknowns" },
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

/** Get field status for each setup field */
function getFieldStatus(context?: ProjectContext, researchGoal?: string) {
	return SETUP_FIELDS.map((field) => {
		let isFilled = false
		switch (field.key) {
			case "research_goal":
				isFilled = !!(context?.research_goal || researchGoal)
				break
			case "target_roles":
				isFilled = !!(context?.target_roles && context.target_roles.length > 0)
				break
			case "target_orgs":
				isFilled = !!(context?.target_orgs && context.target_orgs.length > 0)
				break
			case "assumptions":
				isFilled = !!(context?.assumptions && context.assumptions.length > 0)
				break
			case "unknowns":
				isFilled = !!(context?.unknowns && context.unknowns.length > 0)
				break
		}
		return { ...field, isFilled }
	})
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
	const fieldStatus = getFieldStatus(projectContext, researchGoal)
	const filledCount = fieldStatus.filter((f) => f.isFilled).length
	const missingCount = fieldStatus.filter((f) => !f.isFilled).length

	return (
		<aside className={cn("mx-auto max-w-xs space-y-4", className)}>
			{/* Add Content Section */}
			<div className="space-y-2">
				<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Add Content</h3>
				<div className="flex gap-2">
					<Button asChild size="sm" className="flex-1">
						<Link to={`${projectPath}/interviews/upload`}>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Conversation
						</Link>
					</Button>
					<Button asChild variant="outline" size="sm" className="flex-1">
						<Link to={`${projectPath}/interviews/upload?type=note`}>
							<StickyNote className="mr-1.5 h-3.5 w-3.5" />
							Note
						</Link>
					</Button>
				</div>
			</div>

			{/* Quick Stats - With Labels */}
			<div className="space-y-2">
				<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Project Stats</h3>
				<div className="flex gap-2">
					<Link
						to={`${projectPath}/interviews`}
						className="flex flex-1 flex-col items-center gap-0.5 rounded-md border bg-card p-2.5 transition-colors hover:bg-muted/50"
					>
						<div className="flex items-center gap-1.5">
							<FileAudio className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="font-semibold text-foreground text-lg">{conversationCount}</span>
						</div>
						<span className="text-muted-foreground text-xs">Conversations</span>
					</Link>
					<Link
						to={`${projectPath}/lens-library`}
						className="flex flex-1 flex-col items-center gap-0.5 rounded-md border bg-card p-2.5 transition-colors hover:bg-muted/50"
					>
						<div className="flex items-center gap-1.5">
							<Glasses className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="font-semibold text-foreground text-lg">{activeLensCount}</span>
						</div>
						<span className="text-muted-foreground text-xs">Lenses</span>
					</Link>
				</div>
			</div>

			{/* Project Context - Collapsible */}
			<Card surface="muted">
				<Collapsible open={isOpen} onOpenChange={setIsOpen}>
					<CollapsibleTrigger asChild>
						<button
							type="button"
							className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/50"
						>
							<div className="min-w-0 flex-1">
								<div className="flex items-center justify-between">
									<span className="font-medium text-foreground text-sm">Project Context</span>
									<span className="text-muted-foreground text-xs">
										{missingCount > 0 ? `Missing ${missingCount}` : "Complete"}
									</span>
								</div>
								<Progress value={completionPercent} className="mt-1.5 h-1.5" />
							</div>
							<ChevronDown
								className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
							/>
						</button>
					</CollapsibleTrigger>

					<CollapsibleContent>
						<CardContent className="border-t px-3 pt-3 pb-3">
							{/* Field checklist */}
							<div className="space-y-1.5">
								{fieldStatus.map((field) => (
									<div key={field.key} className="flex items-center gap-2">
										<div
											className={cn(
												"flex h-4 w-4 items-center justify-center rounded-full",
												field.isFilled ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
											)}
										>
											{field.isFilled ? (
												<Check className="h-2.5 w-2.5" />
											) : (
												<span className="h-1.5 w-1.5 rounded-full bg-current" />
											)}
										</div>
										<span className={cn("text-sm", field.isFilled ? "text-foreground" : "text-muted-foreground")}>
											{field.label}
										</span>
									</div>
								))}
							</div>

							{/* Summary text */}
							<p className="mt-3 text-muted-foreground text-xs">
								{filledCount === SETUP_FIELDS.length
									? "All context provided!"
									: `${missingCount} field${missingCount !== 1 ? "s" : ""} can help improve AI analysis`}
							</p>

							<Button asChild variant="outline" size="sm" className="mt-3 w-full">
								<Link to={`${projectPath}/setup`}>
									{completionPercent < 100 ? "Add Helpful Context" : "Edit Context"}
								</Link>
							</Button>
						</CardContent>
					</CollapsibleContent>
				</Collapsible>
			</Card>
		</aside>
	)
}

export default ContextPanel
