import { CheckCircle, Eye, Lightbulb, Loader2, MessageSquare, Plus, Users, Zap, Target, TrendingUp, AlertCircle } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import type { ProjectStatusData } from "~/utils/project-status.server"

interface ProjectStatusScreenProps {
	projectName: string
	icp: string
	projectId?: string
	statusData?: ProjectStatusData | null
	onAddMore: () => void
	onViewResults: () => void
}

export default function ProjectStatusScreen({
	projectName,
	icp,
	projectId,
	statusData: externalStatusData,
	onAddMore,
	onViewResults,
}: ProjectStatusScreenProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const [showCustomAnalysis, setShowCustomAnalysis] = useState(false)
	const [customInstructions, setCustomInstructions] = useState("")

	const runCustomAnalysis = async () => {
		if (!projectId) return
		setIsAnalyzing(true)
		try {
			const response = await fetch('/api/analyze-project-status', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					projectId,
					customInstructions: customInstructions || undefined,
					analysisVersion: "1.0"
				})
			})

			if (response.ok) {
				const result = await response.json()
				console.log('✅ Analysis completed:', result)
				setShowCustomAnalysis(false)
				setCustomInstructions("")
				// Refresh the page to show new data
				window.location.reload()
			} else {
				console.error('❌ Analysis failed:', response.status)
			}
		} catch (error) {
			console.error('❌ Analysis error:', error)
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
		suggestedInterviewTopics: []
	}
	return (
		<div className="relative min-h-screen bg-black text-white">
			{isLoading && (
				<div className="flex h-screen items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin" />
				</div>
			)}
			{/* Main Content */}
			<div className="p-4 pb-24">
				<div className="space-y-6">
					{/* TODO: Make this one time disappear Success Message */}
					{/* <div className="space-y-3 text-center">
						<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
							{isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <CheckCircle className="h-8 w-8" />}
						</div>
						<h2 className="font-bold text-2xl text-white">Analysis Complete!</h2>
						<p className="text-gray-300 text-sm leading-relaxed">
							We've analyzed your {displayData.totalInterviews > 1 ? 'interviews' : 'interview'} and generated insights about {displayData.icp}.
						</p>
					</div> */}

					{/* Project Summary Card */}
					<div className="rounded-lg border border-gray-700 bg-gray-900 p-6">
						<div className="space-y-4">
							<div className="flex items-start gap-4">
								<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600">
									<Users className="h-6 w-6" />
								</div>
								<div className="min-w-0 flex-1">
									<h3 className="font-semibold text-lg text-white">{displayData.projectName}</h3>
									<p className="text-gray-400 text-sm">Research project for {displayData.icp}</p>
									<div className="mt-2 flex items-center gap-4 text-xs">
										<div className="flex items-center gap-1 text-green-400">
											<CheckCircle className="h-3 w-3" />
											<span>
												{displayData.totalInterviews} {displayData.totalInterviews === 1 ? "interview" : "interviews"}{" "}
												analyzed
											</span>
										</div>
										<div className="text-gray-500">•</div>
										<div className="text-gray-400">
											{externalStatusData ? new Date(displayData.lastUpdated).toLocaleDateString() : "Just completed"}
										</div>
									</div>
								</div>
							</div>

							{/* Quick Stats */}
							<div className="grid grid-cols-3 gap-4 border-gray-700 border-t pt-4">
								<div className="text-center">
									<div className="mb-1 flex items-center justify-center gap-1 text-blue-400 text-xs">
										<Lightbulb className="h-3 w-3" />
										<span>Insights</span>
									</div>
									<div className="font-bold text-lg text-white">{displayData.totalInsights}</div>
								</div>
								<div className="text-center">
									<div className="mb-1 flex items-center justify-center gap-1 text-purple-400 text-xs">
										<Users className="h-3 w-3" />
										<span>Personas</span>
									</div>
									<div className="font-bold text-lg text-white">{displayData.totalPersonas}</div>
								</div>
								<div className="text-center">
									<div className="mb-1 flex items-center justify-center gap-1 text-xs text-yellow-400">
										<MessageSquare className="h-3 w-3" />
										<span>Themes</span>
									</div>
									<div className="font-bold text-lg text-white">{displayData.totalThemes}</div>
								</div>
							</div>
						</div>
					</div>

					{/* Key Discoveries - Show unexpected insights */}
					{externalStatusData && displayData.keyDiscoveries && displayData.keyDiscoveries.length > 0 && (
						<div className="space-y-4">
							<h3 className="flex items-center gap-2 font-semibold text-lg text-white">
								<TrendingUp className="h-5 w-5 text-green-400" />
								Key Discoveries
							</h3>
							<div className="rounded-lg border border-green-700 bg-green-900/20 p-4">
								<div className="space-y-3">
									{displayData.keyDiscoveries.slice(0, 3).map((discovery: string, index: number) => (
										<div key={`discovery-${displayData.analysisId}-${index}`} className="flex items-start gap-3">
											<div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
											<p className="leading-relaxed text-sm text-gray-200">{discovery}</p>
										</div>
									))}
									{displayData.keyDiscoveries.length > 3 && (
										<div className="pl-5 text-xs italic text-gray-400">
											+{displayData.keyDiscoveries.length - 3} more discoveries
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Next Steps - AI-driven actionable recommendations */}
					{externalStatusData && displayData.nextSteps && displayData.nextSteps.length > 0 && (
						<div className="space-y-4">
							<h3 className="flex items-center gap-2 font-semibold text-lg text-white">
								<Target className="h-5 w-5 text-blue-400" />
								Recommended Next Steps
							</h3>
							<div className="rounded-lg border border-blue-700 bg-blue-900/20 p-4">
								<div className="space-y-3">
									{displayData.nextSteps.slice(0, 4).map((step: string, index: number) => (
										<div key={`step-${displayData.analysisId}-${index}`} className="flex items-start gap-3">
											<div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
												{index + 1}
											</div>
											<p className="leading-relaxed text-sm text-gray-200">{step}</p>
										</div>
									))}
									{displayData.nextSteps.length > 4 && (
										<div className="pl-8 text-xs italic text-gray-400">
											+{displayData.nextSteps.length - 4} more recommendations
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Research Progress: What's Answered vs Open */}
					{externalStatusData && (displayData.answeredQuestions.length > 0 || displayData.openQuestions.length > 0) && (
						<div className="space-y-4">
							<h3 className="flex items-center gap-2 font-semibold text-lg text-white">
								<Lightbulb className="h-5 w-5 text-yellow-400" />
								Research Progress
							</h3>

							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								{/* Answered Questions */}
								{displayData.answeredQuestions.length > 0 && (
									<div className="rounded-lg border border-green-700 bg-green-900/20 p-4">
										<div className="mb-3 flex items-center gap-2">
											<CheckCircle className="h-4 w-4 text-green-400" />
											<span className="font-medium text-green-400 text-sm">
												Questions Answered ({displayData.answeredQuestions.length})
											</span>
										</div>
										<div className="space-y-2">
											{displayData.answeredQuestions.slice(0, 3).map((question, index) => (
												<div key={index} className="text-gray-300 text-xs">
													• {question}
												</div>
											))}
											{displayData.answeredQuestions.length > 3 && (
												<div className="text-gray-400 text-xs italic">
													+{displayData.answeredQuestions.length - 3} more answered
												</div>
											)}
										</div>
									</div>
								)}

								{/* Open Questions */}
								{displayData.openQuestions.length > 0 && (
									<div className="rounded-lg border border-yellow-700 bg-yellow-900/20 p-4">
										<div className="mb-3 flex items-center gap-2">
											<MessageSquare className="h-4 w-4 text-yellow-400" />
											<span className="font-medium text-sm text-yellow-400">
												Still Need Answers ({displayData.openQuestions.length})
											</span>
										</div>
										<div className="space-y-2">
											{displayData.openQuestions.slice(0, 3).map((question, index) => (
												<div key={index} className="text-gray-300 text-xs">
													• {question}
												</div>
											))}
											{displayData.openQuestions.length > 3 && (
												<div className="text-gray-400 text-xs italic">
													+{displayData.openQuestions.length - 3} more questions
												</div>
											)}
										</div>
									</div>
								)}
							</div>

							{/* Completion Progress with Confidence Score */}
							{externalStatusData && displayData.completionScore > 0 && (
								<div className="rounded-lg bg-gray-900 p-4">
									<div className="mb-2 flex items-center justify-between">
										<span className="font-medium text-sm text-white">Research Completion</span>
										<div className="flex items-center gap-2">
											<span className="font-bold text-sm text-white">{displayData.completionScore}%</span>
											{displayData.confidenceLevel && (
												<div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
													displayData.confidenceLevel === 1 ? 'bg-green-900/50 text-green-400' :
													displayData.confidenceLevel === 2 ? 'bg-yellow-900/50 text-yellow-400' :
													'bg-red-900/50 text-red-400'
												}`}>
													<AlertCircle className="h-3 w-3" />
													{displayData.confidenceLevel === 1 ? 'High' : displayData.confidenceLevel === 2 ? 'Medium' : 'Low'} Confidence
												</div>
											)}
										</div>
									</div>
									<div className="h-2 w-full rounded-full bg-gray-700">
										<div
											className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
											style={{ width: `${displayData.completionScore}%` }}
										/>
									</div>
									<p className="mt-2 text-gray-400 text-xs">
										{displayData.completionScore < 50
											? "Add more interviews to uncover deeper insights"
											: displayData.completionScore < 80
												? "Good progress! A few more interviews will complete the picture"
												: "Excellent coverage of your research questions!"}
									</p>
								</div>
							)}

							{/* Follow-up Recommendations */}
							{externalStatusData && (displayData.followUpRecommendations.length > 0 || displayData.suggestedInterviewTopics.length > 0) && (
								<div className="space-y-4">
									<h3 className="flex items-center gap-2 font-semibold text-lg text-white">
										<MessageSquare className="h-5 w-5 text-purple-400" />
										Suggested Research Areas
									</h3>
									<div className="grid grid-cols-1 gap-4">
										{displayData.followUpRecommendations.length > 0 && (
											<div className="rounded-lg border border-purple-700 bg-purple-900/20 p-4">
												<div className="mb-3 flex items-center gap-2">
													<Lightbulb className="h-4 w-4 text-purple-400" />
													<span className="font-medium text-purple-400 text-sm">Follow-up Research</span>
												</div>
												<div className="space-y-2">
													{displayData.followUpRecommendations.slice(0, 3).map((rec, index) => (
														<div key={`rec-${index}`} className="flex items-start gap-2 text-xs text-gray-300">
															<span className="text-purple-400 mt-1">•</span>
															<span>{rec}</span>
															<div className="text-xs opacity-80">{displayData.nextAction}</div>
														</div>
													))}
												</div>
											</div>
										)}
										{displayData.suggestedInterviewTopics.length > 0 && (
											<div className="rounded-lg border border-purple-700 bg-purple-900/20 p-4">
												<div className="mb-3 flex items-center gap-2">
													<Users className="h-4 w-4 text-purple-400" />
													<span className="font-medium text-purple-400 text-sm">Interview Topics</span>
												</div>
												<div className="space-y-2">
													{displayData.suggestedInterviewTopics.slice(0, 3).map((topic, index) => (
														<div key={`topic-${index}`} className="flex items-start gap-2 text-xs text-gray-300">
															<span className="mt-1 text-purple-400">•</span>
															<span>{topic}</span>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Value Proposition for More Interviews */}
					{/* <div className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
						<div className="flex items-start gap-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
								<TrendingUp className="h-5 w-5" />
							</div>
							<div className="min-w-0 flex-1">
								<h3 className="mb-2 font-semibold text-lg">Unlock deeper insights</h3>
								<p className="mb-4 text-sm leading-relaxed opacity-90">
									Projects with 3+ interviews reveal 40% more insights and stronger patterns. Add more interviews to:
								</p>
								<ul className="space-y-1 text-sm opacity-90">
									<li>• Identify recurring themes and pain points</li>
									<li>• Build more accurate persona profiles</li>
									<li>• Discover opportunities you might have missed</li>
								</ul>
							</div>
						</div>
					</div> */}

					{/* Action Cards */}
					<div className="grid grid-cols-1 gap-3">
						{/* AI-driven next action or fallback to add more */}
						{displayData.nextAction ? (
							<Button onClick={onAddMore} className="h-16 justify-start bg-blue-600 p-4 text-white hover:bg-blue-700">
								<div className="flex items-center gap-4">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
										<Target className="h-5 w-5" />
									</div>
									<div className="text-left">
										<div className="font-medium">AI Recommendation</div>
										<div className="text-xs opacity-80">{displayData.nextAction}</div>
									</div>
								</div>
							</Button>
						) : (
							<Button onClick={onAddMore} className="h-16 justify-start bg-green-600 p-4 text-white hover:bg-green-700">
								<div className="flex items-center gap-4">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
										<Plus className="h-5 w-5" />
									</div>
									<div className="text-left">
										<div className="font-medium">Add another interview</div>
										<div className="text-xs opacity-80">Upload more content to strengthen insights</div>
									</div>
								</div>
							</Button>
						)}

						<Button
							onClick={() => setShowCustomAnalysis(true)}
							className="h-16 justify-start bg-purple-600 p-4 text-white hover:bg-purple-700"
							disabled={isAnalyzing}
						>
							<div className="flex items-center gap-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
									{isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
								</div>
								<div className="text-left">
									<div className="font-medium">Run Custom Analysis</div>
									<div className="text-xs opacity-80">Generate insights with custom instructions</div>
								</div>
							</div>
						</Button>

						<Button
							onClick={onViewResults}
							variant="outline"
							className="h-16 border-gray-600 bg-transparent p-4 text-white hover:bg-gray-800"
						>
							<div className="flex items-center gap-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700">
									<Eye className="h-5 w-5" />
								</div>
								<div className="text-left">
									<div className="font-medium">View full analysis</div>
									<div className="text-xs opacity-60">Explore insights, personas & opportunities</div>
								</div>
							</div>
						</Button>
					</div>

					{/* Tips */}
					<div className="rounded-lg bg-gray-900 p-4">
						<div className="flex items-start gap-3">
							<div className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
							<div>
								<p className="font-medium text-sm text-white">Next steps</p>
								<p className="text-gray-300 text-xs leading-relaxed">
									Your project is now live in your dashboard. You can share it with team members, export insights, or
									continue adding interviews. Each interview makes your insights stronger.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Custom Analysis Modal */}
			{showCustomAnalysis && (
				<div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
					<div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
						<h3 className="text-lg font-semibold text-white mb-4">Custom Analysis</h3>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Custom Instructions (Optional)
								</label>
								<Input
									value={customInstructions}
									onChange={(e) => setCustomInstructions(e.target.value)}
									placeholder="e.g., Focus on pain points, Look for feature gaps..."
									className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
								/>
								<p className="text-xs text-gray-400 mt-1">
									Provide specific instructions for what to analyze or focus on
								</p>
							</div>
							<div className="flex gap-3">
								<Button
									onClick={runCustomAnalysis}
									disabled={isAnalyzing}
									className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
								>
									{isAnalyzing ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin mr-2" />
											Analyzing...
										</>
									) : (
										<>
											<Zap className="h-4 w-4 mr-2" />
											Run Analysis
										</>
									)}
								</Button>
								<Button
									onClick={() => setShowCustomAnalysis(false)}
									variant="outline"
									disabled={isAnalyzing}
									className="border-gray-600 text-gray-300 hover:bg-gray-800"
								>
									Cancel
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Bottom Action */}
			<div className="fixed right-0 bottom-0 left-0 border-gray-800 border-t bg-black p-4">
				<div className="grid grid-cols-3 gap-2">
					{displayData.nextAction ? (
						<Button onClick={onAddMore} className="h-12 bg-blue-600 font-medium text-white hover:bg-blue-700">
							<Target className="mr-1 h-4 w-4" />
							AI Rec
						</Button>
					) : (
						<Button onClick={onAddMore} className="h-12 bg-green-600 font-medium text-white hover:bg-green-700">
							<Plus className="mr-1 h-4 w-4" />
							Add More
						</Button>
					)}
					<Button 
						onClick={() => setShowCustomAnalysis(true)}
						disabled={isAnalyzing}
						className="h-12 bg-purple-600 font-medium text-white hover:bg-purple-700"
					>
						{isAnalyzing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="mr-1 h-4 w-4" />}
						Analyze
					</Button>
					<Button
						onClick={onViewResults}
						variant="outline"
						className="h-12 border-gray-600 bg-transparent font-medium text-white hover:bg-gray-800"
					>
						<Eye className="mr-1 h-4 w-4" />
						View
					</Button>
				</div>
			</div>
		</div>
	)
}
