import { Check } from "lucide-react"
import { cn } from "~/lib/utils"

export interface OnboardingStep {
	id: string
	title: string
	description?: string
}

interface OnboardingStepperProps {
	steps: OnboardingStep[]
	currentStepId: string
	className?: string
}

export function OnboardingStepper({ steps, currentStepId, className }: OnboardingStepperProps) {
	const currentIndex = steps.findIndex(step => step.id === currentStepId)

	return (
		<div className={cn("w-full", className)}>
			<nav aria-label="Progress">
				<ol className="flex items-center justify-center space-x-8">
					{steps.map((step, index) => {
						const isCompleted = index < currentIndex
						const isCurrent = index === currentIndex
						const isUpcoming = index > currentIndex

						return (
							<li key={step.id} className="flex items-center">
								<div className="flex flex-col items-center">
									<div
										className={cn(
											"flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium",
											{
												"border-primary bg-primary text-primary-foreground": isCompleted,
												"border-primary bg-background text-primary": isCurrent,
												"border-muted-foreground bg-background text-muted-foreground": isUpcoming,
											}
										)}
									>
										{isCompleted ? (
											<Check className="h-5 w-5" />
										) : (
											<span>{index + 1}</span>
										)}
									</div>
									<div className="mt-2 text-center">
										<div
											className={cn("text-sm font-medium", {
												"text-primary": isCompleted || isCurrent,
												"text-muted-foreground": isUpcoming,
											})}
										>
											{step.title}
										</div>
										{step.description && (
											<div className="text-xs text-muted-foreground max-w-24">
												{step.description}
											</div>
										)}
									</div>
								</div>
								{index < steps.length - 1 && (
									<div
										className={cn(
											"ml-8 h-0.5 w-16",
											{
												"bg-primary": index < currentIndex,
												"bg-muted-foreground": index >= currentIndex,
											}
										)}
									/>
								)}
							</li>
						)
					})}
				</ol>
			</nav>
		</div>
	)
}
