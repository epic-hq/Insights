import { Brain, ChevronLeft, ChevronRight, Lightbulb, Pause, Play, Shield, TrendingUp, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"
import { useInterviewProgress } from "~/hooks/useInterviewProgress"

interface EducationalCard {
	id: string
	title: string
	subtitle: string
	content: string
	icon: typeof Brain
	color: string
}

interface ProcessingScreenProps {
	fileName: string
	onComplete: () => void
	interviewId?: string
}

const educationalCards: EducationalCard[] = [
	{
		id: "analysis",
		title: "How AI analyzes your interviews",
		subtitle: "Understanding the process",
		content:
			"Our AI transcribes your audio, identifies key themes, extracts insights about user needs, and maps them to your research questions. This typically takes 2-5 minutes depending on file length.",
		icon: Brain,
		color: "bg-blue-600",
	},
	{
		id: "tips",
		title: "Getting the most from your insights",
		subtitle: "Best practices",
		content:
			"For best results, ensure clear audio quality and encourage participants to speak naturally. Interviews with 3+ concrete examples or stories typically yield the richest insights.",
		icon: Lightbulb,
		color: "bg-yellow-600",
	},
	{
		id: "privacy",
		title: "Your data is secure",
		subtitle: "Privacy & security",
		content:
			"All audio files are encrypted in transit and at rest. We process your data securely and never share personal information. You can delete your data anytime from your account settings.",
		icon: Shield,
		color: "bg-green-600",
	},
	{
		id: "features",
		title: "Explore powerful features",
		subtitle: "What's coming next",
		content:
			"Once processing is complete, you'll see persona insights, journey mapping, pain point analysis, and opportunity recommendations. You can also share findings with your team.",
		icon: Zap,
		color: "bg-purple-600",
	},
	{
		id: "value",
		title: "Unlock deeper insights",
		subtitle: "Add more interviews",
		content:
			"Projects with 3+ interviews reveal 40% more insights and patterns. Each additional interview helps us identify stronger themes and more accurate persona profiles.",
		icon: TrendingUp,
		color: "bg-red-600",
	},
]

export default function ProcessingScreen({ fileName, onComplete, interviewId }: ProcessingScreenProps) {
	const [currentCardIndex, setCurrentCardIndex] = useState(0)
	const [isPlaying, setIsPlaying] = useState(true)

	// Use the realtime hook for actual progress tracking
	const { progressInfo } = useInterviewProgress(interviewId || null)
	const { progress, label: processingStage, isComplete } = progressInfo

	// Auto-complete when processing is done
	useEffect(() => {
		if (isComplete) {
			setTimeout(onComplete, 1000) // Small delay before completion
		}
	}, [isComplete, onComplete])

	// Auto-advance cards
	useEffect(() => {
		if (!isPlaying) return

		const interval = setInterval(() => {
			setCurrentCardIndex((prev) => (prev + 1) % educationalCards.length)
		}, 5000) // 5 seconds per card

		return () => clearInterval(interval)
	}, [isPlaying])

	const currentCard = educationalCards[currentCardIndex]
	const IconComponent = currentCard.icon

	const goToCard = (index: number) => {
		setCurrentCardIndex(index)
	}

	const nextCard = () => {
		setCurrentCardIndex((prev) => (prev + 1) % educationalCards.length)
	}

	const prevCard = () => {
		setCurrentCardIndex((prev) => (prev - 1 + educationalCards.length) % educationalCards.length)
	}

	return (
		<div className="relative min-h-screen bg-black text-white">
			{/* Header */}
			<div className="border-gray-800 border-b bg-black p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
							<div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
						</div>
						<h1 className="font-semibold text-lg text-white">Processing your interview</h1>
					</div>
					<div className="text-gray-400 text-sm">{Math.round(progress)}%</div>
				</div>
			</div>

			{/* Progress Section */}
			<div className="border-gray-800 border-b bg-gray-900 p-4">
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="font-medium text-sm text-white">{fileName}</h2>
							<p className="text-gray-400 text-xs">{processingStage}</p>
						</div>
					</div>
					<Progress value={progress} className="h-2 bg-gray-700" />
				</div>
			</div>

			{/* Educational Card */}
			<div className="p-4">
				<div className={`rounded-lg ${currentCard.color} p-6 text-white`}>
					<div className="mb-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20">
								<IconComponent className="h-5 w-5" />
							</div>
							<div>
								<h3 className="font-semibold text-lg">{currentCard.title}</h3>
								<p className="text-sm opacity-80">{currentCard.subtitle}</p>
							</div>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setIsPlaying(!isPlaying)}
							className="h-8 w-8 text-white hover:bg-black/20"
						>
							{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
						</Button>
					</div>

					<p className="mb-6 text-sm leading-relaxed opacity-90">{currentCard.content}</p>

					{/* Card Navigation */}
					<div className="flex items-center justify-between">
						<div className="flex gap-2">
							{educationalCards.map((card, index) => (
								<button
									key={card.id}
									onClick={() => goToCard(index)}
									className={`h-2 w-8 rounded-full transition-all ${
										index === currentCardIndex ? "bg-white" : "bg-white/30"
									}`}
								/>
							))}
						</div>

						<div className="flex gap-1">
							<Button variant="ghost" size="icon" onClick={prevCard} className="h-8 w-8 text-white hover:bg-black/20">
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<Button variant="ghost" size="icon" onClick={nextCard} className="h-8 w-8 text-white hover:bg-black/20">
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>

				{/* Processing Info */}
				<div className="mt-6 rounded-lg bg-gray-900 p-4">
					<div className="flex items-start gap-3">
						<div className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
						<div>
							<p className="font-medium text-sm text-white">What happens next?</p>
							<p className="text-gray-300 text-xs leading-relaxed">
								Once processing is complete, you'll see your project dashboard with insights, personas, and key themes.
								You can then add more interviews to unlock deeper patterns.
							</p>
						</div>
					</div>
				</div>

				{/* Estimated Time */}
				<div className="mt-4 text-center">
					<p className="text-gray-400 text-xs">
						Estimated time remaining: {Math.max(1, Math.ceil((100 - progress) / 20))} minutes
					</p>
				</div>
			</div>
		</div>
	)
}
