import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import consola from "consola";
import { Bot, ChevronRight, LayoutDashboard, Mic, Plus, Send, Square, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFetcher, useLocation, useNavigate, useRevalidator } from "react-router";
import { toast } from "sonner";
import { useStickToBottom } from "use-stick-to-bottom";
import { Response as AiResponse } from "~/components/ai-elements/response";
import { Suggestion, Suggestions } from "~/components/ai-elements/suggestion";
import { FileUploadButton } from "~/components/chat/FileUploadButton";
import { InlineUserInput } from "~/components/chat/InlineUserInput";
import {
	ActionSuggestionCard,
	CelebrationCard,
	ProgressCard,
	SuggestionBadges,
	WelcomeBackCard,
} from "~/components/chat/inline";
import { MessagePlayButton } from "~/components/chat/MessagePlayButton";
import { ProjectStatusVoiceChat } from "~/components/chat/ProjectStatusVoiceChat";
import { TTSToggle } from "~/components/chat/TTSToggle";
import { type A2UIAction, A2UIRenderer } from "~/components/gen-ui/A2UIRenderer";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { VoiceButton, type VoiceButtonState } from "~/components/ui/voice-button";
import { useA2UISurfaceOptional } from "~/contexts/a2ui-surface-context";
import { useProjectStatusAgent } from "~/contexts/project-status-agent-context";
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text";
import { useDeviceDetection } from "~/hooks/useDeviceDetection";
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag";
import { useTTS } from "~/hooks/useTTS";
import { persistCanvasAction } from "~/lib/gen-ui/canvas-persistence.client";
import { isA2UIToolPayload } from "~/lib/gen-ui/tool-helpers";
import {
	type CanvasActionEvent,
	UI_EVENT_DISPATCH_TEXT,
	type UiEvent,
	type UserInputEvent,
} from "~/lib/gen-ui/ui-events";
import { cn } from "~/lib/utils";
import type { UpsightMessage } from "~/mastra/message-types";
import { HOST, PRODUCTION_HOST } from "~/paths";
import { extractSurveyQuestionUpdateDetails } from "./survey-question-sync";

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
	);
}

interface ToolProgressData {
	tool: string;
	status: string;
	message: string;
	progress?: number;
}

interface UserInputOptionPayload {
	id: string;
	label: string;
	description?: string;
}

interface UserInputPayload {
	prompt: string;
	options: UserInputOptionPayload[];
	selectionMode: "single" | "multiple";
	allowFreeText: boolean;
}

interface UserInputAnswer {
	selectedIds: string[];
	freeText?: string;
}

const USER_INPUT_MESSAGE_PREFIX = "[UserInput]";

function buildUserInputPayloadKey(payload: UserInputPayload): string {
	return `${payload.prompt}::${payload.selectionMode}::${payload.options.map((option) => option.id).join(",")}`;
}

interface PeopleImportApiResponse {
	success?: boolean;
	requestId?: string;
	error?: string;
	message?: string;
	import?: {
		imported?: {
			people?: number;
			organizations?: number;
			facets?: number;
			skipped?: number;
			updated?: number;
		};
	};
}

const ROTATING_STATUS_MESSAGES = [
	"Thinking...",
	"Cogitating...",
	"Planning...",
	"Delegating...",
	"Hustling...",
	"Bustling...",
	"Checking...",
];

const GENERIC_PROGRESS_LABELS = new Set(["thinking", "thinking...", "routing", "routing...", "working", "working..."]);

function normalizeProgressMessage(message: string): string {
	return message
		.replace(/\u2026/g, "...")
		.trim()
		.toLowerCase();
}

function useRotatingStatus(enabled: boolean): string {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		if (!enabled) {
			setIndex(0);
			return;
		}

		const timer = window.setInterval(() => {
			setIndex((current) => (current + 1) % ROTATING_STATUS_MESSAGES.length);
		}, 1200);

		return () => window.clearInterval(timer);
	}, [enabled]);

	return ROTATING_STATUS_MESSAGES[index];
}

function ThinkingWave({ progressMessage }: { progressMessage?: string | null }) {
	const gradientId = useId();
	const bars = [
		{ delay: 0, x: 0 },
		{ delay: 0.15, x: 12 },
		{ delay: 0.3, x: 24 },
		{ delay: 0.45, x: 36 },
	];
	const normalizedMessage = progressMessage ? normalizeProgressMessage(progressMessage) : "";
	const shouldRotate =
		!progressMessage || GENERIC_PROGRESS_LABELS.has(normalizedMessage) || normalizedMessage.startsWith("routing");
	const rotatingMessage = useRotatingStatus(shouldRotate);
	const displayMessage = shouldRotate ? rotatingMessage : progressMessage;

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
	);
}

function extractNetworkStatus(message: UpsightMessage): string | null {
	if (!message.parts) return null;
	for (const part of message.parts) {
		const anyPart = part as { type: string; data?: unknown };
		if (anyPart.type === "data" && anyPart.data) {
			const data = anyPart.data as Record<string, unknown>;
			// Check for network routing status: { type: "status", status: "thinking", message: "Thinking..." }
			if (data?.type === "status" && data?.message) {
				return data.message as string;
			}
			// Handle wrapped network progress: { type: "data-network", data: { steps: [...] } }
			if (data?.type === "data-network" && typeof data?.data === "object") {
				const networkData = data.data as {
					steps?: Array<{ name?: string; status?: string }>;
				};
				const activeStep = networkData.steps?.findLast((step) => step.status === "running");
				if (activeStep?.name) {
					if (isRoutingAgentStep(activeStep.name)) return "Routing...";
					return `Working: ${formatProgressLabel(activeStep.name)}`;
				}
			}
		}
		// Direct network progress: { type: "data-network", data: { steps: [...] } }
		if (anyPart.type === "data-network" && anyPart.data) {
			const networkData = anyPart.data as {
				steps?: Array<{ name?: string; status?: string }>;
			};
			const activeStep = networkData.steps?.findLast((step) => step.status === "running");
			if (activeStep?.name) {
				if (isRoutingAgentStep(activeStep.name)) return "Routing...";
				return `Working: ${formatProgressLabel(activeStep.name)}`;
			}
		}
	}
	return null;
}

function isRoutingAgentStep(name: string): boolean {
	return name.toLowerCase() === "routing-agent";
}

function formatProgressLabel(name: string): string {
	return name
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str: string) => str.toUpperCase())
		.trim();
}

function formatAssistantTransportError(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error);
	const normalized = raw.toLowerCase();
	const isRateLimit =
		normalized.includes("rate limit") ||
		normalized.includes("rate_limit") ||
		normalized.includes("429") ||
		normalized.includes("too many requests");
	if (isRateLimit) {
		return "Assistant hit a rate limit. No update was completed. Retry in about a minute.";
	}
	return "Assistant request failed before completion. No update was confirmed.";
}

type NetworkStep = {
	name?: string;
	status?: string;
};

function extractNetworkSteps(message: UpsightMessage): NetworkStep[] {
	if (!message.parts) return [];
	for (const part of message.parts) {
		const anyPart = part as { type: string; data?: unknown };
		if (anyPart.type === "data-network" && anyPart.data) {
			const networkData = anyPart.data as { steps?: NetworkStep[] };
			return Array.isArray(networkData.steps) ? networkData.steps : [];
		}
		if (anyPart.type === "data" && anyPart.data) {
			const data = anyPart.data as Record<string, unknown>;
			if (data?.type === "data-network" && typeof data?.data === "object") {
				const networkData = data.data as { steps?: NetworkStep[] };
				return Array.isArray(networkData.steps) ? networkData.steps : [];
			}
		}
	}
	return [];
}

function formatNetworkStepLabel(name?: string): string {
	if (!name) return "Step";
	if (isRoutingAgentStep(name)) return "Coordinator";
	return formatProgressLabel(name);
}

function extractToolProgress(message: UpsightMessage): ToolProgressData | null {
	if (!message.parts) return null;
	for (const part of message.parts) {
		// Cast to any to handle dynamic part types from Mastra streaming
		const anyPart = part as { type: string; data?: unknown };
		// Check for data-tool-progress type with data property (AI SDK v5 format: type="data-xxx")
		if (anyPart.type === "data-tool-progress" && anyPart.data) {
			return anyPart.data as ToolProgressData;
		}
		// Also check for custom data parts that might be wrapped differently by Mastra
		// Mastra's writer.custom() might serialize as { type: "data", data: { type: "data-tool-progress", ... } }
		if (anyPart.type === "data" && anyPart.data) {
			const data = anyPart.data as Record<string, unknown>;
			if (data?.type === "data-tool-progress" && data?.data) {
				return data.data as ToolProgressData;
			}
			// Direct data format: { type: "data", data: { tool, status, message, progress } }
			if (data?.tool && data?.message) {
				return data as unknown as ToolProgressData;
			}
		}
	}
	return null;
}

function extractReasoningText(message: UpsightMessage): string | null {
	if (!message.parts) return null;
	for (const part of message.parts) {
		// Cast to handle dynamic part types from Mastra/AI SDK streaming
		const anyPart = part as { type: string; reasoning?: string; text?: string };
		// AI SDK v5 reasoning parts have type="reasoning" with reasoning property
		if (anyPart.type === "reasoning" && anyPart.reasoning) {
			return anyPart.reasoning;
		}
	}
	return null;
}

