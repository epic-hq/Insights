import consola from "consola"
import { Edit2, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData, useNavigation } from "react-router-dom"
import { BackButton } from "~/components/ui/BackButton"
import { Badge } from "~/components/ui/badge"
import InlineEdit from "~/components/ui/inline-edit"
import { MediaPlayer } from "~/components/ui/MediaPlayer"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { useCurrentProject } from "~/contexts/current-project-context"
import { PlayByPlayTimeline } from "~/features/evidence/components/ChronologicalEvidenceList"
import { EmpathyMapTabs } from "~/features/interviews/components/EmpathyMapTabs"
import { getInterviewById, getInterviewInsights, getInterviewParticipants } from "~/features/interviews/db"
import { MiniPersonCard } from "~/features/people/components/EnhancedPersonCard"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getSupabaseClient } from "~/lib/supabase/client"
import { userContext } from "~/server/user-context"
import { createR2PresignedUrl, getR2KeyFromPublicUrl } from "~/utils/r2.server"
import { LazyTranscriptResults } from "../components/LazyTranscriptResults"

// Normalize potentially awkwardly stored text fields (array, JSON string, or plain string)
function normalizeMultilineText(value: unknown): string {
	try {
		if (Array.isArray(value)) {
			const lines = value.filter((v) => typeof v === "string" && v.trim()) as string[]
			return lines
				.map((line) => {
					const t = (typeof line === "string" ? line : String(line)).trim()
					if (/^([-*+]|\d+\.)\s+/.test(t)) return t
					return `- ${t}`
				})
				.join("\n")
		}
		if (typeof value === "string") {
			// Try to parse stringified JSON arrays: "[\"a\",\"b\"]"
			const parsed = JSON.parse(value)
			if (Array.isArray(parsed)) {
				const lines = parsed.filter((v) => typeof v === "string" && v.trim()) as string[]
				return lines
					.map((line) => {
						const t = (typeof line === "string" ? line : String(line)).trim()
						if (/^([-*+]|\d+\.)\s+/.test(t)) return t
						return `- ${t}`
					})
					.join("\n")
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

export async function action({ context, params, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId
	const interviewId = params.interviewId

	if (!accountId || !projectId || !interviewId) {
		return Response.json({ ok: false, error: "Account, project, and interview are required" }, { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get("intent")?.toString()

	try {
		switch (intent) {
			case "assign-participant": {
				const interviewPersonId = formData.get("interviewPersonId")?.toString()
				if (!interviewPersonId) {
					return Response.json({ ok: false, error: "Missing participant identifier" }, { status: 400 })
				}
				const personId = formData.get("personId")?.toString()
				const role = formData.get("role")?.toString().trim() || null
				const transcriptKey = formData.get("transcriptKey")?.toString().trim() || null
				const displayName = formData.get("displayName")?.toString().trim() || null

				if (!personId) {
					const { error } = await supabase.from("interview_people").delete().eq("id", interviewPersonId)
					if (error) throw new Error(error.message)
					return Response.json({ ok: true, removed: true })
				}

				const { error } = await supabase
					.from("interview_people")
					.update({ person_id: personId, role, transcript_key: transcriptKey, display_name: displayName })
					.eq("id", interviewPersonId)

				if (error) throw new Error(error.message)
				return Response.json({ ok: true })
			}
			case "remove-participant": {
				const interviewPersonId = formData.get("interviewPersonId")?.toString()
				if (!interviewPersonId) {
					return Response.json({ ok: false, error: "Missing participant identifier" }, { status: 400 })
				}
				const { error } = await supabase.from("interview_people").delete().eq("id", interviewPersonId)
				if (error) throw new Error(error.message)
				return Response.json({ ok: true, removed: true })
			}
			case "add-participant": {
				const personId = formData.get("personId")?.toString()
				if (!personId) {
					return Response.json({ ok: false, error: "Select a person to add" }, { status: 400 })
				}
				const role = formData.get("role")?.toString().trim() || null
				const transcriptKey = formData.get("transcriptKey")?.toString().trim() || null
				const displayName = formData.get("displayName")?.toString().trim() || null
				const { error } = await supabase.from("interview_people").insert({
					interview_id: interviewId,
					project_id: projectId,
					person_id: personId,
					role,
					transcript_key: transcriptKey,
					display_name: displayName,
				})
				if (error) throw new Error(error.message)
				return Response.json({ ok: true, created: true })
			}
			default:
				return Response.json({ ok: false, error: "Unknown intent" }, { status: 400 })
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		consola.error("Participant action failed", message)
		return Response.json({ ok: false, error: message }, { status: 500 })
	}
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
		let participants: Array<{
			id: number
			role: string | null
			transcript_key: string | null
			display_name: string | null
			people?: { id?: string; name?: string | null; segment?: string | null }
		}> = []
		let primaryParticipant: { id?: string; name?: string | null; segment?: string | null } | null = null

		try {
			const { data: participantData } = await getInterviewParticipants({
				supabase,
				interviewId: interviewId,
			})

			participants = (participantData || []).map((row) => ({
				id: row.id,
				role: row.role ?? null,
				transcript_key: row.transcript_key ?? null,
				display_name: row.display_name ?? null,
				people: row.people,
			}))
			primaryParticipant = participants[0]?.people || null
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			throw new Response(`Error fetching participants: ${msg}`, { status: 500 })
		}

		const { data: peopleOptions, error: peopleError } = await supabase
			.from("people")
			.select("id, name, segment")
			.eq("project_id", projectId)
			.order("name", { ascending: true })

		if (peopleError) {
			consola.warn("Could not load people options for participant assignment:", peopleError.message)
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

		// Generate a fresh presigned URL for media access if needed
		let freshMediaUrl = interviewData.media_url
		if (interviewData.media_url) {
			try {
				// Extract the R2 key from the stored URL
				const r2Key = getR2KeyFromPublicUrl(interviewData.media_url)
				if (r2Key) {
					// Generate a fresh presigned URL (valid for 1 hour)
					const presignedResult = createR2PresignedUrl({
						key: r2Key,
						expiresInSeconds: 60 * 60, // 1 hour
					})
					if (presignedResult) {
						freshMediaUrl = presignedResult.url
					}
				}
			} catch (error) {
				consola.warn("Could not generate fresh presigned URL for media:", error)
				// Keep the original URL as fallback
			}
		}

		const interview = {
			...interviewData,
			media_url: freshMediaUrl, // Use fresh presigned URL
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
		type EmpathyMapItem = { text: string; evidenceId: string; anchors?: unknown }
		const empathyMap = {
			says: [] as EmpathyMapItem[],
			does: [] as EmpathyMapItem[],
			thinks: [] as EmpathyMapItem[],
			feels: [] as EmpathyMapItem[],
			pains: [] as EmpathyMapItem[],
			gains: [] as EmpathyMapItem[],
		}

		if (evidence) {
			evidence.forEach((e) => {
				const evidenceId = e.id

				// Process each empathy map category
				if (Array.isArray(e.says)) {
					e.says.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.says.push({ text: item.trim(), evidenceId, anchors: e.anchors })
						}
					})
				}

				if (Array.isArray(e.does)) {
					e.does.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.does.push({ text: item.trim(), evidenceId, anchors: e.anchors })
						}
					})
				}

				if (Array.isArray(e.thinks)) {
					e.thinks.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.thinks.push({ text: item.trim(), evidenceId, anchors: e.anchors })
						}
					})
				}

				if (Array.isArray(e.feels)) {
					e.feels.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.feels.push({ text: item.trim(), evidenceId, anchors: e.anchors })
						}
					})
				}

				if (Array.isArray(e.pains)) {
					e.pains.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.pains.push({ text: item.trim(), evidenceId, anchors: e.anchors })
						}
					})
				}

				if (Array.isArray(e.gains)) {
					e.gains.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.gains.push({ text: item.trim(), evidenceId, anchors: e.anchors })
						}
					})
				}
			})
		}

		// Deduplicate while preserving order and limit results
		const deduplicateAndLimit = (items: EmpathyMapItem[], limit = 8) => {
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

		// Fetch creator's name from user_settings
		let creatorName = "Unknown"
		if (interviewData.created_by) {
			const { data: creatorData } = await supabase
				.from("user_settings")
				.select("first_name, last_name, email")
				.eq("user_id", interviewData.created_by)
				.single()

			if (creatorData) {
				if (creatorData.first_name || creatorData.last_name) {
					creatorName = [creatorData.first_name, creatorData.last_name].filter(Boolean).join(" ")
				} else if (creatorData.email) {
					creatorName = creatorData.email
				}
			}
		}

		const loaderResult = {
			accountId,
			projectId,
			interview,
			insights,
			evidence: evidence || [],
			empathyMap,
			peopleOptions: peopleOptions || [],
			creatorName,
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
	const { accountId, projectId, interview, insights, evidence, empathyMap, peopleOptions, creatorName } =
		useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const participantFetcher = useFetcher()
	const navigation = useNavigation()
	const { accountId: contextAccountId, projectId: contextProjectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(`/a/${contextAccountId}/${contextProjectId}`)
	const [activeTab, setActiveTab] = useState<"pains-gains" | "user-actions">("pains-gains")
	const [isProcessing, setIsProcessing] = useState(false)

	// Helper to create evidence link with time parameter (like YouTube ?t=10)
	const createEvidenceLink = (item: { evidenceId: string; anchors?: unknown }) => {
		if (!item.anchors || !Array.isArray(item.anchors) || item.anchors.length === 0) {
			return routes.evidence.detail(item.evidenceId)
		}

		const anchor = item.anchors[0] as any
		const startTime = anchor?.start

		if (!startTime) {
			return routes.evidence.detail(item.evidenceId)
		}

		// Parse time to seconds for simple ?t=3.5 parameter
		let seconds = 0
		if (typeof startTime === "number") {
			seconds = startTime
		} else if (typeof startTime === "string") {
			if (startTime.endsWith("ms")) {
				seconds = Number.parseFloat(startTime.replace("ms", "")) / 1000
			} else if (startTime.includes(":")) {
				const parts = startTime.split(":")
				if (parts.length === 2) {
					seconds = Number.parseInt(parts[0], 10) * 60 + Number.parseInt(parts[1], 10)
				}
			} else {
				seconds = Number.parseFloat(startTime)
			}
		}

		return `${routes.evidence.detail(item.evidenceId)}?t=${seconds}`
	}

	// Check if any action is in progress
	const isActionPending = navigation.state === "loading" || navigation.state === "submitting"
	const isFetcherBusy = fetcher.state !== "idle" || participantFetcher.state !== "idle"

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
		<div className="relative mx-auto mt-6 max-w-6xl">
			{/* Loading Overlay */}
			{(isActionPending || isFetcherBusy || isProcessing) && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
					<div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
						<p className="font-medium text-sm">{isProcessing ? "Analyzing interview..." : "Processing..."}</p>
					</div>
				</div>
			)}

			<div className="mx-auto w-full max-w-7xl px-4 lg:flex lg:space-x-8 ">
				<div className="w-full space-y-6 lg:w-[calc(100%-20rem)]">
					{/* Streamlined Header */}
					<div className="mb-6 space-y-4">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex-1">
								<div className="mb-2 flex items-center gap-2 font-semibold text-2xl">
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
							<label className="mb-2 block font-semibold text-foreground text-lg">Notes</label>
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

					{/* Empathy Map Section */}
					<div className="space-y-4">
						<h3 className="font-semibold text-foreground text-lg">Empathy Map</h3>
						<EmpathyMapTabs
							empathyMap={empathyMap}
							activeTab={activeTab}
							setActiveTab={setActiveTab}
							createEvidenceLink={createEvidenceLink}
						/>
					</div>

					{/* Evidence Timeline Section */}
					{evidence.length > 0 ? <PlayByPlayTimeline evidence={evidence} className="mb-6" /> : <p>No evidence found</p>}

					{/* Transcript Section - Collapsed by default */}
					<h3 className="font-semibold text-foreground text-lg">Raw Recording Details</h3>

					{interview.media_url && (
						<div className="mb-4">
							<MediaPlayer
								mediaUrl={interview.media_url}
								title="Play Recording"
								size="sm"
								className="max-w-xs"
								duration_sec={interview.duration_sec || undefined}
							/>
						</div>
					)}

					<div className="mt-4">
						<LazyTranscriptResults
							interviewId={interview.id}
							hasTranscript={interview.hasTranscript}
							hasFormattedTranscript={interview.hasFormattedTranscript}
						/>
					</div>
				</div>
				<aside className="mt-8 w-full space-y-4 lg:mt-0 lg:w-80 lg:flex-shrink-0">
					<div className="space-y-4">
						{/* Evidence Summary */}
						{/* {evidence.length > 0 && (
							<div className="rounded-lg border bg-background p-4">
								<div className="mb-3 flex items-center justify-between">
									<h3 className="font-semibold text-foreground">Evidence</h3>
									<Badge variant="secondary" className="text-xs">
										{evidence.length}
									</Badge>
								</div>
								<div className="space-y-2">
									{evidence.slice(0, 4).map((evidenceItem) => (
										<Link
											key={evidenceItem.id}
											to={createEvidenceLink({ evidenceId: evidenceItem.id, anchors: evidenceItem.anchors })}
											className="block rounded-md border bg-muted/30 p-3 text-sm hover:bg-muted/50"
										>
											<div className="line-clamp-2 font-medium text-foreground">
												{evidenceItem.verbatim || evidenceItem.summary || "Evidence item"}
											</div>
											<div className="mt-1 flex items-center gap-2">
												{evidenceItem.support && (
													<Badge
														variant={evidenceItem.support === 'supports' ? 'default' : evidenceItem.support === 'refutes' ? 'destructive' : 'secondary'}
														className="text-xs"
													>
														{evidenceItem.support}
													</Badge>
												)}
												{evidenceItem.modality && (
													<Badge variant="outline" className="text-xs">
														{evidenceItem.modality}
													</Badge>
												)}
											</div>
										</Link>
									))}
									{evidence.length > 4 && (
										<Link
											to={routes.evidence.index()}
											className="block text-center text-muted-foreground text-xs hover:text-foreground"
										>
											+{evidence.length - 4} more evidence items
										</Link>
									)}
								</div>
							</div>
						)} */}

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

						{/* Participants Summary - Clean Display */}
						<div className="rounded-lg border bg-background p-4">
							<div className="mb-3 flex items-center justify-between">
								<h3 className="font-semibold text-foreground">Participants</h3>
								<Popover>
									<PopoverTrigger asChild>
										<button className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-accent">
											<Edit2 className="h-3 w-3" />
											Edit
										</button>
									</PopoverTrigger>
									<PopoverContent className="max-h-[600px] w-[500px] overflow-y-auto" align="end">
										<div className="space-y-4">
											<h4 className="font-semibold text-sm">Manage Participants</h4>

											{participants.length === 0 && (
												<p className="text-muted-foreground text-sm">No participants linked yet.</p>
											)}

											{participants.map((participant) => (
												<participantFetcher.Form
													key={participant.id}
													method="post"
													className="space-y-3 rounded border p-3"
												>
													<input type="hidden" name="interviewPersonId" value={participant.id} />
													<input type="hidden" name="transcriptKey" value={participant.transcript_key ?? ""} />

													<div className="space-y-2">
														<label className="text-muted-foreground text-xs uppercase tracking-wide">Person</label>
														<select
															name="personId"
															defaultValue={participant.people?.id ?? ""}
															className="w-full rounded-md border border-input bg-background p-2 text-sm"
														>
															<option value="">Unassigned</option>
															{peopleOptions.map((personOption) => (
																<option key={personOption.id} value={personOption.id}>
																	{personOption.name || "Unnamed"}
																</option>
															))}
														</select>
													</div>

													<div className="grid grid-cols-2 gap-2">
														<div className="space-y-1">
															<label className="text-muted-foreground text-xs uppercase tracking-wide">Role</label>
															<input
																name="role"
																type="text"
																defaultValue={participant.role ?? ""}
																placeholder="participant"
																className="w-full rounded-md border border-input bg-background p-2 text-sm"
															/>
														</div>
														<div className="space-y-1">
															<label className="text-muted-foreground text-xs uppercase tracking-wide">Speaker</label>
															<select
																name="transcriptKey"
																defaultValue={participant.transcript_key ?? ""}
																className="w-full rounded-md border border-input bg-background p-2 text-sm"
															>
																<option value="">None</option>
																<option value="A">A</option>
																<option value="B">B</option>
																<option value="C">C</option>
																<option value="D">D</option>
															</select>
														</div>
													</div>

													<div className="space-y-1">
														<label className="text-muted-foreground text-xs uppercase tracking-wide">
															Display Name (Optional)
														</label>
														<input
															name="displayName"
															type="text"
															defaultValue={participant.display_name ?? ""}
															placeholder="Override transcript label"
															className="w-full rounded-md border border-input bg-background p-2 text-sm"
														/>
													</div>

													<div className="flex items-center gap-2">
														<button
															type="submit"
															name="intent"
															value="assign-participant"
															className="flex-1 rounded-md border border-input px-3 py-1.5 font-medium text-sm hover:bg-accent"
														>
															Save
														</button>
														<button
															type="submit"
															name="intent"
															value="remove-participant"
															className="rounded-md px-3 py-1.5 text-red-600 text-sm hover:bg-red-50"
														>
															Remove
														</button>
													</div>
												</participantFetcher.Form>
											))}

											<div className="border-t pt-4">
												<participantFetcher.Form method="post" className="space-y-3">
													<h4 className="font-semibold text-sm">Add Participant</h4>

													<div className="space-y-2">
														<label className="text-muted-foreground text-xs uppercase tracking-wide">Person</label>
														<select
															name="personId"
															defaultValue=""
															className="w-full rounded-md border border-input bg-background p-2 text-sm"
														>
															<option value="">Select a person</option>
															{peopleOptions.map((personOption) => (
																<option key={personOption.id} value={personOption.id}>
																	{personOption.name || "Unnamed"}
																</option>
															))}
														</select>
													</div>

													<div className="grid grid-cols-2 gap-2">
														<div className="space-y-1">
															<label className="text-muted-foreground text-xs uppercase tracking-wide">Role</label>
															<input
																name="role"
																type="text"
																placeholder="participant"
																className="w-full rounded-md border border-input bg-background p-2 text-sm"
															/>
														</div>
														<div className="space-y-1">
															<label className="text-muted-foreground text-xs uppercase tracking-wide">Speaker</label>
															<select
																name="transcriptKey"
																defaultValue=""
																className="w-full rounded-md border border-input bg-background p-2 text-sm"
															>
																<option value="">None</option>
																<option value="A">A</option>
																<option value="B">B</option>
																<option value="C">C</option>
																<option value="D">D</option>
															</select>
														</div>
													</div>

													<div className="space-y-1">
														<label className="text-muted-foreground text-xs uppercase tracking-wide">
															Display Name (Optional)
														</label>
														<input
															name="displayName"
															type="text"
															placeholder="Override transcript label"
															className="w-full rounded-md border border-input bg-background p-2 text-sm"
														/>
													</div>

													<button
														type="submit"
														name="intent"
														value="add-participant"
														className="w-full rounded-md border border-input px-3 py-2 font-medium text-sm hover:bg-accent"
													>
														Add Participant
													</button>
												</participantFetcher.Form>
											</div>
										</div>
									</PopoverContent>
								</Popover>
							</div>

							{/* Clean participant list display */}
							<div className="space-y-2">
								{participants.length === 0 ? (
									<p className="text-muted-foreground text-sm">No participants linked yet.</p>
								) : (
									participants.map((participant) => {
										const personId = participant.people?.id
										const personName = participant.people?.name || participant.display_name || "Unassigned"
										const primaryPersona = participant.people?.people_personas?.[0]?.personas

										if (personId) {
											const evidenceQuery = new URLSearchParams({ person_id: personId })
											if (personName) evidenceQuery.set("person_name", personName)

											return (
												<div
													key={participant.id}
													className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 transition-colors hover:bg-muted/40"
												>
													<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
														<div>
															<Link
																to={routes.people.detail(personId)}
																className="font-medium text-foreground text-sm hover:underline"
															>
																{personName}
															</Link>
															{primaryPersona && (
																<div className="text-muted-foreground text-xs">{primaryPersona.name}</div>
															)}
														</div>
														<div className="flex items-center gap-2">
															<Link
																to={`${routes.evidence.index()}?${evidenceQuery.toString()}`}
																className="font-medium text-blue-600 text-xs hover:text-blue-800"
															>
																View evidence
															</Link>
															{participant.transcript_key && (
																<Badge variant="secondary" className="text-foreground/60 text-xs">
																	{participant.transcript_key}
																</Badge>
															)}
														</div>
													</div>
												</div>
											)
										}

										return (
											<div
												key={participant.id}
												className="flex items-center justify-between rounded-md border border-dashed bg-muted/20 p-3"
											>
												<div className="flex items-center gap-3">
													<div>
														<div className="font-medium text-muted-foreground text-sm">{personName}</div>
														<div className="text-muted-foreground text-xs">Not linked</div>
													</div>
												</div>
												{participant.transcript_key && (
													<Badge variant="outline" className="text-xs uppercase">
														Speaker {participant.transcript_key}
													</Badge>
												)}
											</div>
										)
									})
								)}
							</div>
						</div>

						{/* Essential Metadata */}
						<div className="rounded-lg border bg-background p-4">
							<h3 className="mb-3 font-semibold text-foreground">Details</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Created</span>
									<span className="text-foreground">{formatReadable(interview.created_at)}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Created By</span>
									<span className="text-foreground">{creatorName}</span>
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
