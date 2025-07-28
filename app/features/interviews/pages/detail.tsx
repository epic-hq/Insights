import { Separator } from "@radix-ui/react-separator"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import EditableTextarea from "~/components/EditableTextarea"
import { Badge } from "~/components/ui/badge"
import { getInterviewById, getInterviewInsights, getInterviewParticipants } from "~/features/interviews/db"
import { userContext } from "~/server/user-context"
import { TranscriptResults } from "../components/TranscriptResults"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.interview?.title || "Interview"} | Insights` },
		{ name: "description", content: "Interview details and transcript" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { interviewId } = params

	if (!interviewId) {
		throw new Response("Interview ID is required", { status: 400 })
	}

	try {
		// Fetch interview data from database (simple query first to avoid junction table issues)
		const { data: interviewData, error: interviewError } = await getInterviewById({
			supabase,
			accountId,
			id: interviewId,
		})

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
			const { data: participantData } = await getInterviewParticipants({
				supabase,
				interviewId: interviewId,
			})

			participants = participantData || []
			primaryParticipant = participants[0]?.people
		} catch (error) {
			throw new Response(`Error fetching participants: ${error.message}`, { status: 500 })
		}

		const interview = {
			...interviewData,
			participants,
			primaryParticipant,
		}

		// Fetch insights related to this interview with junction table tags
		const { data: insights, error } = await getInterviewInsights({
			supabase,
			interviewId: interviewId,
		})

		if (error) {
			throw new Response(`Error fetching insights: ${error.message}`, { status: 500 })
		}

		return {
			interview,
			insights,
			interviewerData: null,
		}
	} catch (error) {
		throw new Response(`Failed to load interview: ${error.message}`, { status: 500 })
	}
}

export default function InterviewDetail() {
	const { interview, insights, interviewerData } = useLoaderData<typeof loader>()

	const participants = interview.participants || []
	const _primaryParticipant = participants[0]?.people

	return (
		<div className="mx-auto max-w-6xl">
			<div className="grid gap-8 lg:grid-cols-3" />
			<Separator />
			<div className="mx-auto mt-8 w-full max-w-7xl px-4 lg:flex lg:space-x-8">
				<div className="flex-1 space-y-8">
					{/* Header: Title, participant, persona, date, project */}
					<div className="mb-4 flex flex-col gap-2 border-b pb-4">
						<div className="flex items-center justify-between">
							<h1 className="font-bold text-2xl">{interview.title || "Untitled Interview"}</h1>
							<Link
								to={`/interviews/${interview.id}/edit`}
								className="inline-flex items-center rounded-md px-3 py-2 font-semibold text-sm text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
							>
								Edit Interview
							</Link>
						</div>
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
					{/* TODO: Interviewer info */}
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
								utterances: interview.transcript_formatted?.speaker_transcripts,
								iab_categories_result: interview.transcript_formatted?.topic_detection,
								sentiment_analysis_results: interview.transcript_formatted?.sentiment_analysis,
							}}
						/>
					</div>
				</div>
				<aside className="mt-8 w-full space-y-4 lg:mt-0 lg:max-w-sm">
					<div className="space-y-6">
						{/* Participants */}
						{participants.length > 0 && (
							<div className="rounded-lg border bg-white p-6">
								<h3 className="mb-4 font-semibold">Participants</h3>
								<div className="space-y-3">
									{participants.map((participant, index) => (
										<div key={index} className="border-blue-500 border-l-4 pl-3">
											<div className="font-medium text-gray-900">
												{participant.people?.name || "Unknown Participant"}
											</div>
											{participant.people?.segment && (
												<div className="text-gray-600 text-sm">{participant.people.segment}</div>
											)}
											{participant.people?.segment && (
												<Badge size="sm" variant="secondary" className="mt-1">
													{participant.people.segment}
												</Badge>
											)}
										</div>
									))}
								</div>
							</div>
						)}

						{/* Insights */}
						{insights.length > 0 && (
							<div className="rounded-lg border bg-white p-6">
								<h3 className="mb-4 font-semibold">Insights</h3>
								<div className="space-y-3">
									{insights.map((insight) => (
										<div key={insight.id} className="border-green-500 border-l-4 pl-3">
											<Link to={`/insights/${insight.id}`} className="font-medium text-blue-600 hover:text-blue-800">
												{insight.name}
											</Link>
											{insight.category && (
												<Badge variant="secondary" className="ml-2">
													{insight.category}
												</Badge>
											)}
											{insight.impact && <div className="mt-1 text-gray-600 text-sm">Impact: {insight.impact}</div>}
										</div>
									))}
								</div>
							</div>
						)}

						{/* Metadata */}
						<div className="rounded-lg border bg-white p-6">
							<h3 className="mb-4 font-semibold">Metadata</h3>
							<div className="space-y-3">
								{interview.duration_min && (
									<div>
										<label className="font-medium text-gray-500 text-sm">Duration</label>
										<div className="mt-1 text-gray-900 text-sm">{interview.duration_min} minutes</div>
									</div>
								)}

								<div>
									<label className="font-medium text-gray-500 text-sm">Created</label>
									<div className="mt-1 text-gray-900 text-sm">
										{new Date(interview.created_at).toLocaleDateString()}
									</div>
								</div>

								{interview.updated_at && (
									<div>
										<label className="font-medium text-gray-500 text-sm">Last Updated</label>
										<div className="mt-1 text-gray-900 text-sm">
											{new Date(interview.updated_at).toLocaleDateString()}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</aside>
			</div>
		</div>
	)
}
