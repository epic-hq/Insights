import { CheckCircle, Eye, Lightbulb, MessageSquare, Plus, TrendingUp, Users, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "~/components/ui/button"
import type { ProjectStatusData } from "~/utils/project-status.server"

interface ProjectStatusScreenProps {
	projectName: string
	icp: string
	projectId?: string
	onAddMore: () => void
	onViewResults: () => void
}

export default function ProjectStatusScreen({ projectName, icp, projectId, onAddMore, onViewResults }: ProjectStatusScreenProps) {
	const [statusData, setStatusData] = useState<ProjectStatusData | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	
	useEffect(() => {
		if (projectId) {
			fetchProjectStatus()
		}
	}, [projectId]) // fetchProjectStatus is defined inside the component, dependency is okay

	const fetchProjectStatus = async () => {
		if (!projectId) return
		
		setIsLoading(true)
		try {
			const response = await fetch(`/api/project-status?projectId=${projectId}`)
			if (response.ok) {
				const result = await response.json()
				if (result.success) {
					setStatusData(result.data)
				}
			}
		} catch (error) {
			console.error('Failed to fetch project status:', error)
		} finally {
			setIsLoading(false)
		}
	}

	// Use real data if available, otherwise fallback to props
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
		lastUpdated: new Date()
	}
	return (
		<div className="relative min-h-screen bg-black text-white">
			{/* Header */}
			<div className="border-gray-800 border-b bg-black p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600">
							<CheckCircle className="h-4 w-4" />
						</div>
						<h1 className="font-semibold text-lg text-white">Your project is ready!</h1>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="p-4 pb-24">
				<div className="space-y-6">
					{/* Success Message */}
					<div className="space-y-3 text-center">
						<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
							{isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <CheckCircle className="h-8 w-8" />}
						</div>
						<h2 className="font-bold text-2xl text-white">Analysis Complete!</h2>
						<p className="text-gray-300 text-sm leading-relaxed">
							We've analyzed your {displayData.totalInterviews > 1 ? 'interviews' : 'interview'} and generated insights about {displayData.icp}.
						</p>
					</div>

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
											<span>{displayData.totalInterviews} {displayData.totalInterviews === 1 ? 'interview' : 'interviews'} analyzed</span>
										</div>
										<div className="text-gray-500">•</div>
										<div className="text-gray-400">
											{statusData ? new Date(displayData.lastUpdated).toLocaleDateString() : 'Just completed'}
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

					{/* Research Progress: What's Answered vs Open */}
					{statusData && (displayData.answeredQuestions.length > 0 || displayData.openQuestions.length > 0) && (
						<div className="space-y-4">
							<h3 className="flex items-center gap-2 font-semibold text-lg text-white">
								<Lightbulb className="h-5 w-5 text-yellow-400" />
								Research Progress
							</h3>
							
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								{/* Answered Questions */}
								{displayData.answeredQuestions.length > 0 && (
									<div className="rounded-lg border border-green-700 bg-green-900/20 p-4">
										<div className="flex items-center gap-2 mb-3">
											<CheckCircle className="h-4 w-4 text-green-400" />
											<span className="font-medium text-green-400 text-sm">Questions Answered ({displayData.answeredQuestions.length})</span>
										</div>
										<div className="space-y-2">
											{displayData.answeredQuestions.slice(0, 3).map((question, index) => (
												<div key={index} className="text-xs text-gray-300">
													• {question}
												</div>
											))}
											{displayData.answeredQuestions.length > 3 && (
												<div className="text-xs text-gray-400 italic">
													+{displayData.answeredQuestions.length - 3} more answered
												</div>
											)}
										</div>
									</div>
								)}

								{/* Open Questions */}
								{displayData.openQuestions.length > 0 && (
									<div className="rounded-lg border border-yellow-700 bg-yellow-900/20 p-4">
										<div className="flex items-center gap-2 mb-3">
											<MessageSquare className="h-4 w-4 text-yellow-400" />
											<span className="font-medium text-yellow-400 text-sm">Still Need Answers ({displayData.openQuestions.length})</span>
										</div>
										<div className="space-y-2">
											{displayData.openQuestions.slice(0, 3).map((question, index) => (
												<div key={index} className="text-xs text-gray-300">
													• {question}
												</div>
											))}
											{displayData.openQuestions.length > 3 && (
												<div className="text-xs text-gray-400 italic">
													+{displayData.openQuestions.length - 3} more questions
												</div>
											)}
										</div>
									</div>
								)}
							</div>

							{/* Completion Progress */}
							{statusData && displayData.completionScore > 0 && (
								<div className="rounded-lg bg-gray-900 p-4">
									<div className="flex items-center justify-between mb-2">
										<span className="font-medium text-sm text-white">Research Completion</span>
										<span className="font-bold text-sm text-white">{displayData.completionScore}%</span>
									</div>
									<div className="w-full bg-gray-700 rounded-full h-2">
										<div 
											className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all"
											style={{ width: `${displayData.completionScore}%` }}
										/>
									</div>
									<p className="mt-2 text-xs text-gray-400">
										{displayData.completionScore < 50 
											? "Add more interviews to uncover deeper insights" 
											: displayData.completionScore < 80 
											? "Good progress! A few more interviews will complete the picture"
											: "Excellent coverage of your research questions!"
										}
									</p>
								</div>
							)}
						</div>
					)}

					{/* Value Proposition for More Interviews */}
					<div className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
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
					</div>

					{/* Action Cards */}
					<div className="grid grid-cols-1 gap-3">
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

						<Button
							onClick={onViewResults}
							variant="outline"
							className="h-16 justify-start border-gray-600 bg-transparent p-4 text-white hover:bg-gray-800"
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

			{/* Bottom Action */}
			<div className="fixed right-0 bottom-0 left-0 border-gray-800 border-t bg-black p-4">
				<div className="grid grid-cols-2 gap-3">
					<Button onClick={onAddMore} className="h-12 bg-green-600 font-medium text-white hover:bg-green-700">
						<Plus className="mr-2 h-4 w-4" />
						Add More
					</Button>
					<Button
						onClick={onViewResults}
						variant="outline"
						className="h-12 border-gray-600 bg-transparent font-medium text-white hover:bg-gray-800"
					>
						<Eye className="mr-2 h-4 w-4" />
						View Results
					</Button>
				</div>
			</div>
		</div>
	)
}
