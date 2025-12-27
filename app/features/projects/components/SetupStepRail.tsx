/**
 * Vertical step rail for project setup navigation
 *
 * Shows the 5-step journey with visual indicators for completion status.
 * Clicking a step navigates to that section.
 */

import { Check, Compass, Inbox, Lightbulb, ListChecks, Sparkles } from "lucide-react"
import { cn } from "~/lib/utils"
import { useProjectSetup } from "../contexts/project-setup-context"
import type { SetupStep } from "../stores/project-setup-store"

interface Step {
	id: SetupStep
	label: string
	description: string
	icon: React.ComponentType<{ className?: string }>
}

const STEPS: Step[] = [
	{
		id: "define",
		label: "Define",
		description: "What to learn",
		icon: Compass,
	},
	{
		id: "design",
		label: "Design",
		description: "How to learn it",
		icon: ListChecks,
	},
	{
		id: "collect",
		label: "Collect",
		description: "Gather responses",
		icon: Inbox,
	},
	{
		id: "synthesize",
		label: "Synthesize",
		description: "Make sense of it",
		icon: Sparkles,
	},
	{
		id: "prioritize",
		label: "Prioritize",
		description: "Decide what matters",
		icon: Lightbulb,
	},
]

type StepStatus = "complete" | "current" | "upcoming"

interface SetupStepRailProps {
	className?: string
}

export function SetupStepRail({ className }: SetupStepRailProps) {
	const { currentStep, completedSteps, setCurrentStep } = useProjectSetup()

	const getStepStatus = (stepId: SetupStep): StepStatus => {
		if (completedSteps.includes(stepId)) return "complete"
		if (stepId === currentStep) return "current"
		return "upcoming"
	}

	return (
		<nav
			className={cn("w-56 flex-shrink-0 border-border border-r bg-muted/30 p-4", className)}
			aria-label="Setup progress"
		>
			<div className="mb-4">
				<h2 className="font-semibold text-foreground text-sm">Setup Progress</h2>
				<p className="text-muted-foreground text-xs">Complete each step to set up your project</p>
			</div>

			<div className="space-y-1">
				{STEPS.map((step, index) => {
					const status = getStepStatus(step.id)
					const Icon = step.icon

					return (
						<button
							key={step.id}
							onClick={() => setCurrentStep(step.id)}
							className={cn(
								"group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
								status === "current" && "bg-primary/10",
								status === "upcoming" && "opacity-60",
								"hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
							)}
							aria-current={status === "current" ? "step" : undefined}
						>
							{/* Step indicator circle */}
							<div
								className={cn(
									"mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-medium text-xs transition-colors",
									status === "complete" && "bg-primary/20 text-primary",
									status === "current" && "bg-primary text-primary-foreground ring-2 ring-primary/30",
									status === "upcoming" && "bg-muted text-muted-foreground"
								)}
							>
								{status === "complete" ? <Check className="h-3.5 w-3.5" /> : index + 1}
							</div>

							{/* Step content */}
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<Icon
										className={cn(
											"h-4 w-4",
											status === "current" && "text-primary",
											status !== "current" && "text-muted-foreground"
										)}
									/>
									<span
										className={cn(
											"font-medium text-sm",
											status === "current" && "text-foreground",
											status !== "current" && "text-muted-foreground"
										)}
									>
										{step.label}
									</span>
								</div>
								<p className="mt-0.5 truncate text-muted-foreground text-xs">{step.description}</p>
							</div>
						</button>
					)
				})}
			</div>
		</nav>
	)
}

/**
 * Horizontal step indicator for mobile/compact layouts
 */
export function SetupStepIndicatorCompact({ className }: { className?: string }) {
	const { currentStep, completedSteps } = useProjectSetup()

	const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

	return (
		<div className={cn("flex items-center justify-center gap-2", className)}>
			{STEPS.map((step, index) => {
				const isComplete = completedSteps.includes(step.id)
				const isCurrent = step.id === currentStep

				return (
					<div key={step.id} className="flex items-center gap-2">
						{/* Dot indicator */}
						<div
							className={cn(
								"h-2 w-2 rounded-full transition-colors",
								isComplete && "bg-primary",
								isCurrent && "bg-primary ring-2 ring-primary/30",
								!isComplete && !isCurrent && "bg-muted-foreground/30"
							)}
							aria-label={`Step ${index + 1}: ${step.label}${isComplete ? " (complete)" : isCurrent ? " (current)" : ""}`}
						/>

						{/* Connector line */}
						{index < STEPS.length - 1 && (
							<div
								className={cn(
									"h-px w-6 transition-colors",
									index < currentIndex ? "bg-primary" : "bg-muted-foreground/30"
								)}
							/>
						)}
					</div>
				)
			})}
		</div>
	)
}
