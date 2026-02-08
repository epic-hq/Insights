import { useId, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { TreeNode } from "~/components/charts/TreeMap";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
// Import centralized types
import type { InsightView, Interview } from "~/types";

interface ThemeDetailProps {
	insights: InsightView[];
	interviews: Interview[];
	themeTree: TreeNode[];
}

export default function ThemeDetail({ insights, interviews, themeTree }: ThemeDetailProps) {
	const { themeId } = useParams<{ themeId: string }>();
	const [groupBy, setGroupBy] = useState<"none" | "persona" | "user">("none");
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath || "");
	const groupById = useId();

	// Find the theme in the theme tree
	const theme = useMemo<{ name: string; fill: string } | null>(() => {
		let foundTheme: { name: string; fill: string } | null = null;

		themeTree.forEach((category) => {
			if (category.children) {
				category.children.forEach((t) => {
					// Ensure we have name and fill properties with defaults
					const themeName = t.name || "";
					const themeFill = t.fill || "#cccccc";
					const slug = themeName.toLowerCase().replace(/\s+/g, "-");

					if (slug === themeId) {
						foundTheme = { name: themeName, fill: themeFill };
					}
				});
			}
		});

		return foundTheme;
	}, [themeId, themeTree]);

	// Find participants whose interviews evidence this theme
	const relatedParticipants = useMemo(() => {
		if (!themeId || !theme?.name) return [];

		// Get unique interview IDs from insights related to this theme
		const interviewIds = new Set<string>();

		// Find insights related to this theme
		insights.forEach((insight) => {
			if (insight.category === theme.name) {
				// If the insight has an interview_id, add it to the set
				if (insight.interview_id) {
					interviewIds.add(insight.interview_id);
				}
			}
		});

		// Get full participant interview data
		return interviews.filter((interview) => interviewIds.has(interview.id));
	}, [insights, interviews, themeId, theme]);

	// Filter insights related to this theme
	const relatedInsights = useMemo(() => {
		if (!theme) return [];

		return insights.filter((insight) => {
			if (!theme?.name) return false;
			return insight.category === theme.name;
		});
	}, [insights, theme]);

	// Group insights based on selected grouping
	const groupedInsights = useMemo(() => {
		if (groupBy === "none") {
			return { "All Insights": relatedInsights };
		}

		const groups: Record<string, InsightView[]> = {};

		relatedInsights.forEach((insight) => {
			let groupKey = "";

			if (groupBy === "persona") {
				// Find the interview for this insight to get the persona
				if (insight.interview_id) {
					const interview = interviews.find((i) => i.id === insight.interview_id);
					groupKey = interview?.segment || "Unknown Persona";
				} else {
					groupKey = "Unknown Persona";
				}
			} else if (groupBy === "user") {
				// Find the interview for this insight to get the user
				if (insight.interview_id) {
					const interview = interviews.find((i) => i.id === insight.interview_id);
					groupKey = interview?.participant_pseudonym || "Unknown User";
				} else {
					groupKey = "Unknown User";
				}
			}

			if (!groups[groupKey]) {
				groups[groupKey] = [];
			}

			groups[groupKey].push(insight);
		});

		return groups;
	}, [relatedInsights, interviews, groupBy]);

	if (!theme?.name) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<div className="rounded-lg bg-white p-6 shadow dark:bg-gray-900">
					<h1 className="mb-4 font-bold text-2xl text-red-600">Theme Not Found</h1>
					<p>The requested theme could not be found.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-7xl px-4">
			<div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
				<div className="mb-4 flex items-center sm:mb-0">
					<div className="mr-2 h-4 w-4 rounded-full" style={{ backgroundColor: theme?.fill }} />
					<h2 className="font-semibold text-xl">{theme?.name}</h2>
					<span className="ml-2 text-gray-600 dark:text-gray-400">{relatedInsights.length} related insights</span>
				</div>

				<div className="flex items-center">
					<label htmlFor={groupById} className="mr-2 font-medium text-sm">
						Group by:
					</label>
					<select
						id={groupById}
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

			{/* Participants whose interviews evidence this theme */}
			<div className="mb-8 rounded-lg bg-white p-4 shadow dark:bg-gray-900">
				<h3 className="mb-4 font-medium text-lg">Participants who mentioned this theme</h3>

				{relatedParticipants.length > 0 ? (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{relatedParticipants.map((interview) => (
							<div
								key={interview.id}
								className="rounded-lg border border-gray-200 p-3 transition-shadow hover:shadow-md dark:border-gray-700"
							>
								<Link
									to={routes.interviews.detail(interview.id)}
									className="font-medium text-blue-600 hover:text-blue-800"
								>
									{interview.participant_pseudonym || "Anonymous"}
								</Link>
								<div className="mt-2 flex items-center">
									<div
										className="mr-2 h-3 w-3 rounded-full"
										style={{
											backgroundColor:
												interview.segment === "Early Adopter"
													? "#2563EB"
													: interview.segment === "Mainstream Learner"
														? "#14B8A6"
														: "#E11D48",
										}}
									/>
									<span className="text-gray-600 text-sm dark:text-gray-400">{interview.segment || "Unknown"}</span>
								</div>
								<p className="mt-1 text-gray-500 text-xs">{interview.title || "Interview"}</p>
							</div>
						))}
					</div>
				) : (
					<p className="py-4 text-center text-gray-500">No participants found for this theme.</p>
				)}
			</div>

			{Object.entries(groupedInsights).map(([group, insights]) => (
				<div key={group} className="mb-8">
					{groupBy !== "none" && <h3 className="mb-4 font-medium text-lg">{group}</h3>}

					<div className="space-y-4">
						{insights.map((insight) => {
							// Find the interview for this insight to get user and persona info
							const interview = insight.interview_id ? interviews.find((i) => i.id === insight.interview_id) : null;

							return (
								<div key={insight.id} className="rounded-lg bg-white p-4 shadow dark:bg-gray-900">
									<div className="mb-2 flex flex-col md:flex-row md:items-center md:justify-between">
										<h4 className="font-medium">{insight.name}</h4>
										<div className="text-gray-600 text-sm dark:text-gray-400">Category: {insight.category}</div>
									</div>

									<p className="mb-3 text-sm">"{insight.jtbd || ""}"</p>

									<div className="flex flex-wrap gap-2 text-xs">
										<div className="rounded bg-blue-100 px-2 py-0.5 text-blue-800">Impact: {insight.impact || 0}/5</div>
										<div className="rounded bg-purple-100 px-2 py-0.5 text-purple-800">
											Novelty: {insight.novelty || 0}/5
										</div>
										{interview && (
											<>
												<div className="rounded bg-green-100 px-2 py-0.5 text-green-800">
													User: {interview.participant_pseudonym || "Anonymous"}
												</div>
												<div
													className="rounded px-2 py-0.5 text-white"
													style={{
														backgroundColor:
															interview.segment === "Early Adopter"
																? "#2563EB"
																: interview.segment === "Mainstream Learner"
																	? "#14B8A6"
																	: "#E11D48",
													}}
												>
													{interview.segment || "Unknown"}
												</div>
											</>
										)}
									</div>
								</div>
							);
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
	);
}
