import { useChat } from "@ai-sdk/react"
import { convertMessages } from "@mastra/core/agent"
import { DefaultChatTransport } from "ai"
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import {
  data,
  useLoaderData,
  useSearchParams,
  useRevalidator,
} from "react-router"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Messages } from "~/features/ai-chat/components/conversation"
import { ChatInput } from "~/features/ai-chat/components/prompt-input"
import { getAuthenticatedUser } from "~/lib/supabase/server"
import { memory } from "~/mastra/memory"
import type { UpsightMessage } from "~/mastra/message-types"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
} from "~/components/ui/sidebar"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const url = new URL(request.url)
	const accountId = String(params.accountId || "")
	const projectId = String(params.projectId || "")

	// Resource is project-scoped and grouped by account + project
	// Align with existing project-setup agent resource convention
	const resourceId = `projectSetupAgent-${user.sub}-${projectId}`

	// Fetch threads for this resource, newest first
	const result = await memory.getThreadsByResourceIdPaginated({
		resourceId,
		orderBy: "createdAt",
		sortDirection: "DESC",
		page: 0,
		perPage: 100,
	})

	// Limit to threads created by this user
	const userThreads = (result?.threads || []).filter(
		(t: { metadata?: { user_id?: string } }) => t?.metadata?.user_id === user.sub
	)

	// Choose active thread: prefer ?t=, else latest, else create
	const requestedThreadId = url.searchParams.get("t") || ""
	let threadId = requestedThreadId
	if (!threadId) {
		if (userThreads.length > 0) {
			threadId = userThreads[0].id
		} else {
			const newThread = await memory.createThread({
				resourceId,
				title: "New Chat",
				metadata: { user_id: user.sub, account_id: accountId, project_id: projectId },
			})
			threadId = newThread.id
		}
	}

	const { messagesV2 } = await memory.query({
		threadId,
		selectBy: { last: 50 },
	})
	const aiv5Messages = convertMessages(messagesV2).to("AIV5.UI") as UpsightMessage[]

	return data({
		messages: aiv5Messages,
		threads: userThreads.map((t: { id: string; title?: string; createdAt?: string }) => ({ id: t.id, title: t.title, createdAt: t.createdAt })),
		threadId,
		accountId,
		projectId,
		resourceId,
	})
}

export default function Chat() {
  const { messages, threads, threadId, accountId, projectId } = useLoaderData() as {
    messages: UpsightMessage[]
    threads: { id: string; title: string; createdAt?: string }[]
    threadId: string
    accountId: string
    projectId: string
  }
  const [, setSearchParams] = useSearchParams()
  const revalidator = useRevalidator()
  const [input, setInput] = useState("")

  const { status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: `/a/${accountId}/${projectId}/api/chat/project?t=${encodeURIComponent(threadId)}`,
    }),
    id: threadId,
    onFinish: () => {
      revalidator.revalidate()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage({ text: input })
    setInput("")
  }

  const uiStatus: "streaming" | "submitted" | "error" =
    status === "streaming" ? "streaming" : status === "error" ? "error" : "submitted"

  return (
    <SidebarProvider>
      <Sidebar className="border-r">
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">Threads</div>
            <form method="post">
              <input type="hidden" name="action" value="new_thread" />
              <Button type="submit" size="sm" variant="outline">New</Button>
            </form>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {threads.map((t) => (
                  <SidebarMenuItem key={t.id}>
                    <SidebarMenuButton
                      isActive={t.id === threadId}
                      onClick={() => {
                        setSearchParams((prev) => {
                          prev.set("t", t.id)
                          return prev
                        })
                      }}
                    >
                      <span>{t.title || "Untitled"}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div className="flex h-dvh flex-col">
          <div className="flex items-center gap-2 border-b p-2">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">Toggle sidebar</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <Messages messages={messages} />
          </div>
          <div className="border-t p-4">
            <ChatInput
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              sendMessage={({ text }) => sendMessage({ text })}
              status={uiStatus}
            />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getAuthenticatedUser(request)
  if (!user) throw new Response("Unauthorized", { status: 401 })

  const url = new URL(request.url)
  const accountId = String(params.accountId || "")
  const projectId = String(params.projectId || "")
  const resourceId = `projectSetupAgent-${user.sub}-${projectId}`

  const form = await request.formData()
  const action = String(form.get("action") || "")
  if (action === "new_thread") {
    const newThread = await memory.createThread({
      resourceId,
      title: "New Chat",
      metadata: { user_id: user.sub, account_id: accountId, project_id: projectId },
    })
    url.searchParams.set("t", newThread.id)
    return redirect(`${url.pathname}?${url.searchParams.toString()}`)
  }

  return data({ ok: true })
}
