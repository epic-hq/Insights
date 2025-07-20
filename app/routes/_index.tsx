import { type MetaFunction, useLoaderData } from "react-router"
import type { Database } from "~/../supabase/types"
import { AuthGuard } from "~/components/auth/AuthGuard"
import { UserProfile } from "~/components/auth/UserProfile"
import type { TreeNode } from "~/components/charts/TreeMap"
import Dashboard from "~/components/dashboard/Dashboard"
import type { KPI } from "~/components/dashboard/KPIBar"
import type { InsightView, OpportunityView } from "~/types"
import { db } from "~/utils/supabase.server"

export const meta: MetaFunction = () => {
	return [{ title: "Insights Dashboard" }, { name: "description", content: "Insights for conversations" }]
}

export async function loader() {
	// Fetch KPIs - count of interviews, insights, and opportunities
	const { count: interviewCount } = await db.from("interviews").select("*", { count: "exact", head: true })
	const { count: insightCount } = await db.from("insights").select("*", { count: "exact", head: true })
	const { count: opportunityCount } = await db.from("opportunities").select("*", { count: "exact", head: true })

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
	type PersonaRow = Database["public"]["Tables"]["personas"]["Row"]
	const { data: personaRows } = await db.from("personas").select("*")

	// Transform personas into the expected format
	const personas = (personaRows || []).map((p: PersonaRow, index) => {
		// Generate a color based on index if not available in database
		const colors = ["#2563EB", "#14B8A6", "#E11D48", "#8B5CF6", "#F59E0B"]
		const colorValue = p.color_hex || colors[index % colors.length]

		return {
			name: p.name,
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
	const { data: interviewRows } = await db
		.from("interviews")
		.select("*")
		.order("created_at", { ascending: false })
		.limit(5)

	// Transform interviews into the expected format
	const interviews = (interviewRows || []).map((interview: InterviewRow) => ({
		id: interview.id,
		date: new Date(interview.created_at).toISOString().split("T")[0],
		participant: interview.participant_pseudonym || "Unknown",
		status: interview.status as "transcribed" | "processing" | "ready",
	}))

	// Fetch opportunities
	type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"]
	const { data: opportunityRows } = await db.from("opportunities").select("*")

	// Transform opportunities into the expected format
	const opportunities: OpportunityView[] = (opportunityRows || []).map((o: OpportunityRow) => ({
		...o,
		owner: o.owner_id || "",
		status: o.kanban_status || "Explore",
		impact: 3, // Default value
		effort: 2, // Default value
		description: "",
	}))

	// Fetch insights for filters/search
	const { data: insightRows } = await db.from("insights").select("*").limit(10)

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
		underlyingMotivation: "", // No underlying_motivation field in DB schema
		pain: insight.pain,
		desiredOutcome: insight.desired_outcome,
		description: "", // No description field in DB schema
		evidence: "", // No evidence field in DB schema
		opportunityIdeas: insight.opportunity_ideas,
		confidence: insight.confidence,
		createdAt: insight.created_at,
		relatedTags: [], // No related_tags field in DB schema
		contradictions: insight.contradictions,
	}))

	// // Fetch real insights
	// const { data: insights } = await db
	// .from("insights")
	// .select("id, category, name, title")
	// .not("category", "is", null)

	if (!insights) throw new Error("No insights found")

	// Group insights by category
	const categoryMap = new Map<string, TreeNode>()

	insights.forEach((insight: InsightView) => {
		const category = insight.category!
		if (!categoryMap.has(category)) {
			categoryMap.set(category, {
				name: category,
				value: 0,
				children: [],
				fill: "",
			})
		}

		const categoryNode = categoryMap.get(category)!
		categoryNode.value += 1
		categoryNode.children?.push({
			name: insight.name || insight.title || `Insight ${insight.id.slice(0, 6)}`,
			value: 1,
			fill: "",
		})
	})

	// Sort and apply colors to top N categories
	const baseColors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#6366f1"]
	const topN = 5

	const themeTree: TreeNode[] = Array.from(categoryMap.values())
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
			<AuthGuard>
				<div className="relative">
					{/* User profile in top right corner */}
					<div className="absolute top-4 right-4 z-10">
						<UserProfile />
					</div>
					<Dashboard {...data} />
				</div>
			</AuthGuard>
		</div>
	)
}
