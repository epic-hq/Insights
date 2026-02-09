import { handleChatStream, handleNetworkStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/di";
import { createUIMessageStream, createUIMessageStreamResponse, generateObject } from "ai";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import {
	clearActiveBillingContext,
	estimateOpenAICost,
	openai as instrumentedOpenai,
	setActiveBillingContext,
	userBillingContext,
} from "~/lib/billing/instrumented-openai.server";
import { recordUsageOnly } from "~/lib/billing/usage.server";
import { getLangfuseClient } from "~/lib/langfuse.server";
import { mastra } from "~/mastra";
import { memory } from "~/mastra/memory";
import { resolveAccountIdFromProject } from "~/mastra/tools/context-utils";
import { navigateToPageTool } from "~/mastra/tools/navigate-to-page";
import { switchAgentTool } from "~/mastra/tools/switch-agent";
import { userContext } from "~/server/user-context";

function getLastUserText(messages: Array<{ role?: string; content?: unknown; parts?: unknown[] }>): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role !== "user") continue;
		if (typeof message.content === "string") return message.content;
		if (Array.isArray(message.parts)) {
			const textPart = message.parts.find((part) => (part as { type?: string })?.type === "text") as
				| { text?: unknown }
				| undefined;
			if (textPart && typeof textPart.text === "string") return textPart.text;
		}
	}
	return "";
}

const routingTargetAgents = ["projectStatusAgent", "chiefOfStaffAgent", "researchAgent", "projectSetupAgent"] as const;
type RoutingTargetAgent = (typeof routingTargetAgents)[number];
type RoutingResponseMode = "normal" | "fast_standardized" | "theme_people_snapshot" | "survey_quick_create";

const intentRoutingSchema = z.object({
	targetAgentId: z.enum(routingTargetAgents),
	confidence: z.number().min(0).max(1),
	responseMode: z
		.enum(["normal", "fast_standardized", "theme_people_snapshot", "survey_quick_create"])
		.default("normal" satisfies RoutingResponseMode),
	rationale: z.string().max(240).optional(),
});

