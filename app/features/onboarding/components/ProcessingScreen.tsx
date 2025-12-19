import consola from "consola"
import { Brain, Lightbulb, Shield, TrendingUp, Zap } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { useInterviewProgress, useRealtimeInterview } from "~/hooks/useInterviewProgress"

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
	triggerRunId?: string
	triggerAccessToken?: string
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

export default function ProcessingScreen({
	fileName,
	onComplete,
	interviewId,
	triggerRunId,
	triggerAccessToken,
}: ProcessingScreenProps) {
	const [currentCardIndex, setCurrentCardIndex] = useState(0)
	const [pollingAttempted, setPollingAttempted] = useState(false)
	const stuckTimerRef = useRef<NodeJS.Timeout | null>(null)
	const lastStatusRef = useRef<string | null>(null)

	// Fetch interview data with realtime subscription (fallback when Trigger.dev unavailable)
	const interview = useRealtimeInterview(interviewId)

	// Compute progress from interview data + Trigger.dev realtime
	const { progressInfo, isRealtime } = useInterviewProgress({
		interview,
		runId: triggerRunId,
		accessToken: triggerAccessToken,
	})
	const { progress, label: processingStage, isComplete } = progressInfo

	// Polling fallback: if stuck in transcription without Trigger.dev, poll AssemblyAI
	const checkStuckTranscription = useCallback(async () => {
		if (!interviewId || pollingAttempted) return

		consola.info("[ProcessingScreen] Checking stuck transcription...")
		setPollingAttempted(true)

		try {
			const response = await fetch("/api/interviews/check-transcription", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ interviewId }),
			})

			const result = await response.json()
			consola.info("[ProcessingScreen] Check result:", result)

			if (result.runId) {
				consola.success("[ProcessingScreen] Processing resumed via polling fallback")
			}
		} catch (error) {
			consola.error("[ProcessingScreen] Polling fallback failed:", error)
		}
	}, [interviewId, pollingAttempted])

	// Detect stuck transcription: no Trigger.dev run and status hasn't changed
	useEffect(() => {
		const currentStatus = interview?.status

		// Clear timer if status changed or we have a Trigger.dev run
		if (currentStatus !== lastStatusRef.current || isRealtime || isComplete) {
			if (stuckTimerRef.current) {
				clearTimeout(stuckTimerRef.current)
				stuckTimerRef.current = null
			}
			lastStatusRef.current = currentStatus ?? null
		}

		// Start stuck detection if in transcription/processing without Trigger.dev
		const isStuckCandidate =
			!isRealtime &&
			!isComplete &&
			!pollingAttempted &&
			(currentStatus === "processing" || currentStatus === "uploaded")

		if (isStuckCandidate && !stuckTimerRef.current) {
			consola.info("[ProcessingScreen] Starting stuck detection timer (30s)")
			stuckTimerRef.current = setTimeout(() => {
				consola.warn("[ProcessingScreen] Interview appears stuck, triggering polling fallback")
				checkStuckTranscription()
			}, 30000) // Wait 30 seconds before polling
		}

		return () => {
			if (stuckTimerRef.current) {
				clearTimeout(stuckTimerRef.current)
			}
		}
	}, [interview?.status, isRealtime, isComplete, pollingAttempted, checkStuckTranscription])

	// Auto-complete when processing is done
	useEffect(() => {
		if (isComplete) {
			setTimeout(onComplete, 1000) // Small delay before completion
		}
	}, [isComplete, onComplete])

	// Auto-advance cards every 8 seconds (slower, more relaxed)
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentCardIndex((prev) => (prev + 1) % educationalCards.length)
		}, 8000)

		return () => clearInterval(interval)
	}, [])

	const currentCard = educationalCards[currentCardIndex]
	const IconComponent = currentCard.icon

	const goToCard = (index: number) => {
		setCurrentCardIndex(index)
	}

	return (
		<div className="relative min-h-screen bg-black text-white">
			{/* Clean Header */}
			<div className="border-gray-800 border-b bg-black p-6">
				<div className="flex items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
						<h1 className="font-medium text-lg text-white">Processing Conversation</h1>
						{triggerRunId && (
							<Badge
								className={`w-fit uppercase tracking-wide ${
									isRealtime
										? "bg-[#FF5A36] text-white shadow-[0_0_25px_rgba(255,90,54,0.45)]"
										: "border border-white/40 border-dashed bg-transparent text-white/80"
								}`}
							>
								{isRealtime ? "Live via Trigger.dev" : "Waiting for Trigger.dev"}
							</Badge>
						)}
					</div>
					<p className="text-gray-400 text-sm">{fileName}</p>
				</div>
			</div>

			{/* Main Content - Centered & Clean */}
			<div className="flex min-h-[calc(100vh-300px)] items-center justify-center p-8">
				<div className="w-full max-w-lg text-center">
					{/* Primary Progress Indicator */}
					<div className="mb-8">
						<div className="mx-auto mb-6 h-24 w-24">
							<div className="relative h-full w-full">
								{/* Background circle */}
								<svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
									<path
										d="m18,2.0845
											a 15.9155,15.9155 0 0,1 0,31.831
											a 15.9155,15.9155 0 0,1 0,-31.831"
										fill="none"
										stroke="rgba(59, 130, 246, 0.2)"
										strokeWidth="3"
									/>
									{/* Progress circle */}
									<path
										d="m18,2.0845
											a 15.9155,15.9155 0 0,1 0,31.831
											a 15.9155,15.9155 0 0,1 0,-31.831"
										fill="none"
										stroke="rgb(59, 130, 246)"
										strokeWidth="3"
										strokeDasharray={`${progress}, 100`}
										className="transition-all duration-1000 ease-out"
									/>
								</svg>
								{/* Percentage in center */}
								<div className="absolute inset-0 flex items-center justify-center">
									<span className="font-light text-2xl text-white">{Math.round(progress)}%</span>
								</div>
							</div>
						</div>

						{/* Processing Stage */}
						<h2 className="mb-2 font-light text-white text-xl">{processingStage}</h2>
						{isRealtime && (
							<p className="mb-1 text-[#FF8A66] text-[11px] uppercase tracking-[0.28em]">
								Realtime updates via Trigger.dev
							</p>
						)}
						<p className="text-gray-400 text-sm">
							{Math.max(1, Math.ceil((100 - progress) / 20))}{" "}
							{Math.ceil((100 - progress) / 20) === 1 ? "minute" : "minutes"} remaining
						</p>
					</div>

					{/* Educational Content - Minimal */}
					<div className="rounded-lg bg-gray-900/50 p-6 backdrop-blur">
						<div className="mb-4 flex justify-center">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20">
								<IconComponent className="h-6 w-6 text-blue-400" />
							</div>
						</div>

						<h3 className="mb-3 font-medium text-lg text-white">{currentCard.title}</h3>
						<p className="text-gray-300 text-sm leading-relaxed">{currentCard.content}</p>

						{/* Simple dots indicator */}
						<div className="mt-6 flex justify-center gap-2">
							{educationalCards.map((_, index) => (
								<button
									key={index}
									onClick={() => goToCard(index)}
									className={`h-1.5 w-1.5 rounded-full transition-all ${
										index === currentCardIndex ? "bg-blue-400" : "bg-gray-600"
									}`}
								/>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
