import {
	AlertCircle,
	CheckCircle,
	CircleHelp,
	Eye,
	FileText,
	Lightbulb,
	Loader2,
	MessageSquare,
	Target,
	TrendingUp,
	Users,
	X,
	Zap,
} from "lucide-react"
import { useState } from "react"
import { useRevalidator } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { useCurrentProject } from "~/contexts/current-project-context"
import { ProjectEditButton } from "~/features/projects/components/ProjectEditButton"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { ProjectStatusData } from "~/utils/project-status.server"

interface ProjectStatusScreenProps {
	projectName: string
	icp: string
	projectId?: string
	accountId?: string
	statusData?: ProjectStatusData | null
}

export default function ProjectStatusScreen({
	projectName,
	icp,
	projectId,
	accountId,
	statusData,
}: ProjectStatusScreenProps) {
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const [customInstructions, setCustomInstructions] = useState("")
	const [showGapAnalysis, setShowGapAnalysis] = useState(false)
	const [showCustomAnalysis, setShowCustomAnalysis] = useState(false)
	const revalidator = useRevalidator()
	const currentProjectContext = useCurrentProject()
	const projectPath =
		currentProjectContext?.projectPath ?? (accountId && projectId ? `/a/${accountId}/${projectId}` : "")
	const routes = useProjectRoutes(projectPath)

	const runCustomAnalysis = async () => {
		if (!projectId) return
		setIsAnalyzing(true)
		try {
			const response = await fetch("/api/analyze-project-status", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					projectId,
					customInstructions: customInstructions || undefined,
					analysisVersion: "1.0",
				}),
			})

			if (response.ok) {
				setCustomInstructions("")
				revalidator.revalidate()
				// Auto-open gap analysis once data is available
				setShowGapAnalysis(true)
			}
		} catch (_error) {
			// Handle error silently
		} finally {
			setIsAnalyzing(false)
		}
	}

	// Use external data if available, otherwise fallback to props
	const displayData = statusData || {
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
	if (!projectId) {
		return
	}

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			{isAnalyzing && (
				<div className="flex h-screen items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-foreground" />
				</div>
			)}

			{/* Clean Header */}
			<div className="border-gray-800 border-b bg-background px-6 py-8 text-foreground">
				<div className="mx-auto flex max-w-4xl items-center gap-2">
					<h1 className="mb-3 font-light text-3xl text-foreground tracking-tight">
						Project Status: {displayData.projectName}
					</h1>
					{/* TODO: ensure goal, goal_description is part of this */}
					{/* <p className="text-foreground/60 text-lg">{displayData.goal}</p> */}
					{/* TODO pass proper project objet, but for now i think this is all it needs */}
					<ProjectEditButton project={{ id: projectId }} />
				</div>
			</div>

			{/* Main Content - Streamlined 3-Section Layout */}
			<div className="mx-auto max-w-4xl space-y-16 px-6 py-12">
				{/* Section 1: What We Learned - Answered Insights */}
				{statusData && displayData.answeredInsights && displayData.answeredInsights.length > 0 && (
					<div>
						<div className="mb-8 flex items-center gap-2">
							<Target className="h-8 w-8 text-green-400" />
							<h2 className="font-light text-2xl text-foreground">What We Learned</h2>
						</div>
						<div className="rounded-xl border border-green-700 bg-green-900/20 p-8">
							<div className="space-y-6">
								{/* Answered Insights with "what, because why" structure */}
								{displayData.answeredInsights.slice(0, 4).map((insight: string, index: number) => (
									<div key={`answered-insight-${displayData.analysisId}-${index}`} className="flex items-start gap-4">
										<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
										<p className="text-foreground text-lg leading-relaxed">{insight}</p>
									</div>
								))}
								{/* Unanswered Insights */}
								{displayData.criticalUnknowns && displayData.criticalUnknowns.length > 0 && (
									<div className=" space-y-2">
										{displayData.criticalUnknowns.map((insight: string, index: number) => (
											<div
												key={`unanswered-insight-${displayData.analysisId}-${index}`}
												className="flex items-center gap-2"
											>
												<div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-yellow-400" />
												<p className="text-foreground text-lg leading-relaxed">
													{insight}
													<CircleHelp className="ml-1 inline-block h-4 w-4 text-yellow-600" />
												</p>
											</div>
										))}
									</div>
								)}

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
				{/* {statusData &&
						displayData.unanticipatedDiscoveries &&
						displayData.unanticipatedDiscoveries.length > 0 && (
							<div>
								<div className="mb-8 flex items-center gap-3">
									<Zap className="h-8 w-8 text-orange-400" />
									<h2 className="font-light text-3xl text-white">Unexpected Discoveries</h2>
								</div>
								<div className="rounded-xl border border-orange-700 bg-orange-900/20 p-8">
									<div className="space-y-6">

										{displayData.unanticipatedDiscoveries.slice(0, 3).map((discovery: string, index: number) => (
											<div key={`discovery-${displayData.analysisId}-${index}`} className="flex items-start gap-4">
												<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
												<p className="text-gray-200 text-lg leading-relaxed">{discovery}</p>
											</div>
										))}

										{displayData.unanticipatedDiscoveries.length > 3 && (
											<div className="pl-8 font-medium text-orange-300">
												+{displayData.unanticipatedDiscoveries.length - 3} more surprises found
											</div>
										)}
									</div>
								</div>
							</div>
						)} */}

				{/* Section 2: Critical Unknowns - What we still need to learn */}
				{/* {statusData && displayData.criticalUnknowns && displayData.criticalUnknowns.length > 0 && (
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
					)} */}

				{/* Section 3: What's Next - Clear action categories */}
				{statusData &&
					(displayData.nextSteps?.length > 0 ||
						displayData.followUpRecommendations.length > 0 ||
						displayData.suggestedInterviewTopics.length > 0) && (
						<div>
							<div className="mb-8 flex items-center gap-3">
								<CheckCircle className="h-8 w-8 text-blue-400" />
								<h2 className="font-light text-3xl text-foreground">What's Next</h2>
							</div>
							<div className="space-y-6">
								{/* Priority Actions */}
								{displayData.nextSteps?.length > 0 && (
									<div className="rounded-xl border border-blue-700 bg-blue-900/20 p-6">
										{/* <h3 className="mb-4 font-semibold text-blue-300 text-xl">Priority Actions</h3> */}
										<div className="space-y-4">
											{displayData.nextSteps.slice(0, 3).map((step: string, index: number) => (
												<div key={`next-${displayData.analysisId}-${index}`} className="flex items-start gap-4">
													<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold text-sm text-white">
														{index + 1}
													</div>
													<p className="text-foreground text-lg leading-relaxed">{step}</p>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Analysis Deep Dives */}
								{/* {displayData.followUpRecommendations.length > 0 && (
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
									)} */}

								{/* New Research */}
								{/* {displayData.suggestedInterviewTopics.length > 0 && (
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
									)} */}
							</div>
						</div>
					)}

				{/* Detailed Views - Quick Access */}
				{statusData && (
					<div>
						<div className="mb-8 flex items-center gap-3">
							<Eye className="h-8 w-8 text-gray-400" />
							<h2 className="font-light text-3xl text-foreground">Details</h2>
						</div>
						<div className="grid grid-cols-2 gap-6 md:grid-cols-4">
							{/* Gap Analysis */}
							<div
								className="cursor-pointer rounded-xl border border-gray-700 bg-gray-900/30 p-6 transition-colors hover:bg-gray-800/40"
								onClick={() => setShowGapAnalysis(true)}
							>
								<div className="mb-4 flex items-center gap-3">
									<FileText className="h-6 w-6 text-purple-400" />
									<h3 className="font-semibold text-lg text-primary">Gap Analysis</h3>
								</div>
								<div className="flex items-center font-medium text-blue-300 text-sm">
									<TrendingUp className="ml-2 h-4 w-4" />
								</div>
							</div>

							{/* Insights */}
							<div
								className="cursor-pointer rounded-xl border border-gray-700 bg-gray-900/30 p-6 transition-colors hover:bg-gray-800/40"
								onClick={() => routes && (window.location.href = routes.insights.index())}
							>
								<div className="mb-4 flex items-center gap-3">
									<Lightbulb className="h-6 w-6 text-yellow-400" />
									<h3 className="font-semibold text-foreground text-lg">{displayData.totalInsights} Insights</h3>
								</div>
								{/* <p className="mb-4 text-gray-200 text-sm">
										View detailed analysis of all {displayData.totalInsights} insights discovered
									</p> */}
								<div className="flex items-center font-medium text-blue-300 text-sm">
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
									<h3 className="font-semibold text-foreground text-lg">{displayData.totalPersonas} Personas</h3>
								</div>
								{/* <p className="mb-4 text-gray-200 text-sm">
										Explore {displayData.totalPersonas} user personas and their characteristics
									</p> */}
								<div className="flex items-center font-medium text-blue-300 text-sm">
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
									<h3 className="font-semibold text-foreground text-lg">{displayData.totalInterviews} Interviews</h3>
								</div>
								{/* <p className="mb-4 text-gray-200 text-sm">
										Review all {displayData.totalInterviews} interviews and transcripts
									</p> */}
								<div className="flex items-center font-medium text-blue-300 text-sm">
									<TrendingUp className="ml-2 h-4 w-4" />
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Research Progress - Simplified */}
				{statusData && displayData.completionScore > 0 && (
					<div className="rounded-xl border border-gray-700 bg-gray-900/50 p-8">
						<div className="mb-6 flex items-center justify-between">
							<h3 className="font-light text-foreground text-xl">Research Progress</h3>
							<div className="flex items-center gap-3">
								<span className="font-bold text-2xl text-foreground">{displayData.completionScore}%</span>
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
										{displayData.confidenceLevel === 1 ? "High" : displayData.confidenceLevel === 2 ? "Medium" : "Low"}{" "}
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
						<p className="mt-4 text-foreground">
							{displayData.completionScore < 50
								? "Add more interviews to uncover deeper insights"
								: displayData.completionScore < 80
									? "Good progress! A few more interviews will complete the picture"
									: "Excellent coverage of your research questions!"}
						</p>
					</div>
				)}

				{/* Simple Actions */}
				<div className="mx-auto max-w-4xl px-6 py-8">
					<div className="flex justify-center gap-4">
						<Button
							onClick={() => setShowGapAnalysis(true)}
							variant="outline"
							className="border-blue-500 bg-blue-50 px-6 py-3 text-blue-700 hover:border-blue-600 hover:bg-blue-100"
							disabled={!statusData}
						>
							<Eye className="mr-2 h-4 w-4" />
							View Full Analysis
						</Button>
						<Button
							onClick={() => setShowCustomAnalysis(true)}
							disabled={isAnalyzing}
							variant="outline"
							className="border-gray-300 bg-white px-6 py-3 text-foreground hover:border-gray-400 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
							Custom Analysis
						</Button>
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
									className="border-gray-600 text-gray-600 hover:bg-gray-800 hover:text-white"
								>
									Cancel
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Gap Analysis Modal */}
			{showGapAnalysis &&
				statusData &&
				statusData.hasAnalysis &&
				(statusData.answeredQuestions.length > 0 ||
					statusData.openQuestions.length > 0 ||
					statusData.followUpRecommendations.length > 0 ||
					statusData.suggestedInterviewTopics.length > 0) && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
						<div className="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-4 sm:p-6 md:p-8">
							<div className="mb-6 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<FileText className="h-8 w-8 text-purple-400" />
									<h2 className="font-light text-3xl text-white">Full Gap Analysis</h2>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setShowGapAnalysis(false)}
									className="text-gray-400 hover:text-white"
								>
									<X className="h-6 w-6" />
								</Button>
							</div>

							<div className="space-y-8">
								{/* Questions Answered (Rich) */}
								{statusData.questionAnswers && statusData.questionAnswers.length > 0 && (
									<div>
										<h3 className="mb-4 font-semibold text-green-300 text-xl">Questions Answered</h3>
										<div className="space-y-4">
											{statusData.questionAnswers.map((qa) => (
												<div
													key={`qa-${qa.question}`}
													className="rounded-lg border border-green-700 bg-green-900/20 p-4"
												>
													<div className="mb-2 flex items-start gap-2">
														<CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-green-400" />
														<p className="font-medium text-green-200">{qa.question}</p>
														{typeof qa.confidence === "number" && (
															<span
																className={`ml-auto inline-flex items-center rounded-md px-2 py-0.5 text-xs ${
																	qa.confidence === 1
																		? "border-green-700 bg-green-800/40 text-green-200"
																		: qa.confidence === 2
																			? "border-yellow-700 bg-yellow-800/40 text-yellow-200"
																			: "border-red-700 bg-red-800/40 text-red-200"
																}`}
															>
																<AlertCircle className="mr-1 h-3 w-3" />
																{qa.confidence === 1 ? "High" : qa.confidence === 2 ? "Medium" : "Low"} confidence
															</span>
														)}
													</div>
													{qa.answer_summary && <p className="text-gray-200">{qa.answer_summary}</p>}

													{/* Evidence */}
													{qa.evidence && qa.evidence.length > 0 && (
														<div className="mt-3">
															<p className="mb-1 text-gray-400 text-sm">Evidence</p>
															<ul className="list-inside list-disc space-y-1 text-gray-300 text-sm">
																{qa.evidence.map((e, i) => (
																	<li key={`ev-${qa.question}-${e.slice(0, 24)}-${i}`}>&ldquo;{e}&rdquo;</li>
																))}
															</ul>
														</div>
													)}

													{/* Linked Insights */}
													{qa.insights_found && qa.insights_found.length > 0 && (
														<div className="mt-3">
															<p className="mb-1 text-gray-400 text-sm">Related insights</p>
															<ul className="list-inside list-disc space-y-1 text-gray-300 text-sm">
																{qa.insights_found.map((ins) => (
																	<li key={`ins-${qa.question}-${ins.slice(0, 24)}`}>{ins}</li>
																))}
															</ul>
														</div>
													)}

													{/* Insight Links (IDs matched) */}
													{qa.related_insight_ids && qa.related_insight_ids.length > 0 && routes && (
														<div className="mt-2 flex flex-wrap gap-2">
															{qa.related_insight_ids.map((id) => (
																<a
																	key={`ins-link-${qa.question}-${id}`}
																	href={routes.insights.detail(id)}
																	className="rounded-full border border-blue-700 bg-blue-900/20 px-2 py-0.5 text-blue-200 text-xs hover:bg-blue-900/40"
																	data-testid="qa-related-insight-link"
																>
																	Open insight
																</a>
															))}
														</div>
													)}
												</div>
											))}
										</div>
									</div>
								)}

								{/* Unanswered Questions */}
								{statusData.openQuestions.length > 0 && (
									<div>
										<h3 className="mb-4 font-semibold text-xl text-yellow-300">Unanswered Questions</h3>
										<div className="space-y-3">
											{statusData.openQuestions.map((question) => (
												<div
													key={`unanswered-${question.slice(0, 24)}`}
													className="flex items-start gap-3 rounded-lg border border-yellow-700 bg-yellow-900/20 p-4"
												>
													<CircleHelp className="mt-1 h-5 w-5 flex-shrink-0 text-yellow-400" />
													<p className="text-gray-200">{question}</p>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Follow-up Recommendations */}
								{statusData.followUpRecommendations.length > 0 && (
									<div>
										<h3 className="mb-4 font-semibold text-blue-300 text-xl">Follow-up Recommendations</h3>
										<div className="space-y-3">
											{statusData.followUpRecommendations.map((rec) => (
												<div
													key={`followup-${rec.slice(0, 24)}`}
													className="flex items-start gap-3 rounded-lg border border-blue-700 bg-blue-900/20 p-4"
												>
													<Lightbulb className="mt-1 h-5 w-5 flex-shrink-0 text-blue-400" />
													<p className="text-gray-200">{rec}</p>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Suggested Interview Topics */}
								{statusData.suggestedInterviewTopics.length > 0 && (
									<div>
										<h3 className="mb-4 font-semibold text-purple-300 text-xl">Suggested Interview Topics</h3>
										<div className="space-y-3">
											{statusData.suggestedInterviewTopics.map((topic) => (
												<div
													key={`topic-${topic.slice(0, 24)}`}
													className="flex items-start gap-3 rounded-lg border border-purple-700 bg-purple-900/20 p-4"
												>
													<MessageSquare className="mt-1 h-5 w-5 flex-shrink-0 text-purple-400" />
													<p className="text-gray-200">{topic}</p>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				)}
		</div>
	)
}
