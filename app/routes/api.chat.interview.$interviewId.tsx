import { toAISdkStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/di";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import {
	clearActiveBillingContext,
	estimateOpenAICost,
	setActiveBillingContext,
	userBillingContext,
} from "~/lib/billing/instrumented-openai.server";
import { recordUsageOnly } from "~/lib/billing/usage.server";
import { mastra } from "~/mastra";
import { memory } from "~/mastra/memory";
import { resolveAccountIdFromProject } from "~/mastra/tools/context-utils";
import { userContext } from "~/server/user-context";

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const ctx = context.get(userContext);
	const projectId = String(params.projectId || "");
	// IMPORTANT: Resolve account_id from project, not URL params or session
	// This prevents data being created with wrong account when user has multiple accounts
	const fallbackAccountId = String(params.accountId || ctx?.account_id || "");
	const accountId = await resolveAccountIdFromProject(projectId, "api.chat.interview", fallbackAccountId);
	const interviewId = String(params.interviewId || params.interview_id || "");
	const userId = ctx?.claims?.sub || "";

	if (!projectId || !interviewId) {
		return new Response(JSON.stringify({ error: "Missing projectId or interviewId" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { messages, system } = await request.json();

	const resourceId = `interviewStatusAgent-${userId}-${interviewId}`;
	const threads = await memory.listThreads({
		filter: { resourceId },
		orderBy: { field: "createdAt", direction: "DESC" },
		page: 0,
		perPage: 100,
	});

	let threadId = "";
	if (!(threads?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId,
			title: `Interview ${interviewId}`,
			metadata: {
				user_id: userId,
				project_id: projectId,
				account_id: accountId,
				interview_id: interviewId,
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
	requestContext.set("interview_id", interviewId);

	const agent = mastra.getAgent("interviewStatusAgent");

	// Set up billing context for agent LLM calls
	const billingCtx = userBillingContext({
		accountId,
		userId,
		featureSource: "interview_agent",
		projectId,
	});
	setActiveBillingContext(billingCtx, `agent:interview-status:${userId}:${interviewId}`);

	const result = await agent.stream(messages, {
		memory: {
			thread: threadId,
			resource: resourceId,
		},
		requestContext,
		context: system
			? [
					{
						role: "system",
						content: `## Context from the client's UI:\n${system}`,
					},
				]
			: undefined,
		onFinish: async (data) => {
			// Record usage BEFORE clearing billing context
			// Mastra uses inputTokens/outputTokens (not promptTokens/completionTokens)
			const usage = (
				data as {
					usage?: { inputTokens?: number; outputTokens?: number };
				}
			).usage;
			if (usage && (usage.inputTokens || usage.outputTokens)) {
				const model = "gpt-4o";
				const inputTokens = usage.inputTokens || 0;
				const outputTokens = usage.outputTokens || 0;
				const costUsd = estimateOpenAICost(model, inputTokens, outputTokens);

				await recordUsageOnly(
					billingCtx,
					{
						provider: "openai",
						model,
						inputTokens,
						outputTokens,
						estimatedCostUsd: costUsd,
					},
					`agent:interview-status:${userId}:${interviewId}:${Date.now()}`
				).catch((err) => {
					consola.error("[billing] Failed to record agent usage:", err);
				});

				consola.info("interview-status billing recorded", {
					inputTokens,
					outputTokens,
					costUsd,
				});
			}

			// Clear billing context when agent finishes
			clearActiveBillingContext();

			consola.info("interview-status onFinish", {
				finishReason: data.finishReason,
				toolCallsCount: data.toolCalls?.length || 0,
				textLength: data.text?.length || 0,
				stepsCount: data.steps?.length || 0,
			});
		},
	});

	const uiMessageStream = createUIMessageStream({
		execute: async ({ writer }) => {
			try {
				const transformedStream = toAISdkStream(result, {
					from: "agent" as const,
					sendReasoning: true,
					sendSources: true,
				});

				if (!transformedStream) return;

				for await (const part of transformedStream) {
					writer.write(part);
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				consola.error("interview-status stream error", { errorMessage });
				throw error;
			}
		},
	});

	return createUIMessageStreamResponse({ stream: uiMessageStream });
}
