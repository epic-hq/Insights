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
		<>
		<div className="relative min-h-screen bg-gray-950 text-white">
			{isLoading && (
				<div className="flex h-screen items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
				</div>
			)}

			{/* Clean Header */}
			<div className="bg-gray-950 border-b border-gray-800 px-6 py-8">
				<div className="mx-auto max-w-4xl">
					<h1 className="mb-3 text-3xl font-light text-white tracking-tight">{displayData.projectName}</h1>
					<p className="text-lg text-gray-400">{displayData.icp}</p>
				</div>
			</div>

			{/* Main Content - Streamlined 3-Section Layout */}
			<div className="mx-auto max-w-4xl px-6 py-12 space-y-16">

				{/* Section 1: What We Learned - Merge discoveries + answered questions */}
				{externalStatusData && ((displayData.keyDiscoveries && displayData.keyDiscoveries.length > 0) || displayData.answeredQuestions.length > 0) && (
					<div>
						<div className="mb-8 flex items-center gap-3">
							<CheckCircle className="h-8 w-8 text-green-400" />
							<h2 className="text-3xl font-light text-white">What We Learned</h2>
						</div>
						<div className="rounded-xl border border-green-700 bg-green-900/20 p-8">
							<div className="space-y-6">
								{/* Key Discoveries */}
								{displayData.keyDiscoveries && displayData.keyDiscoveries.slice(0, 4).map((discovery: string, index: number) => (
									<div key={`discovery-${displayData.analysisId}-${index}`} className="flex items-start gap-4">
										<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
										<p className="text-gray-200 text-lg leading-relaxed">{discovery}</p>
									</div>
								))}
								{/* Answered Questions */}
								{displayData.answeredQuestions.slice(0, 3).map((question, index) => (
									<div key={`answered-${index}`} className="flex items-start gap-4">
										<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
										<p className="text-gray-200 text-lg leading-relaxed">{question}</p>
									</div>
								))}
								{/* Show total count */}
								{(displayData.keyDiscoveries?.length || 0) + displayData.answeredQuestions.length > 7 && (
									<div className="pl-8 text-green-300 font-medium">
										+{(displayData.keyDiscoveries?.length || 0) + displayData.answeredQuestions.length - 7} more insights discovered
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Section 2: What's Missing - Open questions + gaps */}
				{externalStatusData && displayData.openQuestions.length > 0 && (
					<div>
						<div className="mb-8 flex items-center gap-3">
							<MessageSquare className="h-8 w-8 text-yellow-400" />
							<h2 className="text-3xl font-light text-white">What's Missing</h2>
						</div>
						<div className="rounded-xl border border-yellow-700 bg-yellow-900/20 p-8">
							<div className="space-y-6">
								{displayData.openQuestions.slice(0, 5).map((question, index) => (
									<div key={`missing-${index}`} className="flex items-start gap-4">
										<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-yellow-400" />
										<p className="text-gray-200 text-lg leading-relaxed">{question}</p>
									</div>
								))}
								{displayData.openQuestions.length > 5 && (
									<div className="pl-8 text-yellow-300 font-medium">
										+{displayData.openQuestions.length - 5} more questions to explore
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Section 3: What's Next - Merge next steps + research recommendations */}
				{externalStatusData && (displayData.nextSteps?.length > 0 || displayData.followUpRecommendations.length > 0 || displayData.suggestedInterviewTopics.length > 0) && (
					<div>
						<div className="mb-8 flex items-center gap-3">
							<Target className="h-8 w-8 text-blue-400" />
							<h2 className="text-3xl font-light text-white">What's Next</h2>
						</div>
						<div className="rounded-xl border border-blue-700 bg-blue-900/20 p-8">
							<div className="space-y-6">
								{/* Next Steps */}
								{displayData.nextSteps?.slice(0, 3).map((step: string, index: number) => (
									<div key={`next-${displayData.analysisId}-${index}`} className="flex items-start gap-4">
										<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
											{index + 1}
										</div>
										<p className="text-gray-200 text-lg leading-relaxed">{step}</p>
									</div>
								))}
								{/* Follow-up Research */}
								{displayData.followUpRecommendations.slice(0, 2).map((rec, index) => (
									<div key={`followup-${index}`} className="flex items-start gap-4">
										<Lightbulb className="h-6 w-6 mt-1 flex-shrink-0 text-blue-400" />
										<p className="text-gray-200 text-lg leading-relaxed">{rec}</p>
									</div>
								))}
								{/* Interview Topics */}
								{displayData.suggestedInterviewTopics.slice(0, 2).map((topic, index) => (
									<div key={`interview-${index}`} className="flex items-start gap-4">
										<Users className="h-6 w-6 mt-1 flex-shrink-0 text-blue-400" />
										<p className="text-gray-200 text-lg leading-relaxed">{topic}</p>
									</div>
								))}
								{/* Show total count */}
								{(displayData.nextSteps?.length || 0) + displayData.followUpRecommendations.length + displayData.suggestedInterviewTopics.length > 7 && (
									<div className="pl-8 text-blue-300 font-medium">
										+{(displayData.nextSteps?.length || 0) + displayData.followUpRecommendations.length + displayData.suggestedInterviewTopics.length - 7} more actions recommended
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Research Progress - Simplified */}
				{externalStatusData && displayData.completionScore > 0 && (
					<div className="rounded-xl bg-gray-900/50 border border-gray-700 p-8">
						<div className="mb-6 flex items-center justify-between">
							<h3 className="text-xl font-light text-white">Research Progress</h3>
							<div className="flex items-center gap-3">
								<span className="text-2xl font-bold text-white">{displayData.completionScore}%</span>
								{displayData.confidenceLevel && (
									<div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
										displayData.confidenceLevel === 1 ? 'bg-green-900/50 text-green-400' :
										displayData.confidenceLevel === 2 ? 'bg-yellow-900/50 text-yellow-400' :
										'bg-red-900/50 text-red-400'
									}`}>
										<AlertCircle className="h-4 w-4" />
										{displayData.confidenceLevel === 1 ? 'High' : displayData.confidenceLevel === 2 ? 'Medium' : 'Low'} Confidence
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
						<div className="rounded-2xl bg-blue-50 border border-blue-100 p-8 text-center">
							<h3 className="mb-3 text-xl font-light text-gray-900">Recommended Action</h3>
							<p className="mb-6 text-gray-600 leading-relaxed">{displayData.nextAction}</p>
							<Button
								onClick={onAddMore}
								className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-full font-medium"
							>
								Take Action
							</Button>
						</div>
					</div>
				)}

				{/* Simple Actions */}
				<div className="mx-auto max-w-4xl px-6 py-8">
					<div className="flex justify-center gap-4">
						<Button
							onClick={onViewResults}
							variant="outline"
							className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white px-6 py-3"
						>
							<Eye className="mr-2 h-4 w-4" />
							View Full Analysis
						</Button>
						<Button
							onClick={() => setShowCustomAnalysis(true)}
							disabled={isAnalyzing}
							variant="outline"
							className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white px-6 py-3"
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
			<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
				<div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-xl">
					<h3 className="text-xl font-light text-white mb-6">Custom Analysis</h3>
					<div className="space-y-6">
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-3">
								Custom Instructions (Optional)
							</label>
							<Input
								value={customInstructions}
								onChange={(e) => setCustomInstructions(e.target.value)}
								placeholder="e.g., Focus on pain points, Look for feature gaps..."
								className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
							/>
							<p className="text-xs text-gray-400 mt-2">
								Provide specific instructions for what to analyze or focus on
							</p>
						</div>
						<div className="flex gap-3">
							<Button
								onClick={runCustomAnalysis}
								disabled={isAnalyzing}
								className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
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
