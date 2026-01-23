import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import consola from "consola"
import { ChevronRight, Mic, Plus, Send, Square } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useFetcher, useLocation, useNavigate, useRevalidator } from "react-router"
import { useStickToBottom } from "use-stick-to-bottom"
import { Response as AiResponse } from "~/components/ai-elements/response"
import { Suggestion, Suggestions } from "~/components/ai-elements/suggestion"
import { ProjectStatusVoiceChat } from "~/components/chat/ProjectStatusVoiceChat"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Textarea } from "~/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { VoiceButton, type VoiceButtonState } from "~/components/ui/voice-button"
import { useProjectStatusAgent } from "~/contexts/project-status-agent-context"
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
import { cn } from "~/lib/utils"
import type { UpsightMessage } from "~/mastra/message-types"
import { HOST, PRODUCTION_HOST } from "~/paths"

function WizardIcon({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card shadow-sm",
				className
			)}
		>
			<svg
				viewBox="0 0 64 64"
				className="h-6 w-6"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				role="img"
				aria-label="Wizard bot"
			>
				<path d="M32 8l-10 18h20L32 8z" strokeLinecap="round" strokeLinejoin="round" />
				<circle cx="32" cy="30" r="10" />
				<path d="M24 45h16v11H24z" />
				<path d="M19 45c-4 0-7 3-7 7v4" strokeLinecap="round" />
				<path d="M45 45c4 0 7 3 7 7v4" strokeLinecap="round" />
				<path d="M26 30h2" strokeLinecap="round" />
				<path d="M36 30h2" strokeLinecap="round" />
				<path d="M28 35c1.5 1 6.5 1 8 0" strokeLinecap="round" />
				<path d="M14 26v18" strokeLinecap="round" />
				<circle cx="14" cy="22" r="3" />
			</svg>
		</span>
	)
}

interface ToolProgressData {
	tool: string
	status: string
	message: string
	progress?: number
}

const ROTATING_STATUS_MESSAGES = [
	"Thinking...",
	"Cogitating...",
	"Planning...",
	"Delegating...",
	"Hustling...",
	"Bustling...",
	"Checking...",
]

const GENERIC_PROGRESS_LABELS = new Set(["thinking", "thinking...", "routing", "routing...", "working", "working..."])

function normalizeProgressMessage(message: string): string {
	return message
		.replace(/\u2026/g, "...")
		.trim()
		.toLowerCase()
}

function useRotatingStatus(enabled: boolean): string {
	const [index, setIndex] = useState(0)

	useEffect(() => {
		if (!enabled) {
			setIndex(0)
			return
		}

		const timer = window.setInterval(() => {
			setIndex((current) => (current + 1) % ROTATING_STATUS_MESSAGES.length)
		}, 1200)

		return () => window.clearInterval(timer)
	}, [enabled])

	return ROTATING_STATUS_MESSAGES[index]
}

