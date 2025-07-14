import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import TreeMap from "~/components/charts/TreeMap"
import { db } from "~/utils/supabase.server"
import type { Database } from "~/../supabase/types"
import consola from "consola"

export const meta: MetaFunction = () => {
	return [{ title: "Themes | Insights" }, { name: "description", content: "Explore insight themes" }]
}

export async function loader() {
	consola.info('Loading themes from database')
	
	// Fetch themes from database
	const { data: themesData, error: themesError } = await db
		.from("themes")
		.select("*")
		.order("category")

	if (themesError) {
		consola.error(`Error fetching themes: ${themesError.message}`)
		throw new Response(`Error fetching themes: ${themesError.message}`, { status: 500 })
	}

	if (!themesData || themesData.length === 0) {
		consola.warn('No themes found in database')
		return { themeTree: [] }
	}

	// Count insights per theme for sizing
	const { data: insightsData, error: insightsError } = await db
		.from("insights")
		.select("category")

	if (insightsError) {
		consola.error(`Error fetching insights: ${insightsError.message}`)
	}

	// Count insights per theme category
	const categoryCounts = new Map<string, number>()
	insightsData?.forEach((insight: { category: string | null }) => {
		if (insight.category) {
			const count = categoryCounts.get(insight.category) || 0
			categoryCounts.set(insight.category, count + 1)
		}
	})

	// Define theme node type
	type ThemeNode = {
		name: string;
		value: number;
		fill: string;
		id: string;
	}

	// Group themes by category
	const categoryMap = new Map<string, ThemeNode[]>()
	themesData.forEach((theme: Database["public"]["Tables"]["themes"]["Row"]) => {
		const category = theme.category || "Uncategorized"
		if (!categoryMap.has(category)) {
			categoryMap.set(category, [])
		}
		
		categoryMap.get(category)?.push({
			name: theme.name,
			value: categoryCounts.get(theme.name) || 10, // Default value if no insights
			fill: theme.color_hex || `#${Math.floor(Math.random()*16777215).toString(16)}`, // Use theme color or generate random
			id: theme.id
		})
	})

	// Create tree structure for visualization
	const themeTree = Array.from(categoryMap.entries()).map(([category, themes]) => {
		// Sum values of all themes in this category
		const totalValue = themes.reduce((sum, theme) => sum + theme.value, 0)
		
		return {
			name: category,
			value: totalValue,
			fill: themes[0]?.fill || "#6b7280", // Use first theme's color or default gray
			children: themes
		}
	})

	consola.success(`Successfully loaded ${themesData.length} themes in ${categoryMap.size} categories`)
	return { themeTree }
}

export default function Themes() {
	const { themeTree } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Themes</h1>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
			</div>

			<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<h2 className="mb-4 font-semibold text-xl">Theme Distribution</h2>
				<div className="h-[500px]">
					<TreeMap
						data={themeTree}
						height={500}
						onClick={(node) => {
							if (node && !node.children) {
								// Navigate to specific theme using ID if available
								const themeId = node.id || node.name.toLowerCase().replace(/\s+/g, "-")
								window.location.href = `/themes/${themeId}`
							}
						}}
					/>
				</div>
			</div>

			<div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{themeTree.flatMap((category) =>
					category.children?.map((theme) => (
						<Link
							key={theme.name}
							to={`/themes/${theme.id || theme.name.toLowerCase().replace(/\s+/g, "-")}`}
							className="rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900"
						>
							<div className="flex items-center">
								<div className="mr-2 h-4 w-4 rounded-full" style={{ backgroundColor: theme.fill }} />
								<h3 className="font-medium text-lg">{theme.name}</h3>
							</div>
							<p className="mt-2 text-gray-500 dark:text-gray-400">{theme.value} insights</p>
						</Link>
					))
				)}
			</div>
		</div>
	)
}
