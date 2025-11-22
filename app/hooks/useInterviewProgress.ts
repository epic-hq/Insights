import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { uploadMediaAndTranscribeTask } from "~/../src/trigger/interview/uploadMediaAndTranscribe"
import { createClient } from "~/lib/supabase/client"
import type { Interview } from "~/types"

interface AnalysisJob {
	id: string
	interview_id: string
	status: string
	status_detail: string | null
	progress: number | null
	current_step: string | null
	completed_steps: string[] | null
	workflow_state: any
	trigger_run_id: string | null
	last_error: string | null
	created_at: string
	updated_at: string
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
	const [analysisJob, setAnalysisJob] = useState<AnalysisJob | null>(null)
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
			} else {
				console.error("[useInterviewProgress] Failed to fetch interview:", interviewError)
			}

			// Fetch latest analysis job for this interview
			const { data: jobData, error: jobError } = await supabase
				.from("analysis_jobs")
				.select("*")
				.eq("interview_id", interviewId)
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle()

			console.log("[useInterviewProgress] Analysis job query result:", {
				found: !!jobData,
				error: jobError,
				interviewId,
			})

			if (jobData && !jobError) {
				setAnalysisJob(jobData as AnalysisJob)
			} else if (jobError) {
				console.error("[useInterviewProgress] Failed to fetch analysis job:", jobError)
			}
		}

		fetchData()

		// Set up realtime subscriptions for both interview and analysis_jobs
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
				}
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "analysis_jobs",
					filter: `interview_id=eq.${interviewId}`,
				},
				(payload) => {
					if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
						const newJob = payload.new as AnalysisJob
						setAnalysisJob(newJob)
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

	// Update progress from analysis_jobs (v2 workflow) - highest priority
	useEffect(() => {
		if (!analysisJob) {
			console.log("[useInterviewProgress] No analysis job found")
			return
		}

		console.log("[useInterviewProgress] Analysis job:", {
			id: analysisJob.id,
			status: analysisJob.status,
			trigger_run_id: analysisJob.trigger_run_id,
			current_step: analysisJob.current_step,
			progress: analysisJob.progress,
		})

		// Check if this job is actively running
		const isActiveJob = analysisJob.status === "in_progress" || analysisJob.status === "queued"
		if (!isActiveJob && interview?.status === "ready") return // Skip if interview is already done

		const jobProgress = analysisJob.progress ?? 0
		const currentStep = analysisJob.current_step
		const completedSteps = analysisJob.completed_steps ?? []
		const statusDetail = analysisJob.status_detail ?? "Processing..."

		const isComplete = analysisJob.status === "done" || interview?.status === "ready"
		const hasError = analysisJob.status === "error"
		const canCancel = isActiveJob && Boolean(analysisJob.trigger_run_id)

		console.log("[useInterviewProgress] canCancel:", canCancel, "isActiveJob:", isActiveJob, "has trigger_run_id:", Boolean(analysisJob.trigger_run_id))

		// Map workflow steps to user-friendly labels
		const stepLabels: Record<string, string> = {
			upload: "Uploading and transcribing...",
			evidence: "Extracting evidence...",
			insights: "Generating insights...",
			personas: "Assigning personas...",
			answers: "Attributing to questions...",
			finalize: "Finalizing analysis..."
		}

		const label = statusDetail || (currentStep ? stepLabels[currentStep] : "Processing...")

		setProgressInfo({
			status: analysisJob.status,
			progress: Math.round(jobProgress),
			label,
			isComplete,
			hasError,
			currentStep: currentStep ?? undefined,
			completedSteps,
			canCancel,
			analysisJobId: analysisJob.id,
			triggerRunId: analysisJob.trigger_run_id ?? undefined,
		})

		cleanupTimers() // Stop synthetic progress when using real data
	}, [analysisJob, interview?.status, cleanupTimers])

	// Update progress info when interview status changes (fallback when run metadata unavailable)
	useEffect(() => {
		if (run && !realtimeError) return
		if (!interview) return
		if (analysisJob) return // Defer to analysis job data

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
