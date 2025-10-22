import { convertMessages } from "@mastra/core/agent"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { redirect, useLoaderData } from "react-router"
import ProjectStatusScreen from "~/features/onboarding/components/ProjectStatusScreen"
import { getProjectById } from "~/features/projects/db"
import { getProjectContextGeneric } from "~/features/questions/db"
import { memory } from "~/mastra/memory"
import type { UpsightMessage } from "~/mastra/message-types"
import { userContext } from "~/server/user-context"
import { getProjectStatusData } from "~/utils/project-status.server"

export const meta: MetaFunction = () => {
	return [{ title: "Project Overview | Insights" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	// If the user hasn't visited the setup flow for this project yet, send them there first
	try {
		const steps = (ctx.user_settings?.onboarding_steps || {}) as Record<string, any>
		const setupByProject = (steps.project_setup || {}) as Record<string, any>
		const visited = setupByProject?.[projectId]?.visited === true
		if (!visited) {
			throw redirect(`/a/${accountId}/${projectId}/setup`)
		}
	} catch (_) {
		// Non-fatal; if something goes wrong reading steps, fall through to dashboard
	}

	const { data: project } = await getProjectById({ supabase, id: projectId })

	// Load merged project context (target_orgs, roles, research_goal, etc.)
	let projectContext: any = null
	try {
		projectContext = await getProjectContextGeneric(supabase, projectId)
	} catch (_) {
		// non-fatal
	}

	// Load project sections server-side to avoid client fetches
	const { data: projectSections } = await supabase
		.from("project_sections")
		.select("*")
		.eq("project_id", projectId)
		.order("position", { ascending: true, nullsFirst: false })
		.order("created_at", { ascending: false })

	// Load project status (latest analysis or fallback counts)
        const statusData = await getProjectStatusData(projectId, supabase)

        let initialChatMessages: UpsightMessage[] = []

        try {
                const userId = ctx.claims.sub
                if (userId) {
                        const resourceId = `projectStatusAgent-${userId}-${projectId}`
                        const threads = await memory.getThreadsByResourceIdPaginated({
                                resourceId,
                                orderBy: "createdAt",
                                sortDirection: "DESC",
                                page: 0,
                                perPage: 100,
                        })

                        let threadId = ""
                        if (!(threads?.total > 0)) {
                                const newThread = await memory.createThread({
                                        resourceId,
                                        title: `Project Status ${projectId}`,
                                        metadata: { user_id: userId, project_id: projectId, account_id: accountId },
                                })
                                threadId = newThread.id
                        } else {
                                threadId = threads.threads[0].id
                        }

                        const { messagesV2 } = await memory.query({
                                threadId,
                                selectBy: { last: 50 },
                        })

                        if (messagesV2 && messagesV2.length > 0) {
                                initialChatMessages = convertMessages(messagesV2).to("AIV5.UI") as UpsightMessage[]
                        }
                }
        } catch (error) {
                console.error("project-status chat history load failed", error)
        }

        return {
                accountId,
                projectId,
                projectName: project?.name || "Project",
                icp: project?.description || "",
                projectSections: projectSections || [],
                projectContext,
                statusData,
                initialChatMessages,
        }
}

export default function ProjectIndex() {
        const { accountId, projectId, projectName, icp, projectSections, statusData, initialChatMessages } =
                useLoaderData<typeof loader>()
        return (
                <ProjectStatusScreen
                        projectName={projectName}
                        icp={icp}
                        accountId={accountId}
                        projectId={projectId}
                        projectSections={projectSections}
                        statusData={statusData || undefined}
                        initialChatMessages={initialChatMessages}
                />
        )
}
