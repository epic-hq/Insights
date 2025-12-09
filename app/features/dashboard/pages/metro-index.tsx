/**
 * Dashboard Page - Project overview with lens results
 *
 * State-aware dashboard that adapts to project progress:
 * - Empty: Guides users to setup goals or upload content
 * - Processing: Shows progress indicator
 * - Has Data: Displays lens results and AI insights
 */

import { useState } from "react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { ChatSheet } from "~/components/chat/ChatSheet"
import { PageContainer } from "~/components/layout/PageContainer"
import { useCurrentProject } from "~/contexts/current-project-context"
import { DashboardV2 } from "~/features/dashboard/components/DashboardV2"
import type { LensSummary } from "~/features/dashboard/components/LensResultsGrid"
import { PLATFORM_DEFAULT_LENS_KEYS } from "~/features/opportunities/stage-config"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction = () => [{ title: "Dashboard | Insights" }]

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	// Fetch project
	const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single()

	if (!project) {
		throw new Response("Project not found", { status: 404 })
	}

	// Create route helpers
	const routes = createProjectRoutes(accountId, projectId)

	// Fetch counts and data in parallel
	const [interviewsResult, lensTemplatesResult, lensAnalysesResult, projectSectionsResult] = await Promise.all([
		// Get interviews with status
		supabase
			.from("interviews")
			.select("id, status, participant_pseudonym")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false }),

		// Get active lens templates
		supabase
			.from("conversation_lens_templates")
			.select("template_key, template_name, summary, category")
			.eq("is_active", true)
			.order("display_order", { ascending: true }),

		// Get lens analyses counts per template for this project
		supabase
			.from("conversation_lens_analyses")
			.select("template_key, interview_id, status")
			.eq("project_id", projectId),

		// Check if goals are set up
		supabase
			.from("project_sections")
			.select("id, kind")
			.eq("project_id", projectId)
			.in("kind", ["customer_problem", "research_goal", "decision_questions"]),
	])

	const interviews = interviewsResult.data || []
	const lensTemplates = lensTemplatesResult.data || []
	const lensAnalyses = lensAnalysesResult.data || []
	const projectSections = projectSectionsResult.data || []

	// Calculate conversation count
	const conversationCount = interviews.length

	// Calculate processing count (only valid processing statuses from interview_status enum)
	const processingCount = interviews.filter((i) =>
		["uploading", "processing", "transcribing"].includes(i.status || "")
	).length

	// Get enabled lenses from project settings or use defaults
	let enabledLenses: string[] = [...PLATFORM_DEFAULT_LENS_KEYS]
	if (project.project_settings) {
		const settings = project.project_settings as Record<string, unknown>
		if (Array.isArray(settings.enabled_lenses) && settings.enabled_lenses.length > 0) {
			enabledLenses = settings.enabled_lenses as string[]
		}
	}

	// Build lens summaries
	const lensAnalysesByTemplate = new Map<string, { count: number; completed: number }>()
	for (const analysis of lensAnalyses) {
		const existing = lensAnalysesByTemplate.get(analysis.template_key) || { count: 0, completed: 0 }
		existing.count++
		if (analysis.status === "completed") {
			existing.completed++
		}
		lensAnalysesByTemplate.set(analysis.template_key, existing)
	}

	const lensSummaries: LensSummary[] = lensTemplates
		.filter((t) => enabledLenses.includes(t.template_key))
		.map((template) => {
			const stats = lensAnalysesByTemplate.get(template.template_key) || { count: 0, completed: 0 }
			const hasData = stats.completed > 0

			// Build href based on template key - all lenses now have their own results page
			// Specific system lenses have dedicated routes, custom lenses use the generic route
			let href: string
			switch (template.template_key) {
				case "sales-bant":
					href = routes.lenses.salesBant()
					break
				case "customer-discovery":
					href = routes.lenses.customerDiscovery()
					break
				case "consulting-project":
					href = routes.lenses.consultingProject()
					break
				default:
					// All other lenses (including custom ones) use the generic route
					href = routes.lenses.byTemplateKey(template.template_key)
					break
			}

			return {
				templateKey: template.template_key,
				name: template.template_name,
				category: template.category || "general",
				conversationCount: stats.completed,
				summary: hasData ? `${stats.completed} conversation${stats.completed !== 1 ? "s" : ""} analyzed` : undefined,
				href,
				hasData,
			}
		})

	// Check if goals are set up
	const hasGoals = projectSections.length > 0

	// Build processing items for display
	const processingItems = interviews
		.filter((i) => ["uploading", "processing", "transcribing"].includes(i.status || ""))
		.map((i) => ({
			id: i.id,
			name: i.participant_pseudonym || "Processing...",
			status: i.status === "transcribing" || i.status === "processing" ? ("processing" as const) : ("queued" as const),
		}))

	// Generate a simple AI insight based on data
	let aiInsight: string | undefined
	if (conversationCount >= 3 && lensSummaries.some((l) => l.hasData)) {
		aiInsight = `You have ${conversationCount} conversations analyzed. Check your lens results for emerging patterns.`
	}

	return {
		accountId,
		projectId,
		project,
		conversationCount,
		processingCount,
		activeLensCount: enabledLenses.length,
		lensSummaries,
		hasGoals,
		processingItems,
		aiInsight,
	}
}

export default function DashboardPage() {
	const {
		accountId,
		projectId,
		project,
		conversationCount,
		processingCount,
		activeLensCount,
		lensSummaries,
		hasGoals,
		processingItems,
		aiInsight,
	} = useLoaderData<typeof loader>()

	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Chat modal state
	const [isChatOpen, setIsChatOpen] = useState(false)

	// Build system context for chat
	const systemContext = `Project: ${project?.name || "Unknown"}
Conversations: ${conversationCount}
Active Lenses: ${activeLensCount}`

	return (
		<PageContainer size="lg" className="py-6">
			<DashboardV2
				projectName={project?.name || "Untitled Project"}
				projectId={projectId}
				accountId={accountId}
				conversationCount={conversationCount}
				activeLensCount={activeLensCount}
				lenses={lensSummaries}
				processingItems={processingItems}
				processingCount={processingCount}
				hasGoals={hasGoals}
				aiInsight={aiInsight}
				routes={{
					setup: routes.projects.setup(),
					interviews: routes.interviews.index(),
					upload: routes.interviews.upload(),
					lensLibrary: routes.lensLibrary(),
					assistant: `${projectPath}/assistant`,
				}}
			/>

			{/* Chat Sheet */}
			<ChatSheet
				open={isChatOpen}
				onOpenChange={setIsChatOpen}
				accountId={accountId}
				projectId={projectId}
				systemContext={systemContext}
			/>
		</PageContainer>
	)
}