function ThinkingWave({ progressMessage }: { progressMessage?: string | null }) {
	const gradientId = useId()
	const bars = [
		{ delay: 0, x: 0 },
		{ delay: 0.15, x: 12 },
		{ delay: 0.3, x: 24 },
		{ delay: 0.45, x: 36 },
	]
	const normalizedMessage = progressMessage ? normalizeProgressMessage(progressMessage) : ""
	const shouldRotate =
		!progressMessage || GENERIC_PROGRESS_LABELS.has(normalizedMessage) || normalizedMessage.startsWith("routing")
	const rotatingMessage = useRotatingStatus(shouldRotate)
	const displayMessage = shouldRotate ? rotatingMessage : progressMessage

	return (
		<span className="flex items-center gap-2 font-medium text-[11px] text-foreground/70 italic" aria-live="polite">
			<span>{displayMessage || "Thinking..."}</span>
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

function extractNetworkStatus(message: UpsightMessage): string | null {
	if (!message.parts) return null
	for (const part of message.parts) {
		const anyPart = part as { type: string; data?: unknown }
		if (anyPart.type === "data" && anyPart.data) {
			const data = anyPart.data as Record<string, unknown>
			// Check for network routing status: { type: "status", status: "thinking", message: "Thinking..." }
			if (data?.type === "status" && data?.message) {
				return data.message as string
			}
			// Handle wrapped network progress: { type: "data-network", data: { steps: [...] } }
			if (data?.type === "data-network" && typeof data?.data === "object") {
				const networkData = data.data as { steps?: Array<{ name?: string; status?: string }> }
				const activeStep = networkData.steps?.findLast((step) => step.status === "running")
				if (activeStep?.name) {
					if (isRoutingAgentStep(activeStep.name)) return "Routing..."
					return `Working: ${formatProgressLabel(activeStep.name)}`
				}
			}
		}
		// Direct network progress: { type: "data-network", data: { steps: [...] } }
		if (anyPart.type === "data-network" && anyPart.data) {
			const networkData = anyPart.data as { steps?: Array<{ name?: string; status?: string }> }
			const activeStep = networkData.steps?.findLast((step) => step.status === "running")
			if (activeStep?.name) {
				if (isRoutingAgentStep(activeStep.name)) return "Routing..."
				return `Working: ${formatProgressLabel(activeStep.name)}`
			}
		}
	}
	return null
}

function isRoutingAgentStep(name: string): boolean {
	return name.toLowerCase() === "routing-agent"
}

function formatProgressLabel(name: string): string {
	return name
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str: string) => str.toUpperCase())
		.trim()
}

type NetworkStep = {
	name?: string
	status?: string
}

function extractNetworkSteps(message: UpsightMessage): NetworkStep[] {
	if (!message.parts) return []
	for (const part of message.parts) {
		const anyPart = part as { type: string; data?: unknown }
		if (anyPart.type === "data-network" && anyPart.data) {
			const networkData = anyPart.data as { steps?: NetworkStep[] }
			return Array.isArray(networkData.steps) ? networkData.steps : []
		}
		if (anyPart.type === "data" && anyPart.data) {
			const data = anyPart.data as Record<string, unknown>
			if (data?.type === "data-network" && typeof data?.data === "object") {
				const networkData = data.data as { steps?: NetworkStep[] }
				return Array.isArray(networkData.steps) ? networkData.steps : []
			}
		}
	}
	return []
}

function formatNetworkStepLabel(name?: string): string {
	if (!name) return "Step"
	if (isRoutingAgentStep(name)) return "Coordinator"
	return formatProgressLabel(name)
}

function extractToolProgress(message: UpsightMessage): ToolProgressData | null {
	if (!message.parts) return null
	for (const part of message.parts) {
		// Cast to any to handle dynamic part types from Mastra streaming
		const anyPart = part as { type: string; data?: unknown }
		// Check for data-tool-progress type with data property (AI SDK v5 format: type="data-xxx")
		if (anyPart.type === "data-tool-progress" && anyPart.data) {
			return anyPart.data as ToolProgressData
		}
		// Also check for custom data parts that might be wrapped differently by Mastra
		// Mastra's writer.custom() might serialize as { type: "data", data: { type: "data-tool-progress", ... } }
		if (anyPart.type === "data" && anyPart.data) {
			const data = anyPart.data as Record<string, unknown>
			if (data?.type === "data-tool-progress" && data?.data) {
				return data.data as ToolProgressData
			}
			// Direct data format: { type: "data", data: { tool, status, message, progress } }
			if (data?.tool && data?.message) {
				return data as unknown as ToolProgressData
			}
		}
	}
	return null
}

function extractReasoningText(message: UpsightMessage): string | null {
	if (!message.parts) return null
	for (const part of message.parts) {
		// Cast to handle dynamic part types from Mastra/AI SDK streaming
		const anyPart = part as { type: string; reasoning?: string; text?: string }
		// AI SDK v5 reasoning parts have type="reasoning" with reasoning property
		if (anyPart.type === "reasoning" && anyPart.reasoning) {
			return anyPart.reasoning
		}
	}
	return null
}