function isNetworkDebugText(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
	try {
		const parsed = JSON.parse(trimmed) as { isNetwork?: boolean };
		return parsed?.isNetwork === true;
	} catch {
		return false;
	}
}

function extractToolResultText(message: UpsightMessage): string | null {
	if (message.role !== "tool" || !message.parts) return null;
	for (const part of message.parts) {
		const anyPart = part as {
			type: string;
			toolName?: string;
			result?: { message?: string; task?: { id?: string } };
			toolResult?: { message?: string };
			data?: { message?: string };
		};
		if (anyPart.type === "tool-result") {
			return anyPart.result?.message || anyPart.toolResult?.message || null;
		}
		if (anyPart.type === "data" && anyPart.data?.message) {
			return anyPart.data.message;
		}
	}
	return null;
}

function extractToolResultTaskId(message: UpsightMessage): string | null {
	if (message.role !== "tool" || !message.parts) return null;
	for (const part of message.parts) {
		const anyPart = part as {
			type: string;
			toolName?: string;
			result?: { task?: { id?: string } };
		};
		if (anyPart.type === "tool-result" && anyPart.toolName === "createTask") {
			return anyPart.result?.task?.id || null;
		}
	}
	return null;
}

function extractActiveToolCall(message: UpsightMessage): string | null {
	if (!message.parts) return null;

	// In AI SDK v5, tool invocations are parts with type "tool-invocation"
	for (const part of message.parts) {
		const anyPart = part as {
			type: string;
			toolInvocation?: {
				toolName: string;
				state: string;
			};
			toolName?: string;
			state?: string;
		};

		// Check for tool-invocation type parts (AI SDK v5 format)
		if (anyPart.type === "tool-invocation" || anyPart.toolInvocation) {
			const toolData = anyPart.toolInvocation || anyPart;
			// Check if tool is still in progress (not completed)
			if (
				toolData.state === "input-streaming" ||
				toolData.state === "input-available" ||
				toolData.state === "call" ||
				toolData.state === "partial-call"
			) {
				const toolName = toolData.toolName;
				if (toolName) {
					// Format tool name nicely (e.g., "fetchProjectStatusContext" -> "Fetching project status context")
					const readable = toolName
						.replace(/([A-Z])/g, " $1")
						.replace(/^./, (str: string) => str.toUpperCase())
						.trim();
					return readable;
				}
			}
		}
	}
	return null;
}

function normalizeToolName(value: string | undefined): string {
	if (!value) return "";
	return value.replace(/[-_]/g, "").toLowerCase();
}

function normalizeUserInputPayload(raw: unknown): UserInputPayload | null {
	if (!raw || typeof raw !== "object") return null;
	const candidate = raw as Record<string, unknown>;
	const payload =
		candidate.userInput && typeof candidate.userInput === "object"
			? (candidate.userInput as Record<string, unknown>)
			: candidate;

	if (payload.__userInput !== true) return null;
	const prompt = payload.prompt;
	const options = payload.options;
	const selectionMode = payload.selectionMode;

	if (
		typeof prompt !== "string" ||
		!Array.isArray(options) ||
		(selectionMode !== "single" && selectionMode !== "multiple")
	) {
		return null;
	}

	const normalizedOptions: UserInputOptionPayload[] = [];
	for (const option of options) {
		if (!option || typeof option !== "object") continue;
		const opt = option as Record<string, unknown>;
		if (typeof opt.id !== "string" || typeof opt.label !== "string") {
			continue;
		}
		normalizedOptions.push({
			id: opt.id,
			label: opt.label,
			...(typeof opt.description === "string" ? { description: opt.description } : {}),
		});
	}

	if (normalizedOptions.length === 0) return null;

	return {
		prompt,
		options: normalizedOptions,
		selectionMode,
		allowFreeText: payload.allowFreeText !== false,
	};
}

function extractUserInputPayloads(message: UpsightMessage): UserInputPayload[] {
	if (!message.parts) return [];

	const payloads: UserInputPayload[] = [];
	const seen = new Set<string>();

	for (const part of message.parts) {
		const anyPart = part as Record<string, unknown>;
		const partType = typeof anyPart.type === "string" ? anyPart.type : undefined;
		const toolInvocation =
			anyPart.toolInvocation && typeof anyPart.toolInvocation === "object"
				? (anyPart.toolInvocation as Record<string, unknown>)
				: undefined;

		const partToolName = typeof anyPart.toolName === "string" ? anyPart.toolName : undefined;
		const invocationToolName =
			typeof toolInvocation?.toolName === "string" ? (toolInvocation.toolName as string) : undefined;
		const inferredToolName = partType?.startsWith("tool-") ? partType.replace(/^tool-/, "") : undefined;
		const normalizedToolName = normalizeToolName(partToolName ?? invocationToolName ?? inferredToolName);

		if (normalizedToolName !== "requestuserinput") continue;

		const candidates = [
			anyPart.output,
			anyPart.result,
			anyPart.toolResult,
			anyPart.data,
			toolInvocation?.output,
			anyPart.args,
			anyPart.input,
			toolInvocation?.args,
			toolInvocation?.input,
		];

		for (const candidate of candidates) {
			const payload = normalizeUserInputPayload(candidate);
			if (!payload) continue;
			const key = buildUserInputPayloadKey(payload);
			if (seen.has(key)) continue;
			seen.add(key);
			payloads.push(payload);
		}
	}

	return payloads;
}

interface SuggestActionsBadge {
	id: string;
	label: string;
	icon?: string;
	action: "send_message" | "navigate";
	message?: string;
	path?: string;
}

interface SuggestActionsCard {
	icon: string;
	title: string;
	description: string;
	ctaLabel: string;
	action: "send_message" | "navigate";
	message?: string;
	path?: string;
	skipLabel?: string;
}

interface SuggestActionsPayload {
	badges: SuggestActionsBadge[];
	card?: SuggestActionsCard;
}

function extractSuggestActionsPayload(message: UpsightMessage): SuggestActionsPayload | null {
	if (!message.parts) return null;

	for (const part of message.parts) {
		const anyPart = part as Record<string, unknown>;
		const partType = typeof anyPart.type === "string" ? anyPart.type : undefined;
		const toolInvocation =
			anyPart.toolInvocation && typeof anyPart.toolInvocation === "object"
				? (anyPart.toolInvocation as Record<string, unknown>)
				: undefined;

		const partToolName = typeof anyPart.toolName === "string" ? anyPart.toolName : undefined;
		const invocationToolName =
			typeof toolInvocation?.toolName === "string" ? (toolInvocation.toolName as string) : undefined;
		const inferredToolName = partType?.startsWith("tool-") ? partType.replace(/^tool-/, "") : undefined;
		const normalizedName = normalizeToolName(partToolName ?? invocationToolName ?? inferredToolName);

		if (normalizedName !== "suggestactions") continue;

		const candidates = [anyPart.args, anyPart.input, toolInvocation?.args, toolInvocation?.input];

		for (const candidate of candidates) {
			if (!candidate || typeof candidate !== "object") continue;
			const payload = candidate as Record<string, unknown>;
			if (Array.isArray(payload.badges) && payload.badges.length > 0) {
				return {
					badges: payload.badges as SuggestActionsBadge[],
					card: payload.card as SuggestActionsCard | undefined,
				};
			}
		}
	}

	return null;
}

interface ShowProgressStep {
	id: string;
	label: string;
	status: "pending" | "active" | "done";
}

interface ShowProgressPayload {
	title: string;
	steps: ShowProgressStep[];
	progressPercent?: number;
}

function extractShowProgressPayload(message: UpsightMessage): ShowProgressPayload | null {
	if (!message.parts) return null;

	for (const part of message.parts) {
		const anyPart = part as Record<string, unknown>;
		const partType = typeof anyPart.type === "string" ? anyPart.type : undefined;
		const toolInvocation =
			anyPart.toolInvocation && typeof anyPart.toolInvocation === "object"
				? (anyPart.toolInvocation as Record<string, unknown>)
				: undefined;

		const partToolName = typeof anyPart.toolName === "string" ? anyPart.toolName : undefined;
		const invocationToolName =
			typeof toolInvocation?.toolName === "string" ? (toolInvocation.toolName as string) : undefined;
		const inferredToolName = partType?.startsWith("tool-") ? partType.replace(/^tool-/, "") : undefined;
		const normalizedName = normalizeToolName(partToolName ?? invocationToolName ?? inferredToolName);

		if (normalizedName !== "showprogress") continue;

		const candidates = [anyPart.args, anyPart.input, toolInvocation?.args, toolInvocation?.input];

		for (const candidate of candidates) {
			if (!candidate || typeof candidate !== "object") continue;
			const payload = candidate as Record<string, unknown>;
			if (typeof payload.title === "string" && Array.isArray(payload.steps) && payload.steps.length > 0) {
				return {
					title: payload.title,
					steps: payload.steps as ShowProgressStep[],
					progressPercent: typeof payload.progressPercent === "number" ? payload.progressPercent : undefined,
				};
			}
		}
	}

	return null;
}

interface WelcomeChangeBullet {
	icon?: string;
	text: string;
}

interface WelcomeBadge {
	id: string;
	label: string;
	icon?: string;
	action: "send_message" | "navigate";
	message?: string;
	path?: string;
}

