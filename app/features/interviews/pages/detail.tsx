import consola from "consola"
import { HeartHandshake, Puzzle } from "lucide-react"
import { useEffect, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData } from "react-router-dom"
import { BackButton } from "~/components/ui/BackButton"
import { Badge } from "~/components/ui/badge"
import InlineEdit from "~/components/ui/inline-edit"
import { MediaPlayer } from "~/components/ui/MediaPlayer"
import { useCurrentProject } from "~/contexts/current-project-context"
import { PlayByPlayTimeline } from "~/features/evidence/components/ChronologicalEvidenceList"
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
		params,
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
			title: interviewData.title,
		})

		// Fetch participant data separately to avoid junction table query issues
		let participants: Array<{ people?: { id?: string; name?: string | null; segment?: string | null } }> = []
		let primaryParticipant: { id?: string; name?: string | null; segment?: string | null } | null = null

		try {
			const { data: participantData } = await getInterviewParticipants({
				supabase,
				interviewId: interviewId,
			})

			participants = participantData || []
			primaryParticipant = participants[0]?.people || null
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

		// Process empathy map data in the loader for better performance
		const empathyMap = {
			says: [] as Array<{ text: string; evidenceId: string }>,
			does: [] as Array<{ text: string; evidenceId: string }>,
			thinks: [] as Array<{ text: string; evidenceId: string }>,
			feels: [] as Array<{ text: string; evidenceId: string }>,
			pains: [] as Array<{ text: string; evidenceId: string }>,
			gains: [] as Array<{ text: string; evidenceId: string }>,
		}

		if (evidence) {
			evidence.forEach((e) => {
				const evidenceId = e.id

				// Process each empathy map category
				if (Array.isArray(e.says)) {
					e.says.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.says.push({ text: item.trim(), evidenceId })
						}
					})
				}

				if (Array.isArray(e.does)) {
					e.does.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.does.push({ text: item.trim(), evidenceId })
						}
					})
				}

				if (Array.isArray(e.thinks)) {
					e.thinks.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.thinks.push({ text: item.trim(), evidenceId })
						}
					})
				}

				if (Array.isArray(e.feels)) {
					e.feels.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.feels.push({ text: item.trim(), evidenceId })
						}
					})
				}

				if (Array.isArray(e.pains)) {
					e.pains.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.pains.push({ text: item.trim(), evidenceId })
						}
					})
				}

				if (Array.isArray(e.gains)) {
					e.gains.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.gains.push({ text: item.trim(), evidenceId })
						}
					})
				}
			})
		}

		// Deduplicate while preserving order and limit results
		const deduplicateAndLimit = (items: Array<{ text: string; evidenceId: string }>, limit = 8) => {
			const seen = new Set<string>()
			return items
				.filter((item) => {
					if (seen.has(item.text)) return false
					seen.add(item.text)
					return true
				})
				.slice(0, limit)
		}

		empathyMap.says = deduplicateAndLimit(empathyMap.says)
		empathyMap.does = deduplicateAndLimit(empathyMap.does)
		empathyMap.thinks = deduplicateAndLimit(empathyMap.thinks)
		empathyMap.feels = deduplicateAndLimit(empathyMap.feels)
		empathyMap.pains = deduplicateAndLimit(empathyMap.pains)
		empathyMap.gains = deduplicateAndLimit(empathyMap.gains)

		const loaderResult = {
			accountId,
			projectId,
			interview,
			insights,
			evidence: evidence || [],
			empathyMap,
		}

		consola.info("✅ Loader completed successfully:", {
			accountId,
			projectId,
			interviewId: interview.id,
			insightsCount: insights?.length || 0,
			evidenceCount: evidence?.length || 0,
		})

		return loaderResult
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		consola.error("❌ Loader caught error:", error)
		consola.error("Error details:", {
			message: msg,
			accountId,
			projectId,
			interviewId,
		})
		throw new Response(`Failed to load interview: ${msg}`, { status: 500 })
	}
}

