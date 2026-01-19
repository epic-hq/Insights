import { handleChatStream, handleNetworkStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/di";
import { createUIMessageStreamResponse } from "ai";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import {
  clearActiveBillingContext,
  estimateOpenAICost,
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
      const textPart = message.parts.find(
        (part) => (part as { type?: string })?.type === "text",
      ) as { text?: unknown } | undefined;
      if (textPart && typeof textPart.text === "string") return textPart.text;
    }
  }
  return "";
}

function isChiefOfStaffPrompt(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;
  const triggers = [
    "what should i do next",
    "what's next",
    "whats next",
    "next steps",
    "what should we focus on",
    "where should we focus",
    "prioritize",
    "priority",
    "roadmap",
    "plan",
    "what to do now",
    "chief of staff",
  ];
  return triggers.some((trigger) => normalized.includes(trigger));
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
  const accountId = await resolveAccountIdFromProject(
    projectId,
    "api.chat.project-status",
    fallbackAccountId,
  );
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
    (message: { role?: string }) =>
      message && typeof message === "object" && message.role === "user",
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
  const lastUserIndex = sanitizedMessages.findLastIndex(
    (m: { role?: string }) => m?.role === "user",
  );

  // If we have a user message, start from there. Otherwise use all messages.
  // This ensures we always send at least the new user message to the agent.
  const runtimeMessages =
    lastUserIndex >= 0
      ? sanitizedMessages.slice(lastUserIndex)
      : sanitizedMessages;

  const lastUserText = getLastUserText(sanitizedMessages);
  const shouldUseChiefOfStaff = isChiefOfStaffPrompt(lastUserText);
  const targetAgentId = shouldUseChiefOfStaff
    ? "chiefOfStaffAgent"
    : "projectStatusAgent";

  if (shouldUseChiefOfStaff) {
    consola.info("project-status: routing override", {
      targetAgentId,
      lastUserText,
    });
  }

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

  // Set up billing context for agent LLM calls
  const billingCtx = userBillingContext({
    accountId,
    userId,
    featureSource: "project_status_agent",
    projectId,
  });
  setActiveBillingContext(
    billingCtx,
    `agent:project-status:${userId}:${projectId}`,
  );

  // Helper to handle corrupted thread recovery
  const handleCorruptedThread = async (
    corruptedThreadId: string,
    errorMessage: string,
  ) => {
    consola.warn(
      "project-status: Corrupted thread detected, deleting and creating fresh",
      {
        corruptedThreadId,
        error: errorMessage,
      },
    );

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
    maxSteps: 10, // Prevent infinite tool loops (default is 5)
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
            content: `## Context from the client's UI:\n${system}`,
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
      const usage = data.usage;
      if (
        usage &&
        (usage.inputTokens || usage.outputTokens) &&
        billingCtx.accountId
      ) {
        const model = "gpt-4o"; // Default model for agents
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
          `agent:project-status:${userId}:${projectId}:${Date.now()}`,
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
            sendReasoning: true,
            sendSources: true,
          });
  } catch (error) {
    // Check if this is the "No tool call found" error from corrupted memory
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("No tool call found") ||
      errorMessage.includes("function call output")
    ) {
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
              sendReasoning: true,
              sendSources: true,
            });
    } else {
      throw error;
    }
  }

  return createUIMessageStreamResponse({ stream });
}
