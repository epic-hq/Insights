import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { uploadMediaAndTranscribeTask } from "~/../src/trigger/interview/uploadMediaAndTranscribe"
import { createClient } from "~/lib/supabase/client"
import type { Interview } from "~/types"

interface ConversationAnalysis {
	status_detail: string | null
	progress: number | null
	current_step: string | null
	completed_steps: string[] | null
	workflow_state: any
	trigger_run_id: string | null
	last_error: string | null
	transcript_data?: any
	custom_instructions?: string
}

interface ProgressInfo {
	status: string
	progress: number
	label: string
	isComplete: boolean
	hasError: boolean
	currentStep?: string
	completedSteps?: string[]
	canCancel?: boolean
	analysisJobId?: string
	triggerRunId?: string
}

interface UseInterviewProgressOptions {
	interviewId: string | null
	runId?: string
	accessToken?: string
}

export function useInterviewProgress({ interviewId, runId, accessToken }: UseInterviewProgressOptions) {
	const [interview, setInterview] = useState<Interview | null>(null)
	const [conversationAnalysis, setConversationAnalysis] = useState<ConversationAnalysis | null>(null)
	const [progressInfo, setProgressInfo] = useState<ProgressInfo>({
		status: "uploading",
		progress: 5, // Start with small progress to show activity
		label: "Uploading file...",
		isComplete: false,
		hasError: false,
	})
	const [syntheticProgress, setSyntheticProgress] = useState(5)
	const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
	const lastStatusRef = useRef<string | null>(null)

	// Create supabase client at the component level (hook safe)
	const supabase = createClient()

	const shouldSubscribeToRun = Boolean(runId && accessToken)

	const realtimeOptions = useMemo(() => {
		if (!shouldSubscribeToRun) {
			return { enabled: false as const }
		}

		return {
			accessToken: accessToken as string,
		}
	}, [shouldSubscribeToRun, accessToken])

	const realtimeRunId = shouldSubscribeToRun ? runId : undefined

	// Always call useRealtimeRun but with conditional parameters
	const { run, error: realtimeError } = useRealtimeRun<typeof uploadMediaAndTranscribeTask>(
		realtimeRunId,
		realtimeOptions
	)

	const isRealtime = Boolean(shouldSubscribeToRun && run && !realtimeError)

	// Log realtime errors for debugging
	useEffect(() => {
		if (realtimeError) {
			console.warn("Trigger.dev realtime connection failed:", realtimeError)
		}
	}, [realtimeError])

	// Get expected duration for each status phase
	const getProgressDuration = useCallback((status: string): number => {
		switch (status) {
			case "uploading":
			case "uploaded":
				return 15 // 15 seconds for upload
			case "transcribing":
				return 45 // 45 seconds for transcription
			case "processing":
				return 30 // 30 seconds for AI analysis
			default:
				return 10
		}
	}, [])

	// Cleanup function for timers
	const cleanupTimers = useCallback(() => {
		if (progressTimerRef.current) {
			clearInterval(progressTimerRef.current)
			progressTimerRef.current = null
		}
	}, [])

	// Start synthetic progress animation for current status
	const startSyntheticProgress = useCallback(
		(currentStatus: string, startProgress: number, targetProgress: number) => {
			cleanupTimers()
			setSyntheticProgress(startProgress)

			// Animate progress smoothly over time
			const duration = getProgressDuration(currentStatus) // Duration in seconds
			const steps = duration * 4 // Update 4 times per second
			const increment = (targetProgress - startProgress) / steps

			let currentStep = 0
			progressTimerRef.current = setInterval(() => {
				currentStep++
				const newProgress = Math.min(startProgress + increment * currentStep, targetProgress)
				setSyntheticProgress(newProgress)

				if (currentStep >= steps) {
					cleanupTimers()
				}
			}, 250) // Update every 250ms for smooth animation
		},
		[cleanupTimers, getProgressDuration]
	)

	useEffect(() => {
		if (!interviewId) return

		// Fetch interview and latest analysis job
		const fetchData = async () => {
			const { data: interviewData, error: interviewError } = await supabase
				.from("interviews")
				.select("*")
				.eq("id", interviewId)
				.single()

			if (interviewData && !interviewError) {
				setInterview(interviewData)
				// Extract conversation_analysis from interview
				const analysis = interviewData.conversation_analysis as ConversationAnalysis | null
				if (analysis) {
					setConversationAnalysis(analysis)
				}
			} else {
				console.error("[useInterviewProgress] Failed to fetch interview:", interviewError)
			}
		}

		fetchData()

		// Set up realtime subscription for interview updates (conversation_analysis is in interviews table)
		const channel = supabase
			.channel(`interview_progress_${interviewId}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "interviews",
					filter: `id=eq.${interviewId}`,
				},
				(payload) => {
					const newInterview = payload.new as Interview
					setInterview(newInterview)
					// Update conversation_analysis when interview updates
					const analysis = newInterview.conversation_analysis as ConversationAnalysis | null
					if (analysis) {
						setConversationAnalysis(analysis)
					}
				}
			)
			.subscribe()

		// More frequent polling during active processing (1.5 seconds)
		const pollInterval = setInterval(fetchData, 1500)

		return () => {
			supabase.removeChannel(channel)
			clearInterval(pollInterval)
			cleanupTimers()
		}
	}, [interviewId, supabase, cleanupTimers])

	// Update progress based on trigger.dev run metadata when available
	useEffect(() => {
		if (!run || realtimeError) return

		cleanupTimers()

		const runStatus = run.status ?? "UNKNOWN"
		const isComplete = runStatus === "COMPLETED"
		const hasError = runStatus === "FAILED" || runStatus === "CANCELED"

		const percent =
			typeof run.metadata?.progressPercent === "number"
				? run.metadata.progressPercent
				: isComplete
					? 100
					: runStatus === "EXECUTING"
						? 60
						: 15

		const labelFromMetadata = typeof run.metadata?.stageLabel === "string" ? run.metadata.stageLabel : null

		const label =
			labelFromMetadata ??
			(() => {
				switch (runStatus) {
					case "QUEUED":
						return "Queued for processing..."
					case "EXECUTING":
						return "Processing with Trigger.dev..."
					case "COMPLETED":
						return "Analysis complete!"
					case "FAILED":
					case "CANCELED":
						return "Processing failed"
					default:
						return "Processing..."
				}
			})()

		setProgressInfo({
			status: runStatus,
			progress: Math.round(percent),
			label,
			isComplete,
			hasError,
		})
	}, [run, cleanupTimers, realtimeError])

	// Update progress from conversation_analysis (v2 workflow) - highest priority
	useEffect(() => {
		if (!interview) {
			return
		}

		// Use conversation_analysis as primary source of truth
		const metadata = interview.conversation_analysis as any

		// Debug logging reduced - uncomment if needed
		// console.log("[useInterviewProgress] status:", interview.status)

		// If interview is ready, show completion
		if (interview.status === "ready") {
			setProgressInfo({
				status: "ready",
				progress: 100,
				label: "Initial analysis complete!",
				isComplete: true,
				hasError: false,
			})
			cleanupTimers()
			return
		}

		// If interview is in error state
		if (interview.status === "error") {
			const errorMsg = metadata?.error || "Processing failed"
			setProgressInfo({
				status: "error",
				progress: 0,
				label: errorMsg,
				isComplete: false,
				hasError: true,
			})
			cleanupTimers()
			return
		}

		// If no conversation_analysis yet or no valid progress, skip (will use fallback logic)
		if (!metadata) {
			return
		}

		// If interview is completed, always show 100% regardless of current_step
		if (interview.status === "completed") {
			setProgressInfo({
				status: "completed",
				progress: 100,
				label: "Analysis complete!",
				isComplete: true,
				hasError: false,
			})
			cleanupTimers()
			return
		}

		// If no current_step, use fallback
		if (!metadata.current_step) {
			return
		}

		// Read from processing_metadata
		const currentStep = metadata.current_step
		const jobProgress = metadata.progress ?? 0
		const statusDetail = metadata.status_detail ?? "Processing..."
		const triggerRunId = metadata.trigger_run_id

		// Check if actively processing
		const isActiveJob = interview.status === "processing"
		const isComplete = currentStep === "complete" || interview.status === "ready"
		const hasError = interview.status === "error" || Boolean(metadata.failed_at)
		const canCancel = isActiveJob && Boolean(triggerRunId)

		// Debug logging reduced

		// Map workflow steps to user-friendly labels
		const stepLabels: Record<string, string> = {
			upload: "Uploading and transcribing...",
			evidence: "Extracting evidence...",
			insights: "Generating insights...",
			personas: "Assigning personas...",
			answers: "Attributing to questions...",
			finalize: "Finalizing analysis...",
			complete: "Analysis complete!",
		}

		const label = statusDetail || (currentStep ? stepLabels[currentStep] : "Processing...")

		setProgressInfo({
			status: interview.status,
			progress: Math.round(jobProgress),
			label,
			isComplete,
			hasError,
			currentStep: currentStep ?? undefined,
			completedSteps: metadata.completed_steps,
			canCancel,
			analysisJobId: interviewId, // analysisJobId is now interviewId
			triggerRunId: triggerRunId ?? undefined,
		})

		cleanupTimers() // Stop synthetic progress when using real data
	}, [interview, interviewId, cleanupTimers])

	// Update progress info when interview status changes (fallback when run metadata unavailable)
	useEffect(() => {
		if (run && !realtimeError) return
		if (!interview) return

		// Defer to conversation_analysis if available
		const metadata = interview.conversation_analysis as any
		if (metadata && metadata.current_step) return

		const status = interview.status
		let baseProgress = 0
		let targetProgress = 0
		let label = "Starting..."
		let isComplete = false
		let hasError = false

		// Define progress ranges for each status
		switch (status) {
			case "uploading":
				baseProgress = 5
				targetProgress = 25
				label = "Uploading file..."
				break
			case "uploaded":
				baseProgress = 25
				targetProgress = 35
				label = "Upload complete, starting transcription..."
				break
			case "transcribing":
				baseProgress = 35
				targetProgress = 65
				label = "Transcribing audio..."
				break
			case "transcribed":
				baseProgress = 65
				targetProgress = 75
				label = "Transcription complete, extracting evidence and insights..."
				break
			case "processing":
				baseProgress = 75
				targetProgress = 95
				label = "Extracting evidence and insights..."
				break
			case "ready":
				baseProgress = 100
				targetProgress = 100
				label = "Initial analysis complete!"
				isComplete = true
				cleanupTimers() // Stop any running animations
				break
			case "error":
				baseProgress = 0
				targetProgress = 0
				label = "Processing failed"
				hasError = true
				cleanupTimers()
				break
			default:
				baseProgress = 5
				targetProgress = 15
				label = "Initializing..."
		}

		// Start synthetic progress animation if status changed
		if (lastStatusRef.current !== status && !isComplete && !hasError) {
			startSyntheticProgress(status, baseProgress, targetProgress)
			lastStatusRef.current = status
		}

		// Use synthetic progress for active statuses, actual progress for completed/error
		const displayProgress = isComplete || hasError ? baseProgress : syntheticProgress

		setProgressInfo({
			status,
			progress: Math.round(displayProgress),
			label,
			isComplete,
			hasError,
		})
	}, [interview, syntheticProgress, startSyntheticProgress, cleanupTimers, run, realtimeError])

	return {
		interview,
		progressInfo,
		isLoading: !interview && !run && !progressInfo.hasError && !realtimeError,
		isRealtime,
	}
}
