import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
// Import types
import type { InsightCardProps } from "~/components/insights/InsightCard"
import PageHeader from "~/components/navigation/PageHeader"
import { sampleData } from "~/data/sampleData"

interface ThemeDetailProps {
	insights: InsightCardProps[]
}

export default function ThemeDetail({ insights }: ThemeDetailProps) {
	const { themeId } = useParams<{ themeId: string }>()
	const [groupBy, setGroupBy] = useState<"none" | "persona" | "user">("none")

	// Find the theme in the theme tree
	const theme = useMemo<{ name: string; fill: string } | null>(() => {
		let foundTheme: { name: string; fill: string } | null = null

		sampleData.themeTree.forEach((category) => {
			if (category.children) {
				category.children.forEach((t) => {
					// Ensure we have name and fill properties with defaults
					const themeName = t.name || ""
					const themeFill = t.fill || "#cccccc"
					const slug = themeName.toLowerCase().replace(/\s+/g, "-")

					if (slug === themeId) {
						foundTheme = { name: themeName, fill: themeFill }
					}
				})
			}
		})

		return foundTheme
	}, [themeId])

	// Find interviewees who evidence this theme
	const relatedInterviewees = useMemo(() => {
		if (!themeId) return []

		// Get unique interviewee IDs from insights related to this theme
		const intervieweeIds = new Set<string>()

		// Find the theme name from the theme ID
		let themeName = ""
		sampleData.themeTree.forEach((category) => {
			if (category.children) {
				category.children.forEach((t) => {
					const slug = (t.name || "").toLowerCase().replace(/\s+/g, "-")
					if (slug === themeId) {
						themeName = t.name || ""
					}
				})
			}
		})

		if (!themeName) return []

		insights.forEach((insight) => {
			if (insight.name === themeName || insight.relatedTags?.includes(themeName)) {
				// Find the interview for this insight to get the interviewee
				const interview = sampleData.interviews.find((i) => insight.evidence?.includes(i.participant))

				if (interview) {
					intervieweeIds.add(interview.id)
				}
			}
		})

		// Get full interviewee data
		return sampleData.interviews.filter((interview) => intervieweeIds.has(interview.id))
	}, [insights, themeId])

	// Filter insights related to this theme
	const relatedInsights = useMemo(() => {
		if (!theme) return []

		return insights.filter((insight) => {
			if (!theme?.name) return false
			return insight.name === theme.name || insight.relatedTags?.includes(theme.name)
		})
	}, [insights, theme])

	// Group insights based on selected grouping
	const groupedInsights = useMemo(() => {
		if (groupBy === "none") {
			return { "All Insights": relatedInsights }
		}

		const groups: Record<string, InsightCardProps[]> = {}

		relatedInsights.forEach((insight) => {
			let groupKey = ""

			if (groupBy === "persona") {
				// Find the interview for this insight to get the persona
				// In a real app, insights would have direct persona references
				const interview = sampleData.interviews.find((i) => insight.evidence?.includes(i.participant))
				groupKey = interview?.persona || "Unknown Persona"
			} else if (groupBy === "user") {
				// Find the interview for this insight to get the user
				const interview = sampleData.interviews.find((i) => insight.evidence?.includes(i.participant))
				groupKey = interview?.participant || "Unknown User"
			}

			if (!groups[groupKey]) {
				groups[groupKey] = []
			}

			groups[groupKey].push(insight)
		})

		return groups
	}, [relatedInsights, groupBy])

	if (!theme?.name) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<PageHeader title="Theme Not Found" />
				<div className="rounded-lg bg-white p-6 shadow dark:bg-gray-900">
					<h1 className="mb-4 font-bold text-2xl text-red-600">Theme Not Found</h1>
					<p>The requested theme could not be found.</p>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-7xl px-4 py-8">
			<PageHeader title={`Theme: ${theme?.name}`} />

			<div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
				<div className="mb-4 flex items-center sm:mb-0">
					<div className="mr-2 h-4 w-4 rounded-full" style={{ backgroundColor: theme?.fill }} />
					<h2 className="font-semibold text-xl">{theme?.name}</h2>
					<span className="ml-2 text-gray-600 dark:text-gray-400">{relatedInsights.length} related insights</span>
				</div>

				<div className="flex items-center">
					<label htmlFor="groupBy" className="mr-2 font-medium text-sm">
						Group by:
					</label>
					<select
						id="groupBy"
						value={groupBy}
						onChange={(e) => setGroupBy(e.target.value as "none" | "persona" | "user")}
						className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
					>
						<option value="none">None</option>
						<option value="persona">Persona</option>
						<option value="user">User</option>
					</select>
				</div>
			</div>

			{/* Interviewees who evidence this theme */}
			<div className="mb-8 rounded-lg bg-white p-4 shadow dark:bg-gray-900">
				<h3 className="mb-4 font-medium text-lg">Interviewees who mentioned this theme</h3>

				{relatedInterviewees.length > 0 ? (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{relatedInterviewees.map((interview) => (
							<div
								key={interview.id}
								className="rounded-lg border border-gray-200 p-3 transition-shadow hover:shadow-md dark:border-gray-700"
							>
								<Link to={`/interviewees/${interview.id}`} className="font-medium text-blue-600 hover:text-blue-800">
									{interview.participant}
								</Link>
								<div className="mt-2 flex items-center">
									<div
										className="mr-2 h-3 w-3 rounded-full"
										style={{
											backgroundColor:
												interview.personaColor ||
												(interview.persona === "Early Adopter"
													? "#2563EB"
													: interview.persona === "Mainstream Learner"
														? "#14B8A6"
														: "#E11D48"),
										}}
									/>
									<span className="text-gray-600 text-sm dark:text-gray-400">{interview.persona}</span>
								</div>
								<p className="mt-1 text-gray-500 text-xs">{interview.role || "Role not specified"}</p>
							</div>
						))}
					</div>
				) : (
					<p className="py-4 text-center text-gray-500">No interviewees found for this theme.</p>
				)}
			</div>

			{Object.entries(groupedInsights).map(([group, insights]) => (
				<div key={group} className="mb-8">
					{groupBy !== "none" && <h3 className="mb-4 font-medium text-lg">{group}</h3>}

					<div className="space-y-4">
						{insights.map((insight) => {
							// Find the interview for this insight to get user and persona info
							const interview = sampleData.interviews.find((i) => insight.evidence?.includes(i.participant))

							return (
								<div key={insight.id} className="rounded-lg bg-white p-4 shadow dark:bg-gray-900">
									<div className="mb-2 flex flex-col md:flex-row md:items-center md:justify-between">
										<h4 className="font-medium">{insight.tag}</h4>
										<div className="text-gray-600 text-sm dark:text-gray-400">Category: {insight.category}</div>
									</div>

									<p className="mb-3 text-sm">"{insight.jtbD}"</p>

									<div className="flex flex-wrap gap-2 text-xs">
										<div className="rounded bg-blue-100 px-2 py-0.5 text-blue-800">Impact: {insight.impact}/5</div>
										<div className="rounded bg-purple-100 px-2 py-0.5 text-purple-800">
											Novelty: {insight.novelty}/5
										</div>
										{interview && (
											<>
												<div className="rounded bg-green-100 px-2 py-0.5 text-green-800">
													User: {interview.participant}
												</div>
												<div
													className="rounded px-2 py-0.5 text-white"
													style={{
														backgroundColor:
															interview.personaColor ||
															(interview.persona === "Early Adopter"
																? "#2563EB"
																: interview.persona === "Mainstream Learner"
																	? "#14B8A6"
																	: "#E11D48"),
													}}
												>
													{interview.persona}
												</div>
											</>
										)}
									</div>
								</div>
							)
						})}

						{insights.length === 0 && (
							<div className="rounded-lg bg-white py-8 text-center shadow dark:bg-gray-900">
								<p className="text-gray-500">No insights in this group.</p>
							</div>
						)}
					</div>
				</div>
			))}

			{relatedInsights.length === 0 && (
				<div className="rounded-lg bg-white py-8 text-center shadow dark:bg-gray-900">
					<p className="text-gray-500">No insights related to this theme.</p>
				</div>
			)}
		</div>
	)
}
