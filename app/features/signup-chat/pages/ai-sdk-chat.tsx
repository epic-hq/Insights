import { useChat } from "@ai-sdk/react"
import { convertMessages } from "@mastra/core/agent"
import { DefaultChatTransport } from "ai"
import consola from "consola"
import { useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useNavigate, useRouteLoaderData } from "react-router"
import { Conversation, ConversationContent, ConversationScrollButton } from "~/components/ai-elements/conversation"
import { Message, MessageContent } from "~/components/ai-elements/message"
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "~/components/ai-elements/prompt-input"
import { Response as AiResponse } from "~/components/ai-elements/response"
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "~/components/ai-elements/tool"
import { Input } from "~/components/ui/input"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { memory } from "~/mastra/memory"

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

	return data({
		messages: aiv5Messages,
	})
}

export const ConversationDemo = () => {
	const [input, setInput] = useState("")
	const { messages: initialMessages } = useLoaderData()
	const { messages, sendMessage, status } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/chat/signup",
		}),
		messages: initialMessages,
	})

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (input.trim()) {
			sendMessage({ text: input })
			setInput("")
		}
	}

	return (
		<div className="relative mx-auto size-full h-[90vh] max-w-4xl rounded-lg border p-0 md:p-6">
			<div className="flex h-full flex-col">
				<Conversation>
					<ConversationContent>
						{messages?.map((message) => (
							<Message from={message.role} key={message.id}>
								<MessageContent>
									{message?.parts?.map((part, i) => {
										switch (part.type) {
											case "tool-saveUserSettingsData":
												return (
													<Tool>
														<ToolHeader type="Update Response" state={part.state} />
														<ToolContent>
															{/* <ToolInput input={part.input} /> */}
															<ToolOutput
																errorText={part.errorText}
																// output={
																// 	<div>
																// 		{Object.entries(part.output?.data as Record<string, unknown>).map(
																// 			([key, value]) => (
																// 				<div key={key} className="flex flex-rowl gap-2">
																// 					<span className="font-bold">{key}</span>: <span>{value}</span>
																// 				</div>
																// 			)
																// 		)}
																// 	</div>
																// }
															/>
														</ToolContent>
													</Tool>
												)
											case "text": // we don't use any reasoning or tool calls in this example
												return <AiResponse key={`${message.id}-${i}`}>{part.text}</AiResponse>
											default:
												return null
										}
									})}
								</MessageContent>
							</Message>
						))}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				<PromptInput onSubmit={handleSubmit} className="relative mx-auto mt-4 w-full max-w-2xl">
					<PromptInputTextarea
						value={input}
						placeholder="Say something..."
						onChange={(e) => setInput(e.currentTarget.value)}
						className="pr-12"
					/>
					<PromptInputSubmit
						status={status === "streaming" ? "streaming" : "ready"}
						disabled={!input.trim()}
						className="absolute right-1 bottom-1"
					/>
				</PromptInput>
			</div>
		</div>
	)
}

export default ConversationDemo
