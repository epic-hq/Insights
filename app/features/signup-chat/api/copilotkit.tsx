import { MastraAgent } from "@ag-ui/mastra"
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint, ExperimentalEmptyAdapter } from "@copilotkit/runtime"
import { MastraClient } from "@mastra/client-js"
import { RuntimeContext } from "@mastra/core/di"
import consola from "consola"
import { type ActionFunctionArgs, redirect } from "react-router"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { mastra, type UserContext } from "~/mastra"

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

	// Use empty service adapter for multi-agent support (per CopilotKit + Mastra reference)
	const serviceAdapter = new ExperimentalEmptyAdapter()

	// Create a runtime context from incoming headers for ALL local agents
	const runtimeContext = new RuntimeContext<UserContext>()
	runtimeContext.set("user_id", headerUserId || user.sub || "")
	runtimeContext.set("account_id", headerAccountId || "")
	runtimeContext.set("project_id", headerProjectId || "")
	const authHeader = hdr.get("authorization") || ""
	// runtimeContext.set("jwt", authHeader?.replace("Bearer ", ""))

	consola.log("/api/copilotkit runtimeContext user_id", runtimeContext.get("user_id"))

	// Get Mastra agents for CopilotKit integration with global runtime context
	// const mastraAgents = MastraAgent.getLocalAgents({
	// 	mastra,
	// 	runtimeContext,
	// 	resourceId: "signupAgent",
	// })
	// 3. Create the CopilotRuntime instance and utilize the Mastra AG-UI
	//    integration to get the remote agents.
	// if (!process.env.MASTRA_URL) {
	// 	consola.error("MASTRA_URL is not set")
	// 	return new Response("MASTRA_URL is not set", { status: 500 })
	// }
    const runtime = new CopilotRuntime({
        agents: await MastraAgent.getRemoteAgents({
            mastraClient: new MastraClient({
                baseUrl: (process.env.MASTRA_URL || "http://localhost:4111").replace(/\/$/, ""),
                headers: {
                    "x-user-id": headerUserId || user.sub || "",
                    "x-account-id": headerAccountId || "",
                    "x-project-id": headerProjectId || "",
                    authorization: authHeader,
                },
            }),
        }),
    })

	// Log the context for debugging
	// consola.log("CopilotKit received headers:", {
	// 	userId: headerUserId,
	// 	accountId: headerAccountId,
	// 	projectId: headerProjectId,
	// 	hasAuth: !!hdr.get("authorization"),
	// })

	// Build Copilot runtime with Mastra agents and our signup action
	// const runtime = new CopilotRuntime({
	// 	agents: mastraAgents,
	// })
	// 	actions: [
	// 		// {
	// 		//   name: "signupNextTurn",
	// 		//   description: "Drive the signup onboarding conversation deterministically for the next turn.",
	// 		//   parameters: [
	// 		//     { name: "message", type: "string", description: "The user's latest message" },
	// 		//     { name: "problem", type: "string", required: false },
	// 		//     { name: "need_to_learn", type: "string", required: false },
	// 		//     { name: "challenges", type: "string", required: false },
	// 		//     { name: "content_types", type: "string", required: false },
	// 		//     { name: "other_feedback", type: "string", required: false },
	// 		//   ],
	// 		//   handler: async ({ message, problem, need_to_learn, challenges, content_types, other_feedback }) => {
	// 		//     try {
	// 		//       consola.log("➡️ signupNextTurn: starting workflow", { hasMessage: !!message })
	// 		//       const run = await mastra.getWorkflow("signupOnboardingWorkflow")?.createRunAsync()
	// 		//       const runtimeContext = new RuntimeContext()
	// 		//       runtimeContext.set("supabase", supabase)
	// 		//       const result = await run?.start({
	// 		//         inputData: {
	// 		//           message,
	// 		//           user_id: user.sub,
	// 		//           state: { problem, need_to_learn, challenges, content_types, other_feedback },
	// 		//         },
	// 		//         runtimeContext,
	// 		//       })

	// 		//       if (result?.status === "success") {
	// 		//         const out = result.result as any
	// 		//         consola.log("✅ signupNextTurn: workflow success", out)
	// 		//         return {
	// 		//           reply: out.reply,
	// 		//           state: out.state,
	// 		//           completed: out.completed,
	// 		//         }
	// 		//       }

	// 		//       return { reply: "Let's continue — what's your main objective?", state: { problem, need_to_learn, challenges, content_types, other_feedback }, completed: false }
	// 		//     } catch (e) {
	// 		//       consola.error("signupNextTurn error", e)
	// 		//       return { reply: "Sorry — hit a hiccup. What business objective are you trying to achieve?", state: { problem, need_to_learn, challenges, content_types, other_feedback }, completed: false }
	// 		//     }
	// 		//   },
	// 		// },
	// 		{
	// 			name: "runDailyBrief",
	// 			description: "Run the daily brief workflow for the current project/account context",
	// 			parameters: [],
	// 			handler: async () => {
	// 				consola.log("🚀 runDailyBrief action started")
	// 				try {
	// 					// Get context from headers
	// 					const headerAccountId = request.headers.get("X-AccountId")
	// 					const headerProjectId = request.headers.get("X-ProjectId")

	// 					if (!headerAccountId || !headerProjectId) {
	// 						throw new Error("Missing account or project context")
	// 					}
	// 					consola.log("📋 Context:", { headerAccountId, headerProjectId })

	// 					// Start workflow run with inputs and inject supabase via runtimeContext
	// 					consola.log("🔄 Starting workflow...")
	// 					const workflow = mastra.getWorkflow("dailyBriefWorkflow")
	// 					const run = await workflow?.createRunAsync()
	// 					const runtimeContext = new RuntimeContext()
	// 					runtimeContext.set("supabase", supabase)
	// 					const result = await run.start({
	// 						inputData: { account_id: headerAccountId, project_id: headerProjectId },
	// 						runtimeContext,
	// 					})

	// 					// Extract the final workflow result value for display in chat
	// 					consola.log("📊 Full workflow result:", JSON.stringify(result, null, 2))

	// 					if (result.status === "success") {
	// 						const briefText = result.result.value || "Daily brief completed successfully"
	// 						consola.log("✅ Returning to CopilotKit:", briefText)
	// 						consola.log("📝 Text length:", briefText.length)
	// 						consola.log("📝 Text type:", typeof briefText)

	// 						// Try returning structured response for CopilotKit
	// 						const response = {
	// 							result: briefText,
	// 							message: briefText,
	// 						}
	// 						consola.log("📦 Structured response:", response)
	// 						return response
	// 					}

	// 					consola.error("❌ Workflow failed:", result)
	// 					return "Failed to generate daily brief. Please try again."
	// 				} catch (error) {
	// 					consola.error("💥 Error running dailyBriefWorkflow:", error)
	// 					return "Error occurred while generating daily brief."
	// 				}
	// 			},
	// 		},
	// 		// {
	// 		//   name: "saveChatData",
	// 		// 	description: "Save the collected signup chat responses to the database",
	// 		// 	parameters: [
	// 		// 		{
	// 		// 			name: "problem",
	// 		// 			type: "string",
	// 		// 			description: "The core problem or use case the user wants to solve",
	// 		// 			required: false,
	// 		// 		},
	// 		// 		{
	// 		// 			name: "challenges",
	// 		// 			type: "string",
	// 		// 			description: "Current challenges and what's not working",
	// 		// 			required: false,
	// 		// 		},
	// 		// 		{
	// 		// 			name: "content_types",
	// 		// 			type: "string",
	// 		// 			description:
	// 		// 				"Types of content they want to analyze; user interviews, focus groups, user testing, case studies, etc.",
	// 		// 			required: false,
	// 		// 		},
	// 		// 		{
	// 		// 			name: "other_feedback",
	// 		// 			type: "string",
	// 		// 			description: "Any other feedback or wishes",
	// 		// 			required: false,
	// 		// 		},
	// 		// 	],
	// 		// 	handler: async ({ problem, challenges, content_types, other_feedback }) => {
	// 		// 		try {
	// 		// 			const chatData = {
	// 		// 				problem,
	// 		// 				challenges,
	// 		// 				content_types,
	// 		// 				other_feedback,
	// 		// 				completed: true,
	// 		// 			}

	// 		// 			// Get headers for context
	// 		// 			const headerUserId = request.headers.get("X-UserId")
	// 		// 			const headerAccountId = request.headers.get("X-AccountId")
	// 		// 			const headerProjectId = request.headers.get("X-ProjectId")

	// 		// 			consola.log("features/aichat/api/copilotkit agent saving chat data: ", {
	// 		// 				chatData,
	// 		// 				context: {
	// 		// 					user_id: user.sub,
	// 		// 					header_user_id: headerUserId,
	// 		// 					account_id: headerAccountId,
	// 		// 					project_id: headerProjectId,
	// 		// 				},
	// 		// 			})
	// 		// 			const { error } = await supabase.rpc("upsert_signup_data", {
	// 		// 				p_user_id: user.sub,
	// 		// 				p_signup_data: chatData,
	// 		// 			})

	// 		// 			if (error) {
	// 		// 				throw new Error(`Database error: ${error.message}`)
	// 		// 			}
	// 		// 			// TODO: redirect to home. not working.
	// 		// 			return { success: true, message: "Saved" }
	// 		// 		} catch (error) {
	// 		// 			consola.error("Error in saveChatData handler:", error)
	// 		// 			return {
	// 		// 				success: false,
	// 		// 				message: `Error saving responses: ${error instanceof Error ? error.message : "Unknown error"}`,
	// 		// 			}
	// 		// 		}
	// 		// 	},
	// 		// },
	// 	],
	// })
	consola.log("features/aichat/api/copilotkit mastra-userid-header ", headerUserId)

	const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
		runtime,
		serviceAdapter,
		endpoint: "/api/copilotkit",
	})

	return handleRequest(request)
}
