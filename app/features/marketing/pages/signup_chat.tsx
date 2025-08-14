import { CopilotKit, useCoAgent, useCopilotReadable } from "@copilotkit/react-core"
import { CopilotChat } from "@copilotkit/react-ui"
import { useEffect, useMemo } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useNavigate } from "react-router"
import "@copilotkit/react-ui/styles.css"
import { ArrowRight, CheckCircle } from "lucide-react"
// Agent state type from Mastra agents
import type { Database } from "~/../supabase/types"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { PATHS } from "~/paths"

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

// Remove unused AgentState type alias

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
			<div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
				<div className="rounded-lg bg-white p-8 shadow-xl dark:bg-gray-800">
					<div className="flex flex-col items-center gap-4 text-center">
						<CheckCircle className="h-16 w-16 text-green-500" />
						<h1 className="font-bold text-3xl text-gray-900 dark:text-white">Thanks for joining UpSight!</h1>
						<p className="text-gray-600 text-lg dark:text-gray-300">
							We've received your responses and will be in touch when you're activated.
						</p>
						<p className="text-gray-500 text-sm dark:text-gray-400">First month free - as promised!</p>
						<Link to={PATHS.HOME} className="mt-8 inline-flex items-center gap-2">
							<ArrowRight className="h-4 w-4" />
							Go to Home
						</Link>
					</div>
				</div>
			</div>
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

				<CopilotKit runtimeUrl={copilotRuntimeUrl} agent="signupAgent">
					<ChatWithChecklist existingChatData={existingChatData} />
				</CopilotKit>
			</div>
		</div>
	)
}

function ChatWithChecklist({ existingChatData }: { existingChatData?: SignupChatData }) {
	// Use the agent state inside the CopilotKit context (from @copilotkit/react-core)
	const { state } = useCoAgent({
		name: "signupAgent",
		initialState: {
			plan: ["Welcome", "Ask questions", "Save data", "Complete"],
			signupChatData: existingChatData,
		},
	})

	// Create dynamic checklist based on agent state and existing data
	const todoList = useMemo(() => {
		const signupData = (state as any).signupChatData || existingChatData || {}

		return {
			name: "Signup Questions",
			items: [
				{ id: 1, name: "problem", completed: Boolean(signupData.problem) },
				{ id: 2, name: "challenges", completed: Boolean(signupData.challenges) },
				{ id: 3, name: "importance", completed: Boolean(signupData.importance) },
				{ id: 4, name: "ideal_solution", completed: Boolean(signupData.ideal_solution) },
				{ id: 5, name: "content_types", completed: Boolean(signupData.content_types) },
				{ id: 6, name: "other_feedback", completed: Boolean(signupData.other_feedback) },
			],
			completed: Boolean(signupData.completed),
		}
	}, [state, existingChatData])

	// Expose to the agent as shared state (must be inside <CopilotKit>)
	useCopilotReadable({
		description:
			"Signup Questions checklist: problem, challenges, importance, ideal_solution, content_types, other_feedback, plus completed flag.",
		value: todoList,
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
					className="h-full"
				/>
			</div>

			{/* Checklist Widget (shared agent state visualization) */}
			<div className="rounded-lg bg-white p-4 shadow-xl dark:bg-gray-800">
				<h2 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Signup Checklist</h2>
				<ul className="space-y-2">
					{todoList.items.map((item) => (
						<li
							key={item.id}
							className="flex items-center justify-between rounded-md border border-gray-200 p-2 text-sm dark:border-gray-700"
						>
							<span className="text-gray-700 dark:text-gray-200">{item.name}</span>
							{item.completed ? (
								<CheckCircle className="h-4 w-4 text-green-500" />
							) : (
								<div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
							)}
						</li>
					))}
				</ul>
				<div className="mt-4 flex items-center gap-2">
					{todoList.completed ? (
						<>
							<CheckCircle className="h-5 w-5 text-green-500" />
							<span className="text-green-600 text-sm dark:text-green-400">Completed</span>
						</>
					) : (
						<span className="text-gray-500 text-sm dark:text-gray-400">In progress</span>
					)}
				</div>
			</div>
		</div>
	)
}
