import { useState } from "react"
import { Button } from "~/components/ui/button"
import { FileText, Download } from "lucide-react"
import { TranscriptResults } from "./TranscriptResults"
import { useCurrentProject } from "~/contexts/current-project-context"

interface LazyTranscriptResultsProps {
	interviewId: string
	hasTranscript: boolean
	hasFormattedTranscript: boolean
}

interface TranscriptApiResponse {
	transcript: string
	transcript_formatted: {
		speaker_transcripts?: any[]
		topic_detection?: any
		sentiment_analysis?: any
	}
}

interface TranscriptData {
	text: string
	utterances: any[]
	iab_categories_result: any
	sentiment_analysis_results: any
}

export function LazyTranscriptResults({
	interviewId,
	hasTranscript,
	hasFormattedTranscript,
}: LazyTranscriptResultsProps) {
	const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isLoaded, setIsLoaded] = useState(false)
	const { projectId } = useCurrentProject()

	const loadTranscript = async () => {
		setLoading(true)
		setError(null)

		try {
			const params = new URLSearchParams({
				interviewId,
			})

			// Add projectId if available
			if (projectId) {
				params.set("projectId", projectId)
			}

			const response = await fetch(`/api/interview-transcript?${params}`)

			if (!response.ok) {
				throw new Error(`Failed to load transcript: ${response.statusText}`)
			}

			const data: TranscriptApiResponse = await response.json()
			const processedData: TranscriptData = {
				text: data.transcript || "",
				utterances: data.transcript_formatted?.speaker_transcripts || [],
				iab_categories_result: data.transcript_formatted?.topic_detection,
				sentiment_analysis_results: data.transcript_formatted?.sentiment_analysis,
			}
			setTranscriptData(processedData)
			setIsLoaded(true)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load transcript")
		} finally {
			setLoading(false)
		}
	}

	if (!hasTranscript && !hasFormattedTranscript) {
		return (
			<div className="rounded-lg border bg-gray-50 p-6 text-center">
				<p className="text-gray-500">No transcript available for this interview.</p>
			</div>
		)
	}

	if (!isLoaded && !loading) {
		return (
			<div className="rounded-lg border bg-background/50 p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<FileText className="h-5 w-5 text-gray-400" />
						<div>
							<h3 className="font-medium text-foreground">Interview Transcript</h3>
							<p className="text-sm text-foreground ">
								{hasFormattedTranscript ? "Full transcript with analysis available" : "Raw transcript available"}
							</p>
						</div>
					</div>
					<Button onClick={loadTranscript} variant="outline" className="flex items-center gap-2">
						<Download className="h-4 w-4" />
						Load Transcript
					</Button>
				</div>
			</div>
		)
	}

	if (loading) {
		return (
			<div className="rounded-lg border bg-white p-6">
				<div className="flex items-center justify-center space-x-2">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
					<span className="text-gray-600">Loading transcript...</span>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="rounded-lg border border-red-200 bg-red-50 p-6">
				<div className="flex items-center justify-between">
					<p className="text-red-600">Error loading transcript: {error}</p>
					<Button onClick={loadTranscript} variant="outline" size="sm">
						Retry
					</Button>
				</div>
			</div>
		)
	}

	if (!transcriptData) {
		return null
	}

	return (
		<TranscriptResults
			data={{
				id: interviewId,
				text: transcriptData.text,
				words: [],
				language_code: "en",
				confidence: 0,
				audio_duration: 0,
				utterances: transcriptData.utterances,
				iab_categories_result: transcriptData.iab_categories_result,
				sentiment_analysis_results: transcriptData.sentiment_analysis_results,
			}}
			rawTranscript={transcriptData.text || undefined}
		/>
	)
}