export default function InterviewDetail({ enableRecording = false }: { enableRecording?: boolean }) {
	const { accountId, projectId, interview, insights, evidence, empathyMap } = useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const [activeTab, setActiveTab] = useState<"pains-gains" | "user-actions">("pains-gains")

	// Always call hooks at the top level
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
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

	return (
		<div className="mx-auto max-w-6xl">
			<div className="mx-auto w-full max-w-7xl px-4 lg:flex lg:space-x-8">
				<div className="flex-1 space-y-6">
					{/* Streamlined Header */}
					<div className="mb-6 space-y-4">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex-1">
								<div className="mb-2 flex items-center gap-2 font-bold text-3xl leading-tight">
									<BackButton to={routes.interviews.index()} label="" position="relative" />
									{interview.title || "Untitled Interview"}
								</div>
								<div className="flex flex-wrap items-center gap-3">
									{/* Show participant from junction table if available, fallback to legacy field */}
									{primaryParticipant?.name ? (
										<MiniPersonCard
											person={{
												id: primaryParticipant.id || "",
												name: primaryParticipant.name,
												image_url: null,
												people_personas: [],
											}}
										/>
									) : (
										interview.participant_pseudonym && (
											<span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
												{interview.participant_pseudonym}
											</span>
										)
									)}
									<span className="text-muted-foreground text-sm">{formatReadable(interview.created_at)}</span>
								</div>
							</div>
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
									className="inline-flex items-center rounded-md border px-3 py-2 font-semibold text-sm shadow-sm hover:bg-gray-50"
								>
									Edit
								</Link>
							</div>
						</div>
					</div>

					{/* Tabbed Interface: Pains & Gains / User Actions */}
					{(empathyMap.pains.length > 0 ||
						empathyMap.gains.length > 0 ||
						empathyMap.says.length > 0 ||
						empathyMap.does.length > 0 ||
						empathyMap.thinks.length > 0 ||
						empathyMap.feels.length > 0) && (
							<div
							// className={`mb-8 rounded-xl border p-6 transition-all duration-300 ${activeTab === "pains-gains"
							// 	? "border-orange-200/50 bg-gradient-to-br from-red-50 to-green-50 dark:border-orange-800/20 dark:from-red-950/20 dark:to-green-950/20"
							// 	: "border-blue-200/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:border-blue-800/20 dark:from-blue-950/20 dark:to-indigo-950/20"
							// 	}`}
							>
								{/* Tab Navigation */}
								<div className="mb-6 flex space-x-1 rounded-lg bg-gray-100/50 p-1 dark:bg-gray-900/50">
									<button
										onClick={() => setActiveTab("pains-gains")}
										className={`flex-1 rounded-md px-3 py-2 font-medium text-sm transition-colors ${activeTab === "pains-gains"
											? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
											: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
											}`}
									>
										<div className="flex items-center justify-center gap-2">
											{/* <span>😣</span> */}
											<Puzzle className="h-5 w-5 text-accent" />
											<span>Pains & Goals</span>
											{/* <Badge variant="secondary" className="text-xs">
												{empathyMap.pains.length + empathyMap.gains.length}
											</Badge> */}
										</div>
									</button>
									<button
										onClick={() => setActiveTab("user-actions")}
										className={`flex-1 rounded-md px-3 py-2 font-medium text-sm transition-colors ${activeTab === "user-actions"
											? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
											: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
											}`}
									>
										<div className="flex items-center justify-center gap-2">
											<HeartHandshake className="h-5 w-5 text-accent" />
											<span>Empathy Map</span>
											{/* <Badge variant="secondary" className="text-xs">
												{empathyMap.says.length +
													empathyMap.does.length +
													empathyMap.thinks.length +
													empathyMap.feels.length}
											</Badge> */}
										</div>
									</button>
								</div>

								{/* Tab Content */}
								{activeTab === "pains-gains" && (
									<div className="grid gap-6 md:grid-cols-2">
										{/* Pains Column */}
										<div className="rounded-lg border border-red-200/50 bg-white/50 p-4 dark:border-red-800/30 dark:bg-black/10">
											<div className="mb-3 flex items-center gap-2">
												<span className="text-lg">😣</span>
												<div className="font-semibold text-foreground">Pain Points</div>
												<Badge variant="secondary" className="ml-auto text-xs">
													{empathyMap.pains.length}
												</Badge>
											</div>
											{empathyMap.pains.length === 0 ? (
												<div className="text-muted-foreground text-sm italic">No pain points identified</div>
											) : (
												<div className="space-y-2">
													{empathyMap.pains.map((item, i) => (
														<Link
															key={`pain-${item.evidenceId}-${i}`}
															to={routes.evidence.detail(item.evidenceId)}
															className="block w-full rounded-md bg-black/5 px-3 py-2 text-left text-foreground text-sm hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
														>
															{item.text}
														</Link>
													))}
												</div>
											)}
										</div>

										{/* Gains Column */}
										<div className="rounded-lg border border-green-200/50 bg-white/50 p-4 dark:border-green-800/30 dark:bg-black/10">
											<div className="mb-3 flex items-center gap-2">
												<span className="text-lg">🎯</span>
												<div className="font-semibold text-foreground">Goals</div>
												<Badge variant="secondary" className="ml-auto text-xs">
													{empathyMap.gains.length}
												</Badge>
											</div>
											{empathyMap.gains.length === 0 ? (
												<div className="text-muted-foreground text-sm italic">No gains identified</div>
											) : (
												<div className="space-y-2">
													{empathyMap.gains.map((item, i) => (
														<Link
															key={`gain-${item.evidenceId}-${i}`}
															to={routes.evidence.detail(item.evidenceId)}
															className="block w-full rounded-md bg-black/5 px-3 py-2 text-left text-foreground text-sm hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
														>
															{item.text}
														</Link>
													))}
												</div>
											)}
										</div>
									</div>
								)}

								{activeTab === "user-actions" && (
									<div className="space-y-4">
										{/* First Row: Says & Does */}
										<div className="grid gap-4 md:grid-cols-2">
											{/* Says Section */}
											<div className="rounded-lg border border-green-200/50 bg-white/50 p-4 dark:border-green-800/30 dark:bg-black/10">
												<div className="mb-3 flex items-center gap-2">
													<span className="text-lg">💬</span>
													<div className="font-semibold text-foreground">Says</div>
													<Badge variant="secondary" className="ml-auto text-xs">
														{empathyMap.says.length}
													</Badge>
												</div>
												{empathyMap.says.length === 0 ? (
													<div className="text-muted-foreground text-sm italic">No quotes captured</div>
												) : (
													<div className="space-y-2">
														{empathyMap.says.map((item, i) => (
															<Link
																key={`says-${item.evidenceId}-${i}`}
																to={routes.evidence.detail(item.evidenceId)}
																className="block w-full rounded-md bg-black/5 px-3 py-2 text-left text-foreground text-sm hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
															>
																"{item.text}"
															</Link>
														))}
													</div>
												)}
											</div>

											{/* Does Section */}
											<div className="rounded-lg border border-blue-200/50 bg-white/50 p-4 dark:border-blue-800/30 dark:bg-black/10">
												<div className="mb-3 flex items-center gap-2">
													<span className="text-lg">⚡</span>
													<div className="font-semibold text-foreground">Does</div>
													<Badge variant="secondary" className="ml-auto text-xs">
														{empathyMap.does.length}
													</Badge>
												</div>
												{empathyMap.does.length === 0 ? (
													<div className="text-muted-foreground text-sm italic">No behaviors captured</div>
												) : (
													<div className="space-y-2">
														{empathyMap.does.map((item, i) => (
															<Link
																key={`does-${item.evidenceId}-${i}`}
																to={routes.evidence.detail(item.evidenceId)}
																className="block w-full rounded-md bg-black/5 px-3 py-2 text-left text-foreground text-sm hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
															>
																{item.text}
															</Link>
														))}
													</div>
												)}
											</div>
										</div>

										{/* Second Row: Thinks & Feels */}
										<div className="grid gap-4 lg:grid-cols-2">
											{/* Thinks Section */}
											<div className="rounded-lg border border-purple-200/50 bg-white/50 p-4 dark:border-purple-800/30 dark:bg-black/10">
												<div className="mb-3 flex items-center gap-2">
													<span className="text-lg">💭</span>
													<div className="font-semibold text-foreground">Thinks</div>
													<Badge variant="secondary" className="ml-auto text-xs">
														{empathyMap.thinks.length}
													</Badge>
												</div>
												{empathyMap.thinks.length === 0 ? (
													<div className="text-muted-foreground text-sm italic">No thoughts captured</div>
												) : (
													<div className="space-y-2">
														{empathyMap.thinks.map((item, i) => (
															<Link
																key={`thinks-${item.evidenceId}-${i}`}
																to={routes.evidence.detail(item.evidenceId)}
																className="block w-full rounded-md bg-black/5 px-3 py-2 text-left text-foreground text-sm hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
															>
																{item.text}
															</Link>
														))}
													</div>
												)}
											</div>

											{/* Feels Section */}
											<div className="rounded-lg border border-yellow-200/50 bg-white/50 p-4 dark:border-yellow-800/30 dark:bg-black/10">
												<div className="mb-3 flex items-center gap-2">
													<span className="text-lg">❤️</span>
													<div className="font-semibold text-foreground">Feels</div>
													<Badge variant="secondary" className="ml-auto text-xs">
														{empathyMap.feels.length}
													</Badge>
												</div>
												{empathyMap.feels.length === 0 ? (
													<div className="text-muted-foreground text-sm italic">No emotions captured</div>
												) : (
													<div className="space-y-2">
														{empathyMap.feels.map((item, i) => (
															<Link
																key={`feels-${item.evidenceId}-${i}`}
																to={routes.evidence.detail(item.evidenceId)}
																className="block w-full rounded-md bg-black/5 px-3 py-2 text-left text-foreground text-sm hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
															>
																{item.text}
															</Link>
														))}
													</div>
												)}
											</div>
										</div>
									</div>
								)}
							</div>
						)}

					{/* Key Takeaways Section */}
					<div className="space-y-4">
						<div>
							<label className="mb-2 block font-semibold text-foreground text-lg">Key Takeaways</label>
							<InlineEdit
								textClassName="text-foreground"
								value={normalizeMultilineText(interview.high_impact_themes)}
								multiline
								markdown
								placeholder="What are the most important insights from this interview?"
								onSubmit={(value) => {
									try {
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
							<label className="mb-2 block font-semibold text-foreground text-lg">Research Notes</label>
							<InlineEdit
								textClassName="text-foreground"
								value={normalizeMultilineText(interview.observations_and_notes)}
								multiline
								markdown
								placeholder="Your observations and analysis notes"
								onSubmit={(value) => {
									try {
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
									}
								}}
							/>
						</div>
					</div>

					{/* Evidence Timeline Section */}
					{evidence.length > 0 && <PlayByPlayTimeline evidence={evidence} className="mb-6" />}

					{/* Transcript Section - Collapsed by default */}
					<h3 className="font-semibold text-foreground text-lg">Raw Recording Details</h3>

					<div className="flex items-center gap-2">
						{interview.media_url && (
							<MediaPlayer
								mediaUrl={interview.media_url}
								title="Play Recording"
								size="sm"
								duration_sec={interview.duration_sec || undefined}
							/>
						)}
						{/* <svg
							className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
						</svg> */}
					</div>

					<div className="mt-4">
						<LazyTranscriptResults
							interviewId={interview.id}
							hasTranscript={interview.hasTranscript}
							hasFormattedTranscript={interview.hasFormattedTranscript}
						/>
					</div>

				</div>
				<aside className="mt-8 w-full space-y-4 lg:mt-0 lg:max-w-sm">
					<div className="space-y-4">
						{/* Simplified Insights Summary */}
						{insights.length > 0 && (
							<div className="rounded-lg border bg-background p-4">
								<div className="mb-3 flex items-center justify-between">
									<h3 className="font-semibold text-foreground">Insights</h3>
									<Badge variant="secondary" className="text-xs">
										{insights.length}
									</Badge>
								</div>
								<div className="space-y-2">
									{insights.slice(0, 3).map((insight) => (
										<Link
											key={insight.id}
											to={routes.insights.detail(insight.id)}
											className="block rounded-md border bg-muted/30 p-3 text-sm hover:bg-muted/50"
										>
											<div className="font-medium text-foreground">{insight.name}</div>
											{insight.category && (
												<Badge variant="outline" className="mt-1 text-xs">
													{insight.category}
												</Badge>
											)}
										</Link>
									))}
									{insights.length > 3 && (
										<div className="text-center text-muted-foreground text-xs">
											+{insights.length - 3} more insights
										</div>
									)}
								</div>
							</div>
						)}

						{/* Participants Summary */}
						{participants.length > 0 && (
							<div className="rounded-lg border bg-background p-4">
								<h3 className="mb-3 font-semibold text-foreground">Participants</h3>
								<div className="space-y-2">
									{participants.map((participant) => (
										<div key={participant.people?.id || participant.people?.name} className="flex items-center gap-2">
											<div className="h-2 w-2 rounded-full bg-blue-500" />
											<div className="text-sm">
												<div className="font-medium text-foreground">{participant.people?.name || "Unknown"}</div>
												{participant.people?.segment && (
													<div className="text-muted-foreground text-xs">{participant.people.segment}</div>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Essential Metadata */}
						<div className="rounded-lg border bg-background p-4">
							<h3 className="mb-3 font-semibold text-foreground">Details</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Created</span>
									<span className="text-foreground">{formatReadable(interview.created_at)}</span>
								</div>
								{interview.duration_sec && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Duration</span>
										<span className="text-foreground">
											{Math.floor(interview.duration_sec / 60)}m {interview.duration_sec % 60}s
										</span>
									</div>
								)}
								{evidence.length > 0 && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Evidence</span>
										<span className="text-foreground">{evidence.length} points</span>
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
