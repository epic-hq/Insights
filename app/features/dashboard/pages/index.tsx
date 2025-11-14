import consola from "consola"
import { Link, type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import type { Database } from "~/../supabase/types"
import TagDisplay from "~/components/TagDisplay"
import type { TreeNode } from "~/components/charts/TreeMap"
import { Button } from "~/components/ui/button"
import Dashboard from "~/features/dashboard/components/Dashboard"
import KPIBar, { type KPI } from "~/features/dashboard/components/KPIBar"
import RecentInterviewsTable from "~/features/dashboard/components/RecentInterviewsTable"
import { getPersonas } from "~/features/personas/db"
import AddInterviewButton from "~/features/upload/components/AddInterviewButton"
import { userContext } from "~/server/user-context"

import type { InsightView, OpportunityView } from "~/types"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction = () => {
	return [{ title: "Insights Dashboard" }, { name: "description", content: "Insights for conversations" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	// Fetch project
	const { data: project } = await supabase
		.from("projects")
		.select("*")
		.eq("account_id", accountId)
		.eq("id", projectId)
		.single()

	if (!project) {
		throw new Response("Project not found", { status: 404 })
	}

	// Fetch project sections for overview
	const { data: projectSections } = await supabase
		.from("project_sections")
		.select("*")
		.eq("project_id", projectId)
		.in("kind", ["goal", "research_goal", "target_market", "assumptions", "recommendations", "research_goal_details"])

	// Fetch KPIs - count of interviews, insights, and opportunities
	const { count: interviewCount } = await supabase
		.from("interviews")
		.select("id", { count: "exact", head: true })
		.eq("account_id", accountId)
		.eq("project_id", projectId)

	const { count: insightCount } = await supabase
		.from("themes")
		.select("id", { count: "exact", head: true })
		.eq("account_id", accountId)
		.eq("project_id", projectId)

	const { count: opportunityCount } = await supabase
		.from("opportunities")
		.select("id", { count: "exact", head: true })
		.eq("account_id", accountId)
		.eq("project_id", projectId)

	// Create route helpers for server-side use
	const routes = createProjectRoutes(accountId, projectId)

	// Define KPIs with live counts
	const kpis: KPI[] = [
		{
			label: "Interviews",
			value: interviewCount?.toString() || "0",
			href: routes.interviews.index(),
			icon: "interviews",
		},
		{ label: "Insights", value: insightCount?.toString() || "0", href: routes.insights.index(), icon: "insights" },
		{
			label: "Opportunities",
			value: opportunityCount?.toString() || "0",
			href: routes.opportunities.index(),
			icon: "opportunities",
		},
	]

	// Fetch personas with counts
	const { data, error } = await getPersonas({ supabase, accountId, projectId })

	// Transform personas into the expected format
	const personas = (data || []).map((p, index) => {
		// Generate a color based on index if not available in database
		const colors = ["#2563EB", "#14B8A6", "#E11D48", "#8B5CF6", "#F59E0B"]
		const colorValue = p.color_hex || colors[index % colors.length]

		return {
			...p,
			percentage: p.percentage || 33, // Use DB value or default
			count: 10, // This would ideally be calculated based on actual data
			color: colorValue,
			href: routes.personas.detail(p.id),
			slices: [
				{ name: "Feature Usage", value: 60, color: colorValue },
				{ name: "Feedback", value: 40, color: lightenColor(colorValue, 40) },
			],
		}
	})

	// Fetch recent interviews
	type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]
	const { data: interviewRows } = await supabase
		.from("interviews")
		.select("id,created_at,participant_pseudonym,status,updated_at")
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })
		.limit(5)

	// Transform interviews into the expected format
	const interviews = (interviewRows || []).map(
		(interview: Pick<InterviewRow, "id" | "created_at" | "participant_pseudonym" | "status" | "updated_at">) => ({
			id: interview.id,
			date: new Date(interview.created_at).toISOString().split("T")[0],
			participant: interview.participant_pseudonym || "Unknown",
			status: interview.status as "transcribed" | "processing" | "ready",
		})
	)

	// Fetch opportunities
	type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"]
	const { data: opportunityRows } = await supabase.from("opportunities").select("*").eq("account_id", accountId)

	// Transform opportunities into the expected format
	const opportunities: OpportunityView[] = (opportunityRows || []).map((o: OpportunityRow) => ({
		...o,
		owner: o.owner_id || "",
		status: o.kanban_status || "Explore",
		impact: 3, // Default value
		effort: 2, // Default value
		description: "",
	}))

	// Fetch insights for the theme tree
	const { data: insightRows } = await supabase.from("themes").select("*").eq("account_id", accountId).limit(10)

	// Transform insights into the expected format
	const insights: InsightView[] = (insightRows || []).map((insight) => ({
		id: insight.id,
		name: insight.name || "",
		tag: "", // No tag field in DB schema
		category: insight.category || "",
		journeyStage: insight.journey_stage || "",
		impact: insight.impact,
		novelty: insight.novelty,
		jtbd: insight.jtbd,
		underlyingMotivation: "", // No motivation field in DB schema
		pain: insight.pain,
		desiredOutcome: insight.desired_outcome,
		description: "", // No description field in DB schema
		evidence: "", // No evidence field in DB schema
		opportunityIdeas: insight.opportunity_ideas,
		confidence: insight.confidence,
		createdAt: insight.created_at,
		// relatedTags: removed - now using insight_tags junction table
		contradictions: insight.contradictions,
	}))

	// Debug: Check if insight_tags table has any data at all
	const { data: allInsightTags, error: allTagsError } = await supabase.from("insight_tags").select("*").limit(5)

	consola.debug("All insight_tags sample:", { allInsightTags, allTagsError })

	// Debug: Check insight_tags for this account
	const { data: accountInsightTags, error: accountTagsError } = await supabase
		.from("insight_tags")
		.select("*")
		.eq("account_id", accountId)
		.limit(5)

	consola.debug("Account insight_tags:", { accountInsightTags, accountTagsError, accountId })

	// Debug: Check insight_tags for this project
	const { data: projectInsightTags, error: projectTagsError } = await supabase
		.from("insight_tags")
		.select("*")
		.eq("project_id", projectId)
		.limit(5)

	consola.debug("Project insight_tags:", { projectInsightTags, projectTagsError, projectId })

	// Fetch tags with frequency counts from insight_tags junction table
	const { data: tagFrequencyData, error: tagFrequencyError } = await supabase
		.from("insight_tags")
		.select("tag_id, tags(tag)")
		.eq("account_id", accountId)
		.eq("project_id", projectId)

	// consola.log("Tag frequency query:", { tagFrequencyData, tagFrequencyError, accountId, projectId })

	// Process tag frequency data into the format expected by TagDisplay
	type TagFrequency = { name: string; frequency: number }
	const tagFrequencyMap = new Map<string, number>()

	if (tagFrequencyData) {
		tagFrequencyData.forEach((record: { tag_id: string; tags: { tag: string } | null }) => {
			const tagName = record.tags?.tag
			if (tagName) {
				tagFrequencyMap.set(tagName, (tagFrequencyMap.get(tagName) || 0) + 1)
			}
		})
	}

	// Convert to array format expected by TagDisplay component
	const tags: TagFrequency[] = Array.from(tagFrequencyMap.entries())
		.map(([name, frequency]) => ({ name, frequency }))
		.sort((a, b) => b.frequency - a.frequency) // Sort by frequency descending

	// Debug logging
	// consola.log("Dashboard Debug:", {
	// 	insightRowsCount: insightRows?.length || 0,
	// 	tagFrequencyDataCount: tagFrequencyData?.length || 0,
	// 	tagsCount: tags.length,
	// 	personaRowsCount: data?.length || 0,
	// })

	// Group insights by tags for tree map (keeping existing logic)
	const tagMap = new Map<string, TreeNode>()

	// Process tag data for tree map visualization
	tags.forEach((tag) => {
		tagMap.set(tag.name, {
			name: tag.name,
			value: tag.frequency,
			children: [],
			fill: "",
		})
	})

	// Sort and apply colors to top N tags
	const baseColors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#6366f1"]
	const topN = 5

	const themeTree: TreeNode[] = Array.from(tagMap.values())
		.sort((a, b) => b.value - a.value)
		.slice(0, topN)
		.map((node, i) => {
			const color = baseColors[i % baseColors.length]
			node.fill = color
			node.children?.forEach((child, j) => {
				child.fill = lightenColor(color, 20 + j * 10)
			})
			return node
		})

	return {
		kpis,
		personas,
		interviews,
		opportunities,
		themeTree,
		insights,
		project,
		tags, // Add tags to the return object for TagDisplay
		projectSections: projectSections || [],
	}
}

