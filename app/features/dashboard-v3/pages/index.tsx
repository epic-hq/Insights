/**
 * Dashboard V3 Page - Redesigned project dashboard
 *
 * State-aware dashboard that adapts to project data:
 * - Empty: Shows onboarding experience (no sidebar)
 * - Processing: Shows progress with partial dashboard
 * - Active: Full dashboard with tasks, insights, and lens feed
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import { useCurrentProject } from "~/contexts/current-project-context"
import type { LensSummary } from "~/features/dashboard/components/LensResultsGrid"
import { DashboardShell } from "~/features/dashboard-v3/components/DashboardShell"
import type { LensActivityItem } from "~/features/dashboard-v3/components/sections/LensFeed"
import { PLATFORM_DEFAULT_LENS_KEYS } from "~/features/opportunities/stage-config"
import { getTopFocusTasks, updateTask } from "~/features/tasks/db"
import type { TaskStatus } from "~/features/tasks/types"
import { userContext } from "~/server/user-context"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction = () => [{ title: "Dashboard | UpSight Customer Intelligence" }]

/**
 * Hide the ProjectStatusAgent panel on this route only if we are in onboarding state (empty).
 * Once the project has data (active/processing) OR goals (setup complete), we show the agent.
 */
export const handle = {
	hideProjectStatusAgent: (
		data: { conversationCount?: number; processingCount?: number; hasGoals?: boolean } | undefined
	) => {
		if (!data) return true
		// Hide if no data AND no goals (pure empty state)
		// Show if we have conversations, processing items, OR goals
		return (data.conversationCount || 0) === 0 && (data.processingCount || 0) === 0 && !data.hasGoals
	},
}

// ============================================================================
// Action - Handle task status updates
// ============================================================================

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const userId = ctx.claims?.sub

	if (!supabase || !userId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const formData = await request.formData()
	const actionType = formData.get("_action") as string

	if (actionType === "update-task-status") {
		const taskId = formData.get("taskId") as string
		const newStatus = formData.get("status") as TaskStatus

		if (!taskId || !newStatus) {
			throw new Response("Missing taskId or status", { status: 400 })
		}

		await updateTask({
			supabase,
			taskId,
			userId,
			updates: { status: newStatus },
		})

		return { success: true }
	}

	throw new Response("Invalid action", { status: 400 })
}

