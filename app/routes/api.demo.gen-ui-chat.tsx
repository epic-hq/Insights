import { handleChatStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/di";
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
  // Demo doesn't need real user/project context
  requestContext.set("user_id", "demo-user");
  requestContext.set("project_id", "demo-project");

  try {
    const stream = await handleChatStream({
      mastra,
      agentId: "demoGenerativeUIAgent",
      params: {
        messages,
        requestContext,
        onFinish: async (data) => {
          consola.info("demo-gen-ui-chat: stream finished", {
            usage: (data as { usage?: unknown }).usage,
          });
        },
      },
    });

    return stream;
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
