import { useChat } from "@ai-sdk/react"
import { convertMessages } from "@mastra/core/agent"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import consola from "consola"
import { Brain, Check, Loader, Pencil, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useNavigate, useRouteLoaderData } from "react-router"
import { Streamdown } from "streamdown"
import { Conversation, ConversationContent, ConversationScrollButton } from "~/components/ai-elements/conversation"
import { Message, MessageContent } from "~/components/ai-elements/message"
import { Response as AiResponse } from "~/components/ai-elements/response"
import { Task, TaskContent, TaskTrigger } from "~/components/ai-elements/task"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import type { UpsightMessage } from "~/mastra/message-types"

type UpsightMessagePart = UpsightMessage["parts"][number]

export function Messages({ messages }: { messages: UpsightMessage[] }) {
	return (
		<Conversation>
			<ConversationContent>
				{messages?.map((message) => (
					<Message from={message.role} key={message.id}>
						<MessageContent>
							{message?.parts?.map((part, i) => {
								return renderMessagePart({ message, part, i })
							})}
						</MessageContent>
					</Message>
				))}
			</ConversationContent>
			<ConversationScrollButton />
		</Conversation>
	)
}

type RenderMessagePartProps = {
	message: UpsightMessage
	part: UpsightMessagePart
	i: number
}

export function renderMessagePart({ message, part, i }: RenderMessagePartProps) {
	switch (part.type) {
		// @ts-expect-error - this is mastra built in tool
		case "tool-updateWorkingMemory":
			return (
				<Task key={part}>
					<TaskTrigger title="Update Working Memory" icon={<Brain className="size-4" />} />
					<TaskContent>
						{/* @ts-expect-error - this is mastra built in tool */}
						<Streamdown className="rounded-2xl bg-white p-2">{(part?.input?.memory as string) || ""}</Streamdown>
					</TaskContent>
				</Task>
			)
		case "tool-displayUserQuestions":
			switch (part.state) {
				case "input-streaming":
					return <Loader />
				case "input-available":
					return (
						<Card>
							<CardHeader>
								<CardTitle>Research Questions</CardTitle>
							</CardHeader>
							<CardContent>
								{part.input?.questions?.map((question, i) => (
									<div key={i}>{question}</div>
								))}
							</CardContent>
						</Card>
					)
				case "output-available":
					return (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Check /> Research Questions
								</CardTitle>
							</CardHeader>
							<CardContent>
								{part.input?.questions?.map((question, i) => (
									<div key={i}>{question}</div>
								))}
							</CardContent>
						</Card>
					)
				default:
					// Prevent fall-through to the next outer switch case if state is unknown
					return null
			}
		case "tool-saveUserSettingsData":
			return (
				<Task className="rounded-lg border p-4">
					<TaskTrigger title="Saved details" icon={<Pencil className="size-4" />} />
					<TaskContent>
						{/* {part?.output?.message} */}
						{part?.output?.data?.challenges && (
							<div>
								<span className="font-bold">Challenges:</span> {part?.output?.data?.challenges}
							</div>
						)}
						{part?.output?.data?.content_types && (
							<div>
								<span className="font-bold">Content Types:</span> {part?.output?.data?.content_types}
							</div>
						)}
						{part?.output?.data?.goal && (
							<div>
								<span className="font-bold">Goal:</span> {part?.output?.data?.goal}
							</div>
						)}
						{part?.output?.data?.other_feedback && (
							<div>
								<span className="font-bold">Other Feedback:</span> {part?.output?.data?.other_feedback}
							</div>
						)}
						{part?.output?.data?.completed && (
							<div className="flex items-center gap-2">
								<span className="font-bold">Completed:</span>{" "}
								{part?.output?.data?.completed ? (
									<Check className="size-4 text-emerald-500" />
								) : (
									<X className="size-4" />
								)}
							</div>
						)}
						{/* {process.env.NODE_ENV === "development" && JSON.stringify(part?.output?.data)} */}
					</TaskContent>
				</Task>
			)
		case "tool-saveProjectSectionsData":
			return (
				<Task className="rounded-lg border p-4">
					<TaskTrigger title="Save sections" icon={<Pencil className="size-4" />} />
					<TaskContent>{part?.output?.message}</TaskContent>
				</Task>
			)
		case "text": // we don't use any reasoning or tool calls in this example
			return <AiResponse key={`${message.id}-${i}`}>{part.text}</AiResponse>
		default:
			return null
	}
}
