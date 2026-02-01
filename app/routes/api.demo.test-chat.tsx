import type { ActionFunctionArgs } from "react-router";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { messages } = await request.json();

  // Simple echo response to test if the basic flow works
  const lastMessage = messages[messages.length - 1];

  return new Response(
    JSON.stringify({
      messages: [
        ...messages,
        {
          role: "assistant",
          content: `Echo: ${lastMessage?.content || "no message"}`,
        },
      ],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
