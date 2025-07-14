import { type MetaFunction, useLoaderData } from "react-router"
import type { TreeNode } from "~/components/charts/TreeMap"

import ThemeDetail from "~/components/themes/ThemeDetail"
import type { InsightView, Interview, Theme } from "~/types"
import { db } from "~/utils/supabase.server"

export const meta: MetaFunction = ({ params }) => {
	const themeName = params.themeId?.replace(/-/g, " ")
	return [
		{ title: `${themeName ? themeName.charAt(0).toUpperCase() + themeName.slice(1) : "Theme"} | Insights` },
		{ name: "description", content: `Insights related to ${themeName || "this theme"}` },
	]
}

export async function loader({ params }: { params: { themeId: string } }) {
	const themeId = params.themeId
	const themeName = themeId.replace(/-/g, " ")

	// Fetch insights from database
	const { data: insights } = await db
		.from("insights")
		.select("*")
		.or(`category.ilike.${themeName},tags.cs.{${themeName}}`) // Search in category or tags

	// Fetch interviews that are referenced by these insights
	const interviewIds =
		insights?.filter((insight) => insight.interview_id !== null).map((insight) => insight.interview_id as string) || []

	const { data: interviews } = await db.from("interviews").select("*").in("id", interviewIds)

	// Fetch theme tree for navigation context
	const { data: themes } = await db.from("themes").select("*").order("name")

	// Transform themes into TreeNode structure
	const themeTree = transformThemesToTreeNodes(themes || [])

	// Transform insights to InsightView
	const insightViews: InsightView[] = (insights || []).map((insight) => ({
		id: insight.id,
		name: insight.name,
		title: insight.name,
		category: insight.category,
		jtbd: insight.jtbd,
		underlyingMotivation: null, // Field not in DB schema
		pain: insight.pain,
		desiredOutcome: insight.desired_outcome,
		description: null, // Field not in DB schema
		evidence: null, // Field not in DB schema
		confidence: insight.confidence,
		novelty: insight.novelty,
		impact: insight.impact,
		relatedTags: insight.tags ? insight.tags : [],
		interview_id: insight.interview_id,
	}))

	return {
		themeName: themeName.charAt(0).toUpperCase() + themeName.slice(1),
		insights: insightViews,
		interviews: interviews || [],
		themeTree,
	}
}

// Helper function to transform themes into TreeNode structure
function transformThemesToTreeNodes(themes: Theme[]): TreeNode[] {
	// Group themes by category
	const categoriesMap: Record<string, Theme[]> = {}
	themes.forEach((theme) => {
		const category = theme.category || "Uncategorized"
		if (!categoriesMap[category]) {
			categoriesMap[category] = []
		}
		categoriesMap[category].push(theme)
	})

	// Transform into TreeNode structure
	return Object.entries(categoriesMap).map(([category, themes]) => ({
		name: category,
		value: themes.length,
		fill: "#cccccc", // Default fill for category
		children: themes.map((theme) => ({
			name: theme.name || "",
			value: 1,
			fill: theme.color_hex || "#cccccc",
		})),
	}))
}

export default function ThemeDetailPage() {
	const { insights, interviews, themeTree } = useLoaderData<typeof loader>()

	return <ThemeDetail insights={insights} interviews={interviews} themeTree={themeTree} />
}
