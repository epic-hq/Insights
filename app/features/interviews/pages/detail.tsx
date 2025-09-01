import { Separator } from "@radix-ui/react-separator"
import consola from "consola"
import { useEffect, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import InlineEdit from "~/components/ui/inline-edit"
import { useCurrentProject } from "~/contexts/current-project-context"
import { EvidenceCard } from "~/features/evidence/components/EvidenceCard"
import { getInterviewById, getInterviewInsights, getInterviewParticipants } from "~/features/interviews/db"
import { MiniPersonCard } from "~/features/people/components/EnhancedPersonCard"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getSupabaseClient } from "~/lib/supabase/client"
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
			const msg = error instanceof Error ? error.message : String(error)
			throw new Response(`Error fetching participants: ${msg}`, { status: 500 })
		}

		// Check transcript availability without loading the actual content
		const { data: transcriptMeta, error: transcriptError } = await supabase
			.from("interviews")
			.select("transcript, transcript_formatted")
			.eq("id", interviewId)
			.eq("project_id", projectId)
			.single()

		if (transcriptError) {
			consola.warn("Could not check transcript availability:", transcriptError.message)
		}

		// Debug transcript availability
		consola.info("Transcript availability check:", {
			interviewId,
			hasTranscript: !!transcriptMeta?.transcript,
			hasFormattedTranscript: !!transcriptMeta?.transcript_formatted,
			transcriptLength: transcriptMeta?.transcript?.length || 0,
			transcriptFormattedType: typeof transcriptMeta?.transcript_formatted,
		})

		const interview = {
			...interviewData,
			participants,
			primaryParticipant,
			// Check transcript availability without loading content
			hasTranscript: !!transcriptMeta?.transcript,
			hasFormattedTranscript: !!transcriptMeta?.transcript_formatted,
		}

		// Fetch insights related to this interview with junction table tags
		const { data: insights, error } = await getInterviewInsights({
			supabase,
			interviewId: interviewId,
		})

		if (error) {
			const msg = error instanceof Error ? error.message : String(error)
			throw new Response(`Error fetching insights: ${msg}`, { status: 500 })
		}

		// Fetch evidence related to this interview
		const { data: evidence, error: evidenceError } = await supabase
			.from("evidence")
			.select("*")
			.eq("interview_id", interviewId)
			.order("created_at", { ascending: false })

		if (evidenceError) {
			consola.warn("Could not fetch evidence:", evidenceError.message)
		}

		return {
			interview,
			insights,
			evidence: evidence || [],
			interviewerData: null,
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		throw new Response(`Failed to load interview: ${msg}`, { status: 500 })
	}
}

