import { motion } from "framer-motion"
import {
	ArrowRight,
	BookOpen,
	CheckCircle,
	CircleHelp,
	Eye,
	Headphones,
	Info,
	Lightbulb,
	Loader2,
	MessageCircleQuestionIcon,
	Mic2Icon,
	MicIcon,
	PlusCircle,
	Search,
	Settings2,
	Square,
	SquareCheckBig,
	Target,
	Users,
	Zap,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useRevalidator } from "react-router-dom"
import { Streamdown } from "streamdown"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useCurrentProject } from "~/contexts/current-project-context"
import { ProjectEditButton } from "~/features/projects/components/ProjectEditButton"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { createClient } from "~/lib/supabase/client"
import type { Project_Section } from "~/types"
import type { ProjectStatusData } from "~/utils/project-status.server"

function ConfidenceBadge({ value }: { value?: number }) {
	if (value === undefined || value === null) return null
	const pct = Math.round((value || 0) * 100)
	let color = "bg-gray-200 text-gray-800"
	if (pct >= 80) color = "bg-green-100 text-green-800"
	else if (pct >= 60) color = "bg-yellow-100 text-yellow-800"
	else color = "bg-orange-100 text-orange-800"
	return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{pct}%</span>
}

function DecisionRow({ qa }: { qa: any }) {
	const [expanded, setExpanded] = useState(false)
	return (
		<div className="rounded-md border p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="mb-1 font-medium">{qa?.decision || qa?.answer_summary || "Decision summary unavailable"}</div>
					<div className="text-muted-foreground text-xs">Based on interview analysis</div>
				</div>
				<ConfidenceBadge value={qa?.confidence} />
				<Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
					{expanded ? "Less" : "More"}
				</Button>
			</div>
			{expanded && (
				<div className="mt-3 border-t pt-3">
					<div className="mb-1 text-muted-foreground text-xs">Supporting Q&A</div>
					<div className="space-y-2 pl-3">
						<div className="text-foreground text-sm">
							<span className="font-medium">Q: </span>
							{qa?.question || "Question text"}
						</div>
						<div className="text-foreground text-sm">
							<span className="font-medium">A: </span>
							{qa?.answer_summary || "Answer summary"}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

interface ProjectStatusScreenProps {
	projectName: string
	projectId?: string
	accountId?: string
	statusData?: ProjectStatusData | null
	personas?: any[]
	insights?: any[]
	projectSections?: Project_Section[]
}

export default function ProjectStatusScreen({
	projectName,
	projectId,
	accountId,
	statusData,
	personas = [],
	insights = [],
	projectSections: initialSections,
}: ProjectStatusScreenProps) {
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const [customInstructions, setCustomInstructions] = useState("")
	const [showCustomAnalysis, setShowCustomAnalysis] = useState(false)
	const [projectSections, setProjectSections] = useState<Project_Section[]>(initialSections || [])
	const [loading, setLoading] = useState(!initialSections)
	const [showFlowView, _setShowFlowView] = useState(false)
	const revalidator = useRevalidator()
	const currentProjectContext = useCurrentProject()
	const projectPath =
		currentProjectContext?.projectPath ?? (accountId && projectId ? `/a/${accountId}/${projectId}` : "")
	const routes = useProjectRoutes(projectPath)
	const supabase = createClient()

	// Fetch project sections client-side only if not provided by loader
	useEffect(() => {
		if (initialSections && initialSections.length >= 0) {
			setLoading(false)
			return
		}
		const fetchProjectSections = async () => {
			if (!projectId) return
			try {
				const { data } = await supabase
					.from("project_sections")
					.select("*")
					.eq("project_id", projectId)
					.order("position", { ascending: true, nullsFirst: false })
					.order("created_at", { ascending: false })
				if (data) setProjectSections(data)
			} finally {
				setLoading(false)
			}
		}
		fetchProjectSections()
	}, [projectId, supabase, initialSections])

	// Helper functions to organize project sections and match with analysis
	const getGoalSections = () =>
		projectSections.filter((section) => section.kind === "goal" || section.kind === "research_goal")
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

	// Derive a single-line research goal for display
	const researchGoalText = (() => {
		const gs = getGoalSections()
		if (gs.length === 0) return ""
		const section = gs[0]
		const meta: any = section.meta || {}
		return meta.research_goal || meta.customGoal || section.content_md || ""
	})()

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
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
					<Loader2 className="h-8 w-8 animate-spin text-foreground" />
				</div>
			)}

			{/* Compact Header */}
			<div className="border-border border-b bg-background px-6 py-4">
				<div className="mx-auto flex max-w-6xl items-center justify-between">
					<div>
						<p className="font-semibold text-foreground text-xl">Project: {displayData.projectName}</p>
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
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								if (routes) {
									window.location.href = (routes as any).projects.projectChat()
								}
							}}
							className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-800 dark:from-blue-950/20 dark:to-indigo-950/20 dark:text-blue-300 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30"
						>
							<MessageCircleQuestionIcon className="mr-2 h-4 w-4" /> Setup Chat
						</Button>
						<ProjectEditButton project={{ id: projectId }} />
					</div>
				</div>
			</div>

			{showFlowView ? (
				/* Flow View - Two Column Layout */
				<div className="min-h-screen flex-1 bg-background">
					<div className="mx-auto max-w-7xl px-6 py-8">
						<div className="grid min-h-[80vh] grid-cols-2 gap-12">
							{/* Left Side: Flow Diagram */}
							<div className="flex flex-col items-center justify-center space-y-6 pr-8">
								{/* Research Goals */}
								<motion.div
									className="w-full max-w-sm cursor-pointer rounded-xl border-2 border-blue-200 bg-blue-50 p-6 text-center transition-all hover:shadow-lg dark:border-blue-800 dark:bg-blue-950/20"
									whileHover={{ scale: 1.02 }}
									onClick={() => {
										if (routes) {
											window.location.href = routes.projects.setup()
										}
									}}
								>
									<Target className="mx-auto mb-3 h-8 w-8 text-blue-600" />
									<h3 className="mb-2 font-semibold text-blue-800 text-xl dark:text-blue-300">Research Goals</h3>
									<div className="text-blue-600 dark:text-blue-400">
										{statusData?.questionAnswers?.length || 0}/
										{(statusData?.questionAnswers?.length || 0) + (statusData?.openQuestions?.length || 0)} Questions
									</div>
								</motion.div>

								<div className="h-12 w-px bg-gradient-to-b from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-700" />

								{/* Interviews */}
								<motion.div
									className="w-full max-w-sm cursor-pointer rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center transition-all hover:shadow-lg dark:border-green-800 dark:bg-green-950/20"
									whileHover={{ scale: 1.02 }}
									onClick={() => routes && (window.location.href = routes.interviews.index())}
								>
									<Headphones className="mx-auto mb-3 h-8 w-8 text-green-600" />
									<h3 className="mb-2 font-semibold text-green-800 text-xl dark:text-green-300">Interviews</h3>
									<div className="text-green-600 dark:text-green-400">{statusData?.totalInterviews || 0} Conducted</div>
								</motion.div>

								<div className="h-12 w-px bg-gradient-to-b from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-700" />

								{/* Evidence */}
								<motion.div
									className="w-full max-w-sm cursor-pointer rounded-xl border-2 border-purple-200 bg-purple-50 p-6 text-center transition-all hover:shadow-lg dark:border-purple-800 dark:bg-purple-950/20"
									whileHover={{ scale: 1.02 }}
									onClick={() => routes && (window.location.href = routes.evidence.index())}
								>
									<BookOpen className="mx-auto mb-3 h-8 w-8 text-purple-600" />
									<h3 className="mb-2 font-semibold text-purple-800 text-xl dark:text-purple-300">Evidence</h3>
									<div className="text-purple-600 dark:text-purple-400">{statusData?.totalEvidence || 0} Pieces</div>
								</motion.div>

								<div className="h-12 w-px bg-gradient-to-b from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-700" />

								{/* Personas */}
								<motion.div
									className="w-full max-w-sm cursor-pointer rounded-xl border-2 border-orange-200 bg-orange-50 p-6 text-center transition-all hover:shadow-lg dark:border-orange-800 dark:bg-orange-950/20"
									whileHover={{ scale: 1.02 }}
									onClick={() => routes && (window.location.href = routes.personas.index())}
								>
									<Users className="mx-auto mb-3 h-8 w-8 text-orange-600" />
									<h3 className="mb-2 font-semibold text-orange-800 text-xl dark:text-orange-300">Personas</h3>
									<div className="text-orange-600 dark:text-orange-400">
										{statusData?.totalPersonas || personas?.length || 0} Identified
									</div>
								</motion.div>

								<div className="h-12 w-px bg-gradient-to-b from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-700" />

								{/* Insights */}
								<motion.div
									className="w-full max-w-sm cursor-pointer rounded-xl border-2 border-indigo-200 bg-indigo-50 p-6 text-center transition-all hover:shadow-lg dark:border-indigo-800 dark:bg-indigo-950/20"
									whileHover={{ scale: 1.02 }}
									onClick={() => routes && (window.location.href = routes.insights.index())}
								>
									<Lightbulb className="mx-auto mb-3 h-8 w-8 text-indigo-600" />
									<h3 className="mb-2 font-semibold text-indigo-800 text-xl dark:text-indigo-300">Insights</h3>
									<div className="text-indigo-600 dark:text-indigo-400">
										{statusData?.totalInsights || insights?.length || 0} Generated
									</div>
								</motion.div>
							</div>

							{/* Right Side: Data Details */}
							<div className="space-y-8 overflow-y-auto border-gray-200 border-l pl-8 dark:border-gray-700">
								<div className="space-y-6">
									<h3 className="flex items-center gap-3 font-semibold text-2xl text-foreground">
										<Target className="h-6 w-6 text-blue-600" />
										Research Progress
									</h3>
									<div className="space-y-4">
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Questions Answered</span>
											<span className="font-semibold text-lg">
												{statusData?.questionAnswers?.length || 0} /{" "}
												{(statusData?.questionAnswers?.length || 0) + (statusData?.openQuestions?.length || 0)}
											</span>
										</div>
										<div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
											<div
												className="h-3 rounded-full bg-blue-600 transition-all"
												style={{
													width: `${((statusData?.questionAnswers?.length || 0) / Math.max(1, (statusData?.questionAnswers?.length || 0) + (statusData?.openQuestions?.length || 0))) * 100}%`,
												}}
											/>
										</div>
									</div>
								</div>

								<div className="space-y-6">
									<h3 className="flex items-center gap-3 font-semibold text-2xl text-foreground">
										<Headphones className="h-6 w-6 text-green-600" />
										Data Collection
									</h3>
									<div className="grid grid-cols-2 gap-4">
										<div className="rounded-xl border border-border bg-card p-6 text-center">
											<div className="mb-2 font-bold text-3xl text-foreground">{statusData?.totalInterviews || 0}</div>
											<div className="text-muted-foreground text-sm">Interviews</div>
										</div>
										<div className="rounded-xl border border-border bg-card p-6 text-center">
											<div className="mb-2 font-bold text-3xl text-foreground">{statusData?.totalEvidence || 0}</div>
											<div className="text-muted-foreground text-sm">Evidence</div>
										</div>
									</div>
								</div>

								<div className="space-y-6">
									<h3 className="flex items-center gap-3 font-semibold text-2xl text-foreground">
										<Users className="h-6 w-6 text-orange-600" />
										Analysis Results
									</h3>
									<div className="grid grid-cols-2 gap-4">
										<div className="rounded-xl border border-border bg-card p-6 text-center">
											<div className="mb-2 font-bold text-3xl text-foreground">
												{statusData?.totalPersonas || personas?.length || 0}
											</div>
											<div className="text-muted-foreground text-sm">Personas</div>
										</div>
										<div className="rounded-xl border border-border bg-card p-6 text-center">
											<div className="mb-2 font-bold text-3xl text-foreground">
												{statusData?.totalInsights || insights?.length || 0}
											</div>
											<div className="text-muted-foreground text-sm">Insights</div>
										</div>
									</div>
								</div>

								{/* Quick Actions */}
								<div className="space-y-6">
									<h3 className="flex items-center gap-3 font-semibold text-2xl text-foreground">
										<Zap className="h-6 w-6 text-yellow-600" />
										Quick Actions
									</h3>
									<div className="space-y-3">
										<Button
											variant="outline"
											className="h-12 w-full justify-start text-base"
											onClick={() => {
												if (routes) {
													window.location.href = routes.interviews.upload()
												}
											}}
										>
											<PlusCircle className="mr-3 h-5 w-5" />
											Add Interview
										</Button>
										<Button
											variant="outline"
											className="h-12 w-full justify-start text-base"
											onClick={() => {
												if (routes) {
													window.location.href = routes.evidence.index()
												}
											}}
										>
											<Eye className="mr-3 h-5 w-5" />
											View Evidence
										</Button>
										<Button
											variant="outline"
											className="h-12 w-full justify-start text-base"
											onClick={() => {
												if (routes) {
													window.location.href = routes.personas.index()
												}
											}}
										>
											<Users className="mr-3 h-5 w-5" />
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

					{/* Main Research Framework */}
					<div className="mx-auto max-w-6xl px-6 py-6">
						<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
							{/* Left Column: Reorganized Layout */}
							<div className="space-y-6 lg:col-span-2">
								{/* 1. Goal and Key Decisions at Top */}
								<div>
									<div className="mb-3 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Target className="h-5 w-5 text-blue-600" />
											Goal
											{/* Progress indicator moved here */}
											{statusData && displayData.completionScore > 0 && (
												<div className="mt-2 flex items-center gap-2">
													<div className="h-2 w-24 rounded-full bg-white/20">
														<div
															className="h-2 rounded-full bg-gradient-to-r from-green-400 to-blue-400 transition-all"
															style={{ width: `${displayData.completionScore}%` }}
														/>
													</div>
													<span className="font-medium text-blue-700 text-sm dark:text-blue-300">
														{displayData.completionScore}% complete
													</span>
												</div>
											)}
										</div>
										<div className="ml-4 flex flex-row gap-2">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="outline"
															onClick={() => setShowCustomAnalysis(true)}
															disabled={isAnalyzing}
															className="hover:bg-blue-700 hover:text-background"
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
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													if (routes) {
														window.location.href = routes.projects.setup()
													}
												}}
											>
												Edit
											</Button>{" "}
										</div>
									</div>
									<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
										<CardContent className="space-y-6 p-3 sm:p-4">
											{/* Research Goals */}
											{getGoalSections().length > 0 && (
												<div>
													{getGoalSections().map((goalSection) => {
														const goalStatus = getGoalStatus(goalSection.content_md)
														return (
															<div key={goalSection.id} className="flex items-start gap-3">
																<div className="mt-1 flex-shrink-0">
																	{goalStatus.status === "answered" ? (
																		<SquareCheckBig className="h-5 w-5 text-green-600" />
																	) : goalStatus.status === "open" ? (
																		<Square className="h-5 w-5 text-amber-600" />
																	) : (
																		<Target className="h-5 w-5 text-gray-400" />
																	)}
																</div>
																<div className="flex-1">
																	<p className="font-medium text-foreground text-sm">{goalSection.content_md}</p>
																	{goalStatus.status === "answered" && goalStatus.answer && (
																		<div className="mt-2 rounded bg-green-50 p-3 dark:bg-green-950/20">
																			<p className="text-green-800 text-sm dark:text-green-200">{goalStatus.answer}</p>
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
																		<p className="mt-1 text-muted-foreground text-sm">
																			Needs more evidence from interviews
																		</p>
																	)}
																</div>
															</div>
														)
													})}
												</div>
											)}

											{/* Key Decisions (nested within Goal section) should be DQs > RQs */}
											<div>
												<div className="mb-3 text-foreground text-sm">Key Decisions</div>
												<div className="space-y-3 border-gray-200 border-l-2 pl-4 dark:border-gray-700">
													{(displayData.questionAnswers || []).slice(0, 3).map((qa: any, idx: number) => (
														<DecisionRow key={`dq-${idx}`} qa={qa} />
													))}
													{(!displayData.questionAnswers || displayData.questionAnswers.length === 0) && (
														<p className="text-muted-foreground text-sm">
															No decisions yet — add interviews to generate findings.
														</p>
													)}

													{/* Nested Research Questions */}
													{statusData?.hasAnalysis &&
														statusData?.questionAnswers &&
														statusData.questionAnswers.length > 0 && (
															<div className="mt-4">
																<div className="mb-2 text-muted-foreground/50 text-xs">
																	Supporting Research Questions
																</div>
																<div className="space-y-2">
																	{statusData.questionAnswers.slice(0, 3).map((qa) => (
																		<div
																			key={`nested-qa-${qa.question}`}
																			className="rounded-lg border border-green-200 bg-green-50/50 p-2 dark:border-green-800 dark:bg-green-950/10"
																		>
																			<div className="flex items-start gap-2">
																				<CheckCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600" />
																				<div className="flex-1">
																					<p className="font-medium text-foreground text-xs">{qa.question}</p>
																					{qa.answer_summary && (
																						<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
																							{qa.answer_summary}
																						</p>
																					)}
																				</div>
																			</div>
																		</div>
																	))}
																</div>
															</div>
														)}
												</div>
											</div>
										</CardContent>
									</Card>
								</div>

								{/* 2. Personas & Themes */}
								<div>
									<div className="mb-3 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Users className="h-5 w-5 text-purple-600" />
											Personas & Themes
										</div>
									</div>
									<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
										<CardContent className="space-y-4 p-3 sm:p-4">
											{personas?.length === 0 && (
												<p className="text-muted-foreground text-sm">
													No personas yet — add interviews to generate personas.
												</p>
											)}
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
																		<div className="mb-1 text-muted-foreground text-xs">Target Organizations</div>
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
																		<div className="mb-1 text-muted-foreground text-xs">Target Roles</div>
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
																		<div className="mb-1 text-muted-foreground text-xs">Goal Details</div>
																		<div className="rounded bg-muted/30 p-2 text-foreground text-sm">
																			{meta.research_goal_details}
																		</div>
																	</div>
																)}

																{/* Unknowns */}
																{meta?.unknowns && (
																	<div>
																		<div className="mb-1 text-muted-foreground text-xs">Key Unknowns</div>
																		<div className="rounded bg-muted/30 p-2 text-foreground text-sm">
																			{Array.isArray(meta.unknowns) ? meta.unknowns.join(", ") : meta.unknowns}
																		</div>
																	</div>
																)}

																{/* Original markdown content as fallback */}
																{!meta?.target_orgs && !meta?.target_roles && (
																	<div className="rounded-lg bg-muted/50 p-2">
																		<div className="prose prose-sm max-w-none text-foreground text-sm">
																			<Streamdown>{section.content_md}</Streamdown>
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
													<div className="mb-3 flex items-center gap-2">
														<h4 className="font-medium text-muted-foreground text-sm">Personas Discovered</h4>
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger>
																	<Info className="h-3 w-3 text-muted-foreground transition-colors hover:text-foreground" />
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
																className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
																onClick={() => routes && (window.location.href = routes.personas.detail(persona.id))}
															>
																<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20">
																	<Users className="h-4 w-4 text-purple-600" />
																</div>
																<div className="flex-1">
																	<div className="mb-1 flex items-center gap-2">
																		<h5 className="font-medium text-foreground text-sm">{persona.name}</h5>
																		{persona.percentage && (
																			<Badge variant="secondary" className="text-xs">
																				{persona.percentage}%
																			</Badge>
																		)}
																	</div>
																	<p className="line-clamp-2 text-muted-foreground text-xs">{persona.description}</p>
																	{persona.topThemes && persona.topThemes.length > 0 && (
																		<div className="mt-2 flex flex-wrap gap-1">
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
													<div className="mt-3 flex gap-2">
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

								{/* 3. Interviews */}
								<div>
									<div className="mb-3 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<MessageCircleQuestionIcon className="h-5 w-5 text-indigo-600" />
											Questions
										</div>
										<div className="flex flex-row items-center gap-2">
											<Button
												variant="outline"
												size="sm"
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
									<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
										<CardContent className="space-y-6 p-3 sm:p-4">
											{/* Interview Questions */}
											<div>
												{/* <div className="mb-3 text-muted-foreground/50 text-sm">Interview Questions</div> */}
												<div className="space-y-3">
													{getQuestionsSections().length > 0 ? (
														getQuestionsSections()
															.slice(0, 1)
															.map((section) => {
																const all = Array.isArray(section.meta?.questions)
																	? (section.meta!.questions as any[])
																	: []
																// Prefer the user's selected pack order if present
																const selected = all
																	.filter(
																		(q: any) => q && (q.isSelected === true || typeof q.selectedOrder === "number")
																	)
																	.sort((a: any, b: any) => (a.selectedOrder ?? 1e9) - (b.selectedOrder ?? 1e9))
																const questions = selected.length > 0 ? selected : all
																const timeLimit = Number((section.meta as any)?.settings?.timeMinutes) || 45
																let used = 0
																const fit: { text: string; id: string; estimatedMinutes?: number }[] = []
																for (const q of questions as any[]) {
																	const est = Number(q?.estimatedMinutes) || 4
																	if (used + est <= timeLimit) {
																		fit.push(q)
																		used += est
																	} else {
																		break
																	}
																}
																const remainingCount = Math.max(questions.length - fit.length, 0)
																return (
																	<div key={section.id} className="space-y-3">
																		{fit.map((question: { text: string; id: string }, index: number) => {
																			const questionStatus = getQuestionStatus(question.text)
																			return (
																				<div
																					key={`question-${question.id || index}`}
																					className={`rounded-lg border p-3 ${questionStatus.status === "answered"
																							? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
																							: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
																						}`}
																				>
																					<div className="flex items-start gap-2">
																						{questionStatus.status === "answered" ? (
																							<CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
																						) : (
																							<CircleHelp className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
																						)}
																						<div className="flex-1">
																							<p className="font-medium text-foreground text-sm">{question.text}</p>
																							{questionStatus.status === "answered" && questionStatus.answer && (
																								<div className="mt-2 line-clamp-2 text-muted-foreground text-sm">
																									{questionStatus.answer}
																								</div>
																							)}
																						</div>
																					</div>
																				</div>
																			)
																		})}
																		{remainingCount > 0 && (
																			<p className="text-muted-foreground text-xs">
																				+{remainingCount} more questions (won't fit into {timeLimit}m)
																			</p>
																		)}
																	</div>
																)
															})
													) : (
														<div className="py-4 text-center">
															<BookOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
															<p className="text-muted-foreground text-sm">No interview questions generated yet</p>
															<Button
																variant="outline"
																size="sm"
																className="mt-2"
																onClick={() => {
																	if (routes) {
																		window.location.href = routes.questions.index()
																	}
																}}
															>
																Generate Questions
															</Button>
														</div>
													)}
												</div>
											</div>

											{/* Interview Status */}
											{statusData?.hasAnalysis && (
												<div>
													<div className="mb-3 text-muted-foreground/50 text-sm">Interview Analysis</div>
													<div className="space-y-4">
														{/* Questions Answered */}
														{statusData.questionAnswers && statusData.questionAnswers.length > 0 && (
															<div>
																<h4 className="mb-2 font-medium text-green-700 text-sm dark:text-green-400">
																	Answered ({statusData.questionAnswers.length})
																</h4>
																<div className="space-y-2">
																	{statusData.questionAnswers.slice(0, 3).map((qa) => (
																		<div
																			key={`qa-${qa.question}`}
																			className="rounded-lg border border-green-200 bg-green-50/50 p-2 dark:border-green-800 dark:bg-green-950/10"
																		>
																			<div className="flex items-start gap-2">
																				<CheckCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600" />
																				<div className="flex-1">
																					<p className="font-medium text-foreground text-xs">{qa.question}</p>
																					{qa.answer_summary && (
																						<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
																							{qa.answer_summary}
																						</p>
																					)}
																				</div>
																			</div>
																		</div>
																	))}
																	{statusData.questionAnswers.length > 3 && (
																		<p className="text-muted-foreground text-xs">
																			+{statusData.questionAnswers.length - 3} more questions answered
																		</p>
																	)}
																</div>
															</div>
														)}

														{/* Open Questions */}
														{statusData.openQuestions && statusData.openQuestions.length > 0 && (
															<div>
																<h4 className="mb-2 font-medium text-amber-700 text-sm dark:text-amber-400">
																	Unanswered ({statusData.openQuestions.length})
																</h4>
																<div className="space-y-2">
																	{statusData.openQuestions.slice(0, 3).map((question, index) => (
																		<div
																			key={`open-${index}`}
																			className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-800 dark:bg-amber-950/10"
																		>
																			<CircleHelp className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-600" />
																			<p className="text-foreground text-xs">{question}</p>
																		</div>
																	))}
																	{statusData.openQuestions.length > 3 && (
																		<p className="text-muted-foreground text-xs">
																			+{statusData.openQuestions.length - 3} more questions need answers
																		</p>
																	)}
																</div>
															</div>
														)}
													</div>
												</div>
											)}
										</CardContent>
									</Card>
								</div>

								{/* If no interviews exist, show prompt to add interviews */}
								{(!statusData?.totalInterviews || statusData.totalInterviews === 0) && (
									<div>
										<div className="mb-3 flex items-center gap-2">
											<MicIcon className="h-5 w-5 text-green-600" />
											Get Started with Interviews
										</div>
										<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
											<CardContent className="p-3 py-8 text-center sm:p-4">
												<div className="space-y-4">
													<div>
														<MicIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
														<h3 className="font-semibold text-foreground text-lg">No Interviews Yet</h3>
														<p className="text-muted-foreground text-sm">
															Add your first interview to start generating insights and analysis
														</p>
													</div>
													<Button
														onClick={() => {
															if (routes) {
																window.location.href = routes.interviews.upload()
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

								{/* 4. Recommended Next Steps */}
								{statusData && displayData.nextSteps?.length > 0 && (
									<div>
										<div className="mb-3 flex items-center gap-2">
											<ArrowRight className="h-5 w-5 text-blue-600" />
											Recommended Next Steps
										</div>
										<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
											<CardContent className="space-y-3 p-3 sm:p-4">
												{displayData.nextSteps.slice(0, 3).map((step: string, index: number) => (
													<div key={`action-${index}`} className="flex items-start gap-3">
														<div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-xs">
															{index + 1}
														</div>
														<p className="text-foreground text-sm">{step}</p>
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
								<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
									<CardHeader className="p-3 pb-2 sm:p-4">
										<CardTitle>Quick Actions</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3 p-3 sm:p-4">
										<Button
											// TODO: Temporarily just go to upload instead of naming the interview. it's quicker and we have a small DB insert blocker.
											onClick={() => {
												if (routes) {
													window.location.href = routes.interviews.upload()
												}
											}}
											// onClick={() => routes && (window.location.href = routes.interviews.new())}
											className="w-full justify-start border-green-600 bg-green-600 text-white hover:bg-green-700"
											variant="default"
										>
											<PlusCircle className="mr-2 h-4 w-4" />
											Add Interview
										</Button>
										{statusData?.openQuestions && statusData.openQuestions.length > 0 && (
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
									<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
										<CardHeader className="p-3 pb-2 sm:p-4">
											<CardTitle>Research Status</CardTitle>
										</CardHeader>
										<CardContent className="p-3 sm:p-4">
											<div className="mb-3 flex items-center gap-2">
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
											<p className="text-muted-foreground text-sm">
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
