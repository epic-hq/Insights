/**
 * OnboardingWalkthrough - New user onboarding modal
 *
 * Multi-step walkthrough that collects:
 * 1. Job function/role (aligned with JOB_FUNCTIONS constant)
 * 2. Primary use case for UpSight (including surveys)
 * 3. Company size (aligned with TARGET_COMPANY_SIZE_CATEGORIES)
 *
 * Data is stored in user_settings and organization, then fed to AI chat
 * for personalized recommendations. After completion, redirects to company
 * onboarding flow.
 */

import { motion, AnimatePresence } from "framer-motion"
import {
	ArrowLeft,
	ArrowRight,
	BarChart3,
	Briefcase,
	Building2,
	Check,
	ClipboardList,
	Code,
	Handshake,
	HeartHandshake,
	Megaphone,
	Microscope,
	PenTool,
	Rocket,
	Search,
	Sparkles,
	Target,
	TrendingUp,
	Users,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useFetcher, useNavigate } from "react-router"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { useCurrentProject } from "~/contexts/current-project-context"
import { TARGET_COMPANY_SIZE_CATEGORIES, JOB_FUNCTIONS as DB_JOB_FUNCTIONS } from "~/lib/constants/options"
import { cn } from "~/lib/utils"

/** Animation variants for staggered children */
const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.04,
			delayChildren: 0.1,
		},
	},
}

const itemVariants = {
	hidden: { opacity: 0, y: 8, scale: 0.96 },
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: {
			type: "spring",
			stiffness: 400,
			damping: 25,
		},
	},
}

export interface OnboardingData {
	jobFunction: string
	primaryUseCase: string
	companySize: string
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

// Icons for job functions
const JOB_FUNCTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	engineering: Code,
	product: Target,
	design: PenTool,
	marketing: Megaphone,
	sales: Handshake,
	"customer-success": HeartHandshake,
	operations: Building2,
	finance: BarChart3,
	hr: Users,
	legal: ClipboardList,
	data: BarChart3,
	research: Microscope,
	executive: Briefcase,
}

// Map DB job functions to onboarding-friendly display
const JOB_FUNCTIONS = DB_JOB_FUNCTIONS.map((job) => ({
	value: job.value,
	label: job.label,
	icon: JOB_FUNCTION_ICONS[job.value] || Briefcase,
}))

// Use cases with survey prominently featured
const USE_CASES = [
	{
		value: "surveys",
		label: "Surveys & Feedback",
		description: "Collect responses via shareable surveys and analyze feedback at scale",
		icon: ClipboardList,
		highlight: true, // Feature this one
	},
	{
		value: "customer_discovery",
		label: "Customer Discovery",
		description: "Understand customer needs and validate product ideas through interviews",
		icon: Search,
	},
	{
		value: "sales_intelligence",
		label: "Sales Intelligence",
		description: "Track conversations, extract insights, and improve deal outcomes",
		icon: TrendingUp,
	},
	{
		value: "user_research",
		label: "User Research",
		description: "Conduct interviews and synthesize findings into actionable insights",
		icon: Microscope,
	},
	{
		value: "customer_success",
		label: "Customer Success",
		description: "Monitor customer health, track feedback, and reduce churn",
		icon: HeartHandshake,
	},
	{
		value: "competitive_intel",
		label: "Competitive Intelligence",
		description: "Track market trends and what customers say about competitors",
		icon: Target,
	},
]

// Company sizes from the database constants
const COMPANY_SIZES = TARGET_COMPANY_SIZE_CATEGORIES.map((cat) => ({
	value: cat.value,
	label: cat.label,
	description: cat.description,
}))

interface StepProps {
	data: Partial<OnboardingData>
	onChange: (field: keyof OnboardingData, value: string) => void
}

