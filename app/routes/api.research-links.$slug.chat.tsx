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
		.select("id, name, description, hero_title, hero_subtitle, instructions, questions, account_id")
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
		.select("responses")
		.eq("id", payload.responseId)
		.maybeSingle()

	const currentResponses = (responseRecord?.responses as Record<string, unknown>) ?? {}

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
