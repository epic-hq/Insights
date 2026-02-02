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

  const { messages, promptsState } = await request.json();

  consola.info("demo-gen-ui-chat: received messages", {
    messageCount: messages?.length,
    hasPromptsState: !!promptsState,
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

    // Inject current UI state context if available
    const messagesWithContext = [...sanitizedMessages];
    if (promptsState && promptsState.prompts?.length > 0) {
      const stateContext = {
        role: "system",
        content: `CURRENT UI STATE - Interview Prompts (${promptsState.count} items):
${promptsState.prompts.map((p: { index: number; id: string; text: string; status: string }) => `  ${p.index}. [${p.status}] ${p.text}`).join("\n")}

When user asks to modify prompts, use the index numbers above (1-based) to identify them.`,
      };
      // Insert after first message to not override agent instructions
      messagesWithContext.splice(1, 0, stateContext);
    }

    const stream = await agent.stream(messagesWithContext, {
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
