import { Separator } from "@radix-ui/react-separator"
import consola from "consola"
import { useEffect, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData, useRouteLoaderData } from "react-router-dom"
import { BackButton } from "~/components/ui/BackButton"
import { Badge } from "~/components/ui/badge"
import InlineEdit from "~/components/ui/inline-edit"
import { MediaPlayer } from "~/components/ui/MediaPlayer"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getInterviewById, getInterviewInsights, getInterviewParticipants } from "~/features/interviews/db"
import { MiniPersonCard } from "~/features/people/components/EnhancedPersonCard"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getSupabaseClient } from "~/lib/supabase/client"
import { userContext } from "~/server/user-context"
import { LazyTranscriptResults } from "../components/LazyTranscriptResults"

// Normalize potentially awkwardly stored text fields (array, JSON string, or plain string)
function normalizeMultilineText(value: unknown): string {
	try {
		if (Array.isArray(value)) {
			return value.filter((v) => typeof v === "string" && v.trim()).join("\n")
		}
		if (typeof value === "string") {
			// Try to parse stringified JSON arrays: "[\"a\",\"b\"]"
			const parsed = JSON.parse(value)
			if (Array.isArray(parsed)) {
				return parsed.filter((v) => typeof v === "string" && v.trim()).join("\n")
			}
			return value
		}
		return ""
	} catch {
		// If JSON.parse fails, treat it as plain text
		return typeof value === "string" ? value : ""
	}
}

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

	consola.info("🔍 Interview Detail Loader Started:", {
		accountId,
		projectId,
		interviewId,
		params
	})

	if (!accountId || !projectId || !interviewId) {
		consola.error("❌ Missing required parameters:", { accountId, projectId, interviewId })
		throw new Response("Account ID, Project ID, and Interview ID are required", { status: 400 })
	}

	try {
		consola.info("📊 Fetching interview data...")
		// Fetch interview data from database (simple query first to avoid junction table issues)
		const { data: interviewData, error: interviewError } = await getInterviewById({
			supabase,
			accountId,
			projectId,
			id: interviewId,
		})

		if (interviewError) {
			consola.error("❌ Error fetching interview:", interviewError)
			throw new Response(`Error fetching interview: ${interviewError.message}`, { status: 500 })
		}

		if (!interviewData) {
			consola.error("❌ Interview not found:", { interviewId, projectId, accountId })
			throw new Response("Interview not found", { status: 404 })
		}

		consola.info("✅ Interview data fetched successfully:", {
			interviewId: interviewData.id,
			title: interviewData.title
		})

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

		const loaderResult = {
			accountId,
			projectId,
			interview,
			insights,
			evidence: evidence || [],
		}

		consola.info("✅ Loader completed successfully:", {
			accountId,
			projectId,
			interviewId: interview.id,
			insightsCount: insights?.length || 0,
			evidenceCount: evidence?.length || 0
		})

		return loaderResult
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		consola.error("❌ Loader caught error:", error)
		consola.error("Error details:", {
			message: msg,
			accountId,
			projectId,
			interviewId
		})
		throw new Response(`Failed to load interview: ${msg}`, { status: 500 })
	}
}

