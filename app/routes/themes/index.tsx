import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import TreeMap from "~/components/charts/TreeMap"

export const meta: MetaFunction = () => {
	return [{ title: "Themes | Insights" }, { name: "description", content: "Explore insight themes" }]
}

// Mock data for demonstration purposes
export function loader() {
	return {
		themeTree: [
			{
				name: "User Experience",
				value: 100,
				fill: "#4f46e5",
				children: [
					{ name: "Navigation", value: 30, fill: "#6366f1" },
					{ name: "Performance", value: 40, fill: "#818cf8" },
					{ name: "Accessibility", value: 30, fill: "#a5b4fc" },
				],
			},
			{
				name: "Content",
				value: 80,
				fill: "#10b981",
				children: [
					{ name: "Assignments", value: 40, fill: "#34d399" },
					{ name: "Resources", value: 25, fill: "#6ee7b7" },
					{ name: "Feedback", value: 15, fill: "#a7f3d0" },
				],
			},
			{
				name: "Technical",
				value: 60,
				fill: "#f59e0b",
				children: [
					{ name: "Bugs", value: 25, fill: "#fbbf24" },
					{ name: "Performance Issues", value: 20, fill: "#fcd34d" },
					{ name: "Feature Requests", value: 15, fill: "#fde68a" },
				],
			},
		],
	}
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
								// Navigate to specific theme
								window.location.href = `/themes/${node.name.toLowerCase().replace(/\s+/g, "-")}`
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
							to={`/themes/${theme.name.toLowerCase().replace(/\s+/g, "-")}`}
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
