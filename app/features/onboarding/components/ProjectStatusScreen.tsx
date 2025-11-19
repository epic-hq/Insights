import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import consola from "consola"
import { motion } from "framer-motion"
import {
	ArrowRight,
	BookOpen,
	BotMessageSquare,
	Eye,
	Headphones,
	Lightbulb,
	ListTree,
	Loader2,
	MessageCircleQuestionIcon,
	Pencil,
	Target,
	Upload,
	Users,
	Zap,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRevalidator } from "react-router"
import { ProjectStatusAgentChat } from "~/components/chat/ProjectStatusAgentChat"
import { Button } from "~/components/ui/button"
import { ConfidenceBarChart } from "~/components/ui/ConfidenceBarChart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useValidationView } from "~/contexts/ValidationViewContext"
import type { DecoratedResearchQuestion } from "~/features/onboarding/components/KeyDecisionsCard"
import { ProjectEditButton } from "~/features/projects/components/ProjectEditButton"
import { AnalyzeStageValidation } from "~/features/projects/pages/validationStatus"
import { CleanResearchAnswers, type ResearchAnswersData } from "~/features/research/components/CleanResearchAnswers"
import {
	calculateResearchMetrics,
	getAnsweredQuestions,
	getOpenQuestions,
} from "~/features/research/utils/research-data-mappers"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { createClient } from "~/lib/supabase/client"
import { cn } from "~/lib/utils"
import type { UpsightMessage } from "~/mastra/message-types"
import type { Project_Section } from "~/types"

const _ANSWERED_STATUSES = new Set(["answered", "ad_hoc"])
const _OPEN_STATUSES = new Set(["planned", "asked"])

import type { ProjectStatusData } from "~/utils/project-status.server"

function _ConfidenceBadge({ value }: { value?: number }) {
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
	initialChatMessages?: UpsightMessage[]
}

