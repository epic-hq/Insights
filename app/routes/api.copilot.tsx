import { CopilotRuntime, OpenAIAdapter } from "@copilotkit/runtime"
import type { ActionFunctionArgs } from "react-router"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"

export async function action({ request }: ActionFunctionArgs) {
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { client: supabase } = getServerClient(request)

	// Create the CopilotKit runtime with OpenAI adapter
	const runtime = new CopilotRuntime({
		actions: [
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

						// Save to database using the upsert function & user_id
						const { error } = await supabase.rpc("upsert_signup_data", {
							p_user_id: user.sub,
							p_signup_data: chatData,
						})

						if (error) {
							throw new Error(`Database error: ${error.message}`)
						}

						return {
							success: true,
							message: "Thank you! Your responses have been saved. We'll be in touch when you're activated!",
						}
					} catch (error) {
						return {
							success: false,
							message: `Error saving responses: ${error instanceof Error ? error.message : "Unknown error"}`,
						}
					}
				},
			},
		],
	})

	const openaiApiKey = process.env.OPENAI_API_KEY
	if (!openaiApiKey) {
		throw new Response("OpenAI API key not configured", { status: 500 })
	}

	const serviceAdapter = new OpenAIAdapter({ apiKey: openaiApiKey })

	return runtime.response(request, serviceAdapter)
}
