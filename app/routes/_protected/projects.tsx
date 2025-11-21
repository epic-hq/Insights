/**
 * Project Layout Route - Provides 3-column layout for all project pages
 * Left: AppSidebar for navigation
 * Center: Main content area (<Outlet />)
 * Right: ProjectStatusAgent chat sidebar (resizable)
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { useEffect, useRef, useState } from "react"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { Outlet, redirect, useLoaderData, useMatches, useParams } from "react-router"
import { z } from "zod"
import { ProjectStatusAgentChat } from "~/components/chat/ProjectStatusAgentChat"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "~/components/ui/resizable"
import { CurrentProjectProvider } from "~/contexts/current-project-context"
import { ProjectStatusAgentProvider, useProjectStatusAgent } from "~/contexts/project-status-agent-context"
import { getProjectById } from "~/features/projects/db"
import { currentProjectContext } from "~/server/current-project-context"
import { type UserMetadata, userContext } from "~/server/user-context"
import type { Database, GetAccount, Project, UserSettings } from "~/types"
import { getProjectStatusData, type ProjectStatusData } from "~/utils/project-status.server"
import type { Route } from "./+types/projects"

type ProjectRecord = Awaited<ReturnType<typeof getProjectById>>["data"]

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
		const userProfileContext = buildUserProfileContext(ctx.user_settings, ctx.user_metadata)

		return {
			projectId,
			project: project.data,
			statusData,
			userProfileContext,
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
	supabase: SupabaseClient<Database> | null
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
	project,
	userProfileContext,
}: {
	statusData: ProjectStatusData | null
	project: ProjectRecord | null
	userProfileContext?: string | null
}) {
	// Get params directly to ensure consistent values on server and client
	const params = useParams()
	const accountId = params.accountId || ""
	const projectId = params.projectId || ""
	const matches = useMatches()
	const { isExpanded } = useProjectStatusAgent()
	const [isChatCollapsed, setIsChatCollapsed] = useState(false)
	const chatPanelRef = useRef<ImperativePanelHandle | null>(null)
	const lastExpandedSize = useRef(30)

	const hideProjectStatusAgent = matches.some(
		(match) =>
			typeof match.handle === "object" && (match.handle as { hideProjectStatusAgent?: boolean }).hideProjectStatusAgent
	)

	useEffect(() => {
		const panel = chatPanelRef.current
		if (!panel) return
		const shouldCollapse = isChatCollapsed || !isExpanded
		if (shouldCollapse) {
			panel.collapse()
			return
		}
		panel.expand()
		const target = Math.max(20, Math.min(55, lastExpandedSize.current))
		panel.resize(target)
	}, [isChatCollapsed, isExpanded])

	// Build comprehensive system context for the project status agent
	const profileSection = userProfileContext ? `User Profile:\n${userProfileContext}` : ""
	const projectSection = `
Project: ${project?.name || "Project"}
Interviews conducted: ${statusData?.totalInterviews || 0}
Evidence collected: ${statusData?.totalEvidence || 0}
Insights generated: ${statusData?.totalInsights || 0}
Personas identified: ${statusData?.totalPersonas || 0}
Current next steps: ${statusData?.nextSteps?.slice(0, 3).join(", ") || "None"}
`.trim()
	const projectSystemContext = [profileSection, projectSection].filter(Boolean).join("\n\n")

	if (hideProjectStatusAgent) {
		return (
			<div className="flex h-dvh min-h-0 w-full overflow-hidden">
				<div className="flex min-h-0 min-w-0 flex-1 overflow-auto">
					<Outlet />
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-dvh min-h-0 w-full overflow-hidden">
			<ResizablePanelGroup direction="horizontal" autoSaveId="project-status-layout" className="flex h-full w-full">
				<ResizablePanel tagName="main" defaultSize={70} minSize={45} className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="min-h-0 min-w-0 flex-1 overflow-auto">
						<Outlet />
					</div>
				</ResizablePanel>

				<ResizableHandle withHandle />

				<ResizablePanel
					tagName="aside"
					defaultSize={30}
					minSize={20}
					maxSize={55}
					collapsible
					collapsedSize={5}
					ref={chatPanelRef}
					onResize={(size) => {
						if (size <= 6) return
						lastExpandedSize.current = size
					}}
					className="flex min-h-0 flex-col border-l bg-background"
				>
					<div className="min-h-0 flex-1 overflow-hidden">
						{accountId && projectId && (
							<ProjectStatusAgentChat
								key={projectId}
								accountId={accountId}
								projectId={projectId}
								systemContext={projectSystemContext}
								onCollapsedChange={setIsChatCollapsed}
							/>
						)}
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	)
}

export default function Projects() {
	const loaderData = useLoaderData<typeof loader>()
	const { statusData, project, userProfileContext } = loaderData

	return (
		<CurrentProjectProvider>
			<ProjectStatusAgentProvider>
				<ProjectLayout statusData={statusData} project={project} userProfileContext={userProfileContext} />
			</ProjectStatusAgentProvider>
		</CurrentProjectProvider>
	)
}

function buildUserProfileContext(userSettings?: UserSettings, userMetadata?: UserMetadata | null) {
	if (!userSettings && !userMetadata) return null

	const lines: string[] = []

	const name =
		[userSettings?.first_name, userSettings?.last_name].filter(Boolean).join(" ").trim() ||
		userMetadata?.name ||
		userSettings?.email ||
		null
	if (name) {
		lines.push(`Name: ${name}`)
	}

	const roleParts = [userSettings?.role, userSettings?.title].filter(Boolean)
	if (roleParts.length > 0) {
		lines.push(`Role: ${roleParts.join(" • ")}`)
	}

	const companyParts = [userSettings?.company_name, userSettings?.industry].filter(Boolean)
	if (companyParts.length > 0) {
		lines.push(`Company: ${companyParts.join(" • ")}`)
	}

	const goalSummary = summarizeTrialGoals(userSettings?.trial_goals)
	if (goalSummary) {
		lines.push(`Research focus: ${goalSummary}`)
	}

	if (lines.length === 0) {
		return "Role and company unknown; assume general cross-functional stakeholder."
	}

	return lines.join("\n")
}

function summarizeTrialGoals(value: unknown): string | null {
	const collected: string[] = []
	const maxItems = 3
	const skipIdRegex = /^fc_[a-z0-9]+$/i

	const visit = (node: unknown) => {
		if (node == null || collected.length >= maxItems) return
		if (typeof node === "string") {
			const trimmed = node.trim()
			if (!trimmed || skipIdRegex.test(trimmed)) return
			if (!collected.includes(trimmed)) {
				collected.push(trimmed)
			}
			return
		}
		if (typeof node === "number" || typeof node === "boolean") {
			const text = String(node)
			if (!collected.includes(text)) {
				collected.push(text)
			}
			return
		}
		if (Array.isArray(node)) {
			for (const item of node) {
				if (collected.length >= maxItems) break
				visit(item)
			}
			return
		}
		if (typeof node === "object") {
			for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
				if (collected.length >= maxItems) break
				const loweredKey = key.toLowerCase()
				if (loweredKey === "id" || loweredKey.endsWith("_id")) continue
				visit(val)
			}
		}
	}

	visit(value)
	if (collected.length === 0) return null
	return collected.join("; ")
}
