import {
	AlertCircle,
	CheckCircle,
	Eye,
	Lightbulb,
	Loader2,
	MessageSquare,
	Target,
	TrendingUp,
	Users,
	Zap,
} from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { ProjectStatusData } from "~/utils/project-status.server"

interface ProjectStatusScreenProps {
	projectName: string
	icp: string
	projectId?: string
	accountId?: string
	statusData?: ProjectStatusData | null
	onAddMore: () => void
	onViewResults: () => void
}

export default function ProjectStatusScreen({
	projectName,
	icp,
	projectId,
	accountId,
	statusData: externalStatusData,
	onAddMore,
	onViewResults,
}: ProjectStatusScreenProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const [showCustomAnalysis, setShowCustomAnalysis] = useState(false)
	const [customInstructions, setCustomInstructions] = useState("")

	// Create routes helper if we have the required IDs
	const currentProjectContext = useCurrentProject()
	const routes = useProjectRoutes(currentProjectContext?.projectPath)

	const runCustomAnalysis = async () => {
		if (!projectId) return
		setIsAnalyzing(true)
		try {
			const response = await fetch("/api/analyze-project-status", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					projectId,
					customInstructions: customInstructions || undefined,
					analysisVersion: "1.0",
				}),
			})

			if (response.ok) {
				const result = await response.json()
				console.log("✅ Analysis completed:", result)
				setShowCustomAnalysis(false)
				setCustomInstructions("")
				// Refresh the page to show new data
				window.location.reload()
			} else {
				console.error("❌ Analysis failed:", response.status)
			}
		} catch (error) {
			console.error("❌ Analysis error:", error)
		} finally {
			setIsAnalyzing(false)
		}
	}

	// Use external data if available, otherwise fallback to props
	const displayData = externalStatusData || {
		projectName,
		icp,
		totalInterviews: 1,
		totalInsights: 5,
		totalPersonas: 2,
		totalThemes: 3,
		answeredQuestions: [],
		openQuestions: [],
		keyInsights: [],
		completionScore: 25,
		lastUpdated: new Date(),
		analysisId: undefined,
		hasAnalysis: false,
		nextSteps: [],
		nextAction: undefined,
		keyDiscoveries: [],
		confidenceScore: undefined,
		confidenceLevel: undefined,
		followUpRecommendations: [],
		suggestedInterviewTopics: [],
		// New BAML structure fields
		answeredInsights: [],
		unanticipatedDiscoveries: [],
		criticalUnknowns: [],
	}
	return (
		<>
			<div className="relative min-h-screen bg-gray-950 text-white">
				{isLoading && (
					<div className="flex h-screen items-center justify-center">
						<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
					</div>
				)}

				{/* Clean Header */}
				<div className="border-gray-800 border-b bg-gray-950 px-6 py-8">
					<div className="mx-auto max-w-4xl">
						<h1 className="mb-3 font-light text-3xl text-white tracking-tight">{displayData.projectName}</h1>
						<p className="text-gray-400 text-lg">{displayData.icp}</p>
					</div>
				</div>

				{/* Main Content - Streamlined 3-Section Layout */}
				<div className="mx-auto max-w-4xl space-y-16 px-6 py-12">
					{/* Section 1: What We Learned - Answered Insights */}
					{externalStatusData && displayData.answeredInsights && displayData.answeredInsights.length > 0 && (
						<div>
							<div className="mb-8 flex items-center gap-3">
								<Target className="h-8 w-8 text-green-400" />
								<h2 className="font-light text-3xl text-white">What We Learned</h2>
							</div>
							<div className="rounded-xl border border-green-700 bg-green-900/20 p-8">
								<div className="space-y-6">
									{/* Answered Insights with "what, because why" structure */}
									{displayData.answeredInsights.slice(0, 4).map((insight: string, index: number) => (
										<div key={`answered-insight-${displayData.analysisId}-${index}`} className="flex items-start gap-4">
											<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
											<p className="text-gray-200 text-lg leading-relaxed">{insight}</p>
										</div>
									))}
									{/* Show total count */}
									{displayData.answeredInsights.length > 4 && (
										<div className="pl-8 font-medium text-green-300">
											+{displayData.answeredInsights.length - 4} more insights discovered
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Section 1b: Unanticipated Discoveries */}
					{externalStatusData &&
						displayData.unanticipatedDiscoveries &&
						displayData.unanticipatedDiscoveries.length > 0 && (
							<div>
								<div className="mb-8 flex items-center gap-3">
									<Zap className="h-8 w-8 text-orange-400" />
									<h2 className="font-light text-3xl text-white">Unexpected Discoveries</h2>
								</div>
								<div className="rounded-xl border border-orange-700 bg-orange-900/20 p-8">
									<div className="space-y-6">
										{/* Unanticipated Discoveries */}
										{displayData.unanticipatedDiscoveries.slice(0, 3).map((discovery: string, index: number) => (
											<div key={`discovery-${displayData.analysisId}-${index}`} className="flex items-start gap-4">
												<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
												<p className="text-gray-200 text-lg leading-relaxed">{discovery}</p>
											</div>
										))}
										{/* Show total count */}
										{displayData.unanticipatedDiscoveries.length > 3 && (
											<div className="pl-8 font-medium text-orange-300">
												+{displayData.unanticipatedDiscoveries.length - 3} more surprises found
											</div>
										)}
									</div>
								</div>
							</div>
						)}

					{/* Section 2: Critical Unknowns - What we still need to learn */}
					{externalStatusData && displayData.criticalUnknowns && displayData.criticalUnknowns.length > 0 && (
						<div>
							<div className="mb-8 flex items-center gap-3">
								<AlertCircle className="h-8 w-8 text-yellow-400" />
								<h2 className="font-light text-3xl text-white">Critical Unknowns</h2>
							</div>
							<div className="rounded-xl border border-yellow-700 bg-yellow-900/20 p-8">
								<div className="space-y-6">
									{displayData.criticalUnknowns.slice(0, 5).map((unknown, index) => (
										<div
											key={`unknown-${displayData.analysisId || "default"}-${index}`}
											className="flex items-start gap-4"
										>
											<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-yellow-400" />
											<p className="text-gray-200 text-lg leading-relaxed">{unknown}</p>
										</div>
									))}
									{displayData.criticalUnknowns.length > 5 && (
										<div className="pl-8 font-medium text-yellow-300">
											+{displayData.criticalUnknowns.length - 5} more unknowns to explore
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Section 3: What's Next - Clear action categories */}
					{externalStatusData &&
						(displayData.nextSteps?.length > 0 ||
							displayData.followUpRecommendations.length > 0 ||
							displayData.suggestedInterviewTopics.length > 0) && (
							<div>
								<div className="mb-8 flex items-center gap-3">
									<CheckCircle className="h-8 w-8 text-blue-400" />
									<h2 className="font-light text-3xl text-white">What's Next</h2>
								</div>
								<div className="space-y-6">
									{/* Priority Actions */}
									{displayData.nextSteps?.length > 0 && (
										<div className="rounded-xl border border-blue-700 bg-blue-900/20 p-6">
											<h3 className="mb-4 font-semibold text-blue-300 text-xl">Priority Actions</h3>
											<div className="space-y-4">
												{displayData.nextSteps.slice(0, 3).map((step: string, index: number) => (
													<div key={`next-${displayData.analysisId}-${index}`} className="flex items-start gap-4">
														<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold text-sm text-white">
															{index + 1}
														</div>
														<p className="text-gray-200 text-lg leading-relaxed">{step}</p>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Analysis Deep Dives */}
									{displayData.followUpRecommendations.length > 0 && (
										<div className="rounded-xl border border-purple-700 bg-purple-900/20 p-6">
											<h3 className="mb-4 font-semibold text-purple-300 text-xl">Analysis Deep Dives</h3>
											<div className="space-y-4">
												{displayData.followUpRecommendations.slice(0, 2).map((rec, index) => (
													<div key={`followup-${index}`} className="flex items-start gap-4">
														<Lightbulb className="mt-1 h-6 w-6 flex-shrink-0 text-purple-400" />
														<p className="text-gray-200 text-lg leading-relaxed">{rec}</p>
													</div>
												))}
											</div>
										</div>
									)}

									{/* New Research */}
									{displayData.suggestedInterviewTopics.length > 0 && (
										<div className="rounded-xl border border-green-700 bg-green-900/20 p-6">
											<h3 className="mb-4 font-semibold text-green-300 text-xl">New Research Needed</h3>
											<div className="space-y-4">
												{displayData.suggestedInterviewTopics.slice(0, 2).map((topic, index) => (
													<div key={`interview-${index}`} className="flex items-start gap-4">
														<Users className="mt-1 h-6 w-6 flex-shrink-0 text-green-400" />
														<p className="text-gray-200 text-lg leading-relaxed">{topic}</p>
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							</div>
						)}

					{/* Detailed Views - Quick Access */}
					{externalStatusData && (
						<div>
							<div className="mb-8 flex items-center gap-3">
								<Eye className="h-8 w-8 text-gray-400" />
								<h2 className="font-light text-3xl text-white">Dive Deeper</h2>
							</div>
							<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
								{/* Insights */}
								<div
									className="cursor-pointer rounded-xl border border-gray-700 bg-gray-900/30 p-6 transition-colors hover:bg-gray-800/40"
									onClick={() => routes && (window.location.href = routes.insights.index())}
								>
									<div className="mb-4 flex items-center gap-3">
										<Lightbulb className="h-6 w-6 text-yellow-400" />
										<h3 className="font-semibold text-lg text-white">All {displayData.totalInsights} Insights</h3>
									</div>
									{/* <p className="mb-4 text-gray-200 text-sm">
										View detailed analysis of all {displayData.totalInsights} insights discovered
									</p> */}
									<div className="flex items-center font-medium text-blue-300 text-sm">
										<span>View Details</span>
										<TrendingUp className="ml-2 h-4 w-4" />
									</div>
								</div>

								{/* Personas */}
								<div
									className="cursor-pointer rounded-xl border border-gray-700 bg-gray-900/30 p-6 transition-colors hover:bg-gray-800/40"
									onClick={() => routes && (window.location.href = routes.personas.index())}
								>
									<div className="mb-4 flex items-center gap-3">
										<Users className="h-6 w-6 text-purple-400" />
										<h3 className="font-semibold text-lg text-white">{displayData.totalPersonas} Personas</h3>
									</div>
									{/* <p className="mb-4 text-gray-200 text-sm">
										Explore {displayData.totalPersonas} user personas and their characteristics
									</p> */}
									<div className="flex items-center font-medium text-blue-300 text-sm">
										<span>View Personas</span>
										<TrendingUp className="ml-2 h-4 w-4" />
									</div>
								</div>

								{/* Interviews */}
								<div
									className="cursor-pointer rounded-xl border border-gray-700 bg-gray-900/30 p-6 transition-colors hover:bg-gray-800/40"
									onClick={() => routes && (window.location.href = routes.interviews.index())}
								>
									<div className="mb-4 flex items-center gap-3">
										<MessageSquare className="h-6 w-6 text-green-400" />
										<h3 className="font-semibold text-lg text-white">{displayData.totalInterviews} Interviews</h3>
									</div>
									{/* <p className="mb-4 text-gray-200 text-sm">
										Review all {displayData.totalInterviews} interviews and transcripts
									</p> */}
									<div className="flex items-center font-medium text-blue-300 text-sm">
										<span>View Interviews</span>
										<TrendingUp className="ml-2 h-4 w-4" />
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Research Progress - Simplified */}
					{externalStatusData && displayData.completionScore > 0 && (
						<div className="rounded-xl border border-gray-700 bg-gray-900/50 p-8">
							<div className="mb-6 flex items-center justify-between">
								<h3 className="font-light text-white text-xl">Research Progress</h3>
								<div className="flex items-center gap-3">
									<span className="font-bold text-2xl text-white">{displayData.completionScore}%</span>
									{displayData.confidenceLevel && (
										<div
											className={`flex items-center gap-2 rounded-full px-3 py-1 font-medium text-sm ${
												displayData.confidenceLevel === 1
													? "bg-green-900/50 text-green-400"
													: displayData.confidenceLevel === 2
														? "bg-yellow-900/50 text-yellow-400"
														: "bg-red-900/50 text-red-400"
											}`}
										>
											<AlertCircle className="h-4 w-4" />
											{displayData.confidenceLevel === 1
												? "High"
												: displayData.confidenceLevel === 2
													? "Medium"
													: "Low"}{" "}
											Confidence
										</div>
									)}
								</div>
							</div>
							<div className="h-3 w-full rounded-full bg-gray-700">
								<div
									className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
									style={{ width: `${displayData.completionScore}%` }}
								/>
							</div>
							<p className="mt-4 text-gray-300">
								{displayData.completionScore < 50
									? "Add more interviews to uncover deeper insights"
									: displayData.completionScore < 80
										? "Good progress! A few more interviews will complete the picture"
										: "Excellent coverage of your research questions!"}
							</p>
						</div>
					)}
					{/* Primary Action - Clean and Prominent */}
					{displayData.nextAction && (
						<div className="mx-auto max-w-4xl px-6">
							<div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center">
								<h3 className="mb-3 font-light text-gray-900 text-xl">Recommended Action</h3>
								<p className="mb-6 text-gray-600 leading-relaxed">{displayData.nextAction}</p>
								<Button
									onClick={onAddMore}
									className="rounded-full bg-blue-500 px-8 py-3 font-medium text-white hover:bg-blue-600"
								>
									Take Action
								</Button>
							</div>
						</div>
					)}

					{/* Simple Actions */}
					<div className="mx-auto max-w-4xl px-6 py-8">
						<div className="flex justify-center gap-4">
							{/* <Button
								onClick={onViewResults}
								variant="outline"
								className="border-blue-500 bg-blue-50 px-6 py-3 text-blue-700 hover:bg-blue-100 hover:border-blue-600"
							>
								<Eye className="mr-2 h-4 w-4" />
								View Full Analysis
							</Button> */}
							<Button
								onClick={() => setShowCustomAnalysis(true)}
								disabled={isAnalyzing}
								variant="outline"
								className="border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-blue-500 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
								Custom Analysis
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Custom Analysis Modal - Dark Mode Fixed */}
			{showCustomAnalysis && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-xl">
						<h3 className="mb-6 font-light text-white text-xl">Custom Analysis</h3>
						<div className="space-y-6">
							<div>
								<label className="mb-3 block font-medium text-gray-300 text-sm">Custom Instructions (Optional)</label>
								<Input
									value={customInstructions}
									rows={2}
									onChange={(e) => setCustomInstructions(e.target.value)}
									placeholder="e.g., Focus on pain points, Look for feature gaps..."
									className="border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
								/>

							</div>
							<div className="flex gap-3">
								<Button
									onClick={runCustomAnalysis}
									disabled={isAnalyzing}
									className="flex-1 bg-blue-500 text-white hover:bg-blue-600"
								>
									{isAnalyzing ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Analyzing...
										</>
									) : (
										<>
											<Zap className="mr-2 h-4 w-4" />
											Run Analysis
										</>
									)}
								</Button>
								<Button
									onClick={() => setShowCustomAnalysis(false)}
									variant="outline"
									disabled={isAnalyzing}
									className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
								>
									Cancel
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	)
}