const ROUTING_CONFIDENCE_THRESHOLD = 0.68;
const FAST_STANDARDIZED_MAX_STEPS = 2;
const FAST_STANDARDIZED_CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_SYSTEM_CONTEXT_CHARS = 3000;
const MAX_FAST_SYSTEM_CONTEXT_CHARS = 800;
const DEBUG_PREFIX_REGEX = /^\s*\/debug\b[:\s-]*/i;
const FALLBACK_EMPTY_RESPONSE_TEXT = "Sorry, I couldn't answer that just now. Please try again.";
const MARKDOWN_LINK_REGEX = /\[[^\]]+\]\((?:\/|https?:\/\/|#|mailto:)[^)]+\)/;

const MAX_STEPS_BY_AGENT: Record<RoutingTargetAgent, number> = {
	projectStatusAgent: 6,
	chiefOfStaffAgent: 4,
	researchAgent: 5,
	projectSetupAgent: 5,
};

const BILLING_MODEL_BY_AGENT: Record<RoutingTargetAgent, string> = {
	projectStatusAgent: "gpt-4.1",
	chiefOfStaffAgent: "gpt-4o-mini",
	researchAgent: "gpt-4o",
	projectSetupAgent: "gpt-5.1",
};

type FastGuidanceCacheEntry = {
	text: string;
	expiresAt: number;
};

const fastGuidanceCache = new Map<string, FastGuidanceCacheEntry>();

/**
 * Sticky routing: remembers the last agent routed per resource so follow-up
 * messages in an ongoing conversation stay with the same agent (e.g., a user
 * answering a projectSetupAgent question doesn't get re-routed to chiefOfStaff).
 */
type StickyRoutingEntry = { agentId: RoutingTargetAgent; timestamp: number };
const lastRoutedAgentMap = new Map<string, StickyRoutingEntry>();
const STICKY_ROUTING_TTL_MS = 10 * 60 * 1000; // 10 minutes

function hashString(input: string): string {
	let hash = 2166136261;
	for (let index = 0; index < input.length; index += 1) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16);
}

function streamPlainAssistantText(text: string) {
	return createUIMessageStream({
		execute: async ({ writer }) => {
			const messageChunkId = `cached-${Date.now().toString(36)}`;
			writer.write({ type: "start" });
			writer.write({ type: "start-step" });
			writer.write({ type: "text-start", id: messageChunkId });
			writer.write({ type: "text-delta", id: messageChunkId, delta: text });
			writer.write({ type: "text-end", id: messageChunkId });
			writer.write({ type: "finish-step" });
			writer.write({ type: "finish", finishReason: "stop" });
		},
	});
}

function stripDebugPrefix(prompt: string): string {
	const stripped = prompt.replace(DEBUG_PREFIX_REGEX, "").trim();
	return stripped.length > 0 ? stripped : "what should I do next";
}

function normalizeMessagesForExecution(
	messages: Array<{ role?: string; content?: unknown; parts?: unknown[] }>,
	debugRequested: boolean
) {
	if (!debugRequested) return messages;

	let cleanedFirstUserMessage = false;
	return messages.map((message) => {
		if (!message || message.role !== "user" || cleanedFirstUserMessage) return message;

		if (typeof message.content === "string") {
			cleanedFirstUserMessage = true;
			return {
				...message,
				content: stripDebugPrefix(message.content),
			};
		}

		if (Array.isArray(message.parts)) {
			const parts = message.parts.map((part) => {
				if (!part || typeof part !== "object") return part;
				if ((part as { type?: string }).type !== "text") return part;
				const text = (part as { text?: unknown }).text;
				if (typeof text !== "string") return part;
				if (cleanedFirstUserMessage) return part;
				cleanedFirstUserMessage = true;
				return {
					...part,
					text: stripDebugPrefix(text),
				};
			});

			return {
				...message,
				parts,
			};
		}

		return message;
	});
}

export function buildQuickLinksMarkdown(options: {
	accountId: string;
	projectId: string;
	lastUserText: string;
	targetAgentId: RoutingTargetAgent;
}) {
	const { accountId, projectId, lastUserText, targetAgentId } = options;
	if (!accountId || !projectId) return "";

	const base = `/a/${accountId}/${projectId}`;
	const normalizedPrompt = lastUserText.toLowerCase();
	const mentionsPeople = /\b(people|person|contact|contacts|icp)\b/.test(normalizedPrompt);
	const mentionsSurvey = /\b(survey|ask link|ask|questionnaire|responses?)\b/.test(normalizedPrompt);
	const mentionsThemes = /\b(theme|insight|insights|evidence)\b/.test(normalizedPrompt);

	const links: string[] = [];
	if (mentionsPeople) links.push(`[People](${base}/lenses?tab=people)`);
	if (mentionsSurvey || targetAgentId === "researchAgent") links.push(`[Ask](${base}/ask)`);
	if (mentionsThemes || targetAgentId === "projectStatusAgent") links.push(`[Insights](${base}/insights/table)`);

	if (links.length === 0) {
		links.push(`[Insights](${base}/insights/table)`);
		links.push(`[People](${base}/lenses?tab=people)`);
	}

	return `Quick links: ${links.join(" · ")}`;
}

type StreamLike = ReadableStream<Record<string, unknown>>;

function augmentStreamForReliability(
	stream: Awaited<ReturnType<typeof handleNetworkStream>> | Awaited<ReturnType<typeof handleChatStream>>,
	options: {
		debugRequested: boolean;
		targetAgentId: RoutingTargetAgent;
		targetMaxSteps: number;
		responseMode: RoutingResponseMode;
		accountId: string;
		projectId: string;
		lastUserText: string;
	}
) {
	if (!stream || typeof (stream as { pipeThrough?: unknown }).pipeThrough !== "function") {
		return stream;
	}

	const toolCalls: string[] = [];
	let sawTextDelta = false;
	let injectedSafetyMessage = false;
	let appendedDebugTrace = false;
	let appendedQuickLinks = false;
	let sawFinishChunk = false;
	let accumulatedAssistantText = "";

	const enqueueAssistantText = (
		controller: TransformStreamDefaultController<Record<string, unknown>>,
		text: string,
		idPrefix: string
	) => {
		const clean = text.trim();
		if (!clean) return;
		const id = `${idPrefix}-${Date.now().toString(36)}`;
		controller.enqueue({ type: "start-step" });
		controller.enqueue({ type: "text-start", id });
		controller.enqueue({ type: "text-delta", id, delta: clean });
		controller.enqueue({ type: "text-end", id });
		controller.enqueue({ type: "finish-step" });
	};

	const maybeEnqueueSafetyMessage = (controller: TransformStreamDefaultController<Record<string, unknown>>) => {
		if (!sawTextDelta && !injectedSafetyMessage) {
			enqueueAssistantText(controller, FALLBACK_EMPTY_RESPONSE_TEXT, "fallback");
			injectedSafetyMessage = true;
		}
	};

	const maybeEnqueueDebugTrace = (controller: TransformStreamDefaultController<Record<string, unknown>>) => {
		if (!options.debugRequested || appendedDebugTrace) return;
		const uniqueTools = Array.from(new Set(toolCalls));
		const debugText = [
			"",
			"Debug Trace:",
			`- routed_to: ${options.targetAgentId}`,
			`- response_mode: ${options.responseMode}`,
			`- max_steps: ${options.targetMaxSteps}`,
			`- tool_calls: ${uniqueTools.length > 0 ? uniqueTools.join(", ") : "none"}`,
		].join("\n");
		enqueueAssistantText(controller, debugText, "debug");
		appendedDebugTrace = true;
	};

	const maybeEnqueueQuickLinks = (controller: TransformStreamDefaultController<Record<string, unknown>>) => {
		if (appendedQuickLinks) return;
		if (!sawTextDelta) return;
		if (MARKDOWN_LINK_REGEX.test(accumulatedAssistantText)) return;
		const quickLinks = buildQuickLinksMarkdown({
			accountId: options.accountId,
			projectId: options.projectId,
			lastUserText: options.lastUserText,
			targetAgentId: options.targetAgentId,
		});
		if (!quickLinks) return;
		enqueueAssistantText(controller, quickLinks, "links");
		appendedQuickLinks = true;
	};

	const transformed = (stream as StreamLike).pipeThrough(
		new TransformStream<Record<string, unknown>, Record<string, unknown>>({
			transform(chunk, controller) {
				if (chunk?.type === "text-delta" && typeof chunk.delta === "string" && chunk.delta.trim().length > 0) {
					sawTextDelta = true;
					accumulatedAssistantText += chunk.delta;
				}

				if (chunk?.type === "tool-input-available" && typeof chunk.toolName === "string") {
					toolCalls.push(chunk.toolName);
				}

				if (chunk?.type === "error") {
					maybeEnqueueSafetyMessage(controller);
				}

				if (chunk?.type === "finish") {
					sawFinishChunk = true;
					maybeEnqueueSafetyMessage(controller);
					maybeEnqueueQuickLinks(controller);
					maybeEnqueueDebugTrace(controller);
				}

				controller.enqueue(chunk);
			},
			flush(controller) {
				maybeEnqueueSafetyMessage(controller);
				maybeEnqueueQuickLinks(controller);
				maybeEnqueueDebugTrace(controller);
				if (!sawFinishChunk) {
					controller.enqueue({ type: "finish", finishReason: "stop" });
				}
			},
		})
	);

	return transformed;
}

function routeByDeterministicPrompt(lastUserText: string): z.infer<typeof intentRoutingSchema> | null {
	const prompt = lastUserText.trim().toLowerCase();
	if (!prompt) return null;

	const asksForStandardNextStep =
		prompt === "what should i do next" ||
		prompt === "what should i do next?" ||
		prompt === "what do i do next" ||
		prompt === "what do i do next?";
	if (asksForStandardNextStep) {
		return {
			targetAgentId: "chiefOfStaffAgent",
			confidence: 1,
			responseMode: "fast_standardized",
			rationale: "deterministic routing for canonical next-step prompt",
		};
	}

	return null;
}

async function routeAgentByIntent(
	lastUserText: string,
	resourceId?: string
): Promise<z.infer<typeof intentRoutingSchema> | null> {
	const prompt = lastUserText.trim();
	if (!prompt) return null;

	const deterministicRoute = routeByDeterministicPrompt(prompt);
	if (deterministicRoute) return deterministicRoute;

	// Sticky routing: if the last routed agent was projectSetupAgent and no
	// deterministic rule explicitly matched a different agent, keep routing to
	// projectSetupAgent. This prevents follow-up answers (e.g. "buyer dynamics
	// inside companies") from being misrouted by the LLM to chiefOfStaffAgent.
	if (resourceId) {
		const sticky = lastRoutedAgentMap.get(resourceId);
		if (sticky && sticky.agentId === "projectSetupAgent" && Date.now() - sticky.timestamp < STICKY_ROUTING_TTL_MS) {
			return {
				targetAgentId: "projectSetupAgent",
				confidence: 0.95,
				responseMode: "normal",
				rationale: "sticky routing — continuing projectSetupAgent conversation",
			};
		}
	}

	try {
		const result = await generateObject({
			model: instrumentedOpenai("gpt-4o-mini"),
			schema: intentRoutingSchema,
			temperature: 0,
			prompt: `Classify this user message for agent routing.

Choose exactly one target:
- projectSetupAgent: onboarding, setup, research goals, company context capture.
- chiefOfStaffAgent: strategic guidance and prioritization only (for "what should I do next", sequencing, focus).
- researchAgent: creating/managing surveys, interview prompts, interview operations.
- projectStatusAgent: data lookups and factual status questions (themes, ICP counts/distribution, people, evidence, interviews).

Set responseMode="fast_standardized" only when the user asks broad strategic guidance without asking for execution details.
Use responseMode="normal" for all other requests.
Message: """${prompt.slice(0, 1200)}"""`,
		});
		return result.object;
	} catch (error) {
		consola.warn("project-status: intent routing failed, falling back to projectStatusAgent", {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const ctx = context.get(userContext);
	const projectId = String(params.projectId || "");
	// IMPORTANT: Resolve account_id from project, not URL params or session
	// This prevents data being created with wrong account when user has multiple accounts
	const fallbackAccountId = String(params.accountId || ctx?.account_id || "");
	const accountId = await resolveAccountIdFromProject(projectId, "api.chat.project-status", fallbackAccountId);
	const userId = ctx?.claims?.sub || "";

	if (!projectId) {
		consola.warn("project-status: missing projectId");
		return new Response(JSON.stringify({ error: "Missing projectId" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { messages, system, userTimezone } = await request.json();
	const sanitizedMessages = Array.isArray(messages)
		? messages.map((message) => {
				if (!message || typeof message !== "object") return message;
				const cloned = { ...message };
				if ("id" in cloned) {
					delete (cloned as Record<string, unknown>).id;
				}
				return cloned;
			})
		: [];

	// Validate that we have at least one user message
	const hasUserMessage = sanitizedMessages.some(
		(message: { role?: string }) => message && typeof message === "object" && message.role === "user"
	);

	if (!hasUserMessage) {
		consola.warn("project-status: missing user message");
		return new Response(JSON.stringify({ error: "Missing user prompt" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Only pass NEW messages to the agent - Mastra's memory handles historical context.
	// This prevents duplicate messages when both client history and memory are present.
	// We look for the last user message and include it (the new turn).
	const lastUserIndex = sanitizedMessages.findLastIndex((m: { role?: string }) => m?.role === "user");

	// If we have a user message, start from there. Otherwise use all messages.
	// This ensures we always send at least the new user message to the agent.
	const runtimeMessages = lastUserIndex >= 0 ? sanitizedMessages.slice(lastUserIndex) : sanitizedMessages;

	const lastUserTextRaw = getLastUserText(sanitizedMessages);
	const debugRequested = DEBUG_PREFIX_REGEX.test(lastUserTextRaw);
	const lastUserText = debugRequested ? stripDebugPrefix(lastUserTextRaw) : lastUserTextRaw;
	const runtimeMessagesForExecution = normalizeMessagesForExecution(runtimeMessages, debugRequested);
	const resourceId = `projectStatusAgent-${userId}-${projectId}`;
	const routeDecision = await routeAgentByIntent(lastUserText, resourceId);
	const rawResponseMode: RoutingResponseMode =
		(routeDecision?.responseMode as RoutingResponseMode | undefined) ?? "normal";
	const resolvedResponseMode: RoutingResponseMode =
		rawResponseMode === "fast_standardized" ? "fast_standardized" : "normal";
	const targetAgentId: RoutingTargetAgent =
		routeDecision && routeDecision.confidence >= ROUTING_CONFIDENCE_THRESHOLD
			? routeDecision.targetAgentId
			: "projectStatusAgent";
	const isFastStandardized = targetAgentId === "chiefOfStaffAgent" && resolvedResponseMode === "fast_standardized";
	const targetMaxSteps = isFastStandardized
		? Math.min(MAX_STEPS_BY_AGENT[targetAgentId], FAST_STANDARDIZED_MAX_STEPS)
		: MAX_STEPS_BY_AGENT[targetAgentId];
	const systemContext =
		typeof system === "string"
			? system.slice(0, isFastStandardized ? MAX_FAST_SYSTEM_CONTEXT_CHARS : MAX_SYSTEM_CONTEXT_CHARS)
			: "";

	if (typeof system === "string" && system.length > systemContext.length) {
		consola.debug("project-status: truncated system context", {
			originalLength: system.length,
			truncatedLength: systemContext.length,
			isFastStandardized,
		});
	}

	// Store routing decision for sticky routing
	lastRoutedAgentMap.set(resourceId, {
		agentId: targetAgentId,
		timestamp: Date.now(),
	});

	consola.info("project-status: intent routing", {
		targetAgentId,
		targetMaxSteps,
		isFastStandardized,
		routingConfidence: routeDecision?.confidence ?? null,
		responseMode: resolvedResponseMode,
		rawResponseMode,
		rationale: routeDecision?.rationale ?? null,
	});

	const threads = await memory.listThreadsByResourceId({
		resourceId,
		orderBy: { field: "createdAt", direction: "DESC" },
		page: 0,
		perPage: 1,
	});

	let threadId = "";
	if (!(threads?.total && threads.total > 0)) {
		const newThread = await memory.createThread({
			resourceId,
			title: `Project Status ${projectId}`,
			metadata: {
				user_id: userId,
				project_id: projectId,
				account_id: accountId,
			},
		});
		threadId = newThread.id;
	} else {
		threadId = threads.threads[0].id;
	}

	const requestContext = new RequestContext();
	requestContext.set("user_id", userId);
	requestContext.set("account_id", accountId);
	requestContext.set("project_id", projectId);
	if (userTimezone) {
		requestContext.set("user_timezone", userTimezone);
	}
	requestContext.set("response_mode", resolvedResponseMode);
	if (debugRequested) {
		requestContext.set("debug_mode", true);
	}

	const fastGuidanceCacheKey =
		isFastStandardized && !debugRequested
			? `${projectId}:${hashString(lastUserText.trim().toLowerCase())}:${hashString(systemContext)}`
			: null;

	if (fastGuidanceCacheKey) {
		const cached = fastGuidanceCache.get(fastGuidanceCacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			consola.info("project-status: fast standardized cache hit", {
				targetAgentId,
				projectId,
			});
			return createUIMessageStreamResponse({
				stream: streamPlainAssistantText(cached.text),
			});
		}
		if (cached) {
			fastGuidanceCache.delete(fastGuidanceCacheKey);
		}
	}

	// Set up billing context for agent LLM calls
	const billingCtx = userBillingContext({
		accountId,
		userId,
		featureSource: "project_status_agent",
		projectId,
	});
	setActiveBillingContext(billingCtx, `agent:project-status:${userId}:${projectId}`);

	// Helper to handle corrupted thread recovery
	const handleCorruptedThread = async (corruptedThreadId: string, errorMessage: string) => {
		consola.warn("project-status: Corrupted thread detected, deleting and creating fresh", {
			corruptedThreadId,
			error: errorMessage,
		});

		// Delete the corrupted thread so it doesn't get picked up again
		try {
			await memory.deleteThread(corruptedThreadId);
		} catch (deleteError) {
			consola.error("project-status: failed to delete corrupted thread", {
				deleteError,
			});
		}

		// Create a fresh thread
		const freshThread = await memory.createThread({
			resourceId,
			title: `Project Status ${projectId}`,
			metadata: {
				user_id: userId,
				project_id: projectId,
				account_id: accountId,
			},
		});
		return freshThread.id;
	};

	const buildAgentParams = (useThreadId: string) => ({
		messages: runtimeMessagesForExecution,
		maxSteps: targetMaxSteps,
		clientTools: {
			navigateToPage: navigateToPageTool,
			switchAgent: switchAgentTool,
		},
		memory: {
			thread: useThreadId,
			resource: resourceId,
		},
		requestContext,
		context: [
			...(system
				? ([
						{
							role: "system" as const,
							content: `## Context from the client's UI:\n${systemContext}`,
						},
					] as const)
				: []),
			...(debugRequested
				? ([
						{
							role: "system" as const,
							content:
								'DEBUG MODE: Answer normally first. Then append a brief "Debug Trace" listing tools called and why.',
						},
					] as const)
				: []),
		],
		onFinish: async (data: {
			usage?: { inputTokens?: number; outputTokens?: number };
			finishReason?: string;
			toolCalls?: unknown[];
			text?: string;
			steps?: unknown[];
		}) => {
			if (isFastStandardized && !debugRequested && fastGuidanceCacheKey && data.text?.trim()) {
				fastGuidanceCache.set(fastGuidanceCacheKey, {
					text: data.text.trim(),
					expiresAt: Date.now() + FAST_STANDARDIZED_CACHE_TTL_MS,
				});
			}

			const usage = data.usage;
			if (usage && (usage.inputTokens || usage.outputTokens) && billingCtx.accountId) {
				const model = BILLING_MODEL_BY_AGENT[targetAgentId] || "gpt-4o";
				const inputTokens = usage.inputTokens || 0;
				const outputTokens = usage.outputTokens || 0;
				const costUsd = estimateOpenAICost(model, inputTokens, outputTokens);

				consola.info("project-status: billing", {
					inputTokens,
					outputTokens,
					costUsd,
				});

				await recordUsageOnly(
					billingCtx,
					{
						provider: "openai",
						model,
						inputTokens,
						outputTokens,
						estimatedCostUsd: costUsd,
					},
					`agent:project-status:${userId}:${projectId}:${Date.now()}`
				).catch((err) => {
					consola.error("[billing] Failed to record agent usage:", err);
				});
			}

			clearActiveBillingContext();

			consola.debug("project-status: finished", {
				steps: data.steps?.length || 0,
			});
			const langfuse = getLangfuseClient();
			const lfTrace = langfuse.trace?.({ name: "api.chat.project-status" });
			const gen = lfTrace?.generation?.({
				name: "api.chat.project-status",
				input: messages,
				output: data,
			});
			gen?.end?.();
		},
	});

	let stream:
		| Awaited<ReturnType<typeof handleNetworkStream>>
		| Awaited<ReturnType<typeof handleChatStream>>
		| undefined;
	try {
		stream =
			targetAgentId === "projectStatusAgent"
				? await handleNetworkStream({
						mastra,
						agentId: targetAgentId,
						params: buildAgentParams(threadId),
					})
				: await handleChatStream({
						mastra,
						agentId: targetAgentId,
						params: buildAgentParams(threadId),
						sendReasoning: targetAgentId === "researchAgent" && !isFastStandardized,
						sendSources: !isFastStandardized,
					});
	} catch (error) {
		// Check if this is the "No tool call found" error from corrupted memory
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("No tool call found") || errorMessage.includes("function call output")) {
			threadId = await handleCorruptedThread(threadId, errorMessage);
			stream =
				targetAgentId === "projectStatusAgent"
					? await handleNetworkStream({
							mastra,
							agentId: targetAgentId,
							params: buildAgentParams(threadId),
						})
					: await handleChatStream({
							mastra,
							agentId: targetAgentId,
							params: buildAgentParams(threadId),
							sendReasoning: targetAgentId === "researchAgent" && !isFastStandardized,
							sendSources: !isFastStandardized,
						});
		} else {
			consola.error("project-status: failed to initialize stream", {
				error: errorMessage,
				targetAgentId,
				projectId,
			});
			const debugSuffix = debugRequested
				? `\n\nDebug Trace:\n- routed_to: ${targetAgentId}\n- response_mode: ${resolvedResponseMode}\n- max_steps: ${targetMaxSteps}\n- tool_calls: none (stream init failed)`
				: "";
			return createUIMessageStreamResponse({
				stream: streamPlainAssistantText(`${FALLBACK_EMPTY_RESPONSE_TEXT}${debugSuffix}`),
			});
		}
	}

	const reliableStream = augmentStreamForReliability(stream, {
		debugRequested,
		targetAgentId,
		targetMaxSteps,
		responseMode: resolvedResponseMode,
		accountId,
		projectId,
		lastUserText,
	});

	return createUIMessageStreamResponse({ stream: reliableStream });
}