function JobFunctionStep({ data, onChange }: StepProps) {
	return (
		<motion.div
			initial={{ opacity: 0, x: 20 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -20 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
			className="space-y-6"
		>
			<div className="space-y-2 text-center">
				<h3 className="font-semibold text-xl tracking-tight">What's your role?</h3>
				<p className="text-muted-foreground text-sm">
					This helps us tailor your experience
				</p>
			</div>

			<RadioGroup
				value={data.jobFunction || ""}
				onValueChange={(value) => onChange("jobFunction", value)}
				className="grid grid-cols-2 gap-3 sm:grid-cols-3"
			>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					animate="visible"
					className="contents"
				>
					{JOB_FUNCTIONS.map((job) => {
						const Icon = job.icon
						const isSelected = data.jobFunction === job.value
						return (
							<motion.div key={job.value} variants={itemVariants}>
								<Label
									htmlFor={`job-${job.value}`}
									className={cn(
										"group relative flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 p-4 text-center transition-all duration-200",
										"hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm",
										"focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
										isSelected
											? "border-primary bg-primary/10 shadow-md"
											: "border-border"
									)}
								>
									<RadioGroupItem
										value={job.value}
										id={`job-${job.value}`}
										className="sr-only"
									/>
									<div
										className={cn(
											"flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
											isSelected
												? "bg-primary text-primary-foreground shadow-sm"
												: "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary"
										)}
									>
										<Icon className="h-5 w-5" />
									</div>
									<span
										className={cn(
											"text-sm font-medium leading-tight transition-colors",
											isSelected && "text-primary"
										)}
									>
										{job.label}
									</span>
									{isSelected && (
										<motion.div
											initial={{ scale: 0, opacity: 0 }}
											animate={{ scale: 1, opacity: 1 }}
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 25,
											}}
											className="absolute -top-1.5 -right-1.5"
										>
											<div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
												<Check className="h-3 w-3" strokeWidth={3} />
											</div>
										</motion.div>
									)}
								</Label>
							</motion.div>
						)
					})}
				</motion.div>
			</RadioGroup>
		</motion.div>
	)
}

function UseCaseStep({ data, onChange }: StepProps) {
	return (
		<motion.div
			initial={{ opacity: 0, x: 20 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -20 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
			className="space-y-6"
		>
			<div className="space-y-2 text-center">
				<h3 className="font-semibold text-xl tracking-tight">What brings you to UpSight?</h3>
				<p className="text-muted-foreground text-sm">
					Select your primary use case
				</p>
			</div>

			<RadioGroup
				value={data.primaryUseCase || ""}
				onValueChange={(value) => onChange("primaryUseCase", value)}
				className="space-y-3"
			>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					animate="visible"
					className="contents"
				>
					{USE_CASES.map((useCase) => {
						const isSelected = data.primaryUseCase === useCase.value
						const Icon = useCase.icon
						return (
							<motion.div key={useCase.value} variants={itemVariants}>
								<Label
									htmlFor={`use-${useCase.value}`}
									className={cn(
										"group relative flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200",
										"hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm",
										"focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
										isSelected
											? "border-primary bg-primary/10 shadow-md"
											: useCase.highlight
												? "border-primary/30 bg-primary/5"
												: "border-border"
									)}
								>
									<RadioGroupItem
										value={useCase.value}
										id={`use-${useCase.value}`}
										className="sr-only"
									/>
									<div
										className={cn(
											"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
											isSelected
												? "bg-primary text-primary-foreground shadow-sm"
												: useCase.highlight
													? "bg-primary/20 text-primary"
													: "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary"
										)}
									>
										<Icon className="h-5 w-5" />
									</div>
									<div className="flex-1 min-w-0 space-y-1">
										<div className="flex items-center gap-2">
											<span
												className={cn(
													"font-medium text-sm transition-colors",
													isSelected && "text-primary"
												)}
											>
												{useCase.label}
											</span>
											{useCase.highlight && !isSelected && (
												<span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/20">
													Popular
												</span>
											)}
										</div>
										<p className="text-muted-foreground text-xs leading-relaxed">
											{useCase.description}
										</p>
									</div>
									{isSelected && (
										<motion.div
											initial={{ scale: 0, opacity: 0 }}
											animate={{ scale: 1, opacity: 1 }}
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 25,
											}}
											className="absolute top-3 right-3"
										>
											<div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
												<Check className="h-3 w-3" strokeWidth={3} />
											</div>
										</motion.div>
									)}
								</Label>
							</motion.div>
						)
					})}
				</motion.div>
			</RadioGroup>
		</motion.div>
	)
}

