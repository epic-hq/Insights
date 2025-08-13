import { CopilotKit } from "@copilotkit/react-core"
import { CopilotChat } from "@copilotkit/react-ui"
import { useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, useLoaderData } from "react-router"
import "@copilotkit/react-ui/styles.css"
import { CheckCircle } from "lucide-react"
import type { Database } from "~/../supabase/types"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"

interface SignupChatData {
	problem?: string
	challenges?: string
	importance?: number
	ideal_solution?: string
	content_types?: string
	other_feedback?: string
	completed?: boolean
}

interface LoaderData {
	user: Database["public"]["Tables"]["account_settings"]["Row"] | null
	existingChatData?: SignupChatData
	copilotRuntimeUrl: string
}

export async function loader({ context, request }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { client: supabase } = getServerClient(request)

	// Get existing chat data if any
	const { data: accountSettings } = await supabase
		.from("account_settings")
		.select("metadata")
		.eq("account_id", user.sub)
		.single()

	const existingChatData = accountSettings?.metadata?.signup_chat as SignupChatData

	return data({
		user,
		existingChatData,
		copilotRuntimeUrl: "/api/copilotkit",
	})
}

export async function action({ request }: ActionFunctionArgs) {
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const formData = await request.formData()
	const action = formData.get("action")

	if (action === "save_chat_data") {
		const chatData = JSON.parse(formData.get("chatData") as string) as SignupChatData

		const { client: supabase } = getServerClient(request)

		// Use the upsert function to save signup chat data
		const { error } = await supabase.rpc("upsert_signup_data", {
			p_user_id: user.sub,
			p_signup_data: chatData,
		})

		if (error) {
			// Using throw instead of console.error for better error handling
			throw new Response(`Error saving chat data: ${error.message}`, { status: 500 })
		}

		return data({ success: true })
	}

	return data({ success: false, error: "Invalid action" }, { status: 400 })
}

export default function SignupChat() {
	const { existingChatData, copilotRuntimeUrl } = useLoaderData<LoaderData>()
	const [chatCompleted] = useState(existingChatData?.completed || false)

	// If chat is already completed, show completion message
	if (chatCompleted) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
				<div className="rounded-lg bg-white p-8 shadow-xl dark:bg-gray-800">
					<div className="flex flex-col items-center gap-4 text-center">
						<CheckCircle className="h-16 w-16 text-green-500" />
						<h1 className="font-bold text-3xl text-gray-900 dark:text-white">Thanks for joining UpSight!</h1>
						<p className="text-gray-600 text-lg dark:text-gray-300">
							We've received your responses and will be in touch when you're activated.
						</p>
						<p className="text-gray-500 text-sm dark:text-gray-400">First month free - as promised!</p>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
			<div className="container mx-auto flex flex-1 flex-col p-4">
				<div className="mb-8 text-center">
					<h1 className="mb-2 font-bold text-4xl text-gray-900 dark:text-white">Welcome to UpSight!</h1>
					<p className="text-gray-600 text-lg dark:text-gray-300">
						Let's get to know you better. This will help us tailor your experience.
					</p>
					<p className="text-blue-600 text-sm dark:text-blue-400">Remember: Your first month is free!</p>
				</div>

				<div className="flex-1 rounded-lg bg-white shadow-xl dark:bg-gray-800">
					<CopilotKit runtimeUrl={copilotRuntimeUrl}>
						<CopilotChat
							instructions={`You are the onboarding assistant for UpSight early access users.

							Your job is to ask exactly these questions in sequence:
							1. "Thanks for signing up! Let's start - what's the core problem or use case you're hoping UpSight will help you solve?"
							2. "What challenges are you facing with your current solutions? What's not working well?"
							3. "On a scale of 1-5, how important is solving this problem for you or your business?"
							4. "What would your ideal solution look like? Paint me a picture of the perfect tool."
							5. "What types of content do you want to analyze? (interviews, surveys, support tickets, etc.)"
							6. "Finally, is there anything else you wish existed in this space? Any other feedback?"

							Be concise, friendly, and conversational. Ask one question at a time and wait for their response before moving to the next question.
							Do not answer unrelated questions - politely redirect them back to the onboarding questions.

							After all questions are answered, say: "Perfect! Thanks for sharing all of that. We'll be in touch when you're activated. Remember - your first month is completely free!"

							Then call the saveChatData function with all the collected responses.`}
							className="h-full"
						/>
					</CopilotKit>
				</div>
			</div>
		</div>
	)
}
