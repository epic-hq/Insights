/**
 * Public survey page with both form and AI chat modes
 */
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowLeft,
	ArrowRight,
	Calendar,
	Check,
	CheckCircle2,
	ClipboardList,
	Loader2,
	MessageSquare,
	Mic,
	Send,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router-dom";
import { Streamdown } from "streamdown";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { VoiceButton, type VoiceButtonState } from "~/components/ui/voice-button";
import { getNextQuestionIndex, hasResponseValue } from "~/features/research-links/branching";
import { VideoRecorder } from "~/features/research-links/components/VideoRecorder";
import {
	RESPONDENT_FIELD_DEFINITION_MAP,
	type RespondentFieldConfig,
	type RespondentFieldKey,
	type RespondentFieldOption,
	getFieldKeys,
	isFieldRequired,
	parseRespondentFields,
} from "~/features/research-links/respondent-fields";
import { type ResearchLinkQuestion, ResearchLinkQuestionSchema } from "~/features/research-links/schemas";
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { cn } from "~/lib/utils";
import { createR2PresignedUrl } from "~/utils/r2.server";
import { extractUtmParamsFromSearch, hasUtmParams } from "~/utils/utm";

const emailSchema = z.string().email();
const phoneSchema = z.string().min(7, "Enter a valid phone number");

/** Detect media type from URL by file extension */
function detectMediaType(url: string): "image" | "video" | "audio" | "unknown" {
	const lower = url.toLowerCase();
	if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?|$)/.test(lower)) return "image";
	if (/\.(mp4|webm|mov|avi|mkv|ogv)(\?|$)/.test(lower)) return "video";
	if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|$)/.test(lower)) return "audio";
	return "unknown";
}

/** Render question media (image, video, or audio) with proper element type */
function QuestionMedia({ url }: { url: string }) {
	const type = detectMediaType(url);
	if (type === "image") {
		return (
			<div className="overflow-hidden rounded-lg">
				<img src={url} alt="" className="w-full rounded-lg object-contain" style={{ maxHeight: 320 }} />
			</div>
		);
	}
	if (type === "audio") {
		return <audio src={url} className="w-full" controls />;
	}
	// Default to video for video and unknown types
	return (
		<div className="overflow-hidden rounded-lg">
			<video src={url} className="aspect-video w-full bg-black" controls playsInline />
		</div>
	);
}

// Type definitions used by ChatSection (moved before component)
type MatrixResponseValue = Record<string, string | null | undefined>;
type ResponseValue = string | string[] | boolean | MatrixResponseValue | null;
type ResponseRecord = Record<string, ResponseValue>;

function isMatrixResponseValue(value: ResponseValue): value is MatrixResponseValue {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasDraftResponseValue(value: ResponseValue): boolean {
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "string") return value.trim().length > 0;
	if (typeof value === "boolean") return true;
	if (isMatrixResponseValue(value)) {
		return Object.values(value).some((entry) => typeof entry === "string" && entry.trim().length > 0);
	}
	return false;
}

function normalizeResponseValue(value: ResponseValue): ResponseValue {
	if (Array.isArray(value)) {
		return value.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
	}
	if (typeof value === "string") return value.trim();
	if (isMatrixResponseValue(value)) {
		const entries = Object.entries(value).flatMap(([rowId, rowValue]) => {
			if (typeof rowValue !== "string") return [];
			const trimmed = rowValue.trim();
			return trimmed.length > 0 ? ([[rowId, trimmed]] as const) : [];
		});
		return entries.length > 0 ? Object.fromEntries(entries) : null;
	}
	return value ?? null;
}

function responseValuesEqual(a: ResponseValue, b: ResponseValue) {
	const aHasValue = hasDraftResponseValue(a);
	const bHasValue = hasDraftResponseValue(b);
	if (!aHasValue && !bHasValue) return true;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		return a.every((entry, idx) => entry === b[idx]);
	}
	if (isMatrixResponseValue(a) || isMatrixResponseValue(b)) {
		if (!isMatrixResponseValue(a) || !isMatrixResponseValue(b)) return false;
		const aEntries = Object.entries(a).sort(([left], [right]) => left.localeCompare(right));
		const bEntries = Object.entries(b).sort(([left], [right]) => left.localeCompare(right));
		if (aEntries.length !== bEntries.length) return false;
		return aEntries.every(([rowId, value], index) => rowId === bEntries[index]?.[0] && value === bEntries[index]?.[1]);
	}
	return a === b;
}

