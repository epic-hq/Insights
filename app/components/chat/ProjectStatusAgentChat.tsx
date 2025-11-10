import { useChat } from "@ai-sdk/react"
import type { ToolCallPart, ToolResultPart } from "ai"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { BotMessageSquare, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFetcher } from "react-router"
import { Response as AiResponse } from "~/components/ai-elements/response"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"
import type { UpsightMessage } from "~/mastra/message-types"

interface ProjectStatusAgentChatProps {
	accountId: string
	projectId: string
	systemContext: string
	onCollapsedChange?: (collapsed: boolean) => void
}

export function ProjectStatusAgentChat({
	accountId,
	projectId,
	systemContext,
	onCollapsedChange,
}: ProjectStatusAgentChatProps) {
	const [input, setInput] = useState("")
	const [isCollapsed, setIsCollapsed] = useState(() => {
		if (typeof window === "undefined") return false
		return localStorage.getItem("project-chat-collapsed") === "true"
	})
	const messagesEndRef = useRef<HTMLDivElement | null>(null)
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)
	const historyFetcher = useFetcher<{ messages: UpsightMessage[] }>()
	const routes = { api: { chat: { projectStatus: () => `/a/${accountId}/${projectId}/api/chat/project-status` } } }

	// Load chat history when project changes
	useEffect(() => {
		if (!accountId || !projectId) return
		historyFetcher.load(`/a/${accountId}/${projectId}/api/chat/project-status/history`)
		// Avoid adding historyFetcher dependency; identity flips on state updates and would re-run this effect endlessly.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [accountId, projectId])

	const { messages, sendMessage, status, setMessages } = useChat<UpsightMessage>({
		transport: new DefaultChatTransport({
			api: routes.api.chat.projectStatus(),
			body: { system: systemContext },
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
	})

	// Set messages from history when loaded
	useEffect(() => {
		if (historyFetcher.data?.messages && historyFetcher.data.messages.length > 0) {
			setMessages(historyFetcher.data.messages)
		}
	}, [historyFetcher.data, setMessages])

	const visibleMessages = useMemo(() => (messages ?? []).slice(-12), [messages])
	let lastVisibleMessageKey = "none"
	if (visibleMessages.length > 0) {
		lastVisibleMessageKey = visibleMessages[visibleMessages.length - 1]?.id ?? `len-${visibleMessages.length}`
	}

	useEffect(() => {
		if (!lastVisibleMessageKey) return
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
		}
	}, [lastVisibleMessageKey])

	// Auto-focus the textarea when component mounts
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem("project-chat-collapsed", String(isCollapsed))
		}
		if (textareaRef.current && !isCollapsed) {
			textareaRef.current.focus()
		}
		onCollapsedChange?.(isCollapsed)
	}, [isCollapsed, onCollapsedChange])

	const submitMessage = () => {
		const trimmed = input.trim()
		if (!trimmed) return
		sendMessage({ text: trimmed })
		setInput("")
	}

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		submitMessage()
	}

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter") {
			if (event.shiftKey) {
				// Shift+Enter: Allow newline
				return
			}
			// Enter: Submit
			event.preventDefault()
			submitMessage()
		}
	}

	const isBusy = status === "streaming" || status === "submitted"
	const isError = status === "error"

	return (
		<div
			className={cn(
				"flex h-full flex-col overflow-hidden transition-all duration-200",
				isCollapsed ? "w-12" : "min-w-[260px] w-full"
			)}
		>
			<Card className="flex h-full min-h-0 flex-col border-0 bg-background/80 shadow-none ring-1 ring-border/60 backdrop-blur sm:rounded-xl sm:shadow-sm">
				<CardHeader
					className={cn("flex-shrink-0 transition-all duration-200", isCollapsed ? "p-2" : "p-3 pb-2 sm:p-4")}
				>
					<div className="flex items-center justify-between">
						{!isCollapsed && (
							<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
								<BotMessageSquare className="h-4 w-4 text-blue-600" />
								Ask Project Assistant
							</CardTitle>
						)}
						{isCollapsed && (
							<div
								onClick={() => setIsCollapsed(!isCollapsed)}
								className="mx-auto flex cursor-pointer flex-col items-center gap-1 transition-opacity hover:opacity-80"
								aria-label="Toggle chat"
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault()
										setIsCollapsed(!isCollapsed)
									}
								}}
							>
								<BotMessageSquare className="h-5 w-5 text-blue-600" />
								<span className="whitespace-nowrap font-medium text-[10px] text-muted-foreground leading-tight opacity-90">
									Ask AI
								</span>
							</div>
						)}
						{!isCollapsed && (
							<div
								onClick={() => setIsCollapsed(!isCollapsed)}
								className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
								aria-label="Collapse chat"
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault()
										setIsCollapsed(!isCollapsed)
									}
								}}
							>
								<ChevronRight className="h-4 w-4" />
							</div>
						)}
					</div>
				</CardHeader>
				{!isCollapsed && (
					<CardContent className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
						<div className="min-h-0 flex-1 overflow-hidden">
							{visibleMessages.length === 0 ? (
								<p className="text-foreground/70 text-xs sm:text-sm">Hey, how can I help?</p>
							) : (
								<div className="h-full space-y-3 overflow-y-auto text-xs sm:text-sm">
									{visibleMessages.map((message, index) => {
										const key = message.id || `${message.role}-${index}`
										const isUser = message.role === "user"
										const textParts =
											message.parts?.map((part) => {
												if (part.type === "text") return part.text
												if (part.type === "tool-call") {
													const toolPart = part as ToolCallPart
													return `Requesting tool: ${toolPart.toolName ?? "unknown"}`
												}
												if (part.type === "tool-result") {
													const toolPart = part as ToolResultPart
													return `Tool result: ${toolPart.toolName ?? "unknown"}`
												}
												return ""
											}) ?? []
										const messageText = textParts.filter(Boolean).join("\n").trim()
										return (
											<div key={key} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
												<div className="max-w-[85%]">
													<div className="mb-1 text-[10px] text-foreground/60 uppercase tracking-wide">
														{isUser ? "You" : "Project Assistant"}
													</div>
													<div
														className={cn(
															"whitespace-pre-wrap rounded-lg px-3 py-2 shadow-sm",
															isUser ? "bg-blue-600 text-white" : "bg-background text-foreground ring-1 ring-border/60"
														)}
													>
														{messageText ? (
															isUser ? (
																<span className="whitespace-pre-wrap">{messageText}</span>
															) : (
																<AiResponse key={key}>{messageText}</AiResponse>
															)
														) : !isUser ? (
															<span className="text-foreground/70 italic">Thinking...</span>
														) : (
															<span className="text-foreground/70">(No text response)</span>
														)}
													</div>
												</div>
											</div>
										)
									})}
									<div ref={messagesEndRef} />
								</div>
							)}
						</div>

						<div className="mt-3 flex-shrink-0">
							<form onSubmit={handleSubmit} className="space-y-2">
								<Textarea
									ref={textareaRef}
									value={input}
									onChange={(event) => setInput(event.currentTarget.value)}
									onKeyDown={handleKeyDown}
									placeholder="Ask.."
									rows={2}
									disabled={isBusy}
									className="min-h-[72px] resize-none"
								/>
								<div className="flex items-center justify-between gap-2">
									<span className="text-muted-foreground text-xs" aria-live="polite">
										{isError ? "Something went wrong. Try again." : isBusy ? "Thinking..." : null}
									</span>
									<button
										type="submit"
										disabled={!input.trim() || isBusy}
										className="rounded bg-blue-600 px-3 py-1 font-medium text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
									>
										Send
									</button>
								</div>
							</form>
						</div>
					</CardContent>
				)}
			</Card>
		</div>
	)
}
