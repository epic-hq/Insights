import { type MetaFunction, useLoaderData } from "react-router"
import type { TreeNode } from "~/components/charts/TreeMap"

import ThemeDetail from "~/components/themes/ThemeDetail"
import { db } from "~/lib/supabase/server"
import type { InsightView, Theme } from "~/types"

export const meta: MetaFunction = () => {
	return [{ title: "Theme | Insights" }, { name: "description", content: "Insights related to this theme" }]
}

export async function loader({ params }: { params: { themeId: string } }) {
	const themeId = params.themeId

	// Fetch the current theme by ID
	const { data: themeData, error: themeError } = await db.from("themes").select("*").eq("id", themeId).single()

	if (themeError || !themeData) {
		throw new Response(`Theme with ID '${themeId}' not found`, { status: 404 })
	}

	// Fetch insights related to this theme
	const { data: insights } = await db
		.from("insights")
		.select("*")
		.or(`category.ilike.${themeData.name},tags.cs.{${themeData.name}}`) // Search in category or tags

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
		themeName: themeData.name,
		insights: insightViews,
		interviews: interviews || [],
		themeTree,
		theme: themeData,
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
