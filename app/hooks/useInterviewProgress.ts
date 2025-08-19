import { useEffect, useState } from "react"
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
		progress: 0,
		label: "Uploading...",
		isComplete: false,
		hasError: false,
	})

	// Create supabase client at the component level (hook safe)
	const supabase = createClient()

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

		// Fallback polling every 3 seconds for status updates
		const pollInterval = setInterval(fetchInterview, 3000)

		return () => {
			supabase.removeChannel(channel)
			clearInterval(pollInterval)
		}
	}, [interviewId])

	// Update progress info when interview status changes
	useEffect(() => {
		if (!interview) return

		const status = interview.status
		let progress = 0
		let label = "Starting..."
		let isComplete = false
		let hasError = false

		switch (status) {
			case "uploading":
				progress = 20
				label = "Uploading..."
				break
			case "uploaded":
			case "transcribing":
				progress = 50
				label = "Transcribing audio..."
				break
			case "transcribed":
			case "processing":
				progress = 85
				label = "Analyzing insights..."
				break
			case "ready":
				progress = 100
				label = "Analysis complete!"
				isComplete = true
				break
			case "error":
				progress = 0
				label = "Processing failed"
				hasError = true
				break
			default:
				progress = 10
				label = "Uploading..."
		}

		setProgressInfo({
			status,
			progress,
			label,
			isComplete,
			hasError,
		})
	}, [interview])

	return {
		interview,
		progressInfo,
		isLoading: !interview && !progressInfo.hasError,
	}
}