function CompanySizeStep({ data, onChange }: StepProps) {
	return (
		<motion.div
			initial={{ opacity: 0, x: 20 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -20 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
			className="space-y-6"
		>
			<div className="space-y-2 text-center">
				<h3 className="font-semibold text-xl tracking-tight">How big is your company?</h3>
				<p className="text-muted-foreground text-sm">
					This helps us recommend the right workflows
				</p>
			</div>

			<RadioGroup
				value={data.companySize || ""}
				onValueChange={(value) => onChange("companySize", value)}
				className="grid grid-cols-2 gap-4"
			>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					animate="visible"
					className="contents"
				>
					{COMPANY_SIZES.map((size) => {
						const isSelected = data.companySize === size.value
						return (
							<motion.div key={size.value} variants={itemVariants}>
								<Label
									htmlFor={`size-${size.value}`}
									className={cn(
										"group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all duration-200",
										"hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm",
										"focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
										isSelected
											? "border-primary bg-primary/10 shadow-md"
											: "border-border"
									)}
								>
									<RadioGroupItem
										value={size.value}
										id={`size-${size.value}`}
										className="sr-only"
									/>
									<span
										className={cn(
											"font-semibold text-base transition-colors",
											isSelected && "text-primary"
										)}
									>
										{size.label}
									</span>
									<span className="text-muted-foreground text-xs leading-relaxed">
										{size.description}
									</span>
									{isSelected && (
										<motion.div
											initial={{ scale: 0, opacity: 0 }}
											animate={{ scale: 1, opacity: 1 }}
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 25,
											}}
											className="absolute -top-1.5 -right-1.5"
										>
											<div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
												<Check className="h-3 w-3" strokeWidth={3} />
											</div>
										</motion.div>
									)}
								</Label>
							</motion.div>
						)
					})}
				</motion.div>
			</RadioGroup>
		</motion.div>
	)
}

/** Confetti particle with deterministic properties for smooth animation */
interface ConfettiParticleProps {
	delay: number
	x: number
	color: string
	size: number
	isCircle: boolean
	drift: number
	rotation: number
}

function ConfettiParticle({ delay, x, color, size, isCircle, drift, rotation }: ConfettiParticleProps) {
	return (
		<motion.div
			initial={{ y: -20, x, opacity: 1, rotate: 0, scale: 1 }}
			animate={{
				y: 400,
				x: x + drift,
				opacity: [1, 1, 0],
				rotate: rotation,
				scale: [1, 1, 0.5],
			}}
			transition={{
				duration: 2.5,
				delay,
				ease: [0.25, 0.46, 0.45, 0.94],
			}}
			className="pointer-events-none absolute top-0"
			style={{
				width: size,
				height: size,
				backgroundColor: color,
				borderRadius: isCircle ? "50%" : "2px",
			}}
		/>
	)
}

function ConfettiCelebration() {
	// Pre-compute particle properties for consistent rendering
	const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"]

	const particles = Array.from({ length: 60 }, (_, i) => ({
		id: i,
		delay: (i % 10) * 0.05,
		x: ((i % 12) - 6) * 35,
		color: colors[i % colors.length],
		size: 6 + (i % 4) * 3,
		isCircle: i % 3 !== 0,
		drift: ((i % 7) - 3) * 25,
		rotation: ((i % 8) - 4) * 180,
	}))

	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden">
			<div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2">
				{particles.map((p) => (
					<ConfettiParticle key={p.id} {...p} />
				))}
			</div>
		</div>
	)
}

