/**
 * Project Layout Route - Provides 3-column layout for all project pages
 * Left: AppSidebar for navigation
 * Center: Main content area (<Outlet />)
 * Right: ProjectStatusAgent chat sidebar
 */

import { convertMessages } from "@mastra/core/agent"
import consola from "consola"
import { Outlet, redirect, useLoaderData } from "react-router"
import { z } from "zod"
import { ProjectStatusAgentChat } from "~/components/chat/ProjectStatusAgentChat"
import { CurrentProjectProvider, useCurrentProject } from "~/contexts/current-project-context"
import { getProjectById } from "~/features/projects/db"
import { memory } from "~/mastra/memory"
import type { UpsightMessage } from "~/mastra/message-types"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import type { GetAccount, Project } from "~/types"
import { getProjectStatusData } from "~/utils/project-status.server"
import type { Route } from "./+types/projects"

// Server-side Authentication Middleware
export const unstable_middleware: Route.unstable_MiddlewareFunction[] = [
	async ({ request: _request, context, params }) => {
		try {
			const ctx = context.get(userContext)
			const _supabase = ctx.supabase
			const project_id_or_slug = params?.projectId || ""
			const account_id = params?.accountId || ""

			// Placeholder: Fetch project and account info
			const project = await _parse_project_id_from_params({
				project_id_or_slug,
				supabase: _supabase,
			})
			const account: GetAccount = {} as GetAccount

			context.set(currentProjectContext, {
				accountId: account_id,
				projectId: project_id_or_slug,
				account,
				project,
			})
			// consola.log("_protected/projects currentProjectContext", project_id_or_slug)
		} catch (error) {
			consola.error("_protected/projects Authentication middleware error:", error)
			throw redirect("/login")
		}
	},
]

export async function loader({ context, params }: Route.LoaderArgs) {
	try {
		// const currentProject = context.get(currentProjectContext)
		const ctx = context.get(userContext)
		const { supabase } = ctx

		if (!supabase) {
			throw new Response("Database connection not available", { status: 500 })
		}

		const _accountId = params?.accountId
		const projectId = params?.projectId
		const project = await getProjectById({ supabase, id: projectId })

		// Load project status (latest analysis or fallback counts)
		const statusData = await getProjectStatusData(projectId, supabase)

		let initialChatMessages: UpsightMessage[] = []

		try {
			const userId = ctx.claims?.sub
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
						metadata: { user_id: userId, project_id: projectId, account_id: _accountId },
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
			projectId,
			project: project.data,
			statusData,
			initialChatMessages,
		}
	} catch (error) {
		consola.error("_protected/projects loader error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}

// Helper function (keeping for compatibility)
function isUUID(str: string) {
	const uuidSchema = z.string().uuid()
	const isValid = uuidSchema.safeParse(str).success
	return isValid
}

// Placeholder: Replace with actual project fetching logic
async function _parse_project_id_from_params({
	project_id_or_slug,
	supabase: _supabase,
}: {
	project_id_or_slug: string
	supabase: any // SupabaseClient
}) {
	if (isUUID(project_id_or_slug || "")) {
		// TODO: Replace with actual RPC or query to fetch project by UUID
		const project: Project = {} as Project
		return project
	}
	// TODO: Replace with actual RPC or query to fetch project by slug
	const project: Project = {} as Project
	return project
}

// Layout component with main content and right sidebar
function ProjectLayout({
	statusData,
	initialChatMessages,
	project,
}: {
	statusData: any
	initialChatMessages: UpsightMessage[]
	project: any
}) {
	const { accountId, projectId } = useCurrentProject()

	// Build comprehensive system context for the project status agent
	const projectSystemContext = `
Project: ${project?.name || "Project"}
Interviews conducted: ${statusData?.totalInterviews || 0}
Evidence collected: ${statusData?.totalEvidence || 0}
Insights generated: ${statusData?.totalInsights || 0}
Personas identified: ${statusData?.totalPersonas || 0}
Current next steps: ${statusData?.nextSteps?.slice(0, 3).join(", ") || "None"}
`.trim()

	return (
		<div className="flex h-screen">
			{/* Center Column - Main Content */}
			<main className="flex-1 overflow-auto">
				<Outlet />
			</main>

			{/* Right Sidebar - Project Status Agent */}
			<aside className="flex flex-col border-l bg-background">
				<div className="min-h-0 flex-1">
					{accountId && projectId && (
						<ProjectStatusAgentChat
							accountId={accountId}
							projectId={projectId}
							initialMessages={initialChatMessages}
							systemContext={projectSystemContext}
						/>
					)}
				</div>
			</aside>
		</div>
	)
}

export default function Projects() {
	const loaderData = useLoaderData<typeof loader>()
	const { statusData, initialChatMessages, project } = loaderData

	return (
		<CurrentProjectProvider>
			<ProjectLayout statusData={statusData} initialChatMessages={initialChatMessages} project={project} />
		</CurrentProjectProvider>
	)
}
