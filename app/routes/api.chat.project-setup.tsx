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
import { getLangfuseClient } from "~/lib/langfuse.server";
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
  const accountId = await resolveAccountIdFromProject(
    projectId,
    "api.chat.project-setup",
    fallbackAccountId,
  );
  const userId = ctx.claims?.sub;

  if (!projectId) {
    return new Response(JSON.stringify({ error: "Missing projectId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, system } = await request.json();

  // Sanitize messages - remove id fields that can cause duplicate errors
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

  // Only pass NEW messages to the agent - Mastra's memory handles historical context.
  // This prevents duplicate messages when both client history and memory are present.
  const lastAssistantIndex = sanitizedMessages.findLastIndex(
    (m: { role?: string }) => m?.role === "assistant",
  );
  const runtimeMessages =
    lastAssistantIndex >= 0
      ? sanitizedMessages.slice(lastAssistantIndex + 1)
      : sanitizedMessages;

  consola.info("project-setup action: sending messages to agent", {
    totalReceived: sanitizedMessages.length,
    messageCount: runtimeMessages.length,
    roles: runtimeMessages.map((m: { role?: string }) => m?.role),
  });

  // Reuse latest thread for this project-scoped agent
  // TODO pass in threadId instead of refetching
  // TODO abstract into thread primitives lib
  const resourceId = `projectSetupAgent-${userId}-${projectId}`;
  const threads = await memory.listThreadsByResourceId({
    resourceId,
    orderBy: { field: "createdAt", direction: "DESC" },
    page: 0,
    perPage: 100,
  });

  let threadId = "";
  if (!(threads?.total > 0)) {
    const newThread = await memory.createThread({
      resourceId,
      title: `Project Setup ${projectId}`,
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

  const agent = mastra.getAgent("projectSetupAgent");

  // Set up billing context for agent LLM calls
  const billingCtx = userBillingContext({
    accountId,
    userId: userId || "",
    featureSource: "project_setup_agent",
    projectId,
  });
  setActiveBillingContext(
    billingCtx,
    `agent:project-setup:${userId}:${projectId}`,
  );

  const result = await agent.stream(runtimeMessages, {
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
          `agent:project-setup:${userId}:${projectId}:${Date.now()}`,
        ).catch((err) => {
          consola.error("[billing] Failed to record agent usage:", err);
        });

        consola.info("project-setup billing recorded", {
          inputTokens,
          outputTokens,
          costUsd,
        });
      }

      // Clear billing context when agent finishes
      clearActiveBillingContext();

      consola.info("project-setup onFinish", {
        finishReason: data.finishReason,
        toolCallsCount: data.toolCalls?.length || 0,
        textLength: data.text?.length || 0,
        stepsCount: data.steps?.length || 0,
      });
      // Log to Langfuse
      const langfuse = getLangfuseClient();
      const lfTrace = langfuse.trace?.({ name: "api.chat.project-setup" });
      const gen = lfTrace?.generation?.({
        name: "api.chat.project-setup",
        input: messages,
        output: data,
      });
      gen?.end?.();

      // Check if setup is complete and trigger research structure generation
      try {
        const workingMemory = await memory.getWorkingMemory({ threadId });
        const setupState = workingMemory?.projectSetup;

        if (setupState?.completed) {
          consola.info(
            "[project-setup] Setup completed, generating research structure",
          );

          // Check if research structure already exists
          const checkResponse = await fetch(
            `${request.url.split("/api")[0]}/api/check-research-structure?project_id=${projectId}`,
          );
          const checkBody = await checkResponse.json();

          if (
            checkBody.summary?.has_decision_questions &&
            checkBody.summary?.has_research_questions
          ) {
            consola.info(
              "[project-setup] Research structure already exists, skipping generation",
            );
            return;
          }

          // Generate research structure
          const formData = new FormData();
          formData.append("project_id", projectId);
          if (setupState.research_goal)
            formData.append("research_goal", setupState.research_goal);
          if (setupState.customer_problem)
            formData.append("customer_problem", setupState.customer_problem);
          if (setupState.target_roles?.length)
            formData.append("target_roles", setupState.target_roles.join(", "));
          if (setupState.target_orgs?.length)
            formData.append("target_orgs", setupState.target_orgs.join(", "));
          if (setupState.offerings)
            formData.append("offerings", setupState.offerings);
          if (setupState.competitors?.length)
            formData.append("competitors", setupState.competitors.join(", "));
          if (setupState.assumptions?.length)
            formData.append("assumptions", setupState.assumptions.join("\n"));
          if (setupState.unknowns?.length)
            formData.append("unknowns", setupState.unknowns.join("\n"));
          formData.append("research_mode", "exploratory");

          const generateResponse = await fetch(
            `${request.url.split("/api")[0]}/api/generate-research-structure`,
            {
              method: "POST",
              body: formData,
            },
          );

          if (generateResponse.ok) {
            const result = await generateResponse.json();
            consola.info(
              "[project-setup] Research structure generated successfully",
              {
                decisionQuestions:
                  result?.structure?.decision_questions?.length ?? 0,
                researchQuestions:
                  result?.structure?.research_questions?.length ?? 0,
              },
            );
          } else {
            consola.error(
              "[project-setup] Failed to generate research structure",
              {
                status: generateResponse.status,
              },
            );
          }
        }
      } catch (error) {
        consola.error("[project-setup] Error in onFinish handler", error);
      }
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
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        consola.error("project-setup stream error", { errorMessage });
        throw error;
      }
    },
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}
