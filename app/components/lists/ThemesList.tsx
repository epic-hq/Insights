import React, { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import PageHeader from "../navigation/PageHeader"
// No need to import sampleData here as we receive themeTree as props

// Import types
import type { TreeNode } from "../charts/TreeMap"

interface ThemesListProps {
	themeTree: TreeNode[]
}

export default function ThemesList({ themeTree }: ThemesListProps) {
	const [groupBy, setGroupBy] = useState<"none" | "category" | "journeyStage">("none")

	// Flatten theme tree to get all themes
	const allThemes = useMemo(() => {
		const themes: { name: string; value: number; fill: string }[] = []

		themeTree.forEach((category) => {
			if (category.children) {
				category.children.forEach((theme) => {
					themes.push({
						name: theme.name,
						value: theme.value || 0, // Ensure value is never undefined
						fill: theme.fill || "#cccccc", // Provide default color if undefined
					})
				})
			}
		})

		return themes
	}, [themeTree])

	return (
		<div className="mx-auto max-w-7xl px-4 py-8">
			<PageHeader title="Themes" />

			<div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
				<p className="mb-4 text-gray-600 sm:mb-0 dark:text-gray-400">{allThemes.length} themes from user research</p>

				<div className="flex items-center">
					<label htmlFor="groupBy" className="mr-2 font-medium text-sm">
						Group by:
					</label>
					<select
						id="groupBy"
						value={groupBy}
						onChange={(e) => setGroupBy(e.target.value as "none" | "category" | "journeyStage")}
						className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
					>
						<option value="none">None</option>
						<option value="category">Category</option>
						<option value="journeyStage">Journey Stage</option>
					</select>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{themeTree.map((category) => (
					<React.Fragment key={category.name}>
						{groupBy === "category" && (
							<div className="col-span-full mt-4 mb-2">
								<h2 className="font-semibold text-xl">{category.name}</h2>
							</div>
						)}

						{category.children?.map((theme) => (
							<Link
								key={theme.name}
								to={`/themes/${theme.name.toLowerCase().replace(/\s+/g, "-")}`}
								className="rounded-lg bg-white p-4 shadow transition-shadow hover:shadow-md dark:bg-gray-900"
							>
								<div className="mb-2 flex items-center">
									<div className="mr-2 h-4 w-4 rounded-full" style={{ backgroundColor: theme.fill }} />
									<h3 className="font-medium">{theme.name}</h3>
								</div>
								<div className="flex justify-between text-gray-600 text-sm dark:text-gray-400">
									<span>Category: {category.name}</span>
									<span>{theme.value} mentions</span>
								</div>
							</Link>
						))}
					</React.Fragment>
				))}
			</div>
		</div>
	)
}
