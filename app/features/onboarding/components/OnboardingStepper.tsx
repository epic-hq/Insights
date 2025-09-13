import { Check } from "lucide-react"
import { Link } from "react-router"
import { cn } from "~/lib/utils"

export interface OnboardingStep {
	id: string
	title: string
	description?: string
	href?: string
}

interface OnboardingStepperProps {
	steps: OnboardingStep[]
	currentStepId: string
	className?: string
	onStepClick?: (stepId: string) => void
}

export function OnboardingStepper({ steps, currentStepId, className, onStepClick }: OnboardingStepperProps) {
	const currentIndex = steps.findIndex((step) => step.id === currentStepId)
	const showDescription = false

	return (
		<div className={cn("w-full", className)}>
			<nav aria-label="Progress">
				<ol className="flex items-center justify-center space-x-4 md:space-x-8">
					{steps.map((step, index) => {
						const isCompleted = index < currentIndex
						const isCurrent = index === currentIndex
						const isUpcoming = index > currentIndex

						const handleStepClick = () => {
							if (step.href) {
								return // Link will handle navigation
							}
							if (onStepClick) {
								onStepClick(step.id)
							}
						}

						const stepContent = (
							<>
								<div
									className={cn(
										"flex h-10 w-10 items-center justify-center rounded-full border-2 font-medium text-sm transition-colors",
										{
											"border-primary bg-primary text-primary-foreground": isCompleted,
											"border-primary bg-background text-primary": isCurrent,
											"border-muted-foreground bg-background text-muted-foreground hover:border-primary hover:text-primary": isUpcoming,
										}
									)}
								>
									{isCompleted ? <Check className="h-5 w-5" /> : <span>{index + 1}</span>}
								</div>
								<div className="mt-2 text-center">
									<div
										className={cn("font-medium text-sm transition-colors", {
											"text-primary": isCompleted || isCurrent,
											"text-muted-foreground hover:text-primary": isUpcoming,
										})}
									>
										{step.title}
									</div>
									{showDescription && step.description && (
										<div className="max-w-24 text-muted-foreground text-xs">{step.description}</div>
									)}
								</div>
							</>
						)

						return (
							<li key={step.id} className="flex items-center">
								{step.href ? (
									<Link to={step.href} className="flex cursor-pointer flex-col items-center">
										{stepContent}
									</Link>
								) : onStepClick ? (
									<button
										type="button"
										onClick={handleStepClick}
										className="flex cursor-pointer flex-col items-center border-none bg-transparent p-0"
									>
										{stepContent}
									</button>
								) : (
									<div className="flex flex-col items-center">
										{stepContent}
									</div>
								)}
								{index < steps.length - 1 && (
									<div
										className={cn("ml-4 h-0.5 w-8 hidden md:ml-8 md:block md:w-16", {
											"bg-primary": index < currentIndex,
											"bg-muted-foreground": index >= currentIndex,
										})}
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
