/**
 * Public survey page with immersive mobile-first design
 * Inspired by Instagram Stories / TikTok for video and image content
 */
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { AnimatePresence, motion } from "framer-motion"
import {
	ArrowLeft,
	ArrowRight,
	Calendar,
	Check,
	CheckCircle2,
	ClipboardList,
	Copy,
	Loader2,
	MessageSquare,
	Mic,
	Send,
} from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router-dom"
import { Streamdown } from "streamdown"
import { z } from "zod"
import { Logo } from "~/components/branding"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { VoiceButton, type VoiceButtonState } from "~/components/ui/voice-button"
import { getNextQuestionIndex } from "~/features/research-links/branching"
import { VideoRecorder } from "~/features/research-links/components/VideoRecorder"
import { type ResearchLinkQuestion, ResearchLinkQuestionSchema } from "~/features/research-links/schemas"
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { cn } from "~/lib/utils"
import { createR2PresignedUrl } from "~/utils/r2.server"

const emailSchema = z.string().email()
const phoneSchema = z.string().min(7, "Enter a valid phone number")

// Type definitions used by ChatSection (moved before component)
type ResponseValue = string | string[] | boolean | null
type ResponseRecord = Record<string, ResponseValue>

/**
 * Chat section component - isolated to ensure useChat is initialized with valid responseId
 * Immersive full-height layout with bottom-anchored input
 */
function ChatSection({
	slug,
	responseId,
	responses,
	questions,
	allowVideo,
	onComplete,
	onVideoStage,
	renderModeSwitcher,
}: {
	slug: string
	responseId: string
	responses: ResponseRecord
	questions: ResearchLinkQuestion[]
	allowVideo: boolean
	onComplete: () => void
	onVideoStage: () => void
	renderModeSwitcher: () => React.ReactNode
}) {
	const chatContainerRef = useRef<HTMLDivElement>(null)
	const chatInputRef = useRef<HTMLTextAreaElement>(null)
	const [chatInput, setChatInput] = useState("")
	const hasStartedChat = useRef(false)

	// Create transport with body that gets refreshed with current responses
	const transport = useMemo(() => {
		return new DefaultChatTransport({
			api: `/api/research-links/${slug}/chat`,
			body: {
				responseId,
				currentResponses: responses,
			},
		})
	}, [slug, responseId, responses])

	const {
		messages,
		sendMessage,
		status,
		error: chatError,
	} = useChat({
		id: `research-chat-${responseId}`,
		transport,
	})

	const isChatLoading = status === "streaming" || status === "submitted"

	// Voice input for chat
	const handleChatVoiceTranscription = useCallback((text: string) => {
		setChatInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
	}, [])

	const {
		isRecording: isChatVoiceRecording,
		isTranscribing: isChatTranscribing,
		error: chatVoiceError,
		toggleRecording: toggleChatRecording,
		isSupported: isVoiceSupported,
	} = useSpeechToText({ onTranscription: handleChatVoiceTranscription })

	const chatVoiceButtonState: VoiceButtonState = chatVoiceError
		? "error"
		: isChatTranscribing
			? "processing"
			: isChatVoiceRecording
				? "recording"
				: "idle"

	// Auto-scroll chat
	useEffect(() => {
		if (chatContainerRef.current) {
			chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
		}
	}, [messages])

	// Auto-focus chat input
	useEffect(() => {
		if (chatInputRef.current && !isChatLoading) {
			chatInputRef.current.focus()
		}
	}, [isChatLoading])

	// Helper to extract text content from message parts
	const getMessageText = useCallback((message: (typeof messages)[0]): string => {
		if (!message.parts) return ""
		return message.parts
			.filter((p) => p.type === "text")
			.map((p) => (p as { type: "text"; text: string }).text)
			.join("")
			.trim()
	}, [])

	// Auto-start chat when component mounts
	useEffect(() => {
		console.log("[research-link-chat] ChatSection mounted, auto-starting", {
			messagesLength: messages.length,
			hasStartedChat: hasStartedChat.current,
			status,
		})

		if (messages.length === 0 && !hasStartedChat.current && status === "ready") {
			console.log("[research-link-chat] sending initial message")
			hasStartedChat.current = true
			sendMessage({
				text: "Hi, I'm ready to share my feedback. Please start with your first question.",
			})
		}
	}, [messages.length, status, sendMessage])

	// Check if survey is complete after each message
	useEffect(() => {
		if (messages.length === 0 || status === "streaming") return
		const lastMessage = messages[messages.length - 1]
		if (lastMessage?.role !== "assistant") return

		const text = getMessageText(lastMessage).toLowerCase()
		const isComplete = text.includes("thank you") && text.includes("response")
		if (isComplete) {
			saveProgress(slug, { responseId, responses, completed: true }).then(() => {
				if (allowVideo) {
					onVideoStage()
				} else {
					onComplete()
				}
			})
		}
	}, [messages, status, getMessageText, slug, responseId, responses, allowVideo, onVideoStage, onComplete])

	return (
		<div className="flex flex-1 flex-col">
			{/* Chat messages - fills available space */}
			<div ref={chatContainerRef} className="flex-1 space-y-3 overflow-y-auto px-1 pb-4">
				{/* Show error if any */}
				{chatError && (
					<div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm backdrop-blur-sm">
						Something went wrong. Please try again or switch to form mode.
					</div>
				)}
				{/* Show initial loading state before first message arrives */}
				{messages.length === 0 && !chatError && (
					<div className="flex justify-start">
						<div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm text-white/90 backdrop-blur-sm">
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								<span>Starting conversation...</span>
							</div>
						</div>
					</div>
				)}
				{messages
					.filter((m, i) => {
						const text = getMessageText(m)
						return !(i === 0 && m.role === "user" && text.includes("I'm ready to share my feedback"))
					})
					.map((message) => {
						const text = getMessageText(message)
						if (!text && message.role === "assistant") {
							return (
								<div key={message.id} className="flex justify-start">
									<div className="rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 backdrop-blur-sm">
										<Loader2 className="h-4 w-4 animate-spin text-white/50" />
									</div>
								</div>
							)
						}
						return (
							<div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
								<div
									className={cn(
										"max-w-[85%] rounded-2xl px-4 py-3 text-sm",
										message.role === "user"
											? "rounded-br-sm bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
											: "rounded-bl-sm bg-white/10 text-white/90 backdrop-blur-sm"
									)}
								>
									{text}
								</div>
							</div>
						)
					})}
				{isChatLoading && messages.length > 0 && getMessageText(messages[messages.length - 1]) !== "" && (
					<div className="flex justify-start">
						<div className="rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3 backdrop-blur-sm">
							<Loader2 className="h-4 w-4 animate-spin text-white/50" />
						</div>
					</div>
				)}
			</div>

			{/* Chat input - bottom anchored with glass effect */}
			<div className="shrink-0 border-white/[0.06] border-t bg-white/[0.03] px-1 pt-3 pb-2 backdrop-blur-xl">
				<form
					onSubmit={(e) => {
						e.preventDefault()
						if (!chatInput.trim() || isChatLoading) return
						sendMessage({ text: chatInput.trim() })
						setChatInput("")
					}}
					className="flex items-end gap-2"
				>
					<div className="relative flex-1">
						<Textarea
							ref={chatInputRef}
							value={chatInput}
							onChange={(e) => setChatInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault()
									if (chatInput.trim() && !isChatLoading) {
										sendMessage({ text: chatInput.trim() })
										setChatInput("")
									}
								}
							}}
							placeholder="Type your response..."
							rows={2}
							className="resize-none rounded-2xl border-white/10 bg-white/[0.07] pr-12 text-white placeholder:text-white/40 focus:border-violet-500/50 focus:ring-violet-500/20"
							disabled={isChatLoading}
						/>
						{isVoiceSupported && (
							<div className="-translate-y-1/2 absolute top-1/2 right-2">
								<VoiceButton
									size="icon"
									variant="ghost"
									state={chatVoiceButtonState}
									onPress={toggleChatRecording}
									icon={<Mic className="h-4 w-4" />}
									className="h-8 w-8 text-white/50 hover:bg-white/10 hover:text-white"
								/>
							</div>
						)}
					</div>
					<Button
						type="submit"
						size="icon"
						disabled={isChatLoading || !chatInput.trim()}
						className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-40 disabled:shadow-none"
					>
						<Send className="h-4 w-4" />
					</Button>
				</form>
				{renderModeSwitcher()}
			</div>
		</div>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) {
		return [{ title: "Survey" }]
	}
	return [
		{ title: data.list.hero_title || data.list.name || "Survey" },
		{
			name: "description",
			content: data.list.hero_subtitle || data.list.description || "",
		},
	]
}

