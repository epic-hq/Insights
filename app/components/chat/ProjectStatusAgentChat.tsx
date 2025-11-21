import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { BotMessageSquare, ChevronRight, Mic, MicOff } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useFetcher, useLocation, useNavigate } from "react-router"
import { Response as AiResponse } from "~/components/ai-elements/response"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Textarea } from "~/components/ui/textarea"
import { useProjectStatusAgent } from "~/contexts/project-status-agent-context"
import { cn } from "~/lib/utils"
import type { UpsightMessage } from "~/mastra/message-types"
import { HOST, PRODUCTION_HOST } from "~/paths"

// Web Speech API types
declare global {
	interface Window {
		SpeechRecognition: new () => SpeechRecognition
		webkitSpeechRecognition: new () => SpeechRecognition
	}

	interface SpeechRecognitionEvent extends Event {
		resultIndex: number
		results: SpeechRecognitionResultList
	}

	interface SpeechRecognitionResultList {
		[index: number]: SpeechRecognitionResult
		length: number
		item(index: number): SpeechRecognitionResult
	}

	interface SpeechRecognitionResult {
		[index: number]: SpeechRecognitionAlternative
		isFinal: boolean
		length: number
		item(index: number): SpeechRecognitionAlternative
	}

	interface SpeechRecognitionAlternative {
		transcript: string
		confidence: number
	}

	interface SpeechGrammarList {
		[index: number]: SpeechGrammar
		length: number
		item(index: number): SpeechGrammar
		addFromURI(src: string, weight?: number): void
		addFromString(string: string, weight?: number): void
	}

	interface SpeechGrammar {
		src: string
		weight: number
	}

	interface SpeechRecognitionErrorEvent extends Event {
		error: string
		message: string
	}

	interface SpeechRecognition extends EventTarget {
		continuous: boolean
		grammars: SpeechGrammarList
		lang: string
		interimResults: boolean
		maxAlternatives: number
		serviceURI: string

		// Event handlers
		onstart: ((this: SpeechRecognition, ev: Event) => void) | null
		onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
		onend: ((this: SpeechRecognition, ev: Event) => void) | null
		onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null

		// Methods
		start(): void
		stop(): void
		abort(): void
	}
}

function ThinkingWave() {
	const gradientId = useId()
	const bars = [
		{ delay: 0, x: 0 },
		{ delay: 0.15, x: 12 },
		{ delay: 0.3, x: 24 },
		{ delay: 0.45, x: 36 },
	]

	return (
		<span className="flex items-center gap-2 font-medium text-[11px] text-foreground/70 italic" aria-live="polite">
			<span>Thinking</span>
			<svg
				className="h-4 w-10 text-foreground/50"
				viewBox="0 0 48 16"
				fill="none"
				role="presentation"
				aria-hidden="true"
			>
				<defs>
					<linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
						<stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
						<stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
					</linearGradient>
				</defs>
				{bars.map(({ delay, x }) => (
					<rect key={x} x={x} y={6} width={6} height={4} rx={3} fill={`url(#${gradientId})`}>
						<animate attributeName="height" values="4;12;4" dur="1.2s" begin={`${delay}s`} repeatCount="indefinite" />
						<animate attributeName="y" values="10;2;10" dur="1.2s" begin={`${delay}s`} repeatCount="indefinite" />
					</rect>
				))}
			</svg>
		</span>
	)
}

interface ProjectStatusAgentChatProps {
	accountId: string
	projectId: string
	systemContext: string
	onCollapsedChange?: (collapsed: boolean) => void
}

