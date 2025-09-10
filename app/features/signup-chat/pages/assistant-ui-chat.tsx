import { AssistantRuntimeProvider, makeAssistantVisible, useAssistantInstructions } from "@assistant-ui/react"
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk"
import { convertMessages } from "@mastra/core/agent"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useNavigate, useRouteLoaderData } from "react-router"
import { Conversation, ConversationContent, ConversationScrollButton } from "~/components/ai-elements/conversation"
import { Message, MessageContent } from "~/components/ai-elements/message"
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "~/components/ai-elements/prompt-input"
import { Response as AiResponse } from "~/components/ai-elements/response"
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "~/components/ai-elements/tool"
import { Thread } from "~/components/assistant-ui/thread"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import type { Route } from "./+types/assistant-ui-chat"
import consola from "consola"
import { memory } from "~/mastra/memory"
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

const DisplayUserQuestionsToolUI = makeAssistantToolUI({
	toolName: "displayUserQuestions",
	render: ({ args, result, status }) => (
		<Card>
			<CardHeader>
				<CardTitle>Display User Questions</CardTitle>
			</CardHeader>
			<CardContent>
				{args?.questions?.map((question) => (
					<p key={question}>{question}</p>
				))}
			</CardContent>
		</Card>
	)
})

// Via makeAssistantVisible's clickable option
const ClickableButton = makeAssistantVisible(Button, {
	clickable: true, // Provides a click tool
})

export async function loader({ context, request }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { client: supabase } = getServerClient(request)
	// Basic usage with default parameters
	const result = await memory.getThreadsByResourceIdPaginated({
		resourceId: `signupAgent-${user.sub}`,
		orderBy: "createdAt",
		sortDirection: "DESC",
		page: 0,
		perPage: 100,
	})

	consola.log("Result: ", result)
	let threadId = ""

	if (!(result?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId: `signupAgent-${user.sub}`,
			title: "Signup Chat",
			metadata: {
				user_id: user.sub,
			},
		})
		consola.log("New thread created: ", newThread)
		threadId = newThread.id
	} else {
		threadId = result.threads[0].id
	}

	// Get messages in the V2 format (roughly equivalent to AI SDK's UIMessage format)
	// const messagesV2 = await mastra.getStorage()?.getMessages({ threadId: threadId, resourceId: `signupAgent-${user.sub}`, format: 'v2' });
	const {
		messages: messagesV1,
		uiMessages,
		messagesV2,
	} = await memory.query({
		threadId: threadId,
		selectBy: {
			last: 50,
		},
	})
	const aiv5Messages = convertMessages(messagesV2).to("AIV5.UI")

	// Get existing chat data from user_settings
	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("signup_data")
		.eq("user_id", user.sub)
		.single()

	const existingChatData = userSettings?.signup_data

	return data({
		messages: aiv5Messages,
		existingChatData,
		user,
	})
}

export default function Assistant({ loaderData }: Route.ComponentProps) {
	const { messages, existingChatData, user } = loaderData
	const [onboardingData, setOnboardingData] = useState(existingChatData)
	const [chatCompleted, setChatCompleted] = useState(Boolean(existingChatData?.completed || false))
	const navigate = useNavigate()
	const runtime = useChatRuntime({
		transport: new AssistantChatTransport({
			api: "/api/chat/signup",
		}),
		messages,
	})

	const { clientEnv } = useRouteLoaderData("root")
	const chatRequired = Boolean(clientEnv?.SIGNUP_CHAT_REQUIRED === "true")
	// If signup chat is not required, or it's already completed, send users home immediately.
	useEffect(() => {
		if (!chatRequired) {
			navigate("/home")
		} else if (chatCompleted) {
			navigate("/signup-chat/completed")
		}
	}, [chatCompleted, navigate])

	// Mini progress for signup prescreen (4 core fields)
	const totalSteps = 4
	const completedSteps = [
		Boolean(onboardingData?.problem),
		Boolean(onboardingData?.need_to_learn || onboardingData?.other_feedback),
		Boolean(onboardingData?.content_types),
		Boolean(onboardingData?.challenges),
	].filter(Boolean).length

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<DisplayUserQuestionsToolUI />
			{/* <NavigateTool /> */}
			{/* <AddInstructions />
			<AddInstructions2 /> */}
			{/* <ClickableButton onClick={() => consola.log("button clicked")}>Click me</ClickableButton> */}
			{/* <div className="grid h-dvh grid-cols-[1fr] gap-x-2 px-4 py-4"> */}
			<div className="grid h-dvh grid-cols-1 gap-x-2 px-4 pt-16 pb-4 md:grid-cols-[200px_1fr] md:pt-4 lg:grid-cols-[400px_1fr]">
				<SignupDataWatcher
					userId={user?.sub}
					data={existingChatData}
					onDataUpdate={(data) => {
						consola.log("onDataUpdate", data)
						setOnboardingData(data)
					}}
					onCompleted={() => setChatCompleted(true)}
				/>
				{/* <ThreadList /> */}
				<div className="max-h-[95dvh]">
					{/* Header with mini progress */}
					<div className="mx-auto mb-2 w-full max-w-[var(--thread-max-width,44rem)]">
						<div className="flex items-center justify-between rounded-xl border bg-white/70 px-3 py-2 shadow-sm backdrop-blur dark:bg-neutral-900/70">
							<div className="flex items-center gap-2">
								<span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 text-xs ring-1 ring-blue-200 ring-inset dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800">
									Signup Chat
								</span>
								<span className="text-muted-foreground text-xs">Prescreen: 4 quick answers</span>
							</div>
							<MiniDotsProgress completed={completedSteps} total={totalSteps} />
						</div>
					</div>
					<Thread className="max-h-[90dvh]" />
				</div>
			</div>
		</AssistantRuntimeProvider>
	)
}

function AddInstructions() {
	useAssistantInstructions({
		instruction: "This is a test",
		disabled: false,
	})
	return null
}

function AddInstructions2() {
	useAssistantInstructions({
		instruction: "This is a test 2",
		disabled: false,
	})
	return null
}

import { makeAssistantTool, tool } from "@assistant-ui/react"
import { useEffect, useState } from "react"
import { z } from "zod"
import { SignupDataWatcher } from "../components/SignupDataWatcher"

// Define the tool using the tool() helper
const submitForm = tool({
	parameters: z.object({
		path: z.string(),
	}),
	execute: async ({ path }) => {
		// Implementation
		consola.log("path", path)
		return { success: true }
	},
})

// Create a tool component
const NavigateTool = makeAssistantTool({
	...submitForm,
	toolName: "navigate",
})

function MiniDotsProgress({ completed, total }: { completed: number; total: number }) {
	const dots = Array.from({ length: total })
	return (
		<div className="flex items-center gap-1.5" aria-label={`Progress ${completed} of ${total}`}>
			{dots.map((_, i) => (
				<span
					key={i}
					className={
						"h-2 w-2 rounded-full " + (i < completed ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700")
					}
				/>
			))}
		</div>
	)
}