// ============================================================================
// Loader
// ============================================================================

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

	// Fetch all data in parallel
	const [
		interviewsResult,
		lensTemplatesResult,
		lensAnalysesResult,
		recentLensActivityResult,
		projectSectionsResult,
		tasksResult,
		insightsResult,
	] = await Promise.all([
		// Get interviews with status
		supabase
			.from("interviews")
			.select("id, status, participant_pseudonym, source_type, interview_type, media_type")
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

		// Get recent completed lens analyses for activity feed
		supabase
			.from("conversation_lens_analyses")
			.select(`
				id,
				interview_id,
				template_key,
				analysis_data,
				processed_at,
				interviews!inner(participant_pseudonym)
			`)
			.eq("project_id", projectId)
			.eq("status", "completed")
			.not("processed_at", "is", null)
			.order("processed_at", { ascending: false })
			.limit(10),

		// Get project sections for setup progress
		supabase
			.from("project_sections")
			.select("id, kind, content_md, meta")
			.eq("project_id", projectId)
			.in("kind", [
				"customer_problem",
				"research_goal",
				"decision_questions",
				"target_roles",
				"target_orgs",
				"assumptions",
				"unknowns",
			]),

		// Get tasks for this project
		getTopFocusTasks({
			supabase,
			accountId,
			projectId,
			limit: 10,
		}),

		// Get insights (themes) for this project
		supabase
			.from("themes")
			.select("*")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false })
			.limit(10),
	])

	const interviews = interviewsResult.data || []
	const lensTemplates = lensTemplatesResult.data || []
	const lensAnalyses = lensAnalysesResult.data || []
	const recentLensActivity = recentLensActivityResult.data || []
	const projectSections = projectSectionsResult.data || []
	const tasks = tasksResult || []
	const insights = insightsResult.data || []

	const conversations = interviews.filter(
		(i) => !(i.source_type === "note" || i.interview_type === "note" || i.media_type === "note")
	)

	// Create a map of template_key -> template info for quick lookup
	const templateMap = new Map(
		lensTemplates.map((t) => [t.template_key, { name: t.template_name, category: t.category || "general" }])
	)

	// Calculate conversation count
	const conversationCount = conversations.length

	// Calculate processing count
	const processingCount = conversations.filter((i) =>
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

			// Build href based on template key
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

	// Check if lenses are configured (beyond defaults)
	const hasLenses = enabledLenses.length > 0

	// Get research goal text
	const researchGoalSection = projectSections.find((s) => s.kind === "research_goal")
	const researchGoal = researchGoalSection?.content_md || undefined

	// Build project context for setup progress
	const getArrayFromSection = (kind: string): string[] => {
		const section = projectSections.find((s) => s.kind === kind)
		const meta = section?.meta as Record<string, unknown> | null
		const value = meta?.[kind]
		if (Array.isArray(value)) return value.filter((v) => typeof v === "string")
		return []
	}

	const projectContext = {
		research_goal: researchGoal || null,
		target_roles: getArrayFromSection("target_roles"),
		target_orgs: getArrayFromSection("target_orgs"),
		assumptions: getArrayFromSection("assumptions"),
		unknowns: getArrayFromSection("unknowns"),
	}

	// Build activity feed items from recent lens analyses
	const activityFeedItems: LensActivityItem[] = recentLensActivity.map((analysis) => {
		const template = templateMap.get(analysis.template_key)
		const analysisData = analysis.analysis_data as Record<string, unknown> | null

		// Extract a key takeaway from analysis_data
		// Look for common patterns: executive_summary, key_insights, summary, or first section
		let keyTakeaway: string | null = null
		if (analysisData) {
			// Try different common summary fields
			if (typeof analysisData.executive_summary === "string") {
				keyTakeaway = analysisData.executive_summary
			} else if (typeof analysisData.summary === "string") {
				keyTakeaway = analysisData.summary
			} else if (Array.isArray(analysisData.key_insights) && analysisData.key_insights.length > 0) {
				keyTakeaway = String(analysisData.key_insights[0])
			} else if (analysisData.sections && typeof analysisData.sections === "object") {
				// Try to get first meaningful text from sections
				const sections = analysisData.sections as Record<string, unknown>
				for (const section of Object.values(sections)) {
					if (section && typeof section === "object") {
						const sectionData = section as Record<string, unknown>
						// Look for common text fields in sections
						for (const field of ["summary", "description", "overview", "problem_statement", "client_problem"]) {
							if (typeof sectionData[field] === "string" && sectionData[field]) {
								keyTakeaway = String(sectionData[field])
								break
							}
						}
						if (keyTakeaway) break
					}
				}
			}
		}

		// Truncate takeaway if too long
		if (keyTakeaway && keyTakeaway.length > 150) {
			keyTakeaway = `${keyTakeaway.substring(0, 147)}...`
		}

		// Get interview title from nested join
		const interviewData = analysis.interviews as { participant_pseudonym: string | null } | null
		const interviewTitle = interviewData?.participant_pseudonym || "Untitled Conversation"

		return {
			id: analysis.id,
			interviewId: analysis.interview_id,
			interviewTitle,
			templateKey: analysis.template_key,
			templateName: template?.name || analysis.template_key,
			category: template?.category || "general",
			keyTakeaway,
			processedAt: analysis.processed_at || "",
		}
	})

	return {
		accountId,
		projectId,
		project,
		conversationCount,
		processingCount,
		activeLensCount: enabledLenses.length,
		lensSummaries,
		recentActivity: activityFeedItems,
		hasGoals,
		hasLenses,
		researchGoal,
		projectContext,
		tasks,
		insights,
	}
}

export default function DashboardV3Page() {
	const {
		project,
		conversationCount,
		processingCount,
		activeLensCount,
		lensSummaries,
		recentActivity,
		hasGoals,
		hasLenses,
		researchGoal,
		projectContext,
		tasks,
		insights,
	} = useLoaderData<typeof loader>()

	const { projectPath } = useCurrentProject()

	return (
		<PageContainer size="xl" className="py-6">
			<DashboardShell
				projectName={project?.name || "Untitled Project"}
				projectPath={projectPath || ""}
				conversationCount={conversationCount}
				processingCount={processingCount}
				activeLensCount={activeLensCount}
				hasGoals={hasGoals}
				hasLenses={hasLenses}
				researchGoal={researchGoal}
				projectContext={projectContext}
				tasks={tasks}
				insights={insights}
				lenses={lensSummaries}
				recentActivity={recentActivity}
			/>
		</PageContainer>
	)
}
