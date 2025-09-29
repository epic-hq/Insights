import { Clock, FileText, Play } from "lucide-react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { BackButton } from "~/components/ui/BackButton"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { EnhancedMediaPlayer } from "~/components/ui/EnhancedMediaPlayer"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Evidence } from "~/types"
import {
	findTranscriptSegmentByTime,
	formatTimecode,
	getTranscriptContext,
	parseTimeToSeconds,
} from "~/utils/transcript-navigation"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const { evidenceId } = params
	if (!evidenceId) throw new Response("Missing evidenceId", { status: 400 })

	// Fetch evidence with interview data for media playback
	const { data, error } = await supabase
		.from("evidence")
		.select(`
			*,
			evidence_tag(tag_id, confidence),
			interview:interview_id(
				id,
				title,
				media_url,
				transcript,
				transcript_formatted,
				duration_sec
			)
		`)
		.eq("id", evidenceId)
		.single()

	if (error) throw new Error(`Failed to load evidence: ${error.message}`)

	return {
		evidence: data as (Pick<Evidence, "id" | "verbatim" | "support" | "confidence" | "anchors"> & {
			context_summary?: string | null
			interview?: {
				id: string
				title: string
				media_url?: string | null
				transcript?: string | null
				transcript_formatted?: any | null
				duration_sec?: number | null
			} | null
		}) & {
			evidence_tag?: { tag_id: string; confidence: number | null }[]
		},
	}
}

export default function EvidenceDetail() {
	const { evidence } = useLoaderData<typeof loader>()
	const currentProject = useCurrentProject()
	const routes = useProjectRoutes(currentProject?.projectPath || "")
	const anchors = Array.isArray(evidence.anchors) ? evidence.anchors : []
	const interview = evidence.interview

	// Type-safe anchor filtering
	const mediaAnchors = anchors.filter((anchor): anchor is any => {
		return (
			anchor &&
			typeof anchor === "object" &&
			"type" in anchor &&
			(anchor.type === "av" || anchor.type === "audio" || anchor.type === "video")
		)
	})

	// Extract speaker transcripts from transcript_formatted
	const speakerTranscripts =
		interview?.transcript_formatted?.speaker_transcripts || interview?.transcript_formatted?.utterances || null

	return (
		<div className="space-y-6 p-6">
			<div className="relative">
				<BackButton to={routes.evidence.index()} label="Back" position="absolute" />
			</div>
			<div>
				<h1 className="font-semibold text-xl">Evidence Detail</h1>
				{interview && <p className="text-muted-foreground text-sm">From interview: {interview.title}</p>}
			</div>

			{/* Evidence Content */}
			<Card>
				<CardContent className="p-4">
					<div className="text-lg">"{evidence.verbatim}"</div>
					{evidence.context_summary && (
						<div className="mt-2 text-muted-foreground text-sm">{evidence.context_summary}</div>
					)}
					<div className="mt-2 flex items-center gap-4 text-gray-500 text-sm">
						<span>{evidence.support}</span>
						<Badge variant="outline">{evidence.confidence}</Badge>
					</div>
				</CardContent>
			</Card>

			{/* Media Players for Anchors */}
			{mediaAnchors.length > 0 && interview?.media_url && (
				<Card className="max-w-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Play className="h-5 w-5" />
							Media References
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{mediaAnchors.map((anchor, index) => {
							return (
								<div key={`anchor-${index}`} className="space-y-3 rounded-lg border p-4">
									<div className="flex items-center gap-2">
										<Clock className="h-4 w-4 text-muted-foreground" />
										<span className="font-medium text-sm">Anchor {index + 1}</span>
										{anchor.speaker && (
											<Badge variant="secondary" className="text-xs">
												{anchor.speaker}
											</Badge>
										)}
									</div>

									{anchor.chapter_title && <p className="text-muted-foreground text-sm">{anchor.chapter_title}</p>}

									<EnhancedMediaPlayer
										mediaUrl={interview.media_url!}
										startTime={anchor.start}
										endTime={anchor.end}
										title={`Play Anchor ${index + 1}`}
										size="sm"
										duration_sec={interview.duration_sec || undefined}
										showDebug={true}
									/>
								</div>
							)
						})}
					</CardContent>
				</Card>
			)}

			{/* Transcript Navigation Fallback */}
			{mediaAnchors.length > 0 && !interview?.media_url && speakerTranscripts && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Transcript References
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{mediaAnchors.map((anchor, index) => {
							const startTime = parseTimeToSeconds(anchor.start)
							const transcriptSegment = findTranscriptSegmentByTime(speakerTranscripts, startTime)
							const contextSegments = getTranscriptContext(speakerTranscripts, startTime, 1)

							return (
								<div key={index} className="rounded-lg border p-4">
									<div className="mb-2 flex items-center gap-2">
										<Clock className="h-4 w-4 text-muted-foreground" />
										<span className="font-medium text-sm">{formatTimecode(startTime)}</span>
										{anchor.speaker && (
											<Badge variant="secondary" className="text-xs">
												{anchor.speaker}
											</Badge>
										)}
									</div>

									{transcriptSegment ? (
										<div className="space-y-2">
											<div className="rounded bg-blue-50 p-3">
												<p className="text-sm">"{transcriptSegment.text}"</p>
												{transcriptSegment.speaker && (
													<p className="mt-1 text-muted-foreground text-xs">— {transcriptSegment.speaker}</p>
												)}
											</div>

											{contextSegments.length > 1 && (
												<details className="text-sm">
													<summary className="cursor-pointer text-muted-foreground">Show context</summary>
													<div className="mt-2 space-y-2">
														{contextSegments.map((segment, segIndex) => (
															<div
																key={segIndex}
																className={`rounded p-2 ${segment.start === transcriptSegment.start
																	? "border-blue-400 border-l-2 bg-blue-50"
																	: "bg-gray-50"
																	}`}
															>
																<div className="mb-1 flex items-center gap-2">
																	<span className="text-muted-foreground text-xs">{formatTimecode(segment.start)}</span>
																	{segment.speaker && (
																		<span className="text-muted-foreground text-xs">{segment.speaker}</span>
																	)}
																</div>
																<p className="text-xs">{segment.text}</p>
															</div>
														))}
													</div>
												</details>
											)}
										</div>
									) : (
										<p className="text-muted-foreground text-sm">No transcript segment found for this timecode</p>
									)}
								</div>
							)
						})}
					</CardContent>
				</Card>
			)}

			{/* Debug: All Anchors */}
			{false && anchors.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Debug: Anchor Data</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div>
								<h4 className="mb-2 font-medium text-sm">Interview Info:</h4>
								<div className="rounded bg-gray-50 p-3 text-xs">
									<div>Duration: {interview?.duration_sec}s</div>
									<div>Media URL: {interview?.media_url ? "Available" : "Not available"}</div>
									<div>Transcript: {interview?.transcript ? "Available" : "Not available"}</div>
									<div>Transcript Formatted: {interview?.transcript_formatted ? "Available" : "Not available"}</div>
								</div>
							</div>
							<div>
								<h4 className="mb-2 font-medium text-sm">All Anchors ({anchors.length}):</h4>
								<pre className="max-h-96 overflow-auto rounded border bg-gray-50 p-3 text-xs">
									{JSON.stringify(anchors, null, 2)}
								</pre>
							</div>
							<div>
								<h4 className="mb-2 font-medium text-sm">Media Anchors ({mediaAnchors.length}):</h4>
								<pre className="max-h-96 overflow-auto rounded border bg-blue-50 p-3 text-xs">
									{JSON.stringify(mediaAnchors, null, 2)}
								</pre>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
