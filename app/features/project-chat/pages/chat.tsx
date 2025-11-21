import { useChat } from "@ai-sdk/react"
import { convertMessages } from "@mastra/core/agent"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import consola from "consola"
import { useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useParams } from "react-router"
import { Conversation, ConversationContent, ConversationScrollButton } from "~/components/ai-elements/conversation"
import { Message, MessageContent } from "~/components/ai-elements/message"
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "~/components/ai-elements/prompt-input"
import { Response as AiResponse } from "~/components/ai-elements/response"
import { Button } from "~/components/ui/button"
import { TextShimmer } from "~/components/ui/text-shimmer"
import { cn } from "~/lib/utils"
import { memory } from "~/mastra/memory"
import type { UpsightMessage } from "~/mastra/message-types"
import { userContext } from "~/server/user-context"

export const handle = { hideProjectStatusAgent: true } as const

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const projectId = params.projectId as string
	const accountId = params.accountId as string
	if (!projectId || !accountId) {
		throw new Response("Missing accountId or projectId", { status: 400 })
	}

	// Progress: fetch current project_sections
	const { data: sections } = await supabase
		.from("project_sections")
		.select("kind, meta, content_md")
		.eq("project_id", projectId)

	const keys = [
		"research_goal",
		"decision_questions",
		"assumptions",
		"unknowns",
		"target_orgs",
		"target_roles",
	] as const

	const byKind = new Map<string, any>((sections || []).map((s: any) => [s.kind, s]))
	const isFilled = (kind: string) => {
		const s = byKind.get(kind)
		if (!s) return false
		const m = (s.meta || {}) as Record<string, any>
		switch (kind) {
			case "research_goal":
				return Boolean(m.research_goal || s.content_md?.trim())
			case "decision_questions":
			case "assumptions":
			case "unknowns":
			case "target_orgs":
			case "target_roles":
				return Array.isArray(m[kind]) ? m[kind].length > 0 : false
			default:
				return false
		}
	}
	const completedCount = keys.reduce((acc, k) => acc + (isFilled(k) ? 1 : 0), 0)
	const totalCount = keys.length

	const userId = ctx.claims.sub
	const resourceId = `projectSetupAgent-${userId}-${projectId}`
	const result = await memory.getThreadsByResourceIdPaginated({
		resourceId,
		orderBy: "createdAt",
		sortDirection: "DESC",
		page: 0,
		perPage: 100,
	})

	let threadId = ""
	if (!(result?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId,
			title: `Project Setup ${projectId}`,
			metadata: { user_id: userId, project_id: projectId, account_id: accountId },
		})
		consola.log("New project-setup thread created: ", newThread)
		threadId = newThread.id
	} else {
		threadId = result.threads[0].id
	}

	const { messagesV2 } = await memory.query({
		threadId,
		selectBy: { last: 50 },
	})
	const aiv5Messages = convertMessages(messagesV2).to("AIV5.UI") as UpsightMessage[]

	return data({ messages: aiv5Messages, progress: { completedCount, totalCount }, threadId })
}

export default function ProjectChatPage() {
	const { messages: initialMessages, progress } = useLoaderData<typeof loader>()
	const { accountId, projectId } = useParams()
	const [input, setInput] = useState("")

	// AI SDK chat with modern pattern
	const { messages, sendMessage, status } = useChat<UpsightMessage>({
		transport: new DefaultChatTransport({
			api: `/a/${accountId}/${projectId}/api/chat/project-setup`,
		}),
		messages: initialMessages,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
	})

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (input.trim()) {
			sendMessage({ text: input })
			setInput("")
		}
	}

	return (
		<div className="grid h-dvh grid-cols-1 gap-x-2 px-2 pt-2 pb-4 md:px-4 md:pt-4">
			{/* Header */}
			<div className="mx-auto mb-2 w-full md:max-w-[var(--thread-max-width,44rem)]">
				<div className="flex items-center justify-between rounded-xl border bg-white/70 px-2 py-2 shadow-sm backdrop-blur md:px-3 dark:bg-neutral-900/70">
					<div className="flex items-center gap-2">
						<span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 text-xs ring-1 ring-blue-200 ring-inset dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800">
							Setup Chat
						</span>
						<span className="text-muted-foreground text-xs">Provide some background information</span>
					</div>
					<div className="flex items-center gap-3">
						<MiniDotsProgress completed={progress.completedCount} total={progress.totalCount} />
						<Link to={`/a/${accountId}/${projectId}/setup`}>
							<Button variant="outline" size="sm">
								Use Form Instead
							</Button>
						</Link>
					</div>
				</div>
			</div>

			{/* Chat Interface */}
			<div className="mx-auto flex h-full w-full flex-col md:max-w-[var(--thread-max-width,44rem)]">
				<Conversation>
					<ConversationContent>
						{messages?.map((message) => (
							<Message from={message.role} key={message.id}>
								<MessageContent>
									{message?.parts?.map((part, i) => {
										switch (part.type) {
											case "text":
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

				<div className="flex flex-row justify-between gap-2">
					<span>
						<TextShimmer
							className={cn(
								"mt-1 hidden font-mono text-sm",
								status === "streaming" || (status === "submitted" && "block")
							)}
							duration={3}
						>
							Thinking...
						</TextShimmer>
						<div className={cn("mt-1 hidden font-mono text-destructive text-sm", status === "error" && "block")}>
							Error
						</div>
					</span>
				</div>
				<PromptInput onSubmit={handleSubmit} className="relative mx-auto mt-1 mb-6 w-full">
					<PromptInputTextarea
						value={input}
						placeholder="Ask about your project setup..."
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

function MiniDotsProgress({ completed, total }: { completed: number; total: number }) {
	const dots = Array.from({ length: total })
	return (
		<div className="flex items-center gap-1.5" aria-label={`Progress ${completed} of ${total}`}>
			{dots.map((_, i) => (
				<span
					key={i}
					className={`h-2 w-2 rounded-full ${i < completed ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
				/>
			))}
		</div>
	)
}
