import { RuntimeContext } from "@mastra/core/di"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { mastra } from "~/mastra"
import { memory } from "~/mastra/memory"
import { userContext } from "~/server/user-context"

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 })
	}
	const ctx = context.get(userContext)
	const accountId = String(params.accountId || ctx?.account_id || "")
	const projectId = String(params.projectId || "")
	const userId = ctx.claims?.sub

	if (!projectId) {
		return new Response(JSON.stringify({ error: "Missing projectId" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		})
	}

	const { messages, system } = await request.json()

	// Reuse latest thread for this project-scoped agent
	// TODO pass in threadId instead of refetching
	// TODO abstract into thread primitives lib
	const resourceId = `projectSetupAgent-${userId}-${projectId}`
	const threads = await memory.getThreadsByResourceIdPaginated({
		resourceId,
		orderBy: "createdAt",
		sortDirection: "DESC",
		page: 0,
		perPage: 100,
	})

	let threadId = ""
	if (!(threads?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId,
			title: `Project Setup ${projectId}`,
			metadata: { user_id: userId, project_id: projectId, account_id: accountId },
		})
		threadId = newThread.id
	} else {
		threadId = threads.threads[0].id
	}

	const runtimeContext = new RuntimeContext()
	runtimeContext.set("user_id", userId)
	runtimeContext.set("account_id", accountId)
	runtimeContext.set("project_id", projectId)

	const agent = mastra.getAgent("projectSetupAgent")
	const result = await agent.stream(messages, {
		memory: {
			thread: threadId,
			resource: resourceId,
		},
		runtimeContext,
		context: system
			? [
				{
					role: "system",
					content: `## Context from the client's UI:\n${system}`,
				},
			]
			: undefined,
		onFinish: async (data) => {
			consola.log("project-setup onFinish", data)
			// Log to Langfuse
			const langfuse = getLangfuseClient()
			const lfTrace = langfuse.trace?.({ name: "api.chat.project-setup" })
			const gen = lfTrace?.generation?.({
				name: "api.chat.project-setup",
				input: messages,
				output: data,
			})
			gen?.end?.()

			// Check if setup is complete and trigger research structure generation
			try {
				const workingMemory = await memory.getWorkingMemory({ threadId })
				const setupState = workingMemory?.projectSetup

				if (setupState?.completed) {
					consola.info("[project-setup] Setup completed, generating research structure")

					// Check if research structure already exists
					const checkResponse = await fetch(
						`${request.url.split('/api')[0]}/api/check-research-structure?project_id=${projectId}`
					)
					const checkBody = await checkResponse.json()

					if (checkBody.summary?.has_decision_questions && checkBody.summary?.has_research_questions) {
						consola.info("[project-setup] Research structure already exists, skipping generation")
						return
					}

					// Generate research structure
					const formData = new FormData()
					formData.append("project_id", projectId)
					if (setupState.research_goal) formData.append("research_goal", setupState.research_goal)
					if (setupState.customer_problem) formData.append("customer_problem", setupState.customer_problem)
					if (setupState.target_roles?.length) formData.append("target_roles", setupState.target_roles.join(", "))
					if (setupState.target_orgs?.length) formData.append("target_orgs", setupState.target_orgs.join(", "))
					if (setupState.offerings) formData.append("offerings", setupState.offerings)
					if (setupState.competitors?.length) formData.append("competitors", setupState.competitors.join(", "))
					if (setupState.assumptions?.length) formData.append("assumptions", setupState.assumptions.join("\n"))
					if (setupState.unknowns?.length) formData.append("unknowns", setupState.unknowns.join("\n"))
					formData.append("research_mode", "exploratory")

					const generateResponse = await fetch(
						`${request.url.split('/api')[0]}/api/generate-research-structure`,
						{
							method: "POST",
							body: formData,
						}
					)

					if (generateResponse.ok) {
						const result = await generateResponse.json()
						consola.info("[project-setup] Research structure generated successfully", {
							decisionQuestions: result?.structure?.decision_questions?.length ?? 0,
							researchQuestions: result?.structure?.research_questions?.length ?? 0,
						})
					} else {
						consola.error("[project-setup] Failed to generate research structure", {
							status: generateResponse.status,
						})
					}
				}
			} catch (error) {
				consola.error("[project-setup] Error in onFinish handler", error)
			}
		},
	})

	// Return AI SDK v5 compatible stream response
	// @ts-expect-error - toDataStreamResponse is added at runtime by attachStreamResultAliases
	return result.toDataStreamResponse()
}