interface WelcomePayload {
	datestamp: string;
	changes: WelcomeChangeBullet[];
	badges: WelcomeBadge[];
}

function extractWelcomePayload(message: UpsightMessage): WelcomePayload | null {
	if (!message.parts) return null;

	for (const part of message.parts) {
		const anyPart = part as Record<string, unknown>;
		const partType = typeof anyPart.type === "string" ? anyPart.type : undefined;
		const toolInvocation =
			anyPart.toolInvocation && typeof anyPart.toolInvocation === "object"
				? (anyPart.toolInvocation as Record<string, unknown>)
				: undefined;

		const partToolName = typeof anyPart.toolName === "string" ? anyPart.toolName : undefined;
		const invocationToolName =
			typeof toolInvocation?.toolName === "string" ? (toolInvocation.toolName as string) : undefined;
		const inferredToolName = partType?.startsWith("tool-") ? partType.replace(/^tool-/, "") : undefined;
		const normalizedName = normalizeToolName(partToolName ?? invocationToolName ?? inferredToolName);

		if (normalizedName !== "showwelcome") continue;

		const candidates = [anyPart.args, anyPart.input, toolInvocation?.args, toolInvocation?.input];

		for (const candidate of candidates) {
			if (!candidate || typeof candidate !== "object") continue;
			const payload = candidate as Record<string, unknown>;
			if (typeof payload.datestamp === "string" && Array.isArray(payload.changes) && payload.changes.length > 0) {
				return {
					datestamp: payload.datestamp,
					changes: payload.changes as WelcomeChangeBullet[],
					badges: Array.isArray(payload.badges) ? (payload.badges as WelcomeBadge[]) : [],
				};
			}
		}
	}

	return null;
}

interface CelebrationPayload {
	milestone: string;
	description: string;
	icon?: string;
	ctaLabel?: string;
	ctaAction?: "send_message" | "navigate";
	ctaMessage?: string;
	ctaPath?: string;
}

function extractCelebrationPayload(message: UpsightMessage): CelebrationPayload | null {
	if (!message.parts) return null;

	for (const part of message.parts) {
		const anyPart = part as Record<string, unknown>;
		const partType = typeof anyPart.type === "string" ? anyPart.type : undefined;
		const toolInvocation =
			anyPart.toolInvocation && typeof anyPart.toolInvocation === "object"
				? (anyPart.toolInvocation as Record<string, unknown>)
				: undefined;

		const partToolName = typeof anyPart.toolName === "string" ? anyPart.toolName : undefined;
		const invocationToolName =
			typeof toolInvocation?.toolName === "string" ? (toolInvocation.toolName as string) : undefined;
		const inferredToolName = partType?.startsWith("tool-") ? partType.replace(/^tool-/, "") : undefined;
		const normalizedName = normalizeToolName(partToolName ?? invocationToolName ?? inferredToolName);

		if (normalizedName !== "showcelebration") continue;

		const candidates = [anyPart.args, anyPart.input, toolInvocation?.args, toolInvocation?.input];

		for (const candidate of candidates) {
			if (!candidate || typeof candidate !== "object") continue;
			const payload = candidate as Record<string, unknown>;
			if (typeof payload.milestone === "string" && typeof payload.description === "string") {
				return {
					milestone: payload.milestone,
					description: payload.description,
					icon: typeof payload.icon === "string" ? payload.icon : undefined,
					ctaLabel: typeof payload.ctaLabel === "string" ? payload.ctaLabel : undefined,
					ctaAction:
						payload.ctaAction === "send_message" || payload.ctaAction === "navigate" ? payload.ctaAction : undefined,
					ctaMessage: typeof payload.ctaMessage === "string" ? payload.ctaMessage : undefined,
					ctaPath: typeof payload.ctaPath === "string" ? payload.ctaPath : undefined,
				};
			}
		}
	}

	return null;
}

function parseUserInputResponseText(text: string): {
	promptKey?: string;
	prompt: string;
	selectedIds: string[];
	freeText?: string;
} | null {
	const trimmed = text.trim();
	if (!trimmed.startsWith(USER_INPUT_MESSAGE_PREFIX)) return null;

	const rawPayload = trimmed.slice(USER_INPUT_MESSAGE_PREFIX.length).trim();
	if (!rawPayload) return null;

	try {
		const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
		if (typeof parsed.prompt !== "string") return null;
		const promptKey = typeof parsed.promptKey === "string" ? parsed.promptKey : undefined;
		const selectedIds = Array.isArray(parsed.selectedIds)
			? parsed.selectedIds.filter((value): value is string => typeof value === "string")
			: [];
		const freeText = typeof parsed.freeText === "string" ? parsed.freeText : undefined;
		return {
			promptKey,
			prompt: parsed.prompt,
			selectedIds,
			freeText,
		};
	} catch {
		return null;
	}
}

function extractUserInputAnswers(messages: UpsightMessage[]): Record<string, UserInputAnswer> {
	const answers: Record<string, UserInputAnswer> = {};

	for (const message of messages) {
		if (message.role !== "user" || !message.parts) continue;

		for (const part of message.parts) {
			if (part.type !== "text" || typeof part.text !== "string") continue;
			const parsed = parseUserInputResponseText(part.text);
			if (!parsed) continue;
			const answer = {
				selectedIds: parsed.selectedIds,
				freeText: parsed.freeText,
			};
			if (parsed.promptKey) {
				answers[parsed.promptKey] = answer;
			}
			answers[parsed.prompt] = answer;
		}
	}

	return answers;
}

function isInternalUiDispatchMessage(message: UpsightMessage): boolean {
	if (message.role !== "user" || !message.parts) return false;
	const textPart = message.parts.find((part) => part.type === "text");
	return textPart?.type === "text" && textPart.text === UI_EVENT_DISPATCH_TEXT;
}

function estimateDataRows(content: string): number {
	const nonEmptyLines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (nonEmptyLines.length === 0) return 0;
	return Math.max(nonEmptyLines.length - 1, 0);
}

/** TTS state exposed to parent components via callback ref */
export interface TTSState {
	isEnabled: boolean;
	isPlaying: boolean;
	isDisabledByVoiceChat: boolean;
	toggleEnabled: () => void;
}

interface ProjectStatusAgentChatProps {
	accountId: string;
	projectId: string;
	systemContext: string;
	onCollapsedChange?: (collapsed: boolean) => void;
	/** When true, hides the card header/chrome - used when embedded in AIAssistantPanel */
	embedded?: boolean;
	/** Embedded tone: dark for floating panel, light for split/inline embeds */
	embeddedTone?: "dark" | "light";
	/** Ref callback to expose clearChat to parent (used by AIAssistantPanel) */
	onClearChatRef?: (clearFn: (() => void) | null) => void;
	/** Ref callback to expose loadThread to parent (used by AIAssistantPanel) */
	onLoadThreadRef?: (loadFn: ((threadId: string) => void) | null) => void;
	/** Ref callback to expose TTS state to parent (used by AIAssistantPanel for header toggle) */
	onTTSStateRef?: (state: TTSState | null) => void;
}

const INTERNAL_ORIGINS = [HOST, PRODUCTION_HOST]
	.map((value) => {
		try {
			return new URL(value).origin;
		} catch {
			return null;
		}
	})
	.filter((origin): origin is string => Boolean(origin));

const normalizeInternalPath = (href: string | null): string | null => {
	if (!href) return null;
	if (href.startsWith("/")) return href;
	if (href.startsWith("#")) return href;

	try {
		const baseOrigin = typeof window !== "undefined" ? window.location.origin : INTERNAL_ORIGINS[0];
		const candidate = baseOrigin ? new URL(href, baseOrigin) : new URL(href);

		const matchesWindow = typeof window !== "undefined" && candidate.origin === window.location.origin;
		const matchesKnownHost = INTERNAL_ORIGINS.includes(candidate.origin);

		if (matchesWindow || matchesKnownHost) {
			return `${candidate.pathname}${candidate.search}${candidate.hash}`;
		}
	} catch {
		return null;
	}

	return null;
};

const ensureProjectScopedPath = (
	path: string | null,
	accountId: string,
	projectId: string
): { resolved: string | null; reason?: string } => {
	const normalized = normalizeInternalPath(path);
	if (!normalized) {
		return { resolved: null, reason: "non-internal" };
	}

	if (!accountId || !projectId) {
		return { resolved: normalized };
	}

	const projectBase = `/a/${accountId}/${projectId}`;

	// Treat short internal routes as project-relative links.
	// This prevents full-page navigations from markdown links like "/people" or "/setup".
	const projectRelativePrefixes = [
		"/setup",
		"/ask",
		"/insights",
		"/themes",
		"/people",
		"/organizations",
		"/personas",
		"/crm",
		"/plan",
		"/sources",
		"/interviews",
		"/opportunities",
		"/lenses",
	];
	if (normalized === "/") {
		return { resolved: projectBase };
	}
	if (projectRelativePrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
		return { resolved: `${projectBase}${normalized}` };
	}

	if (normalized === projectBase || normalized.startsWith(`${projectBase}/`)) {
		return { resolved: normalized };
	}

	return { resolved: null, reason: "outside-project-scope" };
};