function CompletionStep() {
	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.4, ease: "easeOut" }}
			className="flex flex-col items-center gap-6 py-8 text-center"
		>
			<motion.div
				initial={{ scale: 0, rotate: -180 }}
				animate={{ scale: 1, rotate: 0 }}
				transition={{
					type: "spring",
					stiffness: 200,
					damping: 15,
					delay: 0.15,
				}}
				className="relative"
			>
				{/* Glow effect behind icon */}
				<div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
				<div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary to-primary/70 shadow-lg shadow-primary/25">
					<Sparkles className="h-12 w-12 text-primary-foreground" />
				</div>
			</motion.div>
			<motion.div
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.35, duration: 0.4 }}
				className="space-y-3"
			>
				<h3 className="font-bold text-2xl tracking-tight">You're all set!</h3>
				<p className="mx-auto max-w-[280px] text-muted-foreground leading-relaxed">
					Let's set up your company profile to get personalized insights
				</p>
			</motion.div>
		</motion.div>
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
	const [showCompletion, setShowCompletion] = useState(false)
	const [showConfetti, setShowConfetti] = useState(false)
	const fetcher = useFetcher()
	const navigate = useNavigate()
	const { projectPath } = useCurrentProject()

	const steps = [
		{ component: JobFunctionStep, canProceed: Boolean(data.jobFunction) },
		{ component: UseCaseStep, canProceed: Boolean(data.primaryUseCase) },
		{ component: CompanySizeStep, canProceed: Boolean(data.companySize) },
	]

	const currentStep = steps[step]
	const isLastStep = step === steps.length - 1
	const isFirstStep = step === 0

	const handleChange = useCallback((field: keyof OnboardingData, value: string) => {
		setData((prev) => ({ ...prev, [field]: value }))
	}, [])

	const handleNext = useCallback(() => {
		if (isLastStep) {
			// Show completion animation
			setShowCompletion(true)
			setShowConfetti(true)

			// Complete onboarding data
			const completeData: OnboardingData = {
				jobFunction: data.jobFunction || "",
				primaryUseCase: data.primaryUseCase || "",
				companySize: data.companySize || "",
				completed: true,
			}

			// Save to server
			fetcher.submit(
				{ onboardingData: JSON.stringify(completeData) },
				{ method: "POST", action: "/api/user-settings/onboarding" }
			)

			onComplete?.(completeData)
		} else {
			setStep((prev) => prev + 1)
		}
	}, [step, isLastStep, data, fetcher, onComplete])

	const handleBack = useCallback(() => {
		setStep((prev) => Math.max(0, prev - 1))
	}, [])

	const handleContinueToCompany = useCallback(() => {
		onOpenChange(false)
		// Navigate to company/organization setup
		if (projectPath) {
			navigate(`${projectPath}/setup?onboarding=true`)
		}
	}, [onOpenChange, navigate, projectPath])

	// Clear confetti after animation
	useEffect(() => {
		if (showConfetti) {
			const timer = setTimeout(() => setShowConfetti(false), 3000)
			return () => clearTimeout(timer)
		}
	}, [showConfetti])

	const StepComponent = currentStep?.component

	return (
		<Dialog open={open} onOpenChange={showCompletion ? undefined : onOpenChange}>
			<DialogContent
				className="overflow-hidden sm:max-w-[460px]"
				showCloseButton={!showCompletion}
			>
				{showConfetti && <ConfettiCelebration />}

				<AnimatePresence mode="wait">
					{showCompletion ? (
						<motion.div key="completion">
							<DialogHeader className="sr-only">
								<DialogTitle>Welcome Complete</DialogTitle>
							</DialogHeader>
							<CompletionStep />
							<motion.div
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.5 }}
								className="flex justify-center pt-2 pb-2"
							>
								<Button
									onClick={handleContinueToCompany}
									size="lg"
									className="gap-2 px-6 shadow-md shadow-primary/20 transition-shadow hover:shadow-lg hover:shadow-primary/25"
								>
									<Rocket className="h-4 w-4" />
									Set up your company
									<ArrowRight className="h-4 w-4" />
								</Button>
							</motion.div>
						</motion.div>
					) : (
						<motion.div key="steps">
							<DialogHeader className="pb-4">
								<DialogTitle className="text-center text-xl">
									Welcome to UpSight
								</DialogTitle>
								<DialogDescription className="text-center">
									Quick setup to personalize your experience
								</DialogDescription>
							</DialogHeader>

							{/* Progress indicator with accessibility */}
							<div
								className="flex justify-center gap-2 pb-4"
								role="progressbar"
								aria-valuenow={step + 1}
								aria-valuemin={1}
								aria-valuemax={steps.length}
								aria-label={`Step ${step + 1} of ${steps.length}`}
							>
								{steps.map((_, index) => (
									<motion.div
										key={index}
										className={cn(
											"h-1.5 rounded-full transition-colors duration-300",
											index <= step ? "bg-primary" : "bg-muted"
										)}
										initial={{ width: 28 }}
										animate={{
											width: index === step ? 40 : 28,
										}}
										transition={{ duration: 0.3 }}
										aria-current={index === step ? "step" : undefined}
									/>
								))}
							</div>

							{/* Step content with better height handling */}
							<div className="min-h-[340px] sm:min-h-[320px]">
								<AnimatePresence mode="wait">
									<StepComponent key={step} data={data} onChange={handleChange} />
								</AnimatePresence>
							</div>

							{/* Footer with improved button states */}
							<div className="flex items-center justify-between gap-3 pt-4 border-t border-border/50">
								<Button
									variant="ghost"
									onClick={handleBack}
									disabled={isFirstStep}
									className={cn(
										"transition-opacity duration-200",
										isFirstStep && "pointer-events-none opacity-0"
									)}
								>
									<ArrowLeft className="mr-2 h-4 w-4" />
									Back
								</Button>
								<Button
									onClick={handleNext}
									disabled={!currentStep.canProceed}
									className={cn(
										"min-w-[120px] transition-all duration-200",
										currentStep.canProceed &&
											"shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25"
									)}
								>
									{isLastStep ? (
										<>
											Complete
											<Check className="ml-2 h-4 w-4" />
										</>
									) : (
										<>
											Continue
											<ArrowRight className="ml-2 h-4 w-4" />
										</>
									)}
								</Button>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</DialogContent>
		</Dialog>
	)
}

export default OnboardingWalkthrough