function isQuestionAnswerComplete(question: ResearchLinkQuestion, value: ResponseValue): boolean {
	const normalized = normalizeResponseValue(value);
	if (question.type === "matrix") {
		if (!isMatrixResponseValue(normalized)) return false;
		const rows = question.matrixRows ?? [];
		if (rows.length === 0) return false;
		return rows.every((row) => {
			const rowValue = normalized[row.id];
			return typeof rowValue === "string" && rowValue.trim().length > 0;
		});
	}
	return hasResponseValue(normalized);
}

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
	slug: string;
	responseId: string;
	responses: ResponseRecord;
	questions: ResearchLinkQuestion[];
	allowVideo: boolean;
	onComplete: () => void;
	onVideoStage: () => void;
	renderModeSwitcher: () => React.ReactNode;
}) {
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const chatInputRef = useRef<HTMLTextAreaElement>(null);
	const [chatInput, setChatInput] = useState("");
	const [multiSelectPending, setMultiSelectPending] = useState<string[]>([]);
	const hasStartedChat = useRef(false);

	// Create transport with body that gets refreshed with current responses
	const transport = useMemo(() => {
		return new DefaultChatTransport({
			api: `/api/research-links/${slug}/chat`,
			body: {
				responseId,
				currentResponses: responses,
			},
		});
	}, [slug, responseId, responses]);

	const {
		messages,
		sendMessage,
		status,
		error: chatError,
	} = useChat({
		id: `research-chat-${responseId}`,
		transport,
	});

	const isChatLoading = status === "streaming" || status === "submitted";

	// Voice input for chat
	const handleChatVoiceTranscription = useCallback((text: string) => {
		setChatInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
	}, []);

	const {
		isRecording: isChatVoiceRecording,
		isTranscribing: isChatTranscribing,
		error: chatVoiceError,
		toggleRecording: toggleChatRecording,
		isSupported: isVoiceSupported,
	} = useSpeechToText({ onTranscription: handleChatVoiceTranscription });

	const chatVoiceButtonState: VoiceButtonState = chatVoiceError
		? "error"
		: isChatTranscribing
			? "processing"
			: isChatVoiceRecording
				? "recording"
				: "idle";

	// Auto-scroll chat
	useEffect(() => {
		if (chatContainerRef.current) {
			chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
		}
	}, [messages]);

	// Auto-focus chat input
	useEffect(() => {
		if (chatInputRef.current && !isChatLoading) {
			chatInputRef.current.focus();
		}
	}, [isChatLoading]);

	// Clear multi-select pending when messages change (question advanced)
	useEffect(() => {
		setMultiSelectPending([]);
	}, [messages.length]);

	// Helper to extract text content from message parts
	const getMessageText = useCallback((message: (typeof messages)[0]): string => {
		if (!message.parts) return "";
		return message.parts
			.filter((p) => p.type === "text")
			.map((p) => (p as { type: "text"; text: string }).text)
			.join("")
			.trim();
	}, []);

	// Auto-start chat when component mounts
	useEffect(() => {
		if (messages.length === 0 && !hasStartedChat.current && status === "ready") {
			hasStartedChat.current = true;
			// Context-aware auto-start: if answers already exist (form→chat switch),
			// tell the agent to continue, not restart
			const answeredCount = Object.values(responses).filter((v) => v !== undefined && v !== null && v !== "").length;
			const autoText =
				answeredCount > 0
					? `I've already answered ${answeredCount} questions in the form. Please continue with the next unanswered question.`
					: "Hi, I'm ready to share my feedback. Please start with your first question.";
			sendMessage({ text: autoText });
		}
	}, [messages.length, status, sendMessage, responses]);

	// Check if survey is complete after each message
	useEffect(() => {
		if (messages.length === 0 || status === "streaming") return;
		const lastMessage = messages[messages.length - 1];
		if (lastMessage?.role !== "assistant") return;

		const text = getMessageText(lastMessage).toLowerCase();
		// Detect survey completion - agent says thank you + any completion signal
		const isComplete =
			text.includes("thank you") &&
			(text.includes("response") ||
				text.includes("complete") ||
				text.includes("insight") ||
				text.includes("feedback") ||
				text.includes("finished") ||
				text.includes("all done"));
		if (isComplete) {
			saveProgress(slug, { responseId, responses, completed: true }).then(() => {
				if (allowVideo) {
					onVideoStage();
				} else {
					onComplete();
				}
			});
		}
	}, [messages, status, getMessageText, slug, responseId, responses, allowVideo, onVideoStage, onComplete]);

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
						const text = getMessageText(m);
						// Hide auto-start messages (both fresh start and form→chat continuation)
						return !(
							i === 0 &&
							m.role === "user" &&
							(text.includes("I'm ready to share my feedback") || text.includes("I've already answered"))
						);
					})
					.map((message) => {
						const text = getMessageText(message);
						if (!text && message.role === "assistant") {
							// Show loading for empty assistant message
							return (
								<div key={message.id} className="flex justify-start">
									<div className="rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5">
										<Loader2 className="h-4 w-4 animate-spin text-white/50" />
									</div>
								</div>
							);
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
									{message.role === "assistant" ? (
										<Streamdown className="prose-invert prose-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
											{text}
										</Streamdown>
									) : (
										text
									)}
								</div>
							</div>
						);
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

			{/* Suggestion chips for select and likert questions */}
			{(() => {
				if (isChatLoading) return null;

				// Determine current question by combining pre-chat responses with chat progress.
				//
				// Strategy: collect answered question IDs from two sources:
				// 1. Initial responses (pre-chat answers from form mode or prior sessions)
				// 2. Tool call parts in messages (save-research-response with questionId)
				// 3. Fallback: count user chat messages to estimate additional answers
				const answeredIds = new Set<string>();
				for (const qId of Object.keys(responses)) {
					if (responses[qId] !== undefined && responses[qId] !== null && responses[qId] !== "") {
						answeredIds.add(qId);
					}
				}

				// Try to find tool call parts with questionIds
				let foundToolCalls = false;
				for (const msg of messages) {
					if (!msg.parts) continue;
					for (const part of msg.parts) {
						const p = part as Record<string, unknown>;
						const isSaveResponse =
							p.type === "tool-save-research-response" ||
							(p.type === "dynamic-tool" && p.toolName === "save-research-response");
						if (isSaveResponse && p.input) {
							const input = p.input as { questionId?: string };
							if (input.questionId) {
								answeredIds.add(input.questionId);
								foundToolCalls = true;
							}
						}
					}
				}

				// Fallback: if no tool call parts found (Mastra may not stream them),
				// count user messages to estimate how many chat questions were answered
				if (!foundToolCalls) {
					const chatAnswerCount = messages.filter((m, i) => {
						if (m.role !== "user") return false;
						const text = getMessageText(m);
						return !(
							i === 0 &&
							(text.includes("I'm ready to share my feedback") || text.includes("I've already answered"))
						);
					}).length;

					// Walk through unanswered questions in order, marking the first N as answered
					let marked = 0;
					for (const q of questions) {
						if (marked >= chatAnswerCount) break;
						if (!answeredIds.has(q.id)) {
							answeredIds.add(q.id);
							marked++;
						}
					}
				}

				// Find first unanswered question
				const currentQ = questions.find((q) => !answeredIds.has(q.id));
				if (!currentQ) return null;

				// Likert: show number buttons
				if (currentQ.type === "likert") {
					const scale = currentQ.likertScale ?? 5;
					return (
						<div className="space-y-1">
							<div className="flex justify-center gap-2">
								{Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
									<button
										key={n}
										type="button"
										onClick={() => {
											sendMessage({ text: String(n) });
											setChatInput("");
										}}
										className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-sm text-white/80 transition-all hover:border-white/40 hover:bg-white/10 hover:text-white"
									>
										{n}
									</button>
								))}
							</div>
							{(currentQ.likertLabels?.low || currentQ.likertLabels?.high) && (
								<div className="flex justify-between px-1 text-white/40 text-xs">
									<span>{currentQ.likertLabels.low}</span>
									<span>{currentQ.likertLabels.high}</span>
								</div>
							)}
						</div>
					);
				}

				// Single select: send immediately on click
				if (currentQ.type === "single_select" && currentQ.options?.length) {
					return (
						<div className="flex flex-wrap gap-2">
							{currentQ.options.map((option) => (
								<button
									key={option}
									type="button"
									onClick={() => {
										sendMessage({ text: option });
										setChatInput("");
									}}
									className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition-all hover:border-white/40 hover:bg-white/10 hover:text-white"
								>
									{option}
								</button>
							))}
						</div>
					);
				}

				// Multi-select: toggle chips to build up text in the input, user sends via normal send button
				if (currentQ.type === "multi_select" && currentQ.options?.length) {
					return (
						<div className="flex flex-wrap gap-2">
							{currentQ.options.map((option) => {
								const isSelected = multiSelectPending.includes(option);
								return (
									<button
										key={option}
										type="button"
										onClick={() => {
											setMultiSelectPending((prev) => {
												const next = isSelected ? prev.filter((o) => o !== option) : [...prev, option];
												// Sync selection to chat input so user can send via normal send button
												setChatInput(next.join(", "));
												return next;
											});
										}}
										className={cn(
											"rounded-full border px-3 py-1.5 text-sm transition-all",
											isSelected
												? "border-white/50 bg-white/20 text-white"
												: "border-white/20 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10 hover:text-white"
										)}
									>
										{isSelected && <Check className="mr-1 inline h-3 w-3" />}
										{option}
									</button>
								);
							})}
						</div>
					);
				}

				return null;
			})()}

			{/* Chat input */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (!chatInput.trim() || isChatLoading) return;
					sendMessage({ text: chatInput.trim() });
					setChatInput("");
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
								e.preventDefault();
								if (chatInput.trim() && !isChatLoading) {
									sendMessage({ text: chatInput.trim() });
									setChatInput("");
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
	);
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) {
		return [{ title: "Survey" }];
	}
	return [
		{ title: data.list.hero_title || data.list.name || "Survey" },
		{
			name: "description",
			content: data.list.hero_subtitle || data.list.description || "",
		},
	];
};

