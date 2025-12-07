/**
 * FeatureTour - Swipeable onboarding tour
 *
 * 4-screen feature tour introducing the app's key capabilities.
 * Uses touch gestures for navigation on mobile.
 */

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, FileAudio, Glasses, Mic, Sparkles } from "lucide-react"
import { useNavigate } from "react-router"
import { Logo } from "~/components/branding"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

interface TourSlide {
	id: string
	icon: React.ReactNode
	title: string
	description: string
	gradient: string
}

const tourSlides: TourSlide[] = [
	{
		id: "welcome",
		icon: (
			<div className="scale-[2]">
				<Logo />
			</div>
		),
		title: "Turn conversations into insights",
		description: "AI-powered analysis of your research conversations",
		gradient: "from-primary/20 to-accent/20",
	},
	{
		id: "upload",
		icon: (
			<div className="flex items-center gap-3">
				<FileAudio className="h-10 w-10 text-primary" />
				<Mic className="h-8 w-8 text-primary/70" />
			</div>
		),
		title: "Upload anything",
		description: "Recordings, notes, voice memos — we handle it all",
		gradient: "from-blue-500/20 to-cyan-500/20",
	},
	{
		id: "ai",
		icon: <Sparkles className="h-14 w-14 text-primary" />,
		title: "AI assistant",
		description: "Ask questions, get instant answers about your research",
		gradient: "from-purple-500/20 to-pink-500/20",
	},
	{
		id: "lenses",
		icon: <Glasses className="h-14 w-14 text-primary" />,
		title: "Automatic analysis",
		description: "Sales, Research & Product frameworks built in",
		gradient: "from-green-500/20 to-emerald-500/20",
	},
]

interface FeatureTourProps {
	/** Callback when tour is completed */
	onComplete: () => void
	/** Callback when user skips the tour */
	onSkip?: () => void
	/** Whether to show skip button */
	showSkip?: boolean
	/** Additional CSS classes */
	className?: string
}

export function FeatureTour({
	onComplete,
	onSkip,
	showSkip = true,
	className,
}: FeatureTourProps) {
	const [currentIndex, setCurrentIndex] = useState(0)
	const [direction, setDirection] = useState(0)

	const isLastSlide = currentIndex === tourSlides.length - 1
	const isFirstSlide = currentIndex === 0

	const goToNext = useCallback(() => {
		if (isLastSlide) {
			onComplete()
		} else {
			setDirection(1)
			setCurrentIndex((prev) => prev + 1)
		}
	}, [isLastSlide, onComplete])

	const goToPrevious = useCallback(() => {
		if (!isFirstSlide) {
			setDirection(-1)
			setCurrentIndex((prev) => prev - 1)
		}
	}, [isFirstSlide])

	const handleSkip = useCallback(() => {
		onSkip?.()
		onComplete()
	}, [onSkip, onComplete])

	const currentSlide = tourSlides[currentIndex]

	const slideVariants = {
		enter: (direction: number) => ({
			x: direction > 0 ? 300 : -300,
			opacity: 0,
		}),
		center: {
			x: 0,
			opacity: 1,
		},
		exit: (direction: number) => ({
			x: direction > 0 ? -300 : 300,
			opacity: 0,
		}),
	}

	return (
		<div
			className={cn(
				"flex min-h-screen flex-col bg-background",
				className
			)}
		>
			{/* Skip button */}
			{showSkip && !isLastSlide && (
				<div className="absolute top-4 right-4 z-10">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleSkip}
						className="text-muted-foreground"
					>
						Skip
					</Button>
				</div>
			)}

			{/* Main content area */}
			<div className="flex flex-1 flex-col items-center justify-center px-6">
				<AnimatePresence mode="wait" custom={direction}>
					<motion.div
						key={currentSlide.id}
						custom={direction}
						variants={slideVariants}
						initial="enter"
						animate="center"
						exit="exit"
						transition={{ duration: 0.3, ease: "easeInOut" }}
						className="flex flex-col items-center text-center"
					>
						{/* Gradient background */}
						<div
							className={cn(
								"absolute inset-0 -z-10 bg-gradient-to-br opacity-50",
								currentSlide.gradient
							)}
						/>

						{/* Icon */}
						<div className="mb-8 rounded-2xl bg-background/80 p-6 shadow-lg backdrop-blur-sm">
							{currentSlide.icon}
						</div>

						{/* Text */}
						<h1 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
							{currentSlide.title}
						</h1>
						<p className="max-w-sm text-muted-foreground text-lg">
							{currentSlide.description}
						</p>
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Bottom navigation */}
			<div className="px-6 pb-8 pt-4">
				{/* Progress dots */}
				<div className="mb-6 flex items-center justify-center gap-2">
					{tourSlides.map((slide, index) => (
						<button
							key={slide.id}
							type="button"
							onClick={() => {
								setDirection(index > currentIndex ? 1 : -1)
								setCurrentIndex(index)
							}}
							className={cn(
								"h-2 rounded-full transition-all",
								index === currentIndex
									? "w-6 bg-primary"
									: "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
							)}
							aria-label={`Go to slide ${index + 1}`}
						/>
					))}
				</div>

				{/* Navigation buttons */}
				<div className="flex items-center justify-between gap-4">
					<Button
						variant="ghost"
						size="lg"
						onClick={goToPrevious}
						disabled={isFirstSlide}
						className={cn(
							"min-w-[100px]",
							isFirstSlide && "invisible"
						)}
					>
						<ChevronLeft className="mr-1 h-4 w-4" />
						Back
					</Button>

					<Button
						size="lg"
						onClick={goToNext}
						className="min-w-[140px]"
					>
						{isLastSlide ? (
							"Get Started"
						) : (
							<>
								Next
								<ChevronRight className="ml-1 h-4 w-4" />
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	)
}

/**
 * Standalone splash screen for initial app load
 */
export function SplashScreen({
	onContinue,
	showLogin = true,
	loginHref = "/login",
}: {
	onContinue: () => void
	showLogin?: boolean
	loginHref?: string
}) {
	const navigate = useNavigate()

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 px-6">
			{/* Logo */}
			<div className="mb-8 scale-[2.5]">
				<Logo />
			</div>

			{/* Tagline */}
			<h1 className="mb-2 text-center text-3xl font-bold text-foreground">
				Insights
			</h1>
			<p className="mb-12 text-center text-lg text-muted-foreground">
				Turn conversations into insights
			</p>

			{/* CTA */}
			<Button size="lg" onClick={onContinue} className="mb-4 min-w-[200px]">
				Get Started
			</Button>

			{/* Login link */}
			{showLogin && (
				<button
					type="button"
					onClick={() => navigate(loginHref)}
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					Already have an account? Sign in
				</button>
			)}
		</div>
	)
}

export default FeatureTour
