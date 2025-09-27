import consola from "consola"
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
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useRevalidator } from "react-router"
import { Streamdown } from "streamdown"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useCurrentProject } from "~/contexts/current-project-context"
import { InterviewAnalysisCard } from "~/features/onboarding/components/InterviewAnalysisCard"
import { type DecoratedResearchQuestion, KeyDecisionsCard } from "~/features/onboarding/components/KeyDecisionsCard"
import { ThemesSection } from "~/features/onboarding/components/ThemesSection"
import { ProjectEditButton } from "~/features/projects/components/ProjectEditButton"
import {
	type ResearchAnswerNode,
	ResearchAnswers,
	type ResearchAnswersData,
	type ResearchQuestionNode,
} from "~/features/research/components/ResearchAnswers"
import {
	type AnsweredQuestionSummary,
	calculateResearchMetrics,
	getAnsweredQuestions,
	getOpenQuestions,
	type OpenQuestionSummary,
} from "~/features/research/utils/research-data-mappers"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { createClient } from "~/lib/supabase/client"
import type { Project_Section } from "~/types"

const ANSWERED_STATUSES = new Set(["answered", "ad_hoc"])
const OPEN_STATUSES = new Set(["planned", "asked"])

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
	const [researchMetrics, setResearchMetrics] = useState<{ answered: number; open: number; total: number }>({
		answered: 0,
		open: 0,
		total: 0,
	})
	const [researchRollup, setResearchRollup] = useState<ResearchAnswersData | null>(null)
	const revalidator = useRevalidator()
	const currentProjectContext = useCurrentProject()
	const projectPath =
		currentProjectContext?.projectPath ?? (accountId && projectId ? `/a/${accountId}/${projectId}` : "")
	const routes = useProjectRoutes(projectPath)
	const supabase = createClient()

	const handleResearchMetrics = useCallback((metrics: { answered: number; open: number; total: number }) => {
		setResearchMetrics(metrics)
	}, [])

	const handleResearchRollup = useCallback((data: ResearchAnswersData | null) => {
		setResearchRollup(data)
	}, [])

	// Feature flag for chat setup button
	const { isEnabled: isSetupChatEnabled, isLoading: isFeatureFlagLoading } = usePostHogFeatureFlag("ffSetupChat")

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
	}, [projectId, supabase, initialSections, isSetupChatEnabled])

	// Helper functions to organize project sections and match with analysis
	const getGoalSections = () =>
		projectSections.filter((section) => section.kind === "goal" || section.kind === "research_goal")
	const getTargetMarketSections = () => projectSections.filter((section) => section.kind === "target_market")
	const getAssumptionSections = () => projectSections.filter((section) => section.kind === "assumptions")
	const getRiskSections = () => projectSections.filter((section) => section.kind === "risks")
	const getQuestionsSections = () => projectSections.filter((section) => section.kind === "questions")

	// Removed client-side goal/question matching. Rely on backend analysis (statusData.questionAnswers).

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

	const decisionSummaries = useMemo(() => researchRollup?.decision_questions ?? [], [researchRollup])

	const decoratedResearchQuestions = useMemo<DecoratedResearchQuestion[]>(() => {
		if (!researchRollup) return []
		const withDecisions = researchRollup.decision_questions.flatMap((decision) =>
			decision.research_questions.map((rq) => ({ ...rq, decisionText: decision.text }))
		)
		const withoutDecisions = researchRollup.research_questions_without_decision.map((rq) => ({
			...rq,
			decisionText: null,
		}))
		return [...withDecisions, ...withoutDecisions]
	}, [researchRollup])

	const topResearchQuestions = useMemo(() => {
		return decoratedResearchQuestions
			.filter((rq) => (rq.metrics.answered_answer_count ?? 0) + (rq.metrics.open_answer_count ?? 0) > 0)
			.sort(
				(a, b) =>
					(b.metrics.answered_answer_count ?? 0) - (a.metrics.answered_answer_count ?? 0) ||
					(b.metrics.open_answer_count ?? 0) - (a.metrics.open_answer_count ?? 0)
			)
			.slice(0, 3)
	}, [decoratedResearchQuestions])

	type DecoratedResearchQuestion = ResearchQuestionNode & { decisionText: string | null }

	const allResearchAnswers = useMemo<ResearchAnswerNode[]>(() => {
		if (!researchRollup) return []
		const fromDecisions = researchRollup.decision_questions.flatMap((decision) =>
			decision.research_questions.flatMap((rq) => rq.answers)
		)
		const fromStandalone = researchRollup.research_questions_without_decision.flatMap((rq) => rq.answers)
		return [...fromDecisions, ...fromStandalone, ...researchRollup.orphan_answers]
	}, [researchRollup])

	// Use helper functions to extract data from research rollup
	const answeredQuestions = useMemo(() => getAnsweredQuestions(researchRollup), [researchRollup])
	const openQuestions = useMemo(() => getOpenQuestions(researchRollup), [researchRollup])
	const researchMetricsFromRollup = useMemo(() => calculateResearchMetrics(researchRollup), [researchRollup])

	// Derive a single-line research goal for display
	const researchGoalText = (() => {
		const gs = getGoalSections()
		if (gs.length === 0) return ""
		const section = gs[0]
		const meta = section.meta || {}
		return meta.research_goal || meta.customGoal || section.content_md || ""
	})()

	const goalConfidence = (() => {
		const gs = getGoalSections()
		if (gs.length === 0) return "low"
		const section = gs[0]
		const meta = section.meta || {}
		return meta.confidence || "low"
	})()

	const getConfidenceColor = (confidence: string) => {
		switch (confidence) {
			case "high":
				return "text-success"
			case "medium":
				return "text-warning"
			case "low":
				return "text-destructive"
			default:
				return "text-muted-foreground"
		}
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
						{isSetupChatEnabled && (
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
						)}
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
										{researchMetrics.answered}/{Math.max(1, researchMetrics.total)} Questions
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
												{researchMetrics.answered} / {Math.max(1, researchMetrics.total)}
											</span>
										</div>
										<div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
											<div
												className="h-3 rounded-full bg-blue-600 transition-all"
												style={{
													width: `${researchMetrics.total > 0 ? (researchMetrics.answered / researchMetrics.total) * 100 : 0}%`,
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
									<div className="w-32 space-y-3">
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
										</div>
										<div className="ml-4 flex flex-row gap-2">
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
										</div>
									</div>
									<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
										<CardHeader>
											{/* Research Goals */}
											{getGoalSections().length > 0 && (
												<div className="flex items-center justify-between">
													{getGoalSections().map((goalSection) => (
														<div key={goalSection.id} className="flex items-start gap-3 font-medium text-foreground text-md">
															{goalSection.content_md}
														</div>
													))}
													<Badge
														variant={goalConfidence === "high" ? "default" : goalConfidence === "medium" ? "secondary" : "outline"}
														className={getConfidenceColor(goalConfidence)}
													>
														{goalConfidence.charAt(0).toUpperCase() + goalConfidence.slice(1)}
													</Badge>
												</div>
											)}
										</CardHeader>
										<CardContent className="space-y-6 p-3 sm:p-4">


											{/* Research Workflow Link */}
											<div className="mt-4">
												<Link
													to={routes.questions.researchWorkflow()}
													className="inline-flex items-center gap-2 font-medium text-blue-600 text-sm hover:text-blue-800 hover:underline"
												>
													<MessageCircleQuestionIcon className="h-4 w-4" />
													Manage Research Structure & Questions
													<ArrowRight className="h-3 w-3" />
												</Link>
											</div>


										</CardContent>
									</Card>
								</div>

								{/* Key Decisions (nested within Goal section) should be DQs > RQs */}
								<KeyDecisionsCard
									decisionSummaries={decisionSummaries}
									topResearchQuestions={topResearchQuestions}
								/>
								{/* Research Answers - Detailed DQ & RQ Answers */}
								{researchRollup && (
									<div className="mt-6">
										<ResearchAnswers
											projectId={projectId}
											onMetricsChange={handleResearchMetrics}
											onDataChange={handleResearchRollup}
										/>
									</div>
								)}

								{/* Themes */}
								{/* <div>
									<ThemesSection routes={routes} projectId={projectId} />
								</div> */}

								{/* 4. Recommended Next Steps */}
								<div className="mb-3 flex items-center gap-2">
									<ArrowRight className="h-5 w-5 text-blue-600" />
									Recommended Next Steps
								</div>
								{statusData && displayData.nextSteps?.length > 0 ? (
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
								) : (
									<div>
										<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
											<CardContent className="space-y-3 p-3 sm:p-4">
												<p className="text-foreground text-sm">Pending</p>
											</CardContent>
										</Card>
									</div>
								)}
							</div>

							{/* Right Column: Quick Actions */}

							<div className="space-y-4">
								<h2 className="">Quick Actions</h2>
								{/* Quick Actions */}
								<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
									<CardContent className="flex w-full max-w-sm flex-col gap-2 p-3 lg:max-w-md">
										<Button
											// TODO: Temporarily just go to upload instead of naming the interview. it's quicker and we have a small DB insert blocker.
											onClick={() => {
												if (routes) {
													window.location.href = routes.interviews.upload()
												}
											}}
											// onClick={() => routes && (window.location.href = routes.interviews.new())}
											className="flex max-w-64 justify-start border-green-600 bg-green-600 text-white hover:bg-green-700"
											variant="default"
										>
											<PlusCircle className="mr-2 h-4 w-4" />
											Add Interview
										</Button>
										{openQuestions.length > 0 && (
											<Button
												onClick={() => {
													if (routes) {
														window.location.href = routes.interviews.new()
													}
												}}
												className="max-w-64 justify-start"
												variant="default"
											>
												<Target className="mr-2 h-4 w-4" />
												Address {openQuestions.length} Open Question
												{openQuestions.length > 1 ? "s" : ""}
											</Button>
										)}
										{/* Always show Manage Interview Questions button */}
										<Button
											onClick={() => {
												if (routes) {
													window.location.href = routes.questions.index()
												}
											}}
											className="flex max-w-64 justify-start"
											variant="outline"
										>
											<BookOpen className="mr-2 h-4 w-4" />
											Manage Interview Questions
										</Button>

										<Button
											onClick={() => routes && (window.location.href = routes.evidence.index())}
											variant="outline"
											className="flex max-w-64 justify-start"
										>
											<Eye className="mr-2 h-4 w-4" />
											Explore All Evidence
										</Button>

										<Button
											variant="outline"
											onClick={() => routes && (window.location.href = routes.interviews.index())}
											className="flex max-w-64 justify-start"
										>
											<Mic2Icon className="mr-2 h-4 w-4" />
											Interviews ({statusData?.totalInterviews})
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
