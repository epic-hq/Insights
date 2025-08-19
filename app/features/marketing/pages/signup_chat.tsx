import { CopilotKit, useCoAgent, useCopilotAction } from "@copilotkit/react-core"
import { CopilotChat } from "@copilotkit/react-ui"
import { useEffect } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useNavigate } from "react-router"
import "@copilotkit/react-ui/styles.css"

// Add custom CSS for progress animation
const progressStyles = `
@keyframes progress {
  from { width: 0%; }
  to { width: 100%; }
}
`

import { ArrowRight, CheckCircle } from "lucide-react"
import type { z } from "zod"
// Agent state type from Mastra agents
import type { Database } from "~/../supabase/types"
import { JsonDataCard } from "~/features/aichat/components/JsonDataCard"
import { PlanCard } from "~/features/aichat/components/PlanCard"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import type { SignupAgentState } from "~/mastra/agents"

type AgentState = z.infer<typeof SignupAgentState>

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

	// Get existing chat data from user_settings
	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("signup_data")
		.eq("user_id", user.sub)
		.single()

	const existingChatData = userSettings?.signup_data as SignupChatData

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
	const navigate = useNavigate()
	const chatCompleted = Boolean(existingChatData?.completed || false)

	// Redirect to /home after 3 seconds when chat is completed
	useEffect(() => {
		if (chatCompleted) {
			const timer = setTimeout(() => {
				navigate("/home")
			}, 3000)

			return () => clearTimeout(timer)
		}
	}, [chatCompleted, navigate])

	// If chat is already completed, show completion message
	if (chatCompleted) {
		return (
			<>
				<style dangerouslySetInnerHTML={{ __html: progressStyles }} />
				<div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
					<div className="rounded-lg bg-white p-8 shadow-xl dark:bg-gray-800">
						<div className="flex flex-col items-center gap-6 text-center">
							<CheckCircle className="h-16 w-16 text-green-500" />
							<h1 className="font-bold text-3xl text-gray-900 dark:text-white">Thanks for joining UpSight!</h1>
							<p className="text-gray-600 text-lg dark:text-gray-300">
								We've received your responses and will be in touch when you're activated.
							</p>
							<p className="text-gray-500 text-sm dark:text-gray-400">First month free - as promised!</p>

							{/* Auto-redirect indicator */}
							<div className="flex flex-col items-center gap-3">
								<p className="text-gray-400 text-sm">Redirecting to home in 3 seconds...</p>
								<div className="h-1 w-32 overflow-hidden rounded-full bg-gray-200">
									<div
										className="h-full animate-pulse rounded-full bg-blue-500"
										style={{ animation: "progress 3s linear forwards" }}
									/>
								</div>
							</div>

							{/* Manual navigation option */}
							<Link
								to="/home"
								className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
							>
								<ArrowRight className="h-4 w-4" />
								Go to Home Now
							</Link>
						</div>
					</div>
				</div>
			</>
		)
	}

	return (
		<div className="flex h-full flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
			<div className="container mx-auto flex flex-1 flex-col overflow-y-auto p-4">
				<div className="mb-8 text-center">
					<h1 className="mb-2 font-bold text-4xl text-gray-900 dark:text-white">Welcome to UpSight!</h1>
					<p className="text-gray-600 text-lg dark:text-gray-300">
						Let's get to know you better. This will help us tailor your experience.
					</p>
					<p className="text-blue-600 text-sm dark:text-blue-400">Remember: Your first month is free!</p>
				</div>

				<CopilotKit
					runtimeUrl={copilotRuntimeUrl}
					agent="signupAgent"
					publicApiKey="ck_pub_ee4a155857823bf6b0a4f146c6c9a72f"
				>
					<ChatWithChecklist existingChatData={existingChatData} />
				</CopilotKit>
			</div>
		</div>
	)
}

function ChatWithChecklist({ existingChatData }: { existingChatData?: SignupChatData }) {
	// Use the agent state inside the CopilotKit context (from @copilotkit/react-core)
	const { state } = useCoAgent<AgentState>({
		name: "signupAgent",
		initialState: {
			goal: "Understand user's use case and collect data to help them get started with the app",
			plan: [
				{ milestone: "Welcome", completed: true },
				{ milestone: "Ask questions", completed: false },
				{ milestone: "Save data", completed: false },
			],
			signupChatData: {},
		},
	})

	// consola.log("checklist state:", state)

	useCopilotAction({
		name: "planTool",
		description: "Show the plan.",
		available: "frontend",
		parameters: [
			{ name: "goal", type: "string", required: true },
			{ name: "plan", type: "object[]", required: true },
		],
		render: ({ args }) => {
			return <PlanCard goal={args.goal} plan={args.plan} />
		},
	})

	return (
		<div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
			{/* Chat Area */}
			<div className="col-span-2 rounded-lg bg-white shadow-xl dark:bg-gray-800">
				<CopilotChat
					labels={{
						title: "UpSight Onboarding",
						initial:
							"Thanks for signing up for UpSight! 🎉 <br />Just a few quick questions: what's the core problem or use case you're hoping to solve?",
					}}
				/>
			</div>
			<div className="col-span-1">
				<PlanCard goal={state?.goal} plan={state?.plan} />
				<JsonDataCard title="Signup Data" jsonData={state?.signupChatData} />
			</div>
		</div>
	)
}