// Helper function to lighten a color by a percentage
function lightenColor(hex: string, percent: number): string {
	// Remove the # if it exists
	const cleanHex = hex.replace("#", "")

	// Convert to RGB
	const r = Number.parseInt(cleanHex.substring(0, 2), 16)
	const g = Number.parseInt(cleanHex.substring(2, 4), 16)
	const b = Number.parseInt(cleanHex.substring(4, 6), 16)

	// Lighten
	const lightenAmount = percent / 100
	const lightenR = Math.round(r + (255 - r) * lightenAmount)
	const lightenG = Math.round(g + (255 - g) * lightenAmount)
	const lightenB = Math.round(b + (255 - b) * lightenAmount)

	// Convert back to hex
	const rHex = lightenR.toString(16).padStart(2, "0")
	const gHex = lightenG.toString(16).padStart(2, "0")
	const bHex = lightenB.toString(16).padStart(2, "0")

	return `#${rHex}${gHex}${bHex}`
}

export default function Index() {
	const data = useLoaderData<typeof loader>()

	// Helper to get section content by kind
	const getSection = (kind: string) => {
		return data.projectSections.find((s) => s.kind === kind)?.content_md || ""
	}

	const goal = getSection("research_goal") || getSection("goal")
	const goalDetails = getSection("research_goal_details")
	const targetMarket = getSection("target_market")
	const assumptions = getSection("assumptions")
	const recommendations = getSection("recommendations")

	return (
		<div className="space-y-6 p-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-3xl">{data.project.name}</h1>
					<p className="text-muted-foreground">Project Overview</p>
				</div>
				<Link to="../setup">
					<Button variant="outline">Edit Project Setup</Button>
				</Link>
			</div>

			{/* KPIs */}
			<KPIBar kpis={data.kpis} />

			{/* Key Information Grid */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Research Goal */}
				<div className="rounded-lg border bg-card p-6">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-xl">Research Goal</h2>
						<Link to="../setup" className="text-primary text-sm hover:underline">
							Edit
						</Link>
					</div>
					{goal ? (
						<div className="prose prose-sm max-w-none">
							<p className="text-sm">{goal}</p>
							{goalDetails && <p className="mt-2 text-muted-foreground text-sm">{goalDetails}</p>}
						</div>
					) : (
						<p className="text-muted-foreground text-sm italic">No goal defined yet. Click Edit to add.</p>
					)}
				</div>

				{/* Target Market / ICP */}
				<div className="rounded-lg border bg-card p-6">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-xl">Target Market / ICP</h2>
						<Link to="../segments" className="text-primary text-sm hover:underline">
							View Segments
						</Link>
					</div>
					{targetMarket ? (
						<div className="prose prose-sm max-w-none">
							<p className="text-sm">{targetMarket}</p>
						</div>
					) : (
						<p className="text-muted-foreground text-sm italic">
							No target market defined. Visit{" "}
							<Link to="../segments" className="text-primary hover:underline">
								Segments
							</Link>{" "}
							to explore customer groups.
						</p>
					)}
				</div>

				{/* Assumptions */}
				<div className="rounded-lg border bg-card p-6">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-xl">Key Assumptions</h2>
						<Link to="../setup" className="text-primary text-sm hover:underline">
							Edit
						</Link>
					</div>
					{assumptions ? (
						<div className="prose prose-sm max-w-none">
							<p className="whitespace-pre-wrap text-sm">{assumptions}</p>
						</div>
					) : (
						<p className="text-muted-foreground text-sm italic">No assumptions documented yet.</p>
					)}
				</div>

				{/* Recommendations */}
				<div className="rounded-lg border bg-card p-6">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-xl">Recommendations</h2>
						<Link to="../insights" className="text-primary text-sm hover:underline">
							View All Findings
						</Link>
					</div>
					{recommendations ? (
						<div className="prose prose-sm max-w-none">
							<p className="whitespace-pre-wrap text-sm">{recommendations}</p>
						</div>
					) : (
						<p className="text-muted-foreground text-sm italic">
							No recommendations yet. Check{" "}
							<Link to="../insights" className="text-primary hover:underline">
								Findings
							</Link>{" "}
							for insights.
						</p>
					)}
				</div>
			</div>

			{/* Recent Activity */}
			<div className="grid gap-6 md:grid-cols-2">
				<div className="rounded-lg border bg-card p-6">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-xl">Recent Calls & Notes</h2>
						<Link to="../interviews" className="text-primary text-sm hover:underline">
							View All
						</Link>
					</div>
					{data.interviews.length > 0 ? (
						<RecentInterviewsTable rows={data.interviews} />
					) : (
						<div className="py-6 text-center">
							<p className="mb-3 text-muted-foreground text-sm">No interviews yet</p>
							<AddInterviewButton />
						</div>
					)}
				</div>

				<div className="rounded-lg border bg-card p-6">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-xl">Top Themes</h2>
						<Link to="../themes" className="text-primary text-sm hover:underline">
							View All
						</Link>
					</div>
					{data.tags.length > 0 ? (
						<TagDisplay tags={data.tags} maxTags={8} />
					) : (
						<p className="text-muted-foreground text-sm italic">No themes identified yet.</p>
					)}
				</div>
			</div>

			{/* Link to Full Dashboard */}
			<div className="flex justify-center pt-4">
				<Link to="./metro">
					<Button variant="outline" size="lg">
						View Detailed Analytics Dashboard
					</Button>
				</Link>
			</div>
		</div>
	)
}
