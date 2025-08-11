import { Separator } from "@radix-ui/react-separator"
import consola from "consola"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import InlineEdit from "~/components/ui/inline-edit"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getInterviewById, getInterviewInsights, getInterviewParticipants } from "~/features/interviews/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import { LazyTranscriptResults } from "../components/LazyTranscriptResults"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.interview?.title || "Interview"} | Insights` },
		{ name: "description", content: "Interview details and transcript" },
	]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const interviewId = params.interviewId

	if (!accountId || !projectId || !interviewId) {
		throw new Response("Account ID, Project ID, and Interview ID are required", { status: 400 })
	}

	try {
		// Fetch interview data from database (simple query first to avoid junction table issues)
		const { data: interviewData, error: interviewError } = await getInterviewById({
			supabase,
			accountId,
			projectId,
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

		// Exclude large transcript data from loader response to prevent memory leaks
		// Only include transcript metadata, not the full content
		const { transcript, transcript_formatted, ...interviewMetadata } = interviewData
		
		const interview = {
			...interviewMetadata,
			participants,
			primaryParticipant,
			// Only include transcript length for display, not full content
			transcriptLength: transcript?.length || 0,
			hasTranscript: !!transcript,
			hasFormattedTranscript: !!transcript_formatted,
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
	const fetcher = useFetcher()
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)

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
								to={routes.interviews.edit(interview.id)}
								className="inline-flex items-center rounded-md px-3 py-2 font-semibold text-sm shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
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
							{/* {interview?.project?.title && (
								<span className="inline-block rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-800">
									Project: {interview.project.title}
								</span>
							)} */}
						</div>
					</div>

					{/* Interviewer info */}
					{/* TODO: Interviewer info */}
					{interviewerData?.name && (
						<div className="mb-2 text-gray-600 text-sm">
							Interviewer: <span className="font-medium text-gray-900">{interviewerData.name}</span>
						</div>
					)}

					<div>
						<label className="mb-1 block font-bold text-lg">Observations & Notes</label>
						<InlineEdit
							value={
								Array.isArray(interview.observations_and_notes)
									? interview.observations_and_notes.join("\n")
									: (interview.observations_and_notes ?? "")
							}
							multiline
							placeholder="Observations & Notes"
							onSubmit={(value) => {
								try {
									consola.info("📝 Submitting observations_and_notes update:", {
										interviewId: interview.id,
										accountId,
										projectId,
										valueLength: value?.length
									})
									fetcher.submit(
										{ 
											entity: "interview",
											entityId: interview.id,
											accountId,
											projectId,
											fieldName: "observations_and_notes",
											fieldValue: value
										},
										{ method: "post", action: "/api/update-field" }
									)
								} catch (error) {
									consola.error('❌ Failed to update observations_and_notes:', error)
									// Don't throw - just log the error to prevent crash
								}
							}}
						/>
					</div>
					{/* Interview Summary Fields */}
					<div className="mb-4 space-y-4">
						<div>
							<label className="mb-1 block font-bold text-lg">High Impact Themes</label>
							<InlineEdit
								value={
									Array.isArray(interview.high_impact_themes)
										? interview.high_impact_themes.join("\n")
										: (interview.high_impact_themes ?? "")
								}
								multiline
								placeholder="High Impact Themes"
								onSubmit={(value) => {
									try {
										consola.info("🎨 Submitting high_impact_themes update:", {
											interviewId: interview.id,
											accountId,
											projectId,
											valueLength: value?.length,
											valuePreview: value?.substring(0, 50)
										})
										
										// Convert newline-separated text to JSON array for storage
										const arrayValue = value ? value.split('\n').filter(item => item.trim()) : []
										const jsonValue = JSON.stringify(arrayValue)
										
										consola.info("🔄 Converted to JSON:", { arrayValue, jsonValue })
										
										fetcher.submit(
											{ 
												entity: "interview",
												entityId: interview.id,
												accountId,
												projectId,
												fieldName: "high_impact_themes",
												fieldValue: jsonValue
											},
											{ method: "post", action: "/api/update-field" }
										)
									} catch (error) {
										consola.error('❌ Failed to update high_impact_themes:', error)
										// Don't throw - just log the error to prevent crash
									}
								}}
							/>
						</div>
						<div>
							<label className="mb-1 block font-bold text-lg">Open Questions & Next Steps</label>
							<InlineEdit
								value={
									Array.isArray(interview.open_questions_and_next_steps)
										? interview.open_questions_and_next_steps.join("\n")
										: (interview.open_questions_and_next_steps ?? "")
								}
								multiline
								placeholder="Open Questions & Next Steps"
								onSubmit={(value) => {
									try {
										consola.info("📝 Submitting open_questions_and_next_steps update:", {
											interviewId: interview.id,
											accountId,
											projectId,
											valueLength: value?.length
										})
										
										// Convert newline-separated text to JSON array for storage
										const arrayValue = value ? value.split('\n').filter(item => item.trim()) : []
										const jsonValue = JSON.stringify(arrayValue)
										
										consola.info("🔄 Converted to JSON:", { arrayValue, jsonValue })
										
										fetcher.submit(
											{ 
												entity: "interview",
												entityId: interview.id,
												accountId,
												projectId,
												fieldName: "open_questions_and_next_steps",
												fieldValue: jsonValue
											},
											{ method: "post", action: "/api/update-field" }
										)
									} catch (error) {
										consola.error('❌ Failed to update open_questions_and_next_steps:', error)
										// Don't throw - just log the error to prevent crash
									}
								}}
							/>
						</div>
					</div>

					{/* Transcript Section */}
					<div>
						<LazyTranscriptResults
							interviewId={interview.id}
							hasTranscript={interview.hasTranscript}
							hasFormattedTranscript={interview.hasFormattedTranscript}
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
											<Link
												to={routes.insights.detail(insight.id)}
												className="font-medium text-blue-600 hover:text-blue-800"
											>
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
