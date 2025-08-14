import { useState, useEffect } from "react"
import { useCurrentProject } from "~/contexts/current-project-context"
import { TranscriptResults } from "./TranscriptResults"

interface LazyTranscriptResultsProps {
	interviewId: string
	hasTranscript: boolean
	hasFormattedTranscript: boolean
}

interface TranscriptData {
	id: string
	text: string
	words: any[]
	language_code: string
	utterances: any[]
	iab_categories_result: any
	sentiment_analysis_results: any
}

export function LazyTranscriptResults({ 
	interviewId, 
	hasTranscript, 
	hasFormattedTranscript 
}: LazyTranscriptResultsProps) {
	const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const { accountId, projectId } = useCurrentProject()

	useEffect(() => {
		if (!hasTranscript && !hasFormattedTranscript) return

		const loadTranscript = async () => {
			setLoading(true)
			setError(null)

			try {
				const params = new URLSearchParams({
					interviewId,
				})

				const response = await fetch(`/api/interview-transcript?${params}`)
				
				if (!response.ok) {
					throw new Error(`Failed to load transcript: ${response.statusText}`)
				}

				const data = await response.json()
				const transcriptData = {
					id: interviewId,
					text: '',
					words: [],
					language_code: 'en',
					utterances: data.transcript,
					iab_categories_result: data.transcript_formatted?.iab_categories_result,
					sentiment_analysis_results: data.transcript_formatted?.sentiment_analysis_results,
				}
				setTranscriptData(transcriptData)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load transcript')
			} finally {
				setLoading(false)
			}
		}

		loadTranscript()
	}, [interviewId, hasTranscript, hasFormattedTranscript])

	if (!hasTranscript && !hasFormattedTranscript) {
		return (
			<div className="rounded-lg border bg-gray-50 p-6 text-center">
				<p className="text-gray-500">No transcript available for this interview.</p>
			</div>
		)
	}

	if (loading) {
		return (
			<div className="rounded-lg border bg-white p-6">
				<div className="flex items-center justify-center space-x-2">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
					<span className="text-gray-600">Loading transcript...</span>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="rounded-lg border border-red-200 bg-red-50 p-6">
				<p className="text-red-600">Error loading transcript: {error}</p>
			</div>
		)
	}

	if (!transcriptData) {
		return null
	}

	return (
		<TranscriptResults
			data={{
				utterances: transcriptData.utterances,
				iab_categories_result: transcriptData.iab_categories_result,
				sentiment_analysis_results: transcriptData.sentiment_analysis_results,
			}}
			rawTranscript={transcriptData.transcript || undefined}
		/>
	)
}
