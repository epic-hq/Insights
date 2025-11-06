import { useChat } from "@ai-sdk/react"
import { convertMessages } from "@mastra/core/agent"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import consola from "consola"
import { BotMessageSquare, Edit2, Loader2, MessageCircleQuestionIcon, MoreVertical, SparkleIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData, useNavigation, useRevalidator } from "react-router-dom"
import { Streamdown } from "streamdown"
import type { Database } from "~/../supabase/types"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import InlineEdit from "~/components/ui/inline-edit"
import { MediaPlayer } from "~/components/ui/MediaPlayer"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet"
import { Textarea } from "~/components/ui/textarea"
import { useCurrentProject } from "~/contexts/current-project-context"
import { PlayByPlayTimeline } from "~/features/evidence/components/ChronologicalEvidenceList"
import { getInterviewById, getInterviewInsights, getInterviewParticipants } from "~/features/interviews/db"
import { SalesLensesSection } from "~/features/lenses/components/ConversationLenses"
import { loadInterviewSalesLens } from "~/features/lenses/lib/interviewLens.server"
import type { InterviewLensView } from "~/features/lenses/types"
import { MiniPersonCard } from "~/features/people/components/EnhancedPersonCard"
import { useInterviewProgress } from "~/hooks/useInterviewProgress"
import { useProjectRoutes, useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
import { getSupabaseClient } from "~/lib/supabase/client"
import { cn } from "~/lib/utils"
import { memory } from "~/mastra/memory"
import type { UpsightMessage } from "~/mastra/message-types"
import { userContext } from "~/server/user-context"
import { createR2PresignedUrl, getR2KeyFromPublicUrl } from "~/utils/r2.server"
import { InterviewQuestionsAccordion } from "../components/InterviewQuestionsAccordion"
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

type AnalysisJobSummary = Pick<
	Database["public"]["Tables"]["analysis_jobs"]["Row"],
	"id" | "status" | "status_detail" | "progress" | "trigger_run_id" | "created_at" | "updated_at"
>

const ACTIVE_ANALYSIS_STATUSES = new Set<Database["public"]["Enums"]["job_status"]>(["pending", "in_progress", "retry"])
const TERMINAL_ANALYSIS_STATUSES = new Set<Database["public"]["Enums"]["job_status"]>(["done", "error"])

function toAnalysisJobSummary(row: Database["public"]["Tables"]["analysis_jobs"]["Row"]): AnalysisJobSummary {
	return {
		id: row.id,
		status: row.status,
		status_detail: row.status_detail,
		progress: row.progress,
		trigger_run_id: row.trigger_run_id,
		created_at: row.created_at,
		updated_at: row.updated_at,
	}
}

type ConversationAnalysisForDisplay = {
	summary: string | null
	keyTakeaways: Array<{
		priority: "high" | "medium" | "low"
		summary: string
		evidenceSnippets: string[]
	}>
	openQuestions: string[]
	recommendations: Array<{
		focusArea: string
		action: string
		rationale: string
	}>
	status: "pending" | "processing" | "completed" | "failed"
	updatedAt: string | null
	customLenses: Record<string, { summary?: string; notes?: string }>
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

				// Guard: ensure selected person belongs to this project
				const { data: personRow, error: personErr } = await supabase
					.from("people")
					.select("id, project_id")
					.eq("id", personId)
					.single()
				if (personErr || !personRow) {
					return Response.json({ ok: false, error: "Selected person not found" }, { status: 400 })
				}
				if (personRow.project_id !== projectId) {
					return Response.json({ ok: false, error: "Selected person belongs to a different project" }, { status: 400 })
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

				// Guard: ensure selected person belongs to this project
				const { data: personRow, error: personErr } = await supabase
					.from("people")
					.select("id, project_id")
					.eq("id", personId)
					.single()
				if (personErr || !personRow) {
					return Response.json({ ok: false, error: "Selected person not found" }, { status: 400 })
				}
				if (personRow.project_id !== projectId) {
					return Response.json({ ok: false, error: "Selected person belongs to a different project" }, { status: 400 })
				}

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

	// consola.info("🔍 Interview Detail Loader Started:", {
	// 	accountId,
	// 	projectId,
	// 	interviewId,
	// 	params,
	// })

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
			consola.error("❌ Interview not found (RLS filtered):", { interviewId, projectId, accountId })
			throw new Response("Interview not found", { status: 404 })
		}

		consola.info("✅ Interview data fetched successfully:", {
			interviewId: interviewData.id,
			title: interviewData.title,
		})

		const conversationAnalysis = (() => {
			const raw = interviewData.conversation_analysis as Record<string, unknown> | null | undefined
			if (!raw || typeof raw !== "object") return null

			const parseStringArray = (value: unknown): string[] => {
				if (!Array.isArray(value)) return []
				return value
					.map((item) => (typeof item === "string" ? item.trim() : null))
					.filter((item): item is string => Boolean(item && item.length > 0))
			}

			const parseKeyTakeaways = (): ConversationAnalysisForDisplay["keyTakeaways"] => {
				const value = raw.key_takeaways as unknown
				if (!Array.isArray(value)) return []
				return value
					.map((item) => {
						if (!item || typeof item !== "object") return null
						const entry = item as { [key: string]: unknown }
						const summary = typeof entry.summary === "string" ? entry.summary.trim() : ""
						if (!summary) return null
						const priority =
							entry.priority === "high" || entry.priority === "medium" || entry.priority === "low"
								? entry.priority
								: "medium"
						const evidenceSnippets = parseStringArray(entry.evidence_snippets)
						return { priority, summary, evidenceSnippets }
					})
					.filter(
						(item): item is { priority: "high" | "medium" | "low"; summary: string; evidenceSnippets: string[] } =>
							item !== null
					)
			}

			const parseRecommendations = (): ConversationAnalysisForDisplay["recommendations"] => {
				const value = raw.recommended_next_steps as unknown
				if (!Array.isArray(value)) return []
				return value
					.map((item) => {
						if (!item || typeof item !== "object") return null
						const entry = item as { [key: string]: unknown }
						const focusArea = typeof entry.focus_area === "string" ? entry.focus_area.trim() : ""
						const action = typeof entry.action === "string" ? entry.action.trim() : ""
						const rationale = typeof entry.rationale === "string" ? entry.rationale.trim() : ""
						if (!focusArea && !action && !rationale) return null
						return { focusArea, action, rationale }
					})
					.filter((item): item is { focusArea: string; action: string; rationale: string } => item !== null)
			}

			const parseCustomLenses = (): ConversationAnalysisForDisplay["customLenses"] => {
				const value = raw.custom_lenses as unknown
				if (!value || typeof value !== "object") return {}
				const entries = Object.entries(value as Record<string, unknown>).reduce(
					(acc, [key, data]) => {
						if (!data || typeof data !== "object") return acc
						const entry = data as { [field: string]: unknown }
						const summary = typeof entry.summary === "string" ? entry.summary : undefined
						const notes = typeof entry.notes === "string" ? entry.notes : undefined
						acc[key] = {}
						if (summary) acc[key].summary = summary
						if (notes) acc[key].notes = notes
						return acc
					},
					{} as Record<string, { summary?: string; notes?: string }>
				)
				return entries
			}

			return {
				summary: typeof raw.overview === "string" ? raw.overview : null,
				keyTakeaways: parseKeyTakeaways(),
				openQuestions: parseStringArray(raw.open_questions),
				recommendations: parseRecommendations(),
				status: "completed" as const,
				updatedAt: interviewData.updated_at,
				customLenses: parseCustomLenses(),
			}
		})()

		// Fetch participant data separately to avoid junction table query issues
		let participants: Array<{
			id: number
			role: string | null
			transcript_key: string | null
			display_name: string | null
			cross_project?: boolean
			people?: {
				id?: string
				name?: string | null
				segment?: string | null
				project_id?: string | null
				people_personas?: Array<{ personas?: { id?: string; name?: string | null } | null }>
			}
		}> = []
		let primaryParticipant: {
			id?: string
			name?: string | null
			segment?: string | null
			project_id?: string | null
		} | null = null

		try {
			const { data: participantData } = await getInterviewParticipants({
				supabase,
				projectId,
				interviewId: interviewId,
			})

			participants = (participantData || []).map((row) => {
				const person = row.people as
					| {
						id: string
						name: string | null
						segment: string | null
						project_id: string | null
						people_personas?: Array<{ personas?: { id?: string; name?: string | null } | null }>
						[key: string]: unknown
					}
					| undefined
				const valid = !!person && person.project_id === projectId
				const minimal = person
					? {
						id: person.id,
						name: person.name,
						segment: person.segment,
						project_id: person.project_id,
						people_personas: Array.isArray(person.people_personas)
							? person.people_personas.map((pp) => ({
								personas: pp?.personas ? { id: pp.personas.id, name: pp.personas.name } : null,
							}))
							: undefined,
					}
					: undefined
				return {
					id: row.id,
					role: row.role ?? null,
					transcript_key: row.transcript_key ?? null,
					display_name: row.display_name ?? null,
					people: valid ? minimal : undefined,
					cross_project: !!person && !valid,
				}
			})
			{
				const found = participants.find((p) => p.people)?.people
				primaryParticipant = found ?? null
			}
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

		const peopleLookup = new Map<string, { name: string | null }>()
		for (const option of peopleOptions ?? []) {
			if (option?.id) {
				peopleLookup.set(option.id, { name: option.name ?? null })
			}
		}
		for (const participant of participants) {
			const person = participant.people
			if (person?.id) {
				peopleLookup.set(person.id, { name: person.name ?? null })
			}
		}
		if (primaryParticipant?.id) {
			peopleLookup.set(primaryParticipant.id, { name: primaryParticipant.name ?? null })
		}

		let salesLens: InterviewLensView | null = null
		try {
			if (supabase) {
				salesLens = await loadInterviewSalesLens({
					db: supabase,
					projectId,
					interviewId,
					peopleLookup,
				})
			}
		} catch (error) {
			consola.warn("Failed to load sales lens for interview", { interviewId, error })
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
			hasTranscript: transcriptMeta?.transcript,
			hasFormattedTranscript: transcriptMeta?.transcript_formatted,
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

		const { data: analysisJobRows, error: analysisJobError } = await supabase
			.from("analysis_jobs")
			.select("id, status, status_detail, progress, trigger_run_id, created_at, updated_at")
			.eq("interview_id", interviewId)
			.order("created_at", { ascending: false })
			.limit(1)

		if (analysisJobError) {
			consola.warn("Could not load latest analysis job:", analysisJobError.message)
		}

		const analysisJob = (analysisJobRows?.[0] ?? null) as AnalysisJobSummary | null

		// Fetch insights related to this interview with junction table tags
		const { data: insights, error } = await getInterviewInsights({
			supabase,
			interviewId: interviewId,
		})

		if (error) {
			const msg = error instanceof Error ? error.message : String(error)
			throw new Response(`Error fetching insights: ${msg}`, { status: 500 })
		}

		// Fetch evidence related to this interview with person associations
		const { data: evidence, error: evidenceError } = await supabase
			.from("evidence")
			.select(`
				*,
				evidence_people (
					person_id,
					role,
					people (
						id,
						name,
						segment
					)
				)
			`)
			.eq("interview_id", interviewId)
			.order("created_at", { ascending: false })

		if (evidenceError) {
			consola.warn("Could not fetch evidence:", evidenceError.message)
		}

		// Process empathy map data in the loader for better performance
		type EmpathyMapItem = {
			text: string
			evidenceId: string
			anchors?: unknown
			personId?: string
			personName?: string
		}
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
				// Extract person info from evidence_people junction
				const personData =
					Array.isArray(e.evidence_people) && e.evidence_people.length > 0 ? e.evidence_people[0] : null
				const personId = personData?.people?.id
				const personName = personData?.people?.name

				// Process each empathy map category
				if (Array.isArray(e.says)) {
					e.says.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.says.push({ text: item.trim(), evidenceId, anchors: e.anchors, personId, personName })
						}
					})
				}

				if (Array.isArray(e.does)) {
					e.does.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.does.push({ text: item.trim(), evidenceId, anchors: e.anchors, personId, personName })
						}
					})
				}

				if (Array.isArray(e.thinks)) {
					e.thinks.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.thinks.push({ text: item.trim(), evidenceId, anchors: e.anchors, personId, personName })
						}
					})
				}

				if (Array.isArray(e.feels)) {
					e.feels.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.feels.push({ text: item.trim(), evidenceId, anchors: e.anchors, personId, personName })
						}
					})
				}

				if (Array.isArray(e.pains)) {
					e.pains.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.pains.push({ text: item.trim(), evidenceId, anchors: e.anchors, personId, personName })
						}
					})
				}

				if (Array.isArray(e.gains)) {
					e.gains.forEach((item: string) => {
						if (typeof item === "string" && item.trim()) {
							empathyMap.gains.push({ text: item.trim(), evidenceId, anchors: e.anchors, personId, personName })
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

		let assistantMessages: UpsightMessage[] = []
		const userId = ctx.claims.sub
		if (userId) {
			const resourceId = `interviewStatusAgent-${userId}-${interviewId}`
			try {
				const threads = await memory.getThreadsByResourceIdPaginated({
					resourceId,
					orderBy: "createdAt",
					sortDirection: "DESC",
					page: 0,
					perPage: 1,
				})
				const threadId = threads?.threads?.[0]?.id
				if (threadId) {
					const { messagesV2 } = await memory.query({
						threadId,
						selectBy: { last: 50 },
					})
					assistantMessages = convertMessages(messagesV2).to("AIV5.UI") as UpsightMessage[]
				}
			} catch (error) {
				consola.warn("Failed to load assistant history", { resourceId, error })
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
			analysisJob,
			assistantMessages,
			conversationAnalysis,
			salesLens,
		}

		consola.info("✅ Loader completed successfully:", {
			accountId,
			projectId,
			interviewId: interview.id,
			insightsCount: insights?.length || 0,
			evidenceCount: evidence?.length || 0,
			assistantMessages: assistantMessages.length,
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
	const {
		accountId,
		projectId,
		interview,
		insights,
		evidence,
		empathyMap,
		peopleOptions,
		creatorName,
		analysisJob,
		assistantMessages,
		conversationAnalysis,
		salesLens,
	} = useLoaderData<typeof loader>()

	// Early validation - must happen before any hooks
	if (!interview || !accountId || !projectId) {
		return <div>Error: Missing interview data</div>
	}

	const fetcher = useFetcher()
	const participantFetcher = useFetcher()
	const lensFetcher = useFetcher()
	const navigation = useNavigation()
	const { accountId: contextAccountId, projectId: contextProjectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(`/a/${contextAccountId}/${contextProjectId}`)
	const { isEnabled: salesCrmEnabled } = usePostHogFeatureFlag("ffSalesCRM")
	const [analysisState, setAnalysisState] = useState<AnalysisJobSummary | null>(analysisJob)
	const [triggerAuth, setTriggerAuth] = useState<{ runId: string; token: string } | null>(null)
	const [tokenErrorRunId, setTokenErrorRunId] = useState<string | null>(null)
	const [customLensOverrides, setCustomLensOverrides] = useState<Record<string, { summary?: string; notes?: string }>>(
		conversationAnalysis?.customLenses ?? {}
	)
	const [isChatOpen, setIsChatOpen] = useState(() => assistantMessages.length > 0)

	const activeRunId = analysisState?.trigger_run_id ?? null
	const triggerAccessToken = triggerAuth?.runId === activeRunId ? triggerAuth.token : undefined

	const { progressInfo, isRealtime } = useInterviewProgress({
		interviewId: interview.id,
		runId: activeRunId ?? undefined,
		accessToken: triggerAccessToken,
	})
	const progressPercent = Math.min(100, Math.max(0, progressInfo.progress))

	const revalidator = useRevalidator()
	const refreshTriggeredRef = useRef(false)

	// Helper function for date formatting
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

	// Extract data needed for memoized computations
	const participants = interview.participants || []
	const interviewTitle = interview.title || "Untitled Interview"
	const primaryParticipant = participants[0]?.people
	const aiKeyTakeaways = conversationAnalysis?.keyTakeaways ?? []
	const conversationUpdatedLabel =
		conversationAnalysis?.updatedAt && !Number.isNaN(new Date(conversationAnalysis.updatedAt).getTime())
			? formatReadable(conversationAnalysis.updatedAt)
			: null

	// Derived state for processing status
	const isProcessing = analysisState ? ACTIVE_ANALYSIS_STATUSES.has(analysisState.status) : false
	const showProcessingBanner = isProcessing

	// Move all useMemo and useEffect hooks to the top
	const keyTakeawaysDraft = useMemo(
		() => normalizeMultilineText(interview.high_impact_themes).trim(),
		[interview.high_impact_themes]
	)
	const notesDraft = useMemo(
		() => normalizeMultilineText(interview.observations_and_notes).trim(),
		[interview.observations_and_notes]
	)
	const personalFacetSummary = useMemo(() => {
		if (!participants.length) return ""

		const lines = participants
			.map((participant) => {
				const person =
					(participant.people as {
						name?: string | null
						segment?: string | null
						people_personas?: Array<{ personas?: { name?: string | null } | null }>
					} | null) || null
				const personaNames = Array.from(
					new Set(
						(person?.people_personas || [])
							.map((entry) => entry?.personas?.name)
							.filter((name): name is string => typeof name === "string" && name.trim())
					)
				)

				const facets: string[] = []
				if (participant.role) facets.push(`Role: ${participant.role}`)
				if (person?.segment) facets.push(`Segment: ${person.segment}`)
				if (personaNames.length > 0) facets.push(`Personas: ${personaNames.join(", ")}`)

				const displayName =
					person?.name ||
					participant.display_name ||
					(participant.transcript_key ? `Speaker ${participant.transcript_key}` : null)

				if (!displayName && facets.length === 0) {
					return null
				}

				return `- ${(displayName || "Participant").trim()}${facets.length ? ` (${facets.join("; ")})` : ""}`
			})
			.filter((line): line is string => Boolean(line))

		return lines.slice(0, 8).join("\n")
	}, [participants])

	const interviewSystemContext = useMemo(() => {
		const sections: string[] = []
		sections.push(`Interview title: ${interviewTitle}`)
		if (interview.segment) sections.push(`Target segment: ${interview.segment}`)
		if (keyTakeawaysDraft) sections.push(`Key takeaways draft:\n${keyTakeawaysDraft}`)
		if (personalFacetSummary) sections.push(`Personal facets:\n${personalFacetSummary}`)
		if (notesDraft) sections.push(`Notes:\n${notesDraft}`)

		const combined = sections.filter(Boolean).join("\n\n")
		if (combined.length > 2000) {
			return `${combined.slice(0, 2000)}…`
		}

		return combined
	}, [interviewTitle, interview.segment, keyTakeawaysDraft, personalFacetSummary, notesDraft])

	const initialInterviewPrompt =
		"Summarize the key takeaways from this interview and list 2 next steps that consider the participant's personal facets."
	const hasAnalysisError = analysisState ? analysisState.status === "error" : false
	const formatStatusLabel = (status: string) =>
		status
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ")
	const analysisStatusLabel = analysisState?.status ? formatStatusLabel(analysisState.status) : null
	const analysisStatusTone = analysisState?.status
		? ACTIVE_ANALYSIS_STATUSES.has(analysisState.status)
			? "bg-primary/10 text-primary"
			: analysisState.status === "error"
				? "bg-destructive/10 text-destructive"
				: "bg-muted text-muted-foreground"
		: ""

	const uniqueSpeakers = useMemo(() => {
		const speakerMap = new Map<string, { id: string; name: string; count: number }>()

		// Collect all speakers from empathy map items
		const allItems = [
			...empathyMap.says,
			...empathyMap.does,
			...empathyMap.thinks,
			...empathyMap.feels,
			...empathyMap.pains,
			...empathyMap.gains,
		]

		allItems.forEach((item) => {
			if (item.personId && item.personName) {
				const existing = speakerMap.get(item.personId)
				if (existing) {
					existing.count++
				} else {
					speakerMap.set(item.personId, {
						id: item.personId,
						name: item.personName,
						count: 1,
					})
				}
			}
		})

		// Sort by count (most evidence first), then by name
		return Array.from(speakerMap.values()).sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count
			return a.name.localeCompare(b.name)
		})
	}, [empathyMap])

	const personLenses = useMemo(() => {
		return uniqueSpeakers.map((speaker) => {
			const filterByPerson = (items: typeof empathyMap.says) => {
				return items.filter((item) => item.personId === speaker.id).map((item) => item.text)
			}

			return {
				id: speaker.id,
				name: speaker.name,
				painsAndGoals: {
					pains: filterByPerson(empathyMap.pains),
					gains: filterByPerson(empathyMap.gains),
				},
				empathyMap: {
					says: filterByPerson(empathyMap.says),
					does: filterByPerson(empathyMap.does),
					thinks: filterByPerson(empathyMap.thinks),
					feels: filterByPerson(empathyMap.feels),
				},
			}
		})
	}, [uniqueSpeakers, empathyMap])


	const customLensDefaults = useMemo<Record<string, { summary?: string; notes?: string; highlights?: string[] }>>(() => {
		const firstNonEmpty = (...values: Array<string | null | undefined>) => {
			for (const value of values) {
				if (typeof value === "string" && value.trim().length > 0) return value.trim()
			}
			return undefined
		}

		const highImpactThemes = Array.isArray(interview.high_impact_themes)
			? (interview.high_impact_themes as string[]).filter((item) => typeof item === "string" && item.trim().length > 0)
			: []

		const engineeringRecommendation = (conversationAnalysis?.recommendations ?? []).find((rec) =>
			/(tech|engineering|product|integration)/i.test(`${rec.focusArea} ${rec.action} ${rec.rationale}`)
		)

		const empathyPains = empathyMap.pains.map((item) => item.text).filter((text): text is string => Boolean(text?.trim()))
		const empathyFeels = empathyMap.feels.map((item) => item.text).filter((text): text is string => Boolean(text?.trim()))
		const empathyGains = empathyMap.gains.map((item) => item.text).filter((text): text is string => Boolean(text?.trim()))

		const openQuestions = (conversationAnalysis?.openQuestions ?? []).filter((item) => item && item.trim().length > 0)
		const nervousTakeaway = conversationAnalysis?.keyTakeaways.find((takeaway) => takeaway.priority === "low")

		return {
			productImpact: {
				summary: firstNonEmpty(
					highImpactThemes[0],
					engineeringRecommendation?.action,
					conversationAnalysis?.keyTakeaways.find((takeaway) => takeaway.priority === "high")?.summary
				),
				notes: firstNonEmpty(
					engineeringRecommendation
						? `${engineeringRecommendation.focusArea}: ${engineeringRecommendation.action}`
						: undefined,
					interview.observations_and_notes ?? undefined
				),
				highlights: highImpactThemes.slice(0, 4),
			},
			customerService: {
				summary: firstNonEmpty(empathyPains[0], empathyGains[0], conversationAnalysis?.summary ?? undefined),
				notes: firstNonEmpty(empathyFeels[0], empathyGains[1]),
				highlights: empathyPains.slice(0, 4),
			},
			pessimistic: {
				summary: firstNonEmpty(openQuestions[0], interview.open_questions_and_next_steps ?? undefined),
				notes: firstNonEmpty(openQuestions[1], nervousTakeaway?.summary),
				highlights: openQuestions.slice(0, 4),
			},
		}
	}, [
		conversationAnalysis?.keyTakeaways,
		conversationAnalysis?.openQuestions,
		conversationAnalysis?.recommendations,
		conversationAnalysis?.summary,
		empathyMap.feels,
		empathyMap.gains,
		empathyMap.pains,
		interview.high_impact_themes,
		interview.observations_and_notes,
		interview.open_questions_and_next_steps,
	])

	useEffect(() => {
		setCustomLensOverrides(conversationAnalysis?.customLenses ?? {})
	}, [conversationAnalysis?.customLenses])

	useEffect(() => {
		setAnalysisState(analysisJob)
		// Reset trigger auth when navigating to a different interview or run
		if (!analysisJob?.trigger_run_id) {
			setTriggerAuth(null)
			setTokenErrorRunId(null)
		}
	}, [analysisJob])


	// Check if any action is in progress
	const isActionPending = navigation.state === "loading" || navigation.state === "submitting"
	const isFetcherBusy = fetcher.state !== "idle" || participantFetcher.state !== "idle"
	const showBlockingOverlay = isActionPending || isFetcherBusy
	const overlayLabel =
		navigation.state === "loading"
			? "Loading interview..."
			: navigation.state === "submitting" || isFetcherBusy
				? "Saving changes..."
				: "Processing..."

	useEffect(() => {
		if (!interview?.id) return

		const supabase = getSupabaseClient()
		const channel = supabase
			.channel(`analysis-${interview.id}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "analysis_jobs", filter: `interview_id=eq.${interview.id}` },
				(payload) => {
					const raw = (payload as { new?: Database["public"]["Tables"]["analysis_jobs"]["Row"] }).new
					if (!raw) return

					setAnalysisState((prev) => {
						const nextSummary = toAnalysisJobSummary(raw)
						if (!prev) {
							return nextSummary
						}

						const prevCreated = prev.created_at ? new Date(prev.created_at).getTime() : 0
						const nextCreated = nextSummary.created_at ? new Date(nextSummary.created_at).getTime() : 0

						if (raw.id === prev.id || nextCreated >= prevCreated) {
							return nextSummary
						}

						return prev
					})
				}
			)
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [interview.id])

	useEffect(() => {
		if (!analysisState?.trigger_run_id) return
		if (!triggerAuth?.runId) return
		if (analysisState.trigger_run_id === triggerAuth.runId) return

		setTriggerAuth(null)
		setTokenErrorRunId(null)
	}, [analysisState?.trigger_run_id, triggerAuth?.runId])

	useEffect(() => {
		const runId = analysisState?.trigger_run_id ?? null
		const status = analysisState?.status

		if (!runId || !status) {
			setTriggerAuth(null)
			setTokenErrorRunId(null)
			return
		}

		if (TERMINAL_ANALYSIS_STATUSES.has(status)) {
			setTriggerAuth(null)
			setTokenErrorRunId(null)
			return
		}

		if (triggerAuth?.runId === runId) {
			return
		}

		if (tokenErrorRunId === runId) {
			return
		}

		let isCancelled = false

		const fetchToken = async () => {
			try {
				const response = await fetch("/api/trigger-run-token", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ runId }),
					credentials: "same-origin",
				})

				if (!response.ok) {
					throw new Error(`Failed to fetch Trigger.dev token (${response.status})`)
				}

				const data = (await response.json()) as { token?: string }

				if (!isCancelled && data?.token) {
					setTriggerAuth({ runId, token: data.token })
					setTokenErrorRunId(null)
				}
			} catch (error) {
				consola.warn("Failed to fetch Trigger.dev access token", error)
				if (!isCancelled) {
					setTriggerAuth(null)
					setTokenErrorRunId(runId)
				}
			}
		}

		fetchToken()

		return () => {
			isCancelled = true
		}
	}, [analysisState?.trigger_run_id, analysisState?.status, triggerAuth?.runId, tokenErrorRunId])

	const badgeStylesForPriority = (
		priority: "high" | "medium" | "low"
	): {
		variant: "default" | "secondary" | "destructive" | "outline"
		color?: "blue" | "green" | "red" | "purple" | "yellow" | "orange" | "indigo"
	} => {
		switch (priority) {
			case "high":
				return { variant: "destructive", color: "red" }
			case "medium":
				return { variant: "secondary", color: "orange" }
			default:
				return { variant: "outline", color: "green" }
		}
	}

	useEffect(() => {
		if (!progressInfo.isComplete) {
			refreshTriggeredRef.current = false
			return
		}

		if (!refreshTriggeredRef.current) {
			refreshTriggeredRef.current = true
			revalidator.revalidate()
		}
	}, [progressInfo.isComplete, revalidator])

	const handleCustomLensUpdate = (lensId: string, field: "summary" | "notes", value: string) => {
		setCustomLensOverrides((prev) => ({
			...prev,
			[lensId]: {
				...(prev[lensId] ?? {}),
				[field]: value,
			},
		}))

		if (!interview?.id) return

		try {
			lensFetcher.submit(
				{
					interviewId: interview.id,
					projectId,
					accountId,
					lensId,
					field,
					value,
				},
				{ method: "post", action: "/api/update-lens" }
			)
		} catch (error) {
			consola.error("Failed to update custom lens", error)
		}
	}

	const activeLensUpdateId =
		lensFetcher.state !== "idle" && lensFetcher.formData
			? lensFetcher.formData.get("lensId")?.toString() ?? null
			: null

	return (
		<div className="relative mx-auto mt-6 max-w-6xl">
			{/* <InterviewCopilotDrawer
				open={isChatOpen}
				onOpenChange={setIsChatOpen}
				accountId={accountId}
				projectId={projectId}
				interviewId={interview.id}
				interviewTitle={interviewTitle}
				systemContext={interviewSystemContext}
				initialPrompt={initialInterviewPrompt}
			/> */}
			{/* Loading Overlay */}
			{showBlockingOverlay && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
					<div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
						<p className="font-medium text-sm">{overlayLabel}</p>
					</div>
				</div>
			)}

			<div className="mx-auto w-full max-w-7xl px-4 lg:flex lg:space-x-8">
				<div className="w-full space-y-6 lg:w-[calc(100%-20rem)]">
					{showProcessingBanner && (
						<div className="rounded-lg border border-primary/40 bg-primary/5 p-4 shadow-sm">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<p className="font-semibold text-primary text-xs uppercase tracking-wide">Analysis in progress</p>
									<p className="text-muted-foreground text-sm">{analysisState?.status_detail || progressInfo.label}</p>
								</div>
								<div className="flex flex-col items-end gap-2">
									<div className="flex items-center gap-3">
										<div className="relative h-2 w-40 overflow-hidden rounded-full bg-muted">
											<div
												className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out"
												style={{ width: `${progressPercent}%` }}
											/>
										</div>
										<span className="font-medium text-primary text-sm">{progressPercent}%</span>
									</div>
									{analysisState?.trigger_run_id && (
										<button
											type="button"
											onClick={() => {
												if (confirm("Are you sure you want to cancel this analysis? This action cannot be undone.")) {
													try {
														fetcher.submit(
															{ runId: analysisState.trigger_run_id, analysisJobId: analysisState.id },
															{ method: "post", action: "/api.cancel-analysis-run" }
														)
													} catch (e) {
														consola.error("Cancel analysis submit failed", e)
													}
												}
											}}
											disabled={fetcher.state !== "idle"}
											className="inline-flex items-center gap-2 border border-red-500/20 bg-red-50 px-3 py-1.5 font-medium text-red-700 text-xs hover:bg-red-100 disabled:opacity-60"
										>
											{fetcher.state !== "idle" ? "Cancelling..." : "Cancel"}
										</button>
									)}
								</div>
							</div>
							{isRealtime ? (
								<p className="mt-2 text-muted-foreground text-xs">&nbsp;</p>
							) : tokenErrorRunId === activeRunId ? (
								<p className="mt-2 text-muted-foreground text-xs">
									Live updates temporarily unavailable; showing interview status.
								</p>
							) : analysisState?.trigger_run_id ? (
								<p className="mt-2 text-muted-foreground text-xs">
									Real-time updates unavailable; monitoring via database polling.
								</p>
							) : null}
						</div>
					)}

					{hasAnalysisError && (
						<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 shadow-sm">
							<p className="font-semibold text-destructive text-xs uppercase tracking-wide">Analysis failed</p>
							<p className="mt-1 text-destructive text-sm">
								{analysisState?.status_detail ||
									"The most recent analysis run reported an error. Try again once the issue is resolved."}
							</p>
						</div>
					)}

					{/* Streamlined Header */}
					<div className="mb-6 space-y-4">
						<BackButton />
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex-1">
								<div className="mb-2 flex items-center gap-2 font-semibold text-2xl">
									{interviewTitle}
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
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												disabled={fetcher.state !== "idle" || isProcessing}
												className="inline-flex items-center gap-2 rounded-md border px-3 py-2 font-semibold text-sm shadow-sm hover:bg-foreground/30 disabled:opacity-60"
												title="Reprocess options"
											>
												<MoreVertical className="h-4 w-4" />
												{fetcher.state !== "idle" || isProcessing ? "Processing…" : "Reprocess"}
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
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
											>
												Rerun Transcription
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													try {
														fetcher.submit(
															{ interview_id: interview.id },
															{ method: "post", action: "/api.reprocess-evidence" }
														)
													} catch (e) {
														consola.error("Reprocess evidence submit failed", e)
													}
												}}
												disabled={fetcher.state !== "idle" || isProcessing}
											>
												Rerun Evidence Collection
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													try {
														fetcher.submit(
															{ interview_id: interview.id },
															{ method: "post", action: "/api.reanalyze-themes" }
														)
													} catch (e) {
														consola.error("Re-analyze themes submit failed", e)
													}
												}}
												disabled={fetcher.state !== "idle" || isProcessing}
											>
												Re-analyze Themes
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
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
							{aiKeyTakeaways.length > 0 && (
								<div className="mb-4 space-y-3 rounded-lg border border-muted/60 bg-muted/40 p-4">
									<div className="flex items-center justify-between gap-4">
										<p className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">AI Summary</p>
										{conversationUpdatedLabel && (
											<span className="text-muted-foreground text-xs">Updated {conversationUpdatedLabel}</span>
										)}
									</div>
									<ul className="space-y-3">
										{aiKeyTakeaways.map((takeaway, index) => {
											const badgeStyles = badgeStylesForPriority(takeaway.priority)
											return (
												<li key={`${takeaway.summary}-${index}`} className="flex gap-3">
													<Badge variant={badgeStyles.variant} color={badgeStyles.color} className="mt-0.5 uppercase">
														{takeaway.priority}
													</Badge>
													<div className="space-y-1">
														<p className="font-medium text-foreground leading-snug">{takeaway.summary}</p>
														{takeaway.evidenceSnippets.length > 0 && (
															<p className="text-muted-foreground text-sm">
																&ldquo;{takeaway.evidenceSnippets[0]}&rdquo;
															</p>
														)}
													</div>
												</li>
											)
										})}
									</ul>
								</div>
							)}
							<InlineEdit
								textClassName="text-foreground"
								value={normalizeMultilineText(interview.high_impact_themes)}
								multiline
								markdown
								// placeholder="What are the most important insights from this interview?"
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
								// placeholder="Your observations and analysis notes"
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

						{salesCrmEnabled ? (
							<SalesLensesSection
								lens={salesLens}
								customLenses={customLensOverrides}
								customLensDefaults={customLensDefaults}
								onUpdateLens={handleCustomLensUpdate}
								updatingLensId={activeLensUpdateId}
				personLenses={personLenses}
							/>
						) : null}


					{/* Evidence Timeline Section */}
					{isProcessing && evidence.length === 0 ? (
						<div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
							<p className="text-muted-foreground text-sm">{progressInfo.label}</p>
							<p className="mt-1 text-muted-foreground text-xs">
								Evidence timeline will appear once extraction is complete
							</p>
						</div>
					) : evidence.length > 0 ? (
						<PlayByPlayTimeline evidence={evidence} className="mb-6" />
					) : (
						<p className="text-muted-foreground">No evidence found</p>
					)}

					{/* Transcript Section - Collapsed by default */}
					<h3 className="font-semibold text-foreground text-lg">Recording</h3>

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

					{/* Questions Asked Section */}
					<InterviewQuestionsAccordion interviewId={interview.id} projectId={projectId} accountId={accountId} />
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
						{isProcessing && insights.length === 0 ? (
							<div className="rounded-lg border border-dashed bg-muted/30 p-4">
								<h3 className="mb-2 font-semibold text-foreground">Insights</h3>
								<p className="text-center text-muted-foreground text-xs">{progressInfo.label}</p>
							</div>
						) : insights.length > 0 ? (
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
						) : null}

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
										const isCrossProject = participant.cross_project === true

										if (personId && !isCrossProject) {
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

										if (personId && isCrossProject) {
											return (
												<div
													key={participant.id}
													className="flex items-center justify-between rounded-md border border-dashed bg-amber-50 p-3"
												>
													<div className="flex items-center gap-3">
														<div>
															<div className="font-medium text-foreground text-sm">{personName}</div>
															<div className="text-muted-foreground text-xs">
																Linked to another project — use Edit to relink
															</div>
														</div>
													</div>
													<Badge variant="outline" className="text-xs">
														Different project
													</Badge>
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

function InterviewCopilotDrawer({
	open,
	onOpenChange,
	accountId,
	projectId,
	interviewId,
	interviewTitle,
	systemContext,
	initialPrompt,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	accountId: string
	projectId: string
	interviewId: string
	interviewTitle: string
	systemContext: string
	initialPrompt: string
}) {
	const [input, setInput] = useState("")
	const [initialMessageSent, setInitialMessageSent] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement | null>(null)
	const routes = useProjectRoutesFromIds(accountId, projectId)
	const { messages, sendMessage, status } = useChat<UpsightMessage>({
		transport: new DefaultChatTransport({
			api: routes.api.chat().interview(interviewId),
			body: { system: systemContext },
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
	})

	const visibleMessages = useMemo(() => (messages ?? []).slice(-20), [messages])

	useEffect(() => {
		if (open && !initialMessageSent && visibleMessages.length === 0) {
			sendMessage({ text: initialPrompt })
			setInitialMessageSent(true)
		}
	}, [open, initialMessageSent, visibleMessages.length, sendMessage, initialPrompt])

	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
		}
	}, [visibleMessages])

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const trimmed = input.trim()
		if (!trimmed) return
		sendMessage({ text: trimmed })
		setInput("")
	}

	const isBusy = status === "streaming" || status === "submitted"
	const isError = status === "error"

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
				<SheetHeader className="border-border border-b bg-muted/40 p-4">
					<SheetTitle className="flex items-center gap-2 text-lg">
						<BotMessageSquare className="h-4 w-4 text-primary" />
						UpSight Assistant
					</SheetTitle>
				</SheetHeader>
				<div className="flex flex-1 flex-col gap-4 p-4">
					<div className="flex-1 p-3">
						{visibleMessages.length === 0 ? (
							<p className="text-muted-foreground text-sm">Gathering the latest takeaways from this interview…</p>
						) : (
							<div className="space-y-3 text-sm">
								{visibleMessages.map((message, index) => {
									const key = message.id || `${message.role}-${index}`
									const isUser = message.role === "user"
									const textParts =
										message.parts?.map((part) => {
											if (part.type === "text") return part.text
											if (part.type === "tool-call") {
												return `Calling tool: ${part.toolName ?? "unknown"}`
											}
											if (part.type === "tool-result") {
												return `Tool result: ${part.toolName ?? "unknown"}`
											}
											return ""
										}) ?? []
									const messageText = textParts.filter(Boolean).join("\n").trim()
									return (
										<div key={key} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
											<div className="max-w-[90%]">
												<div className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wide">
													{isUser ? "You" : "Assistant"}
												</div>
												<div
													className={cn(
														"whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm",
														isUser
															? "bg-primary text-primary-foreground"
															: "bg-card text-foreground ring-1 ring-border/60"
													)}
												>
													{messageText ? (
														isUser ? (
															<span className="whitespace-pre-wrap">{messageText}</span>
														) : (
															<Streamdown className="prose prose-sm max-w-none text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
																{messageText}
															</Streamdown>
														)
													) : !isUser ? (
														<span className="text-muted-foreground italic">Thinking...</span>
													) : (
														<span className="text-muted-foreground">(No text response)</span>
													)}
												</div>
											</div>
										</div>
									)
								})}
								<div ref={messagesEndRef} />
							</div>
						)}
					</div>
					<form onSubmit={handleSubmit} className="space-y-2">
						<Textarea
							value={input}
							onChange={(event) => setInput(event.currentTarget.value)}
							placeholder="Ask about evidence, themes, or next steps"
							rows={3}
							disabled={isBusy}
						/>
						<div className="flex items-center justify-between gap-2">
							<span className="text-muted-foreground text-xs" aria-live="polite">
								{isError
									? "Something went wrong. Try again."
									: isBusy
										? "Thinking…"
										: "Keep questions short and specific."}
							</span>
							<Button type="submit" size="sm" disabled={!input.trim() || isBusy}>
								Send
							</Button>
						</div>
					</form>
				</div>
			</SheetContent>
		</Sheet>
	)
}
