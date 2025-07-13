import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"

import InsightCard from "~/components/insights/InsightCard"
import InsightCardGrid from "~/components/insights/InsightCardGrid"

export const meta: MetaFunction = ({ params }) => {
	const themeName = params.themeId?.replace(/-/g, " ")
	return [
		{ title: `${themeName ? themeName.charAt(0).toUpperCase() + themeName.slice(1) : "Theme"} | Insights` },
		{ name: "description", content: `Insights related to ${themeName || "this theme"}` },
	]
}

// Mock data for demonstration purposes
import type { InsightCardProps } from "~/components/insights/InsightCard"

export function loader({ params }: { params: { themeId: string } }) {
	const themeId = params.themeId
	const themeName = themeId.replace(/-/g, " ")
	// const { data: insights } = supabase.from("insights").select("*").eq("theme_id", themeId)

	const insights: InsightCardProps[] = [] // TODO: replace with real query
	return {
		themeName: themeName.charAt(0).toUpperCase() + themeName.slice(1),
		insights,
	}
}

export default function ThemeDetail() {
	const { themeName, insights } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Link to="/themes" className="text-blue-600 hover:text-blue-800">
							Themes
						</Link>
						<span className="text-gray-500">/</span>
						<h1 className="font-bold text-2xl">{themeName}</h1>
					</div>
				</div>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
			</div>

			<div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<h2 className="mb-4 font-semibold text-xl">Theme Overview</h2>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<p className="text-gray-500 text-sm dark:text-gray-400">Total Insights</p>
						<p className="font-bold text-2xl">{insights.length}</p>
					</div>
					<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<p className="text-gray-500 text-sm dark:text-gray-400">Average Impact</p>
						<p className="font-bold text-2xl">Medium</p>
					</div>
					<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<p className="text-gray-500 text-sm dark:text-gray-400">Sentiment</p>
						<p className="font-bold text-2xl">Mixed</p>
					</div>
				</div>
			</div>

			<div className="mb-6">
				<h2 className="mb-4 font-semibold text-xl">Related Insights</h2>
				<InsightCardGrid>
					{insights.map((insight) => (
						<InsightCard key={insight.id} {...insight} />
					))}
				</InsightCardGrid>
			</div>
		</div>
	)
}
