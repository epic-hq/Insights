import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "~/lib/supabase/client"
import type { Interview } from "~/types"

interface ProgressInfo {
	status: string
	progress: number
	label: string
	isComplete: boolean
	hasError: boolean
}

export function useInterviewProgress(interviewId: string | null) {
	const [interview, setInterview] = useState<Interview | null>(null)
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
	const startSyntheticProgress = useCallback((currentStatus: string, startProgress: number, targetProgress: number) => {
		cleanupTimers()
		setSyntheticProgress(startProgress)

		// Animate progress smoothly over time
		const duration = getProgressDuration(currentStatus) // Duration in seconds
		const steps = duration * 4 // Update 4 times per second
		const increment = (targetProgress - startProgress) / steps

		let currentStep = 0
		progressTimerRef.current = setInterval(() => {
			currentStep++
			const newProgress = Math.min(startProgress + (increment * currentStep), targetProgress)
			setSyntheticProgress(newProgress)

			if (currentStep >= steps) {
				cleanupTimers()
			}
		}, 250) // Update every 250ms for smooth animation
	}, [cleanupTimers, getProgressDuration])

	useEffect(() => {
		if (!interviewId) return

		// Initial fetch
		const fetchInterview = async () => {
			const { data, error } = await supabase.from("interviews").select("*").eq("id", interviewId).single()

			if (data && !error) {
				setInterview(data)
			}
		}

		fetchInterview()

		// Set up realtime subscription
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
			.subscribe()

		// More frequent polling during active processing (1.5 seconds)
		const pollInterval = setInterval(fetchInterview, 1500)

		return () => {
			supabase.removeChannel(channel)
			clearInterval(pollInterval)
			cleanupTimers()
		}
	}, [interviewId, supabase, cleanupTimers])

	// Update progress info when interview status changes
	useEffect(() => {
		if (!interview) return

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
	}, [interview, syntheticProgress, startSyntheticProgress, cleanupTimers])

	return {
		interview,
		progressInfo,
		isLoading: !interview && !progressInfo.hasError,
	}
}
