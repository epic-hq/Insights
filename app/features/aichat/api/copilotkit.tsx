import { MastraAgent } from "@ag-ui/mastra"
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint, OpenAIAdapter } from "@copilotkit/runtime"
import { RuntimeContext } from "@mastra/core/di"
import consola from "consola"
import { type ActionFunctionArgs, redirect } from "react-router"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { mastra } from "~/mastra"

export const loader = () => new Response("Method Not Allowed", { status: 405 })

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 })
	}

	// Auth + DB client for actions
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}
	const { client: supabase } = getServerClient(request)

	// Multi-tenant context from provider headers (wired in ProtectedLayout)
	const hdr = request.headers
	const headerUserId = hdr.get("X-UserId") || undefined
	const headerAccountId = hdr.get("X-AccountId") || undefined
	const headerProjectId = hdr.get("X-ProjectId") || undefined

	// Get OpenAI API key
	const openaiApiKey = process.env.OPENAI_API_KEY
	if (!openaiApiKey) {
		throw new Response("OpenAI API key not configured", { status: 500 })
	}

	// Use OpenAI adapter instead of EmptyAdapter for chat components
	const serviceAdapter = new OpenAIAdapter({ apiKey: openaiApiKey })

	// Get Mastra agents for CopilotKit integration
	const mastraAgents = MastraAgent.getLocalAgents({ mastra })

	// Build Copilot runtime with Mastra agents and our signup action
	const runtime = new CopilotRuntime({
		agents: mastraAgents,
		actions: [
			{
				name: "runDailyBrief",
				description: "Run the daily brief workflow for the current project/account context",
				parameters: [],
				handler: async () => {
					consola.log("🚀 runDailyBrief action started")
					try {
						if (!headerAccountId || !headerProjectId) {
							throw new Error("Missing account or project context")
						}
						consola.log("📋 Context:", { headerAccountId, headerProjectId })

						// Start workflow run with inputs and inject supabase via runtimeContext
						consola.log("🔄 Starting workflow...")
						const run = await mastra.getWorkflow("dailyBriefWorkflow").createRunAsync()
						const runtimeContext = new RuntimeContext()
						runtimeContext.set("supabase", supabase)
						const result = await run.start({
							inputData: { account_id: headerAccountId, project_id: headerProjectId },
							runtimeContext,
						})

						// Extract the final workflow result value for display in chat
						consola.log("📊 Full workflow result:", JSON.stringify(result, null, 2))
						
						if (result.status === "success") {
							const briefText = result.result.value || "Daily brief completed successfully"
							consola.log("✅ Returning to CopilotKit:", briefText)
							consola.log("📝 Text length:", briefText.length)
							consola.log("📝 Text type:", typeof briefText)
							
							// Try returning structured response for CopilotKit
							const response = {
								result: briefText,
								message: briefText
							}
							consola.log("📦 Structured response:", response)
							return response
						}
						
						consola.error("❌ Workflow failed:", result)
						return "Failed to generate daily brief. Please try again."
					} catch (error) {
						consola.error("💥 Error running dailyBriefWorkflow:", error)
						return "Error occurred while generating daily brief."
					}
				},
			},
			{
				name: "saveChatData",
				description: "Save the collected signup chat responses to the database",
				parameters: [
					{
						name: "problem",
						type: "string",
						description: "The core problem or use case the user wants to solve",
						required: false,
					},
					{
						name: "challenges",
						type: "string",
						description: "Current challenges and what's not working",
						required: false,
					},
					{
						name: "importance",
						type: "number",
						description: "Importance rating from 1-5",
						required: false,
					},
					{
						name: "ideal_solution",
						type: "string",
						description: "Description of their ideal solution",
						required: false,
					},
					{
						name: "content_types",
						type: "string",
						description: "Types of content they want to analyze",
						required: false,
					},
					{
						name: "other_feedback",
						type: "string",
						description: "Any other feedback or wishes",
						required: false,
					},
				],
				handler: async ({ problem, challenges, importance, ideal_solution, content_types, other_feedback }) => {
					try {
						const chatData = {
							problem,
							challenges,
							importance,
							ideal_solution,
							content_types,
							other_feedback,
							completed: true,
						}
						consola.log("mastra agent saving chat data: ", {
							chatData,
							context: {
								user_id: user.sub,
								header_user_id: headerUserId,
								account_id: headerAccountId,
								project_id: headerProjectId,
							},
						})
						const { error } = await supabase.rpc("upsert_signup_data", {
							p_user_id: user.sub,
							p_signup_data: chatData,
						})

						if (error) {
							throw new Error(`Database error: ${error.message}`)
						}
						// TODO: redirect to home. not working.
						return redirect("/home")
					} catch (error) {
						consola.error("Error in saveChatData handler:", error)
						return {
							success: false,
							message: `Error saving responses: ${error instanceof Error ? error.message : "Unknown error"}`,
						}
					}
				},
			},
		],
	})

	const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
		runtime,
		serviceAdapter,
		endpoint: "/api/copilotkit",
	})

	return handleRequest(request)
}
