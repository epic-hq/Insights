import { toAISdkStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/di";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { mastra } from "~/mastra";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { messages } = await request.json();

  consola.info("demo-gen-ui-chat: received messages", {
    messageCount: messages?.length,
  });

  const requestContext = new RequestContext();
  requestContext.set("user_id", "demo-user");
  requestContext.set("account_id", "demo-account");

  try {
    const agent = mastra.getAgent("demoGenerativeUIAgent");

    // Sanitize messages - remove id fields that Mastra doesn't expect
    const sanitizedMessages = Array.isArray(messages)
      ? messages.map((message: Record<string, unknown>) => {
          if (!message || typeof message !== "object") return message;
          const cloned = { ...message };
          if ("id" in cloned) delete cloned.id;
          return cloned;
        })
      : [];

    const stream = await agent.stream(sanitizedMessages, {
      requestContext,
      onFinish: (data) => {
        consola.info("demo-gen-ui-chat: stream finished", {
          usage: (data as { usage?: unknown }).usage,
        });
      },
    });

    // Transform Mastra stream to AI SDK format
    const uiMessageStream = createUIMessageStream({
      execute: async ({ writer }) => {
        const transformedStream = toAISdkStream(stream, {
          from: "agent" as const,
          sendReasoning: true,
          sendSources: true,
        });
        if (transformedStream) {
          for await (const part of transformedStream) {
            writer.write(part);
          }
        }
      },
    });

    return createUIMessageStreamResponse({ stream: uiMessageStream });
  } catch (error) {
    consola.error("demo-gen-ui-chat: error", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate response" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