export async function loader({ params }: LoaderFunctionArgs) {
	const slug = params.slug;
	if (!slug) {
		throw new Response("Missing slug", { status: 400 });
	}
	const supabase = createSupabaseAdminClient();
	const { data: list, error } = await supabase
		.from("research_links")
		.select(
			"id, name, slug, description, hero_title, hero_subtitle, instructions, hero_cta_label, hero_cta_helper, redirect_url, calendar_url, questions, allow_chat, allow_voice, allow_video, walkthrough_video_url, default_response_mode, is_live, account_id, identity_mode, identity_field, collect_title, respondent_fields"
		)
		.eq("slug", slug)
		.maybeSingle();

	if (error) {
		throw new Response(error.message, { status: 500 });
	}
	if (!list || !list.is_live) {
		throw new Response("Survey not found", { status: 404 });
	}

	const questionsResult = ResearchLinkQuestionSchema.array().safeParse(list.questions);
	// Filter out hidden questions — respondents should never see them
	const questions = questionsResult.success ? questionsResult.data.filter((q) => !q.hidden) : [];

	// Generate signed URL for walkthrough video if it exists
	let walkthroughSignedUrl: string | null = null;
	if (list.walkthrough_video_url) {
		const key = list.walkthrough_video_url;
		const ext = key.split(".").pop()?.toLowerCase();
		const contentType = ext === "mp4" ? "video/mp4" : ext === "mov" ? "video/quicktime" : "video/webm";

		const presigned = createR2PresignedUrl({
			key,
			expiresInSeconds: 3600,
			responseContentType: contentType,
		});
		walkthroughSignedUrl = presigned?.url ?? null;
	}

	// Sign question media R2 keys (images, videos, audio attached to questions)
	const signedQuestions = questions.map((q) => {
		const mediaKey = q.mediaUrl ?? q.videoUrl;
		if (!mediaKey) return q;
		// If it's already a full URL, keep it; if it's an R2 key, sign it
		if (mediaKey.startsWith("http://") || mediaKey.startsWith("https://") || mediaKey.startsWith("data:")) {
			return { ...q, mediaUrl: mediaKey };
		}
		const ext = mediaKey.split(".").pop()?.toLowerCase();
		const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext ?? "");
		const isAudio = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"].includes(ext ?? "");
		const contentType = isImage
			? `image/${ext === "jpg" ? "jpeg" : ext}`
			: isAudio
				? `audio/${ext}`
				: ext === "mp4"
					? "video/mp4"
					: ext === "mov"
						? "video/quicktime"
						: "video/webm";
		const presigned = createR2PresignedUrl({
			key: mediaKey,
			expiresInSeconds: 3600,
			responseContentType: contentType,
		});
		return { ...q, mediaUrl: presigned?.url ?? null };
	});

	const respondentFieldConfigs = parseRespondentFields(
		Array.isArray(list.respondent_fields)
			? list.respondent_fields
			: list.collect_title
				? ["first_name", "last_name", "company", "title"]
				: ["first_name", "last_name", "company"]
	);
	const respondentFields = getFieldKeys(respondentFieldConfigs);
	const selectFieldDefinitions = respondentFields
		.map((field) => RESPONDENT_FIELD_DEFINITION_MAP[field as RespondentFieldKey])
		.filter(
			(
				field
			): field is Extract<(typeof RESPONDENT_FIELD_DEFINITION_MAP)[RespondentFieldKey], { inputType: "select" }> =>
				Boolean(field && field.inputType === "select" && field.facetKindSlug)
		);

	const respondentFieldOptions: Partial<Record<RespondentFieldKey, RespondentFieldOption[]>> = {};
	const kindSlugs = Array.from(new Set(selectFieldDefinitions.map((field) => field.facetKindSlug)));
	if (kindSlugs.length > 0) {
		const { data: kindRows } = await supabase.from("facet_kind_global").select("id, slug").in("slug", kindSlugs);
		const kindIdToSlug = new Map((kindRows ?? []).map((row) => [row.id, row.slug]));
		const { data: globalRows } = await supabase
			.from("facet_global")
			.select("kind_id, slug, label")
			.in("kind_id", Array.from(kindIdToSlug.keys()))
			.order("label");

		for (const field of selectFieldDefinitions) {
			const options = (globalRows ?? [])
				.filter((row) => kindIdToSlug.get(row.kind_id) === field.facetKindSlug)
				.map((row) => ({
					value: field.optionValueMode === "slug" ? row.slug : row.label,
					label: row.label,
				}));
			respondentFieldOptions[field.key] = options;
		}
	}

	return {
		slug,
		list,
		questions: signedQuestions,
		walkthroughSignedUrl,
		respondentFieldOptions,
		respondentFieldConfigs,
	};
}

type IdentityMode = "anonymous" | "identified";
type IdentityField = "email" | "phone";

type LoaderData = {
	slug: string;
	list: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		hero_title: string | null;
		hero_subtitle: string | null;
		instructions: string | null;
		hero_cta_label: string | null;
		hero_cta_helper: string | null;
		redirect_url: string | null;
		calendar_url: string | null;
		questions: unknown;
		allow_chat: boolean;
		allow_voice: boolean;
		allow_video: boolean;
		walkthrough_video_url: string | null;
		default_response_mode: "form" | "chat" | "voice" | null;
		is_live: boolean;
		account_id: string;
		identity_mode: IdentityMode;
		identity_field: IdentityField;
		collect_title: boolean;
		respondent_fields: string[] | null;
	};
	questions: Array<ResearchLinkQuestion>;
	walkthroughSignedUrl: string | null;
	respondentFieldOptions: Partial<Record<RespondentFieldKey, RespondentFieldOption[]>>;
	respondentFieldConfigs: RespondentFieldConfig[];
};

type Stage = "email" | "phone" | "name" | "instructions" | "survey" | "video" | "complete";
type Mode = "form" | "chat" | "voice";

type StartSignupResult = {
	responseId: string;
	responses: ResponseRecord;
	completed: boolean;
	personId: string | null;
	/** Profile fields returned when a known person is found, so the client can pre-fill the name form */
	personProfile?: {
		firstName?: string | null;
		lastName?: string | null;
		company?: string | null;
		title?: string | null;
		jobFunction?: string | null;
		industry?: string | null;
		companySize?: string | null;
	} | null;
};

type StartSignupPayload =
	| {
			email: string;
			firstName?: string | null;
			lastName?: string | null;
			company?: string | null;
			title?: string | null;
			jobFunction?: string | null;
			industry?: string | null;
			companySize?: string | null;
			phone?: string | null;
			responseId?: string | null;
			responseMode?: Mode;
			utmParams?: Record<string, string> | null;
	  }
	| {
			phone: string;
			responseId?: string | null;
			responseMode?: Mode;
			utmParams?: Record<string, string> | null;
	  }
	| {
			responseId?: string | null;
			responseMode?: Mode;
			utmParams?: Record<string, string> | null;
	  }; // anonymous

