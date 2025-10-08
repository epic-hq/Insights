import { RuntimeContext } from "@mastra/core/di"
import type { ActionFunctionArgs } from "react-router"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { getAuthenticatedUser } from "~/lib/supabase/server"
import { mastra } from "~/mastra"
import { memory } from "~/mastra/memory"

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 })
  }
  const user = await getAuthenticatedUser(request)
  if (!user) {
    throw new Response("Unauthorized", { status: 401 })
  }

  const accountId = String(params.accountId || "")
  const projectId = String(params.projectId || "")
  if (!projectId) {
    return new Response(JSON.stringify({ error: "Missing projectId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { messages, system } = await request.json()

  // Analysis chat resource (separate agent)
  const resourceId = `analysisAgent-${user.sub}-${projectId}`
  const url = new URL(request.url)
  const requestedThreadId = url.searchParams.get("t") || ""

  const threads = await memory.getThreadsByResourceIdPaginated({
    resourceId,
    orderBy: "createdAt",
    sortDirection: "DESC",
    page: 0,
    perPage: 100,
  })

  let threadId = requestedThreadId
  if (!threadId) {
    if (!(threads?.total > 0)) {
      const newThread = await memory.createThread({
        resourceId,
        title: `Analysis Chat ${projectId}`,
        metadata: { user_id: user.sub, project_id: projectId, account_id: accountId },
      })
      threadId = newThread.id
    } else {
      threadId = threads.threads[0].id
    }
  }

  const runtimeContext = new RuntimeContext()
  runtimeContext.set("user_id", user.sub)
  runtimeContext.set("account_id", accountId)
  runtimeContext.set("project_id", projectId)

  const agent = mastra.getAgent("analysisAgent")
  const result = await agent.streamVNext(messages, {
    format: "aisdk",
    resourceId,
    threadId,
    runtimeContext,
    // assistant-ui optional system context
    context: system
      ? [
          {
            role: "system",
            content: `## Context from the client's UI:\n${system}`,
          },
        ]
      : undefined,
    onFinish: () => {},
  })

  const langfuse = getLangfuseClient()
  void result
    .getFullOutput()
    .then((full) => {
      const lfTrace = langfuse.trace?.({ name: "api.chat.analysis" })
      const gen = lfTrace?.generation?.({ name: "api.chat.analysis", input: messages, output: full?.content })
      gen?.end?.()
    })
    .catch(() => {})

  return result.toUIMessageStreamResponse()
}
