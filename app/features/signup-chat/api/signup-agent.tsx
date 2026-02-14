import { toAISdkStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/di";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getAuthenticatedUser } from "~/lib/supabase/client.server";
import { mastra } from "~/mastra";
import { memory } from "~/mastra/memory";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  // Auth + DB client for actions
  const { user } = await getAuthenticatedUser(request);
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { messages, system } = await request.json();
  const resourceId = `signupAgent-${user.sub}`;

  // Get threads using v1 API
  const threads = await memory.listThreads({
    filter: { resourceId },
    page: 0,
    perPage: 100,
  });

  consola.log("Result: ", threads);
  let threadId = "";

  if (!(threads?.total > 0)) {
    const newThread = await memory.createThread({
      resourceId,
      title: "Signup Chat",
      metadata: {
        user_id: user.sub,
      },
    });
    consola.log("New thread created: ", newThread);
    threadId = newThread.id;
  } else {
    threadId = threads.threads[0].id;
  }

  const requestContext = new RequestContext();
  requestContext.set("user_id", user.sub);

  // Get the signupAgent instance from Mastra
  const agent = mastra.getAgent("signupAgent");

  // Only pass the last user message - Mastra's memory handles historical context
  const sanitizedMessages = Array.isArray(messages)
    ? messages.map((message: Record<string, unknown>) => {
        if (!message || typeof message !== "object") return message;
        const cloned = { ...message };
        if ("id" in cloned) {
          delete cloned.id;
        }
        return cloned;
      })
    : [];

  const lastUserIndex = sanitizedMessages.findLastIndex(
    (m: { role?: string }) => m?.role === "user",
  );
  const runtimeMessages =
    lastUserIndex >= 0
      ? sanitizedMessages.slice(lastUserIndex)
      : sanitizedMessages;

  consola.log("System prompt from frontend: ", system);

  const stream = await agent.stream(runtimeMessages, {
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
    onFinish: (data) => {
      consola.log("onFinish", data);
    },
  });

  // Transform Mastra stream to AI SDK format with v1 pattern
  const toAISdkOptions = {
    from: "agent" as const,
    sendReasoning: true,
    sendSources: true,
  };

  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      const transformedStream = toAISdkStream(stream, toAISdkOptions);
      if (transformedStream) {
        for await (const part of transformedStream) {
          writer.write(part);
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}