async function startSignup(slug: string, payload: StartSignupPayload): Promise<StartSignupResult> {
	const response = await fetch(`/api/research-links/${slug}/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || "Failed to start survey");
	}
	return (await response.json()) as StartSignupResult;
}

async function saveProgress(
	slug: string,
	payload: {
		responseId: string;
		responses: ResponseRecord;
		completed?: boolean;
		fullSnapshot?: boolean;
	}
) {
	const response = await fetch(`/api/research-links/${slug}/save`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!response.ok) {
		throw new Error("Failed to save responses");
	}
	return (await response.json()) as { ok: boolean };
}

export default function ResearchLinkPage() {
	const { slug, list, questions, walkthroughSignedUrl, respondentFieldOptions, respondentFieldConfigs } =
		useLoaderData() as LoaderData;
	const [searchParams] = useSearchParams();
	const ffVoice = searchParams.get("ffVoice") === "true";
	const emailId = useId();
	const phoneId = useId();

	// Determine initial stage based on identity mode
	const getInitialStage = (): Stage => {
		if (list.identity_mode === "anonymous") {
			return list.instructions ? "instructions" : "survey";
		}
		return list.identity_field === "phone" ? "phone" : "email";
	};

	const [stage, setStage] = useState<Stage>(getInitialStage);
	const [mode, setMode] = useState<Mode>(list.allow_chat ? (list.default_response_mode ?? "form") : "form");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [company, setCompany] = useState("");
	const [respondentTitle, setRespondentTitle] = useState("");
	const [jobFunction, setJobFunction] = useState("");
	const [industry, setIndustry] = useState("");
	const [companySize, setCompanySize] = useState("");
	const [responseId, setResponseId] = useState<string | null>(null);
	const [responses, setResponses] = useState<ResponseRecord>({});
	const [currentIndex, setCurrentIndex] = useState(0);
	const [currentAnswer, setCurrentAnswer] = useState<ResponseValue>("");
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [initializing, setInitializing] = useState(true);
	const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
	const utmParamsRef = useRef<Record<string, string> | undefined>(undefined);
	const hasMatrixQuestions = useMemo(() => questions.some((question) => question.type === "matrix"), [questions]);
	const supportsChatMode = list.allow_chat && !hasMatrixQuestions;

	const resolvedMode = supportsChatMode ? mode : "form";
	const voiceEnabled = list.allow_voice && ffVoice;
	const hasMultipleModes = supportsChatMode || voiceEnabled;

	// Respondent fields configuration (uses parsed configs from loader)
	const respondentFields = useMemo(() => getFieldKeys(respondentFieldConfigs), [respondentFieldConfigs]);

	const hasField = useCallback((key: string) => respondentFields.includes(key), [respondentFields]);
	const isRequired = useCallback(
		(key: string) => isFieldRequired(respondentFieldConfigs, key),
		[respondentFieldConfigs]
	);
	const getFieldOptions = useCallback(
		(key: RespondentFieldKey) => respondentFieldOptions[key] ?? [],
		[respondentFieldOptions]
	);
	const hasNameFields = hasField("first_name") || hasField("last_name");
	const isEmailValid = emailSchema.safeParse(email).success;
	const isPhoneValid = phoneSchema.safeParse(phone).success;

	// Handle mode switch with response refresh
	const handleModeSwitch = useCallback(
		async (newMode: Mode) => {
			if (newMode === mode) return;

			if (newMode === "chat" && !supportsChatMode) return;

			// Refresh responses from DB for ANY identity mode (not just email)
			console.log("[handleModeSwitch]", {
				newMode,
				responseId,
				stage,
				email,
				phone,
			});
			if (responseId && stage === "survey") {
				try {
					// Build the right payload based on identity mode
					const payload: StartSignupPayload = email
						? { email, responseId, responseMode: newMode }
						: phone
							? { phone, responseId, responseMode: newMode }
							: { responseId, responseMode: newMode }; // anonymous

					const result = await startSignup(slug, payload);
					console.log("[handleModeSwitch] refreshed responses", {
						responseCount: Object.keys(result.responses || {}).length,
						responseKeys: Object.keys(result.responses || {}),
					});
					setResponses(result.responses || {});

					// When switching to form, position at next unanswered question
					if (newMode === "form") {
						const nextIdx = findNextQuestionIndex(result.responses || {}, questions);
						if (nextIdx < questions.length) {
							setCurrentIndex(nextIdx);
							setCurrentAnswer(result.responses?.[questions[nextIdx]?.id] ?? "");
						}
					}
				} catch {
					// If refresh fails, still switch mode
				}
			}
			setMode(newMode);
		},
		[mode, responseId, stage, email, phone, slug, questions, supportsChatMode]
	);

	// Mode switcher component for survey stages
	const renderModeSwitcher = () => {
		if (!hasMultipleModes) return null;
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
				{supportsChatMode && (
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
				{voiceEnabled && (
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
		);
	};

	// Countdown timer for redirect
	useEffect(() => {
		if (redirectCountdown === null || redirectCountdown <= 0) return;
		const timer = setTimeout(() => {
			setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
		}, 1000);
		return () => clearTimeout(timer);
	}, [redirectCountdown]);

	// Redirect when countdown reaches 0
	useEffect(() => {
		if (redirectCountdown === 0 && list.redirect_url) {
			window.location.href = list.redirect_url;
		}
	}, [redirectCountdown, list.redirect_url]);

	const cancelRedirect = useCallback(() => {
		setRedirectCountdown(null);
	}, []);

	const handleStartOver = useCallback(() => {
		setStage(getInitialStage());
		setEmail("");
		setPhone("");
		setFirstName("");
		setLastName("");
		setCompany("");
		setRespondentTitle("");
		setJobFunction("");
		setIndustry("");
		setCompanySize("");
		setResponseId(null);
		setResponses({});
		setCurrentIndex(0);
		setCurrentAnswer("");
		setRedirectCountdown(null);
		setError(null);
		setInitializing(true);
	}, [getInitialStage]);

	// Auto-reset after 5 seconds on completion (fresh start for next respondent)
	useEffect(() => {
		if (stage !== "complete") return;
		const timer = setTimeout(() => {
			handleStartOver();
		}, 5000);
		return () => clearTimeout(timer);
	}, [stage, handleStartOver]);

	// After handleStartOver resets initializing=true,
	// re-trigger the anonymous auto-start flow for the next respondent
	useEffect(() => {
		if (!initializing) return;
		if (list.identity_mode !== "anonymous") {
			// For identified surveys, just stop initializing (user enters email/phone)
			setInitializing(false);
			return;
		}
		// Auto-start a new anonymous session
		void startSignup(slug, { responseMode: resolvedMode })
			.then((result) => {
				setResponseId(result.responseId);
				setResponses(result.responses || {});
				const initialIndex = findNextQuestionIndex(result.responses || {}, questions);
				if (initialIndex >= questions.length) {
					setStage("complete");
				} else {
					setCurrentIndex(initialIndex);
					setStage(list.instructions ? "instructions" : "survey");
				}
			})
			.catch(() => {
				// Silently fail
			})
			.finally(() => {
				setInitializing(false);
			});
	}, [initializing, slug, resolvedMode, questions, list.identity_mode, list.instructions]);

	// Voice input for form mode
	const handleFormVoiceTranscription = useCallback((text: string) => {
		setCurrentAnswer((prev) => {
			const current = typeof prev === "string" ? prev : "";
			return current.trim() ? `${current.trim()} ${text}` : text;
		});
	}, []);

	const {
		isRecording: isFormVoiceRecording,
		isTranscribing: isFormTranscribing,
		error: formVoiceError,
		toggleRecording: toggleFormRecording,
		isSupported: isVoiceSupported,
	} = useSpeechToText({ onTranscription: handleFormVoiceTranscription });

	// Form voice button state
	const formVoiceButtonState: VoiceButtonState = formVoiceError
		? "error"
		: isFormTranscribing
			? "processing"
			: isFormVoiceRecording
				? "recording"
				: "idle";

	useEffect(() => {
		if (!supportsChatMode && mode === "chat") {
			setMode("form");
		}
	}, [supportsChatMode, mode]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			// Check URL params first (from embed redirect)
			const urlParams = new URLSearchParams(window.location.search);
			const urlEmail = urlParams.get("email");
			const urlResponseId = urlParams.get("responseId");

			// Also check for personalized link params (standalone email/phone without responseId)
			const urlPhone = urlParams.get("phone");
			const urlFirstName = urlParams.get("first_name") || urlParams.get("name")?.split(" ")[0] || null;
			const urlLastName = urlParams.get("last_name") || urlParams.get("name")?.split(" ").slice(1).join(" ") || null;
			const urlCompany = urlParams.get("company");
			const urlTitle = urlParams.get("title");
			const urlJobFunction = urlParams.get("job_function");
			const urlIndustry = urlParams.get("industry");
			const urlCompanySize = urlParams.get("company_size");

			// Extract UTM params for campaign attribution (store in ref for manual submits)
			const utmParams = extractUtmParamsFromSearch(urlParams);
			const utmPayload = hasUtmParams(utmParams) ? utmParams : undefined;
			if (utmPayload) utmParamsRef.current = utmPayload;

			// If we have URL params, use those (coming from embed or personalized link)
			if (urlEmail && urlResponseId) {
				void startSignup(slug, {
					email: urlEmail,
					responseId: urlResponseId,
					responseMode: resolvedMode,
					utmParams: utmPayload,
				})
					.then((result) => {
						setEmail(urlEmail);
						setResponseId(result.responseId);
						setResponses(result.responses || {});
						const initialIndex = findNextQuestionIndex(result.responses || {}, questions);
						if (initialIndex >= questions.length) {
							setStage("complete");
						} else {
							// Show instructions stage before survey when coming from embed
							setStage("instructions");
							setCurrentIndex(initialIndex);
							const existingValue = result.responses?.[questions[initialIndex]?.id];
							setCurrentAnswer(existingValue ?? "");
						}
					})
					.catch(() => {
						// If URL params fail, fall back to email stage
						setInitializing(false);
					})
					.finally(() => {
						setInitializing(false);
					});
				return;
			}

			// Personalized link: prefill fields from URL params and show landing page.
			// The user sees the landing page with prefilled values and clicks the CTA to proceed.
			// startSignup() will be called in handleEmailSubmit/handlePhoneSubmit when they click.
			if (urlEmail) setEmail(urlEmail);
			if (urlPhone) setPhone(urlPhone);
			if (urlFirstName) setFirstName(urlFirstName);
			if (urlLastName) setLastName(urlLastName);
			if (urlCompany) setCompany(urlCompany);
			if (urlTitle) setRespondentTitle(urlTitle);
			if (urlJobFunction) setJobFunction(urlJobFunction);
			if (urlIndustry) setIndustry(urlIndustry);
			if (urlCompanySize) setCompanySize(urlCompanySize);

			// For anonymous mode, auto-start the survey with a fresh session
			if (list.identity_mode === "anonymous") {
				void startSignup(slug, {
					responseMode: resolvedMode,
					utmParams: utmPayload,
				})
					.then((result) => {
						setResponseId(result.responseId);
						setResponses(result.responses || {});
						const initialIndex = findNextQuestionIndex(result.responses || {}, questions);
						if (initialIndex >= questions.length) {
							setStage("complete");
						} else {
							setCurrentIndex(initialIndex);
							if (list.instructions) {
								setStage("instructions");
							} else {
								setStage("survey");
							}
						}
					})
					.catch(() => {
						// Silently fail - user can still use the survey
					})
					.finally(() => {
						setInitializing(false);
					});
				return;
			}

			// Identified mode with no URL params — show email/phone form
			setInitializing(false);
		} catch {
			setInitializing(false);
		}
	}, [questions, slug, resolvedMode, list.identity_mode, list.identity_field, list.instructions]);

	useEffect(() => {
		if (stage === "survey" && resolvedMode === "form") {
			const value = responses[questions[currentIndex]?.id];
			setCurrentAnswer(value ?? "");
		}
	}, [stage, currentIndex, questions, responses, resolvedMode]);

	const currentQuestion = useMemo(() => questions[currentIndex], [currentIndex, questions]);
	const currentQuestionMediaUrl = currentQuestion?.mediaUrl ?? currentQuestion?.videoUrl ?? null;

	const _answeredCount = useMemo(() => {
		return questions.filter((q) => {
			const val = responses[q.id];
			return val !== undefined && val !== null && val !== "";
		}).length;
	}, [questions, responses]);

	async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (!email.trim()) {
			setError("Enter an email to continue");
			return;
		}
		try {
			setIsSaving(true);
			const result = await startSignup(slug, {
				email: email.trim(),
				responseId,
				responseMode: resolvedMode,
				utmParams: utmParamsRef.current,
			});
			setResponseId(result.responseId);
			setResponses(result.responses || {});

			const initialIndex = findNextQuestionIndex(result.responses || {}, questions);
			if (initialIndex >= questions.length) {
				setStage("complete");
				return;
			}
			setCurrentIndex(initialIndex);

			// Pre-fill profile fields: URL params override DB values
			if (result.personId && result.personProfile) {
				const profile = result.personProfile;
				if (!firstName && profile.firstName) setFirstName(profile.firstName);
				if (!lastName && profile.lastName) setLastName(profile.lastName);
				if (!company && profile.company) setCompany(profile.company);
				if (!respondentTitle && profile.title) setRespondentTitle(profile.title);
				if (!jobFunction && profile.jobFunction) setJobFunction(profile.jobFunction);
				if (!industry && profile.industry) setIndustry(profile.industry);
				if (!companySize && profile.companySize) setCompanySize(profile.companySize);
			}

			// Check if any configured respondent fields need collection
			const currentFields: Record<string, string> = {
				first_name: firstName || result.personProfile?.firstName || "",
				last_name: lastName || result.personProfile?.lastName || "",
				company: company || result.personProfile?.company || "",
				title: respondentTitle || result.personProfile?.title || "",
				job_function: jobFunction || result.personProfile?.jobFunction || "",
				industry: industry || result.personProfile?.industry || "",
				company_size: companySize || result.personProfile?.companySize || "",
			};
			// Show name form if there are configured non-phone fields to fill
			const nonPhoneConfigs = respondentFieldConfigs.filter((c) => c.key !== "phone");
			const hasEmptyField = nonPhoneConfigs.some((c) => !currentFields[c.key]);

			if (hasEmptyField) {
				// Show name form pre-populated so user can fill missing fields
				setStage("name");
			} else if (list.instructions) {
				setStage("instructions");
			} else {
				setStage("survey");
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Something went wrong");
		} finally {
			setIsSaving(false);
		}
	}

	async function handlePhoneSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (!phone.trim()) {
			setError("Enter a phone number to continue");
			return;
		}
		try {
			setIsSaving(true);
			const result = await startSignup(slug, {
				phone: phone.trim().replace(/\s+/g, ""),
				responseId,
				responseMode: resolvedMode,
				utmParams: utmParamsRef.current,
			});
			setResponseId(result.responseId);
			setResponses(result.responses || {});

			const initialIndex = findNextQuestionIndex(result.responses || {}, questions);
			if (initialIndex >= questions.length) {
				setStage("complete");
				return;
			}
			setCurrentIndex(initialIndex);

			// Pre-fill profile fields from DB if available
			if (result.personId && result.personProfile) {
				const profile = result.personProfile;
				if (!firstName && profile.firstName) setFirstName(profile.firstName);
				if (!lastName && profile.lastName) setLastName(profile.lastName);
				if (!company && profile.company) setCompany(profile.company);
				if (!respondentTitle && profile.title) setRespondentTitle(profile.title);
				if (!jobFunction && profile.jobFunction) setJobFunction(profile.jobFunction);
				if (!industry && profile.industry) setIndustry(profile.industry);
				if (!companySize && profile.companySize) setCompanySize(profile.companySize);
			}

			// Check if any configured respondent fields still need filling
			const nonPhoneConfigs = respondentFieldConfigs.filter((c) => c.key !== "phone");
			if (nonPhoneConfigs.length > 0) {
				const currentFields: Record<string, string> = {
					first_name: firstName || result.personProfile?.firstName || "",
					last_name: lastName || result.personProfile?.lastName || "",
					company: company || result.personProfile?.company || "",
					title: respondentTitle || result.personProfile?.title || "",
					job_function: jobFunction || result.personProfile?.jobFunction || "",
					industry: industry || result.personProfile?.industry || "",
					company_size: companySize || result.personProfile?.companySize || "",
				};
				const hasEmptyField = nonPhoneConfigs.some((c) => !currentFields[c.key]);
				if (hasEmptyField) {
					setStage("name");
					return;
				}
			}

			if (list.instructions) {
				setStage("instructions");
			} else {
				setStage("survey");
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Something went wrong");
		} finally {
			setIsSaving(false);
		}
	}

	async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		// Validate all required fields
		const requiredChecks: Array<{ key: string; value: string; label: string }> = [
			{ key: "first_name", value: firstName, label: "first name" },
			{ key: "last_name", value: lastName, label: "last name" },
			{ key: "company", value: company, label: "company" },
			{ key: "title", value: respondentTitle, label: "job title" },
			{ key: "job_function", value: jobFunction, label: "job function" },
			{ key: "industry", value: industry, label: "industry" },
			{ key: "company_size", value: companySize, label: "company size" },
			{ key: "phone", value: phone, label: "phone number" },
		];
		for (const check of requiredChecks) {
			if (isRequired(check.key) && !check.value.trim()) {
				setError(`Please enter your ${check.label} to continue`);
				return;
			}
		}
		if (!responseId) {
			setError("Something went wrong. Please refresh and try again.");
			return;
		}
		try {
			setIsSaving(true);
			const result = await startSignup(slug, {
				email: email.trim(),
				firstName: firstName.trim(),
				lastName: lastName.trim() || null,
				company: company.trim() || null,
				title: respondentTitle.trim() || null,
				jobFunction: jobFunction.trim() || null,
				industry: industry.trim() || null,
				companySize: companySize || null,
				phone: phone.trim() || null,
				responseId,
				responseMode: resolvedMode,
			});
			setResponseId(result.responseId);
			setResponses(result.responses || {});

			const initialIndex = findNextQuestionIndex(result.responses || {}, questions);
			if (initialIndex >= questions.length) {
				setStage("complete");
			} else {
				setCurrentIndex(initialIndex);
				setStage("survey");
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Something went wrong");
		} finally {
			setIsSaving(false);
		}
	}

	async function handleAnswerSubmit(value: ResponseValue) {
		if (!responseId) {
			setError("Something went wrong. Refresh and try again.");
			return;
		}
		const normalizedValue = normalizeResponseValue(value);
		if (currentQuestion?.required && !isQuestionAnswerComplete(currentQuestion, normalizedValue)) {
			setError("This question is required");
			return;
		}
		setError(null);
		const nextResponses: ResponseRecord = {
			...responses,
			[currentQuestion?.id ?? ""]: normalizedValue,
		};
		setIsSaving(true);
		try {
			// Use branching engine to determine next question
			const nextIndex = getNextQuestionIndex(currentIndex, questions, nextResponses);
			const isComplete = nextIndex >= questions.length;
			await saveProgress(slug, {
				responseId,
				responses: nextResponses,
				completed: isComplete,
				fullSnapshot: true,
			});
			setResponses(nextResponses);
			if (isComplete) {
				// If video is enabled, go to video stage first
				console.log("[survey] Survey complete, allow_video:", list.allow_video, typeof list.allow_video);
				if (list.allow_video) {
					setStage("video");
				} else {
					setStage("complete");
					if (list.redirect_url) {
						setRedirectCountdown(7);
					}
				}
			} else {
				setCurrentIndex(nextIndex);
				setCurrentAnswer(nextResponses[questions[nextIndex]?.id] ?? "");
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Failed to save your answer");
		} finally {
			setIsSaving(false);
		}
	}

	const persistCurrentQuestionDraft = useCallback(async () => {
		if (!responseId || stage !== "survey" || resolvedMode !== "form" || !currentQuestion?.id) return;

		const questionId = currentQuestion.id;
		const normalized = normalizeResponseValue(currentAnswer);
		const existing = normalizeResponseValue((responses[questionId] ?? null) as ResponseValue);
		if (responseValuesEqual(normalized, existing)) return;

		const nextResponses: ResponseRecord = { ...responses };
		if (hasDraftResponseValue(normalized)) {
			nextResponses[questionId] = normalized;
		} else {
			delete nextResponses[questionId];
		}
		setResponses(nextResponses);
		try {
			await saveProgress(slug, {
				responseId,
				responses: nextResponses,
				completed: false,
				fullSnapshot: true,
			});
		} catch (caught) {
			console.warn("[survey] Failed to save draft while navigating", caught);
		}
	}, [responseId, stage, resolvedMode, currentQuestion, currentAnswer, responses, slug]);

	function handleBack() {
		void persistCurrentQuestionDraft();
		if (currentIndex > 0) {
			const prevIndex = currentIndex - 1;
			setCurrentIndex(prevIndex);
			setCurrentAnswer(responses[questions[prevIndex]?.id] ?? "");
		} else if (respondentFieldConfigs.length > 0) {
			// On first question, go back to demographics form
			setStage("name");
		}
	}

	function handleJumpToQuestion(targetIndex: number) {
		if (targetIndex < 0 || targetIndex >= questions.length) return;
		// Allow jumping to any answered question or current question
		const targetQuestion = questions[targetIndex];
		const isAnswered = targetQuestion ? isQuestionAnswerComplete(targetQuestion, responses[targetQuestion.id]) : false;
		const isCurrent = targetIndex === currentIndex;
		const isPrevious = targetIndex < currentIndex;
		if (isAnswered || isCurrent || isPrevious) {
			if (!isCurrent) {
				void persistCurrentQuestionDraft();
			}
			setCurrentIndex(targetIndex);
			setCurrentAnswer(responses[questions[targetIndex]?.id] ?? "");
		}
	}

	if (initializing) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
				<Loader2 className="h-8 w-8 animate-spin text-white/50" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
			<div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-12 md:py-20">
				<div className="space-y-8 text-white">
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
							{/* Hero heading */}
							{(list.hero_title || list.hero_subtitle) && (
								<div className="space-y-2">
									{list.hero_title && <h1 className="font-bold text-2xl text-white md:text-3xl">{list.hero_title}</h1>}
									{list.hero_subtitle && (
										<p className="text-base text-white/70 leading-relaxed">{list.hero_subtitle}</p>
									)}
								</div>
							)}

							{/* Walkthrough video */}
							{walkthroughSignedUrl && (
								<div className="overflow-hidden rounded-xl">
									<video src={walkthroughSignedUrl} className="aspect-video w-full bg-black" controls playsInline />
								</div>
							)}

							{/* Instructions for the respondent */}
							{list.instructions && <p className="text-sm text-white/80 leading-relaxed">{list.instructions}</p>}

							{/* Mode selector - show when multiple modes available */}
							{(supportsChatMode || voiceEnabled || list.calendar_url) && (
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
										{supportsChatMode && (
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
										{voiceEnabled && (
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
							{/* Hero heading */}
							{(list.hero_title || list.hero_subtitle) && (
								<div className="space-y-2">
									{list.hero_title && <h1 className="font-bold text-2xl text-white md:text-3xl">{list.hero_title}</h1>}
									{list.hero_subtitle && (
										<p className="text-base text-white/70 leading-relaxed">{list.hero_subtitle}</p>
									)}
								</div>
							)}

							{/* Walkthrough video */}
							{walkthroughSignedUrl && (
								<div className="overflow-hidden rounded-xl">
									<video src={walkthroughSignedUrl} className="aspect-video w-full bg-black" controls playsInline />
								</div>
							)}

							{/* Instructions for the respondent */}
							{list.instructions && <p className="text-sm text-white/80 leading-relaxed">{list.instructions}</p>}

							{/* Mode selector - show when multiple modes available */}
							{(supportsChatMode || voiceEnabled || list.calendar_url) && (
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
										{supportsChatMode && (
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
										{voiceEnabled && (
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
								{firstName
									? "Please confirm your details before we begin."
									: "Tell us a bit about yourself to continue."}
							</p>

							{/* Name fields */}
							{hasNameFields && (
								<div
									className={cn(
										"grid gap-3",
										hasField("first_name") && hasField("last_name") ? "grid-cols-2" : "grid-cols-1"
									)}
								>
									{hasField("first_name") && (
										<div className="space-y-2">
											<Label className="text-white/90">
												First Name{" "}
												{isRequired("first_name") ? (
													<span className="text-red-400">*</span>
												) : (
													<span className="text-white/40">(optional)</span>
												)}
											</Label>
											<Input
												type="text"
												value={firstName}
												onChange={(e) => setFirstName(e.target.value)}
												placeholder="Jane"
												className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
												required={isRequired("first_name")}
												autoFocus
											/>
										</div>
									)}
									{hasField("last_name") && (
										<div className="space-y-2">
											<Label className="text-white/90">
												Last Name{" "}
												{isRequired("last_name") ? (
													<span className="text-red-400">*</span>
												) : (
													<span className="text-white/40">(optional)</span>
												)}
											</Label>
											<Input
												type="text"
												value={lastName}
												onChange={(e) => setLastName(e.target.value)}
												placeholder="Doe"
												className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
												required={isRequired("last_name")}
											/>
										</div>
									)}
								</div>
							)}

							{/* Company field */}
							{hasField("company") && (
								<div className="space-y-2">
									<Label className="text-white/90">
										Company{" "}
										{isRequired("company") ? (
											<span className="text-red-400">*</span>
										) : (
											<span className="text-white/40">(optional)</span>
										)}
									</Label>
									<Input
										type="text"
										value={company}
										onChange={(e) => setCompany(e.target.value)}
										placeholder="Acme Inc"
										className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
										required={isRequired("company")}
									/>
								</div>
							)}

							{/* Title field */}
							{hasField("title") && (
								<div className="space-y-2">
									<Label className="text-white/90">
										Job Title{" "}
										{isRequired("title") ? (
											<span className="text-red-400">*</span>
										) : (
											<span className="text-white/40">(optional)</span>
										)}
									</Label>
									<Input
										type="text"
										value={respondentTitle}
										onChange={(e) => setRespondentTitle(e.target.value)}
										placeholder="e.g., Product Manager"
										className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
										required={isRequired("title")}
									/>
								</div>
							)}

							{hasField("job_function") && (
								<div className="space-y-2">
									<Label className="text-white/90">
										Job Function{" "}
										{isRequired("job_function") ? (
											<span className="text-red-400">*</span>
										) : (
											<span className="text-white/40">(optional)</span>
										)}
									</Label>
									{getFieldOptions("job_function").length > 0 ? (
										<Select
											value={jobFunction || "__empty__"}
											onValueChange={(value) => setJobFunction(value === "__empty__" ? "" : value)}
										>
											<SelectTrigger className="border-white/10 bg-black/40 text-white">
												<SelectValue placeholder="Select a job function" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="__empty__">Not specified</SelectItem>
												{getFieldOptions("job_function").map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									) : (
										<Input
											type="text"
											value={jobFunction}
											onChange={(e) => setJobFunction(e.target.value)}
											placeholder="e.g., Product, Marketing, Operations"
											className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
										/>
									)}
								</div>
							)}

							{hasField("industry") && (
								<div className="space-y-2">
									<Label className="text-white/90">
										Industry{" "}
										{isRequired("industry") ? (
											<span className="text-red-400">*</span>
										) : (
											<span className="text-white/40">(optional)</span>
										)}
									</Label>
									{getFieldOptions("industry").length > 0 ? (
										<Select
											value={industry || "__empty__"}
											onValueChange={(value) => setIndustry(value === "__empty__" ? "" : value)}
										>
											<SelectTrigger className="border-white/10 bg-black/40 text-white">
												<SelectValue placeholder="Select an industry" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="__empty__">Not specified</SelectItem>
												{getFieldOptions("industry").map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									) : (
										<Input
											type="text"
											value={industry}
											onChange={(e) => setIndustry(e.target.value)}
											placeholder="e.g., Healthcare, FinTech, SaaS"
											className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
										/>
									)}
								</div>
							)}

							{hasField("company_size") && (
								<div className="space-y-2">
									<Label className="text-white/90">
										Company Size{" "}
										{isRequired("company_size") ? (
											<span className="text-red-400">*</span>
										) : (
											<span className="text-white/40">(optional)</span>
										)}
									</Label>
									{getFieldOptions("company_size").length > 0 ? (
										<Select
											value={companySize || "__empty__"}
											onValueChange={(value) => setCompanySize(value === "__empty__" ? "" : value)}
										>
											<SelectTrigger className="border-white/10 bg-black/40 text-white">
												<SelectValue placeholder="Select a size range" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="__empty__">Not specified</SelectItem>
												{getFieldOptions("company_size").map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									) : (
										<Input
											type="text"
											value={companySize}
											onChange={(e) => setCompanySize(e.target.value)}
											placeholder="e.g., 51-200"
											className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
										/>
									)}
								</div>
							)}

							{/* Phone field (when identity is email but phone is requested) */}
							{hasField("phone") && list.identity_field !== "phone" && (
								<div className="space-y-2">
									<Label className="text-white/90">
										Phone{" "}
										{isRequired("phone") ? (
											<span className="text-red-400">*</span>
										) : (
											<span className="text-white/40">(optional)</span>
										)}
									</Label>
									<Input
										type="tel"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										placeholder="+1 (555) 123-4567"
										className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
										required={isRequired("phone")}
									/>
								</div>
							)}

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
								className="space-y-10"
								data-testid="survey-question"
							>
								<div className="space-y-6">
									<div className="space-y-3">
										<h2
											className="flex items-start gap-3 font-medium text-white text-xl sm:text-2xl"
											data-testid="survey-question-prompt"
										>
											<span className="shrink-0 text-white/40">{currentIndex + 1}.</span>
											<span>
												{currentQuestion.prompt}
												{currentQuestion.required && <span className="ml-1 text-red-400">*</span>}
											</span>
										</h2>
										{/* Question media (image, video, or audio) */}
										{currentQuestionMediaUrl && <QuestionMedia url={currentQuestionMediaUrl} />}
										{currentQuestion.helperText && (
											<p className="text-base text-white/50">{currentQuestion.helperText}</p>
										)}
									</div>

									<div className="space-y-8">
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

								<div className="flex items-center justify-between">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleBack}
										disabled={currentIndex === 0 && respondentFieldConfigs.length === 0}
										className="text-white/50 hover:bg-white/10 hover:text-white"
										data-testid="survey-back-button"
									>
										<ArrowLeft className="mr-1 h-3.5 w-3.5" />
										Back
									</Button>
									<Button
										type="button"
										onClick={() => void handleAnswerSubmit(currentAnswer)}
										disabled={
											isSaving ||
											(currentQuestion?.required && !isQuestionAnswerComplete(currentQuestion, currentAnswer))
										}
										className="bg-white text-black hover:bg-white/90 disabled:bg-white/30 disabled:text-white/50"
										data-testid="survey-next-button"
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
								</div>

								{/* Progress indicator - minimal dots */}
								<div className="flex items-center justify-center gap-1.5">
									{questions.map((q, idx) => {
										const isAnswered = isQuestionAnswerComplete(q, responses[q.id]);
										const isCurrent = idx === currentIndex;
										const canJump = isAnswered || isCurrent || idx < currentIndex;
										return (
											<button
												key={q.id}
												type="button"
												onClick={() => handleJumpToQuestion(idx)}
												disabled={!canJump}
												className={cn(
													"h-1.5 rounded-full transition-all",
													isCurrent
														? "w-6 bg-white"
														: isAnswered
															? "w-1.5 bg-emerald-500/80 hover:bg-emerald-500"
															: "w-1.5 bg-white/20",
													canJump && !isCurrent && "cursor-pointer",
													!canJump && "cursor-not-allowed"
												)}
												title={
													isCurrent
														? "Current question"
														: isAnswered
															? `Jump to question ${idx + 1}`
															: `Question ${idx + 1} (not yet answered)`
												}
											/>
										);
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
								setStage("complete");
								if (list.redirect_url) {
									setRedirectCountdown(7);
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
									setStage("complete");
									if (list.redirect_url) {
										setRedirectCountdown(7);
									}
								}}
								onSkip={() => {
									setStage("complete");
									if (list.redirect_url) {
										setRedirectCountdown(7);
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
							data-testid="survey-complete"
						>
							<CheckCircle2 className="h-12 w-12 text-emerald-300" />
							<div className="space-y-2">
								<h2 className="font-semibold text-xl">Thanks for sharing!</h2>
								<p className="text-sm text-white/50">Starting over in a moment...</p>
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
						</motion.div>
					)}
				</div>
			</div>
		</div>
	);
}

function findNextQuestionIndex(responses: ResponseRecord, questions: ResearchLinkQuestion[]) {
	for (let index = 0; index < questions.length; index++) {
		const question = questions[index];
		const value = responses?.[question.id];
		if (!isQuestionAnswerComplete(question, value)) {
			return index;
		}
	}
	return questions.length;
}

function renderQuestionInput({
	question,
	value,
	onChange,
	voiceSupported,
	voiceButtonState,
	toggleRecording,
}: {
	question: ResearchLinkQuestion;
	value: ResponseValue;
	onChange: (value: ResponseValue) => void;
	voiceSupported?: boolean;
	voiceButtonState?: VoiceButtonState;
	toggleRecording?: () => void;
}) {
	const resolved = resolveQuestionInput(question);

	if (resolved.kind === "select") {
		return (
			<SingleSelectInput
				question={question}
				value={value}
				onChange={onChange}
				options={resolved.options}
				allowOther={resolved.allowOther}
			/>
		);
	}

	if (resolved.kind === "multi") {
		const selected = Array.isArray(value) ? value : [];
		const otherValues = selected.filter((v) => !resolved.options.includes(v));
		const otherText = otherValues.join(", ");
		return (
			<div className="space-y-2">
				{resolved.options.map((option) => {
					const checked = selected.includes(option);
					return (
						<label key={option} className="flex items-center gap-2 text-sm text-white/80">
							<Checkbox
								checked={checked}
								onCheckedChange={(next) => {
									const nextChecked = Boolean(next);
									onChange(nextChecked ? [...selected, option] : selected.filter((entry) => entry !== option));
								}}
							/>
							<span data-testid="survey-multi-option">{option}</span>
						</label>
					);
				})}
				{resolved.allowOther && (
					<div className="space-y-1.5 pt-1">
						<label className="text-sm text-white/60">Other:</label>
						<Input
							type="text"
							value={otherText}
							onChange={(e) => {
								const newOther = e.target.value;
								const withoutOld = selected.filter((v) => resolved.options.includes(v));
								if (newOther.trim().length > 0) {
									onChange([...withoutOld, newOther]);
								} else {
									onChange(withoutOld);
								}
							}}
							placeholder="Type your answer..."
							className="border-white/10 bg-black/30 text-white placeholder:text-white/40"
							data-testid="survey-text-input"
						/>
					</div>
				)}
			</div>
		);
	}

	if (resolved.kind === "likert") {
		const selectedValue = typeof value === "string" ? value : "";
		const scalePoints = Array.from({ length: resolved.scale }, (_, i) => i + 1);
		return (
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-1">
					{scalePoints.map((point) => (
						<button
							key={point}
							type="button"
							onClick={() => onChange(String(point))}
							aria-label={`Rate ${point}`}
							data-testid={`survey-likert-${point}`}
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
		);
	}

	if (resolved.kind === "matrix") {
		const selectedValues = isMatrixResponseValue(value) ? value : {};
		const scalePoints = Array.from({ length: resolved.scale }, (_, i) => i + 1);
		const hasScaleLabels = Boolean(resolved.labels.low || resolved.labels.high);
		const updateMatrixValue = (rowId: string, nextValue: string) => {
			onChange({
				...selectedValues,
				[rowId]: nextValue,
			});
		};

		return (
			<div className="space-y-4">
				<div className="hidden overflow-x-auto rounded-xl border border-white/10 bg-black/20 md:block">
					<table className="min-w-full border-collapse">
						<thead>
							{hasScaleLabels && (
								<tr className="border-white/10 border-b text-white/50 text-xs">
									<th className="px-4 pt-3 pb-1" />
									<th colSpan={scalePoints.length} className="px-2 pt-3 pb-1">
										<div className="flex items-center justify-between gap-4 px-1">
											<span>{resolved.labels.low}</span>
											<span className="text-right">{resolved.labels.high}</span>
										</div>
									</th>
								</tr>
							)}
							<tr className="border-white/10 border-b text-white/50 text-xs">
								<th className="px-4 py-3 text-left font-medium">Area</th>
								{scalePoints.map((point) => (
									<th key={point} className="px-2 py-3 text-center font-medium">
										{point}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{resolved.rows.map((row) => (
								<tr
									key={row.id}
									className="border-white/10 border-b last:border-b-0"
									data-testid={`survey-matrix-row-${row.id}`}
								>
									<td className="px-4 py-3 text-sm text-white/85">{row.label}</td>
									{scalePoints.map((point) => {
										const isSelected = selectedValues[row.id] === String(point);
										return (
											<td key={point} className="px-2 py-3 text-center">
												<button
													type="button"
													onClick={() => updateMatrixValue(row.id, String(point))}
													aria-label={`Rate ${row.label} ${point}`}
													data-testid={`survey-matrix-${row.id}-${point}`}
													className={cn(
														"mx-auto flex h-9 w-9 items-center justify-center rounded-md border font-medium text-sm transition-all",
														isSelected
															? "border-white bg-white text-black"
															: "border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:bg-white/10 hover:text-white"
													)}
												>
													{point}
												</button>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{hasScaleLabels && (
					<div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 md:hidden">
						<div className="flex items-center justify-between gap-4 px-1 text-white/50 text-xs">
							<span>{resolved.labels.low}</span>
							<span className="text-right">{resolved.labels.high}</span>
						</div>
					</div>
				)}

				<div className="space-y-4 md:hidden">
					{resolved.rows.map((row) => (
						<div
							key={row.id}
							className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4"
							data-testid={`survey-matrix-row-${row.id}`}
						>
							<p className="text-sm text-white/85">{row.label}</p>
							<div className="flex items-center justify-between gap-2">
								{scalePoints.map((point) => {
									const isSelected = selectedValues[row.id] === String(point);
									return (
										<button
											key={point}
											type="button"
											onClick={() => updateMatrixValue(row.id, String(point))}
											aria-label={`Rate ${row.label} ${point}`}
											data-testid={`survey-matrix-${row.id}-${point}`}
											className={cn(
												"flex h-10 w-10 items-center justify-center rounded-lg border font-medium text-sm transition-all",
												isSelected
													? "border-white bg-white text-black"
													: "border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:bg-white/10 hover:text-white"
											)}
										>
											{point}
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (resolved.kind === "image_select") {
		const selectedValue = typeof value === "string" ? value : "";
		return (
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{resolved.options.map((option) => (
					<button
						key={option.label}
						type="button"
						onClick={() => onChange(option.label)}
						data-testid="survey-image-option"
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
		);
	}

	if (resolved.kind === "textarea") {
		return (
			<div className="relative w-full">
				<Textarea
					value={typeof value === "string" ? value : ""}
					onChange={(event) => onChange(event.target.value)}
					placeholder="Share your thoughts..."
					rows={10}
					style={{ minHeight: "220px" }}
					className="w-full resize-none border-white/10 bg-black/20 pr-14 text-lg text-white placeholder:text-white/30 focus:border-white/20 md:text-xl"
					autoFocus
					data-testid="survey-textarea-input"
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
		);
	}

	// Text input with voice button for text-based inputs (not email/tel)
	const showVoice = voiceSupported && toggleRecording && voiceButtonState && resolved.inputType === "text";

	return (
		<div className="relative">
			<Input
				type={resolved.inputType}
				value={typeof value === "string" ? value : ""}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Type your response..."
				className={cn("border-white/10 bg-black/30 text-white placeholder:text-white/40", showVoice && "pr-12")}
				data-testid="survey-text-input"
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
	);
}

function resolveQuestionInput(question: ResearchLinkQuestion) {
	if (question.type === "single_select" && question.options?.length) {
		return {
			kind: "select" as const,
			options: question.options,
			allowOther: Boolean(question.allowOther),
		};
	}
	if (question.type === "multi_select" && question.options?.length) {
		return {
			kind: "multi" as const,
			options: question.options,
			allowOther: Boolean(question.allowOther),
		};
	}
	if (question.type === "likert") {
		return {
			kind: "likert" as const,
			scale: question.likertScale ?? 5,
			labels: question.likertLabels ?? { low: "", high: "" },
		};
	}
	if (question.type === "matrix" && question.matrixRows?.length) {
		return {
			kind: "matrix" as const,
			rows: question.matrixRows,
			scale: question.likertScale ?? 5,
			labels: question.likertLabels ?? { low: "", high: "" },
		};
	}
	if (question.type === "image_select" && question.imageOptions?.length) {
		return {
			kind: "image_select" as const,
			options: question.imageOptions,
		};
	}
	if (question.type === "long_text") {
		return { kind: "textarea" as const };
	}
	if (question.type === "short_text") {
		return { kind: "input" as const, inputType: "text" as const };
	}

	const prompt = question.prompt.toLowerCase();
	if (question.options?.length) {
		return { kind: "select" as const, options: question.options };
	}
	if (/email/.test(prompt)) {
		return { kind: "input" as const, inputType: "email" as const };
	}
	if (/phone|mobile|text me/.test(prompt)) {
		return { kind: "input" as const, inputType: "tel" as const };
	}
	return { kind: "textarea" as const };
}

function SingleSelectInput({
	question,
	value,
	onChange,
	options,
	allowOther,
}: {
	question: ResearchLinkQuestion;
	value: ResponseValue;
	onChange: (value: ResponseValue) => void;
	options: string[];
	allowOther?: boolean;
}) {
	const currentValue = typeof value === "string" ? value : "";
	const isOtherValue = currentValue !== "" && !options.includes(currentValue);
	const [otherSelected, setOtherSelected] = useState(isOtherValue);

	useEffect(() => {
		if (isOtherValue) {
			setOtherSelected(true);
			return;
		}
		if (currentValue !== "") {
			setOtherSelected(false);
		}
	}, [currentValue, isOtherValue]);

	const selectedValue = isOtherValue ? "__other__" : otherSelected ? "__other__" : currentValue;

	return (
		<div className="space-y-3">
			<RadioGroup
				value={selectedValue}
				onValueChange={(next) => {
					if (next === "__other__") {
						setOtherSelected(true);
						if (isOtherValue) return;
						onChange("");
						return;
					}

					setOtherSelected(false);
					onChange(next);
				}}
				className="grid grid-cols-1 gap-3 sm:grid-cols-2"
				data-testid="survey-select-input"
			>
				{options.map((option, index) => {
					const optionId = `${question.id}-option-${index}`;
					const selected = currentValue === option;
					return (
						<Label
							key={option}
							htmlFor={optionId}
							data-testid="survey-select-option"
							className={cn(
								"group flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-all",
								selected
									? "border-white bg-white text-black"
									: "border-white/15 bg-white/5 text-white/85 hover:border-white/35 hover:bg-white/10"
							)}
						>
							<RadioGroupItem
								value={option}
								id={optionId}
								className={cn(
									"mt-0.5 border-white/35 shadow-none",
									selected && "border-black text-black",
									!selected && "text-white"
								)}
							/>
							<span className="flex-1 text-sm leading-relaxed">{option}</span>
						</Label>
					);
				})}

				{allowOther && (
					<Label
						htmlFor={`${question.id}-option-other`}
						data-testid="survey-select-option"
						className={cn(
							"group flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-all",
							selectedValue === "__other__"
								? "border-white bg-white text-black"
								: "border-white/15 bg-white/5 text-white/85 hover:border-white/35 hover:bg-white/10"
						)}
					>
						<RadioGroupItem
							value="__other__"
							id={`${question.id}-option-other`}
							className={cn(
								"mt-0.5 border-white/35 shadow-none",
								selectedValue === "__other__" && "border-black text-black",
								selectedValue !== "__other__" && "text-white"
							)}
						/>
						<span className="flex-1 text-sm leading-relaxed">Other</span>
					</Label>
				)}
			</RadioGroup>

			{allowOther && (otherSelected || isOtherValue) && (
				<Input
					type="text"
					value={isOtherValue ? currentValue : ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Type your answer..."
					className="border-white/10 bg-black/30 text-white placeholder:text-white/40"
					autoFocus={selectedValue === "__other__"}
					data-testid="survey-text-input"
				/>
			)}
		</div>
	);
}