export function ProjectStatusAgentChat({
	accountId,
	projectId,
	systemContext,
	onCollapsedChange,
	embedded,
	embeddedTone = "dark",
	onClearChatRef,
	onLoadThreadRef,
	onTTSStateRef,
}: ProjectStatusAgentChatProps) {
	const { isMobile } = useDeviceDetection();
	const [input, setInput] = useState("");
	const [isCollapsed, setIsCollapsed] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	// Use stick-to-bottom for auto-scrolling chat messages
	const { scrollRef, contentRef, scrollToBottom } = useStickToBottom();
	const location = useLocation();
	const {
		pendingInput,
		setPendingInput,
		pendingUiEvents,
		setPendingUiEvents,
		sendUiEvent,
		pendingAssistantMessage,
		setPendingAssistantMessage,
		forceExpandChat,
		setForceExpandChat,
	} = useProjectStatusAgent();
	const { isEnabled: isVoiceEnabled } = usePostHogFeatureFlag("ffVoice");

	// TTS: text-to-speech for assistant responses
	const tts = useTTS({ voiceChatActive: false });

	// A2UI: detect gen-ui payloads in tool results and apply to surface
	const a2uiSurface = useA2UISurfaceOptional();

	// Expose TTS state to parent (AIAssistantPanel) for header toggle
	useEffect(() => {
		onTTSStateRef?.({
			isEnabled: tts.isEnabled,
			isPlaying: tts.isPlaying,
			isDisabledByVoiceChat: tts.isDisabledByVoiceChat,
			toggleEnabled: tts.toggleEnabled,
		});
		return () => onTTSStateRef?.(null);
	}, [onTTSStateRef, tts.isEnabled, tts.isPlaying, tts.isDisabledByVoiceChat, tts.toggleEnabled]);

	// Load chat history from the server for display
	// The history is loaded for UI display only - when sending new messages,
	// we only send the new message. Mastra's memory system handles including
	// historical context server-side, so we don't send history to avoid duplicates.
	const historyFetcher = useFetcher<{
		threadId?: string;
		messages?: UpsightMessage[];
		error?: string;
	}>();
	const historyLoadedRef = useRef(false);
	const historyAppliedRef = useRef(false);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

	// Handle pendingInput from context (inserted by other components like priorities table)
	useEffect(() => {
		if (pendingInput) {
			setInput(pendingInput);
			setPendingInput(null);
			// Focus textarea after inserting text
			setTimeout(() => {
				textareaRef.current?.focus();
				// Move cursor to end
				const len = pendingInput.length;
				textareaRef.current?.setSelectionRange(len, len);
			}, 100);
		}
	}, [pendingInput, setPendingInput]);

	// Handle forceExpandChat signal from context (e.g., when showAssistantMessage is called)
	useEffect(() => {
		if (forceExpandChat) {
			setIsCollapsed(false);
			setForceExpandChat(false);
		}
	}, [forceExpandChat, setForceExpandChat]);

	const navigate = useNavigate();
	const revalidator = useRevalidator();

	const currentPageContext = useMemo(() => {
		return describeCurrentProjectView({
			pathname: location.pathname,
			search: location.search,
			accountId,
			projectId,
		});
	}, [location.pathname, location.search, accountId, projectId]);

	const mergedSystemContext = useMemo(() => {
		if (!currentPageContext) return systemContext;
		return [systemContext, `Current UI Context:\n${currentPageContext}`].filter(Boolean).join("\n\n");
	}, [systemContext, currentPageContext]);

	// Get user's timezone from browser
	const userTimezone = useMemo(() => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch {
			return "UTC";
		}
	}, []);

	// Use refs so the transport body function always reads latest values,
	// even though the Chat instance is created once and stored in a ref by useChat
	const mergedSystemContextRef = useRef(mergedSystemContext);
	mergedSystemContextRef.current = mergedSystemContext;

	const activeThreadIdRef = useRef(activeThreadId);
	activeThreadIdRef.current = activeThreadId;
	const [chatErrorMessage, setChatErrorMessage] = useState<string | null>(null);

	const { messages, sendMessage, status, addToolResult, stop, setMessages } = useChat<UpsightMessage>({
		transport: new DefaultChatTransport({
			api: `/a/${accountId}/${projectId}/api/chat/project-status`,
			body: () => ({
				system: mergedSystemContextRef.current,
				userTimezone,
				threadId: activeThreadIdRef.current,
			}),
		}),
		// Note: Mastra's memory system on the server handles historical context.
		// We load history for display but don't need to send it back since the server
		// already includes it via the memory thread.
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		onError: (error) => {
			const message = formatAssistantTransportError(error);
			setChatErrorMessage(message);
			consola.error("project-status-chat: transport error", {
				error: error instanceof Error ? error.message : String(error),
			});
			toast.error("Assistant request failed", {
				description: message,
			});
		},
		onToolCall: async ({ toolCall }) => {
			if (toolCall.dynamic) return;

			if (toolCall.toolName === "navigateToPage") {
				const rawPath = (toolCall.input as { path?: string })?.path || null;
				const { resolved: normalizedPath, reason } = ensureProjectScopedPath(rawPath, accountId, projectId);

				if (normalizedPath) {
					navigate(normalizedPath);
					addToolResult({
						tool: "navigateToPage",
						toolCallId: toolCall.toolCallId,
						output: { success: true, path: normalizedPath },
					});
				} else {
					addToolResult({
						tool: "navigateToPage",
						toolCallId: toolCall.toolCallId,
						output: {
							success: false,
							error: reason || "Unsupported navigation target",
						},
					});
				}
			}

			// Handle agent switching for handoff pattern
			if (toolCall.toolName === "switchAgent") {
				const input = toolCall.input as {
					targetAgent?: string;
					reason?: string;
				};
				const targetAgent = input?.targetAgent;
				const reason = input?.reason || "Switching agents...";

				consola.info("switchAgent tool called:", { targetAgent, reason });

				if (targetAgent === "project-setup") {
					// Navigate to setup page which uses the setup agent
					const setupPath = `/a/${accountId}/${projectId}/setup`;
					navigate(setupPath);
					addToolResult({
						tool: "switchAgent",
						toolCallId: toolCall.toolCallId,
						output: { success: true, targetAgent, message: reason },
					});
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
					});
				} else {
					addToolResult({
						tool: "switchAgent",
						toolCallId: toolCall.toolCallId,
						output: {
							success: false,
							error: `Unknown agent: ${targetAgent}`,
						},
					});
				}
			}
		},
	});

	const [localUserInputAnswers, setLocalUserInputAnswers] = useState<Record<string, UserInputAnswer>>({});
	const [usedSuggestActionMessageIds, setUsedSuggestActionMessageIds] = useState<Set<string>>(new Set());
	const [dismissedCelebrationMessageIds, setDismissedCelebrationMessageIds] = useState<Set<string>>(new Set());
	const persistedUserInputAnswers = useMemo(() => extractUserInputAnswers(messages), [messages]);
	const userInputAnswers = useMemo(
		() => ({ ...persistedUserInputAnswers, ...localUserInputAnswers }),
		[persistedUserInputAnswers, localUserInputAnswers]
	);
	const queueDispatchInFlightRef = useRef(false);
	const handleInlineUserInputSubmit = useCallback(
		(payload: UserInputPayload, payloadKey: string, selectedIds: string[], freeText?: string) => {
			const trimmedFreeText = freeText?.trim();
			const answer: UserInputAnswer = {
				selectedIds,
				freeText: trimmedFreeText || undefined,
			};

			setLocalUserInputAnswers((prev) => ({
				...prev,
				[payloadKey]: answer,
				[payload.prompt]: answer,
			}));

			if (answer.freeText) {
				toast.success("Response sent", {
					description: answer.freeText,
				});
			} else {
				const selectedLabels = payload.options
					.filter((option) => selectedIds.includes(option.id))
					.map((option) => option.label);
				toast.success("Response sent", {
					description: selectedLabels.join(", ") || "Your selection was sent to Uppy.",
				});
			}

			const responseEvent: UserInputEvent = {
				type: "user_input",
				promptKey: payloadKey,
				prompt: payload.prompt,
				selectedIds,
				freeText: answer.freeText ?? null,
				source: "chat-inline",
				occurredAt: new Date().toISOString(),
			};
			sendUiEvent(responseEvent);
		},
		[sendUiEvent]
	);
	const handleA2UIAction = useCallback(
		async (action: A2UIAction) => {
			const persistResult = await persistCanvasAction(action, projectId);
			const event: CanvasActionEvent = {
				type: "canvas_action",
				componentType: action.componentType,
				componentId: action.componentId,
				actionName: action.actionName,
				payload: action.payload ?? null,
				persisted: persistResult.saved,
				persistError: persistResult.error ?? null,
				source: "canvas",
				occurredAt: new Date().toISOString(),
			};
			sendUiEvent(event);
		},
		[projectId, sendUiEvent]
	);

	// A2UI: Scan messages for tool results containing A2UI payloads
	const lastA2UIMessageIdRef = useRef<string | null>(null);
	useEffect(() => {
		if (!a2uiSurface) return;
		// Walk messages in reverse to find the latest tool result with a2ui payload
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg.id === lastA2UIMessageIdRef.current) break;
			if (!msg.parts) continue;
			for (const part of msg.parts) {
				const anyPart = part as Record<string, unknown>;
				const partType = anyPart.type as string | undefined;
				const partState = anyPart.state as string | undefined;

				// Match tool parts that have output available
				const isToolWithOutput =
					partState === "output-available" &&
					(partType === "tool-result" || partType === "dynamic-tool" || (partType?.startsWith("tool-") ?? false));

				if (isToolWithOutput) {
					const result = (anyPart.output ?? anyPart.result ?? anyPart.toolResult) as
						| Record<string, unknown>
						| undefined;
					if (result && isA2UIToolPayload(result)) {
						a2uiSurface.applyMessages(
							(
								result as {
									a2ui: {
										messages: Parameters<typeof a2uiSurface.applyMessages>[0];
									};
								}
							).a2ui.messages
						);
					}
				}
			}
		}
		if (messages.length > 0) {
			lastA2UIMessageIdRef.current = messages[messages.length - 1].id;
		}
	}, [messages, a2uiSurface]);

	// Auto-navigate when the server sends a data part with { type: "navigate", path }.
	// Used by survey_quick_create to navigate to the editor without a fake tool call
	// (which previously caused an infinite create loop via sendAutomatically).
	const lastNavigateMessageIdRef = useRef<string | null>(null);
	useEffect(() => {
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg.id === lastNavigateMessageIdRef.current) break;
			if (msg.role !== "assistant" || !msg.parts) continue;
			for (const part of msg.parts) {
				const anyPart = part as { type: string; data?: unknown[] };
				if (anyPart.type === "data" && Array.isArray(anyPart.data)) {
					for (const item of anyPart.data) {
						const navItem = item as { type?: string; path?: string };
						if (navItem.type === "navigate" && navItem.path) {
							const { resolved } = ensureProjectScopedPath(navItem.path, accountId, projectId);
							if (resolved) {
								navigate(resolved);
							}
						}
					}
				}
			}
		}
		if (messages.length > 0) {
			lastNavigateMessageIdRef.current = messages[messages.length - 1].id;
		}
	}, [messages, navigate, accountId, projectId]);

	// Reset thread state when the project context changes.
	useEffect(() => {
		historyLoadedRef.current = false;
		historyAppliedRef.current = false;
		setActiveThreadId(null);
		setLocalUserInputAnswers({});
		setPendingUiEvents([]);
		setMessages([]);
	}, [accountId, projectId, setMessages, setPendingUiEvents]);

	// Load history once on mount
	useEffect(() => {
		if (historyLoadedRef.current) return;
		historyLoadedRef.current = true;

		const historyUrl = `/a/${accountId}/${projectId}/api/chat/project-status/history`;
		consola.info("Loading chat history from:", historyUrl);
		historyFetcher.load(historyUrl);
	}, [accountId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

	// Update messages when history loads (setMessages comes from useChat)
	// Only apply history once to prevent re-applying on navigation
	// Handle errors gracefully to prevent retry loops
	useEffect(() => {
		if (historyAppliedRef.current) return;

		const fetcherData = historyFetcher.data;
		if (!fetcherData) return;

		historyAppliedRef.current = true;

		if (typeof fetcherData.threadId === "string" && fetcherData.threadId) {
			setActiveThreadId(fetcherData.threadId);
		}

		// Check for error response (including auth errors that return error JSON)
		if (fetcherData?.error) {
			consola.warn("Chat history load failed, skipping:", fetcherData.error);
			return;
		}

		if (fetcherData?.messages && fetcherData.messages.length > 0) {
			consola.info("Chat history loaded, updating messages:", fetcherData.messages.length, "messages");
			setMessages(fetcherData.messages);
			// Scroll to bottom after history loads
			requestAnimationFrame(() => {
				scrollToBottom();
			});
		}
	}, [historyFetcher.data, setMessages, scrollToBottom]);

	// Handle pending typed UI events from external UI actions (canvas, inline choices).
	useEffect(() => {
		if (status !== "ready") {
			queueDispatchInFlightRef.current = false;
			return;
		}
		if (queueDispatchInFlightRef.current) return;
		if (pendingUiEvents.length === 0) return;

		queueDispatchInFlightRef.current = true;
		const nextEvent: UiEvent = pendingUiEvents[0];
		sendMessage({ text: UI_EVENT_DISPATCH_TEXT }, { body: { uiEvents: [nextEvent] } });
		setPendingUiEvents((prev) => prev.slice(1));
	}, [pendingUiEvents, sendMessage, setPendingUiEvents, status]);

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
			]);
			setPendingAssistantMessage(null);
		}
	}, [pendingAssistantMessage, setPendingAssistantMessage, setMessages]);

	const handleVoiceTranscription = useCallback(
		(transcript: string) => {
			const trimmed = transcript.trim();
			if (!trimmed) return;
			sendMessage({ text: trimmed });
			setInput("");
		},
		[sendMessage]
	);

	const handleFileUpload = useCallback(
		async (content: string, fileName: string, fileType: string) => {
			const estimatedRows = estimateDataRows(content);
			const rowLabel = `${estimatedRows.toLocaleString()} row${estimatedRows === 1 ? "" : "s"} estimated`;

			toast.success(`Uploaded ${fileName}`, {
				description: `${rowLabel}. Importing to People + Organizations...`,
			});
			consola.info("Chat CSV upload queued", {
				accountId,
				projectId,
				fileName,
				fileType,
				estimatedRows,
				contentLength: content.length,
			});

			const payload = {
				projectId,
				title: fileName,
				csvContent: content,
				mode: "upsert" as const,
				skipDuplicates: true,
				createOrganizations: true,
				verify: true,
			};

			const endpoints = [`/a/${accountId}/${projectId}/api/people/import-csv`, "/api/people/import-csv"];
			let lastError: string | null = null;
			for (const endpoint of endpoints) {
				try {
					const response = await fetch(endpoint, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(payload),
					});
					const result = (await response.json().catch(() => ({}))) as PeopleImportApiResponse;
					consola.info("CSV import API response", {
						endpoint,
						status: response.status,
						ok: response.ok,
						requestId: result.requestId,
						success: result.success,
						error: result.error,
						message: result.message,
						imported: result.import?.imported,
					});

					if (response.ok && result.success) {
						const imported = result.import?.imported;
						const people = imported?.people ?? 0;
						const organizations = imported?.organizations ?? 0;
						const facets = imported?.facets ?? 0;
						const skipped = imported?.skipped ?? 0;
						const updated = imported?.updated ?? 0;

						toast.success("Import complete", {
							description: `${people} people, ${organizations} orgs, ${facets} facets${updated ? `, ${updated} updated` : ""}${skipped ? `, ${skipped} skipped` : ""}.`,
						});
						revalidator.revalidate();
						return;
					}

					lastError = result.error || result.message || `HTTP ${response.status}`;
				} catch (error) {
					lastError = error instanceof Error ? error.message : String(error);
				}
			}

			toast.error("Direct import failed", {
				description: lastError || "Falling back to assistant parsing.",
			});

			const message = `I'm uploading a ${fileType.toUpperCase()} file named "${fileName}" with contact data. Please parse it and help me import the contacts:\n\n\`\`\`${fileType}\n${content}\n\`\`\``;
			sendMessage({ text: message });
		},
		[accountId, projectId, revalidator, sendMessage]
	);

	const createNewThread = useCallback(async () => {
		const createUrl = `/a/${accountId}/${projectId}/api/chat/project-status/threads`;
		try {
			const response = await fetch(createUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			const data = (await response.json()) as {
				thread?: { id?: string };
				error?: string;
			};
			if (!response.ok || data?.error || !data?.thread?.id) {
				consola.warn("Failed to create new thread, falling back to UI clear:", data?.error || response.statusText);
				setLocalUserInputAnswers({});
				setMessages([]);
				setActiveThreadId(null);
				return;
			}
			setLocalUserInputAnswers({});
			setMessages([]);
			setActiveThreadId(data.thread.id);
			requestAnimationFrame(() => {
				scrollToBottom();
				textareaRef.current?.focus();
			});
		} catch (err) {
			consola.error("Failed to create new thread:", err);
			setLocalUserInputAnswers({});
			setMessages([]);
			setActiveThreadId(null);
		}
	}, [accountId, projectId, setMessages, scrollToBottom]);

	// New chat should create a real server-side thread, not only clear local UI.
	const handleClearChat = useCallback(() => {
		void createNewThread();
	}, [createNewThread]);

	// Expose clearChat to parent via callback ref
	useEffect(() => {
		onClearChatRef?.(handleClearChat);
		return () => onClearChatRef?.(null);
	}, [onClearChatRef, handleClearChat]);

	// Load a specific thread's messages
	const handleLoadThread = useCallback(
		(threadId: string) => {
			const historyUrl = `/a/${accountId}/${projectId}/api/chat/project-status/history-by-thread?threadId=${encodeURIComponent(threadId)}`;
			fetch(historyUrl)
				.then((res) => res.json())
				.then((data: { threadId?: string; messages?: UpsightMessage[]; error?: string }) => {
					if (data.error) {
						consola.warn("Failed to load thread:", data.error);
						return;
					}
					setLocalUserInputAnswers({});
					setActiveThreadId(data.threadId || threadId);
					if (data.messages) {
						setMessages(data.messages);
						requestAnimationFrame(() => {
							scrollToBottom();
						});
					}
				})
				.catch((err) => {
					consola.error("Failed to load thread:", err);
				});
		},
		[accountId, projectId, setMessages, scrollToBottom]
	);

	// Expose loadThread to parent via callback ref
	useEffect(() => {
		onLoadThreadRef?.(handleLoadThread);
		return () => onLoadThreadRef?.(null);
	}, [onLoadThreadRef, handleLoadThread]);

	const {
		startRecording: startVoiceRecording,
		stopRecording: stopVoiceRecording,
		isRecording: isVoiceRecording,
		isTranscribing,
		error: voiceError,
		isSupported: isVoiceSupported,
	} = useSpeechToText({ onTranscription: handleVoiceTranscription });

	const isBusy = status === "streaming" || status === "submitted";
	const isError = status === "error";
	const awaitingAssistant = isBusy;

	useEffect(() => {
		if (isBusy) {
			setChatErrorMessage(null);
		}
	}, [isBusy]);

	// Map voice states to VoiceButton states
	const voiceButtonState: VoiceButtonState = voiceError
		? "error"
		: isTranscribing
			? "processing"
			: isVoiceRecording
				? "recording"
				: "idle";

	// Voice-only status message (errors and recording state)
	const statusMessage =
		voiceError ||
		(isError ? chatErrorMessage || "Something went wrong. Try again." : isVoiceRecording ? "Recording..." : null);

	const displayableMessages = useMemo(() => {
		if (!messages) return [];
		const lastMessage = messages[messages.length - 1];
		return messages.filter((message) => {
			if (isInternalUiDispatchMessage(message)) return false;
			if (message.role === "tool") {
				return Boolean(extractToolResultText(message));
			}
			if (message.role !== "assistant") return true;
			const hasContent = message.parts?.some(
				(part) =>
					part.type === "text" &&
					typeof part.text === "string" &&
					part.text.trim() !== "" &&
					!isNetworkDebugText(part.text)
			);
			const isLatestAssistantPlaceholder = awaitingAssistant && message === lastMessage;
			return hasContent || isLatestAssistantPlaceholder;
		});
	}, [messages, awaitingAssistant]);

	const visibleMessages = useMemo(() => displayableMessages.slice(-12), [displayableMessages]);

	// Auto-focus the textarea when component mounts
	useEffect(() => {
		if (import.meta.env.DEV) {
			consola.debug("project-status-chat: collapse state changed", {
				isCollapsed,
				embedded: Boolean(embedded),
				pathname: location.pathname,
			});
		}
		if (textareaRef.current && !isCollapsed) {
			textareaRef.current.focus();
		}
		onCollapsedChange?.(isCollapsed);
	}, [embedded, isCollapsed, location.pathname, onCollapsedChange]);

	// State for LLM-generated suggestions (fallback)
	const [generatedSuggestions, setGeneratedSuggestions] = useState<string[]>([]);
	const lastProcessedMessageId = useRef<string | null>(null);
	const lastCreatedTaskIdRef = useRef<string | null>(null);

	// Extract suggestions from assistant's response via tool invocations
	const toolSuggestions = useMemo(() => {
		// Initial suggestions based on project state
		if (displayableMessages.length === 0) {
			// Setup-aware suggestions when on /setup page
			if (location.pathname.endsWith("/setup")) {
				return ["Help me set up this project", "Research my company website", "Define research goals"];
			}

			const interviewMatch = systemContext.match(/Interviews conducted:\s*(\d+)/);
			const evidenceMatch = systemContext.match(/Evidence collected:\s*(\d+)/);
			const insightsMatch = systemContext.match(/Insights generated:\s*(\d+)/);
			const interviews = interviewMatch ? Number.parseInt(interviewMatch[1], 10) : 0;
			const evidence = evidenceMatch ? Number.parseInt(evidenceMatch[1], 10) : 0;
			const insights = insightsMatch ? Number.parseInt(insightsMatch[1], 10) : 0;

			if (interviews === 0 && evidence === 0) {
				return ["Help me set up this project", "Suggest next steps", "What can you do?"];
			}
			if (interviews > 0 && evidence === 0) {
				return ["Analyze my interviews", "Suggest next steps", "Show project status"];
			}
			if (insights > 0) {
				return ["Summarize key findings", "What are the top themes?", "Suggest next steps"];
			}
			return ["Show project status", "Suggest next steps", "Summarize findings"];
		}

		// Find the last assistant message
		const lastAssistantMsg = [...displayableMessages].reverse().find((m) => m.role === "assistant");
		if (!lastAssistantMsg || !lastAssistantMsg.parts) return [];

		// Check for suggestNextSteps tool invocation in parts (AI SDK v5 format)
		for (const part of lastAssistantMsg.parts) {
			const anyPart = part as {
				type: string;
				toolInvocation?: {
					toolName: string;
					state: string;
					args?: Record<string, unknown>;
				};
				toolName?: string;
				state?: string;
				args?: Record<string, unknown>;
			};

			if (anyPart.type === "tool-invocation" || anyPart.toolInvocation) {
				const toolData = anyPart.toolInvocation || anyPart;
				if (toolData.toolName === "suggestNextSteps" && toolData.state === "output-available") {
					const args = toolData.args as { suggestions?: string[] } | undefined;
					if (args?.suggestions && Array.isArray(args.suggestions) && args.suggestions.length > 0) {
						return args.suggestions;
					}
				}
			}
		}

		return [];
	}, [displayableMessages, location.pathname, systemContext]);

	// Fallback: Generate suggestions if no tool calls found
	useEffect(() => {
		if (displayableMessages.length === 0) return;

		const lastMsg = displayableMessages[displayableMessages.length - 1];
		if (!lastMsg || lastMsg.role !== "assistant" || status === "streaming") return;

		// If we already processed this message, skip
		if (lastProcessedMessageId.current === lastMsg.id) return;

		// If we have tool suggestions, use those (clear generated)
		if (toolSuggestions.length > 0) {
			setGeneratedSuggestions([]);
			lastProcessedMessageId.current = lastMsg.id;
			return;
		}

		// Otherwise, generate new ones via API
		lastProcessedMessageId.current = lastMsg.id;

		const lastText =
			lastMsg.parts
				?.filter((p) => p.type === "text")
				.map((p) => p.text)
				.join("\n") || "";
		if (!lastText) return;

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
					setGeneratedSuggestions(data.suggestions);
				}
			})
			.catch((err) => console.error("Failed to generate suggestions:", err));
	}, [displayableMessages, toolSuggestions, status, accountId, projectId, currentPageContext]);

	useEffect(() => {
		const lastMsg = displayableMessages[displayableMessages.length - 1];
		if (!lastMsg) return;
		const taskId = extractToolResultTaskId(lastMsg);
		if (!taskId || lastCreatedTaskIdRef.current === taskId) return;
		lastCreatedTaskIdRef.current = taskId;
		revalidator.revalidate();
	}, [displayableMessages, revalidator]);

	// Revalidate route data after agent tool calls modify server-side data.
	// In AI SDK v5, tool parts have type "tool-{toolName}" (e.g. "tool-update-survey-questions"),
	// NOT "tool-invocation". Multi-step tool calls live on the same assistant message as the
	// final text response, separated by "step-start" parts.
	const prevChatStatusRef = useRef(status);
	const revalidatedToolMsgIdsRef = useRef<Set<string>>(new Set());
	useEffect(() => {
		const wasActive = prevChatStatusRef.current === "streaming" || prevChatStatusRef.current === "submitted";
		prevChatStatusRef.current = status;

		// Only act on transitions TO "ready" (agent turn just finished)
		if (status !== "ready" || !wasActive) return;

		let shouldRevalidate = false;
		for (const msg of messages) {
			if (msg.role !== "assistant" || !msg.parts) continue;
			if (revalidatedToolMsgIdsRef.current.has(msg.id)) continue;

			const hasCompletedTool = msg.parts.some((part) => {
				const p = part as { type: string; state?: string };
				// AI SDK v5: tool parts have type "tool-{toolName}" (starts with "tool-")
				return p.type.startsWith("tool-") && p.state === "output-available";
			});

			if (hasCompletedTool) {
				revalidatedToolMsgIdsRef.current.add(msg.id);
				shouldRevalidate = true;
				const surveyQuestionUpdates = extractSurveyQuestionUpdateDetails(msg);
				for (const update of surveyQuestionUpdates) {
					window.dispatchEvent(
						new CustomEvent("upsight:survey-questions-updated", {
							detail: {
								messageId: msg.id,
								surveyId: update.surveyId,
								action: update.action,
								updatedCount: update.updatedCount,
							},
						})
					);
				}
			}
		}

		if (shouldRevalidate) {
			revalidator.revalidate();
		}
	}, [status, messages, revalidator]);

	// TTS: Auto-play new assistant responses when TTS is enabled
	const lastAutoPlayedMessageIdRef = useRef<string | null>(null);
	useEffect(() => {
		if (!tts.isEnabled || status === "streaming" || status === "submitted") return;
		if (displayableMessages.length === 0) return;

		const lastMsg = displayableMessages[displayableMessages.length - 1];
		if (!lastMsg || lastMsg.role !== "assistant") return;
		if (lastAutoPlayedMessageIdRef.current === lastMsg.id) return;

		const textParts = lastMsg.parts?.filter((p) => p.type === "text").map((p) => p.text) ?? [];
		const text = textParts
			.filter((t) => typeof t === "string" && !isNetworkDebugText(t))
			.join("\n")
			.trim();
		if (!text) return;

		lastAutoPlayedMessageIdRef.current = lastMsg.id;
		tts.playText(text, lastMsg.id);
	}, [tts.isEnabled, status, displayableMessages]); // eslint-disable-line react-hooks/exhaustive-deps

	// TTS: Stop playback when user sends a new message
	const submitMessage = () => {
		const trimmed = input.trim();
		if (!trimmed) return;
		tts.stopPlayback();
		sendMessage({ text: trimmed });
		setInput("");
	};

	const suggestions = toolSuggestions.length > 0 ? toolSuggestions : generatedSuggestions;

	const handleSuggestionClick = useCallback(
		(suggestion: string) => {
			tts.stopPlayback();
			sendMessage({ text: suggestion });
		},
		[sendMessage, tts.stopPlayback] // eslint-disable-line react-hooks/exhaustive-deps
	);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		submitMessage();
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter") {
			if (event.shiftKey) {
				// Shift+Enter: Allow newline
				return;
			}
			// Enter: Submit
			event.preventDefault();
			submitMessage();
		}
	};

	const handleAssistantLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (event.defaultPrevented) return;
		if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
		if (event.button !== 0) return;

		const anchor = (event.target as HTMLElement | null)?.closest?.("a");
		if (!anchor) return;

		const normalized = normalizeInternalPath(anchor.getAttribute("href"));
		if (!normalized) {
			// External links should keep default browser behavior.
			return;
		}

		event.preventDefault();
		const { resolved: normalizedPath } = ensureProjectScopedPath(normalized, accountId, projectId);
		if (!normalizedPath) {
			return;
		}
		// Use { preventScrollReset: true } to avoid scroll jumps and unnecessary re-renders
		navigate(normalizedPath, { preventScrollReset: true });
	};

	const isEmbeddedDark = Boolean(embedded && embeddedTone === "dark");

	// Shared chat content renderer (used by both embedded and card modes)
	const chatContent = (
		<>
			{/* A2UI: On desktop, canvas panel handles rendering — show compact indicator.
           On mobile, render the full widget inline since there's no canvas. */}
			{a2uiSurface?.isActive && a2uiSurface.surface && (
				<div className="mb-3 flex-shrink-0">
					{isMobile ? (
						<A2UIRenderer
							surface={a2uiSurface.surface}
							onAction={handleA2UIAction}
							onDismiss={() => a2uiSurface.dismiss()}
							onToggleCollapse={() => a2uiSurface.toggleCollapse()}
							isCollapsed={a2uiSurface.isCollapsed}
							isStreaming={isBusy}
						/>
					) : (
						<div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs ring-1 ring-primary/20">
							<LayoutDashboard className="h-3.5 w-3.5 text-primary" />
							<span className="flex-1 font-medium text-primary">Showing on canvas</span>
							<button
								type="button"
								onClick={() => a2uiSurface.dismiss()}
								className="rounded p-0.5 text-primary/60 hover:text-primary"
								title="Dismiss widget"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</div>
					)}
				</div>
			)}
			<div className="min-h-0 flex-1 overflow-hidden">
				{visibleMessages.length === 0 ? (
					<div
						className={cn(
							"flex flex-row gap-2 text-xs sm:text-sm",
							embedded ? (isEmbeddedDark ? "text-slate-400" : "text-muted-foreground") : "text-foreground/70"
						)}
					>
						<Bot />
						Hey, how can I help?
					</div>
				) : (
					<div ref={scrollRef} className="h-full overflow-y-auto text-xs sm:text-sm">
						<div ref={contentRef} className="space-y-3">
							{visibleMessages.map((message, index) => {
								const key = message.id || `${message.role}-${index}`;
								const isUser = message.role === "user";
								const isTool = message.role === "tool";
								const textParts = message.parts?.filter((part) => part.type === "text").map((part) => part.text) ?? [];
								const filteredTextParts = textParts.filter(
									(part) => typeof part === "string" && !isNetworkDebugText(part)
								);
								const messageText =
									(isTool ? extractToolResultText(message) : null) ||
									filteredTextParts.filter(Boolean).join("\n").trim();
								const userInputPayloads = extractUserInputPayloads(message);
								const suggestActionsPayload = extractSuggestActionsPayload(message);
								const showProgressPayload = extractShowProgressPayload(message);
								const welcomePayload = extractWelcomePayload(message);
								const celebrationPayload = extractCelebrationPayload(message);
								const networkSteps = extractNetworkSteps(message);
								const isAssistant = !isUser && !isTool;
								const isThisMessagePlaying = tts.playingMessageId === message.id;
								return (
									<div key={key} className={`group relative flex ${isUser ? "justify-end" : "justify-start"}`}>
										<div className="max-w-[85%]">
											<div
												className={cn(
													"mb-1 text-[10px] uppercase tracking-wide",
													embedded
														? isEmbeddedDark
															? "text-slate-500"
															: "text-muted-foreground/80"
														: "text-foreground/60"
												)}
											>
												{isUser ? "You" : "Uppy Assistant"}
											</div>
											<div
												className={cn(
													"whitespace-pre-wrap rounded-lg px-3 py-2 shadow-sm",
													isUser
														? "bg-blue-600 text-white"
														: embedded
															? isEmbeddedDark
																? "bg-slate-700/50 text-slate-200 ring-1 ring-white/[0.06]"
																: "bg-muted/70 text-foreground ring-1 ring-border/60"
															: "bg-background text-foreground ring-1 ring-border/60",
													isThisMessagePlaying &&
														(embedded ? (isEmbeddedDark ? "ring-blue-500/30" : "ring-blue-300/60") : "ring-blue-300")
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
																{networkSteps.map((step) => {
																	const label = formatNetworkStepLabel(step.name);
																	const status = step.status || "running";
																	const statusLabel = status === "running" ? "running" : "done";
																	return (
																		<div key={`${step.name ?? label}-${status}`} className="flex items-center gap-2">
																			<span className="font-medium">{label}</span>
																			<span className="text-foreground/50">{statusLabel}</span>
																		</div>
																	);
																})}
															</div>
														)}
													</div>
												) : (
													<span className="text-foreground/70">(No text response)</span>
												)}
												{!isUser && userInputPayloads.length > 0 && (
													<div className="mt-2 space-y-2">
														{userInputPayloads.map((payload) => {
															const payloadKey = buildUserInputPayloadKey(payload);
															const answer = userInputAnswers[payloadKey] ?? userInputAnswers[payload.prompt];
															const answerHasSelection =
																answer && (answer.selectedIds.length > 0 || Boolean(answer.freeText));
															return (
																<div
																	key={`${key}-user-input-${payloadKey}`}
																	className="rounded-md border border-border/60 bg-muted/20 p-2"
																>
																	<InlineUserInput
																		prompt={payload.prompt}
																		options={payload.options}
																		selectionMode={payload.selectionMode}
																		allowFreeText={payload.allowFreeText}
																		answered={Boolean(answerHasSelection)}
																		answeredIds={answer?.selectedIds ?? []}
																		onSubmit={(selectedIds, freeText) =>
																			handleInlineUserInputSubmit(payload, payloadKey, selectedIds, freeText)
																		}
																	/>
																	{answer?.freeText && (
																		<p className="mt-2 text-muted-foreground text-xs">Response: {answer.freeText}</p>
																	)}
																</div>
															);
														})}
													</div>
												)}
												{!isUser && suggestActionsPayload && (
													<>
														{suggestActionsPayload.badges.length > 0 && (
															<SuggestionBadges
																badges={suggestActionsPayload.badges}
																disabled={usedSuggestActionMessageIds.has(message.id)}
																onSendMessage={(text) => {
																	setUsedSuggestActionMessageIds((prev) => new Set([...prev, message.id]));
																	tts.stopPlayback();
																	sendMessage({ text });
																}}
																onNavigate={(path) => {
																	setUsedSuggestActionMessageIds((prev) => new Set([...prev, message.id]));
																	const { resolved } = ensureProjectScopedPath(path, accountId, projectId);
																	if (resolved) navigate(resolved);
																}}
															/>
														)}
														{suggestActionsPayload.card && (
															<ActionSuggestionCard
																icon={suggestActionsPayload.card.icon}
																title={suggestActionsPayload.card.title}
																description={suggestActionsPayload.card.description}
																ctaLabel={suggestActionsPayload.card.ctaLabel}
																action={suggestActionsPayload.card.action}
																message={suggestActionsPayload.card.message}
																path={suggestActionsPayload.card.path}
																skipLabel={suggestActionsPayload.card.skipLabel}
																dismissed={usedSuggestActionMessageIds.has(message.id)}
																onSendMessage={(text) => {
																	tts.stopPlayback();
																	sendMessage({ text });
																}}
																onNavigate={(path) => {
																	const { resolved } = ensureProjectScopedPath(path, accountId, projectId);
																	if (resolved) navigate(resolved);
																}}
																onDismiss={() =>
																	setUsedSuggestActionMessageIds((prev) => new Set([...prev, message.id]))
																}
															/>
														)}
													</>
												)}
												{!isUser && showProgressPayload && (
													<ProgressCard
														title={showProgressPayload.title}
														steps={showProgressPayload.steps}
														progressPercent={showProgressPayload.progressPercent}
														isStreaming={isBusy}
													/>
												)}
												{!isUser && welcomePayload && (
													<WelcomeBackCard
														datestamp={welcomePayload.datestamp}
														changes={welcomePayload.changes}
														badges={welcomePayload.badges}
														disabled={usedSuggestActionMessageIds.has(message.id)}
														onSendMessage={(text) => {
															setUsedSuggestActionMessageIds((prev) => new Set([...prev, message.id]));
															tts.stopPlayback();
															sendMessage({ text });
														}}
														onNavigate={(path) => {
															setUsedSuggestActionMessageIds((prev) => new Set([...prev, message.id]));
															const { resolved } = ensureProjectScopedPath(path, accountId, projectId);
															if (resolved) navigate(resolved);
														}}
													/>
												)}
												{!isUser && celebrationPayload && (
													<CelebrationCard
														milestone={celebrationPayload.milestone}
														description={celebrationPayload.description}
														icon={celebrationPayload.icon}
														ctaLabel={celebrationPayload.ctaLabel}
														ctaAction={celebrationPayload.ctaAction}
														ctaMessage={celebrationPayload.ctaMessage}
														ctaPath={celebrationPayload.ctaPath}
														dismissed={dismissedCelebrationMessageIds.has(message.id)}
														onSendMessage={(text) => {
															tts.stopPlayback();
															sendMessage({ text });
														}}
														onNavigate={(path) => {
															const { resolved } = ensureProjectScopedPath(path, accountId, projectId);
															if (resolved) navigate(resolved);
														}}
														onDismiss={() =>
															setDismissedCelebrationMessageIds((prev) => new Set([...prev, message.id]))
														}
													/>
												)}
											</div>
										</div>
										{/* Per-message TTS play button (assistant messages with text only) */}
										{isAssistant && messageText && (
											<div className="-right-1 absolute top-5">
												<MessagePlayButton
													isPlaying={isThisMessagePlaying}
													onPlay={() => tts.playText(messageText, message.id)}
													onStop={() => tts.stopPlayback()}
													variant={embedded ? (isEmbeddedDark ? "dark" : "light") : "light"}
												/>
											</div>
										)}
									</div>
								);
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
				<form onSubmit={handleSubmit}>
					<div className="relative">
						<Textarea
							ref={textareaRef}
							value={input}
							onChange={(event) => setInput(event.currentTarget.value)}
							onKeyDown={handleKeyDown}
							placeholder="Ask Uppy anything..."
							rows={2}
							disabled={isBusy}
							className={cn(
								"min-h-[60px] resize-none rounded-xl pr-20 pl-10 shadow-sm focus-visible:ring-1",
								embedded
									? isEmbeddedDark
										? "border border-white/10 bg-slate-700/60 text-slate-100 placeholder:text-slate-400 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
										: "border border-border/70 bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-primary/20"
									: "border-2 border-border bg-white focus-visible:border-primary focus-visible:ring-primary/30 dark:bg-zinc-900"
							)}
						/>
						<FileUploadButton
							onFileContent={handleFileUpload}
							disabled={isBusy}
							className="absolute bottom-2 left-2 h-7 w-7"
						/>
						<div className="absolute right-2 bottom-2 flex items-center gap-1">
							{isVoiceSupported && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<VoiceButton
												state={voiceButtonState}
												onPress={() => {
													if (isVoiceRecording) {
														stopVoiceRecording();
													} else {
														startVoiceRecording();
													}
												}}
												icon={<Mic className="h-4 w-4" />}
												size="icon"
												variant="ghost"
												disabled={isTranscribing}
												className="h-7 w-7"
											/>
										</TooltipTrigger>
										<TooltipContent>
											<p>Voice input</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
							{isBusy ? (
								<button
									type="button"
									onClick={stop}
									className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm hover:bg-red-700"
									title="Stop"
								>
									<Square className="h-3.5 w-3.5" />
								</button>
							) : (
								<button
									type="submit"
									disabled={!input.trim()}
									className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
									title="Send"
								>
									<Send className="h-3.5 w-3.5" />
								</button>
							)}
						</div>
					</div>
					{(statusMessage || isVoiceEnabled) && (
						<div className="mt-1.5 flex items-center gap-2">
							{statusMessage && (
								<span className="text-muted-foreground text-xs" aria-live="polite">
									{statusMessage}
								</span>
							)}
							{isVoiceEnabled && (
								<div className="ml-auto">
									<ProjectStatusVoiceChat accountId={accountId} projectId={projectId} />
								</div>
							)}
						</div>
					)}
				</form>
			</div>
		</>
	);

	// Embedded mode: no Card chrome, just chat content filling the parent container
	// Uses dark-aware styling for the floating panel
	if (embedded) {
		return <div className="flex h-full flex-col overflow-hidden p-3">{chatContent}</div>;
	}

	// Standalone mode: full Card with header and collapse/expand
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
							<div className="flex items-center gap-2">
								<CardTitle
									onClick={() => setIsCollapsed(!isCollapsed)}
									className="flex cursor-pointer items-center gap-2 text-base transition-opacity hover:opacity-80 sm:text-lg"
									role="button"
									tabIndex={0}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setIsCollapsed(!isCollapsed);
										}
									}}
									aria-label="Toggle chat"
								>
									<WizardIcon className="h-8 w-8 border-0 bg-transparent p-0 text-blue-600" />
									Ask Uppy
								</CardTitle>
								<TTSToggle
									isEnabled={tts.isEnabled}
									isPlaying={tts.isPlaying}
									isDisabledByVoiceChat={tts.isDisabledByVoiceChat}
									onToggle={tts.toggleEnabled}
									variant="light"
								/>
							</div>
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
										e.preventDefault();
										setIsCollapsed(!isCollapsed);
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
														e.preventDefault();
														handleClearChat();
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
											e.preventDefault();
											setIsCollapsed(!isCollapsed);
										}
									}}
								>
									<ChevronRight className="h-4 w-4" />
								</div>
							</div>
						)}
					</div>
				</CardHeader>
				{!isCollapsed && <CardContent className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">{chatContent}</CardContent>}
			</Card>
		</div>
	);
}

