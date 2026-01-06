/**
 * JourneySidebarGroup - Onboarding journey navigation in sidebar
 *
 * Simplified to show only Context and Prompts setup steps.
 * Collect/Learn removed - those are handled by main nav (Conversations/Insights).
 *
 * Design principles:
 * - Getting Started is for one-time setup only (context + prompts)
 * - Main nav handles ongoing activities (upload, view insights)
 * - Transforms to "Research Plan" link after completion for easy return
 * - Shows progress indicators with field names (not just abstract dots)
 */

import { CheckCircle2, FileText, Settings, Target } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export type JourneyPhase = "plan" | "collect" | "learn"
export type PlanSubStep = "context" | "prompts"

// Field status for progress tracking
export interface FieldStatus {
	key: string
	label: string
	filled: boolean
}

export interface JourneyProgress {
	contextComplete: boolean
	promptsComplete: boolean
	hasConversations: boolean
	hasInsights: boolean
	// Detailed field tracking for progress indicators
	contextFieldsFilled?: number
	contextFieldsTotal?: number
	contextFields?: FieldStatus[]
	promptsCount?: number
}

interface JourneySidebarGroupProps {
	basePath: string
	currentPhase: JourneyPhase
	planSubStep?: PlanSubStep
	progress: JourneyProgress
}

/**
 * Progress badge showing fraction with tooltip listing field names
 */
function ProgressBadge({ filled, total, fields }: { filled: number; total: number; fields?: FieldStatus[] }) {
	if (total === 0) return null

	const badge = (
		<span
			className={cn(
				"rounded px-1.5 py-0.5 font-medium text-xs",
				filled === total
					? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
					: filled > 0
						? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
						: "bg-muted text-muted-foreground"
			)}
		>
			{filled}/{total}
		</span>
	)

	// If we have field details, show them in a tooltip
	if (fields && fields.length > 0) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>{badge}</TooltipTrigger>
				<TooltipContent side="right" className="max-w-[200px]">
					<div className="space-y-1 text-xs">
						{fields.map((field) => (
							<div key={field.key} className="flex items-center gap-1.5">
								{field.filled ? (
									<CheckCircle2 className="h-3 w-3 text-green-500" />
								) : (
									<span className="h-3 w-3 rounded-full border border-muted-foreground/40" />
								)}
								<span className={cn(!field.filled && "text-muted-foreground")}>{field.label}</span>
							</div>
						))}
					</div>
				</TooltipContent>
			</Tooltip>
		)
	}

	return badge
}

export function JourneySidebarGroup({ basePath, progress }: JourneySidebarGroupProps) {
	const location = useLocation()
	const {
		contextComplete,
		promptsComplete,
		hasConversations,
		hasInsights,
		contextFieldsFilled = 0,
		contextFieldsTotal = 0,
		contextFields,
		promptsCount = 0,
	} = progress

	const planComplete = contextComplete && promptsComplete
	const allComplete = planComplete && hasConversations && hasInsights

	// Check if current path matches
	const isContextActive = location.pathname.endsWith("/setup")
	const isPromptsActive = location.pathname.endsWith("/questions")

	// After full onboarding complete, show collapsed "Research Plan" link
	if (allComplete) {
		return (
			<SidebarGroup>
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								asChild
								isActive={isContextActive || isPromptsActive}
								tooltip="View or edit your research context and prompts"
							>
								<Link to={`${basePath}/setup`}>
									<Target className="h-4 w-4" />
									<span>Research Plan</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		)
	}

	// During onboarding: show Getting Started with Context and Prompts
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Getting Started</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{/* Context step */}
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							isActive={isContextActive}
							className={cn(contextComplete && "text-green-600 dark:text-green-400")}
							tooltip={
								contextComplete
									? "Context complete - click to review"
									: contextFieldsTotal > 0
										? `${contextFieldsFilled}/${contextFieldsTotal} fields filled`
										: "Set up your research context"
							}
						>
							<Link to={`${basePath}/setup`}>
								{contextComplete ? (
									<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
								) : (
									<Settings className="h-4 w-4" />
								)}
								<span>Context</span>
							</Link>
						</SidebarMenuButton>
						{/* Show progress badge with field names if not complete */}
						{!contextComplete && contextFieldsTotal > 0 && (
							<SidebarMenuBadge>
								<ProgressBadge filled={contextFieldsFilled} total={contextFieldsTotal} fields={contextFields} />
							</SidebarMenuBadge>
						)}
					</SidebarMenuItem>

					{/* Prompts step */}
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							isActive={isPromptsActive}
							className={cn(promptsComplete && "text-green-600 dark:text-green-400")}
							tooltip={
								promptsComplete ? `${promptsCount} prompts generated - click to review` : "Generate interview prompts"
							}
						>
							<Link to={`${basePath}/questions`}>
								{promptsComplete ? (
									<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
								) : (
									<FileText className="h-4 w-4" />
								)}
								<span>Prompts</span>
							</Link>
						</SidebarMenuButton>
						{/* Show count badge if prompts exist */}
						{promptsComplete && promptsCount > 0 && <SidebarMenuBadge>{promptsCount}</SidebarMenuBadge>}
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}
