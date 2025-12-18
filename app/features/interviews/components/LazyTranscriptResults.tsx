import { ChevronDown, ChevronUp, Download, FileText } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { normalizeTranscriptUtterances } from "~/utils/transcript/normalizeUtterances"
import { TranscriptResults } from "./TranscriptResults"

interface LazyTranscriptResultsProps {
	interviewId: string
	hasTranscript: boolean
	hasFormattedTranscript: boolean
	durationSec?: number | null
	participants?: Array<{
		id: number
		role: string | null
		transcript_key: string | null
		display_name: string | null
		people?: { id?: string; name?: string | null; segment?: string | null }
	}>
}

interface TranscriptApiResponse {
	transcript: string
	transcript_formatted: {
		audio_duration?: number | null
		speaker_transcripts?: any[]
		topic_detection?: any
		sentiment_analysis?: any
		sentiment_analysis_results?: any
	}
}

interface TranscriptData {
	text: string
	utterances: any[]
	iab_categories_result: any
	sentiment_analysis_results: any
	audio_duration_sec: number | null
}

export function LazyTranscriptResults({
	interviewId,
	hasTranscript,
	hasFormattedTranscript,
	durationSec,
	participants = [],
}: LazyTranscriptResultsProps) {
	const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null)
	const [loading, setLoading] = useState(false)
	const [isLoaded, setIsLoaded] = useState(false)
	const [isExpanded, setIsExpanded] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const currentProject = useCurrentProject()
	const projectId = currentProject?.projectId

	const loadTranscript = async () => {
		setLoading(true)
		setError(null)

		try {
			if (!projectId || !currentProject) {
				throw new Error("Project context required for transcript access")
			}

			const params = new URLSearchParams({
				interviewId,
			})

			const response = await fetch(`/a/${currentProject.accountId}/${projectId}/api/interview-transcript?${params}`)

			if (!response.ok) {
				throw new Error(`Failed to load transcript: ${response.statusText}`)
			}

			const data: TranscriptApiResponse = await response.json()

			const audioDurationRaw = data.transcript_formatted?.audio_duration
			const audioDurationParsed =
				typeof audioDurationRaw === "string" ? Number.parseFloat(audioDurationRaw) : audioDurationRaw
			const audioDurationSec =
				typeof audioDurationParsed === "number" && Number.isFinite(audioDurationParsed)
					? audioDurationParsed
					: (durationSec ?? null)

			const processedData: TranscriptData = {
				text: data.transcript || "",
				utterances: normalizeTranscriptUtterances(data.transcript_formatted?.speaker_transcripts || [], {
					audioDurationSec,
				}),
				iab_categories_result: data.transcript_formatted?.topic_detection,
				sentiment_analysis_results: data.transcript_formatted?.sentiment_analysis_results,
				audio_duration_sec: audioDurationSec,
			}
			setTranscriptData(processedData)
			setIsLoaded(true)
			setIsExpanded(true)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load transcript")
		} finally {
			setLoading(false)
		}
	}

	if (!hasTranscript && !hasFormattedTranscript) {
		return (
			<div className="rounded-lg border bg-muted p-6 text-center">
				<p className="text-muted-foreground">No transcript available for this interview.</p>
			</div>
		)
	}

	if (!isLoaded && !loading) {
		return (
			<div className="rounded-lg border bg-background/50 p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<FileText className="h-5 w-5 text-muted-foreground" />
						<div>
							<h3 className="font-medium text-foreground">Interview Transcript</h3>
							<p className="text-foreground text-sm">
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
			<div className="rounded-lg border bg-card p-6">
				<div className="flex items-center justify-center space-x-2">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					<span className="text-muted-foreground">Loading transcript...</span>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6">
				<div className="flex items-center justify-between">
					<p className="text-destructive">Error loading transcript: {error}</p>
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
		<div className="space-y-4">
			<div className="rounded-lg border bg-background/50 p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<FileText className="h-5 w-5 text-muted-foreground" />
						<div>
							<h3 className="font-medium text-foreground">Interview Transcript</h3>
							<p className="text-foreground text-sm">
								{hasFormattedTranscript ? "Full transcript with analysis" : "Raw transcript"}
							</p>
						</div>
					</div>
					<Button
						onClick={() => setIsExpanded(!isExpanded)}
						variant="ghost"
						size="sm"
						className="flex items-center gap-2"
					>
						{isExpanded ? (
							<>
								<ChevronUp className="h-4 w-4" />
								Hide
							</>
						) : (
							<>
								<ChevronDown className="h-4 w-4" />
								Show
							</>
						)}
					</Button>
				</div>
			</div>
			{isExpanded && (
				<TranscriptResults
					data={{
						id: interviewId,
						text: transcriptData.text,
						words: [],
						language_code: "en",
						confidence: 0,
						audio_duration: transcriptData.audio_duration_sec ?? 0,
						utterances: transcriptData.utterances,
						iab_categories_result: transcriptData.iab_categories_result,
						sentiment_analysis_results: transcriptData.sentiment_analysis_results,
					}}
					rawTranscript={transcriptData.text || undefined}
					participants={participants}
				/>
			)}
		</div>
	)
}
