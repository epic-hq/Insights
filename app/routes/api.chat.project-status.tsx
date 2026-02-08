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
import { fetchTopThemesWithPeopleTool } from "~/mastra/tools/fetch-top-themes-with-people";
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

const intentRoutingSchema = z.object({
	targetAgentId: z.enum(routingTargetAgents),
	confidence: z.number().min(0).max(1),
	responseMode: z.enum(["normal", "fast_standardized", "theme_people_snapshot"]).default("normal"),
	rationale: z.string().max(240).optional(),
});

const ROUTING_CONFIDENCE_THRESHOLD = 0.68;
const FAST_STANDARDIZED_MAX_STEPS = 2;
const FAST_STANDARDIZED_CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_SYSTEM_CONTEXT_CHARS = 3000;
const MAX_FAST_SYSTEM_CONTEXT_CHARS = 800;

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

async function routeAgentByIntent(lastUserText: string): Promise<z.infer<typeof intentRoutingSchema> | null> {
	const prompt = lastUserText.trim();
	if (!prompt) return null;

	try {
		const result = await generateObject({
			model: instrumentedOpenai("gpt-4o-mini"),
			schema: intentRoutingSchema,
			temperature: 0,
			prompt: `Classify this user message for agent routing.

Choose exactly one target:
- projectSetupAgent: onboarding, setup, research goals, company context capture.
- chiefOfStaffAgent: strategic guidance, prioritization, "what should I do next", project-level recommendations.
- researchAgent: creating/managing surveys, interview prompts, interview operations.
- projectStatusAgent: default catch-all for project status and general requests.

Set responseMode="fast_standardized" only when the user asks broad strategic guidance without asking for execution details.
Set responseMode="theme_people_snapshot" when user asks for top/common themes and who has those themes.
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

	const lastUserText = getLastUserText(sanitizedMessages);
	const routeDecision = await routeAgentByIntent(lastUserText);
	const targetAgentId: RoutingTargetAgent =
		routeDecision && routeDecision.confidence >= ROUTING_CONFIDENCE_THRESHOLD
			? routeDecision.targetAgentId
			: "projectStatusAgent";
	const isFastStandardized =
		targetAgentId === "chiefOfStaffAgent" && routeDecision?.responseMode === "fast_standardized";
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

	consola.info("project-status: intent routing", {
		targetAgentId,
		targetMaxSteps,
		isFastStandardized,
		routingConfidence: routeDecision?.confidence ?? null,
		responseMode: routeDecision?.responseMode ?? "normal",
		rationale: routeDecision?.rationale ?? null,
	});

	const resourceId = `projectStatusAgent-${userId}-${projectId}`;

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
	if (routeDecision?.responseMode) {
		requestContext.set("response_mode", routeDecision.responseMode);
	}

	if (routeDecision?.responseMode === "theme_people_snapshot") {
		const topThemesResult = await fetchTopThemesWithPeopleTool.execute(
			{
				projectId,
				limit: 2,
				peoplePerTheme: 6,
			},
			{ requestContext }
		);

		const message = topThemesResult.success
			? topThemesResult.topThemes.length > 0
				? `Top themes right now:\n${topThemesResult.topThemes
						.map((theme, index) => {
							const people = theme.people
								.map((person) => person.name ?? "Unknown")
								.filter((name) => name.trim().length > 0)
								.slice(0, 6)
								.join(", ");
							const themeLabel = theme.url ? `[${theme.name}](${theme.url})` : theme.name;
							return `${index + 1}. ${themeLabel} (${theme.evidenceCount} mentions)${people ? ` — People: ${people}` : ""}`;
						})
						.join("\n")}`
				: "I couldn't find any themes with evidence links yet in this project."
			: "I couldn't load theme data right now. Please try again.";

		return createUIMessageStreamResponse({
			stream: streamPlainAssistantText(message),
		});
	}
	const fastGuidanceCacheKey = isFastStandardized
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
		messages: runtimeMessages,
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
		context: system
			? [
					{
						role: "system" as const,
						content: `## Context from the client's UI:\n${systemContext}`,
					},
				]
			: undefined,
		onFinish: async (data: {
			usage?: { inputTokens?: number; outputTokens?: number };
			finishReason?: string;
			toolCalls?: unknown[];
			text?: string;
			steps?: unknown[];
		}) => {
			if (isFastStandardized && fastGuidanceCacheKey && data.text?.trim()) {
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
			throw error;
		}
	}

	return createUIMessageStreamResponse({ stream });
}
