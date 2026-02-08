/**
 * Public survey page with both form and AI chat modes
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
	Share2,
	Video,
} from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router-dom"
import { Streamdown } from "streamdown"
import { z } from "zod"
import { Logo } from "~/components/branding"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
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
		<div className="space-y-4">
			{/* Chat messages */}
			<div ref={chatContainerRef} className="h-[350px] space-y-3 overflow-y-auto pr-2">
				{/* Show error if any */}
				{chatError && (
					<div className="rounded-lg border border-red-500/30 bg-red-500/20 px-3 py-2 text-red-200 text-sm">
						Something went wrong. Please try again or switch to form mode.
					</div>
				)}
				{/* Show initial loading state before first message arrives */}
				{messages.length === 0 && !chatError && (
					<div className="flex justify-start">
						<div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5 text-sm text-white/90">
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
							// Show loading for empty assistant message
							return (
								<div key={message.id} className="flex justify-start">
									<div className="rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5">
										<Loader2 className="h-4 w-4 animate-spin text-white/50" />
									</div>
								</div>
							)
						}
						return (
							<div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
								<div
									className={cn(
										"max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
										message.role === "user"
											? "rounded-br-md bg-white text-black"
											: "rounded-bl-md bg-white/10 text-white/90"
									)}
								>
									{text}
								</div>
							</div>
						)
					})}
				{/* Only show trailing spinner if the last message has text (not an empty streaming message) */}
				{isChatLoading && messages.length > 0 && getMessageText(messages[messages.length - 1]) !== "" && (
					<div className="flex justify-start">
						<div className="rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5">
							<Loader2 className="h-4 w-4 animate-spin text-white/50" />
						</div>
					</div>
				)}
			</div>

			{/* Chat input */}
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
						rows={3}
						className="resize-none border-white/10 bg-black/40 pr-12 text-white placeholder:text-white/40"
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
					className="h-10 w-10 shrink-0 bg-white text-black hover:bg-white/90"
				>
					<Send className="h-4 w-4" />
				</Button>
			</form>

			{/* Mode switcher at bottom */}
			{renderModeSwitcher()}
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

	// Mode switcher component for survey stages
	const renderModeSwitcher = () => {
		if (!hasMultipleModes) return null
		return (
			<div className="flex items-center justify-center gap-1 py-2">
				<button
					type="button"
					onClick={() => void handleModeSwitch("form")}
					className={cn(
						"flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-xs transition-all",
						resolvedMode === "form" ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
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
							"flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-xs transition-all",
							resolvedMode === "chat" ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
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
							"flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-xs transition-all",
							resolvedMode === "voice" ? "bg-violet-500/30 text-white" : "text-white/50 hover:text-white/80"
						)}
					>
						<Mic className="h-3.5 w-3.5" />
						Voice
					</button>
				)}
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

	if (initializing) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
				<Loader2 className="h-8 w-8 animate-spin text-white/50" />
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-8 md:py-16">
			<div className="mx-auto max-w-2xl px-4">
				<Card className="overflow-hidden border-white/10 bg-black/30 backdrop-blur">
					<CardHeader className="space-y-2 pb-3">
						<div className="space-y-1">
							<h1 className="font-semibold text-white text-xl">
								{list.hero_title || list.name || "Share your feedback"}
							</h1>
						</div>
					</CardHeader>

					<CardContent className="space-y-4 bg-black/40 p-4 text-white md:p-6">
						{error && (
							<Alert variant="destructive" className="border-red-500/60 bg-red-500/10 text-red-100">
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						{/* Email stage */}
						{stage === "email" && (
							<motion.form
								onSubmit={handleEmailSubmit}
								initial={{ opacity: 0, y: 16 }}
								animate={{ opacity: 1, y: 0 }}
								className="space-y-4"
							>
								{/* Walkthrough video */}
								{walkthroughSignedUrl && (
									<div className="overflow-hidden rounded-xl">
										<video src={walkthroughSignedUrl} className="aspect-video w-full bg-black" controls playsInline />
									</div>
								)}

								{/* Instructions for the respondent */}
								{list.instructions && <p className="text-sm text-white/80 leading-relaxed">{list.instructions}</p>}

								{/* Mode selector - show when multiple modes available */}
								{(list.allow_chat || list.allow_voice || list.calendar_url) && (
									<div className="space-y-2">
										<p className="text-white/60 text-xs">How would you like to respond?</p>
										<div className="flex gap-2">
											<button
												type="button"
												onClick={() => setMode("form")}
												className={cn(
													"flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-all",
													mode === "form"
														? "border-white bg-white/10 text-white"
														: "border-white/20 text-white/60 hover:border-white/40 hover:text-white/80"
												)}
											>
												<ClipboardList className="h-5 w-5" />
												<span className="font-medium text-xs">Form</span>
											</button>
											{list.allow_chat && (
												<button
													type="button"
													onClick={() => setMode("chat")}
													className={cn(
														"flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-all",
														mode === "chat"
															? "border-white bg-white/10 text-white"
															: "border-white/20 text-white/60 hover:border-white/40 hover:text-white/80"
													)}
												>
													<MessageSquare className="h-5 w-5" />
													<span className="font-medium text-xs">Chat</span>
												</button>
											)}
											{list.allow_voice && (
												<button
													type="button"
													onClick={() => setMode("voice")}
													className={cn(
														"relative flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-all",
														mode === "voice"
															? "border-violet-400 bg-violet-500/20 text-white"
															: "border-white/20 text-white/60 hover:border-white/40 hover:text-white/80"
													)}
												>
													<Mic className="h-5 w-5" />
													<span className="font-medium text-xs">Voice</span>
													<span className="-top-1 -right-1 absolute rounded bg-violet-500 px-1 py-0.5 font-bold text-[8px] text-white">
														NEW
													</span>
												</button>
											)}
											{list.calendar_url && (
												<a
													href={list.calendar_url}
													target="_blank"
													rel="noreferrer"
													className="flex flex-1 flex-col items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2.5 text-white/60 transition-all hover:border-white/40 hover:text-white/80"
												>
													<Calendar className="h-5 w-5" />
													<span className="font-medium text-xs">Book Call / Meet</span>
												</a>
											)}
										</div>
									</div>
								)}

								{/* Email field */}
								<div className="space-y-2">
									<Label htmlFor={emailId} className="text-white/90">
										Your Email
									</Label>
									<Input
										id={emailId}
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										placeholder="you@company.com"
										className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
										required
									/>
								</div>
								<div className="flex justify-end">
									<Button
										type="submit"
										disabled={isSaving || !isEmailValid}
										size="sm"
										className="bg-white text-black hover:bg-white/90 disabled:bg-white/30 disabled:text-white/50"
									>
										{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
										<ArrowRight className="ml-1.5 h-4 w-4" />
									</Button>
								</div>
							</motion.form>
						)}

						{/* Phone stage - for phone-identified surveys */}
						{stage === "phone" && (
							<motion.form
								onSubmit={handlePhoneSubmit}
								initial={{ opacity: 0, y: 16 }}
								animate={{ opacity: 1, y: 0 }}
								className="space-y-4"
							>
								{/* Walkthrough video */}
								{walkthroughSignedUrl && (
									<div className="overflow-hidden rounded-xl">
										<video src={walkthroughSignedUrl} className="aspect-video w-full bg-black" controls playsInline />
									</div>
								)}

								{/* Instructions for the respondent */}
								{list.instructions && <p className="text-sm text-white/80 leading-relaxed">{list.instructions}</p>}

								{/* Mode selector - show when multiple modes available */}
								{(list.allow_chat || list.allow_voice || list.calendar_url) && (
									<div className="space-y-2">
										<p className="text-white/60 text-xs">How would you like to respond?</p>
										<div className="flex gap-2">
											<button
												type="button"
												onClick={() => setMode("form")}
												className={cn(
													"flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-all",
													mode === "form"
														? "border-white bg-white/10 text-white"
														: "border-white/20 text-white/60 hover:border-white/40 hover:text-white/80"
												)}
											>
												<ClipboardList className="h-5 w-5" />
												<span className="font-medium text-xs">Form</span>
											</button>
											{list.allow_chat && (
												<button
													type="button"
													onClick={() => setMode("chat")}
													className={cn(
														"flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-all",
														mode === "chat"
															? "border-white bg-white/10 text-white"
															: "border-white/20 text-white/60 hover:border-white/40 hover:text-white/80"
													)}
												>
													<MessageSquare className="h-5 w-5" />
													<span className="font-medium text-xs">Chat</span>
												</button>
											)}
											{list.allow_voice && (
												<button
													type="button"
													onClick={() => setMode("voice")}
													className={cn(
														"relative flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-all",
														mode === "voice"
															? "border-violet-400 bg-violet-500/20 text-white"
															: "border-white/20 text-white/60 hover:border-white/40 hover:text-white/80"
													)}
												>
													<Mic className="h-5 w-5" />
													<span className="font-medium text-xs">Voice</span>
													<span className="-top-1 -right-1 absolute rounded bg-violet-500 px-1 py-0.5 font-bold text-[8px] text-white">
														NEW
													</span>
												</button>
											)}
											{list.calendar_url && (
												<a
													href={list.calendar_url}
													target="_blank"
													rel="noreferrer"
													className="flex flex-1 flex-col items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2.5 text-white/60 transition-all hover:border-white/40 hover:text-white/80"
												>
													<Calendar className="h-5 w-5" />
													<span className="font-medium text-xs">Book Call / Meet</span>
												</a>
											)}
										</div>
									</div>
								)}

								{/* Phone field */}
								<div className="space-y-2">
									<Label htmlFor={phoneId} className="text-white/90">
										Your Phone Number
									</Label>
									<Input
										id={phoneId}
										type="tel"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										placeholder="+1 (555) 123-4567"
										className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
										required
									/>
								</div>
								<div className="flex justify-end">
									<Button
										type="submit"
										disabled={isSaving || !isPhoneValid}
										size="sm"
										className="bg-white text-black hover:bg-white/90 disabled:bg-white/30 disabled:text-white/50"
									>
										{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
										<ArrowRight className="ml-1.5 h-4 w-4" />
									</Button>
								</div>
							</motion.form>
						)}

						{/* Name stage - shown only when person not found by email */}
						{stage === "name" && (
							<motion.form
								onSubmit={handleNameSubmit}
								initial={{ opacity: 0, y: 16 }}
								animate={{ opacity: 1, y: 0 }}
								className="space-y-4"
							>
								<p className="text-sm text-white/80 leading-relaxed">
									We don't recognize your email. Please enter your name to continue.
								</p>

								{/* Name fields */}
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-2">
										<Label className="text-white/90">
											First Name <span className="text-red-400">*</span>
										</Label>
										<Input
											type="text"
											value={firstName}
											onChange={(e) => setFirstName(e.target.value)}
											placeholder="Jane"
											className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
											required
											autoFocus
										/>
									</div>
									<div className="space-y-2">
										<Label className="text-white/90">Last Name</Label>
										<Input
											type="text"
											value={lastName}
											onChange={(e) => setLastName(e.target.value)}
											placeholder="Doe"
											className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
										/>
									</div>
								</div>

								<div className="flex items-center justify-between">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setStage("email")}
										className="text-white/50 hover:bg-white/10 hover:text-white"
									>
										<ArrowLeft className="mr-1.5 h-4 w-4" />
										Back
									</Button>
									<Button type="submit" disabled={isSaving} size="sm" className="bg-white text-black hover:bg-white/90">
										{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
										<ArrowRight className="ml-1.5 h-4 w-4" />
									</Button>
								</div>
							</motion.form>
						)}

						{/* Instructions stage - shown when coming from embed redirect */}
						{stage === "instructions" && (
							<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
								<div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-6 text-center">
									<CheckCircle2 className="h-10 w-10 text-emerald-400" />
									<div className="space-y-2">
										<h2 className="font-semibold text-lg text-white">You're signed up!</h2>
										{list.instructions ? (
											<div className="prose prose-sm prose-invert max-w-none text-left prose-li:text-sm prose-li:text-white/70 prose-p:text-sm prose-p:text-white/70 prose-ul:text-sm prose-ul:text-white/70 prose-p:leading-relaxed">
												<Streamdown>{list.instructions}</Streamdown>
											</div>
										) : (
											<p className="text-sm text-white/70">
												Answer a few quick questions to help us understand your needs better.
											</p>
										)}
									</div>
								</div>
								<div className="flex justify-center">
									<Button onClick={() => setStage("survey")} className="bg-white text-black hover:bg-white/90">
										Continue to questions
										<ArrowRight className="ml-1.5 h-4 w-4" />
									</Button>
								</div>
							</motion.div>
						)}

						{/* Survey stage - Form mode */}
						{stage === "survey" && resolvedMode === "form" && currentQuestion && (
							<AnimatePresence mode="wait">
								<motion.div
									key={currentQuestion.id}
									initial={{ opacity: 0, x: 20 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -20 }}
									transition={{ duration: 0.2 }}
									className="space-y-3"
								>
									<div className="rounded-xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4 sm:p-5">
										<h2 className="mb-1 flex items-start gap-2 font-medium text-base text-white sm:text-lg">
											<span className="shrink-0 text-white/50">{currentIndex + 1}.</span>
											<span>
												{currentQuestion.prompt}
												{currentQuestion.required && <span className="ml-1 text-red-400">*</span>}
											</span>
										</h2>
										{/* Question video prompt */}
										{currentQuestion.videoUrl && (
											<div className="my-3 overflow-hidden rounded-lg">
												<video
													src={currentQuestion.videoUrl}
													className="aspect-video w-full bg-black"
													controls
													playsInline
												/>
											</div>
										)}
										{currentQuestion.helperText && (
											<p className="mb-4 text-sm text-white/50">{currentQuestion.helperText}</p>
										)}
										<div
											className={cn("space-y-6", !currentQuestion.helperText && !currentQuestion.videoUrl && "mt-4")}
										>
											{renderQuestionInput({
												question: currentQuestion,
												value: currentAnswer,
												onChange: setCurrentAnswer,
												voiceSupported: isVoiceSupported,
												voiceButtonState: formVoiceButtonState,
												toggleRecording: toggleFormRecording,
											})}
											<div className="flex items-center justify-between pt-4">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={handleBack}
													disabled={currentIndex === 0}
													className="-ml-2 text-white/50 hover:bg-white/10 hover:text-white"
												>
													<ArrowLeft className="mr-1 h-3.5 w-3.5" />
													Back
												</Button>
												{isReviewing ? (
													<Button
														type="button"
														size="sm"
														onClick={() => {
															if (currentIndex === questions.length - 1) {
																setIsReviewing(false)
																setStage("complete")
															} else {
																setCurrentIndex(currentIndex + 1)
																setCurrentAnswer(responses[questions[currentIndex + 1]?.id] ?? "")
															}
														}}
														className="bg-white text-black hover:bg-white/90"
													>
														{currentIndex === questions.length - 1 ? "Done" : "Next"}
														<ArrowRight className="ml-1 h-3.5 w-3.5" />
													</Button>
												) : (
													<Button
														type="button"
														size="sm"
														onClick={() => void handleAnswerSubmit(currentAnswer)}
														disabled={isSaving || (currentQuestion?.required && !hasResponseValue(currentAnswer))}
														className="bg-white text-black hover:bg-white/90 disabled:bg-white/30 disabled:text-white/50"
													>
														{isSaving ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : currentIndex === questions.length - 1 ? (
															"Submit"
														) : (
															"Next"
														)}
														<ArrowRight className="ml-1 h-3.5 w-3.5" />
													</Button>
												)}
											</div>
										</div>
									</div>

									{/* Progress indicator - clickable numbers */}
									<div className="flex items-center justify-center gap-1.5 pt-3">
										{questions.map((q, idx) => {
											const isAnswered = hasResponseValue(responses[q.id])
											const isCurrent = idx === currentIndex
											const canJump = isAnswered || isCurrent || idx < currentIndex
											return (
												<button
													key={q.id}
													type="button"
													onClick={() => handleJumpToQuestion(idx)}
													disabled={!canJump}
													className={cn(
														"flex h-6 w-6 items-center justify-center rounded-full font-medium text-xs transition-all",
														isCurrent
															? "bg-white text-black ring-2 ring-white/30"
															: isAnswered
																? "bg-emerald-500/80 text-white hover:bg-emerald-500"
																: "bg-white/10 text-white/40",
														canJump && !isCurrent && "cursor-pointer",
														!canJump && "cursor-not-allowed opacity-50"
													)}
													title={
														isCurrent
															? "Current question"
															: isAnswered
																? `Jump to question ${idx + 1}`
																: `Question ${idx + 1} (not yet answered)`
													}
												>
													{idx + 1}
												</button>
											)
										})}
									</div>
									{/* Mode switcher */}
									{renderModeSwitcher()}
								</motion.div>
							</AnimatePresence>
						)}

						{/* Survey stage - Chat mode */}
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

						{/* Video stage */}
						{stage === "video" && responseId && (
							<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
								<div className="space-y-2">
									<h2 className="font-medium text-white">Would you like to record a video?</h2>
									<p className="text-sm text-white/60">Share your thoughts on camera for a more personal response.</p>
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

						{/* Complete stage */}
						{stage === "complete" && (
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/10 p-8 text-center"
							>
								<CheckCircle2 className="h-12 w-12 text-emerald-300" />
								<div className="space-y-2">
									<h2 className="font-semibold text-xl">Thanks for sharing!</h2>
									{/* <p className="text-sm text-white/70">Your responses have been saved.</p> */}
									<div className="flex items-center justify-center gap-2">
										<Button
											asChild
											variant="outline"
											className="border-white bg-transparent text-white hover:border-white/50 hover:bg-white/10 hover:text-white"
										>
											<a href="https://getupsight.com/sign-up" target="_blank" rel="noreferrer">
												Create a free account to see your responses
											</a>
										</Button>
									</div>
								</div>

								{/* Calendar booking */}
								{list.calendar_url && (
									<div className="w-full space-y-3 border-white/10 border-t pt-4">
										<div className="flex items-center justify-center gap-2 text-sm text-white/60">
											<Calendar className="h-4 w-4" />
											Want to discuss your feedback?
										</div>
										<Button asChild className="w-full gap-2 bg-white text-black hover:bg-white/90">
											<a href={list.calendar_url} target="_blank" rel="noreferrer">
												<Calendar className="h-4 w-4" />
												Book a call
											</a>
										</Button>
									</div>
								)}

								{/* Share section */}
								<div className="w-full space-y-3 border-white/10 border-t pt-4">
									<Button
										onClick={handleCopyLink}
										variant="outline"
										className="w-full gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
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
										<p className="text-white/40 text-xs">Redirecting in {redirectCountdown}s...</p>
										<Button
											variant="ghost"
											size="sm"
											onClick={cancelRedirect}
											className="h-6 px-2 text-white/40 text-xs hover:bg-white/10 hover:text-white"
										>
											Cancel
										</Button>
									</div>
								)}

								{/* Review answers option */}
								<Button
									variant="ghost"
									onClick={() => {
										setCurrentIndex(0)
										setIsReviewing(true)
										setStage("survey")
									}}
									className="w-full gap-2 text-white/60 hover:bg-white/10 hover:text-white"
								>
									<ClipboardList className="h-4 w-4" />
									Review your answers
								</Button>

								{/* Start over option */}
								<button
									type="button"
									onClick={handleStartOver}
									className="text-white/40 text-xs underline-offset-2 hover:text-white/60 hover:underline"
								>
									Start over with a different email
								</button>
							</motion.div>
						)}
					</CardContent>
				</Card>

				{/* Powered by badge */}
				<div className="mt-6 flex justify-center">
					<a
						href="https://getUpSight.com"
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white/40 text-xs transition hover:text-white/60"
					>
						<Logo size={5} />
						Powered by UpSight
					</a>
				</div>

				{/* Growth CTA */}
				<p className="mt-3 text-center text-sm">
					{/* Need answers to your own questions?{" "} */}
					<a
						href="https://getupsight.com/sign-up"
						target="_blank"
						rel="noreferrer"
						className="font-medium text-white/50 transition-colors hover:text-white/80"
					>
						Get answers to your questions
						<span className="block">with a free account</span>
					</a>
				</p>
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
				<SelectTrigger className="border-white/10 bg-black/30 text-white">
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
						<label key={option} className="flex items-center gap-2 text-sm text-white/80">
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
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-1">
					{scalePoints.map((point) => (
						<button
							key={point}
							type="button"
							onClick={() => onChange(String(point))}
							className={cn(
								"flex h-10 w-10 items-center justify-center rounded-lg border font-medium text-sm transition-all",
								selectedValue === String(point)
									? "border-white bg-white text-black"
									: "border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:bg-white/10 hover:text-white"
							)}
						>
							{point}
						</button>
					))}
				</div>
				{(resolved.labels.low || resolved.labels.high) && (
					<div className="flex justify-between text-white/50 text-xs">
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
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{resolved.options.map((option) => (
					<button
						key={option.label}
						type="button"
						onClick={() => onChange(option.label)}
						className={cn(
							"group relative overflow-hidden rounded-xl border-2 transition-all",
							selectedValue === option.label
								? "border-white ring-2 ring-white/30"
								: "border-white/20 hover:border-white/40"
						)}
					>
						<div className="aspect-square overflow-hidden">
							<img
								src={option.imageUrl}
								alt={option.label}
								className="h-full w-full object-cover transition-transform group-hover:scale-105"
							/>
						</div>
						<div
							className={cn(
								"absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2",
								selectedValue === option.label && "from-white/90"
							)}
						>
							<span
								className={cn("font-medium text-sm", selectedValue === option.label ? "text-black" : "text-white/90")}
							>
								{option.label}
							</span>
						</div>
						{selectedValue === option.label && (
							<div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white">
								<Check className="h-4 w-4 text-black" />
							</div>
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
					className="w-full border-white/10 bg-black/30 pr-12 text-white placeholder:text-white/40"
				/>
				{voiceSupported && toggleRecording && voiceButtonState && (
					<div className="absolute top-2 right-2">
						<VoiceButton
							size="icon"
							variant="ghost"
							state={voiceButtonState}
							onPress={toggleRecording}
							icon={<Mic className="h-4 w-4" />}
							className="h-8 w-8 text-white/50 hover:bg-white/10 hover:text-white"
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
				className={cn("border-white/10 bg-black/30 text-white placeholder:text-white/40", showVoice && "pr-12")}
			/>
			{showVoice && (
				<div className="-translate-y-1/2 absolute top-1/2 right-2">
					<VoiceButton
						size="icon"
						variant="ghost"
						state={voiceButtonState}
						onPress={toggleRecording}
						icon={<Mic className="h-4 w-4" />}
						className="h-8 w-8 text-white/50 hover:bg-white/10 hover:text-white"
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