export async function loader({ params }: LoaderFunctionArgs) {
	const slug = params.slug
	if (!slug) {
		throw new Response("Missing slug", { status: 400 })
	}
	const supabase = createSupabaseAdminClient()
	const { data: list, error } = await supabase
		.from("research_links")
		.select(
			"id, name, slug, description, hero_title, hero_subtitle, instructions, hero_cta_label, hero_cta_helper, redirect_url, calendar_url, questions, allow_chat, allow_voice, allow_video, walkthrough_video_url, default_response_mode, is_live, account_id, identity_mode, identity_field"
		)
		.eq("slug", slug)
		.maybeSingle()

	if (error) {
		throw new Response(error.message, { status: 500 })
	}
	if (!list || !list.is_live) {
		throw new Response("Survey not found", { status: 404 })
	}

	const questionsResult = ResearchLinkQuestionSchema.array().safeParse(list.questions)

	// Generate signed URL for walkthrough video if it exists
	let walkthroughSignedUrl: string | null = null
	if (list.walkthrough_video_url) {
		// Detect content type from file extension
		const key = list.walkthrough_video_url
		const ext = key.split(".").pop()?.toLowerCase()
		const contentType = ext === "mp4" ? "video/mp4" : ext === "mov" ? "video/quicktime" : "video/webm"

		const presigned = createR2PresignedUrl({
			key,
			expiresInSeconds: 3600, // 1 hour
			responseContentType: contentType,
		})
		walkthroughSignedUrl = presigned?.url ?? null
	}

	return {
		slug,
		list,
		questions: questionsResult.success ? questionsResult.data : [],
		walkthroughSignedUrl,
	}
}

type IdentityMode = "anonymous" | "identified"
type IdentityField = "email" | "phone"

type LoaderData = {
	slug: string
	list: {
		id: string
		name: string
		slug: string
		description: string | null
		hero_title: string | null
		hero_subtitle: string | null
		instructions: string | null
		hero_cta_label: string | null
		hero_cta_helper: string | null
		redirect_url: string | null
		calendar_url: string | null
		questions: unknown
		allow_chat: boolean
		allow_voice: boolean
		allow_video: boolean
		walkthrough_video_url: string | null
		default_response_mode: "form" | "chat" | "voice" | null
		is_live: boolean
		account_id: string
		identity_mode: IdentityMode
		identity_field: IdentityField
	}
	questions: Array<ResearchLinkQuestion>
	walkthroughSignedUrl: string | null
}

type Stage = "email" | "phone" | "name" | "instructions" | "survey" | "video" | "complete"
type Mode = "form" | "chat" | "voice"

type StartSignupResult = {
	responseId: string
	responses: ResponseRecord
	completed: boolean
	personId: string | null
}

type StartSignupPayload =
	| {
			email: string
			firstName?: string | null
			lastName?: string | null
			responseId?: string | null
			responseMode?: Mode
	  }
	| { phone: string; responseId?: string | null; responseMode?: Mode }
	| { responseId?: string | null; responseMode?: Mode } // anonymous

