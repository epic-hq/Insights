/**
 * Chat API for conversational survey experience using Mastra agent
 */
import { toAISdkStream } from "@mastra/ai-sdk"
import { RequestContext } from "@mastra/core/di"
import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { ResearchLinkQuestionSchema } from "~/features/research-links/schemas"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { mastra } from "~/mastra"

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405 })
	}

	const slug = params.slug
	if (!slug) {
		return new Response("Missing slug", { status: 400 })
	}

	let payload: {
		messages: Array<{ role: string; content: string }>
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
		.select("id, name, description, hero_title, hero_subtitle, questions, account_id")
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

	// Build context about answered/unanswered questions
	const currentResponses = payload.currentResponses ?? {}
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

	// Sanitize messages
	const sanitizedMessages = Array.isArray(payload.messages)
		? payload.messages.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			}))
		: []

	// Set up request context for the agent
	const requestContext = new RequestContext()
	requestContext.set("response_id", payload.responseId)
	requestContext.set("research_link_id", list.id)
	requestContext.set("account_id", list.account_id)
	requestContext.set("survey_name", list.hero_title || list.name)
	requestContext.set("survey_context", list.hero_subtitle || list.description || "")
	requestContext.set("account_name", accountName)
	requestContext.set(
		"questions",
		JSON.stringify(
			questions.map((q) => ({
				id: q.id,
				prompt: q.prompt,
				required: q.required,
			}))
		)
	)
	requestContext.set("answered_questions", JSON.stringify(answeredQuestions))
	requestContext.set("next_question", unansweredQuestions[0]?.prompt ?? "")

	consola.info("research-link-chat: streaming agent response", {
		slug,
		responseId: payload.responseId,
		messageCount: sanitizedMessages.length,
		answered: answeredQuestions.length,
		remaining: unansweredQuestions.length,
	})

	const agent = mastra.getAgent("researchLinkChatAgent")
	const result = await agent.stream(sanitizedMessages, {
		requestContext,
	})

	const uiMessageStream = createUIMessageStream({
		execute: async ({ writer }) => {
			try {
				const transformedStream = toAISdkStream(result, {
					from: "agent" as const,
					sendReasoning: true,
					sendSources: true,
				})

				if (!transformedStream) return

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
}