export default function ProjectStatusScreen({
	projectName,
	projectId,
	accountId,
	statusData,
	personas = [],
	insights = [],
	projectSections: initialSections,
	initialChatMessages = [],
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
	const [analysisError, setAnalysisError] = useState<string | null>(null)
	const [targetConversations, setTargetConversations] = useState<number>(10)
	const revalidator = useRevalidator()
	const currentProjectContext = useCurrentProject()
	const { showValidationView } = useValidationView()
	const projectPath =
		currentProjectContext?.projectPath ?? (accountId && projectId ? `/a/${accountId}/${projectId}` : "")
	const routes = useProjectRoutesFromIds(accountId, projectId)
	const supabase = createClient()
	const effectiveAccountId = accountId || ""
	const effectiveProjectId = projectId || ""

	// Build comprehensive system context for the project status agent
	const projectSystemContext = useMemo(() => {
		const sections: string[] = []
		sections.push(`Project: ${projectName}`)

		if (statusData?.totalInterviews) {
			sections.push(`Interviews conducted: ${statusData.totalInterviews}`)
		}
		if (statusData?.totalEvidence) {
			sections.push(`Evidence collected: ${statusData.totalEvidence}`)
		}
		if (statusData?.totalInsights) {
			sections.push(`Insights generated: ${statusData.totalInsights}`)
		}
		if (statusData?.totalPersonas) {
			sections.push(`Personas identified: ${statusData.totalPersonas}`)
		}

		if (researchRollup?.decision_questions?.length) {
			sections.push(`Decision questions: ${researchRollup.decision_questions.length}`)
		}
		if (researchRollup?.research_questions_without_decision?.length) {
			sections.push(`Research questions: ${researchRollup.research_questions_without_decision.length}`)
		}

		if (statusData?.nextSteps?.length) {
			sections.push(`Current next steps: ${statusData.nextSteps.slice(0, 3).join(", ")}`)
		}

		const combined = sections.filter(Boolean).join("\n\n")
		if (combined.length > 2000) {
			return `${combined.slice(0, 2000)}…`
		}

		return combined
	}, [projectName, statusData, researchRollup])

	const handleResearchMetrics = useCallback((metrics: { answered: number; open: number; total: number }) => {
		setResearchMetrics(metrics)
	}, [])

	const handleResearchData = useCallback((data: any) => {
		// Handle research data if needed
		console.log("Research data received:", data)
	}, [])

	const handleResearchRollup = useCallback((data: ResearchAnswersData | null) => {
		setResearchRollup(data)
	}, [])

	// Feature flag for chat setup button
	const { isEnabled: isSetupChatEnabled, isLoading: isFeatureFlagLoading } = usePostHogFeatureFlag("ffSetupChat")
	// Feature flag for validation status view
	const { isEnabled: isValidationEnabled } = usePostHogFeatureFlag("ffValidation")

	// Fetch project sections client-side only if not provided by loader
	useEffect(() => {
		if (initialSections && initialSections.length >= 0) {
			setLoading(false)
			// Extract target_conversations from settings section
			const settingsSection = initialSections.find((section) => section.kind === "settings")
			if (settingsSection?.meta) {
				const meta = settingsSection.meta as any
				setTargetConversations(meta.target_conversations || 10)
			}
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
				if (data) {
					setProjectSections(data)
					// Extract target_conversations from settings section
					const settingsSection = data.find((section) => section.kind === "settings")
					if (settingsSection?.meta) {
						const meta = settingsSection.meta as any
						setTargetConversations(meta.target_conversations || 10)
					}
				}
			} finally {
				setLoading(false)
			}
		}
		fetchProjectSections()
	}, [projectId, supabase, initialSections])

	// Helper functions to organize project sections and match with analysis
	const getGoalSections = () =>
		projectSections.filter((section) => section.kind === "goal" || section.kind === "research_goal")
	const _getTargetMarketSections = () => projectSections.filter((section) => section.kind === "target_market")
	const _getAssumptionSections = () => projectSections.filter((section) => section.kind === "assumptions")
	const _getRiskSections = () => projectSections.filter((section) => section.kind === "risks")
	const _getQuestionsSections = () => projectSections.filter((section) => section.kind === "questions")

	// Removed client-side goal/question matching. Rely on backend analysis (statusData.questionAnswers).

	const runCustomAnalysis = async () => {
		if (!projectId) return
		setIsAnalyzing(true)
		setAnalysisError(null)
		try {
			// Build FormData because the analysis endpoint expects formData
			const form = new FormData()
			form.append("projectId", projectId)
			if (customInstructions) form.append("customInstructions", customInstructions)
			// You can make minConfidence configurable; use default 0.6 for now
			form.append("minConfidence", String(0.6))

			const response = await fetch("/api/analyze-research-evidence", {
				method: "POST",
				body: form,
			})

			const body = await response.json().catch(() => ({}))
			if (!response.ok) {
				const msg = body?.error || body?.details || "Analysis failed"
				setAnalysisError(msg)
				consola.error("[research-analysis] analysis failed", msg, body)
				return
			}

			// Clear the instructions input and close modal
			setCustomInstructions("")
			setShowCustomAnalysis(false)
			// Revalidate any loader data (if applicable)
			revalidator.revalidate()

			// Fetch fresh research rollup so KeyDecisionsCard and ResearchAnswers show updated data
			try {
				const rrResp = await fetch(`/api.research-answers?projectId=${encodeURIComponent(projectId)}`)
				if (rrResp.ok) {
					const rrBody = await rrResp.json().catch(() => ({}))
					// rrBody expected shape: { data: ResearchAnswersData }
					const newRollup = rrBody?.data ?? null
					setResearchRollup(newRollup)
					handleResearchRollup(newRollup)
					// update metrics derived from rollup
					const metrics = calculateResearchMetrics(newRollup)
					handleResearchMetrics(metrics)
				} else {
					// Non-fatal: log but continue
					const rb = await rrResp.json().catch(() => ({}))
					consola.warn("[research-analysis] failed to refresh research rollup", rb)
				}
			} catch (err) {
				consola.warn("[research-analysis] error fetching research rollup", err)
			}
		} catch (error) {
			consola.error("[research-analysis] analysis failed", error)
			setAnalysisError(error instanceof Error ? error.message : "Analysis request failed")
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
	const _hasProjectId = Boolean(projectId)

	const _decisionSummaries = useMemo(() => researchRollup?.decision_questions ?? [], [researchRollup])

	const standaloneResearchQuestions = useMemo<DecoratedResearchQuestion[]>(() => {
		if (!researchRollup) return []
		return researchRollup.research_questions_without_decision.map((rq) => ({
			...rq,
			decisionText: null,
		}))
	}, [researchRollup])

	const _topResearchQuestions = useMemo(() => {
		return standaloneResearchQuestions
			.filter((rq) => (rq.metrics.answered_answer_count ?? 0) + (rq.metrics.open_answer_count ?? 0) > 0)
			.sort(
				(a, b) =>
					(b.metrics.answered_answer_count ?? 0) - (a.metrics.answered_answer_count ?? 0) ||
					(b.metrics.open_answer_count ?? 0) - (a.metrics.open_answer_count ?? 0)
			)
			.slice(0, 3)
	}, [standaloneResearchQuestions])

	// Use helper functions to extract data from research rollup
	const _answeredQuestions = useMemo(() => getAnsweredQuestions(researchRollup), [researchRollup])
	const openQuestions = useMemo(() => getOpenQuestions(researchRollup), [researchRollup])
	const _researchMetricsFromRollup = useMemo(() => calculateResearchMetrics(researchRollup), [researchRollup])

	const recommendedNextSteps = useMemo(() => {
		const steps = new Set<string>()
		const addStep = (value?: string | null) => {
			if (!value) return
			const cleaned = value.replace(/^\s*(?:[\u2022*-]|\d+\.?|\(\d+\))\s*/, "").trim()
			if (cleaned) steps.add(cleaned)
		}
		const addList = (items?: string[] | null) => {
			if (!items) return
			for (const item of items) addStep(item)
		}

		addList(displayData.nextSteps)
		addList(statusData?.followUpRecommendations)
		addList(researchRollup?.latest_analysis_run?.recommended_actions)
		researchRollup?.analysis_results?.forEach((result) => {
			if (result?.next_steps) addStep(result.next_steps)
		})

		if (steps.size === 0) {
			const hasStructure = Boolean(
				(researchRollup?.decision_questions?.length || 0) > 0 ||
				(researchRollup?.research_questions_without_decision?.length || 0) > 0
			)
			if (!hasStructure) {
				addStep("Generate your research plan to create decision and research questions.")
			}
			if ((displayData.totalInterviews || 0) === 0) {
				addStep("Schedule and run your first interviews to start collecting evidence.")
			} else if ((displayData.totalEvidence || 0) === 0) {
				addStep("Upload transcripts or tag interview evidence so the AI can analyze it.")
			}
			if (steps.size === 0) {
				addStep("Run the AI evidence analysis to synthesize findings and surface next steps.")
			}
		}

		return Array.from(steps)
	}, [
		displayData.nextSteps,
		displayData.totalEvidence,
		displayData.totalInterviews,
		researchRollup,
		statusData?.followUpRecommendations,
	])

	const nextStepsToShow = useMemo(() => recommendedNextSteps.slice(0, 3), [recommendedNextSteps])

	// Derive a single-line research goal for display
	const _researchGoalText = (() => {
		const gs = getGoalSections()
		if (gs.length === 0) return ""
		const section = gs[0]
		const meta = (section.meta || {}) as any
		return meta.research_goal || meta.customGoal || section.content_md || ""
	})()

	const goalConfidence = (() => {
		const gs = getGoalSections()
		if (gs.length === 0) return "low"
		const section = gs[0]
		const meta = (section.meta || {}) as any
		return meta.confidence || "low"
	})()

	const _getConfidenceColor = (confidence: string) => {
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
		<div>
			{isAnalyzing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
					<Loader2 className="h-8 w-8 animate-spin text-foreground" />
				</div>
			)}

			{/* Compact Header - Mobile Responsive */}
			<div className="mx-auto flex w-full max-w-[1440px] border-border border-b bg-background px-4 py-4 sm:px-3">
				<div className="flex max-w-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="group relative">
						<p className="font-semibold text-foreground text-lg sm:text-xl">Project: {displayData.projectName}</p>
						<button
							onClick={() => {
								if (routes && projectId) {
									window.location.href = routes.projects.edit(projectId)
								}
							}}
							className="-right-6 -translate-y-1/2 absolute top-1/2 rounded p-1 opacity-0 transition-opacity duration-200 hover:bg-muted group-hover:opacity-100"
							aria-label="Edit project"
							title="Edit project"
						>
							<Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
						</button>
					</div>
				</div>
			</div>

			{/* Conditional Content Views */}
			{showValidationView ? (
				/* Validation View - Feature Flagged */
				<div className="min-h-screen flex-1 bg-background">
					<AnalyzeStageValidation />
				</div>
			) : showFlowView ? (
				/* Flow View - Mobile Responsive Layout */
				<div className="min-h-screen flex-1 bg-background">
					<div className="grid min-h-[80vh] grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
						{/* Left Side: Flow Diagram - Mobile Responsive */}
						<div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 lg:pr-8">
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
								onClick={() => {
									if (routes) {
										window.location.href = routes.interviews.index()
									}
								}}
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
								onClick={() => {
									if (routes) {
										window.location.href = routes.evidence.index()
									}
								}}
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
								onClick={() => {
									if (routes) {
										window.location.href = routes.personas.index()
									}
								}}
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
								onClick={() => {
									if (routes) {
										window.location.href = routes.insights.index()
									}
								}}
							>
								<Lightbulb className="mx-auto mb-3 h-8 w-8 text-indigo-600" />
								<h3 className="mb-2 font-semibold text-indigo-800 text-xl dark:text-indigo-300">Insights</h3>
								<div className="text-indigo-600 dark:text-indigo-400">
									{statusData?.totalInsights || insights?.length || 0} Generated
								</div>
							</motion.div>
						</div>

						{/* Right Side: Data Details - Mobile Responsive */}
						<div className="space-y-6 overflow-y-auto sm:space-y-8 lg:border-gray-200 lg:border-l lg:pl-8 lg:dark:border-gray-700">
							{effectiveAccountId && effectiveProjectId && (
								<ProjectStatusAgentChat
									accountId={effectiveAccountId}
									projectId={effectiveProjectId}
									initialMessages={initialChatMessages}
									systemContext={projectSystemContext}
								/>
							)}
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
							{/* <div className="space-y-6">
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
											Upload / Record Media
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
								</div> */}
						</div>
					</div>
				</div>
			) : (
				/* Dashboard View - Original Layout */
				<div>
					{/* Prominent Analysis Action */}

					{/* Main Research Framework - Dashboard with Prominent Chat */}
					<div className={cn("grid grid-cols-1 gap-4 sm:gap-6", "lg:grid-cols-3")}>
						{/* Left Column: Research Overview */}
						<div className={cn("space-y-4 sm:space-y-6", "lg:col-span-2")}>
							{/* 1. Goal and Key Decisions at Top */}
							<div>
								<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div className="group relative flex items-center gap-2">
										<Target className="h-5 w-5 text-blue-600" />
										<span>Goal</span>
										<button
											onClick={() => {
												if (routes) {
													window.location.href = routes.projects.setup()
												}
											}}
											className="rounded p-1 opacity-0 transition-opacity duration-200 hover:bg-muted group-hover:opacity-100"
											aria-label="Edit goal"
											title="Edit goal"
										>
											<Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
										</button>
										{/* Progress indicator moved here */}
									</div>
									<div className="flex flex-row gap-2">
										{/* Research Workflow Link */}
										<Button
											variant="outline"
											size="sm"
											onClick={() => {
												if (routes) {
													window.location.href = routes.questions.researchWorkflow()
												}
											}}
										>
											<ListTree className="h-4 w-4" />
											Plan
										</Button>
									</div>
								</div>
								<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
									<CardHeader>
										{/* Research Goals */}
										{getGoalSections().length > 0 && (
											<div className="flex items-start justify-between gap-4">
												<div className="flex items-start gap-3">
													<ConfidenceBarChart level={goalConfidence} className="mt-1 flex-shrink-0" />
													{getGoalSections().map((goalSection) => (
														<div key={goalSection.id} className="flex-1 font-medium text-foreground text-md">
															{goalSection.content_md}
														</div>
													))}
												</div>
											</div>
										)}
									</CardHeader>

									{/* Interview Progress */}
									<CardContent className="space-y-4 p-3 sm:space-y-6 sm:p-4">
										<div className="w-full space-y-2">
											<div className="flex items-center justify-end text-sm">
												<span className="gap-4 font-medium text-muted-foreground">
													Interview Progress {((displayData.totalInterviews / targetConversations) * 100).toFixed(0)}% ({displayData.totalInterviews} / {targetConversations})
												</span>
											</div>
											{/* <div className="h-2 w-full rounded-full bg-muted">
												<div
													className={cn(
														"h-2 rounded-full transition-all duration-300",
														(displayData.totalInterviews / targetConversations) * 100 >= 100
															? "bg-green-500"
															: "bg-primary"
													)}
													style={{
														width: `${Math.min((displayData.totalInterviews / targetConversations) * 100, 100)}%`,
													}}
												/>
											</div> */}
										</div>

										{/* Goal Actions */}
										<div className="flex flex-row items-end justify-end gap-2">
											<div className="flex flex-wrap items-center gap-2 sm:gap-3">
												{isSetupChatEnabled && (
													<Button
														variant="outline"
														size="sm"
														onClick={() => {
															if (routes) {
																window.location.href = (routes as any).projects.projectChat()
															}
														}}
														className="border-blue-200 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-800 dark:from-blue-950/20 dark:to-indigo-950/20 dark:text-blue-300 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30"
													>
														<MessageCircleQuestionIcon className="mr-2 h-4 w-4" /> Setup Chat
													</Button>
												)}
											</div>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="outline"
															onClick={() => setShowCustomAnalysis(true)}
															disabled={isAnalyzing || displayData.totalInterviews === 0}
															className="hover:bg-blue-700"
															size="sm"
														>
															{isAnalyzing ? (
																<Loader2 className="mr-2 h-4 w-4 animate-spin" />
															) : (
																<Zap className="mr-2 h-4 w-4" />
															)}
															Analyze...
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														{displayData.totalInterviews === 0 ? (
															<p>Add interviews to see emerging insights.</p>
														) : (
															<p>Analyze latest conversations and see how they align with your goals and questions.</p>
														)}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
									</CardContent>
								</Card>
							</div>

							{/* Key Decisions (nested within Goal section) should be DQs > RQs */}
							{/* <KeyDecisionsCard
								{/* Research Findings */}
							{projectId && (
								<div className="mt-6">
									<CleanResearchAnswers
										projectId={projectId as string}
										projectRoutes={routes}
										onMetrics={handleResearchMetrics}
										onData={handleResearchData}
									/>
								</div>
							)}

							{/* 4. Recommended Next Steps */}
							<div className="mb-3 flex items-center gap-2">
								<ArrowRight className="h-5 w-5 text-blue-600" />
								Recommended Next Steps
							</div>
							{nextStepsToShow.length > 0 ? (
								<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
									<CardContent className="space-y-3 p-3 sm:p-4">
										{nextStepsToShow.map((step: string, index: number) => (
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
								<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
									<CardContent className="space-y-3 p-3 sm:p-4">
										<p className="text-foreground text-sm">Pending</p>
									</CardContent>
								</Card>
							)}
						</div>
					</div>
					{/* Custom Analysis Modal - Mobile Responsive */}
					{showCustomAnalysis && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 p-4">
							<div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-background p-4 shadow-xl sm:max-w-md">
								<h3 className="mb-6 font-light text-foreground text-xl">Update Analysis</h3>
								<div className="space-y-6">
									<div>
										<label className="mb-3 block text-foreground text-sm">Optional Instructions</label>
										<Input
											value={customInstructions}
											onChange={(e) => setCustomInstructions(e.target.value)}
											placeholder="e.g., Focus on pain points, Look for feature gaps..."
											className="border-gray-600 bg-background text-foreground placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
										/>
									</div>
									{analysisError && <p className="text-destructive text-sm">{analysisError}</p>}
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