interface ViewContextArgs {
	pathname: string;
	search: string;
	accountId: string;
	projectId: string;
}

function describeCurrentProjectView({ pathname, search, accountId, projectId }: ViewContextArgs): string {
	if (!pathname) return "";
	const segments = pathname.split("/").filter(Boolean);
	const isProjectScoped = segments[0] === "a" && segments.length >= 3;
	const contextLines: string[] = [`Route: ${pathname}`];
	if (isProjectScoped) {
		const [, accountSegment, projectSegment, ...rest] = segments;
		const accountMatch = accountSegment || accountId;
		const projectMatch = projectSegment || projectId;
		if (accountMatch) {
			contextLines.push(`Account: ${accountMatch}`);
		}
		if (projectMatch) {
			contextLines.push(`Project: ${projectMatch}`);
		}
		if (rest.length > 0) {
			const resource = rest[0];
			const remainder = rest.slice(1);
			contextLines.push(describeResourceContext(resource, remainder));
		} else {
			contextLines.push("View: Project overview");
		}
	} else {
		contextLines.push("View: Outside project scope");
	}
	if (search) {
		contextLines.push(`Query: ${search}`);
	}
	return contextLines.filter(Boolean).join("\n");
}

function describeResourceContext(resource: string, remainder: string[]): string {
	const id = remainder[0];
	switch (resource) {
		case "interviews":
			if (!id) return "View: Interviews workspace";
			if (id === "new") return "View: Create interview";
			return `View: Interview detail (id=${id})`;
		case "people":
			if (!id) return "View: People directory";
			if (id === "new") return "View: Add person";
			return `View: Person profile (id=${id})`;
		case "opportunities":
			if (!id) return "View: Opportunities pipeline";
			if (id === "new") return "View: New opportunity";
			return `View: Opportunity detail (id=${id})`;
		case "themes":
			if (!id) return "View: Themes overview";
			return `View: Theme detail (id=${id})`;
		case "evidence":
			if (!id) return "View: Evidence library";
			return `View: Evidence detail (id=${id})`;
		case "insights":
			if (!id) return "View: Insights workspace";
			return `View: Insight detail (id=${id})`;
		case "segments":
			if (!id) return "View: Segment index";
			return `View: Segment detail (id=${id})`;
		case "personas":
			if (!id) return "View: Personas overview";
			return `View: Persona detail (id=${id})`;
		case "ask": {
			if (!id) return "View: Surveys list (Ask Links)";
			if (id === "new") return "View: Creating new survey";
			const subpage = remainder[1];
			if (subpage === "edit") return `View: Survey editor (surveyId=${id}, editing questions & settings)`;
			if (subpage === "responses") {
				const responseId = remainder[2];
				if (responseId) return `View: Survey response detail (surveyId=${id}, responseId=${responseId})`;
				return `View: Survey responses (surveyId=${id})`;
			}
			return `View: Survey detail (surveyId=${id})`;
		}
		case "product-lens":
			return "View: Product Lens (pain × user matrix)";
		case "bant-lens":
			return "View: BANT Lens (budget × authority)";
		case "dashboard":
			return "View: Project dashboard";
		case "project-status":
			return "View: Project status summary";
		default:
			if (resource) {
				return `View: ${resource.replace(/-/g, " ")}${id ? ` (context=${id})` : ""}`;
			}
			return "View: Project content";
	}
}
