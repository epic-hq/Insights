import consola from "consola"
import { useEffect } from "react"
import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import MarkdownTranscript from "~/components/MarkdownTranscript"
import TranscriptDisplay from "~/components/TranscriptDisplay"
import { Button } from "~/components/ui/button"
import EditableTextarea from "~/components/EditableTextarea"
import type { Insight, Interview } from "~/types"
import { db } from "~/utils/supabase.server"

// TODO: Clean up Transcript prop, participant name and persona more prominent

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Interview ${params.interviewId || ""} | Insights` },
		{ name: "description", content: "Interview transcript and insights" },
	]
}

// Define transcript entry type for type safety

// Type for extended interview with transcript and research project data is defined inline with the data

export async function loader({ params }: { params: { interviewId: string } }) {
	const interviewId = params.interviewId

	// Fetch interview data from database with project information
	const { data: interviewData, error: interviewError } = await db
		.from("interviews")
		.select(`
			*,
			research_projects(id, code, title, description)
		`)
		.eq("id", interviewId)
		.single()

	if (interviewError) {
		throw new Response(`Error fetching interview: ${interviewError.message}`, { status: 500 })
	}

	if (!interviewData) {
		throw new Response("Interview not found", { status: 404 })
	}

	const interview: Interview = interviewData // Supabase type includes transcript and transcript_formatted

	// Fetch interviewer information if available
	let interviewerData = null
	if (interview.interviewer_id) {
		// Note: In a real implementation, you would use proper auth methods
		// This is a simplified version that assumes interviewer_id is stored
		interviewerData = { name: "Interviewer", id: interview.interviewer_id }
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
	const insights: Insight[] = (insightsData || []).map((insight) => ({
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
		description: insight.description, // No direct field in DB schema
		evidence: insight.evidence, // No direct evidence field in DB schema
		opportunityIdeas: insight.opportunity_ideas,
		confidence: insight.confidence,
		createdAt: insight.created_at,
		relatedTags: insight.related_tags, // No direct field in DB schema
		contradictions: insight.contradictions,
		interview_id: insight.interview_id,
	}))

	// Get related interviews from the same project
	const { data: relatedInterviews } = await db
		.from("interviews")
		.select("id, title, participant_pseudonym, interview_date")
		.eq("project_id", interview.project_id)
		.neq("id", interviewId)
		.limit(5)

	consola.log("Detail interview:", interview)
	return {
		interview,
		insights,

		interviewerData,
		relatedInterviews: relatedInterviews || [],
	}
}

export default function InterviewDetail() {
	// Only transcript section is rendered. Interview type is inferred from loader.
	const data = useLoaderData()
	const interview = data?.interview
	useEffect(() => {
		consola.log("Detail interview:", interview)
	}, [interview])

	if (!interview) {
		return (
			<div className="mx-auto mt-16 w-full max-w-2xl text-center font-semibold text-lg text-red-600">
				Interview not found or failed to load.
			</div>
		)
	}

	const { insights = [], interviewerData = null, relatedInterviews = [] } = data ?? {}

	return (
		<div className="mx-auto mt-8 w-full max-w-7xl px-4 lg:flex lg:space-x-8">
			<div className="flex-1 space-y-8">
				{/* Header: Title, participant, persona, date, project */}
				<div className="mb-4 flex flex-col gap-2 border-b pb-4">
					<h1 className="font-bold text-2xl">{interview.title || "Untitled Interview"}</h1>
					<div className="flex flex-wrap items-center gap-2 text-base">
						{interview.participant_pseudonym && (
							<span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
								{interview.participant_pseudonym}
							</span>
						)}
						{interview.segment && (
							<span className="inline-block rounded bg-green-100 px-2 py-0.5 font-medium text-green-800">
								{interview.segment}
							</span>
						)}
						{interview.interview_date && (
							<span className="ml-2 text-gray-500">{new Date(interview.interview_date).toLocaleDateString()}</span>
						)}
						{interview.research_projects?.title && (
							<span className="inline-block rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-800">
								Project: {interview.research_projects.title}
							</span>
						)}
					</div>
				</div>

				{/* Interviewer info */}
				{interviewerData?.name && (
					<div className="mb-2 text-gray-600 text-sm">
						Interviewer: <span className="font-medium text-gray-900">{interviewerData.name}</span>
					</div>
				)}

                {/* Interview Summary Fields */}
                <div className="mb-4 space-y-4">
                    <EditableTextarea
                        table="interviews"
                        id={interview.id}
                        field="high_impact_themes"
                        label="High Impact Themes"
                        initialValue={interview.high_impact_themes}
                        isArray
                    />
                    <EditableTextarea
                        table="interviews"
                        id={interview.id}
                        field="open_questions_and_next_steps"
                        label="Open Questions & Next Steps"
                        initialValue={interview.open_questions_and_next_steps}
                    />
                    <EditableTextarea
                        table="interviews"
                        id={interview.id}
                        field="observations_and_notes"
                        label="Observations & Notes"
                        initialValue={interview.observations_and_notes}
                    />
                </div>

				{/* Insights List */}
				<div>
					<h2 className="mb-2 font-semibold text-lg">Insights</h2>
					{insights.length > 0 ? (
						<ul className="space-y-2">
							{insights.map((insight) => (
								<li key={insight.id} className="rounded border bg-gray-50 p-3">
									<Link to={`/insights/${insight.id}`} className="font-bold text-gray-900">
										{insight.title || "Untitled"}
									</Link>
									<div className="text-gray-700 text-sm">{insight.category || "No category"}</div>
									{insight.description && <div className="mt-1 text-gray-600">{insight.description}</div>}
								</li>
							))}
						</ul>
					) : (
						<div className="text-gray-400 italic">No insights available for this interview.</div>
					)}
				</div>

				{/* Transcript Section */}
				<div>
					<h2 className="mb-2 font-semibold text-lg">Transcript</h2>
					{Array.isArray(interview.transcript) ? (
						<div className="mb-6">
							<div className="mb-2 flex justify-end">
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										const transcriptWindow = window.open("", "_blank", "width=800,height=600,resizable,scrollbars")
										if (transcriptWindow) {
											transcriptWindow.document.write(
												'<pre style="white-space: pre-wrap; word-break: break-word; font-size: 1rem; font-family: inherit; margin: 1em;">' +
													JSON.stringify(interview.transcript, null, 2) +
													"</pre>"
											)
											transcriptWindow.document.title = "Interview Transcript"
										}
									}}
									className="ml-auto"
								>
									Open Transcript in New Window
								</Button>
							</div>
							<TranscriptDisplay transcript={interview.transcript ?? []} />
						</div>
					) : interview.transcript ? (
						<div className="mb-6">
							{/* <div className="mb-2 flex justify-end">
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										const transcriptWindow = window.open("", "_blank", "width=800,height=600,resizable,scrollbars")
										if (transcriptWindow) {
											transcriptWindow.document.write(
												'<pre style="white-space: pre-wrap; word-break: break-word; font-size: 1rem; font-family: inherit; margin: 1em;">' +
													(interview.transcript ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
													"</pre>"
											)
											transcriptWindow.document.title = "Interview Transcript"
										}
									}}
									className="ml-auto"
								>
									Open Transcript in New Window
								</Button>
							</div> */}
							<MarkdownTranscript transcript={interview.transcript} />
						</div>
					) : (
						<div className="py-12 text-center text-gray-500 italic">No transcript available for this interview.</div>
					)}
				</div>
			</div>
			<aside className="mt-8 w-full space-y-4 lg:mt-0 lg:max-w-sm">
				<h2 className="mb-2 font-semibold text-lg">Related Interviews</h2>
				{relatedInterviews.length > 0 ? (
					<ul className="space-y-2">
						{relatedInterviews.map((r) => (
							<li
								key={r.id}
								className="flex flex-col rounded border bg-gray-50 p-2 transition hover:bg-gray-100 sm:flex-row sm:items-center sm:justify-between"
							>
								<div>
									<Link to={`/interviews/${r.id}`} className="font-medium text-gray-900">
										{r.title || "Untitled"}
									</Link>
									{r.participant_pseudonym && <span className="ml-2 text-blue-700">{r.participant_pseudonym}</span>}
									{r.interview_date && (
										<span className="ml-2 text-gray-500">{new Date(r.interview_date).toLocaleDateString()}</span>
									)}
								</div>
								<Link to={`/interviews/${r.id}`} className="mt-1 text-blue-600 text-sm hover:underline sm:mt-0">
									View
								</Link>
							</li>
						))}
					</ul>
				) : (
					<div className="text-gray-400 italic">No related interviews found.</div>
				)}
			</aside>
		</div>
	)
}
