import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import consola from "consola"
import { Mic, Send, Square } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useFetcher, useNavigate } from "react-router"
import { Conversation, ConversationContent, ConversationScrollButton } from "~/components/ai-elements/conversation"
import { Response as AiResponse } from "~/components/ai-elements/response"
import { Suggestion, Suggestions } from "~/components/ai-elements/suggestion"
import { Card, CardContent } from "~/components/ui/card"
import { Textarea } from "~/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { VoiceButton, type VoiceButtonState } from "~/components/ui/voice-button"
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text"
import { cn } from "~/lib/utils"
import type { UpsightMessage } from "~/mastra/message-types"

function WizardIcon({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"flex h-10 w-10 items-center justify-center rounded-full border border-border bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm",
				className
			)}
		>
			<svg
				viewBox="0 0 64 64"
				className="h-6 w-6 text-white"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				role="img"
				aria-label="Setup assistant"
			>
				<path d="M32 8l-10 18h20L32 8z" strokeLinecap="round" strokeLinejoin="round" />
				<circle cx="32" cy="30" r="10" />
				<path d="M24 45h16v11H24z" />
				<path d="M26 30h2" strokeLinecap="round" />
				<path d="M36 30h2" strokeLinecap="round" />
				<path d="M28 35c1.5 1 6.5 1 8 0" strokeLinecap="round" />
			</svg>
		</span>
	)
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

interface ProjectSetupChatProps {
	accountId: string
	projectId: string
	projectName: string
	onSetupComplete?: () => void
}