function isNetworkDebugText(text: string): boolean {
	const trimmed = text.trim()
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false
	try {
		const parsed = JSON.parse(trimmed) as { isNetwork?: boolean }
		return parsed?.isNetwork === true
	} catch {
		return false
	}
}

function extractToolResultText(message: UpsightMessage): string | null {
	if (message.role !== "tool" || !message.parts) return null
	for (const part of message.parts) {
		const anyPart = part as {
			type: string
			toolName?: string
			result?: { message?: string; task?: { id?: string } }
			toolResult?: { message?: string }
			data?: { message?: string }
		}
		if (anyPart.type === "tool-result") {
			return anyPart.result?.message || anyPart.toolResult?.message || null
		}
		if (anyPart.type === "data" && anyPart.data?.message) {
			return anyPart.data.message
		}
	}
	return null
}

function extractToolResultTaskId(message: UpsightMessage): string | null {
	if (message.role !== "tool" || !message.parts) return null
	for (const part of message.parts) {
		const anyPart = part as {
			type: string
			toolName?: string
			result?: { task?: { id?: string } }
		}
		if (anyPart.type === "tool-result" && anyPart.toolName === "createTask") {
			return anyPart.result?.task?.id || null
		}
	}
	return null
}

function extractActiveToolCall(message: UpsightMessage): string | null {
	if (!message.parts) return null

	// In AI SDK v5, tool invocations are parts with type "tool-invocation"
	for (const part of message.parts) {
		const anyPart = part as {
			type: string
			toolInvocation?: {
				toolName: string
				state: string
			}
			toolName?: string
			state?: string
		}

		// Check for tool-invocation type parts (AI SDK v5 format)
		if (anyPart.type === "tool-invocation" || anyPart.toolInvocation) {
			const toolData = anyPart.toolInvocation || anyPart
			// Check if tool is still in progress (not completed)
			if (
				toolData.state === "input-streaming" ||
				toolData.state === "input-available" ||
				toolData.state === "call" ||
				toolData.state === "partial-call"
			) {
				const toolName = toolData.toolName
				if (toolName) {
					// Format tool name nicely (e.g., "fetchProjectStatusContext" -> "Fetching project status context")
					const readable = toolName
						.replace(/([A-Z])/g, " $1")
						.replace(/^./, (str: string) => str.toUpperCase())
						.trim()
					return readable
				}
			}
		}
	}
	return null
}

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
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)

	// Use stick-to-bottom for auto-scrolling chat messages
	const { scrollRef, contentRef, scrollToBottom } = useStickToBottom()
	const location = useLocation()
	const {
		pendingInput,
		setPendingInput,
		pendingAssistantMessage,
		setPendingAssistantMessage,
		forceExpandChat,
		setForceExpandChat,
	} = useProjectStatusAgent()
	const { isEnabled: isVoiceEnabled } = usePostHogFeatureFlag("ffVoice")

	// Load chat history from the server for display
	// The history is loaded for UI display only - when sending new messages,
	// we only send the new message. Mastra's memory system handles including
	// historical context server-side, so we don't send history to avoid duplicates.
	const historyFetcher = useFetcher<{ messages: UpsightMessage[] }>()
	const historyLoadedRef = useRef(false)
	const historyAppliedRef = useRef(false)

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

	// Handle forceExpandChat signal from context (e.g., when showAssistantMessage is called)
	useEffect(() => {
		if (forceExpandChat) {
			setIsCollapsed(false)
			setForceExpandChat(false)
		}
	}, [forceExpandChat, setForceExpandChat])

	const navigate = useNavigate()
	const revalidator = useRevalidator()

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

	// Get user's timezone from browser
	const userTimezone = useMemo(() => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone
		} catch {
			return "UTC"
		}
	}, [])

	const { messages, sendMessage, status, addToolResult, stop, setMessages } = useChat<UpsightMessage>({
		transport: new DefaultChatTransport({
			api: `/a/${accountId}/${projectId}/api/chat/project-status`,
			body: { system: mergedSystemContext, userTimezone },
		}),
		// Note: Mastra's memory system on the server handles historical context.
		// We load history for display but don't need to send it back since the server
		// already includes it via the memory thread.
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
						output: {
							success: false,
							error: reason || "Unsupported navigation target",
						},
					})
				}
			}

			// Handle agent switching for handoff pattern
			if (toolCall.toolName === "switchAgent") {
				const input = toolCall.input as {
					targetAgent?: string
					reason?: string
				}
				const targetAgent = input?.targetAgent
				const reason = input?.reason || "Switching agents..."

				consola.info("switchAgent tool called:", { targetAgent, reason })

				if (targetAgent === "project-setup") {
					// Navigate to setup page which uses the setup agent
					const setupPath = `/a/${accountId}/${projectId}/setup`
					navigate(setupPath)
					addToolResult({
						tool: "switchAgent",
						toolCallId: toolCall.toolCallId,
						output: { success: true, targetAgent, message: reason },
					})
				} else if (targetAgent === "project-status") {
					// Already on status agent, just acknowledge
					addToolResult({
						tool: "switchAgent",
						toolCallId: toolCall.toolCallId,
						output: {
							success: true,
							targetAgent,
							message: "Already using project status agent.",
						},
					})
				} else {
					addToolResult({
						tool: "switchAgent",
						toolCallId: toolCall.toolCallId,
						output: {
							success: false,
							error: `Unknown agent: ${targetAgent}`,
						},
					})
				}
			}
		},
	})

	// Load history once on mount
	useEffect(() => {
		if (historyLoadedRef.current) return
		historyLoadedRef.current = true

		const historyUrl = `/a/${accountId}/${projectId}/api/chat/project-status/history`
		consola.info("Loading chat history from:", historyUrl)
		historyFetcher.load(historyUrl)
	}, [accountId, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

	// Update messages when history loads (setMessages comes from useChat)
	// Only apply history once to prevent re-applying on navigation
	// Handle errors gracefully to prevent retry loops
	useEffect(() => {
		if (historyAppliedRef.current) return

		// Check for error response (including auth errors that return error JSON)
		const fetcherData = historyFetcher.data as { messages?: UpsightMessage[]; error?: string } | undefined
		if (fetcherData?.error) {
			historyAppliedRef.current = true
			consola.warn("Chat history load failed, skipping:", fetcherData.error)
			return
		}

		if (fetcherData?.messages && fetcherData.messages.length > 0) {
			historyAppliedRef.current = true
			consola.info("Chat history loaded, updating messages:", fetcherData.messages.length, "messages")
			setMessages(fetcherData.messages)
			// Scroll to bottom after history loads
			requestAnimationFrame(() => {
				scrollToBottom()
			})
		}
	}, [historyFetcher.data, setMessages, scrollToBottom])

	// Handle pendingAssistantMessage from context (injected AI messages from other components)
	useEffect(() => {
		if (pendingAssistantMessage) {
			setMessages((prev) => [
				...prev,
				{
					id: pendingAssistantMessage.id,
					role: "assistant",
					parts: [{ type: "text", text: pendingAssistantMessage.text }],
				} as UpsightMessage,
			])
			setPendingAssistantMessage(null)
		}
	}, [pendingAssistantMessage, setPendingAssistantMessage, setMessages])

	const handleVoiceTranscription = useCallback(
		(transcript: string) => {
			const trimmed = transcript.trim()
			if (!trimmed) return
			sendMessage({ text: trimmed })
			setInput("")
		},
		[sendMessage]
	)

	// Clear chat and allow history to be re-applied if user navigates back
	const handleClearChat = useCallback(() => {
		setMessages([])
		// Don't reset historyAppliedRef - we don't want to reload history
		// after user intentionally clears chat
	}, [setMessages])

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

	// Map voice states to VoiceButton states
	const voiceButtonState: VoiceButtonState = voiceError
		? "error"
		: isTranscribing
			? "processing"
			: isVoiceRecording
				? "recording"
				: "idle"

	// Voice-only status message (errors and recording state)
	const statusMessage =
		voiceError || (isError ? "Something went wrong. Try again." : isVoiceRecording ? "Recording..." : null)

	const displayableMessages = useMemo(() => {
		if (!messages) return []
		const lastMessage = messages[messages.length - 1]
		return messages.filter((message) => {
			if (message.role === "tool") {
				return Boolean(extractToolResultText(message))
			}
			if (message.role !== "assistant") return true
			const hasContent = message.parts?.some(
				(part) =>
					part.type === "text" &&
					typeof part.text === "string" &&
					part.text.trim() !== "" &&
					!isNetworkDebugText(part.text)
			)
			const isLatestAssistantPlaceholder = awaitingAssistant && message === lastMessage
			return hasContent || isLatestAssistantPlaceholder
		})
	}, [messages, awaitingAssistant])

	const visibleMessages = useMemo(() => displayableMessages.slice(-12), [displayableMessages])

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

	// State for LLM-generated suggestions (fallback)
	const [generatedSuggestions, setGeneratedSuggestions] = useState<string[]>([])
	const lastProcessedMessageId = useRef<string | null>(null)
	const lastCreatedTaskIdRef = useRef<string | null>(null)

	// Extract suggestions from assistant's response via tool invocations
	const toolSuggestions = useMemo(() => {
		// Initial suggestions when no messages
		if (displayableMessages.length === 0) {
			return ["Show project status", "Suggest next steps", "Summarize findings"]
		}

		// Find the last assistant message
		const lastAssistantMsg = [...displayableMessages].reverse().find((m) => m.role === "assistant")
		if (!lastAssistantMsg || !lastAssistantMsg.parts) return []

		// Check for suggestNextSteps tool invocation in parts (AI SDK v5 format)
		for (const part of lastAssistantMsg.parts) {
			const anyPart = part as {
				type: string
				toolInvocation?: {
					toolName: string
					state: string
					args?: Record<string, unknown>
				}
				toolName?: string
				state?: string
				args?: Record<string, unknown>
			}

			if (anyPart.type === "tool-invocation" || anyPart.toolInvocation) {
				const toolData = anyPart.toolInvocation || anyPart
				if (toolData.toolName === "suggestNextSteps" && toolData.state === "output-available") {
					const args = toolData.args as { suggestions?: string[] } | undefined
					if (args?.suggestions && Array.isArray(args.suggestions) && args.suggestions.length > 0) {
						return args.suggestions
					}
				}
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
				context: `User is viewing: ${currentPageContext}`,
			}),
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.suggestions && Array.isArray(data.suggestions)) {
					setGeneratedSuggestions(data.suggestions)
				}
			})
			.catch((err) => console.error("Failed to generate suggestions:", err))
	}, [displayableMessages, toolSuggestions, status, accountId, projectId, currentPageContext])

	useEffect(() => {
		const lastMsg = displayableMessages[displayableMessages.length - 1]
		if (!lastMsg) return
		const taskId = extractToolResultTaskId(lastMsg)
		if (!taskId || lastCreatedTaskIdRef.current === taskId) return
		lastCreatedTaskIdRef.current = taskId
		revalidator.revalidate()
	}, [displayableMessages, revalidator])

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
		// Use { preventScrollReset: true } to avoid scroll jumps and unnecessary re-renders
		navigate(normalizedPath, { preventScrollReset: true })
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
								<WizardIcon className="h-8 w-8 border-0 bg-transparent p-0 text-blue-600" />
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
								<WizardIcon className="h-10 w-10 border-0 bg-transparent p-0 text-blue-600" />
								<span className="whitespace-nowrap font-medium text-[10px] text-muted-foreground leading-tight opacity-90">
									Ask AI
								</span>
							</div>
						)}
						{!isCollapsed && (
							<div className="flex items-center gap-1">
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<div
												onClick={handleClearChat}
												className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
												aria-label="New chat"
												role="button"
												tabIndex={0}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault()
														handleClearChat()
													}
												}}
											>
												<Plus className="h-4 w-4" />
											</div>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p>New chat</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<div
									onClick={() => setIsCollapsed(!isCollapsed)}
									className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
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
								<div ref={scrollRef} className="h-full overflow-y-auto text-xs sm:text-sm">
									<div ref={contentRef} className="space-y-3">
										{visibleMessages.map((message, index) => {
											const key = message.id || `${message.role}-${index}`
											const isUser = message.role === "user"
											const isTool = message.role === "tool"
											const textParts =
												message.parts?.filter((part) => part.type === "text").map((part) => part.text) ?? []
											const filteredTextParts = textParts.filter(
												(part) => typeof part === "string" && !isNetworkDebugText(part)
											)
											const messageText =
												(isTool ? extractToolResultText(message) : null) ||
												filteredTextParts.filter(Boolean).join("\n").trim()
											const networkSteps = extractNetworkSteps(message)
											return (
												<div key={key} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
													<div className="max-w-[85%]">
														<div className="mb-1 text-[10px] text-foreground/60 uppercase tracking-wide">
															{isUser ? "You" : "Uppy Assistant"}
														</div>
														<div
															className={cn(
																"whitespace-pre-wrap rounded-lg px-3 py-2 shadow-sm",
																isUser
																	? "bg-blue-600 text-white"
																	: "bg-background text-foreground ring-1 ring-border/60"
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
																<div className="space-y-2">
																	<ThinkingWave
																		progressMessage={
																			extractNetworkStatus(message) ||
																			extractToolProgress(message)?.message ||
																			extractActiveToolCall(message) ||
																			extractReasoningText(message)
																		}
																	/>
																	{networkSteps.length > 0 && (
																		<div className="rounded-md bg-muted/40 px-2 py-1 text-[11px] text-foreground/70">
																			{networkSteps.map((step, index) => {
																				const label = formatNetworkStepLabel(step.name)
																				const status = step.status || "running"
																				const statusLabel = status === "running" ? "running" : "done"
																				return (
																					<div key={`${label}-${index}`} className="flex items-center gap-2">
																						<span className="font-medium">{label}</span>
																						<span className="text-foreground/50">{statusLabel}</span>
																					</div>
																				)
																			})}
																		</div>
																	)}
																</div>
															) : (
																<span className="text-foreground/70">(No text response)</span>
															)}
														</div>
													</div>
												</div>
											)
										})}
									</div>
								</div>
							)}
						</div>

						<div className="mt-3 flex-shrink-0">
							{/* Suggestions */}
							{suggestions.length > 0 && !isBusy && (
								<Suggestions className="mb-2 flex-wrap">
									{suggestions.slice(0, 3).map((suggestion) => (
										<Suggestion
											key={suggestion}
											suggestion={suggestion}
											onClick={handleSuggestionClick}
											className="text-xs"
										/>
									))}
								</Suggestions>
							)}
							<form onSubmit={handleSubmit} className="space-y-2">
								<div className="relative">
									<Textarea
										ref={textareaRef}
										value={input}
										onChange={(event) => setInput(event.currentTarget.value)}
										onKeyDown={handleKeyDown}
										placeholder="Ask.."
										rows={2}
										disabled={isBusy}
										className="min-h-[72px] resize-none pr-12"
									/>
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
														variant="ghost"
														disabled={isTranscribing}
														className="absolute right-2 bottom-2 h-8 w-8"
													/>
												</TooltipTrigger>
												<TooltipContent>
													<p>Transcribe your voice into commands for AI</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									)}
								</div>
								<div className="flex items-center justify-end gap-2">
									{statusMessage && (
										<span className="mr-auto text-muted-foreground text-xs" aria-live="polite">
											{statusMessage}
										</span>
									)}
									<div className="flex items-center gap-2">
										{isVoiceEnabled && <ProjectStatusVoiceChat accountId={accountId} projectId={projectId} />}
										{isBusy ? (
											<button
												type="button"
												onClick={stop}
												className="flex h-8 items-center gap-1.5 rounded-md bg-red-600 px-3 font-medium text-sm text-white hover:bg-red-700"
											>
												<Square className="h-3.5 w-3.5" />
												Stop
											</button>
										) : (
											<button
												type="submit"
												disabled={!input.trim()}
												className="flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 font-medium text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
