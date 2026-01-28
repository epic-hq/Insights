/**
 * Chat API for conversational survey experience using Mastra agent
 *
 * Follows the same pattern as api.chat.project-setup.tsx:
 * - Sanitizes message IDs to prevent duplicates
 * - Extracts text from message parts
 * - Only sends new messages (after last assistant response)
 */
import { toAISdkStream } from "@mastra/ai-sdk"
import { RequestContext } from "@mastra/core/di"
import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getProjectContextGeneric } from "~/features/questions/db"
import { ResearchLinkQuestionSchema } from "~/features/research-links/schemas"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { mastra } from "~/mastra"

// Type for incoming messages from useChat
type IncomingMessage = {
	id?: string
	role: string
	content?: string
	parts?: Array<{ type: string; text?: string }>
}

// Extract text content from a message (handles both old content format and new parts format)
function extractMessageContent(message: IncomingMessage): string {
	// If content is a string, use it directly
	if (typeof message.content === "string") {
		return message.content
	}
	// If parts array exists, extract text from text parts
	if (Array.isArray(message.parts)) {
		return message.parts
			.filter((p) => p.type === "text" && typeof p.text === "string")
			.map((p) => p.text)
			.join("")
			.trim()
	}
	return ""
}

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405 })
	}

	const slug = params.slug
	if (!slug) {
		return new Response("Missing slug", { status: 400 })
	}

	let payload: {
		messages: Array<IncomingMessage>
		responseId: string
		currentResponses: Record<string, unknown>
	}

	try {
		payload = await request.json()
	} catch {
		return new Response("Invalid request", { status: 400 })
	}

	if (!payload.responseId) {
		return new Response("Missing responseId", { status: 400 })
	}

	const supabase = createSupabaseAdminClient()

	// Get the research link and its questions
	const { data: list, error } = await supabase
		.from("research_links")
		.select(
			"id, name, description, hero_title, hero_subtitle, instructions, questions, account_id, project_id, ai_autonomy"
		)
		.eq("slug", slug)
		.eq("is_live", true)
		.maybeSingle()

	if (error || !list) {
		return new Response("Survey not found", { status: 404 })
	}

	// Get account name for personalization
	let accountName = "the team"
	if (list.account_id) {
		const { data: account } = await supabase
			.schema("accounts")
			.from("accounts")
			.select("name")
			.eq("id", list.account_id)
			.maybeSingle()
		if (account?.name) {
			accountName = account.name
		}
	}

	const questionsResult = ResearchLinkQuestionSchema.array().safeParse(list.questions)
	const questions = questionsResult.success ? questionsResult.data : []

	// Fetch FRESH responses from database (not stale frontend state)
	// This ensures we see answers saved by the agent's tool calls
	const { data: responseRecord } = await supabase
		.from("research_link_responses")
		.select("responses, person_id")
		.eq("id", payload.responseId)
		.maybeSingle()

	const currentResponses = (responseRecord?.responses as Record<string, unknown>) ?? {}

	// Get AI autonomy setting (default to strict)
	const aiAutonomy = (list.ai_autonomy as "strict" | "moderate" | "adaptive") ?? "strict"

	// SMART CRM LOOKUP: Only fetch person context if we have a person_id
	// This avoids wasting tokens on cold/anonymous surveys
	let personContext: {
		name?: string
		title?: string
		company?: string
		segment?: string
		jobFunction?: string
		pastInterviewCount?: number
	} | null = null

	if (responseRecord?.person_id && aiAutonomy !== "strict") {
		// Only fetch CRM data if autonomy allows using it
		const { data: person } = await supabase
			.from("people")
			.select("name, title, company, segment, job_function")
			.eq("id", responseRecord.person_id)
			.maybeSingle()

		if (person) {
			// Get past interview count (lightweight query)
			const { count: interviewCount } = await supabase
				.from("interview_people")
				.select("*", { count: "exact", head: true })
				.eq("person_id", responseRecord.person_id)

			personContext = {
				name: person.name ?? undefined,
				title: person.title ?? undefined,
				company: person.company ?? undefined,
				segment: person.segment ?? undefined,
				jobFunction: person.job_function ?? undefined,
				pastInterviewCount: interviewCount ?? 0,
			}
		}
	}

	// SMART PROJECT CONTEXT: Only fetch if project_id exists and autonomy allows it
	let projectContext: {
		researchGoal?: string
		targetOrgs?: string[]
		targetRoles?: string[]
		unknowns?: string[]
		decisionQuestions?: string[]
		customInstructions?: string
	} | null = null

	if (list.project_id && aiAutonomy !== "strict") {
		try {
			const ctx = await getProjectContextGeneric(supabase, list.project_id)
			if (ctx?.merged) {
				const m = ctx.merged
				projectContext = {
					researchGoal: typeof m.research_goal === "string" ? m.research_goal : undefined,
					targetOrgs: Array.isArray(m.target_orgs) ? (m.target_orgs as string[]) : undefined,
					targetRoles: Array.isArray(m.target_roles) ? (m.target_roles as string[]) : undefined,
					unknowns: Array.isArray(m.unknowns) ? (m.unknowns as string[]) : undefined,
					decisionQuestions: Array.isArray(m.decision_questions) ? (m.decision_questions as string[]) : undefined,
					customInstructions: typeof m.custom_instructions === "string" ? m.custom_instructions : undefined,
				}
			}
		} catch (err) {
			consola.warn("research-link-chat: failed to fetch project context", err)
		}
	}

	consola.info("research-link-chat: fetched responses from DB", {
		responseId: payload.responseId,
		responseKeys: Object.keys(currentResponses),
	})

	// Build context about answered/unanswered questions
	const answeredQuestions = questions
		.filter((q) => {
			const answer = currentResponses[q.id]
			return answer !== undefined && answer !== null && answer !== ""
		})
		.map((q) => ({
			id: q.id,
			prompt: q.prompt,
			answer: String(currentResponses[q.id]),
		}))

	const unansweredQuestions = questions.filter((q) => {
		const answer = currentResponses[q.id]
		return answer === undefined || answer === null || answer === ""
	})

	// Sanitize messages - remove id fields and extract content from parts
	// For research-link-chat, we send ALL messages since there's no memory/thread system
	// The agent needs full conversation history to maintain context
	const sanitizedMessages = Array.isArray(payload.messages)
		? payload.messages.map((m) => ({
				role: m.role as "user" | "assistant",
				content: extractMessageContent(m),
			}))
		: []

	consola.info("research-link-chat: message processing", {
		totalReceived: sanitizedMessages.length,
		roles: sanitizedMessages.map((m) => m.role),
	})

	// Set up request context for the agent
	const requestContext = new RequestContext()
	requestContext.set("response_id", payload.responseId)
	requestContext.set("slug", slug)
	requestContext.set("research_link_id", list.id)
	requestContext.set("account_id", list.account_id)
	requestContext.set("survey_name", list.hero_title || list.name)
	requestContext.set("survey_context", list.hero_subtitle || list.description || "")
	requestContext.set("survey_instructions", list.instructions || "")
	requestContext.set("account_name", accountName)
	requestContext.set(
		"questions",
		JSON.stringify(
			questions.map((q) => ({
				id: q.id,
				prompt: q.prompt,
				type: q.type,
				required: q.required,
			}))
		)
	)
	requestContext.set("answered_questions", JSON.stringify(answeredQuestions))
	// Pass full next question object with type for better agent context
	const nextQ = unansweredQuestions[0]
	requestContext.set(
		"next_question_full",
		nextQ ? JSON.stringify({ id: nextQ.id, prompt: nextQ.prompt, type: nextQ.type }) : ""
	)
	// Track if this is a continuation (has message history beyond the initial auto-message)
	const hasMessageHistory = sanitizedMessages.length > 1
	requestContext.set("has_message_history", hasMessageHistory ? "true" : "false")

	// Pass AI autonomy setting
	requestContext.set("ai_autonomy", aiAutonomy)

	// Pass person context if available (only for moderate/adaptive modes)
	if (personContext) {
		requestContext.set("person_context", JSON.stringify(personContext))
	}

	// Pass project context if available (research goals, target roles/orgs, unknowns)
	if (projectContext) {
		requestContext.set("project_context", JSON.stringify(projectContext))
	}

	consola.info("research-link-chat: streaming agent response", {
		slug,
		responseId: payload.responseId,
		messageCount: sanitizedMessages.length,
		answered: answeredQuestions.length,
		remaining: unansweredQuestions.length,
		nextQuestion: unansweredQuestions[0]?.prompt ?? "(none)",
	})

	const agent = mastra.getAgent("researchLinkChatAgent")
	if (!agent) {
		consola.error("research-link-chat: agent not found")
		return new Response("Agent not found", { status: 500 })
	}

	try {
		consola.info("research-link-chat: calling agent.stream")
		const result = await agent.stream(sanitizedMessages, {
			requestContext,
		})
		consola.info("research-link-chat: got stream result")

		const uiMessageStream = createUIMessageStream({
			execute: async ({ writer }) => {
				try {
					const transformedStream = toAISdkStream(result, {
						from: "agent" as const,
						sendReasoning: true,
						sendSources: true,
					})

					if (!transformedStream) {
						consola.warn("research-link-chat: no transformed stream")
						return
					}

					for await (const part of transformedStream) {
						writer.write(part)
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					consola.error("research-link-chat stream error", { errorMessage })
					throw error
				}
			},
		})

		return createUIMessageStreamResponse({ stream: uiMessageStream })
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		consola.error("research-link-chat: agent.stream failed", {
			errorMessage,
			stack: error instanceof Error ? error.stack : undefined,
		})
		return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		})
	}
}
