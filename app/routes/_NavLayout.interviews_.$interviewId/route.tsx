import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import InsightCard from "~/components/insights/InsightCard"
import InsightCardGrid from "~/components/insights/InsightCardGrid"
import InterviewMetadata from "~/components/interviews/InterviewMetadata"
import type { InsightView } from "~/types"
import { db } from "~/utils/supabase.server"

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Interview ${params.interviewId || ""} | Insights` },
		{ name: "description", content: "Interview transcript and insights" },
	]
}

// Define transcript entry type for type safety
type TranscriptEntry = {
	speaker: string
	text: string
}

type TranscriptData = {
	content?: string | TranscriptEntry[] | null
}

export async function loader({ params }: { params: { interviewId: string } }) {
	const interviewId = params.interviewId

	// Fetch interview data from database
	const { data: interviewData, error: interviewError } = await db
		.from("interviews")
		.select("*")
		.eq("id", interviewId)
		.single()

	if (interviewError) {
		throw new Response(`Error fetching interview: ${interviewError.message}`, { status: 500 })
	}

	if (!interviewData) {
		throw new Response(`Interview not found: ${interviewId}`, { status: 404 })
	}

	// Fetch transcript data if available - using the correct table name from the schema
	let transcriptData: TranscriptData | null = null
	try {
		const { data, error } = await db.from("transcripts").select("content").eq("interview_id", interviewId).single()

		if (!error && data) {
			transcriptData = data as TranscriptData
		}
	} catch (_error) {
		// Silently handle error - transcript is optional
	}

	// Format the interview data
	const interview = {
		...interviewData,
	}

	// Fetch insights related to this interview
	const { data: insightsData, error: insightsError } = await db
		.from("insights")
		.select("*")
		.eq("interview_id", interviewId)

	if (insightsError) {
		throw new Response(`Error fetching insights: ${insightsError.message}`, { status: 500 })
	}

	// Transform insights to match the expected format for UI
	const insights: InsightView[] = (insightsData || []).map((insight) => ({
		id: insight.id,
		name: insight.name || "",
		title: insight.name || "", // Use name as title for backward compatibility
		category: insight.category || "",
		journeyStage: insight.journey_stage || "",
		impact: insight.impact,
		novelty: insight.novelty,
		jtbd: insight.jtbd,
		pain: insight.pain,
		desiredOutcome: insight.desired_outcome,
		description: "", // No direct field in DB schema
		evidence: "", // No direct evidence field in DB schema
		opportunityIdeas: insight.opportunity_ideas,
		confidence: insight.confidence,
		createdAt: insight.created_at,
		relatedTags: [], // No direct field in DB schema
		contradictions: insight.contradictions,
	}))

	return {
		interview,
		insights,
		transcriptData,
	}
}

export default function InterviewDetail() {
	const { interview, insights, transcriptData } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4">
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
						<h2 className="mb-4 font-semibold text-xl">Interview Transcript</h2>
						<div className="space-y-4">
							{(() => {
								if (!transcriptData?.content) {
									return (
										<div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
											<p className="text-gray-700 dark:text-gray-300">Transcript not available</p>
										</div>
									)
								}

								try {
									// Try to parse the content as JSON if it exists
									let parsedTranscript: TranscriptEntry[] = []

									if (typeof transcriptData.content === "string") {
										parsedTranscript = JSON.parse(transcriptData.content)
									} else if (Array.isArray(transcriptData.content)) {
										parsedTranscript = transcriptData.content
									}

									if (!Array.isArray(parsedTranscript) || parsedTranscript.length === 0) {
										return (
											<div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
												<p className="text-gray-700 dark:text-gray-300">No transcript entries found</p>
											</div>
										)
									}

									return (
										<>
											{parsedTranscript.map((entry, index) => (
												<div
													key={`transcript-entry-${index}-${entry.speaker || "unknown"}`}
													className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
												>
													<p className="mb-1 font-medium">{entry.speaker || "Unknown"}</p>
													<p className="text-gray-700 dark:text-gray-300">{entry.text || ""}</p>
												</div>
											))}
										</>
									)
								} catch (_error) {
									// Catch parsing errors but don't use the error variable
									return (
										<div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
											<p className="text-gray-700 dark:text-gray-300">Error parsing transcript</p>
										</div>
									)
								}
							})()}
						</div>
					</div>

					<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-semibold text-xl">Insights from this Interview</h2>
							<Link to={`/insights?interview=${interview.id}`} className="text-blue-600 hover:text-blue-800">
								View all
							</Link>
						</div>
						<InsightCardGrid>
							{insights.map((insight) => (
								<InsightCard key={insight.id} {...insight} />
							))}
						</InsightCardGrid>
					</div>
				</div>

				<div className="lg:col-span-1">
					<div className="sticky top-4 mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
						<h2 className="mb-4 font-semibold text-xl">Participant Information</h2>
						<InterviewMetadata
							date={interview.interview_date || interview.created_at?.split("T")[0] || ""}
							participant={interview.participant_pseudonym || "Anonymous"}
							interviewer={interview.interviewer_id || ""}
							interviewId={interview.id}
							duration={interview.duration_min || 0}
							segment={interview.segment || ""}
						/>

						<div className="mt-6 border-gray-200 border-t pt-6 dark:border-gray-700">
							<h3 className="mb-2 font-medium">Interview Status</h3>
							<div className="flex items-center">
								<span
									className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${
										interview.status === "ready"
											? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
											: interview.status === "transcribed"
												? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
												: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
									}`}
								>
									{(interview.status || "processing").charAt(0).toUpperCase() +
										(interview.status || "processing").slice(1)}
								</span>
							</div>
						</div>

						<div className="mt-6 border-gray-200 border-t pt-6 dark:border-gray-700">
							<h3 className="mb-2 font-medium">Actions</h3>
							<div className="flex flex-col space-y-2">
								<Link to={`/insights?interview=${interview.id}`} className="text-blue-600 hover:text-blue-800">
									View all insights from this interview
								</Link>
								<button
									className="text-left text-blue-600 hover:text-blue-800"
									onClick={() => alert("Download functionality would be implemented here")}
								>
									Download transcript
								</button>
								<button
									className="text-left text-blue-600 hover:text-blue-800"
									onClick={() => alert("Share functionality would be implemented here")}
								>
									Share interview
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
