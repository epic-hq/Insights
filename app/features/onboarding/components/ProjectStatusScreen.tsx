import {
	AlertCircle,
	CheckCircle,
	CircleHelp,
	Eye,
	FileText,
	Info,
	Lightbulb,
	Loader2,
	MessageSquare,
	Target,
	TrendingUp,
	Users,
	X,
	Zap,
	ArrowRight,
	BookOpen,
	Search,
	PlusCircle,
	Headphones,
	Settings2,
	MicVocalIcon,
	Mic2Icon,
} from "lucide-react"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Link, useRevalidator } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useCurrentProject } from "~/contexts/current-project-context"
import { ProjectEditButton } from "~/features/projects/components/ProjectEditButton"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { ProjectStatusData } from "~/utils/project-status.server"
import type { Project_Section } from "~/types"
import { createClient } from "~/lib/supabase/client"
import { FlowDiagram } from "~/features/projects/components/Flow"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog"
import { Workflow } from "lucide-react"
import { QuestionWidget } from "~/components/questions/QuestionWidget"

interface ProjectStatusScreenProps {
	projectName: string
	icp: string
	projectId?: string
	accountId?: string
	statusData?: ProjectStatusData | null
	personas?: any[]
	insights?: any[]
}

export default function ProjectStatusScreen({
	projectName,
	icp,
	projectId,
	accountId,
	statusData,
	personas = [],
	insights = [],
}: ProjectStatusScreenProps) {
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const [customInstructions, setCustomInstructions] = useState("")
	const [showCustomAnalysis, setShowCustomAnalysis] = useState(false)
	const [projectSections, setProjectSections] = useState<Project_Section[]>([])
	const [loading, setLoading] = useState(true)
	const [showFlowView, setShowFlowView] = useState(false)
	const revalidator = useRevalidator()
	const currentProjectContext = useCurrentProject()
	const projectPath =
		currentProjectContext?.projectPath ?? (accountId && projectId ? `/a/${accountId}/${projectId}` : "")
	const routes = useProjectRoutes(projectPath)
	const supabase = createClient()

	// Fetch project sections (goals from onboarding)
	useEffect(() => {
		const fetchProjectSections = async () => {
			if (!projectId) return

			try {
				const { data, error } = await supabase
					.from("project_sections")
					.select("*")
					.eq("project_id", projectId)
					.order("position", { ascending: true, nullsFirst: false })
					.order("created_at", { ascending: false })

				if (data && !error) {
					setProjectSections(data)
				}
			} catch (error) {
				console.error("Error fetching project sections:", error)
			} finally {
				setLoading(false)
			}
		}

		fetchProjectSections()
	}, [projectId, supabase])

	// Helper functions to organize project sections and match with analysis
	const getGoalSections = () => projectSections.filter((section) => section.kind === "goal")
	const getTargetMarketSections = () => projectSections.filter((section) => section.kind === "target_market")
	const getAssumptionSections = () => projectSections.filter((section) => section.kind === "assumptions")
	const getRiskSections = () => projectSections.filter((section) => section.kind === "risks")
	const getQuestionsSections = () => projectSections.filter((section) => section.kind === "questions")

	// Map analysis results to original goals
	const getGoalStatus = (goalContent: string) => {
		if (!statusData?.questionAnswers) return { status: "pending", confidence: 0 }

		// Try to match this goal with answered questions
		const matchedAnswer = statusData.questionAnswers.find(
			(qa) =>
				goalContent.toLowerCase().includes(qa.question.toLowerCase().split(" ").slice(0, 3).join(" ")) ||
				qa.question.toLowerCase().includes(goalContent.toLowerCase().split(" ").slice(0, 3).join(" "))
		)

		if (matchedAnswer) {
			return {
				status: "answered",
				confidence: matchedAnswer.confidence || 0,
				answer: matchedAnswer.answer_summary,
				evidence: matchedAnswer.evidence,
			}
		}

		return { status: "open", confidence: 0 }
	}

	// Map analysis results to interview questions stored in project_sections
	const getQuestionStatus = (questionText: string) => {
		if (!statusData?.questionAnswers) return { status: "pending", confidence: 0 }

		// Try to match this question with answered questions from analysis
		const matchedAnswer = statusData.questionAnswers.find((qa) => {
			const qaText = qa.question.toLowerCase()
			const qText = questionText.toLowerCase()
			// More flexible matching for question text
			return (
				qaText.includes(qText.split(" ").slice(0, 5).join(" ")) ||
				qText.includes(qaText.split(" ").slice(0, 5).join(" ")) ||
				// Fuzzy match key words
				qaText
					.split(" ")
					.some((word) => word.length > 3 && qText.includes(word)) ||
				qText.split(" ").some((word) => word.length > 3 && qaText.includes(word))
			)
		})

		if (matchedAnswer) {
			return {
				status: "answered" as const,
				confidence: matchedAnswer.confidence || 0,
				answer: matchedAnswer.answer_summary,
				evidence: matchedAnswer.evidence,
				insights_found: matchedAnswer.insights_found,
			}
		}

		return { status: "pending" as const, confidence: 0 }
	}

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
				// Analysis complete
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
		totalEvidence: 0,
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
		questionAnswers: [],
	}
	if (!projectId) {
		return
	}

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-foreground" />
			</div>
		)
	}

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			{isAnalyzing && (
				<div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
					<Loader2 className="h-8 w-8 animate-spin text-foreground" />
				</div>
			)}

			{/* Compact Header */}
			<div className="border-border border-b bg-background px-6 py-4">
				<div className="mx-auto flex max-w-6xl items-center justify-between">
					<div>
						<p className="text-foreground font-semibold  text-xl">Goal: {displayData.projectName}</p>
					</div>
					<div className="flex items-center gap-3">
						{/* Flow View Toggle Button */}
						{/* <Button
							variant={showFlowView ? "default" : "outline"}
							size="sm"
							onClick={() => setShowFlowView(!showFlowView)}
							className={
								showFlowView
									? "bg-blue-600 text-white hover:bg-blue-700"
									: "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-800 dark:from-blue-950/20 dark:to-indigo-950/20 dark:text-blue-300 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30"
							}
						>
							<Workflow className="w-4 h-4 mr-2" />
							{showFlowView ? "Dashboard View" : "Research Flow"}
						</Button> */}
						<ProjectEditButton project={{ id: projectId }} />
					</div>
				</div>
			</div>

			{showFlowView ? (
				/* Flow View - Two Column Layout */
				<div className="flex-1 min-h-screen bg-background">
					<div className="mx-auto max-w-7xl px-6 py-8">
						<div className="grid grid-cols-2 gap-12 min-h-[80vh]">
							{/* Left Side: Flow Diagram */}
							<div className="flex flex-col items-center justify-center space-y-6 pr-8">
								{/* Research Goals */}
								<motion.div
									className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all w-full max-w-sm text-center"
									whileHover={{ scale: 1.02 }}
									onClick={() => {
										if (routes) {
											window.location.href = routes.projects.setup()
										}
									}}
								>
									<Target className="h-8 w-8 text-blue-600 mx-auto mb-3" />
									<h3 className="font-semibold text-xl text-blue-800 dark:text-blue-300 mb-2">Research Goals</h3>
									<div className="text-blue-600 dark:text-blue-400">
										{statusData?.questionAnswers?.length || 0}/
										{(statusData?.questionAnswers?.length || 0) + (statusData?.openQuestions?.length || 0)} Questions
									</div>
								</motion.div>

								<div className="w-px h-12 bg-gradient-to-b from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-700" />

								{/* Interviews */}
								<motion.div
									className="bg-green-50 dark:bg-green-950/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all w-full max-w-sm text-center"
									whileHover={{ scale: 1.02 }}
									onClick={() => routes && (window.location.href = routes.interviews.index())}
								>
									<Headphones className="h-8 w-8 text-green-600 mx-auto mb-3" />
									<h3 className="font-semibold text-xl text-green-800 dark:text-green-300 mb-2">Interviews</h3>
									<div className="text-green-600 dark:text-green-400">{statusData?.totalInterviews || 0} Conducted</div>
								</motion.div>

								<div className="w-px h-12 bg-gradient-to-b from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-700" />

								{/* Evidence */}
								<motion.div
									className="bg-purple-50 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-800 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all w-full max-w-sm text-center"
									whileHover={{ scale: 1.02 }}
									onClick={() => routes && (window.location.href = routes.evidence.index())}
								>
									<BookOpen className="h-8 w-8 text-purple-600 mx-auto mb-3" />
									<h3 className="font-semibold text-xl text-purple-800 dark:text-purple-300 mb-2">Evidence</h3>
									<div className="text-purple-600 dark:text-purple-400">{statusData?.totalEvidence || 0} Pieces</div>
								</motion.div>

								<div className="w-px h-12 bg-gradient-to-b from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-700" />

								{/* Personas */}
								<motion.div
									className="bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all w-full max-w-sm text-center"
									whileHover={{ scale: 1.02 }}
									onClick={() => routes && (window.location.href = routes.personas.index())}
								>
									<Users className="h-8 w-8 text-orange-600 mx-auto mb-3" />
									<h3 className="font-semibold text-xl text-orange-800 dark:text-orange-300 mb-2">Personas</h3>
									<div className="text-orange-600 dark:text-orange-400">
										{statusData?.totalPersonas || personas?.length || 0} Identified
									</div>
								</motion.div>

								<div className="w-px h-12 bg-gradient-to-b from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-700" />

								{/* Insights */}
								<motion.div
									className="bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all w-full max-w-sm text-center"
									whileHover={{ scale: 1.02 }}
									onClick={() => routes && (window.location.href = routes.insights.index())}
								>
									<Lightbulb className="h-8 w-8 text-indigo-600 mx-auto mb-3" />
									<h3 className="font-semibold text-xl text-indigo-800 dark:text-indigo-300 mb-2">Insights</h3>
									<div className="text-indigo-600 dark:text-indigo-400">
										{statusData?.totalInsights || insights?.length || 0} Generated
									</div>
								</motion.div>
							</div>

							{/* Right Side: Data Details */}
							<div className="overflow-y-auto pl-8 border-l border-gray-200 dark:border-gray-700 space-y-8">
								<div className="space-y-6">
									<h3 className="font-semibold text-2xl text-foreground flex items-center gap-3">
										<Target className="h-6 w-6 text-blue-600" />
										Research Progress
									</h3>
									<div className="space-y-4">
										<div className="flex justify-between items-center">
											<span className="text-muted-foreground">Questions Answered</span>
											<span className="font-semibold text-lg">
												{statusData?.questionAnswers?.length || 0} /{" "}
												{(statusData?.questionAnswers?.length || 0) + (statusData?.openQuestions?.length || 0)}
											</span>
										</div>
										<div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
											<div
												className="bg-blue-600 h-3 rounded-full transition-all"
												style={{
													width: `${((statusData?.questionAnswers?.length || 0) / Math.max(1, (statusData?.questionAnswers?.length || 0) + (statusData?.openQuestions?.length || 0))) * 100}%`,
												}}
											/>
										</div>
									</div>
								</div>

								<div className="space-y-6">
									<h3 className="font-semibold text-2xl text-foreground flex items-center gap-3">
										<Headphones className="h-6 w-6 text-green-600" />
										Data Collection
									</h3>
									<div className="grid grid-cols-2 gap-4">
										<div className="bg-card border border-border rounded-xl p-6 text-center">
											<div className="text-3xl font-bold text-foreground mb-2">{statusData?.totalInterviews || 0}</div>
											<div className="text-sm text-muted-foreground">Interviews</div>
										</div>
										<div className="bg-card border border-border rounded-xl p-6 text-center">
											<div className="text-3xl font-bold text-foreground mb-2">{statusData?.totalEvidence || 0}</div>
											<div className="text-sm text-muted-foreground">Evidence</div>
										</div>
									</div>
								</div>

								<div className="space-y-6">
									<h3 className="font-semibold text-2xl text-foreground flex items-center gap-3">
										<Users className="h-6 w-6 text-orange-600" />
										Analysis Results
									</h3>
									<div className="grid grid-cols-2 gap-4">
										<div className="bg-card border border-border rounded-xl p-6 text-center">
											<div className="text-3xl font-bold text-foreground mb-2">
												{statusData?.totalPersonas || personas?.length || 0}
											</div>
											<div className="text-sm text-muted-foreground">Personas</div>
										</div>
										<div className="bg-card border border-border rounded-xl p-6 text-center">
											<div className="text-3xl font-bold text-foreground mb-2">
												{statusData?.totalInsights || insights?.length || 0}
											</div>
											<div className="text-sm text-muted-foreground">Insights</div>
										</div>
									</div>
								</div>

								{/* Quick Actions */}
								<div className="space-y-6">
									<h3 className="font-semibold text-2xl text-foreground flex items-center gap-3">
										<Zap className="h-6 w-6 text-yellow-600" />
										Quick Actions
									</h3>
									<div className="space-y-3">
										<Button
											variant="outline"
											className="w-full justify-start h-12 text-base"
											onClick={() => {
												if (routes) {
													window.location.href = routes.interviews.onboard()
												}
											}}
										>
											<PlusCircle className="h-5 w-5 mr-3" />
											Add Interview
										</Button>
										<Button
											variant="outline"
											className="w-full justify-start h-12 text-base"
											onClick={() => {
												if (routes) {
													window.location.href = routes.evidence.index()
												}
											}}
										>
											<Eye className="h-5 w-5 mr-3" />
											View Evidence
										</Button>
										<Button
											variant="outline"
											className="w-full justify-start h-12 text-base"
											onClick={() => {
												if (routes) {
													window.location.href = routes.personas.index()
												}
											}}
										>
											<Users className="h-5 w-5 mr-3" />
											Explore Personas
										</Button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				/* Dashboard View - Original Layout */
				<div>
					{/* Prominent Analysis Action */}
					<div className="mx-auto max-w-6xl px-6 py-4">
						<div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<h2 className="font-semibold text-lg text-foreground">Research Analysis</h2>
									{/* Progress indicator moved here */}
									{statusData && displayData.completionScore > 0 && (
										<div className="flex items-center gap-2 mt-2">
											<div className="w-24 h-2 rounded-full bg-white/20">
												<div
													className="h-2 rounded-full bg-gradient-to-r from-green-400 to-blue-400 transition-all"
													style={{ width: `${displayData.completionScore}%` }}
												/>
											</div>
											<span className="text-sm font-medium text-blue-700 dark:text-blue-300">
												{displayData.completionScore}% complete
											</span>
										</div>
									)}
								</div>

								<div className="flex flex-col gap-2 ml-4">
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													onClick={() => setShowCustomAnalysis(true)}
													disabled={isAnalyzing}
													variant="outline"
													size="sm"
												>
													{isAnalyzing ? (
														<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													) : (
														<Zap className="mr-2 h-4 w-4" />
													)}
													Custom Analysis
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Run analysis with custom instructions to focus on specific aspects</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>

									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													onClick={runCustomAnalysis}
													disabled={isAnalyzing}
													className="bg-blue-600 hover:bg-blue-700"
													size="sm"
												>
													{isAnalyzing ? (
														<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													) : (
														<Target className="mr-2 h-4 w-4" />
													)}
													{statusData?.hasAnalysis ? "Update Analysis" : "Run Analysis"}
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>
													{statusData?.hasAnalysis
														? "Re-run analysis with latest interview data"
														: "Analyze interviews to identify patterns, gaps, and insights"}
												</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							</div>
						</div>
					</div>

					{/* Main Research Framework */}
					<div className="mx-auto max-w-6xl px-6 py-6">
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							{/* Left Column: Research Goals & Gap Analysis */}
							<div className="lg:col-span-2 space-y-6">
								{/* Research Goals Section */}
								{getGoalSections().length > 0 && (
									<div>
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<Target className="h-5 w-5 text-blue-600" />
												Research Goals
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													if (routes) {
														window.location.href = routes.projects.setup()
													}
												}}
											>
												Edit ProjectGoals
											</Button>
										</div>
										<Card>
											{/* <CardHeader className="pb-2">
										<CardTitle className="flex items-center gap-2"></CardTitle>
									</CardHeader> */}
											<CardContent className="space-y-4">
												<div className="text-sm text-muted-foreground/50">Desired Findings (Goal Details)</div>
												{getGoalSections().map((goalSection) => {
													const goalStatus = getGoalStatus(goalSection.content_md)
													return (
														<div key={goalSection.id} className="flex items-start gap-3">
															<div className="flex-shrink-0 mt-1">
																{goalStatus.status === "answered" ? (
																	<CheckCircle className="h-5 w-5 text-green-600" />
																) : goalStatus.status === "open" ? (
																	<CircleHelp className="h-5 w-5 text-amber-600" />
																) : (
																	<Target className="h-5 w-5 text-gray-400" />
																)}
															</div>
															<div className="flex-1">
																<p className="font-medium text-foreground text-sm">{goalSection.content_md}</p>
																{goalStatus.status === "answered" && goalStatus.answer && (
																	<div className="mt-2 p-3 rounded bg-green-50 dark:bg-green-950/20">
																		<p className="text-sm text-green-800 dark:text-green-200">{goalStatus.answer}</p>
																		{goalStatus.confidence && (
																			<Badge variant="outline" className="mt-2 text-xs">
																				{goalStatus.confidence === 1
																					? "High"
																					: goalStatus.confidence === 2
																						? "Medium"
																						: "Low"}{" "}
																				confidence
																			</Badge>
																		)}
																	</div>
																)}
																{goalStatus.status === "open" && (
																	<p className="text-sm text-muted-foreground mt-1">
																		Needs more evidence from interviews
																	</p>
																)}
															</div>
														</div>
													)
												})}
											</CardContent>
										</Card>
									</div>
								)}

								{/* Target Market & What We Learned */}
								<div>
									<div className="flex items-center justify-between mb-3">
										<div className="flex items-center gap-2">
											<Users className="h-5 w-5 text-purple-600" />
											Target Market & What We Learned
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => {
												if (routes) {
													window.location.href = routes.projects.setup()
												}
											}}
										>
											<Settings2 className="h-5 w-5 text-indigo-600" />
											Edit
										</Button>
									</div>
									<Card>
										<CardContent className="space-y-4">
											{/* Enhanced Target Market Display */}
											{getTargetMarketSections().length > 0 && (
												<div className="space-y-3">
													{getTargetMarketSections().map((section) => {
														const meta = section.meta as any
														return (
															<div key={section.id} className="space-y-3">
																{/* Target Organizations */}
																{meta?.target_orgs && (
																	<div>
																		<div className="text-xs text-muted-foreground mb-1">Target Organizations</div>
																		<div className="flex flex-wrap gap-1">
																			{(Array.isArray(meta.target_orgs)
																				? meta.target_orgs
																				: meta.target_orgs.split(", ")
																			).map((org: string, i: number) => (
																				<Badge key={i} variant="outline" className="text-xs">
																					{org}
																				</Badge>
																			))}
																		</div>
																	</div>
																)}

																{/* Target Roles */}
																{meta?.target_roles && (
																	<div>
																		<div className="text-xs text-muted-foreground mb-1">Target Roles</div>
																		<div className="flex flex-wrap gap-1">
																			{(Array.isArray(meta.target_roles)
																				? meta.target_roles
																				: meta.target_roles.split(", ")
																			).map((role: string, i: number) => (
																				<Badge key={i} variant="outline" className="text-xs">
																					{role}
																				</Badge>
																			))}
																		</div>
																	</div>
																)}

																{/* Research Goal Details */}
																{meta?.research_goal_details && (
																	<div>
																		<div className="text-xs text-muted-foreground mb-1">Goal Details</div>
																		<div className="text-sm text-foreground bg-muted/30 p-2 rounded">
																			{meta.research_goal_details}
																		</div>
																	</div>
																)}

																{/* Unknowns */}
																{meta?.unknowns && (
																	<div>
																		<div className="text-xs text-muted-foreground mb-1">Key Unknowns</div>
																		<div className="text-sm text-foreground bg-muted/30 p-2 rounded">
																			{Array.isArray(meta.unknowns) ? meta.unknowns.join(", ") : meta.unknowns}
																		</div>
																	</div>
																)}

																{/* Original markdown content as fallback */}
																{!meta?.target_orgs && !meta?.target_roles && (
																	<div className="p-2 rounded-lg bg-muted/50">
																		<div className="text-sm text-foreground prose prose-sm max-w-none">
																			<ReactMarkdown>{section.content_md}</ReactMarkdown>
																		</div>
																	</div>
																)}
															</div>
														)
													})}
												</div>
											)}

											{/* Discovered Personas */}
											{personas.length > 0 && (
												<div>
													<div className="flex items-center gap-2 mb-3">
														<h4 className="font-medium text-sm text-muted-foreground">Personas Discovered</h4>
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger>
																	<Info className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
																</TooltipTrigger>
																<TooltipContent>
																	<p className="max-w-xs">
																		The percentage represents how much of your interview data this persona represents
																		based on similar patterns, behaviors, and characteristics found across participants.
																	</p>
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</div>
													<div className="space-y-3">
														{personas.slice(0, 3).map((persona) => (
															<div
																key={persona.id}
																className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
																onClick={() => routes && (window.location.href = routes.personas.detail(persona.id))}
															>
																<div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
																	<Users className="h-4 w-4 text-purple-600" />
																</div>
																<div className="flex-1">
																	<div className="flex items-center gap-2 mb-1">
																		<h5 className="font-medium text-sm text-foreground">{persona.name}</h5>
																		{persona.percentage && (
																			<Badge variant="secondary" className="text-xs">
																				{persona.percentage}%
																			</Badge>
																		)}
																	</div>
																	<p className="text-xs text-muted-foreground line-clamp-2">{persona.description}</p>
																	{persona.topThemes && persona.topThemes.length > 0 && (
																		<div className="flex flex-wrap gap-1 mt-2">
																			{persona.topThemes.slice(0, 3).map((theme: string, i: number) => (
																				<Badge key={i} variant="outline" className="text-xs">
																					{theme}
																				</Badge>
																			))}
																		</div>
																	)}
																</div>
															</div>
														))}
													</div>
													<div className="flex gap-2 mt-3">
														<Button
															variant="outline"
															size="sm"
															className="flex-1"
															onClick={() => routes && (window.location.href = routes.personas.index())}
														>
															View All Personas
														</Button>
														<Button
															variant="outline"
															size="sm"
															className="flex-1"
															onClick={() => routes && (window.location.href = routes.themes.index())}
														>
															Persona × Theme Matrix
														</Button>
													</div>
												</div>
											)}
										</CardContent>
									</Card>
								</div>

								{/* Questions Answered Status */}
								{statusData && statusData.hasAnalysis && (
									<div data-section="questions">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<Search className="h-5 w-5 text-green-600" />
												Questions (Answered {statusData?.questionAnswers?.length || 0} of{" "}
												{(statusData?.questionAnswers?.length || 0) + (statusData?.openQuestions?.length || 0)})
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													if (routes) {
														window.location.href = routes.questions?.index() || "#"
													}
												}}
											>
												<BookOpen className="h-4 w-4 mr-2" />
												Manage Questions
											</Button>
										</div>
										<Card>
											<CardContent className="space-y-6">
												{/* Questions Answered */}
												{statusData.questionAnswers && statusData.questionAnswers.length > 0 && (
													<div>
														<div className="space-y-3">
															{statusData.questionAnswers.slice(0, 5).map((qa) => (
																<div
																	key={`qa-${qa.question}`}
																	className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
																>
																	<div className="flex items-start gap-2 mb-2">
																		<CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
																		<div className="flex-1">
																			<p className="font-medium text-sm text-foreground">{qa.question}</p>
																			{qa.answer_summary && (
																				<p className="text-sm text-muted-foreground mt-1">{qa.answer_summary}</p>
																			)}
																			{qa.confidence && (
																				<Badge variant="outline" className="mt-2 text-xs">
																					{qa.confidence === 1 ? "High" : qa.confidence === 2 ? "Medium" : "Low"}{" "}
																					confidence
																				</Badge>
																			)}
																		</div>
																	</div>
																</div>
															))}
															{statusData.questionAnswers.length > 5 && (
																<p className="text-xs text-muted-foreground">
																	+{statusData.questionAnswers.length - 5} more questions answered
																</p>
															)}
														</div>
													</div>
												)}

												{/* Open Questions */}
												{statusData.openQuestions && statusData.openQuestions.length > 0 && (
													<div>
														<h4 className="font-medium text-sm text-amber-700 dark:text-amber-400 mb-3">
															Unanswered ({statusData.openQuestions.length})
														</h4>
														<div className="space-y-2">
															{statusData.openQuestions.slice(0, 5).map((question, index) => (
																<div
																	key={`open-${index}`}
																	className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
																>
																	<CircleHelp className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
																	<p className="text-sm text-foreground">{question}</p>
																</div>
															))}
															{statusData.openQuestions.length > 5 && (
																<p className="text-xs text-muted-foreground">
																	+{statusData.openQuestions.length - 5} more questions need answers
																</p>
															)}
														</div>
													</div>
												)}
											</CardContent>
										</Card>
									</div>
								)}

								{/* Interview Questions */}
								<div>
									<div className="flex flex-row justify-between gap-2 mb-3">
										<div className="flex items-center gap-2 mb-3">
											<Headphones className="h-5 w-5 text-indigo-600" />
											Interview Questions
										</div>
										<div className="flex flex-row items-center gap-2">
											<Button
												variant="outline"
												onClick={() => {
													if (routes) {
														window.location.href = routes.questions?.index() || "#"
													}
												}}
											>
												<Settings2 className="h-5 w-5 text-indigo-600" />
												Edit
											</Button>
										</div>
									</div>
									<Card>
										<CardContent>
											<div className="space-y-3">
												{getQuestionsSections().length > 0 ? (
													getQuestionsSections()
														.slice(0, 1)
														.map((section) => {
															const questions = Array.isArray(section.meta?.questions) ? section.meta.questions : []
															return (
																<div key={section.id} className="space-y-3">
																	{questions
																		.slice(0, 5)
																		.map((question: { text: string; id: string }, index: number) => {
																			const questionStatus = getQuestionStatus(question.text)
																			return (
																				<div
																					key={`question-${question.id || index}`}
																					className={`p-3 rounded-lg border ${
																						questionStatus.status === "answered"
																							? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
																							: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
																					}`}
																				>
																					<div className="flex items-start gap-2">
																						{questionStatus.status === "answered" ? (
																							<CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
																						) : (
																							<CircleHelp className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
																						)}
																						<div className="flex-1">
																							<p className="font-medium text-sm text-foreground">{question.text}</p>
																							{questionStatus.status === "answered" && questionStatus.answer && (
																								<div className="mt-2 text-sm text-muted-foreground">
																									{questionStatus.answer}
																								</div>
																							)}
																							{questionStatus.confidence && (
																								<Badge variant="outline" className="mt-2 text-xs">
																									{questionStatus.confidence === 1
																										? "High"
																										: questionStatus.confidence === 2
																											? "Medium"
																											: "Low"}{" "}
																									confidence
																								</Badge>
																							)}
																						</div>
																					</div>
																				</div>
																			)
																		})}
																	{questions.length > 5 && (
																		<p className="text-xs text-muted-foreground">
																			+{questions.length - 5} more interview questions
																		</p>
																	)}
																</div>
															)
														})
												) : (
													<div className="text-center py-6">
														<BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
														<p className="text-sm text-muted-foreground">No interview questions generated yet</p>
														<Button
															variant="outline"
															size="sm"
															className="mt-2"
															onClick={() => {
																if (routes) {
																	window.location.href = routes.projects.setup()
																}
															}}
														>
															Generate Questions
														</Button>
													</div>
												)}
											</div>
										</CardContent>
									</Card>
								</div>

								{/* Add Interviews section when no interviews exist */}
								{(!statusData?.totalInterviews || statusData.totalInterviews === 0) && (
									<div>
										<div className="flex items-center gap-2 mb-3">
											<Headphones className="h-5 w-5 text-green-600" />
											Research Analysis
										</div>
										<Card>
											<CardContent className="text-center py-8">
												<div className="space-y-4">
													<div>
														<Headphones className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
														<h3 className="font-semibold text-lg text-foreground">No Interviews Yet</h3>
														<p className="text-muted-foreground text-sm">
															Add your first interview to start generating insights and analysis
														</p>
													</div>
													<Button
														onClick={() => {
															if (routes) {
																window.location.href = routes.interviews.onboard()
															}
														}}
														className="bg-green-600 hover:bg-green-700"
													>
														<PlusCircle className="mr-2 h-4 w-4" />
														Add Interviews
													</Button>
												</div>
											</CardContent>
										</Card>
									</div>
								)}

								{/* Next Actions */}
								{statusData && displayData.nextSteps?.length > 0 && (
									<div>
										<div className="flex items-center gap-2 mb-3">
											<ArrowRight className="h-5 w-5 text-blue-600" />
											Recommended Actions
										</div>
										<Card>
											<CardContent className="space-y-3">
												{displayData.nextSteps.slice(0, 3).map((step: string, index: number) => (
													<div key={`action-${index}`} className="flex items-start gap-3">
														<div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
															{index + 1}
														</div>
														<p className="text-sm text-foreground">{step}</p>
													</div>
												))}
											</CardContent>
										</Card>
									</div>
								)}
							</div>

							{/* Right Column: Quick Actions */}
							<div className="space-y-6">
								{/* Quick Actions */}
								<Card>
									<CardHeader className="pb-2">
										<CardTitle>Quick Actions</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3">
										<Button
											// TODO: Temporarily just go to upload instead of naming the interview. it's quicker and we have a small DB insert blocker.
											onClick={() => {
												if (routes) {
													window.location.href = routes.interviews.onboard()
												}
											}}
											// onClick={() => routes && (window.location.href = routes.interviews.new())}
											className="w-full justify-start bg-green-600 text-white hover:bg-green-700 border-green-600"
											variant="default"
										>
											<PlusCircle className="mr-2 h-4 w-4" />
											Add Interview
										</Button>
										{statusData && statusData.openQuestions && statusData.openQuestions.length > 0 && (
											<Button
												onClick={() => {
													if (routes) {
														window.location.href = routes.interviews.new()
													}
												}}
												className="w-full justify-start"
												variant="default"
											>
												<Target className="mr-2 h-4 w-4" />
												Address {statusData.openQuestions.length} Open Question
												{statusData.openQuestions.length > 1 ? "s" : ""}
											</Button>
										)}
										{/* Always show Manage Interview Questions button */}
										<Button
											onClick={() => {
												if (routes) {
													window.location.href = routes.questions.index()
												}
											}}
											className="w-full justify-start"
											variant="outline"
										>
											<BookOpen className="mr-2 h-4 w-4" />
											Manage Interview Questions
										</Button>

										<Button
											onClick={() => routes && (window.location.href = routes.evidence.index())}
											variant="outline"
										>
											<Eye className="mr-2 h-4 w-4" />
											Explore All Evidence
										</Button>

										<Button
											variant="outline"
											onClick={() => routes && (window.location.href = routes.interviews.index())}
										>
											<Mic2Icon className="mr-2 h-4 w-4" />
											Interviews
										</Button>
									</CardContent>
								</Card>

								{/* Research Status */}
								{statusData && displayData.completionScore > 0 && displayData.confidenceLevel && (
									<Card>
										<CardHeader className="pb-2">
											<CardTitle>Research Status</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="flex items-center gap-2 mb-3">
												<Badge
													variant={
														displayData.confidenceLevel === 1
															? "default"
															: displayData.confidenceLevel === 2
																? "secondary"
																: "destructive"
													}
												>
													{displayData.confidenceLevel === 1
														? "High"
														: displayData.confidenceLevel === 2
															? "Medium"
															: "Low"}{" "}
													Confidence
												</Badge>
											</div>
											<p className="text-sm text-muted-foreground">
												{displayData.completionScore < 50
													? "Add more interviews to strengthen findings"
													: displayData.completionScore < 80
														? "Good coverage! A few more interviews recommended"
														: "Strong research foundation established"}
											</p>
										</CardContent>
									</Card>
								)}
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
										<label className="mb-3 block font-medium text-gray-300 text-sm">
											Custom Instructions (Optional)
										</label>
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
				</div>
			)}
		</div>
	)
}
