/**
 * OnboardingWalkthrough - New user onboarding modal
 *
 * Multi-step walkthrough that collects:
 * 1. Job function/role
 * 2. Primary use case for UpSight
 * 3. Team size and goals
 *
 * Data is stored in user_settings and fed to AI chat for personalized recommendations.
 */

import { ArrowLeft, ArrowRight, Briefcase, Check, Lightbulb, Target, Users } from "lucide-react"
import { useCallback, useState } from "react"
import { useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"

export interface OnboardingData {
	jobFunction: string
	primaryUseCase: string
	teamSize: string
	goals: string
	completed: boolean
}

interface OnboardingWalkthroughProps {
	/** Whether the modal is open */
	open: boolean
	/** Callback when modal should close */
	onOpenChange: (open: boolean) => void
	/** Callback when onboarding is completed */
	onComplete?: (data: OnboardingData) => void
	/** Initial data if resuming */
	initialData?: Partial<OnboardingData>
}

const JOB_FUNCTIONS = [
	{ value: "founder", label: "Founder / CEO", icon: Briefcase },
	{ value: "product", label: "Product Manager", icon: Target },
	{ value: "sales", label: "Sales / Account Executive", icon: Users },
	{ value: "research", label: "UX Researcher", icon: Lightbulb },
	{ value: "marketing", label: "Marketing", icon: Target },
	{ value: "other", label: "Other", icon: Briefcase },
]

const USE_CASES = [
	{
		value: "customer_discovery",
		label: "Customer Discovery",
		description: "Understand customer needs and validate ideas",
	},
	{
		value: "sales_intelligence",
		label: "Sales Intelligence",
		description: "Track conversations and improve deal outcomes",
	},
	{
		value: "user_research",
		label: "User Research",
		description: "Conduct interviews and synthesize findings",
	},
	{
		value: "competitive_intel",
		label: "Competitive Intelligence",
		description: "Track market trends and competitor mentions",
	},
	{
		value: "customer_success",
		label: "Customer Success",
		description: "Understand customer health and feedback",
	},
]

const TEAM_SIZES = [
	{ value: "solo", label: "Just me" },
	{ value: "small", label: "2-5 people" },
	{ value: "medium", label: "6-20 people" },
	{ value: "large", label: "20+ people" },
]

interface StepProps {
	data: Partial<OnboardingData>
	onChange: (field: keyof OnboardingData, value: string) => void
}

function JobFunctionStep({ data, onChange }: StepProps) {
	return (
		<div className="space-y-4">
			<div className="text-center">
				<h3 className="font-semibold text-lg">What best describes your role?</h3>
				<p className="text-muted-foreground text-sm">This helps us personalize your experience</p>
			</div>

			<RadioGroup
				value={data.jobFunction || ""}
				onValueChange={(value) => onChange("jobFunction", value)}
				className="grid grid-cols-2 gap-3"
			>
				{JOB_FUNCTIONS.map((job) => (
					<Label
						key={job.value}
						htmlFor={job.value}
						className={cn(
							"flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors",
							"hover:bg-muted/50",
							data.jobFunction === job.value && "border-primary bg-primary/5"
						)}
					>
						<RadioGroupItem value={job.value} id={job.value} className="sr-only" />
						<job.icon className="h-5 w-5 text-muted-foreground" />
						<span className="font-medium text-sm">{job.label}</span>
						{data.jobFunction === job.value && <Check className="ml-auto h-4 w-4 text-primary" />}
					</Label>
				))}
			</RadioGroup>
		</div>
	)
}

function UseCaseStep({ data, onChange }: StepProps) {
	return (
		<div className="space-y-4">
			<div className="text-center">
				<h3 className="font-semibold text-lg">What do you want to accomplish?</h3>
				<p className="text-muted-foreground text-sm">Select your primary use case</p>
			</div>

			<RadioGroup
				value={data.primaryUseCase || ""}
				onValueChange={(value) => onChange("primaryUseCase", value)}
				className="space-y-3"
			>
				{USE_CASES.map((useCase) => (
					<Label
						key={useCase.value}
						htmlFor={useCase.value}
						className={cn(
							"flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors",
							"hover:bg-muted/50",
							data.primaryUseCase === useCase.value && "border-primary bg-primary/5"
						)}
					>
						<RadioGroupItem value={useCase.value} id={useCase.value} className="sr-only" />
						<div className="flex items-center justify-between">
							<span className="font-medium">{useCase.label}</span>
							{data.primaryUseCase === useCase.value && <Check className="h-4 w-4 text-primary" />}
						</div>
						<span className="text-muted-foreground text-sm">{useCase.description}</span>
					</Label>
				))}
			</RadioGroup>
		</div>
	)
}

function TeamAndGoalsStep({ data, onChange }: StepProps) {
	return (
		<div className="space-y-6">
			<div className="text-center">
				<h3 className="font-semibold text-lg">Tell us about your team</h3>
				<p className="text-muted-foreground text-sm">This helps us suggest the right features</p>
			</div>

			<div className="space-y-4">
				<div>
					<Label className="mb-2 block text-sm">Team size</Label>
					<RadioGroup
						value={data.teamSize || ""}
						onValueChange={(value) => onChange("teamSize", value)}
						className="grid grid-cols-2 gap-2"
					>
						{TEAM_SIZES.map((size) => (
							<Label
								key={size.value}
								htmlFor={`team-${size.value}`}
								className={cn(
									"flex cursor-pointer items-center justify-center rounded-lg border p-3 text-center transition-colors",
									"hover:bg-muted/50",
									data.teamSize === size.value && "border-primary bg-primary/5"
								)}
							>
								<RadioGroupItem value={size.value} id={`team-${size.value}`} className="sr-only" />
								<span className="font-medium text-sm">{size.label}</span>
							</Label>
						))}
					</RadioGroup>
				</div>

				<div>
					<Label htmlFor="goals" className="mb-2 block text-sm">
						What are you hoping to achieve? (optional)
					</Label>
					<Textarea
						id="goals"
						value={data.goals || ""}
						onChange={(e) => onChange("goals", e.target.value)}
						placeholder="e.g., Better understand our customers, improve sales win rates, validate a new product idea..."
						rows={3}
						className="resize-none"
					/>
				</div>
			</div>
		</div>
	)
}

export function OnboardingWalkthrough({
	open,
	onOpenChange,
	onComplete,
	initialData,
}: OnboardingWalkthroughProps) {
	const [step, setStep] = useState(0)
	const [data, setData] = useState<Partial<OnboardingData>>(initialData || {})
	const fetcher = useFetcher()

	const steps = [
		{ component: JobFunctionStep, canProceed: Boolean(data.jobFunction) },
		{ component: UseCaseStep, canProceed: Boolean(data.primaryUseCase) },
		{ component: TeamAndGoalsStep, canProceed: Boolean(data.teamSize) },
	]

	const currentStep = steps[step]
	const isLastStep = step === steps.length - 1
	const isFirstStep = step === 0

	const handleChange = useCallback((field: keyof OnboardingData, value: string) => {
		setData((prev) => ({ ...prev, [field]: value }))
	}, [])

	const handleNext = useCallback(() => {
		if (isLastStep) {
			// Complete onboarding
			const completeData: OnboardingData = {
				jobFunction: data.jobFunction || "",
				primaryUseCase: data.primaryUseCase || "",
				teamSize: data.teamSize || "",
				goals: data.goals || "",
				completed: true,
			}

			// Save to server
			fetcher.submit(
				{ onboardingData: JSON.stringify(completeData) },
				{ method: "POST", action: "/api/user-settings/onboarding" }
			)

			onComplete?.(completeData)
			onOpenChange(false)
		} else {
			setStep((prev) => prev + 1)
		}
	}, [step, isLastStep, data, fetcher, onComplete, onOpenChange])

	const handleBack = useCallback(() => {
		setStep((prev) => Math.max(0, prev - 1))
	}, [])

	const StepComponent = currentStep.component

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="text-center">Welcome to UpSight</DialogTitle>
					<DialogDescription className="text-center">
						Let's personalize your experience
					</DialogDescription>
				</DialogHeader>

				{/* Progress indicator */}
				<div className="flex justify-center gap-2 py-2">
					{steps.map((_, index) => (
						<div
							key={index}
							className={cn(
								"h-2 w-8 rounded-full transition-colors",
								index <= step ? "bg-primary" : "bg-muted"
							)}
						/>
					))}
				</div>

				{/* Step content */}
				<div className="py-4">
					<StepComponent data={data} onChange={handleChange} />
				</div>

				<DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
					<Button
						variant="ghost"
						onClick={handleBack}
						disabled={isFirstStep}
						className={cn(isFirstStep && "invisible")}
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back
					</Button>
					<Button onClick={handleNext} disabled={!currentStep.canProceed}>
						{isLastStep ? (
							<>
								Get Started
								<Check className="ml-2 h-4 w-4" />
							</>
						) : (
							<>
								Continue
								<ArrowRight className="ml-2 h-4 w-4" />
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default OnboardingWalkthrough
