/**
 * JourneyPhaseBar - Horizontal navigation for the onboarding journey
 *
 * Design: Plan → Collect → Learn as horizontal phases
 * When in Plan phase, Context and Prompts appear as nested steps within Plan
 *
 * Visual hierarchy:
 * - Plan contains Context and Prompts as nested sub-steps
 * - A connecting bracket/container shows containment relationship
 * - Collect and Learn remain as peer phases to Plan
 */

import { CheckCircle2, ChevronRight, FileText, Lightbulb, MessageSquareText, Settings, Target } from "lucide-react"
import { Link } from "react-router"
import { cn } from "~/lib/utils"

export type JourneyPhase = "plan" | "collect" | "learn"
export type PlanSubStep = "context" | "prompts"

interface JourneyPhaseBarProps {
	/** Current phase in the journey */
	currentPhase: JourneyPhase
	/** Base path for navigation (e.g., /a/accountId/projectId) */
	basePath: string
	/** Whether plan phase is complete (context + prompts done) */
	planComplete?: boolean
	/** Whether collect phase is complete */
	collectComplete?: boolean
	/** Current sub-step within Plan phase */
	planSubStep?: PlanSubStep
	/** Whether context sub-step is complete */
	contextComplete?: boolean
	/** Whether prompts sub-step is complete */
	promptsComplete?: boolean
	/** @deprecated Use promptsComplete instead */
	questionsComplete?: boolean
	/** Additional CSS classes */
	className?: string
}

const PHASES = [
	{
		key: "plan" as const,
		label: "Plan",
		icon: Target,
		path: "/setup",
	},
	{
		key: "collect" as const,
		label: "Collect",
		icon: MessageSquareText,
		path: "/interviews/upload",
	},
	{
		key: "learn" as const,
		label: "Learn",
		icon: Lightbulb,
		path: "/insights",
	},
]

const PLAN_SUB_STEPS = [
	{
		key: "context" as const,
		label: "Context",
		icon: Settings,
		path: "/setup",
	},
	{
		key: "prompts" as const,
		label: "Prompts",
		icon: FileText,
		path: "/questions",
	},
]

function getPhaseStatus(
	phaseKey: JourneyPhase,
	currentPhase: JourneyPhase,
	planComplete: boolean,
	collectComplete: boolean
): "complete" | "current" | "upcoming" {
	const phaseOrder = { plan: 0, collect: 1, learn: 2 }
	const currentIndex = phaseOrder[currentPhase]
	const phaseIndex = phaseOrder[phaseKey]

	if (phaseKey === "plan" && planComplete) return "complete"
	if (phaseKey === "collect" && collectComplete) return "complete"
	if (phaseKey === currentPhase) return "current"
	if (phaseIndex < currentIndex) return "complete"
	return "upcoming"
}

function getSubStepStatus(
	subStepKey: PlanSubStep,
	currentSubStep: PlanSubStep | undefined,
	contextComplete: boolean,
	promptsComplete: boolean
): "complete" | "current" | "upcoming" {
	if (subStepKey === "context" && contextComplete) return "complete"
	if (subStepKey === "prompts" && promptsComplete) return "complete"
	if (subStepKey === currentSubStep) return "current"
	if (subStepKey === "context" && currentSubStep === "prompts") return "complete"
	return "upcoming"
}

export function JourneyPhaseBar({
	currentPhase,
	basePath,
	planComplete = false,
	collectComplete = false,
	planSubStep,
	contextComplete = false,
	promptsComplete,
	questionsComplete, // deprecated alias
	className,
}: JourneyPhaseBarProps) {
	// Support both promptsComplete and deprecated questionsComplete
	const isPromptsComplete = promptsComplete ?? questionsComplete ?? false
	const showPlanSubSteps = currentPhase === "plan" && !planComplete

	// Render a phase icon with status styling
	const renderPhaseIcon = (
		Icon: React.ElementType,
		status: "complete" | "current" | "upcoming",
		size: "sm" | "md" = "md"
	) => {
		const sizeClasses = size === "sm" ? "h-5 w-5" : "h-6 w-6"
		const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
		return (
			<div
				className={cn(
					"flex items-center justify-center rounded-full transition-colors",
					sizeClasses,
					status === "complete" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
					status === "current" && "bg-primary text-primary-foreground",
					status === "upcoming" && "bg-muted text-muted-foreground"
				)}
			>
				{status === "complete" ? <CheckCircle2 className={iconSize} /> : <Icon className={iconSize} />}
			</div>
		)
	}

	// Helper to render a phase
	const renderPhase = (phase: (typeof PHASES)[number], status: "complete" | "current" | "upcoming") => {
		const PhaseIcon = phase.icon
		const content = (
			<div
				className={cn(
					"flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors",
					status === "current" && "bg-primary/10 text-primary",
					status !== "current" && "hover:bg-muted/50"
				)}
			>
				{renderPhaseIcon(PhaseIcon, status)}
				<span
					className={cn(
						"font-medium text-sm",
						status === "current" && "text-primary",
						status === "complete" && "text-green-700 dark:text-green-400",
						status === "upcoming" && "text-muted-foreground"
					)}
				>
					{phase.label}
				</span>
			</div>
		)

		return status !== "current" ? <Link to={`${basePath}${phase.path}`}>{content}</Link> : content
	}

	return (
		<div className={cn("py-2", className)}>
			{/* Main phases row */}
			<div className="flex items-center justify-center gap-1">
				{PHASES.map((phase, index) => {
					const status = getPhaseStatus(phase.key, currentPhase, planComplete, collectComplete)

					// Plan phase with sub-steps shown below it
					if (phase.key === "plan" && showPlanSubSteps) {
						return (
							<div key={phase.key} className="flex flex-col">
								<div className="flex items-center">{renderPhase(phase, status)}</div>
								{/* Sub-steps directly under Plan */}
								<div className="mt-0.5 flex items-center gap-0.5 pl-1">
									{PLAN_SUB_STEPS.map((subStep, subIndex) => {
										const subStatus = getSubStepStatus(subStep.key, planSubStep, contextComplete, isPromptsComplete)

										const subContent = (
											<span
												className={cn(
													"rounded px-1.5 py-0.5 text-xs transition-all",
													subStatus === "current" && "font-medium text-foreground",
													subStatus === "complete" && "text-green-700 dark:text-green-400",
													subStatus === "upcoming" && "text-muted-foreground hover:text-foreground"
												)}
											>
												{subStep.label}
											</span>
										)

										return (
											<div key={subStep.key} className="flex items-center">
												{subIndex > 0 && <span className="mx-0.5 text-muted-foreground/40 text-xs">/</span>}
												{subStatus !== "current" ? (
													<Link
														to={`${basePath}${subStep.path}`}
														className="rounded transition-colors hover:bg-muted/50"
													>
														{subContent}
													</Link>
												) : (
													subContent
												)}
											</div>
										)
									})}
								</div>
							</div>
						)
					}

					return (
						<div key={phase.key} className="flex items-center">
							{index > 0 && <ChevronRight className="mx-1 h-4 w-4 text-muted-foreground/40" />}
							{renderPhase(phase, status)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