// Custom hook for speech recognition
function useSpeechRecognition() {
	const [isListening, setIsListening] = useState(false)
	const [finalTranscript, setFinalTranscript] = useState("")
	const [error, setError] = useState<string | null>(null)
	const recognitionRef = useRef<SpeechRecognition | null>(null)

	// Check if Web Speech API is supported and we're on HTTPS (or localhost in development)
	const isSupported = useMemo(() => {
		if (typeof window === "undefined") return false

		// Web Speech API requires HTTPS in modern browsers, but allow localhost for development
		if (
			window.location.protocol !== "https:" &&
			window.location.hostname !== "localhost" &&
			window.location.hostname !== "127.0.0.1"
		) {
			console.log("Speech recognition disabled: requires HTTPS (or localhost for development)")
			return false
		}

		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
		const supported = Boolean(SpeechRecognition)
		console.log("Speech recognition support check:", {
			protocol: window.location.protocol,
			hostname: window.location.hostname,
			hasSpeechRecognition: Boolean(window.SpeechRecognition),
			hasWebkitSpeechRecognition: Boolean(window.webkitSpeechRecognition),
			supported,
		})
		return supported
	}, [])

	useEffect(() => {
		if (!isSupported) return

		// Check if Web Speech API is supported
		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
		if (SpeechRecognition) {
			recognitionRef.current = new SpeechRecognition()
			const recognition = recognitionRef.current

			recognition.continuous = true
			recognition.interimResults = false // Only get final results
			recognition.lang = "en-US"

			recognition.onstart = () => {
				setIsListening(true)
				setError(null) // Clear any previous errors
				setFinalTranscript("") // Clear any previous transcript
			}

			recognition.onresult = (event: SpeechRecognitionEvent) => {
				// Only process final results
				let transcript = ""
				for (let i = event.resultIndex; i < event.results.length; i++) {
					const result = event.results[i]
					if (result.isFinal) {
						transcript += result[0].transcript
					}
				}
				if (transcript) {
					setFinalTranscript((prev) => prev + transcript)
				}
			}

			recognition.onend = () => {
				setIsListening(false)
			}

			recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
				console.error("Speech recognition error:", {
					error: event.error,
					message: event.message,
					protocol: window.location.protocol,
					hostname: window.location.hostname,
					userAgent: navigator.userAgent,
				})
				setIsListening(false)

				// Provide user-friendly error messages
				switch (event.error) {
					case "network":
						setError(
							"Network error. Speech recognition requires HTTPS. For development, use localhost or 127.0.0.1 with HTTP allowed."
						)
						break
					case "not-allowed":
						setError("Microphone permission denied. Please allow microphone access.")
						break
					case "no-speech":
						setError("No speech detected. Try speaking louder or closer to the microphone.")
						break
					case "aborted":
						setError("Speech recognition was cancelled.")
						break
					case "audio-capture":
						setError("Audio capture failed. Check your microphone.")
						break
					case "service-not-allowed":
						setError("Speech recognition service not available.")
						break
					default:
						setError(`Speech recognition error: ${event.error}`)
				}
			}
		}

		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.stop()
			}
		}
	}, [isSupported])

	const toggleListening = () => {
		if (!recognitionRef.current) return

		if (isListening) {
			// Stop listening
			recognitionRef.current.stop()
		} else {
			// Start listening - clear any previous errors
			setError(null)
			try {
				recognitionRef.current.start()
			} catch (error) {
				console.error("Error starting speech recognition:", error)
				setError("Failed to start speech recognition. Try again.")
			}
		}
	}

	return {
		isListening,
		finalTranscript,
		isSupported,
		error,
		toggleListening,
		clearError: () => setError(null),
	}
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
	const location = useLocation()
	const routes = { api: { chat: { projectStatus: () => `/a/${accountId}/${projectId}/api/chat/project-status` } } }
	const { pendingInput, setPendingInput } = useProjectStatusAgent()

	// Speech recognition hook
	const { isListening, finalTranscript, isSupported, error, toggleListening, clearError } = useSpeechRecognition()

	// Handle pendingInput from context (inserted by other components like priorities table)
	useEffect(() => {
		if (pendingInput) {
			setInput(pendingInput)
			setPendingInput(null)
			// Focus textarea after inserting text
			setTimeout(() => {
				textareaRef.current?.focus()
				// Move cursor to end
				const len = pendingInput.length
				textareaRef.current?.setSelectionRange(len, len)
			}, 100)
		}
	}, [pendingInput, setPendingInput])

	// Stabilize history loading function to avoid useEffect dependency issues
	const loadHistory = useCallback(() => {
		if (!accountId || !projectId) return
		historyFetcher.load(`/a/${accountId}/${projectId}/api/chat/project-status/history`)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [accountId, projectId])

	// Load chat history when project changes
	useEffect(() => {
		loadHistory()
	}, [loadHistory])

	const navigate = useNavigate()

	const currentPageContext = useMemo(() => {
		return describeCurrentProjectView({
			pathname: location.pathname,
			search: location.search,
			accountId,
			projectId,
		})
	}, [location.pathname, location.search, accountId, projectId])

	const mergedSystemContext = useMemo(() => {
		if (!currentPageContext) return systemContext
		return [systemContext, `Current UI Context:\n${currentPageContext}`].filter(Boolean).join("\n\n")
	}, [systemContext, currentPageContext])

	const { messages, sendMessage, status, setMessages, addToolResult } = useChat<UpsightMessage>({
		transport: new DefaultChatTransport({
			api: routes.api.chat.projectStatus(),
			body: { system: mergedSystemContext },
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		onToolCall: async ({ toolCall }) => {
			if (toolCall.dynamic) return

			if (toolCall.toolName === "navigateToPage") {
				const rawPath = (toolCall.input as { path?: string })?.path || null
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

	// Update input with final speech recognition transcript when listening stops
	useEffect(() => {
		if (finalTranscript && !isListening) {
			setInput((prevInput) => prevInput + finalTranscript)
		}
	}, [finalTranscript, isListening])

	// Clear speech recognition errors when user types
	useEffect(() => {
		if (error && input.trim()) {
			clearError()
		}
	}, [input, error, clearError])

	const isBusy = status === "streaming" || status === "submitted"
	const isError = status === "error"
	const awaitingAssistant = isBusy

	const displayableMessages = useMemo(() => {
		if (!messages) return []
		const lastMessage = messages[messages.length - 1]
		return messages.filter((message) => {
			if (message.role !== "assistant") return true
			const hasContent = message.parts?.some(
				(part) => part.type === "text" && typeof part.text === "string" && part.text.trim() !== ""
			)
			const isLatestAssistantPlaceholder = awaitingAssistant && message === lastMessage
			return hasContent || isLatestAssistantPlaceholder
		})
	}, [messages, status])

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
							<CardTitle
								onClick={() => setIsCollapsed(!isCollapsed)}
								className="flex cursor-pointer items-center gap-2 text-base transition-opacity hover:opacity-80 sm:text-lg"
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault()
										setIsCollapsed(!isCollapsed)
									}
								}}
								aria-label="Toggle chat"
							>
								<BotMessageSquare className="h-4 w-4 text-blue-600" />
								Ask Uppy
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
											message.parts?.filter((part) => part.type === "text").map((part) => part.text) ?? []
										const messageText = textParts.filter(Boolean).join("\n").trim()
										return (
											<div key={key} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
												<div className="max-w-[85%]">
													<div className="mb-1 text-[10px] text-foreground/60 uppercase tracking-wide">
														{isUser ? "You" : "Uppy Assistant"}
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
															<ThinkingWave />
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
										{error
											? error
											: isError
												? "Something went wrong. Try again."
												: isBusy
													? "Thinking..."
													: isListening
														? "Listening..."
														: null}
									</span>
									<div className="flex items-center gap-2">
										{!isSupported ? (
											<div className="flex h-8 items-center text-muted-foreground text-xs">
												🔒 HTTPS required (localhost allowed for dev)
											</div>
										) : (
											<button
												type="button"
												onClick={() => {
													clearError()
													toggleListening()
												}}
												disabled={isBusy}
												className={cn(
													"flex h-8 w-8 items-center justify-center rounded border transition-colors",
													isListening
														? "border-red-500 bg-red-50 text-red-600 hover:bg-red-100"
														: "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
												)}
												aria-label={isListening ? "Stop voice input" : "Start voice input"}
												title={isListening ? "Stop voice input" : "Start voice input"}
											>
												{isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
											</button>
										)}
										<button
											type="submit"
											disabled={!input.trim() || isBusy}
											className="rounded bg-blue-600 px-3 py-1 font-medium text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
										>
											Send
										</button>
									</div>
								</div>
							</form>
						</div>
					</CardContent>
				)}
			</Card>
		</div>
	)
}

interface ViewContextArgs {
	pathname: string
	search: string
	accountId: string
	projectId: string
}

function describeCurrentProjectView({ pathname, search, accountId, projectId }: ViewContextArgs): string {
	if (!pathname) return ""
	const segments = pathname.split("/").filter(Boolean)
	const isProjectScoped = segments[0] === "a" && segments.length >= 3
	const contextLines: string[] = [`Route: ${pathname}`]
	if (isProjectScoped) {
		const [, accountSegment, projectSegment, ...rest] = segments
		const accountMatch = accountSegment || accountId
		const projectMatch = projectSegment || projectId
		if (accountMatch) {
			contextLines.push(`Account: ${accountMatch}`)
		}
		if (projectMatch) {
			contextLines.push(`Project: ${projectMatch}`)
		}
		if (rest.length > 0) {
			const resource = rest[0]
			const remainder = rest.slice(1)
			contextLines.push(describeResourceContext(resource, remainder))
		} else {
			contextLines.push("View: Project overview")
		}
	} else {
		contextLines.push("View: Outside project scope")
	}
	if (search) {
		contextLines.push(`Query: ${search}`)
	}
	return contextLines.filter(Boolean).join("\n")
}

function describeResourceContext(resource: string, remainder: string[]): string {
	const id = remainder[0]
	switch (resource) {
		case "interviews":
			if (!id) return "View: Interviews workspace"
			if (id === "new") return "View: Create interview"
			return `View: Interview detail (id=${id})`
		case "people":
			if (!id) return "View: People directory"
			if (id === "new") return "View: Add person"
			return `View: Person profile (id=${id})`
		case "opportunities":
			if (!id) return "View: Opportunities pipeline"
			if (id === "new") return "View: New opportunity"
			return `View: Opportunity detail (id=${id})`
		case "themes":
			if (!id) return "View: Themes overview"
			return `View: Theme detail (id=${id})`
		case "evidence":
			if (!id) return "View: Evidence library"
			return `View: Evidence detail (id=${id})`
		case "insights":
			if (!id) return "View: Insights workspace"
			return `View: Insight detail (id=${id})`
		case "segments":
			if (!id) return "View: Segment index"
			return `View: Segment detail (id=${id})`
		case "personas":
			if (!id) return "View: Personas overview"
			return `View: Persona detail (id=${id})`
		case "product-lens":
			return "View: Product Lens (pain × user matrix)"
		case "bant-lens":
			return "View: BANT Lens (budget × authority)"
		case "dashboard":
			return "View: Project dashboard"
		case "project-status":
			return "View: Project status summary"
		default:
			if (resource) {
				return `View: ${resource.replace(/-/g, " ")}${id ? ` (context=${id})` : ""}`
			}
			return "View: Project content"
	}
}