export function ProjectSetupChat({ accountId, projectId, projectName, onSetupComplete }: ProjectSetupChatProps) {
	const [input, setInput] = useState("")
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)
	const navigate = useNavigate()

	// History loading
	const historyFetcher = useFetcher<{ messages: UpsightMessage[] }>()
	const historyLoadedRef = useRef(false)

	const systemContext = useMemo(() => {
		return `Project: ${projectName}\nProject ID: ${projectId}\nAccount ID: ${accountId}`
	}, [projectName, projectId, accountId])

	const transport = useMemo(() => {
		const apiUrl = `/a/${accountId}/${projectId}/api/chat/project-setup`
		return new DefaultChatTransport({
			api: apiUrl,
			body: { system: systemContext },
		})
	}, [accountId, projectId, systemContext])

	const { messages, sendMessage, status, addToolResult, stop, setMessages } = useChat<UpsightMessage>({
		transport,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		onToolCall: async ({ toolCall }) => {
			if (toolCall.dynamic) return

			// Handle navigation
			if (toolCall.toolName === "navigateToPage") {
				const rawPath = (toolCall.input as { path?: string })?.path || null
				if (rawPath) {
					navigate(rawPath)
					addToolResult({
						tool: "navigateToPage",
						toolCallId: toolCall.toolCallId,
						output: { success: true, path: rawPath },
					})
				}
			}

			// Handle agent switching (setup complete → status agent)
			if (toolCall.toolName === "switchAgent") {
				const input = toolCall.input as { targetAgent?: string; reason?: string }
				const targetAgent = input?.targetAgent
				const reason = input?.reason || "Switching..."

				consola.info("switchAgent tool called:", { targetAgent, reason })

				if (targetAgent === "project-status") {
					// Setup complete - navigate to dashboard
					addToolResult({
						tool: "switchAgent",
						toolCallId: toolCall.toolCallId,
						output: { success: true, targetAgent, message: reason },
					})
					// Trigger completion callback
					onSetupComplete?.()
				} else {
					addToolResult({
						tool: "switchAgent",
						toolCallId: toolCall.toolCallId,
						output: { success: true, targetAgent, message: "Already in setup mode." },
					})
				}
			}
		},
	})

	// Load history once on mount
	useEffect(() => {
		if (historyLoadedRef.current) return
		historyLoadedRef.current = true

		const historyUrl = `/a/${accountId}/${projectId}/api/chat/project-setup/history`
		consola.info("Loading setup chat history from:", historyUrl)
		historyFetcher.load(historyUrl)
	}, [accountId, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

	// Update messages when history loads
	useEffect(() => {
		if (historyFetcher.data?.messages && historyFetcher.data.messages.length > 0) {
			consola.info("Setup chat history loaded:", historyFetcher.data.messages.length, "messages")
			setMessages(historyFetcher.data.messages)
		}
	}, [historyFetcher.data, setMessages])

	const handleVoiceTranscription = useCallback(
		(transcript: string) => {
			const trimmed = transcript.trim()
			if (!trimmed) return
			sendMessage({ text: trimmed })
			setInput("")
		},
		[sendMessage]
	)

	const {
		startRecording: startVoiceRecording,
		stopRecording: stopVoiceRecording,
		isRecording: isVoiceRecording,
		isTranscribing,
		error: voiceError,
		isSupported: isVoiceSupported,
	} = useSpeechToText({ onTranscription: handleVoiceTranscription })

	const isBusy = status === "streaming" || status === "submitted"
	const isError = status === "error"
	const awaitingAssistant = isBusy

	const voiceButtonState: VoiceButtonState = voiceError
		? "error"
		: isTranscribing
			? "processing"
			: isVoiceRecording
				? "recording"
				: "idle"

	const statusMessage =
		voiceError ||
		(isError
			? "Something went wrong. Try again."
			: isTranscribing
				? "Transcribing voice..."
				: isBusy
					? "Thinking..."
					: isVoiceRecording
						? "Recording..."
						: null)

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
	}, [messages, awaitingAssistant])

	// Auto-focus textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.focus()
		}
	}, [])

	// State for LLM-generated suggestions (fallback)
	const [generatedSuggestions, setGeneratedSuggestions] = useState<string[]>([])
	const lastProcessedMessageId = useRef<string | null>(null)

	// Extract suggestions from assistant's response via tool invocations
	const toolSuggestions = useMemo(() => {
		// Initial suggestions when no messages
		if (displayableMessages.length === 0) {
			return [
				"We're building a B2B SaaS for HR teams",
				"I run an e-commerce store selling fitness gear",
				"We help small businesses manage their finances",
			]
		}

		// Find the last assistant message
		const lastAssistantMsg = [...displayableMessages].reverse().find((m) => m.role === "assistant")
		if (!lastAssistantMsg) return []

		// Check for suggestNextSteps tool invocation
		const suggestionToolCall = lastAssistantMsg.toolInvocations?.find(
			(t) => t.toolName === "suggestNextSteps" && "result" in t
		)

		if (suggestionToolCall && "args" in suggestionToolCall) {
			const args = suggestionToolCall.args as { suggestions?: string[] }
			if (args.suggestions && Array.isArray(args.suggestions) && args.suggestions.length > 0) {
				return args.suggestions
			}
		}

		return []
	}, [displayableMessages])

	// Fallback: Generate suggestions if no tool calls found
	useEffect(() => {
		if (displayableMessages.length === 0) return

		const lastMsg = displayableMessages[displayableMessages.length - 1]
		if (!lastMsg || lastMsg.role !== "assistant" || status === "streaming") return

		// If we already processed this message, skip
		if (lastProcessedMessageId.current === lastMsg.id) return

		// If we have tool suggestions, use those (clear generated)
		if (toolSuggestions.length > 0) {
			setGeneratedSuggestions([])
			lastProcessedMessageId.current = lastMsg.id
			return
		}

		// Otherwise, generate new ones via API
		lastProcessedMessageId.current = lastMsg.id

		const lastText =
			lastMsg.parts
				?.filter((p) => p.type === "text")
				.map((p) => p.text)
				.join("\n") || ""
		if (!lastText) return

		fetch("/api/generate-suggestions", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				lastMessage: lastText,
				context: `Project Setup: ${projectName}`,
			}),
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.suggestions && Array.isArray(data.suggestions)) {
					setGeneratedSuggestions(data.suggestions)
				}
			})
			.catch((err) => console.error("Failed to generate suggestions:", err))
	}, [displayableMessages, toolSuggestions, status, accountId, projectId, projectName])

	const suggestions = toolSuggestions.length > 0 ? toolSuggestions : generatedSuggestions

	const handleSuggestionClick = useCallback(
		(suggestion: string) => {
			sendMessage({ text: suggestion })
		},
		[sendMessage]
	)

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
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault()
			submitMessage()
		}
	}

	return (
		<Card className="flex h-[85vh] flex-col overflow-hidden border-0 bg-background/80 shadow-sm ring-1 ring-border/60 backdrop-blur">
			<CardContent className="flex min-h-0 flex-1 flex-col p-6">
				{/* Messages area with auto-scroll */}
				<Conversation className="min-h-0 flex-1">
					<ConversationContent className="space-y-4 p-0 pr-2">
						{displayableMessages.length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center text-center">
								<WizardIcon className="mb-4" />
								<h2 className="mb-2 font-semibold text-lg">Project Context</h2>
								{/* <p className="max-w-md text-balance text-muted-foreground text-sm leading-relaxed">
									I'm here to assist with your customer strategy. Share your goals and vision, and together we'll define
									clear goals, identify and nurture your ideal customers, and uncover the questions that matter most.
								</p> */}
								{displayableMessages.length === 0 && (
									<p className="mt-4 text-balance text-ms text-muted-foreground/70">
										Just start with something like "We're building a B2B SaaS for HR teams" or "I need to understand my
										customers better"
									</p>
								)}
							</div>
						) : (
							displayableMessages.map((message, index) => {
								const key = message.id || `${message.role}-${index}`
								const isUser = message.role === "user"
								const textParts = message.parts?.filter((part) => part.type === "text").map((part) => part.text) ?? []
								const messageText = textParts.filter(Boolean).join("\n").trim()
								return (
									<div key={key} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
										<div className={cn("max-w-[85%]", !isUser && "flex gap-3")}>
											{!isUser && <WizardIcon className="mt-1 h-8 w-8 flex-shrink-0" />}
											<div>
												<div className="mb-1 text-[10px] text-foreground/60 uppercase tracking-wide">
													{isUser ? "You" : "Setup Assistant"}
												</div>
												<div
													className={cn(
														"whitespace-pre-wrap rounded-lg px-4 py-3 shadow-sm",
														isUser ? "bg-blue-600 text-white" : "bg-muted/50 text-foreground ring-1 ring-border/60"
													)}
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
									</div>
								)
							})
						)}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				{/* Input area */}
				<div className="mt-4 flex-shrink-0 border-t pt-4">
					{/* Suggestions */}
					{suggestions.length > 0 && !isBusy && (
						<Suggestions className="mb-3">
							{suggestions.map((suggestion) => (
								<Suggestion key={suggestion} suggestion={suggestion} onClick={handleSuggestionClick} />
							))}
						</Suggestions>
					)}
					<form onSubmit={handleSubmit} className="space-y-3">
						<Textarea
							ref={textareaRef}
							value={input}
							onChange={(event) => setInput(event.currentTarget.value)}
							onKeyDown={handleKeyDown}
							placeholder="Tell me about your business..."
							rows={3}
							disabled={isBusy}
							className="min-h-[80px] resize-none"
						/>
						<div className="flex items-center justify-between gap-2">
							<span className="text-muted-foreground text-xs" aria-live="polite">
								{statusMessage}
							</span>
							<div className="flex items-center gap-2">
								{isVoiceSupported && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<VoiceButton
													state={voiceButtonState}
													onPress={() => {
														if (isVoiceRecording) {
															stopVoiceRecording()
														} else {
															startVoiceRecording()
														}
													}}
													icon={<Mic className="h-4 w-4" />}
													size="icon"
													variant="outline"
													disabled={isTranscribing}
													className="h-9 w-9"
												/>
											</TooltipTrigger>
											<TooltipContent>
												<p>Use voice input</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
								{isBusy ? (
									<button
										type="button"
										onClick={stop}
										className="flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-4 font-medium text-sm text-white hover:bg-red-700"
									>
										<Square className="h-3.5 w-3.5" />
										Stop
									</button>
								) : (
									<button
										type="submit"
										disabled={!input.trim()}
										className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 font-medium text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Send className="h-3.5 w-3.5" />
										Send
									</button>
								)}
							</div>
						</div>
					</form>
				</div>
			</CardContent>
		</Card>
	)
}