export default function InterviewDetail({ enableRecording = false }: { enableRecording?: boolean }) {
	const { accountId, projectId, interview, insights, evidence } = useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as any

	// Always call hooks at the top level
	const currentProject = useCurrentProject()
	const projectPath = currentProject.projectPath || `/a/${accountId}/${projectId}`
	const routes = useProjectRoutes(projectPath)
	const [isProcessing, setIsProcessing] = useState(false)

	useEffect(() => {
		if (!interview?.id) return

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

	// Early validation without logging in render
	if (!interview || !accountId || !projectId) {
		return <div>Error: Missing interview data</div>
	}

	const participants = interview.participants || []
	const primaryParticipant = participants[0]?.people

	function formatReadable(dateString: string) {
		const d = new Date(dateString)
		const parts = d.toLocaleString("en-US", {
			month: "short",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		})
		// Make AM/PM lower-case and use dash after month
		const lower = parts.replace(/AM|PM/, (m) => m.toLowerCase())
		return lower.replace(/^(\w{3}) (\d{2}), /, "$1-$2 ")
	}

	function renderCreatedBy(createdBy?: string | null, user?: any) {
		if (!createdBy) return "Unknown"
		if (user?.sub === createdBy) return user?.user_metadata?.full_name || user?.email || "You"
		return createdBy
	}

	return (
		<div className="mx-auto max-w-6xl">
			<div className="mb-6">
				<BackButton to={routes.interviews.index()} label="Back to Interviews" position="relative" />
			</div>
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

					{/* Empathy Map (Says/Does/Thinks/Feels + Pains/Gains) */}
					{evidence.length > 0 && (
						<div className="mb-6 rounded-lg border bg-background p-4">
							<h2 className="mb-3 font-semibold text-foreground text-lg">Empathy Map</h2>
							{(() => {
								const gather = (key: 'says'|'does'|'thinks'|'feels'|'pains'|'gains') => {
									const vals: string[] = []
									evidence.forEach((e: any) => {
										const arr = Array.isArray(e[key]) ? e[key] : []
										for (const v of arr) if (typeof v === 'string' && v.trim()) vals.push(v.trim())
									})
									// Deduplicate while preserving order
									const seen = new Set<string>()
									return vals.filter(v => (seen.has(v) ? false : (seen.add(v), true))).slice(0, 20)
								}

								const blocks: Array<{title: string; key: 'says'|'does'|'thinks'|'feels'|'pains'|'gains'}> = [
									{ title: 'Says', key: 'says' },
									{ title: 'Does', key: 'does' },
									{ title: 'Thinks', key: 'thinks' },
									{ title: 'Feels', key: 'feels' },
									{ title: 'Pains', key: 'pains' },
									{ title: 'Gains', key: 'gains' },
								]

								return (
									<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
										{blocks.map((b) => {
											const items = gather(b.key)
											return (
												<div key={b.key} className="rounded-md border bg-card p-3">
													<div className="mb-2 font-medium text-foreground">{b.title}</div>
													{items.length === 0 ? (
														<div className="text-muted-foreground text-sm">No data yet</div>
													) : (
														<ul className="flex flex-wrap gap-1">
															{items.map((it, i) => (
																<li key={i} className="rounded-full border px-2 py-0.5 text-xs text-foreground">
																	{it}
																</li>
															))}
														</ul>
													)}
												</div>
											)
										})}
									</div>
								)
							})()}
						</div>
					)}

					{/* Interviewer info */}
					{/* TODO: Interviewer info */}
					{/* {interviewerData?.name && (
						<div className="mb-2 text-foreground/50 text-sm">
							Interviewer: <span className="font-medium text-foreground/50">{interviewerData.name}</span>
						</div>
					)} */}

					<div>
						<label className="mb-1 block font-bold text-foreground text-lg">Observations & Notes</label>
						<InlineEdit
							textClassName="text-foreground"
							value={normalizeMultilineText(interview.observations_and_notes)}
							multiline
							markdown
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
						<div>
							<label className="mb-1 block font-bold text-lg">High Impact Themes</label>
							<InlineEdit
								textClassName="text-foreground"
								value={normalizeMultilineText(interview.high_impact_themes)}
								multiline
								markdown
								placeholder="High Impact Themes - biggest takeaways from the insights"
								onSubmit={(value) => {
									try {
										consola.info("🎨 Submitting high_impact_themes update:", {
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
												fieldName: "high_impact_themes",
												fieldValue: value,
											},
											{ method: "post", action: "/api/update-field" }
										)
									} catch (error) {
										consola.error("❌ Failed to update high_impact_themes:", error)
									}
								}}
							/>
						</div>
						
						<div>
							<label className="mb-1 block font-bold text-lg">Relevant Answers</label>
							<InlineEdit
								textClassName="text-foreground"
								value={normalizeMultilineText(interview.relevant_answers)}
								multiline
								markdown
								placeholder="Key answers relevant to business goals and research questions"
								onSubmit={(value) => {
									try {
										consola.info("📝 Submitting relevant_answers update:", {
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
												fieldName: "relevant_answers",
												fieldValue: value,
											},
											{ method: "post", action: "/api/update-field" }
										)
									} catch (error) {
										consola.error("❌ Failed to update relevant_answers:", error)
									}
								}}
							/>
						</div>
						{/* Removed Open Questions & Next Steps per request */}
					</div>

					{/* Evidence Section - Simplified Cards */}
					{evidence.length > 0 && (
						<div className="space-y-4">
							<h2 className="font-semibold text-foreground text-lg">Evidence ({evidence.length})</h2>
							<div className="grid gap-4 md:grid-cols-2">
								{evidence.map((evidenceItem) => (
									<div key={evidenceItem.id} className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-800">
										{/* Quote */}
										<blockquote className="mb-3 text-gray-900 dark:text-white">
											"{evidenceItem.verbatim}"
										</blockquote>
										
										{/* Tags */}
										{evidenceItem.kind_tags && evidenceItem.kind_tags.length > 0 && (
											<div className="flex flex-wrap gap-1">
												{evidenceItem.kind_tags.slice(0, 3).map((tag, index) => (
													<Badge key={index} variant="outline" className="text-xs">
														{tag}
													</Badge>
												))}
												{evidenceItem.kind_tags.length > 3 && (
													<Badge variant="outline" className="text-xs">
														+{evidenceItem.kind_tags.length - 3}
													</Badge>
												)}
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* Transcript Section */}
					<div>
						<div className="mb-4 flex items-center justify-between">
							<h3 className="font-semibold text-gray-900 text-lg">Transcript</h3>
							{interview.media_url && (
								<MediaPlayer
									mediaUrl={interview.media_url}
									title="Play Recording"
									size="sm"
									duration_sec={interview.duration_sec || undefined}
								/>
							)}
						</div>
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

						{/* Research Insights */}
						{insights.length > 0 && (
							<div className="rounded-lg border bg-background p-6">
								<h3 className="mb-4 font-semibold text-foreground">Research Insights ({insights.length})</h3>
								<div className="space-y-4">
									{insights.map((insight) => (
										<div key={insight.id} className="rounded-lg border bg-gray-50 p-4 dark:bg-gray-800">
											<div className="mb-3">
												<Link
													to={routes.insights.detail(insight.id)}
													className="font-semibold text-blue-600 hover:text-blue-800"
												>
													{insight.name}
												</Link>
												<div className="mt-1 flex flex-wrap gap-2">
													{insight.category && (
														<Badge variant="secondary" className="text-xs">
															{insight.category}
														</Badge>
													)}
													{(insight as any).assumption_alignment && (
														<Badge 
															variant={(insight as any).assumption_alignment === 'SUPPORTS' ? 'default' : 
																(insight as any).assumption_alignment === 'REFUTES' ? 'destructive' : 'outline'}
															className="text-xs"
														>
															{(insight as any).assumption_alignment}
														</Badge>
													)}
													{(insight as any).evidence_strength && (
														<Badge variant="outline" className="text-xs">
															{(insight as any).evidence_strength}
														</Badge>
													)}
												</div>
											</div>
											
											{/* Research Question Answered */}
											{(insight as any).research_question_answered && (
												<div className="mb-2 text-sm">
													<span className="font-medium text-green-700 dark:text-green-400">Answers:</span>
													<span className="ml-1 text-gray-700 dark:text-gray-300">{(insight as any).research_question_answered}</span>
												</div>
											)}
											
											{/* Product Implication */}
											{(insight as any).product_implication && (
												<div className="mb-2 text-sm">
													<span className="font-medium text-blue-700 dark:text-blue-400">Impact:</span>
													<span className="ml-1 text-gray-700 dark:text-gray-300">{(insight as any).product_implication}</span>
												</div>
											)}
											
											{/* Follow-up Questions */}
											{(insight as any).follow_up_questions && (
												<div className="text-sm">
													<span className="font-medium text-orange-700 dark:text-orange-400">Next:</span>
													<span className="ml-1 text-gray-700 dark:text-gray-300">{(insight as any).follow_up_questions}</span>
												</div>
											)}
										</div>
									))}
								</div>
							</div>
						)}

						{/* Metadata (compact) */}
						<div className="rounded-md border bg-background p-4">
							<h3 className="mb-2 font-semibold text-foreground text-sm uppercase tracking-wide">Metadata</h3>
							<div className="space-y-1 text-sm">
								<div>
									<span className="text-gray-500">Created:</span>{" "}
									<span className="text-foreground/70">{formatReadable(interview.created_at)}</span>
								</div>
								<div>
									<span className="text-gray-500">Created By:</span>{" "}
									<span className="text-foreground/70">{renderCreatedBy((interview as any).created_by, protectedData?.auth?.user)}</span>
								</div>
								{interview.updated_at && (
									<div>
										<span className="text-gray-500">Last Updated:</span>{" "}
										<span className="text-foreground/70">{formatReadable(interview.updated_at)}</span>
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
