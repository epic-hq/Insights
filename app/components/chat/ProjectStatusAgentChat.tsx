import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { BotMessageSquare, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFetcher, useNavigate } from "react-router"
import { Response as AiResponse } from "~/components/ai-elements/response"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"
import type { UpsightMessage } from "~/mastra/message-types"
import { HOST, PRODUCTION_HOST } from "~/paths"

interface ProjectStatusAgentChatProps {
	accountId: string
	projectId: string
	systemContext: string
	onCollapsedChange?: (collapsed: boolean) => void
}

const INTERNAL_ORIGINS = [HOST, PRODUCTION_HOST]
	.map((value) => {
		try {
			return new URL(value).origin
		} catch {
			return null
		}
	})
	.filter((origin): origin is string => Boolean(origin))

const normalizeInternalPath = (href: string | null): string | null => {
	if (!href) return null
	if (href.startsWith("/")) return href
	if (href.startsWith("#")) return href

	try {
		const baseOrigin = typeof window !== "undefined" ? window.location.origin : INTERNAL_ORIGINS[0]
		const candidate = baseOrigin ? new URL(href, baseOrigin) : new URL(href)

		const matchesWindow = typeof window !== "undefined" && candidate.origin === window.location.origin
		const matchesKnownHost = INTERNAL_ORIGINS.includes(candidate.origin)

		if (matchesWindow || matchesKnownHost) {
			return `${candidate.pathname}${candidate.search}${candidate.hash}`
		}
	} catch {
		return null
	}

	return null
}

const ensureProjectScopedPath = (
	path: string | null,
	accountId: string,
	projectId: string
): { resolved: string | null; reason?: string } => {
	const normalized = normalizeInternalPath(path)
	if (!normalized) {
		return { resolved: null, reason: "non-internal" }
	}

	if (!accountId || !projectId) {
		return { resolved: normalized }
	}

	const projectBase = `/a/${accountId}/${projectId}`
	if (normalized === projectBase || normalized.startsWith(`${projectBase}/`)) {
		return { resolved: normalized }
	}

	return { resolved: null, reason: "outside-project-scope" }
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

	const navigate = useNavigate()

	const { messages, sendMessage, status, setMessages, addToolResult } = useChat<UpsightMessage>({
		transport: new DefaultChatTransport({
			api: routes.api.chat.projectStatus(),
			body: { system: systemContext },
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		onToolCall: async ({ toolCall }) => {
			if (toolCall.dynamic) return

			if (toolCall.toolName === "navigateToPage") {
				const rawPath = typeof toolCall.input?.path === "string" ? toolCall.input.path : null
				const { resolved: normalizedPath, reason } = ensureProjectScopedPath(rawPath, accountId, projectId)

				if (normalizedPath) {
					navigate(normalizedPath)
					addToolResult({
						tool: "navigateToPage",
						toolCallId: toolCall.toolCallId,
						output: { success: true, path: normalizedPath },
					})
				} else {
					addToolResult({
						tool: "navigateToPage",
						toolCallId: toolCall.toolCallId,
						output: { success: false, error: reason || "Unsupported navigation target" },
					})
				}
			}
		},
	})

	// Set messages from history when loaded
	useEffect(() => {
		if (historyFetcher.data?.messages && historyFetcher.data.messages.length > 0) {
			setMessages(historyFetcher.data.messages)
		}
	}, [historyFetcher.data, setMessages])

	const displayableMessages = useMemo(() => {
		if (!messages) return []
		return messages.filter((message) => {
			if (message.role !== "assistant") return true
			return Boolean(
				message.parts?.some((part) => part.type === "text" && typeof part.text === "string" && part.text.trim() !== "")
			)
		})
	}, [messages])

	const visibleMessages = useMemo(() => displayableMessages.slice(-12), [displayableMessages])

	// Auto-scroll to bottom whenever messages change (including during streaming)
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
		}
		// biome-ignore lint/correctness/useExhaustiveDependencies: We want to scroll on any message change including streaming
	}, [visibleMessages, status])

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

	const handleAssistantLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (event.defaultPrevented) return
		if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
		if (event.button !== 0) return

		const anchor = (event.target as HTMLElement | null)?.closest?.("a")
		if (!anchor) return

		const { resolved: normalizedPath } = ensureProjectScopedPath(anchor.getAttribute("href"), accountId, projectId)
		if (!normalizedPath) {
			return
		}

		event.preventDefault()
		navigate(normalizedPath)
	}

	return (
		<div
			className={cn(
				"flex h-full flex-col overflow-hidden transition-all duration-200",
				isCollapsed ? "w-12" : "w-full min-w-[260px]"
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
											message.parts
												?.filter((part) => part.type === "text")
												.map((part) => part.text) ?? []
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
														onClick={!isUser ? handleAssistantLinkClick : undefined}
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