async function startSignup(slug: string, payload: StartSignupPayload): Promise<StartSignupResult> {
	const response = await fetch(`/api/research-links/${slug}/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(errorData.message || "Failed to start survey")
	}
	return (await response.json()) as StartSignupResult
}

async function saveProgress(
	slug: string,
	payload: {
		responseId: string
		responses: ResponseRecord
		completed?: boolean
	}
) {
	const response = await fetch(`/api/research-links/${slug}/save`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})
	if (!response.ok) {
		throw new Error("Failed to save responses")
	}
	return (await response.json()) as { ok: boolean }
}

/**
 * Helper to render the identity stage hero (video + description + instructions)
 * Shared between email and phone stages to avoid duplication
 */
function IdentityHero({
	walkthroughSignedUrl,
	heroSubtitle,
	description,
	instructions,
}: {
	walkthroughSignedUrl: string | null
	heroSubtitle: string | null
	description: string | null
	instructions: string | null
}) {
	return (
		<>
			{/* Full-bleed video with gradient overlay */}
			{walkthroughSignedUrl && (
				<div className="-mx-4 overflow-hidden md:mx-0 md:rounded-2xl">
					<div className="relative">
						<video
							src={walkthroughSignedUrl}
							className="aspect-video w-full bg-black object-cover"
							controls
							playsInline
						/>
						<div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-violet-950/80 to-transparent" />
					</div>
				</div>
			)}

			{(heroSubtitle || description) && (
				<p className="text-base text-white/70 leading-relaxed md:text-lg">{heroSubtitle || description}</p>
			)}

			{instructions && (
				<div className="prose prose-sm prose-invert max-w-none rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 backdrop-blur-sm prose-li:text-white/60 prose-li:text-sm prose-p:text-white/60 prose-p:text-sm prose-ul:text-white/60 prose-ul:text-sm prose-p:leading-relaxed">
					<Streamdown>{instructions}</Streamdown>
				</div>
			)}
		</>
	)
}

/**
 * Mode selector buttons for choosing form/chat/voice response mode
 */
function ModeSelector({
	mode,
	setMode,
	allowChat,
	allowVoice,
	calendarUrl,
}: {
	mode: Mode
	setMode: (mode: Mode) => void
	allowChat: boolean
	allowVoice: boolean
	calendarUrl: string | null
}) {
	if (!allowChat && !allowVoice && !calendarUrl) return null

	return (
		<div className="space-y-2.5">
			<p className="font-medium text-white/50 text-xs uppercase tracking-wider">How would you like to respond?</p>
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => setMode("form")}
					className={cn(
						"flex flex-1 flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition-all",
						mode === "form"
							? "border-white/30 bg-white/10 text-white shadow-lg shadow-white/5 backdrop-blur-sm"
							: "border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70"
					)}
				>
					<ClipboardList className="h-5 w-5" />
					<span className="font-medium text-xs">Form</span>
				</button>
				{allowChat && (
					<button
						type="button"
						onClick={() => setMode("chat")}
						className={cn(
							"flex flex-1 flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition-all",
							mode === "chat"
								? "border-white/30 bg-white/10 text-white shadow-lg shadow-white/5 backdrop-blur-sm"
								: "border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70"
						)}
					>
						<MessageSquare className="h-5 w-5" />
						<span className="font-medium text-xs">Chat</span>
					</button>
				)}
				{allowVoice && (
					<button
						type="button"
						onClick={() => setMode("voice")}
						className={cn(
							"relative flex flex-1 flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition-all",
							mode === "voice"
								? "border-violet-400/50 bg-violet-500/15 text-white shadow-lg shadow-violet-500/10 backdrop-blur-sm"
								: "border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70"
						)}
					>
						<Mic className="h-5 w-5" />
						<span className="font-medium text-xs">Voice</span>
						<span className="-top-1.5 -right-1.5 absolute rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-1.5 py-0.5 font-bold text-[8px] text-white shadow-lg">
							NEW
						</span>
					</button>
				)}
				{calendarUrl && (
					<a
						href={calendarUrl}
						target="_blank"
						rel="noreferrer"
						className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-white/50 transition-all hover:border-white/20 hover:text-white/70"
					>
						<Calendar className="h-5 w-5" />
						<span className="font-medium text-xs">Book Call</span>
					</a>
				)}
			</div>
		</div>
	)
}

export default function ResearchLinkPage() {
	const { slug, list, questions, walkthroughSignedUrl } = useLoaderData() as LoaderData
	const emailId = useId()
	const phoneId = useId()
	const storageKey = `research-link:${slug}`

	// Determine initial stage based on identity mode
	const getInitialStage = (): Stage => {
		if (list.identity_mode === "anonymous") {
			return list.instructions ? "instructions" : "survey"
		}
		return list.identity_field === "phone" ? "phone" : "email"
	}

	const [stage, setStage] = useState<Stage>(getInitialStage)
	const [mode, setMode] = useState<Mode>(list.allow_chat ? (list.default_response_mode ?? "form") : "form")
	const [email, setEmail] = useState("")
	const [phone, setPhone] = useState("")
	const [firstName, setFirstName] = useState("")
	const [lastName, setLastName] = useState("")
	const [responseId, setResponseId] = useState<string | null>(null)
	const [responses, setResponses] = useState<ResponseRecord>({})
	const [currentIndex, setCurrentIndex] = useState(0)
	const [currentAnswer, setCurrentAnswer] = useState<ResponseValue>("")
	const [isSaving, setIsSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [initializing, setInitializing] = useState(true)
	const [copiedLink, setCopiedLink] = useState(false)
	const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null)
	const [isReviewing, setIsReviewing] = useState(false)

	const resolvedMode = list.allow_chat ? mode : "form"
	const hasMultipleModes = list.allow_chat || list.allow_voice
	const isEmailValid = emailSchema.safeParse(email).success
	const isPhoneValid = phoneSchema.safeParse(phone).success

	// Handle mode switch with response refresh
	const handleModeSwitch = useCallback(
		async (newMode: Mode) => {
			if (newMode === mode) return

			// If we have a responseId and are in survey stage, refresh responses from DB
			if (responseId && stage === "survey" && email) {
				try {
					const result = await startSignup(slug, {
						email,
						responseId,
						responseMode: newMode,
					})
					setResponses(result.responses || {})
					// Update current answer if in form mode
					if (newMode === "form") {
						const existingValue = result.responses?.[questions[currentIndex]?.id]
						setCurrentAnswer(existingValue ?? "")
					}
				} catch {
					// If refresh fails, just switch mode anyway
				}
			}
			setMode(newMode)
		},
		[mode, responseId, stage, email, slug, questions, currentIndex]
	)

	// Mode switcher component for survey stages - glassmorphic pill design
	const renderModeSwitcher = () => {
		if (!hasMultipleModes) return null
		return (
			<div className="flex items-center justify-center py-2">
				<div className="flex items-center gap-0.5 rounded-full bg-white/[0.06] p-1 backdrop-blur-sm">
					<button
						type="button"
						onClick={() => void handleModeSwitch("form")}
						className={cn(
							"flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium text-xs transition-all",
							resolvedMode === "form"
								? "bg-white/15 text-white shadow-sm"
								: "text-white/40 hover:text-white/70"
						)}
					>
						<ClipboardList className="h-3.5 w-3.5" />
						Form
					</button>
					{list.allow_chat && (
						<button
							type="button"
							onClick={() => void handleModeSwitch("chat")}
							className={cn(
								"flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium text-xs transition-all",
								resolvedMode === "chat"
									? "bg-white/15 text-white shadow-sm"
									: "text-white/40 hover:text-white/70"
							)}
						>
							<MessageSquare className="h-3.5 w-3.5" />
							Chat
						</button>
					)}
					{list.allow_voice && (
						<button
							type="button"
							onClick={() => void handleModeSwitch("voice")}
							className={cn(
								"flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium text-xs transition-all",
								resolvedMode === "voice"
									? "bg-violet-500/30 text-white shadow-sm"
									: "text-white/40 hover:text-white/70"
							)}
						>
							<Mic className="h-3.5 w-3.5" />
							Voice
						</button>
					)}
				</div>
			</div>
		)
	}

	// Countdown timer for redirect
	useEffect(() => {
		if (redirectCountdown === null || redirectCountdown <= 0) return
		const timer = setTimeout(() => {
			setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null))
		}, 1000)
		return () => clearTimeout(timer)
	}, [redirectCountdown])

	// Redirect when countdown reaches 0
	useEffect(() => {
		if (redirectCountdown === 0 && list.redirect_url) {
			window.location.href = list.redirect_url
		}
	}, [redirectCountdown, list.redirect_url])

	const cancelRedirect = useCallback(() => {
		setRedirectCountdown(null)
	}, [])

	const handleStartOver = useCallback(() => {
		window.localStorage.removeItem(storageKey)
		setStage("email")
		setEmail("")
		setFirstName("")
		setLastName("")
		setResponseId(null)
		setResponses({})
		setCurrentIndex(0)
		setCurrentAnswer("")
		setRedirectCountdown(null)
		setError(null)
	}, [storageKey])

	// Get the current page URL for sharing
	const shareUrl = typeof window !== "undefined" ? window.location.href : `/ask/${slug}`

	const handleCopyLink = useCallback(() => {
		navigator.clipboard.writeText(shareUrl)
		setCopiedLink(true)
		setTimeout(() => setCopiedLink(false), 2000)
	}, [shareUrl])

	// Voice input for form mode
	const handleFormVoiceTranscription = useCallback((text: string) => {
		setCurrentAnswer((prev) => {
			const current = typeof prev === "string" ? prev : ""
			return current.trim() ? `${current.trim()} ${text}` : text
		})
	}, [])

	const {
		isRecording: isFormVoiceRecording,
		isTranscribing: isFormTranscribing,
		error: formVoiceError,
		toggleRecording: toggleFormRecording,
		isSupported: isVoiceSupported,
	} = useSpeechToText({ onTranscription: handleFormVoiceTranscription })

	// Form voice button state
	const formVoiceButtonState: VoiceButtonState = formVoiceError
		? "error"
		: isFormTranscribing
			? "processing"
			: isFormVoiceRecording
				? "recording"
				: "idle"

	useEffect(() => {
		if (!list.allow_chat && mode === "chat") {
			setMode("form")
		}
	}, [list.allow_chat, mode])

	useEffect(() => {
		if (typeof window === "undefined") return
		try {
			// Check URL params first (from embed redirect)
			const urlParams = new URLSearchParams(window.location.search)
			const urlEmail = urlParams.get("email")
			const urlResponseId = urlParams.get("responseId")

			// If we have URL params, use those (coming from embed)
			if (urlEmail && urlResponseId) {
				void startSignup(slug, {
					email: urlEmail,
					responseId: urlResponseId,
					responseMode: resolvedMode,
				})
					.then((result) => {
						setEmail(urlEmail)
						setResponseId(result.responseId)
						setResponses(result.responses || {})
						// Save to localStorage for future visits
						window.localStorage.setItem(
							storageKey,
							JSON.stringify({
								email: urlEmail,
								responseId: result.responseId,
							})
						)
						const initialIndex = findNextQuestionIndex(result.responses || {}, questions)
						if (initialIndex >= questions.length) {
							setStage("complete")
						} else {
							// Show instructions stage before survey when coming from embed
							setStage("instructions")
							setCurrentIndex(initialIndex)
							const existingValue = result.responses?.[questions[initialIndex]?.id]
							setCurrentAnswer(existingValue ?? "")
						}
					})
					.catch(() => {
						// If URL params fail, fall back to email stage
						setInitializing(false)
					})
					.finally(() => {
						setInitializing(false)
					})
				return
			}

			// Otherwise check localStorage for existing session
			const stored = window.localStorage.getItem(storageKey)
			if (!stored) {
				// For anonymous mode with no stored session, auto-start the survey
				if (list.identity_mode === "anonymous") {
					void startSignup(slug, { responseMode: resolvedMode })
						.then((result) => {
							setResponseId(result.responseId)
							setResponses(result.responses || {})
							window.localStorage.setItem(storageKey, JSON.stringify({ responseId: result.responseId }))
							const initialIndex = findNextQuestionIndex(result.responses || {}, questions)
							if (initialIndex >= questions.length) {
								setStage("complete")
							} else {
								setCurrentIndex(initialIndex)
								// Anonymous surveys show instructions or go straight to survey
								if (list.instructions) {
									setStage("instructions")
								} else {
									setStage("survey")
								}
							}
						})
						.catch(() => {
							// Silently fail - user can still use the survey
						})
						.finally(() => {
							setInitializing(false)
						})
					return
				}
				setInitializing(false)
				return
			}
			const parsed = JSON.parse(stored) as {
				email?: string
				phone?: string
				responseId?: string
			}

			// Handle email-identified resume
			if (parsed.email && parsed.responseId) {
				void startSignup(slug, {
					email: parsed.email,
					responseId: parsed.responseId,
					responseMode: resolvedMode,
				})
					.then((result) => {
						setEmail(parsed.email as string)
						setResponseId(result.responseId)
						setResponses(result.responses || {})
						const initialIndex = findNextQuestionIndex(result.responses || {}, questions)
						if (initialIndex >= questions.length) {
							setStage("complete")
						} else {
							setStage("survey")
							setCurrentIndex(initialIndex)
							const existingValue = result.responses?.[questions[initialIndex]?.id]
							setCurrentAnswer(existingValue ?? "")
						}
					})
					.catch(() => {
						window.localStorage.removeItem(storageKey)
					})
					.finally(() => {
						setInitializing(false)
					})
				return
			}

			// Handle phone-identified resume
			if (parsed.phone && parsed.responseId) {
				void startSignup(slug, {
					phone: parsed.phone,
					responseId: parsed.responseId,
					responseMode: resolvedMode,
				})
					.then((result) => {
						setPhone(parsed.phone as string)
						setResponseId(result.responseId)
						setResponses(result.responses || {})
						const initialIndex = findNextQuestionIndex(result.responses || {}, questions)
						if (initialIndex >= questions.length) {
							setStage("complete")
						} else {
							setStage("survey")
							setCurrentIndex(initialIndex)
							const existingValue = result.responses?.[questions[initialIndex]?.id]
							setCurrentAnswer(existingValue ?? "")
						}
					})
					.catch(() => {
						window.localStorage.removeItem(storageKey)
					})
					.finally(() => {
						setInitializing(false)
					})
				return
			}

			// Handle anonymous resume (just responseId)
			if (parsed.responseId && list.identity_mode === "anonymous") {
				void startSignup(slug, {
					responseId: parsed.responseId,
					responseMode: resolvedMode,
				})
					.then((result) => {
						setResponseId(result.responseId)
						setResponses(result.responses || {})
						const initialIndex = findNextQuestionIndex(result.responses || {}, questions)
						if (initialIndex >= questions.length) {
							setStage("complete")
						} else {
							setStage("survey")
							setCurrentIndex(initialIndex)
							const existingValue = result.responses?.[questions[initialIndex]?.id]
							setCurrentAnswer(existingValue ?? "")
						}
					})
					.catch(() => {
						window.localStorage.removeItem(storageKey)
					})
					.finally(() => {
						setInitializing(false)
					})
				return
			}

			window.localStorage.removeItem(storageKey)
			setInitializing(false)
		} catch {
			setInitializing(false)
		}
	}, [questions, slug, storageKey, resolvedMode, list.identity_mode, list.instructions])

	useEffect(() => {
		if (stage === "survey" && resolvedMode === "form") {
			const value = responses[questions[currentIndex]?.id]
			setCurrentAnswer(value ?? "")
		}
	}, [stage, currentIndex, questions, responses, resolvedMode])

	const currentQuestion = useMemo(() => questions[currentIndex], [currentIndex, questions])

	const _answeredCount = useMemo(() => {
		return questions.filter((q) => {
			const val = responses[q.id]
			return val !== undefined && val !== null && val !== ""
		}).length
	}, [questions, responses])

	async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError(null)
		if (!email.trim()) {
			setError("Enter an email to continue")
			return
		}
		try {
			setIsSaving(true)
			const result = await startSignup(slug, {
				email: email.trim(),
				responseId,
				responseMode: resolvedMode,
			})
			setResponseId(result.responseId)
			setResponses(result.responses || {})
			window.localStorage.setItem(storageKey, JSON.stringify({ email: email.trim(), responseId: result.responseId }))

			// If no person linked, we need to collect name info
			if (!result.personId) {
				setStage("name")
				return
			}

			// Person was found, proceed to survey
			const initialIndex = findNextQuestionIndex(result.responses || {}, questions)
			if (initialIndex >= questions.length) {
				setStage("complete")
			} else {
				setCurrentIndex(initialIndex)
				setStage("survey")
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Something went wrong")
		} finally {
			setIsSaving(false)
		}
	}

	async function handlePhoneSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError(null)
		if (!phone.trim()) {
			setError("Enter a phone number to continue")
			return
		}
		try {
			setIsSaving(true)
			const result = await startSignup(slug, {
				phone: phone.trim().replace(/\s+/g, ""),
				responseId,
				responseMode: resolvedMode,
			})
			setResponseId(result.responseId)
			setResponses(result.responses || {})
			window.localStorage.setItem(storageKey, JSON.stringify({ phone: phone.trim(), responseId: result.responseId }))

			// Phone-identified surveys don't collect name, go straight to survey
			const initialIndex = findNextQuestionIndex(result.responses || {}, questions)
			if (initialIndex >= questions.length) {
				setStage("complete")
			} else {
				setCurrentIndex(initialIndex)
				if (list.instructions) {
					setStage("instructions")
				} else {
					setStage("survey")
				}
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Something went wrong")
		} finally {
			setIsSaving(false)
		}
	}

	async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError(null)
		if (!firstName.trim()) {
			setError("Enter your first name to continue")
			return
		}
		if (!responseId) {
			setError("Something went wrong. Please refresh and try again.")
			return
		}
		try {
			setIsSaving(true)
			const result = await startSignup(slug, {
				email: email.trim(),
				firstName: firstName.trim(),
				lastName: lastName.trim() || null,
				responseId,
				responseMode: resolvedMode,
			})
			setResponseId(result.responseId)
			setResponses(result.responses || {})

			const initialIndex = findNextQuestionIndex(result.responses || {}, questions)
			if (initialIndex >= questions.length) {
				setStage("complete")
			} else {
				setCurrentIndex(initialIndex)
				setStage("survey")
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Something went wrong")
		} finally {
			setIsSaving(false)
		}
	}

	async function handleAnswerSubmit(value: ResponseValue) {
		if (!responseId) {
			setError("Something went wrong. Refresh and try again.")
			return
		}
		const normalizedValue = normalizeResponseValue(value)
		if (currentQuestion?.required && !hasResponseValue(normalizedValue)) {
			setError("This question is required")
			return
		}
		setError(null)
		const nextResponses: ResponseRecord = {
			...responses,
			[currentQuestion?.id ?? ""]: normalizedValue,
		}
		setIsSaving(true)
		try {
			// Use branching engine to determine next question
			const nextIndex = getNextQuestionIndex(currentIndex, questions, nextResponses)
			const isComplete = nextIndex >= questions.length
			await saveProgress(slug, {
				responseId,
				responses: nextResponses,
				completed: isComplete,
			})
			setResponses(nextResponses)
			if (isComplete) {
				// If video is enabled, go to video stage first
				console.log("[survey] Survey complete, allow_video:", list.allow_video, typeof list.allow_video)
				if (list.allow_video) {
					setStage("video")
				} else {
					setStage("complete")
					if (list.redirect_url) {
						setRedirectCountdown(7)
					}
				}
			} else {
				setCurrentIndex(nextIndex)
				setCurrentAnswer(nextResponses[questions[nextIndex]?.id] ?? "")
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Failed to save your answer")
		} finally {
			setIsSaving(false)
		}
	}

	function handleBack() {
		if (currentIndex > 0) {
			const prevIndex = currentIndex - 1
			setCurrentIndex(prevIndex)
			setCurrentAnswer(responses[questions[prevIndex]?.id] ?? "")
		}
	}

	function handleJumpToQuestion(targetIndex: number) {
		if (targetIndex < 0 || targetIndex >= questions.length) return
		// Allow jumping to any answered question or current question
		const isAnswered = hasResponseValue(responses[questions[targetIndex]?.id])
		const isCurrent = targetIndex === currentIndex
		const isPrevious = targetIndex < currentIndex
		if (isAnswered || isCurrent || isPrevious) {
			setCurrentIndex(targetIndex)
			setCurrentAnswer(responses[questions[targetIndex]?.id] ?? "")
		}
	}

	// ──────────────────────────────────────────────
	// RENDER
	// ──────────────────────────────────────────────

	if (initializing) {
		return (
			<div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-violet-950 via-slate-900 to-indigo-950">
				<Loader2 className="h-8 w-8 animate-spin text-white/40" />
			</div>
		)
	}

	return (
		<div className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-violet-950 via-slate-900 to-indigo-950">
			{/* Stories-style progress bar - shown during form survey */}
			{stage === "survey" && resolvedMode === "form" && questions.length > 0 && (
				<div className="fixed top-0 right-0 left-0 z-50 bg-gradient-to-b from-black/50 to-transparent px-3 pt-[env(safe-area-inset-top,8px)] pb-6 md:static md:bg-transparent md:px-0 md:pb-0 md:pt-4">
					<div className="mx-auto flex w-full max-w-2xl gap-1 md:px-6">
						{questions.map((q, idx) => {
							const isAnswered = hasResponseValue(responses[q.id])
							const isCurrent = idx === currentIndex
							return (
								<button
									key={q.id}
									type="button"
									onClick={() => handleJumpToQuestion(idx)}
									className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20 transition-all hover:bg-white/30"
								>
									<div
										className={cn(
											"h-full rounded-full transition-all duration-500 ease-out",
											isAnswered
												? "w-full bg-white"
												: isCurrent
													? "w-1/2 bg-white/60"
													: "w-0"
										)}
									/>
								</button>
							)
						})}
					</div>
				</div>
			)}

			{/* Main content area */}
			<div
				className={cn(
					"flex flex-1 flex-col",
					stage === "survey" && resolvedMode === "form" && "pt-10 md:pt-0",
					stage === "survey" && resolvedMode === "chat" && "pt-0"
				)}
			>
				<div
					className={cn(
						"mx-auto flex w-full max-w-2xl flex-1 flex-col",
						stage === "survey" && resolvedMode === "chat" ? "px-3 py-2" : "px-5 md:px-6",
						stage !== "survey" && "justify-center py-8 md:py-12"
					)}
				>
					{/* Title - shown on identity stages */}
					{(stage === "email" || stage === "phone" || stage === "name" || stage === "instructions") && (
						<motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							className="pb-6"
						>
							<h1 className="font-bold text-2xl text-white tracking-tight md:text-3xl">
								{list.hero_title || list.name || "Share your feedback"}
							</h1>
						</motion.div>
					)}

					{/* Error banner */}
					{error && (
						<motion.div
							initial={{ opacity: 0, y: -8 }}
							animate={{ opacity: 1, y: 0 }}
							className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm backdrop-blur-sm"
						>
							{error}
						</motion.div>
					)}

					{/* ── Email Stage ── */}
					{stage === "email" && (
						<motion.form
							onSubmit={handleEmailSubmit}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
							className="space-y-5"
						>
							<IdentityHero
								walkthroughSignedUrl={walkthroughSignedUrl}
								heroSubtitle={list.hero_subtitle}
								description={list.description}
								instructions={list.instructions}
							/>

							<ModeSelector
								mode={mode}
								setMode={setMode}
								allowChat={list.allow_chat}
								allowVoice={list.allow_voice}
								calendarUrl={list.calendar_url}
							/>

							{/* Email input with glass effect */}
							<div className="space-y-2">
								<Label htmlFor={emailId} className="font-medium text-sm text-white/80">
									Your Email
								</Label>
								<Input
									id={emailId}
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="you@company.com"
									className="h-12 rounded-xl border-white/[0.08] bg-white/[0.06] text-white backdrop-blur-sm placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
									required
								/>
								{list.hero_cta_helper && (
									<p className="text-right text-white/40 text-xs">{list.hero_cta_helper}</p>
								)}
							</div>

							<Button
								type="submit"
								disabled={isSaving || !isEmailValid}
								className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 font-semibold text-base text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-600 hover:to-indigo-700 hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-40 disabled:shadow-none"
							>
								{isSaving ? (
									<Loader2 className="h-5 w-5 animate-spin" />
								) : (
									<>
										{list.hero_cta_label || "Continue"}
										<ArrowRight className="ml-2 h-5 w-5" />
									</>
								)}
							</Button>
						</motion.form>
					)}

					{/* ── Phone Stage ── */}
					{stage === "phone" && (
						<motion.form
							onSubmit={handlePhoneSubmit}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
							className="space-y-5"
						>
							<IdentityHero
								walkthroughSignedUrl={walkthroughSignedUrl}
								heroSubtitle={list.hero_subtitle}
								description={list.description}
								instructions={list.instructions}
							/>

							<ModeSelector
								mode={mode}
								setMode={setMode}
								allowChat={list.allow_chat}
								allowVoice={list.allow_voice}
								calendarUrl={list.calendar_url}
							/>

							{/* Phone input */}
							<div className="space-y-2">
								<Label htmlFor={phoneId} className="font-medium text-sm text-white/80">
									Your Phone Number
								</Label>
								<Input
									id={phoneId}
									type="tel"
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
									placeholder="+1 (555) 123-4567"
									className="h-12 rounded-xl border-white/[0.08] bg-white/[0.06] text-white backdrop-blur-sm placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
									required
								/>
								{list.hero_cta_helper && (
									<p className="text-right text-white/40 text-xs">{list.hero_cta_helper}</p>
								)}
							</div>

							<Button
								type="submit"
								disabled={isSaving || !isPhoneValid}
								className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 font-semibold text-base text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-600 hover:to-indigo-700 hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-40 disabled:shadow-none"
							>
								{isSaving ? (
									<Loader2 className="h-5 w-5 animate-spin" />
								) : (
									<>
										Continue
										<ArrowRight className="ml-2 h-5 w-5" />
									</>
								)}
							</Button>
						</motion.form>
					)}

					{/* ── Name Stage ── */}
					{stage === "name" && (
						<motion.form
							onSubmit={handleNameSubmit}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
							className="space-y-5"
						>
							<p className="text-base text-white/70 leading-relaxed">
								We don't recognize your email. Please enter your name to continue.
							</p>

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label className="font-medium text-sm text-white/80">
										First Name <span className="text-red-400">*</span>
									</Label>
									<Input
										type="text"
										value={firstName}
										onChange={(e) => setFirstName(e.target.value)}
										placeholder="Jane"
										className="h-12 rounded-xl border-white/[0.08] bg-white/[0.06] text-white backdrop-blur-sm placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
										required
										autoFocus
									/>
								</div>
								<div className="space-y-2">
									<Label className="font-medium text-sm text-white/80">Last Name</Label>
									<Input
										type="text"
										value={lastName}
										onChange={(e) => setLastName(e.target.value)}
										placeholder="Doe"
										className="h-12 rounded-xl border-white/[0.08] bg-white/[0.06] text-white backdrop-blur-sm placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
									/>
								</div>
							</div>

							<div className="flex items-center justify-between">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setStage("email")}
									className="rounded-full text-white/50 hover:bg-white/10 hover:text-white"
								>
									<ArrowLeft className="mr-1.5 h-4 w-4" />
									Back
								</Button>
								<Button
									type="submit"
									disabled={isSaving}
									className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-6 font-semibold text-white shadow-lg shadow-violet-500/25 hover:from-violet-600 hover:to-indigo-700"
								>
									{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
									<ArrowRight className="ml-1.5 h-4 w-4" />
								</Button>
							</div>
						</motion.form>
					)}

					{/* ── Instructions Stage ── */}
					{stage === "instructions" && (
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
							className="space-y-6"
						>
							<div className="flex flex-col items-center gap-5 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 text-center backdrop-blur-sm">
								<div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
									<CheckCircle2 className="h-8 w-8 text-emerald-400" />
								</div>
								<div className="space-y-3">
									<h2 className="font-bold text-xl text-white">You're signed up!</h2>
									{list.instructions ? (
										<div className="prose prose-sm prose-invert max-w-none text-left prose-li:text-sm prose-li:text-white/60 prose-p:text-sm prose-p:text-white/60 prose-ul:text-sm prose-ul:text-white/60 prose-p:leading-relaxed">
											<Streamdown>{list.instructions}</Streamdown>
										</div>
									) : (
										<p className="text-white/60">
											Answer a few quick questions to help us understand your needs better.
										</p>
									)}
								</div>
							</div>

							<Button
								onClick={() => setStage("survey")}
								className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 font-semibold text-base text-white shadow-lg shadow-violet-500/25 hover:from-violet-600 hover:to-indigo-700"
							>
								Continue to questions
								<ArrowRight className="ml-2 h-5 w-5" />
							</Button>
						</motion.div>
					)}

					{/* ── Survey Stage: Form Mode ── */}
					{stage === "survey" && resolvedMode === "form" && currentQuestion && (
						<div className="flex flex-1 flex-col justify-center py-4">
							<AnimatePresence mode="wait">
								<motion.div
									key={currentQuestion.id}
									initial={{ opacity: 0, y: 30 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -30 }}
									transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
									className="space-y-5"
								>
									{/* Question card */}
									<div className="space-y-4 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-sm sm:p-7">
										{/* Question number + text */}
										<div>
											<span className="mb-2 inline-block rounded-full bg-white/10 px-2.5 py-0.5 font-semibold text-white/60 text-xs">
												{currentIndex + 1} of {questions.length}
											</span>
											<h2 className="font-semibold text-lg text-white leading-snug sm:text-xl">
												{currentQuestion.prompt}
												{currentQuestion.required && <span className="ml-1 text-violet-400">*</span>}
											</h2>
										</div>

										{/* Question video - full bleed within card */}
										{currentQuestion.videoUrl && (
											<div className="-mx-5 overflow-hidden sm:-mx-7">
												<video
													src={currentQuestion.videoUrl}
													className="aspect-video w-full bg-black object-cover"
													controls
													playsInline
												/>
											</div>
										)}

										{currentQuestion.helperText && (
											<p className="text-sm text-white/50">{currentQuestion.helperText}</p>
										)}

										{/* Answer input */}
										<div className="space-y-4">
											{renderQuestionInput({
												question: currentQuestion,
												value: currentAnswer,
												onChange: setCurrentAnswer,
												voiceSupported: isVoiceSupported,
												voiceButtonState: formVoiceButtonState,
												toggleRecording: toggleFormRecording,
											})}
										</div>
									</div>

									{/* Navigation buttons */}
									<div className="flex items-center justify-between px-1">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={handleBack}
											disabled={currentIndex === 0}
											className="rounded-full text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
										>
											<ArrowLeft className="mr-1 h-4 w-4" />
											Back
										</Button>
										{isReviewing ? (
											<Button
												type="button"
												onClick={() => {
													if (currentIndex === questions.length - 1) {
														setIsReviewing(false)
														setStage("complete")
													} else {
														setCurrentIndex(currentIndex + 1)
														setCurrentAnswer(responses[questions[currentIndex + 1]?.id] ?? "")
													}
												}}
												className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-6 font-semibold text-white shadow-lg shadow-violet-500/25 hover:from-violet-600 hover:to-indigo-700"
											>
												{currentIndex === questions.length - 1 ? "Done" : "Next"}
												<ArrowRight className="ml-1.5 h-4 w-4" />
											</Button>
										) : (
											<Button
												type="button"
												onClick={() => void handleAnswerSubmit(currentAnswer)}
												disabled={isSaving || (currentQuestion?.required && !hasResponseValue(currentAnswer))}
												className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-6 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-600 hover:to-indigo-700 hover:shadow-xl disabled:opacity-40 disabled:shadow-none"
											>
												{isSaving ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : currentIndex === questions.length - 1 ? (
													"Submit"
												) : (
													"Next"
												)}
												<ArrowRight className="ml-1.5 h-4 w-4" />
											</Button>
										)}
									</div>

									{/* Mode switcher */}
									{renderModeSwitcher()}
								</motion.div>
							</AnimatePresence>
						</div>
					)}

					{/* ── Survey Stage: Chat Mode ── */}
					{stage === "survey" && resolvedMode === "chat" && responseId && (
						<ChatSection
							slug={slug}
							responseId={responseId}
							responses={responses}
							questions={questions}
							allowVideo={list.allow_video}
							onComplete={() => {
								setStage("complete")
								if (list.redirect_url) {
									setRedirectCountdown(7)
								}
							}}
							onVideoStage={() => setStage("video")}
							renderModeSwitcher={renderModeSwitcher}
						/>
					)}

					{/* ── Video Stage ── */}
					{stage === "video" && responseId && (
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
							className="space-y-5"
						>
							<div className="text-center">
								<h2 className="font-bold text-xl text-white">Record a video?</h2>
								<p className="mt-2 text-white/60">Share your thoughts on camera for a more personal touch.</p>
							</div>
							<VideoRecorder
								slug={slug}
								responseId={responseId}
								onComplete={() => {
									setStage("complete")
									if (list.redirect_url) {
										setRedirectCountdown(7)
									}
								}}
								onSkip={() => {
									setStage("complete")
									if (list.redirect_url) {
										setRedirectCountdown(7)
									}
								}}
							/>
						</motion.div>
					)}

					{/* ── Complete Stage ── */}
					{stage === "complete" && (
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
							className="space-y-6"
						>
							{/* Success card */}
							<div className="flex flex-col items-center gap-5 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 text-center backdrop-blur-sm md:p-10">
								<motion.div
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 12 }}
									className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/20 to-emerald-500/10"
								>
									<CheckCircle2 className="h-10 w-10 text-emerald-400" />
								</motion.div>
								<div className="space-y-2">
									<h2 className="font-bold text-2xl text-white">Thanks for sharing!</h2>
									<Button
										asChild
										variant="outline"
										className="mt-2 rounded-full border-white/20 bg-white/5 text-white backdrop-blur-sm hover:border-white/30 hover:bg-white/10 hover:text-white"
									>
										<a href="https://getupsight.com/sign-up" target="_blank" rel="noreferrer">
											Create a free account to see your responses
										</a>
									</Button>
								</div>

								{/* Calendar booking */}
								{list.calendar_url && (
									<div className="w-full space-y-3 border-white/[0.06] border-t pt-5">
										<div className="flex items-center justify-center gap-2 text-sm text-white/50">
											<Calendar className="h-4 w-4" />
											Want to discuss your feedback?
										</div>
										<Button
											asChild
											className="h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 font-semibold text-white shadow-lg shadow-violet-500/25 hover:from-violet-600 hover:to-indigo-700"
										>
											<a href={list.calendar_url} target="_blank" rel="noreferrer">
												<Calendar className="h-4 w-4" />
												Book a call
											</a>
										</Button>
									</div>
								)}

								{/* Share section */}
								<div className="w-full space-y-3 border-white/[0.06] border-t pt-5">
									<Button
										onClick={handleCopyLink}
										variant="outline"
										className="w-full gap-2 rounded-xl border-white/[0.08] bg-white/[0.04] text-white backdrop-blur-sm hover:bg-white/10 hover:text-white"
									>
										{copiedLink ? (
											<>
												<Check className="h-4 w-4 text-emerald-400" />
												Link copied!
											</>
										) : (
											<>
												<Copy className="h-4 w-4" />
												Copy link to share
											</>
										)}
									</Button>
								</div>

								{list.redirect_url && redirectCountdown !== null && (
									<div className="flex items-center gap-3">
										<p className="text-white/30 text-xs">Redirecting in {redirectCountdown}s...</p>
										<Button
											variant="ghost"
											size="sm"
											onClick={cancelRedirect}
											className="h-6 rounded-full px-2 text-white/40 text-xs hover:bg-white/10 hover:text-white"
										>
											Cancel
										</Button>
									</div>
								)}

								{/* Review answers */}
								<Button
									variant="ghost"
									onClick={() => {
										setCurrentIndex(0)
										setIsReviewing(true)
										setStage("survey")
									}}
									className="w-full gap-2 rounded-xl text-white/50 hover:bg-white/[0.06] hover:text-white"
								>
									<ClipboardList className="h-4 w-4" />
									Review your answers
								</Button>

								{/* Start over */}
								<button
									type="button"
									onClick={handleStartOver}
									className="text-white/30 text-xs underline-offset-2 transition-colors hover:text-white/50 hover:underline"
								>
									Start over with a different email
								</button>
							</div>
						</motion.div>
					)}
				</div>
			</div>

			{/* Powered by badge - bottom floating */}
			<div className="shrink-0 pb-[env(safe-area-inset-bottom,16px)] pt-2 text-center">
				<a
					href="https://getUpSight.com"
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-white/25 text-xs backdrop-blur-sm transition hover:text-white/40"
				>
					<Logo size={5} />
					Powered by UpSight
				</a>
			</div>
		</div>
	)
}

function findNextQuestionIndex(responses: ResponseRecord, questions: ResearchLinkQuestion[]) {
	for (let index = 0; index < questions.length; index++) {
		const question = questions[index]
		const value = responses?.[question.id]
		if (!hasResponseValue(value)) {
			return index
		}
	}
	return questions.length
}

function hasResponseValue(value: ResponseValue) {
	if (Array.isArray(value)) return value.length > 0
	if (typeof value === "string") return value.trim().length > 0
	if (typeof value === "boolean") return true
	return false
}

function normalizeResponseValue(value: ResponseValue): ResponseValue {
	if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
	if (typeof value === "string") return value.trim()
	return value ?? null
}

function renderQuestionInput({
	question,
	value,
	onChange,
	voiceSupported,
	voiceButtonState,
	toggleRecording,
}: {
	question: ResearchLinkQuestion
	value: ResponseValue
	onChange: (value: ResponseValue) => void
	voiceSupported?: boolean
	voiceButtonState?: VoiceButtonState
	toggleRecording?: () => void
}) {
	const resolved = resolveQuestionInput(question)

	if (resolved.kind === "select") {
		return (
			<Select value={typeof value === "string" ? value : ""} onValueChange={(next) => onChange(next)}>
				<SelectTrigger className="h-12 rounded-xl border-white/[0.08] bg-white/[0.06] text-white backdrop-blur-sm">
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					{resolved.options.map((option) => (
						<SelectItem key={option} value={option}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		)
	}

	if (resolved.kind === "multi") {
		const selected = Array.isArray(value) ? value : []
		return (
			<div className="space-y-2">
				{resolved.options.map((option) => {
					const checked = selected.includes(option)
					return (
						<label
							key={option}
							className={cn(
								"flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all",
								checked
									? "border-violet-500/40 bg-violet-500/10 text-white"
									: "border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/20"
							)}
						>
							<Checkbox
								checked={checked}
								onCheckedChange={(next) => {
									const nextChecked = Boolean(next)
									onChange(nextChecked ? [...selected, option] : selected.filter((entry) => entry !== option))
								}}
							/>
							<span>{option}</span>
						</label>
					)
				})}
			</div>
		)
	}

	if (resolved.kind === "likert") {
		const selectedValue = typeof value === "string" ? value : ""
		const scalePoints = Array.from({ length: resolved.scale }, (_, i) => i + 1)
		return (
			<div className="space-y-3">
				<div className="flex items-center justify-between gap-1.5">
					{scalePoints.map((point) => (
						<button
							key={point}
							type="button"
							onClick={() => onChange(String(point))}
							className={cn(
								"flex h-12 w-12 items-center justify-center rounded-xl border font-semibold text-sm transition-all",
								selectedValue === String(point)
									? "border-violet-500/50 bg-gradient-to-br from-violet-500/30 to-indigo-500/20 text-white shadow-lg shadow-violet-500/20"
									: "border-white/[0.08] bg-white/[0.04] text-white/60 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
							)}
						>
							{point}
						</button>
					))}
				</div>
				{(resolved.labels.low || resolved.labels.high) && (
					<div className="flex justify-between text-white/40 text-xs">
						<span>{resolved.labels.low}</span>
						<span>{resolved.labels.high}</span>
					</div>
				)}
			</div>
		)
	}

	if (resolved.kind === "image_select") {
		const selectedValue = typeof value === "string" ? value : ""
		return (
			<div className="-mx-5 grid grid-cols-2 gap-2 px-5 sm:-mx-7 sm:grid-cols-3 sm:gap-3 sm:px-7">
				{resolved.options.map((option) => (
					<button
						key={option.label}
						type="button"
						onClick={() => onChange(option.label)}
						className={cn(
							"group relative overflow-hidden rounded-2xl border-2 transition-all",
							selectedValue === option.label
								? "border-violet-400 shadow-lg shadow-violet-500/20 ring-2 ring-violet-500/30"
								: "border-transparent hover:border-white/20"
						)}
					>
						<div className="aspect-square overflow-hidden">
							<img
								src={option.imageUrl}
								alt={option.label}
								className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
							/>
						</div>
						<div
							className={cn(
								"absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-3",
								selectedValue === option.label && "from-violet-900/90 via-violet-900/50"
							)}
						>
							<span className="font-semibold text-sm text-white drop-shadow-sm">
								{option.label}
							</span>
						</div>
						{selectedValue === option.label && (
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg"
							>
								<Check className="h-4 w-4 text-white" />
							</motion.div>
						)}
					</button>
				))}
			</div>
		)
	}

	if (resolved.kind === "textarea") {
		return (
			<div className="relative w-full">
				<Textarea
					value={typeof value === "string" ? value : ""}
					onChange={(event) => onChange(event.target.value)}
					placeholder="Share your thoughts..."
					rows={4}
					className="w-full rounded-xl border-white/[0.08] bg-white/[0.06] pr-12 text-white backdrop-blur-sm placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
				/>
				{voiceSupported && toggleRecording && voiceButtonState && (
					<div className="absolute top-2 right-2">
						<VoiceButton
							size="icon"
							variant="ghost"
							state={voiceButtonState}
							onPress={toggleRecording}
							icon={<Mic className="h-4 w-4" />}
							className="h-8 w-8 rounded-full text-white/50 hover:bg-white/10 hover:text-white"
						/>
					</div>
				)}
			</div>
		)
	}

	// Text input with voice button for text-based inputs (not email/tel)
	const showVoice = voiceSupported && toggleRecording && voiceButtonState && resolved.inputType === "text"

	return (
		<div className="relative">
			<Input
				type={resolved.inputType}
				value={typeof value === "string" ? value : ""}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Type your response..."
				className={cn(
					"h-12 rounded-xl border-white/[0.08] bg-white/[0.06] text-white backdrop-blur-sm placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20",
					showVoice && "pr-12"
				)}
			/>
			{showVoice && (
				<div className="-translate-y-1/2 absolute top-1/2 right-2">
					<VoiceButton
						size="icon"
						variant="ghost"
						state={voiceButtonState}
						onPress={toggleRecording}
						icon={<Mic className="h-4 w-4" />}
						className="h-8 w-8 rounded-full text-white/50 hover:bg-white/10 hover:text-white"
					/>
				</div>
			)}
		</div>
	)
}

function resolveQuestionInput(question: ResearchLinkQuestion) {
	if (question.type === "single_select" && question.options?.length) {
		return { kind: "select" as const, options: question.options }
	}
	if (question.type === "multi_select" && question.options?.length) {
		return { kind: "multi" as const, options: question.options }
	}
	if (question.type === "likert") {
		return {
			kind: "likert" as const,
			scale: question.likertScale ?? 5,
			labels: question.likertLabels ?? { low: "", high: "" },
		}
	}
	if (question.type === "image_select" && question.imageOptions?.length) {
		return {
			kind: "image_select" as const,
			options: question.imageOptions,
		}
	}
	if (question.type === "long_text") {
		return { kind: "textarea" as const }
	}
	if (question.type === "short_text") {
		return { kind: "input" as const, inputType: "text" as const }
	}

	const prompt = question.prompt.toLowerCase()
	if (question.options?.length) {
		return { kind: "select" as const, options: question.options }
	}
	if (/email/.test(prompt)) {
		return { kind: "input" as const, inputType: "email" as const }
	}
	if (/phone|mobile|text me/.test(prompt)) {
		return { kind: "input" as const, inputType: "tel" as const }
	}
	return { kind: "textarea" as const }
}
