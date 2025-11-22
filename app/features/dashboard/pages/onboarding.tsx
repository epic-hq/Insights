import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import type { Database } from "~/../supabase/types"
import type { TreeNode } from "~/components/charts/TreeMap"
import Dashboard from "~/features/dashboard/components/Dashboard"
import type { KPI } from "~/features/dashboard/components/KPIBar"
import { getPersonas } from "~/features/personas/db"
import { getServerClient } from "~/lib/supabase/client.server"
import type { InsightView, OpportunityView } from "~/types"

export const meta: MetaFunction = () => {
	return [{ title: "Insights Dashboard" }, { name: "description", content: "Insights for conversations" }]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	// Fetch KPIs - count of interviews, insights, and opportunities
	const { count: interviewCount } = await supabase
		.from("interviews")
		.select("id", { count: "exact", head: true })
		.eq("account_id", accountId)

	const { count: insightCount } = await supabase
		.from("themes")
		.select("id", { count: "exact", head: true })
		.eq("account_id", accountId)

	const { count: opportunityCount } = await supabase
		.from("opportunities")
		.select("id", { count: "exact", head: true })
		.eq("account_id", accountId)

	// Define KPIs with live counts
	const kpis: KPI[] = [
		{ label: "Interviews", value: interviewCount?.toString() || "0", href: "/interviews", icon: "interviews" },
		{ label: "Insights", value: insightCount?.toString() || "0", href: "/insights", icon: "insights" },
		{
			label: "Opportunities",
			value: opportunityCount?.toString() || "0",
			href: "/opportunities",
			icon: "opportunities",
		},
	]

	// Fetch personas with counts
	const { data, error } = await getPersonas({ supabase, accountId })

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
			href: `/personas/${p.id}`,
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

	// Fetch insights with their tags from junction table
	const { data: insightTagRows } = await supabase
		.from("insight_tags")
		.select("tag, insight_id")
		.eq("account_id", accountId)

	const tagInsightIds = insightTagRows?.map((row) => row.insight_id).filter((id): id is string => Boolean(id)) || []
	const { data: themeNames } =
		tagInsightIds.length > 0
			? await supabase.from("themes").select("id, name").in("id", tagInsightIds)
			: { data: [], error: null }

	const nameMap = new Map(themeNames?.map((row) => [row.id, row.name || ""]))

	const insightTags =
		insightTagRows?.map((row) => ({
			tag: row.tag,
			insights: row.insight_id
				? {
						id: row.insight_id,
						name: nameMap.get(row.insight_id) || "",
						title: nameMap.get(row.insight_id) || "",
					}
				: null,
		})) || []

	// Debug logging
	// consola.log("Dashboard Debug:", {
	// 	insightRowsCount: insightRows?.length || 0,
	// 	insightTagsCount: insightTags?.length || 0,
	// 	personaRowsCount: data?.length || 0,
	// })

	// Group insights by tags using junction table data
	const tagMap = new Map<string, TreeNode>()

	// Process insight-tag relationships
	if (insightTags) {
		insightTags.forEach(
			(record: { tag: string | null; insights: { id: string; name?: string; title?: string } | null }) => {
				const tag = record.tag
				const insight = record.insights

				if (!tag || !insight) {
					return
				}

				if (!tagMap.has(tag)) {
					tagMap.set(tag, {
						name: tag,
						value: 0,
						children: [],
						fill: "",
					})
				}

				const tagNode = tagMap.get(tag)
				if (tagNode) {
					tagNode.value += 1
					tagNode.children?.push({
						name: insight.name || insight.title || `Insight ${insight.id.slice(0, 6)}`,
						value: 1,
						fill: "",
					})
				}
			}
		)
	}

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

	return (
		<div>
			<div className="relative">
				<Dashboard {...data} />
			</div>
		</div>
	)
}