export default function InterviewDetail({ enableRecording = false }: { enableRecording?: boolean }) {
	const { interview, insights, evidence, interviewerData } = useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)

	const participants = interview.participants || []
	const primaryParticipant = participants[0]?.people
	consola.log("InterviewDetail participants: ", participants)
	consola.log("InterviewDetail insights: ", insights)

	const [isProcessing, setIsProcessing] = useState(false)

	useEffect(() => {
		// Subscribe to analysis_jobs updates for this interview to reflect processing state
		const supabase = getSupabaseClient()
		const channel = supabase
			.channel(`analysis-${interview.id}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "analysis_jobs", filter: `interview_id=eq.${interview.id}` },
				(payload) => {
					const next = (payload as unknown as { new?: { status?: string } }).new
					const status = next?.status
					if (status === "in_progress") setIsProcessing(true)
					if (status === "completed" || status === "failed" || status === "error") setIsProcessing(false)
				}
			)
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [interview.id])

	return (
		<div className="mx-auto max-w-6xl">
			<div className="grid gap-8 lg:grid-cols-3" />
			<Separator />
			<div className="mx-auto mt-8 w-full max-w-7xl px-4 lg:flex lg:space-x-8">
				<div className="flex-1 space-y-8">
					{/* Header: Title, participant, persona, date, project */}
					<div className="mb-4 flex flex-col gap-2 border-b pb-4">
						<div className="flex items-center justify-between gap-3">
							<h1 className="font-bold text-2xl">{interview.title || "Untitled Interview"}</h1>
							<div className="flex items-center gap-2">
								{enableRecording && (
									<Link
										to={routes.interviews.realtime(interview.id)}
										className="inline-flex items-center rounded-md border px-3 py-2 font-semibold text-sm shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
										title="Start realtime transcription and copilot"
									>
										Record Now
									</Link>
								)}

								{(interview.hasTranscript || interview.hasFormattedTranscript || interview.status === "error") && (
									<button
										onClick={() => {
											try {
												fetcher.submit(
													{ interview_id: interview.id },
													{ method: "post", action: "/api.analysis-retry" }
												)
											} catch (e) {
												consola.error("Retry analysis submit failed", e)
											}
										}}
										disabled={fetcher.state !== "idle" || isProcessing}
										className="inline-flex items-center rounded-md border px-3 py-2 font-semibold text-sm shadow-sm disabled:opacity-60"
										title="Re-run AI analysis on this interview"
									>
										{fetcher.state !== "idle" || isProcessing ? "Processing…" : "Retry analysis"}
									</button>
								)}
								<Link
									to={routes.interviews.edit(interview.id)}
									className="inline-flex items-center rounded-md px-3 py-2 font-semibold text-sm shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
								>
									Edit Interview
								</Link>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-base">
							{/* Show participant from junction table if available, fallback to legacy field */}
							{interview.primaryParticipant?.name ? (
								<MiniPersonCard person={primaryParticipant} />
							) : (
								interview.participant_pseudonym && (
									<span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
										{interview.participant_pseudonym}
									</span>
								)
							)}
							{/* Show persona from junction table if available, fallback to legacy field */}
							{/* {interview.primaryParticipant?.personas?.name ? (
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
							)} */}

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
						<div className="mb-2 text-foreground/50 text-sm">
							Interviewer: <span className="font-medium text-foreground/50">{interviewerData.name}</span>
						</div>
					)}

					<div>
						<label className="mb-1 block font-bold text-foreground text-lg">Observations & Notes</label>
						<InlineEdit
							textClassName="text-foreground"
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
										valueLength: value?.length,
									})
									fetcher.submit(
										{
											entity: "interview",
											entityId: interview.id,
											accountId,
											projectId,
											fieldName: "observations_and_notes",
											fieldValue: value,
										},
										{ method: "post", action: "/api/update-field" }
									)
								} catch (error) {
									consola.error("❌ Failed to update observations_and_notes:", error)
									// Don't throw - just log the error to prevent crash
								}
							}}
						/>
					</div>
					{/* Interview Summary Fields */}
					<div className="mb-4 space-y-4">
						{/* <div>
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
											valuePreview: value?.substring(0, 50),
										})

										// Convert newline-separated text to JSON array for storage
										const arrayValue = value ? value.split("\n").filter((item) => item.trim()) : []
										const jsonValue = JSON.stringify(arrayValue)

										consola.info("🔄 Converted to JSON:", { arrayValue, jsonValue })

										fetcher.submit(
											{
												entity: "interview",
												entityId: interview.id,
												accountId,
												projectId,
												fieldName: "high_impact_themes",
												fieldValue: jsonValue,
											},
											{ method: "post", action: "/api/update-field" }
										)
									} catch (error) {
										consola.error("❌ Failed to update high_impact_themes:", error)
										// Don't throw - just log the error to prevent crash
									}
								}}
							/>
						</div> */}
						<div>
							<label className="mb-1 block font-bold text-lg">Open Questions & Next Steps</label>
							<InlineEdit
								textClassName="text-foreground"
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
											valueLength: value?.length,
										})

										// Convert newline-separated text to JSON array for storage
										const arrayValue = value ? value.split("\n").filter((item) => item.trim()) : []
										const jsonValue = JSON.stringify(arrayValue)

										consola.info("🔄 Converted to JSON:", { arrayValue, jsonValue })

										fetcher.submit(
											{
												entity: "interview",
												entityId: interview.id,
												accountId,
												projectId,
												fieldName: "open_questions_and_next_steps",
												fieldValue: jsonValue,
											},
											{ method: "post", action: "/api/update-field" }
										)
									} catch (error) {
										consola.error("❌ Failed to update open_questions_and_next_steps:", error)
										// Don't throw - just log the error to prevent crash
									}
								}}
							/>
						</div>
					</div>

					{/* Evidence Section */}
					{evidence.length > 0 && (
						<div className="space-y-4">
							<h2 className="font-semibold text-foreground text-lg">Evidence</h2>
							<div className="space-y-4">
								{evidence.map((evidenceItem) => (
									<EvidenceCard key={evidenceItem.id} evidence={evidenceItem} />
								))}
							</div>
						</div>
					)}

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
							<div className="rounded-lg border bg-background p-6">
								<h3 className="mb-4 font-semibold text-foreground">Participants</h3>
								<div className="space-y-3">
									{participants.map((participant, index) => (
										<div key={index} className="border-blue-500 border-l-4 pl-3">
											<div className="font-medium text-foreground">
												{participant.people?.name || "Unknown Participant"}
											</div>
											{participant.people?.segment && (
												<div className="text-foreground/50 text-sm">{participant.people.segment}</div>
											)}
											{participant.people?.segment && (
												<Badge variant="secondary" className="mt-1">
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
							<div className="rounded-lg border bg-background p-6">
								<h3 className="mb-4 font-semibold text-foreground">Insights</h3>
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
											{insight.impact && (
												<div className="mt-1 text-foreground/50 text-sm">Impact: {insight.impact}</div>
											)}
										</div>
									))}
								</div>
							</div>
						)}

						{/* Metadata */}
						<div className="rounded-lg border bg-background p-6">
							<h3 className="mb-4 font-semibold text-foreground">Metadata</h3>
							<div className="space-y-3">
								{interview.interview_date && (
									<div>
										<label className="font-medium text-gray-500 text-sm">Interview Date</label>
										<div className="mt-1 text-foreground/50 text-sm">
											{new Date(interview.interview_date).toLocaleDateString()}
										</div>
									</div>
								)}
								{interview.duration_min && (
									<div>
										<label className="font-medium text-gray-500 text-sm">Duration</label>
										<div className="mt-1 text-foreground/50 text-sm">{interview.duration_min} minutes</div>
									</div>
								)}

								<div>
									<label className="font-medium text-gray-500 text-sm">Created</label>
									<div className="mt-1 text-foreground/50 text-sm">
										{new Date(interview.created_at).toLocaleDateString()}
									</div>
								</div>

								{interview.updated_at && (
									<div>
										<label className="font-medium text-gray-500 text-sm">Last Updated</label>
										<div className="mt-1 text-foreground/50 text-sm">
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
