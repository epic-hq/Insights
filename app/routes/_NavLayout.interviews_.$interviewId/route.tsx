import consola from "consola"
import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import EditableTextarea from "~/components/EditableTextarea"
import { TranscriptResults } from "~/components/interviews/TranscriptResults"
import { getServerClient } from "~/lib/supabase/server"
import type { Interview } from "~/types"

// TODO: Clean up Transcript prop, participant name and persona more prominent

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Interview ${params.interviewId || ""} | Insights` },
		{ name: "description", content: "Interview transcript and insights" },
	]
}

// Define transcript entry type for type safety

// Type for extended interview with transcript and research project data is defined inline with the data

export async function loader({ request, params }: { request: Request; params: { interviewId: string } }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	const interviewId = params.interviewId

	// consola.log("interviewId", interviewId, accountId)
	// Fetch interview data from database (simple query first to avoid junction table issues)
	const { data: interviewData, error: interviewError } = await supabase
		.from("interviews")
		.select("*")
		.eq("id", interviewId)
		.eq("account_id", accountId)
		.single()

	// consola.log("interviewData", interviewData)

	if (interviewError) {
		throw new Response(`Error fetching interview: ${interviewError.message}`, { status: 500 })
	}

	if (!interviewData) {
		throw new Response("Interview not found", { status: 404 })
	}

	// Fetch participant data separately to avoid junction table query issues
	let participants: any[] = []
	let primaryParticipant: any = null

	try {
		const { data: participantData } = await supabase
			.from("interview_people")
			.select(`
				role,
				people(
					id,
					name,
					segment,
					description,
					contact_info,
					personas(
						id,
						name,
						description
					)
				)
			`)
			.eq("interview_id", interviewId)

		participants = participantData || []
		primaryParticipant = participants[0]?.people
	} catch (_error) {}

	const interview: Interview & {
		participants: typeof participants
		primaryParticipant: typeof primaryParticipant
	} = {
		...interviewData,
		participants,
		primaryParticipant,
	}

	consola.log("interview", interview)
	// Fetch interviewer information if available
	let interviewerData = null
	if (interview.interviewer_id) {
		// Note: In a real implementation, you would use proper auth methods
		// This is a simplified version that assumes interviewer_id is stored
		interviewerData = { name: "Interviewer", id: interview.interviewer_id }
	}

	// Fetch insights related to this interview
	const { data: insightsData, error: insightsError } = await supabase
		.from("insights")
		.select("*")
		.eq("interview_id", interviewId)

	if (insightsError) {
		throw new Response(`Error fetching insights: ${insightsError.message}`, { status: 500 })
	}

	// Transform insights to match the expected format for UI
	const insights: any[] = (insightsData || []).map((insight) => ({
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
	const { data: relatedInterviews } = await supabase
		.from("interviews")
		.select("*")
		.eq("account_id", accountId)
		.eq("project_id", interview.project_id)
		.neq("id", interviewId)
		.limit(5)

	// consola.log("Detail interview:", interview)
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
	// useEffect(() => {
	// 	consola.log("Detail interview:", interview)
	// }, [interview])

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
						{/* Show participant from junction table if available, fallback to legacy field */}
						{interview.primaryParticipant?.name ? (
							<span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
								{interview.primaryParticipant.name}
							</span>
						) : (
							interview.participant_pseudonym && (
								<span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
									{interview.participant_pseudonym}
								</span>
							)
						)}
						{/* Show persona from junction table if available, fallback to legacy field */}
						{interview.primaryParticipant?.personas?.name ? (
							<span className="inline-block rounded bg-green-100 px-2 py-0.5 font-medium text-green-800">
								{interview.primaryParticipant.personas.name}
							</span>
						) : interview.primaryParticipant?.segment ? (
							<span className="inline-block rounded bg-green-100 px-2 py-0.5 font-medium text-green-800">
								{interview.primaryParticipant.segment}
							</span>
						) : (
							interview.segment && (
								<span className="inline-block rounded bg-green-100 px-2 py-0.5 font-medium text-green-800">
									{interview.segment}
								</span>
							)
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

				{/* Transcript Section */}
				<div>
					<TranscriptResults
						data={{
							utterances: interview.transcript_formatted.speaker_transcripts,
							iab_categories_result: interview.transcript_formatted.topic_detection,
							sentiment_analysis_results: interview.transcript_formatted.sentiment_analysis,
						}}
					/>
				</div>
			</div>
			<aside className="mt-8 w-full space-y-4 lg:mt-0 lg:max-w-sm">
				{/* Insights Section */}
				<div className="mb-6">
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
