import { CopilotKit, useCoAgent } from "@copilotkit/react-core"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useNavigate, useRouteLoaderData } from "react-router"
import "@copilotkit/react-ui/styles.css"

// Add custom CSS for progress animation
const progressStyles = `
@keyframes progress {
  from { width: 0%; }
  to { width: 100%; }
}
`

import consola from "consola"
import { ArrowLeft, ArrowRight, CheckCircle, Mic, Send, User } from "lucide-react"
import type { z } from "zod"
import { JsonDataCard } from "~/features/signup-chat/components/JsonDataCard"
import { createClient } from "~/lib/supabase/client"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import type { SignupAgentState } from "~/mastra/agents"

type AgentState = z.infer<typeof SignupAgentState>

export async function loader({ context, request }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { client: supabase } = getServerClient(request)

	// Optional restart to clear prior answers
	const url = new URL(request.url)
	const restart = url.searchParams.get("restart") === "1"
	if (restart) {
		await supabase.rpc("upsert_signup_data", {
			p_user_id: user.sub,
			p_signup_data: { completed: false },
		})
	}

	// Get existing chat data from user_settings
	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("signup_data")
		.eq("user_id", user.sub)
		.single()

	const existingChatData = userSettings?.signup_data as AgentState

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
		const chatData = JSON.parse(formData.get("chatData") as string) as AgentState

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
	const { clientEnv } = useRouteLoaderData("root")
	const { existingChatData, copilotRuntimeUrl, user } = useLoaderData() as any
	const navigate = useNavigate()
	const chatCompleted = Boolean(existingChatData?.completed || false)
	const chatRequired = Boolean(clientEnv?.SIGNUP_CHAT_REQUIRED === "true")
	const supabase = createClient()

	console.log("ClientEnv: ", clientEnv, chatCompleted, chatRequired)

	// If signup chat is not required, or it's already completed, send users home immediately.
	useEffect(() => {
		if (chatCompleted || !chatRequired) {
			console.log("Redirecting to /home")
			navigate("/home")
		}
	}, [chatCompleted, chatRequired, navigate])

	useEffect(() => {
		if (!user?.sub) return
		const channel = supabase
			.channel("signup_data_watch")
			.on(
				"postgres_changes",
				{ event: "UPDATE", schema: "public", table: "user_settings", filter: `user_id=eq.${user.sub}` },
				(payload) => {
					try {
						const completed = (payload.new as any)?.signup_data?.completed === true
						if (completed) navigate("/home")
					} catch {}
				}
			)
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [supabase, user?.sub, navigate])

	// If chat is already completed, show completion message
	if (chatCompleted) {
		return (
			<>
				<style dangerouslySetInnerHTML={{ __html: progressStyles }} />
				<div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
					{/* Header */}
					<header className="border-gray-200 border-b bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
						<div className="mx-auto flex max-w-2xl items-center justify-between">
							<Link
								to="/home"
								className="flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
							>
								<ArrowLeft className="h-5 w-5" />
								Back
							</Link>
							<div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
								<CheckCircle className="h-4 w-4 text-green-500" />
								<span className="text-gray-700 text-sm dark:text-gray-300">Complete</span>
							</div>
						</div>
					</header>

					{/* Progress Bar */}
					{/* <div className="border-gray-200 border-b bg-white dark:border-gray-800 dark:bg-gray-900">
						<div className="mx-auto max-w-2xl px-4">
							<div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
								<div className="h-full w-full rounded-full bg-purple-500" />
							</div>
						</div>
					</div> */}

					{/* Main Content */}
					<main className="flex flex-1 items-center justify-center px-4 py-16">
						<div className="w-full max-w-lg text-center">
							<div className="mb-8">
								<CheckCircle className="mx-auto mb-6 h-16 w-16 text-green-500" />
								<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-white">Welcome to UpSight!</h1>
								<p className="mb-2 text-gray-600 text-lg leading-relaxed dark:text-gray-300">Let's go!</p>
							</div>

							{/* Auto-redirect indicator */}
							<div className="mb-8">
								<p className="mb-3 text-gray-500 text-sm dark:text-gray-400">Redirecting to home in 3 seconds...</p>
								<div className="mx-auto h-1 w-48 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
									<div
										className="h-full rounded-full bg-purple-500"
										style={{ animation: "progress 3s linear forwards" }}
									/>
								</div>
							</div>

							{/* Action Button */}
							<Link
								to="/home"
								className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-4 font-semibold text-white transition-all hover:bg-purple-700 hover:shadow-lg"
							>
								<ArrowRight className="h-5 w-5" />
								Get Started Now
							</Link>
							<div className="mt-3">
								<Link to="/signup-chat?restart=1" className="text-gray-500 text-xs underline">
									Start over (capture fresh answers)
								</Link>
							</div>
						</div>
					</main>
				</div>
			</>
		)
	}

	return (
		<div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
			{/* Header */}
			<header className="border-gray-200 border-b bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
				<div className="mx-auto flex max-w-2xl items-center justify-between">
					<Link
						to="/"
						className="flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
					>
						<ArrowLeft className="h-5 w-5" />
						Back
					</Link>
					<div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
						<div className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
						<span className="text-gray-700 text-sm dark:text-gray-300">Setup</span>
					</div>
				</div>
			</header>

			{/* Progress Bar */}
			{/* <div className="border-gray-200 border-b bg-white dark:border-gray-800 dark:bg-gray-900">
				<div className="mx-auto max-w-2xl px-4">
					<div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
						<div className="h-full w-1/3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600" />
					</div>
				</div>
			</div> */}

			{/* Main Content */}
			<main className="flex flex-1 flex-col">
				<div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
					<DeterministicSignupChat existingChatData={existingChatData} />
				</div>
			</main>
		</div>
	)
}

function ModernChatInterface({ existingChatData }: { existingChatData?: any }) {
	// Use the agent state inside the CopilotKit context (from @copilotkit/react-core)
	const { state } = useCoAgent<AgentState>({
		name: "signupAgent",
		// initialState: existingChatData,
	})

	useEffect(() => {
		consola.log("[signupAgent state]", state)
	}, [state])

	return (
		<div className="flex flex-1 flex-col">
			{/* Hero Section */}
			<div className="mb-8 text-center">
				<div className="mb-4">
					<h1 className="font-bold text-3xl text-gray-900 dark:text-white">Welcome to UpSight 🎉</h1>
				</div>
			</div>

			{/* Chat Interface */}
			<div className="flex-1 rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
				{/* AI Agent Header */}
				<div className="border-gray-100 border-b p-4 dark:border-gray-700">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600">
							<span className="font-bold text-3xl text-white">🤖</span>
						</div>
						<div>
							<h3 className="font-semibold text-gray-900 dark:text-white">Uppy Assistant</h3>
						</div>
					</div>
				</div>

				{/* CopilotChat with custom styling */}
				<div className="h-[500px]">
					<CopilotChat
						labels={{
							title: "",
							initial: "What business objective are you trying to achieve?",
						}}
						className="h-full"
					/>
				</div>
			</div>

			{/* Alternative Input Options */}
			{process.env.NODE_ENV === "development" && (
				<div
					className="mt-8 text-center"
					onClick={() => {
						alert("Coming soon")
					}}
				>
					<div className="mb-4 flex items-center justify-center gap-4">
						<button className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 transition-all hover:bg-purple-700 hover:shadow-lg">
							<Mic className="h-6 w-6 text-white" />
						</button>
					</div>
					<p className="mb-3 text-gray-600 text-sm dark:text-gray-400">Start a voice conversation</p>
				</div>
			)}

			{/* Development Panel */}
			{process.env.NODE_ENV === "development" && (
				<div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
					<h4 className="mb-2 font-semibold text-gray-900 text-sm dark:text-white">Development Panel</h4>
					<JsonDataCard title="Signup Data" jsonData={state?.signupChatData} />
				</div>
			)}
		</div>
	)
}

// Deterministic client-driven chat that calls the workflow endpoint per turn
function DeterministicSignupChat({ existingChatData }: { existingChatData?: any }) {
	const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; text: string }>>([])
	const [pending, setPending] = useState(false)
	const [input, setInput] = useState("")
	const [state, setState] = useState<any>(() => existingChatData ?? {})
	const navigate = useNavigate()
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	const initialState = useMemo(() => existingChatData ?? {}, [existingChatData])

	useEffect(() => {
		let cancelled = false
		async function bootstrap() {
			if ((initialState?.completed ?? false) === true) return
			try {
				const res = await fetch("/api/signup-next-turn", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ message: "", state: initialState }),
				})
				const data = await res.json()
				if (cancelled) return
				setState(data.state ?? {})
				if (typeof data.reply === "string" && data.reply.trim().length > 0) {
					setMessages([{ role: "assistant", text: data.reply }])
				}
			} catch {
				setMessages([{ role: "assistant", text: "What business objective are you trying to achieve?" }])
			}
			inputRef.current?.focus()
		}
		bootstrap()
		return () => {
			cancelled = true
		}
	}, [initialState])

	async function send() {
		const content = input.trim()
		if (!content || pending) return
		setInput("")
		setMessages((m) => [...m, { role: "user", text: content }])
		setPending(true)
		try {
			const res = await fetch("/api/signup-next-turn", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: content, state }),
			})
			const data = await res.json()
			setState(data.state ?? {})
			if (typeof data.reply === "string") {
				setMessages((m) => [...m, { role: "assistant", text: data.reply }])
			}
			if (data.completed === true) {
				setPending(true)
				setTimeout(() => navigate("/home"), 5000)
			}
		} catch {
			setMessages((m) => [
				...m,
				{ role: "assistant", text: "Sorry — hit a hiccup. What business objective are you trying to achieve?" },
			])
		} finally {
			setPending(false)
			inputRef.current?.focus()
		}
	}

	// Ensure input stays focused after bot replies
	useEffect(() => {
		if (messages.length && messages[messages.length - 1].role === "assistant") {
			inputRef.current?.focus()
		}
	}, [messages])

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			void send()
		}
	}

	// Always scroll to bottom on new messages or pending
	useEffect(() => {
		const el = listRef.current
		if (!el) return
		el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
	}, [messages, pending])

	return (
		<div className="flex flex-1 flex-col">
			<div className="mb-4 text-center">
				<h1 className="font-bold text-3xl text-gray-900 dark:text-white">Welcome to UpSight 🎉</h1>
			</div>

			<div className="flex-1 rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
				<div className="border-gray-100 border-b p-4 dark:border-gray-700">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600">
							<span className="font-bold text-3xl text-white">🤖</span>
						</div>
						<div>
							<h3 className="font-semibold text-gray-900 dark:text-white">Uppy Assistant</h3>
						</div>
					</div>
				</div>

				<div className="flex h-[500px] flex-col p-4">
					<div ref={listRef} className="flex-1 space-y-3 overflow-y-auto pr-2">
						{messages.map((m, i) => (
							<div key={i} className={m.role === "assistant" ? "text-gray-900 dark:text-white" : "text-right"}>
								<div
									className={
										m.role === "assistant"
											? "inline-block max-w-[80%] rounded-2xl bg-gray-100 px-4 py-2 text-sm dark:bg-gray-700"
											: "inline-block max-w-[80%] rounded-2xl bg-purple-600 px-4 py-2 text-sm text-white"
									}
								>
									{m.text}
								</div>
							</div>
						))}
						{pending && <div className="text-gray-500 text-sm">Thinking…</div>}
					</div>

					<div className="mt-3 flex items-center gap-2">
						<input
							ref={inputRef}
							className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
							placeholder="Type your answer…"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={onKeyDown}
							disabled={pending}
						/>
						<button
							onClick={() => void send()}
							disabled={pending}
							className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-white hover:bg-purple-700 disabled:opacity-60"
							aria-label="Send"
						>
							<Send className="h-4 w-4" />
						</button>
					</div>
				</div>
			</div>

			{process.env.NODE_ENV === "development" && (
				<div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
					<h4 className="mb-2 font-semibold">Debug</h4>
					<JsonDataCard title="State" jsonData={state} />
				</div>
			)}
		</div>
	)
}

function ChatWithChecklist({ existingChatData }: { existingChatData?: any }) {
	// Legacy component - keeping for backwards compatibility
	const { state } = useCoAgent<AgentState>({
		name: "signupAgent",
	})

	return (
		<div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
			<div className="col-span-2 rounded-lg bg-white shadow-xl dark:bg-gray-800">
				<CopilotChat
					labels={{
						title: "UpSight Signup Chat",
						initial:
							"Hi, welcome to UpSight. I'm Uppy! Lets get you started gathering insights to level up your business.<br />What brings you here today?",
					}}
				/>
			</div>
			{process.env.NODE_ENV === "development" && (
				<div className="col-span-1">
					Development:
					<JsonDataCard title="Signup Data" jsonData={state?.signupChatData} />
				</div>
			)}
		</div>
	)
}
