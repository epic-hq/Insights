import { convertMessages } from "@mastra/core/agent"
import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useParams } from "react-router"
import { Button } from "~/components/ui/button"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { memory } from "~/mastra/memory"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)
	if (!user) throw new Response("Unauthorized", { status: 401 })

	const projectId = params.projectId as string
	const accountId = params.accountId as string
	if (!projectId || !accountId) {
		throw new Response("Missing accountId or projectId", { status: 400 })
	}

	// Progress: fetch current project_sections
	const { client: supabase } = getServerClient(request)
	const { data: sections } = await supabase
		.from("project_sections")
		.select("kind, meta, content_md")
		.eq("project_id", projectId)

	const keys = [
		"research_goal",
		"decision_questions",
		"assumptions",
		"unknowns",
		"target_orgs",
		"target_roles",
	] as const

	const byKind = new Map<string, any>((sections || []).map((s: any) => [s.kind, s]))
	const isFilled = (kind: string) => {
		const s = byKind.get(kind)
		if (!s) return false
		const m = (s.meta || {}) as Record<string, any>
		switch (kind) {
			case "research_goal":
				return Boolean(m.research_goal || s.content_md?.trim())
			case "decision_questions":
			case "assumptions":
			case "unknowns":
			case "target_orgs":
			case "target_roles":
				return Array.isArray(m[kind]) ? m[kind].length > 0 : false
			default:
				return false
		}
	}
	const completedCount = keys.reduce((acc, k) => acc + (isFilled(k) ? 1 : 0), 0)
	const totalCount = keys.length

	const resourceId = `projectSetupAgent-${user.sub}-${projectId}`
	const result = await memory.getThreadsByResourceIdPaginated({
		resourceId,
		orderBy: "createdAt",
		sortDirection: "DESC",
		page: 0,
		perPage: 100,
	})

	let threadId = ""
	if (!(result?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId,
			title: `Project Setup ${projectId}`,
			metadata: { user_id: user.sub, project_id: projectId, account_id: accountId },
		})
		consola.log("New project-setup thread created: ", newThread)
		threadId = newThread.id
	} else {
		threadId = result.threads[0].id
	}

	const { messagesV2 } = await memory.query({
		threadId,
		selectBy: { last: 50 },
	})
	const aiv5Messages = convertMessages(messagesV2).to("AIV5.UI")

	return data({ messages: aiv5Messages, progress: { completedCount, totalCount } })
}

export default function ProjectChatPage() {
	const { messages, progress } = useLoaderData<typeof loader>()
	const { accountId, projectId } = useParams()

	// const runtime = useChatRuntime({
	// 	transport: new AssistantChatTransport({
	// 		api: `/a/${accountId}/${projectId}/api/chat/project-setup`,
	// 	}),
	// 	messages,
	// })
	return <div>TODO</div>

	return (
		<div className="grid h-dvh grid-cols-1 gap-x-2 px-4 pt-16 pb-4 md:pt-4">
			{/* Header */}
			<div className="mx-auto mb-2 w-full max-w-[var(--thread-max-width,44rem)]">
				<div className="flex items-center justify-between rounded-xl border bg-white/70 px-3 py-2 shadow-sm backdrop-blur dark:bg-neutral-900/70">
					<div className="flex items-center gap-2">
						<span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 text-xs ring-1 ring-blue-200 ring-inset dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800">
							Setup Chat
						</span>
						<span className="text-muted-foreground text-xs">Answer 6 quick questions</span>
					</div>
					<div className="flex items-center gap-3">
						<MiniDotsProgress completed={progress.completedCount} total={progress.totalCount} />
						<Link to={`/a/${accountId}/${projectId}/setup`}>
							<Button variant="outline" size="sm">
								Use Form Instead
							</Button>
						</Link>
					</div>
				</div>
			</div>
		</div>
	)
}

function MiniDotsProgress({ completed, total }: { completed: number; total: number }) {
	const dots = Array.from({ length: total })
	return (
		<div className="flex items-center gap-1.5" aria-label={`Progress ${completed} of ${total}`}>
			{dots.map((_, i) => (
				<span
					key={i}
					className={`h-2 w-2 rounded-full ${i < completed ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
				/>
			))}
		</div>
	)
}
