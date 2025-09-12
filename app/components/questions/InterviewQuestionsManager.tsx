import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import consola from "consola"
import {
	Brain,
	BriefcaseBusiness,
	Check,
	ChevronDown,
	Clock,
	Edit,
	Filter,
	Flag,
	GripVertical,
	HelpCircle,
	MessageCircleQuestion,
	Mic,
	MoreHorizontal,
	Plus,
	Settings,
	Trash2,
	TriangleAlert,
	User,
	X,
	Zap,
} from "lucide-react"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { AnimatedBorderCard } from "~/components/ui/AnimatedBorderCard"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { ProgressDots } from "~/components/ui/ProgressDots"
import { StatusPill } from "~/components/ui/StatusPill"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Slider } from "~/components/ui/slider"
import { Textarea } from "~/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import InterviewQuestionHelp from "~/features/questions/components/InterviewQuestionHelp"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { createClient } from "~/lib/supabase/client"
import type { QuestionInput } from "~/types"

export type Purpose = "exploratory" | "validation" | "followup"
export type Familiarity = "cold" | "warm"

export interface InterviewQuestionsManagerProps {
	projectId?: string
	projectPath?: string
	target_orgs?: string[]
	target_roles?: string[]
	research_goal?: string
	research_goal_details?: string
	assumptions?: string[]
	unknowns?: string[]
	defaultTimeMinutes?: 15 | 30 | 45 | 60
	defaultPurpose?: Purpose
	defaultFamiliarity?: Familiarity
	defaultGoDeep?: boolean
	onSelectionChange?: (ids: string[]) => void
	onComplete?: (questions: {
		id: string
		text: string
	}) => undefined | ((questions: { id: string; text: string }[]) => void)
	onSelectedQuestionsChange?: (questions: { id: string; text: string }[]) => void
}

interface Question {
	id: string
	text: string
	categoryId: string
	scores: { importance: number; goalMatch: number; novelty: number }
	rationale?: string
	status: "proposed" | "asked" | "answered" | "skipped" | "rejected"
	timesAnswered: number
	source?: "ai" | "user" // Track whether question is AI-generated or user-created
	isMustHave?: boolean // Track if question is marked as must-have
	qualityFlag?: {
		assessment: "red" | "yellow" | "green"
		score: number
		description: string
		color?: string // Optional custom color override
	}
}

const questionCategories = [
	{
		id: "context",
		name: "Context & Background",
		weight: 1.0,
		color: "border-blue-100 text-blue-800 dark:border-blue-900 dark:text-blue-200",
	},
	{
		id: "pain",
		name: "Pain Points & Problems",
		weight: 1.2,
		color: "border-red-100 text-red-800 dark:border-red-900 dark:text-red-200",
	},
	{
		id: "workflow",
		name: "Workflow & Behavior",
		weight: 1.1,
		color: "border-purple-100 text-purple-800 dark:border-purple-900 dark:text-purple-200",
	},
	{
		id: "goals",
		name: "Goals & Motivations",
		weight: 1.0,
		color: "border-green-100 text-green-800 dark:border-green-900 dark:text-green-200",
	},
	{
		id: "constraints",
		name: "Constraints & Barriers",
		weight: 0.9,
		color: "border-orange-100 text-orange-800 dark:border-orange-900 dark:text-orange-200",
	},
	{
		id: "willingness",
		name: "Willingness to Pay",
		weight: 0.8,
		color: "border-indigo-100 text-indigo-800 dark:border-indigo-900 dark:text-indigo-200",
	},
]

// Quality flag component
function QualityFlag({ qualityFlag }: { qualityFlag: Question["qualityFlag"] }) {
	if (!qualityFlag) return null

	const getColorClasses = (assessment: string) => {
		switch (assessment) {
			case "red":
				return "bg-red-100 text-red-700 border-red-200 dark:text-red-200"
			case "yellow":
				return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:text-yellow-200"
			case "green":
				return "bg-green-100 text-green-700 border-green-200 dark:text-green-200"
			default:
				return "bg-muted text-muted-foreground border-border"
		}
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={`inline-flex items-center rounded-full border px-2 py-1 font-medium text-xs ${getColorClasses(qualityFlag.assessment)}`}
					>
						<Flag className="h-4 w-4" strokeWidth={2.75} />
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<div className="max-w-xs">
						<div className="font-semibold">Quality Check</div>
						<div className="text-xs">
							Score: {qualityFlag.score}/100 ({qualityFlag.assessment.toUpperCase()})
						</div>
						<div className="mt-1 text-xs">
							{qualityFlag.description || "We can be more clear and specific. Try adding a concrete example."}
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

export function InterviewQuestionsManager(props: InterviewQuestionsManagerProps) {
	const {
		projectId,
		projectPath,
		target_orgs,
		target_roles,
		research_goal,
		research_goal_details,
		assumptions,
		unknowns,
		defaultTimeMinutes = 30,
		defaultPurpose = "exploratory",
		defaultFamiliarity = "cold",
		defaultGoDeep = false,
		onSelectionChange,
		onSelectedQuestionsChange,
	} = props

	const routes = useProjectRoutes(projectPath)
	const [timeMinutes, setTimeMinutes] = useState<number>(defaultTimeMinutes)
	const [purpose, setPurpose] = useState<Purpose>(defaultPurpose)
	const [familiarity, setFamiliarity] = useState<Familiarity>(defaultFamiliarity)
	const [goDeepMode, setGoDeepMode] = useState<boolean>(defaultGoDeep)
	const [customInstructions, setCustomInstructions] = useState("")
	const [loading, setLoading] = useState(true)
	const [generating, setGenerating] = useState(false)
	const [saving, setSaving] = useState(false)
	const [questions, setQuestions] = useState<Question[]>([])
	const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
	const [hasInitialized, setHasInitialized] = useState(false)
	const [skipDebounce, setSkipDebounce] = useState(false)
	const [showAllQuestions, setShowAllQuestions] = useState(false)
	const [showCustomInstructions, setShowCustomInstructions] = useState(false)
	const [showAddCustomQuestion, setShowAddCustomQuestion] = useState(false)
	const [newQuestionText, setNewQuestionText] = useState("")
	const [newQuestionCategory, setNewQuestionCategory] = useState("context")
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingText, setEditingText] = useState("")
	const [addingCustomQuestion, setAddingCustomQuestion] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const [autoGenerateInitial, setAutoGenerateInitial] = useState(false)
	const [generatingFollowUp, setGeneratingFollowUp] = useState<string | null>(null)
	const [mustHavesOnly, setMustHavesOnly] = useState(false)
	const [showHelp, setShowHelp] = useState(false)
	const [improvingId, setImprovingId] = useState<string | null>(null)
	const [improveOptions, setImproveOptions] = useState<string[]>([])
	const [evaluatingId, setEvaluatingId] = useState<string | null>(null)
	// How many new questions to generate when user clicks "Generate More"
	// Default "Generate More" count to 8 instead of 3
	const [moreCount, setMoreCount] = useState<number>(8)
	const previousSelectionRef = React.useRef<string[] | null>(null)

	const generateQuestions = async () => {
		if (generating) return
		setGenerating(true)
		try {
			// Create FormData for remix-style API
			const formData = new FormData()
			formData.append("project_id", projectId || "")
			formData.append("custom_instructions", customInstructions || "")
			// Determine question count:
			// - Initial generation: time-based target (4/6/8/10)
			// - Subsequent generations: user-selected count (default 3)
			// First-time generation target by time; default 30m should produce 8
			const countByTime: Record<number, number> = { 15: 4, 30: 8, 45: 8, 60: 10 }
			const initialTarget = countByTime[timeMinutes] ?? 8
			const count = autoGenerateInitial ? initialTarget : moreCount
			formData.append("questionCount", String(count))
			formData.append("interview_time_limit", timeMinutes.toString())

			// Add optional fields from props (for onboarding flow)
			if (target_orgs?.length) formData.append("target_orgs", target_orgs.join(", "))
			if (target_roles?.length) formData.append("target_roles", target_roles.join(", "))
			if (research_goal) formData.append("research_goal", research_goal)
			if (research_goal_details) formData.append("research_goal_details", research_goal_details)
			if (assumptions?.length) formData.append("assumptions", assumptions.join(", "))
			if (unknowns?.length) formData.append("unknowns", unknowns.join(", "))

			const response = await fetch("/api/generate-questions", {
				method: "POST",
				body: formData,
			})

			if (response.ok) {
				const data = await response.json()
				if (data.success && data.questionSet?.questions) {
					const newQuestions = data.questionSet.questions as QuestionInput[]
					if (projectId) {
						const existingQuestions = questions.map((q) => {
							const idx = selectedQuestionIds.indexOf(q.id)
							return {
								id: q.id,
								text: q.text,
								categoryId: q.categoryId,
								scores: q.scores,
								rationale: q.rationale,
								status: "proposed",
								selectedOrder: idx >= 0 ? idx : null,
								isSelected: idx >= 0,
							}
						})
						const allQuestions = [...existingQuestions, ...newQuestions]
						await supabase.from("project_sections").upsert(
							{
								project_id: projectId,
								kind: "questions",
								position: 2,
								content_md: `# Interview Questions\n\nGenerated ${allQuestions.length} questions for interview planning.`,
								meta: { questions: allQuestions },
							},
							{ onConflict: "project_id,kind", ignoreDuplicates: false }
						)
					}

					const formattedNewQuestions: Question[] = newQuestions.map((q: QuestionInput) => ({
						id: q.id || crypto.randomUUID(),
						text: q.text || "",
						categoryId: q.categoryId || "context",
						scores: {
							importance: (q.scores?.importance ?? 0.5) as number,
							goalMatch: (q.scores?.goalMatch ?? 0.5) as number,
							novelty: (q.scores?.novelty ?? 0.5) as number,
						},
						rationale: q.rationale || "",
						status: "proposed" as const,
						timesAnswered: 0,
						source: "ai" as const,
						isMustHave: false,
					}))
					setQuestions((prev) => [...prev, ...formattedNewQuestions])

					if (autoGenerateInitial) {
						setAutoGenerateInitial(false)
						toast.success(`Generated ${formattedNewQuestions.length} initial questions for your interview`, {
							description: "Review and edit them below, then click 'Add Interview' when ready",
							duration: 5000,
						})
					} else {
						toast.success(`Added ${formattedNewQuestions.length} new questions to the bottom of your available list`, {
							description: "You can now select them to add to your question pack",
							duration: 4000,
						})
					}
				} else {
					toast.error("Failed to generate questions", {
						description: "The response was successful but contained no questions",
					})
				}
			} else {
				// Handle API error response
				try {
					const errorData = await response.json()
					toast.error("Failed to generate questions", {
						description: errorData.error || `Server error: ${response.status}`,
					})
				} catch {
					toast.error("Failed to generate questions", {
						description: `Server error: ${response.status}`,
					})
				}
			}
		} catch (e) {
			consola.error("Error generating questions:", e)
			toast.error("Failed to generate questions", {
				description: "An unexpected error occurred. Please try again.",
			})
		} finally {
			setGenerating(false)
			// Ensure spinner resets even if initial auto-generate failed
			setAutoGenerateInitial(false)
		}
	}

	// Auto-generate questions on first load for new users
	useEffect(() => {
		if (!loading && !hasInitialized && questions.length === 0 && projectId) {
			setAutoGenerateInitial(true)
			generateQuestions()
		}
	}, [loading, hasInitialized, questions.length, projectId])

	const supabase = createClient()

	useEffect(() => {
		onSelectionChange?.(selectedQuestionIds)
	}, [selectedQuestionIds, onSelectionChange])

	// Load questions from project_sections when projectId is provided
	useEffect(() => {
		const loadQuestions = async () => {
			if (!projectId) {
				setLoading(false)
				return
			}
			try {
				const { data: questionsSection, error: sectionError } = await supabase
					.from("project_sections")
					.select("*")
					.eq("project_id", projectId)
					.eq("kind", "questions")
					.order("created_at", { ascending: false })
					.limit(1)
					.single()

				if (sectionError && sectionError.code !== "PGRST116") throw sectionError

				const { data: answerCounts, error: countsError } = await supabase
					.from("project_answers")
					.select("question_id, status")
					.eq("project_id", projectId)

				if (countsError) throw countsError

				const answerCountMap = new Map<string, number>()
				answerCounts?.forEach((answer) => {
					if (answer.status === "answered") {
						const count = answerCountMap.get(answer.question_id || "") || 0
						answerCountMap.set(answer.question_id || "", count + 1)
					}
				})

				const meta = (questionsSection?.meta as Record<string, unknown>) || {}
				const questionsData = (meta.questions as QuestionInput[] | undefined) || []
				const settings = (meta.settings as Record<string, unknown> | undefined) || {}

				// Assign stable IDs for this load so selection mapping and formatting
				// reference the exact same identifiers, even when legacy entries
				// didn't persist an id in meta.
				const resolvedIds: string[] = questionsData.map((q) => q.id || crypto.randomUUID())

				// Load saved settings if they exist
				if (settings.timeMinutes && typeof settings.timeMinutes === "number") setTimeMinutes(settings.timeMinutes)
				if (settings.purpose && typeof settings.purpose === "string") setPurpose(settings.purpose as Purpose)
				if (settings.familiarity && typeof settings.familiarity === "string")
					setFamiliarity(settings.familiarity as Familiarity)
				if (typeof settings.goDeepMode === "boolean") setGoDeepMode(settings.goDeepMode)
				if (settings.customInstructions && typeof settings.customInstructions === "string")
					setCustomInstructions(settings.customInstructions)

				const formattedQuestions: Question[] = questionsData.map((q: QuestionInput, idx: number) => ({
					id: resolvedIds[idx],
					text: q.text || q.question || "",
					categoryId: q.categoryId || q.category || "context",
					scores: {
						importance: (q.scores?.importance ?? q.importance ?? 0.5) as number,
						goalMatch: (q.scores?.goalMatch ?? q.goalMatch ?? 0.5) as number,
						novelty: (q.scores?.novelty ?? q.novelty ?? 0.5) as number,
					},
					rationale: q.rationale || "",
					status: (q.status as Question["status"]) || "proposed",
					timesAnswered: answerCountMap.get(q.id || resolvedIds[idx]) || 0,
					source: (q as QuestionInput & { source?: "ai" | "user" }).source || "ai", // Default to AI for existing questions
					isMustHave: (q as QuestionInput & { isMustHave?: boolean }).isMustHave || false,
				}))

				// Build selected ids using the same resolvedIds mapping and support both
				// legacy selectedOrder-only and current isSelected=true markers.
				const enriched = questionsData.map((q, idx) => ({ q, idx }))
				const selectedQuestionsWithOrder = enriched
					.filter(({ q }) => q && (q.isSelected === true || typeof q.selectedOrder === "number"))
					.sort((a, b) => (a.q.selectedOrder ?? 1e9) - (b.q.selectedOrder ?? 1e9))
					.map(({ idx }) => resolvedIds[idx])

				setQuestions(formattedQuestions)
				if (selectedQuestionsWithOrder.length > 0) {
					setSelectedQuestionIds(selectedQuestionsWithOrder)
					setHasInitialized(true)
				}
			} catch (error) {
				consola.error("Error loading questions:", error)
			} finally {
				setLoading(false)
			}
		}

		loadQuestions()
	}, [projectId, supabase])

	const estimateMinutesPerQuestion = useCallback((q: Question, p: Purpose, f: Familiarity): number => {
		const baseTimes = { exploratory: 6.5, validation: 4.5, followup: 3.5 }
		const categoryAdjustments: Record<string, number> = {
			pain: 0.5,
			workflow: 0.5,
			goals: 0.25,
			willingness: 0.25,
			constraints: 0,
			context: 0,
		}
		const familiarityAdjustment = f === "warm" ? -0.5 : f === "cold" ? 0.5 : 0
		const baseTime = baseTimes[p]
		const categoryAdj = categoryAdjustments[q.categoryId] || 0
		return Math.max(2.5, baseTime + categoryAdj + familiarityAdjustment)
	}, [])

	const calculateCompositeScore = useCallback((q: Question): number => {
		const categoryWeight = questionCategories.find((c) => c.id === q.categoryId)?.weight || 1
		const s = q.scores
		return 0.5 * (s.importance || 0) + 0.35 * (s.goalMatch || 0) + 0.15 * (s.novelty || 0) * categoryWeight
	}, [])

	const questionPack = useMemo(() => {
		const targetCounts: Record<number, { base: number; validation: number; cold: number }> = {
			15: { base: 4, validation: +1, cold: 0 },
			30: { base: 6, validation: +1, cold: 0 },
			45: { base: 8, validation: +1, cold: 0 },
			60: { base: 10, validation: +1, cold: 0 },
		}

		const tc = targetCounts[timeMinutes]
		const targetCount = Math.max(
			4,
			tc.base + (purpose === "validation" ? tc.validation : 0) + (familiarity === "cold" ? tc.cold : 0)
		)

		const allQuestionsWithScores = questions
			.filter((q) => q.status === "proposed") // Only include proposed questions, exclude rejected
			.map((q) => ({
				...q,
				compositeScore: calculateCompositeScore(q),
				estimatedMinutes: estimateMinutesPerQuestion(q, purpose, familiarity),
			}))

		// Quick lookup map for id → question
		const byId = new Map(allQuestionsWithScores.map((q) => [q.id, q]))

		let autoSelectedIds: string[] = []
		if (selectedQuestionIds.length === 0) {
			let selected: typeof allQuestionsWithScores = []

			if (goDeepMode) {
				selected = [...allQuestionsWithScores]
					.sort((a, b) => b.compositeScore - a.compositeScore)
					.slice(0, Math.min(3, targetCount))
			}

			const categoryMap = new Map<string, typeof allQuestionsWithScores>()
			for (const q of allQuestionsWithScores) {
				if (!categoryMap.has(q.categoryId)) categoryMap.set(q.categoryId, [])
				categoryMap.get(q.categoryId)?.push(q)
			}
			for (const arr of categoryMap.values()) arr.sort((a, b) => b.compositeScore - a.compositeScore)

			for (const categoryId of ["context", "pain", "workflow"]) {
				const arr = categoryMap.get(categoryId) || []
				const already = selected.find((q) => q.categoryId === categoryId)
				if (!already && arr.length > 0 && selected.length < targetCount) {
					const best = arr[0]
					if (!selected.find((q) => q.id === best.id)) selected.push(best)
				}
			}

			const remaining = allQuestionsWithScores
				.filter((q) => !selected.find((s) => s.id === q.id))
				.sort((a, b) => b.compositeScore - a.compositeScore)

			let budget = timeMinutes
			for (const q of selected) budget -= q.estimatedMinutes
			for (const q of remaining) {
				if (selected.length >= targetCount) break
				if (budget - q.estimatedMinutes < 0) continue
				selected.push(q)
				budget -= q.estimatedMinutes
			}

			autoSelectedIds = selected.map((q) => q.id)
		}

		const idsToUseRaw = selectedQuestionIds.length > 0 ? selectedQuestionIds : autoSelectedIds
		// Sanitize: keep only ids that exist, preserve order, and de-dupe
		const seen = new Set<string>()
		const idsToUse: string[] = []
		for (const id of idsToUseRaw) {
			if (!byId.has(id)) continue
			if (seen.has(id)) continue
			seen.add(id)
			idsToUse.push(id)
		}

		const orderedSelectedQuestions = idsToUse.map((id) => byId.get(id)).filter(Boolean) as typeof allQuestionsWithScores

		const totalEstimatedTime = orderedSelectedQuestions.reduce((sum, q) => sum + q.estimatedMinutes, 0)

		// Compute overflow index (first index where cumulative time exceeds target)
		let overflowIndex = -1
		let running = 0
		for (let i = 0; i < orderedSelectedQuestions.length; i++) {
			running += orderedSelectedQuestions[i].estimatedMinutes
			if (overflowIndex === -1 && running > timeMinutes) {
				overflowIndex = i
				break
			}
		}
		const belowCount = overflowIndex >= 0 ? orderedSelectedQuestions.length - overflowIndex : 0

		// Remaining = simple set difference for correctness and speed
		const selectedSet = new Set(idsToUse)
		const remainingQuestions = allQuestionsWithScores.filter((q) => !selectedSet.has(q.id))

		return {
			questions: orderedSelectedQuestions,
			totalEstimatedTime,
			targetTime: timeMinutes,
			remainingQuestions,
			overflowIndex,
			belowCount,
		}
	}, [
		timeMinutes,
		purpose,
		familiarity,
		goDeepMode,
		questions,
		selectedQuestionIds,
		calculateCompositeScore,
		estimateMinutesPerQuestion,
	])

	// Initialize selected questions once after computing the pack (no state changes inside useMemo)
	useEffect(() => {
		if (!hasInitialized && selectedQuestionIds.length === 0 && questionPack.questions.length > 0) {
			const ids = questionPack.questions.map((q) => q.id)
			setSelectedQuestionIds(ids)
			setHasInitialized(true)
		}
	}, [hasInitialized, selectedQuestionIds.length, questionPack.questions])

	// Notify parent when the selected questions (with text) change
	useEffect(() => {
		if (!onSelectedQuestionsChange) return
		const minimal = questionPack.questions.map((q) => ({ id: q.id, text: q.text }))
		onSelectedQuestionsChange(minimal)
	}, [questionPack.questions, onSelectedQuestionsChange])

	const saveQuestionsToDatabase = useCallback(
		async (questionsToSave: Question[], selectedIds: string[]) => {
			if (!projectId) return
			try {
				setSaving(true)
				const withOrder = questionsToSave.map((q) => {
					const selectedIndex = selectedIds.indexOf(q.id)
					return {
						...q,
						// Preserve existing status (e.g., 'rejected'); don't force 'proposed'
						status: q.status,
						selectedOrder: selectedIndex >= 0 ? selectedIndex : null,
						isSelected: selectedIndex >= 0,
						source: q.source || "ai", // Ensure source is preserved
					}
				})
				const { error } = await supabase.from("project_sections").upsert(
					{
						project_id: projectId,
						kind: "questions",
						position: 2,
						content_md: `# Questions\n\nManaged ${withOrder.length} questions for interview planning.`,
						meta: {
							questions: withOrder,
							settings: {
								timeMinutes,
								purpose,
								familiarity,
								goDeepMode,
								customInstructions,
							},
						},
					},
					{ onConflict: "project_id,kind", ignoreDuplicates: false }
				)
				if (error) consola.error("Error saving questions:", error)
			} catch (e) {
				consola.error("Error saving questions to database:", e)
			} finally {
				setSaving(false)
			}
		},
		[projectId, supabase, timeMinutes, purpose, familiarity, goDeepMode, customInstructions]
	)

	// Save settings changes to database (separate from question changes)
	useEffect(() => {
		if (!projectId || !hasInitialized || skipDebounce) return
		const timeoutId = setTimeout(() => {
			saveQuestionsToDatabase(questions, selectedQuestionIds)
		}, 1000) // Debounce saves - longer timeout for settings
		return () => clearTimeout(timeoutId)
	}, [projectId, hasInitialized, questions, selectedQuestionIds, saveQuestionsToDatabase, skipDebounce])

	const removeQuestion = useCallback(
		async (id: string) => {
			const newIds = selectedQuestionIds.filter((qId) => qId !== id)
			setSelectedQuestionIds(newIds)
			setSkipDebounce(true)
			await saveQuestionsToDatabase(questions, newIds)
			// Reset the flag after a delay to allow debounced saves for other changes
			setTimeout(() => setSkipDebounce(false), 1500)
		},
		[selectedQuestionIds, questions, saveQuestionsToDatabase]
	)

	const moveQuestion = useCallback(
		async (fromIndex: number, toIndex: number) => {
			const currentIds = selectedQuestionIds.length > 0 ? selectedQuestionIds : questionPack.questions.map((q) => q.id)
			const newIds = [...currentIds]
			const [removed] = newIds.splice(fromIndex, 1)
			newIds.splice(toIndex, 0, removed)
			setSelectedQuestionIds(newIds)
			setHasInitialized(true)
			setSkipDebounce(true)
			await saveQuestionsToDatabase(questions, newIds)
			setTimeout(() => setSkipDebounce(false), 1500)
		},
		[selectedQuestionIds, questionPack.questions, questions, saveQuestionsToDatabase]
	)

	const onDragEnd = (result: DropResult) => {
		if (!result.destination) return
		const { source, destination } = result
		if (source.index !== destination.index) moveQuestion(source.index, destination.index)
	}

	const addQuestionFromReserve = useCallback(
		async (question: Question) => {
			if (selectedQuestionIds.includes(question.id)) return
			const baseIds = selectedQuestionIds.length > 0 ? selectedQuestionIds : questionPack.questions.map((q) => q.id)
			const newIds = [...baseIds, question.id]
			setSelectedQuestionIds(newIds)
			setHasInitialized(true)
			setSkipDebounce(true)
			await saveQuestionsToDatabase(questions, newIds)
			setTimeout(() => setSkipDebounce(false), 1500)
		},
		[selectedQuestionIds, questionPack.questions, questions, saveQuestionsToDatabase]
	)

	const addCustomQuestion = useCallback(async () => {
		if (!newQuestionText.trim()) {
			toast.error("Please enter a question")
			return
		}

		setAddingCustomQuestion(true)
		try {
			// Evaluate question quality first
			const response = await fetch("/api/evaluate-question", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: newQuestionText.trim(),
					research_context: `Research goal: ${research_goal || "General user research"}. Target roles: ${target_roles?.join(", ") || "Various roles"}.`,
				}),
			})

			if (!response.ok) {
				throw new Error("Quality evaluation failed")
			}

			const evaluation = await response.json()

			// Show quality feedback
			const qualityMessage = `Score: ${evaluation.score}/100 (${String(evaluation.overall_quality).toUpperCase()})`
			const suggestion = evaluation?.improvement?.suggested_rewrite

			if (evaluation.overall_quality === "red") {
				toast.error("Quality Check", {
					description: `${qualityMessage}\nWe can be more clear and specific.${suggestion ? `\nRevise to: “${suggestion}”.` : ""}`,
					duration: 6000,
				})
				// Still add the question but warn the user
			} else if (evaluation.overall_quality === "yellow") {
				toast.warning("Quality Check", {
					description: `${qualityMessage}\nWe can be more clear and specific.${suggestion ? `\nTry: “${suggestion}”.` : ""}`,
					duration: 5000,
				})
			} else {
				toast.success("Looks good", {
					description: `${qualityMessage}`,
					duration: 4000,
				})
			}

			// Add the question regardless of quality (with user awareness)
			const customQuestion: Question = {
				id: crypto.randomUUID(),
				text: newQuestionText.trim(),
				categoryId: newQuestionCategory,
				scores: {
					importance: Math.max(0.3, evaluation.score / 100),
					goalMatch: 0.6,
					novelty: 0.5,
				},
				rationale: `Custom user question (AI quality score: ${evaluation.score}/100)`,
				status: "proposed",
				timesAnswered: 0,
				source: "user",
				isMustHave: false,
				qualityFlag: {
					assessment: evaluation.overall_quality as "red" | "yellow" | "green",
					score: evaluation.score,
					description: evaluation.quick_feedback || "Quality assessment completed",
				},
			}

			const updatedQuestions = [...questions, customQuestion]
			setQuestions(updatedQuestions)

			// Auto-add to selected questions
			const newSelectedIds = [...selectedQuestionIds, customQuestion.id]
			setSelectedQuestionIds(newSelectedIds)

			// Save to database
			setSkipDebounce(true)
			await saveQuestionsToDatabase(updatedQuestions, newSelectedIds)
			setTimeout(() => setSkipDebounce(false), 1500)

			// Reset form
			setNewQuestionText("")
			setNewQuestionCategory("context")
			setShowAddCustomQuestion(false)
		} catch (error) {
			console.error("Question evaluation/addition error:", error)

			// Fallback to adding without evaluation
			const customQuestion: Question = {
				id: crypto.randomUUID(),
				text: newQuestionText.trim(),
				categoryId: newQuestionCategory,
				scores: { importance: 0.7, goalMatch: 0.6, novelty: 0.5 },
				rationale: "Custom user question",
				status: "proposed",
				timesAnswered: 0,
				source: "user",
				isMustHave: false,
				qualityFlag: {
					assessment: "yellow",
					score: 50,
					description: "Quality evaluation failed - added without assessment",
				},
			}

			const updatedQuestions = [...questions, customQuestion]
			setQuestions(updatedQuestions)

			// Auto-add to selected questions
			const newSelectedIds = [...selectedQuestionIds, customQuestion.id]
			setSelectedQuestionIds(newSelectedIds)

			// Save to database
			setSkipDebounce(true)
			await saveQuestionsToDatabase(updatedQuestions, newSelectedIds)
			setTimeout(() => setSkipDebounce(false), 1500)

			// Reset form
			setNewQuestionText("")
			setNewQuestionCategory("context")
			setShowAddCustomQuestion(false)

			toast.error("Question added without quality check", {
				description: "Quality evaluation failed, but question was added anyway",
				className: "text-red-600",
			})
		} finally {
			setAddingCustomQuestion(false)
		}
	}, [
		newQuestionText,
		newQuestionCategory,
		questions,
		selectedQuestionIds,
		saveQuestionsToDatabase,
		research_goal,
		target_roles,
	])

	// Auto-evaluate question quality when text changes are saved
	const evaluateQuestionQuality = useCallback(
		async (text: string) => {
			try {
				const response = await fetch("/api/evaluate-question", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						question: text,
						research_context: `Research goal: ${research_goal || "General user research"}. Target roles: ${target_roles?.join(", ") || "Various roles"}.`,
					}),
				})
				if (!response.ok) return null
				const evaln = await response.json()
				const assessment = String(evaln.overall_quality || "").toLowerCase()
				if (assessment === "yellow" || assessment === "red") {
					const suggestion = evaln?.improvement?.suggested_rewrite
					const tip = suggestion
						? `We can be more clear and specific. Revise to: “${suggestion}”.`
						: evaln.quick_feedback || "We can be more clear and specific. Try adding a concrete example."
					return {
						assessment: assessment as "yellow" | "red",
						score: Number(evaln.score || 0),
						description: tip,
					}
				}
				return null
			} catch {
				return null
			}
		},
		[research_goal, target_roles]
	)

	const rejectQuestion = useCallback(
		async (questionId: string) => {
			const updatedQuestions = questions.map((q) => (q.id === questionId ? { ...q, status: "rejected" as const } : q))
			setQuestions(updatedQuestions)

			// Also remove from selected questions if it was selected
			const newSelectedIds = selectedQuestionIds.filter((id) => id !== questionId)
			setSelectedQuestionIds(newSelectedIds)

			setSkipDebounce(true)
			await saveQuestionsToDatabase(updatedQuestions, newSelectedIds)
			setTimeout(() => setSkipDebounce(false), 1500)

			toast.success("Question rejected", {
				description: "This question won't appear in future generations",
			})
		},
		[questions, selectedQuestionIds, saveQuestionsToDatabase]
	)

	const getAnsweredCountColor = (count: number) => {
		if (count === 0) return "bg-transparent text-muted-foreground"
		if (count <= 3) return "bg-transparent text-yellow-600 dark:text-yellow-400"
		if (count <= 10) return "bg-transparent text-green-600 dark:text-green-400"
		return "bg-transparent text-blue-600 dark:text-blue-400"
	}

	const generateFollowUpQuestions = async (questionId: string, originalQuestion: string) => {
		if (generatingFollowUp) return
		setGeneratingFollowUp(questionId)

		try {
			const response = await fetch("/api/generate-followup-questions", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					originalQuestion,
					researchContext: `Research goal: ${research_goal || "General user research"}. Target roles: ${target_roles?.join(", ") || "Various roles"}.`,
					targetRoles: target_roles?.join(", ") || "Various roles",
					customInstructions:
						customInstructions ||
						"Generate thoughtful, conversational follow-up questions that dive deeper into the topic.",
				}),
			})

			if (!response.ok) {
				throw new Error(`Server error: ${response.status}`)
			}

			const data = await response.json()
			if (data.success && data.followUpSet?.followUps) {
				// Convert follow-up questions to our Question format
				const followUpQuestions: Question[] = data.followUpSet.followUps.map((q: any) => ({
					id: q.id || crypto.randomUUID(),
					text: q.text,
					categoryId: q.categoryId,
					scores: {
						importance: q.scores.importance,
						goalMatch: q.scores.goalMatch,
						novelty: q.scores.novelty,
					},
					rationale: q.rationale,
					status: "proposed" as const,
					timesAnswered: 0,
					source: "ai" as const,
					isMustHave: false,
				}))

				// Find the index of the original question in selectedQuestionIds
				const originalIndex = selectedQuestionIds.indexOf(questionId)
				if (originalIndex >= 0) {
					// Insert follow-up questions right after the original question
					const updatedQuestions = [...questions, ...followUpQuestions]
					setQuestions(updatedQuestions)

					const newSelectedIds = [
						...selectedQuestionIds.slice(0, originalIndex + 1),
						...followUpQuestions.map((q) => q.id),
						...selectedQuestionIds.slice(originalIndex + 1),
					]
					setSelectedQuestionIds(newSelectedIds)

					// Save to database
					setSkipDebounce(true)
					await saveQuestionsToDatabase(updatedQuestions, newSelectedIds)
					setTimeout(() => setSkipDebounce(false), 1500)

					toast.success(`Added ${followUpQuestions.length} follow-up questions`, {
						description: `Dive deeper questions inserted after "${originalQuestion.slice(0, 50)}${originalQuestion.length > 50 ? "..." : ""}"`,
						duration: 4000,
					})
				}
			} else {
				throw new Error("No follow-up questions generated")
			}
		} catch (error) {
			console.error("Follow-up generation error:", error)
			toast.error("Failed to generate follow-up questions", {
				description: error instanceof Error ? error.message : "An unexpected error occurred",
			})
		} finally {
			setGeneratingFollowUp(null)
		}
	}



	if (loading) {
		return (
			<div className="mx-auto max-w-4xl p-4 sm:p-6">
				<div className="animate-pulse space-y-6">
					<div className="flex justify-between">
						<div className="space-y-2">
							<div className="h-8 w-64 rounded bg-gray-200" />
							<div className="h-4 w-96 rounded bg-gray-200" />
						</div>
						<div className="h-10 w-32 rounded bg-gray-200" />
					</div>
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-24 rounded bg-gray-200" />
						))}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="w-full space-y-2">
			{/* Header Section */}
			<div className="space-y-4">
				{/* Title Row - Prevent wrapping */}
				<div className="flex items-center justify-between">
					<div className="flex min-w-0 items-center gap-3">
						<MessageCircleQuestion className="h-6 w-6 shrink-0" />
						<h1 className="whitespace-nowrap font-bold text-2xl text-foreground">Interview Questions</h1>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{generating ? (
							<StatusPill variant="active">
								Generating <ProgressDots className="ml-1" />
							</StatusPill>
						) : saving ? (
							<StatusPill variant="active">
								Saving <ProgressDots className="ml-1" />
							</StatusPill>
						) : null}
					</div>
				</div>

				{/* Description Row */}
				<p className="text-muted-foreground text-sm">
					Review, edit, and finalize your interview questions. Based on your{" "}
					<Link
						to={routes.projects.setup()}
						className="font-medium text-blue-600 underline underline-offset-2 transition-all duration-200 hover:text-blue-800 hover:underline-offset-4"
					>
						Project Goals
					</Link>{" "}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setShowHelp(true)}
						className="mt-1 ml-2 inline-flex items-center gap-1 px-2 text-blue-700 hover:text-blue-800"
						title="Interview planning tips"
					>
						<HelpCircle className="h-4 w-4" />
					</Button>
				</p>

				{/* Settings Button Row - Moved down */}
				<div className="flex items-center justify-between">
					<Button
						variant="outline"
						onClick={() => setShowSettings(!showSettings)}
						className="flex items-center gap-2 whitespace-nowrap"
					>
						<Settings className="h-4 w-4" />
						{purpose.charAt(0).toUpperCase() + purpose.slice(1)} • {timeMinutes}m
					</Button>
				</div>
			</div>

			{/* Expandable Settings Panel */}
			{showSettings && (
				<Card className="border-blue-100">
					<CardContent className="p-4">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							<div>
								<label className="mb-3 block font-medium text-sm">Interview Time: {timeMinutes} minutes</label>
								<Slider
									value={[timeMinutes]}
									onValueChange={(v) => setTimeMinutes(v[0])}
									max={60}
									min={15}
									step={15}
									className="w-full"
								/>
								<div className="mt-1 flex justify-between text-muted-foreground text-xs">
									<span>15m</span>
									<span>30m</span>
									<span>45m</span>
									<span>60m</span>
								</div>
							</div>

							<div>
								<label className="mb-2 block font-medium text-sm">Interview Purpose</label>
								<Select value={purpose} onValueChange={(v: Purpose) => setPurpose(v)}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="exploratory">Exploratory (open-ended)</SelectItem>
										<SelectItem value="validation">Validation (hypothesis testing)</SelectItem>
										<SelectItem value="followup">Follow-up (specific topics)</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div>
								<label className="mb-2 block font-medium text-sm">Participant Familiarity</label>
								<Select value={familiarity} onValueChange={(v: Familiarity) => setFamiliarity(v)}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="cold">Cold (first interaction)</SelectItem>
										<SelectItem value="warm">Warm (established rapport)</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Main Question List Section */}
			<div className="space-y-4">
				{/* Action Buttons - Reorganized with functional grouping */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{/* Primary Action Group */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									className="border-blue-500 text-blue-600 hover:bg-blue-50"
									disabled={generating || autoGenerateInitial}
								>
									{generating || autoGenerateInitial ? (
										<>
											<div className="mr-2 h-4 w-4 animate-spin rounded-full border-current border-b-2" />
											Generating...
										</>
									) : (
										<>
											<Brain className="mr-2 h-4 w-4" />
											Add Questions
											<ChevronDown className="ml-1 h-4 w-4" />
										</>
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuItem onClick={generateQuestions} disabled={generating || autoGenerateInitial}>
									<Brain className="mr-2 h-4 w-4" />
									Generate {moreCount} AI Questions
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setShowAddCustomQuestion(true)}>
									<Plus className="mr-2 h-4 w-4" />
									Write Custom Question
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Settings Group */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<Settings className="mr-1 h-4 w-4" />
									<span className="hidden md:inline">Options</span>
									<ChevronDown className="ml-1 h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuItem onClick={() => setShowCustomInstructions(!showCustomInstructions)}>
									<Edit className="mr-2 h-4 w-4" />
									AI Instructions & Count
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setShowSettings(!showSettings)}>
									<Settings className="mr-2 h-4 w-4" />
									Interview Settings
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{/* Filter Group */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										if (!mustHavesOnly) {
											// Save current selection (or default to all visible) before filtering
											previousSelectionRef.current =
												selectedQuestionIds.length > 0
													? [...selectedQuestionIds]
													: questionPack.questions.map((q) => q.id)
											// Filter to must-haves
											const filteredIds = (previousSelectionRef.current || []).filter((id) => {
												const q = questions.find((qq) => qq.id === id)
												return q?.isMustHave
											})
											if (filteredIds.length > 0) {
												setSelectedQuestionIds(filteredIds)
												setMustHavesOnly(true)
											} else {
												// No must-haves yet; keep selection and do not toggle
												toast.info("No questions are marked as must‑have yet")
											}
										} else {
											// Restore prior selection or all
											const restore =
												previousSelectionRef.current && previousSelectionRef.current.length > 0
													? previousSelectionRef.current
													: questionPack.questions.map((q) => q.id)
											setSelectedQuestionIds(restore)
											setMustHavesOnly(false)
										}
									}}
								>
									<Filter className="mr-1 h-4 w-4" />
									<span className="hidden md:inline">Must-Haves</span>
									{mustHavesOnly && (
										<span className="ml-2 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-700 text-xs">
											on
										</span>
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Filter Must-Have Questions</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>

				{/* Custom Instructions */}
				{showCustomInstructions && (
					<Card className="border-blue-100">
						<CardContent className="space-y-3 p-4">
							<div className="flex items-center gap-2">
								<label className="text-muted-foreground text-xs">Add</label>
								<Select value={String(moreCount)} onValueChange={(v) => setMoreCount(Number(v))}>
									<SelectTrigger className="h-8 w-[84px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
											<SelectItem key={n} value={String(n)}>
												{n}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<span className="text-muted-foreground text-xs">questions per click</span>
							</div>
							<Textarea
								placeholder="Add specific instructions for question generation (e.g., 'Focus more on technical challenges', 'Include questions about team dynamics')..."
								value={customInstructions}
								onChange={(e) => setCustomInstructions(e.target.value)}
								rows={3}
							/>
						</CardContent>
					</Card>
				)}

				{/* Help Dialog */}
				<InterviewQuestionHelp open={showHelp} onOpenChange={setShowHelp} />

				{/* Improve Question Dialog */}
				<Dialog open={!!improvingId} onOpenChange={(o) => !o && setImprovingId(null)}>
					<DialogContent className="sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>Improve question</DialogTitle>
						</DialogHeader>
						<div className="space-y-3">
							{improvingId ? (
								<div className="text-muted-foreground text-sm">Generating suggestions…</div>
							) : improveOptions.length > 0 ? (
								<div className="space-y-2">
									{improveOptions.map((opt, idx) => (
										<Button
											key={idx}
											variant="outline"
											className="w-full justify-start"
											onClick={async () => {
												if (!improvingId) return
												setEvaluatingId(improvingId)
												const quality = await evaluateQuestionQuality(opt)
												const updated = questions.map((q) =>
													q.id === improvingId ? { ...q, text: opt, qualityFlag: quality ?? undefined } : q
												)
												setQuestions(updated)
												setSkipDebounce(true)
												await saveQuestionsToDatabase(updated, selectedQuestionIds)
												setTimeout(() => setSkipDebounce(false), 1500)
												setEvaluatingId(null)
												setImprovingId(null)
												setImproveOptions([])
											}}
										>
											{opt}
										</Button>
									))}
								</div>
							) : (
								<div className="text-muted-foreground text-sm">No suggestions yet.</div>
							)}
						</div>
					</DialogContent>
				</Dialog>

				{/* Add Custom Question Modal */}
				{showAddCustomQuestion && (
					<Card className="border-blue-100">
						<CardContent className="p-4">
							<div className="space-y-3">
								<h3 className="font-medium">Add Custom Question</h3>
								<Textarea
									placeholder="Enter your custom question..."
									value={newQuestionText}
									onChange={(e) => setNewQuestionText(e.target.value)}
									rows={3}
								/>
								<Select value={newQuestionCategory} onValueChange={setNewQuestionCategory}>
									<SelectTrigger>
										<SelectValue placeholder="Select category" />
									</SelectTrigger>
									<SelectContent>
										{questionCategories.map((cat) => (
											<SelectItem key={cat.id} value={cat.id}>
												{cat.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<div className="flex justify-end gap-2">
									<Button
										onClick={() => {
											setShowAddCustomQuestion(false)
											setNewQuestionText("")
											setNewQuestionCategory("context")
										}}
										variant="outline"
									>
										Cancel
									</Button>
									<Button
										onClick={addCustomQuestion}
										disabled={!newQuestionText.trim() || addingCustomQuestion}
										variant="default"
										className="bg-blue-600 hover:bg-blue-700"
									>
										{addingCustomQuestion ? (
											<>
												<div className="mr-2 h-4 w-4 animate-spin rounded-full border-current border-b-2" />
												Evaluating...
											</>
										) : (
											"Add Question"
										)}
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				<div className="space-y-2">
					<DragDropContext onDragEnd={onDragEnd}>
						<Droppable droppableId="question-pack">
							{(provided) => (
								<div className="space-y-3" {...provided.droppableProps} ref={provided.innerRef}>
									{questionPack.questions.map((question, index) => {
										const isFirstOverflow = index === questionPack.overflowIndex
										const runningTime = questionPack.questions
											.slice(0, index + 1)
											.reduce((sum, q) => sum + q.estimatedMinutes, 0)
										const fitsInTime = runningTime <= timeMinutes

										return (
											<React.Fragment key={question.id}>
												{isFirstOverflow && (
													<div className="mt-6 border-orange-300 border-t-2 border-dashed pt-4">
														<div className="mb-4 flex items-center gap-2">
															<Clock className="h-4 w-4 text-orange-600" />
															<span className="font-medium text-orange-600 text-sm">
																Questions below may not fit in your {timeMinutes}-minute time limit (
																{questionPack.belowCount} below)
															</span>
														</div>
													</div>
												)}
												<Draggable draggableId={question.id} index={index}>
													{(provided, snapshot) => (
														<div
															ref={provided.innerRef}
															{...provided.draggableProps}
															className={`${snapshot.isDragging ? "opacity-50" : ""}`}
														>
															<AnimatedBorderCard active={fitsInTime}>
																<TooltipProvider>
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<Card
																				className={`border-none sm:rounded-xl sm:border sm:border-gray-200 sm:border-l-4 sm:shadow-sm ${fitsInTime
																					? "sm:border-l-blue-500"
																					: "bg-orange-50/30 sm:border-l-orange-500 dark:bg-orange-950/30"
																					}`}
																			>
																				<CardContent className="p-2">
																					<div className="flex items-start gap-3">
																						<div className="mt-0.5 flex items-center gap-2">
																							<div {...provided.dragHandleProps}>
																								<GripVertical className="h-4 w-4 cursor-grab text-gray-400 active:cursor-grabbing" />
																							</div>
																							<div className="min-w-[1.5rem] font-medium text-foreground/60 text-sm">
																								{index + 1}
																							</div>
																						</div>
																						<div className="min-w-0 flex-1">
																							<div className="flex flex-wrap items-center gap-2">
																								{question.source === "user" && (
																									<Badge
																										variant="outline"
																										className="border-blue-200 text-blue-800 dark:border-blue-800 dark:text-blue-200"
																									>
																										<User className="mr-1 h-3 w-3" />
																										Custom
																									</Badge>
																								)}
																								{question.timesAnswered > 0 && (
																									<Badge
																										className={getAnsweredCountColor(question.timesAnswered)}
																										variant="outline"
																									>
																										{question.timesAnswered}
																									</Badge>
																								)}
																								{question.isMustHave && (
																									<Badge
																										variant="outline"
																										className="border-red-200 text-red-800 dark:border-red-800 dark:text-red-200"
																									>
																										<TriangleAlert className="mr-1 h-3 w-3 fill-current" />
																										Must-Have
																									</Badge>
																								)}
																							</div>
																							{editingId === question.id ? (
																								<div className="mb-2 flex items-center gap-2">
																									<Textarea
																										value={editingText}
																										onChange={(e) => setEditingText(e.target.value)}
																										autoFocus
																										rows={2}
																										className="resize-none"
																									/>
																									<Button
																										variant="ghost"
																										size="icon"
																										onClick={async () => {
																											setEvaluatingId(question.id)
																											const quality = await evaluateQuestionQuality(editingText)
																											const updated = questions.map((q) =>
																												q.id === question.id
																													? {
																														...q,
																														text: editingText,
																														qualityFlag: quality ?? undefined,
																													}
																													: q
																											)
																											setQuestions(updated)
																											setSkipDebounce(true)
																											await saveQuestionsToDatabase(updated, selectedQuestionIds)
																											setTimeout(() => setSkipDebounce(false), 1500)
																											setEditingId(null)
																											setEditingText("")
																											setEvaluatingId(null)
																										}}
																										className="text-green-600"
																									>
																										{evaluatingId === question.id ? (
																											<div className="h-4 w-4 animate-spin rounded-full border-current border-b-2" />
																										) : (
																											<Check className="h-4 w-4" />
																										)}
																									</Button>
																									<Button
																										variant="ghost"
																										size="icon"
																										onClick={() => {
																											setEditingId(null)
																											setEditingText("")
																										}}
																										className="text-gray-500"
																									>
																										<X className="h-4 w-4" />
																									</Button>
																								</div>
																							) : (
																								<p
																									className="mb-2 font-medium text-sm leading-relaxed"
																									title={question.rationale ? `Why: ${question.rationale}` : undefined}
																								>
																									{question.text}
																								</p>
																							)}
																						</div>
																						<div className="flex items-center gap-1">
																							{question.qualityFlag && (
																								<QualityFlag qualityFlag={question.qualityFlag} />
																							)}
																							<DropdownMenu>
																								<TooltipProvider>
																									<Tooltip>
																										<TooltipTrigger asChild>
																											<DropdownMenuTrigger asChild>
																												<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
																													<MoreHorizontal className="h-4 w-4" />
																												</Button>
																											</DropdownMenuTrigger>
																										</TooltipTrigger>
																										<TooltipContent>Refine & Manage questions</TooltipContent>
																									</Tooltip>
																								</TooltipProvider>
																								<DropdownMenuContent align="end">
																									<DropdownMenuItem
																										onClick={async () => {
																											const updated = questions.map((q) =>
																												q.id === question.id ? { ...q, isMustHave: !q.isMustHave } : q
																											)
																											setQuestions(updated)
																											// Save to database
																											setSkipDebounce(true)
																											await saveQuestionsToDatabase(updated, selectedQuestionIds)
																											setTimeout(() => setSkipDebounce(false), 1500)
																										}}
																									>
																										<TriangleAlert className="mr-2 h-4 w-4" />
																										{question.isMustHave ? "Remove Must-Have" : "Mark Must-Have"}
																									</DropdownMenuItem>
																									<DropdownMenuItem
																										onClick={() =>
																											generateFollowUpQuestions(question.id, question.text)
																										}
																										disabled={generatingFollowUp === question.id}
																									>
																										{generatingFollowUp === question.id ? (
																											<div className="mr-2 h-4 w-4 animate-spin rounded-full border-current border-b-2" />
																										) : (
																											<Zap className="mr-2 h-4 w-4" />
																										)}
																										Generate Follow-ups
																									</DropdownMenuItem>
																									<DropdownMenuItem
																										onClick={() => {
																											setEditingId(question.id)
																											setEditingText(question.text)
																										}}
																									>
																										<Edit className="mr-2 h-4 w-4" />
																										Edit Question
																									</DropdownMenuItem>
																									<DropdownMenuItem
																										onClick={() => removeQuestion(question.id)}
																										className="text-red-600 focus:text-red-600"
																									>
																										<Trash2 className="mr-2 h-4 w-4" />
																										Remove Question
																									</DropdownMenuItem>
																								</DropdownMenuContent>
																							</DropdownMenu>
																						</div>
																					</div>
																				</CardContent>
																			</Card>
																		</TooltipTrigger>
																		<TooltipContent>
																			{questionCategories.find((c) => c.id === question.categoryId)?.name || "Other"} •
																			~{Math.round(question.estimatedMinutes)}min
																		</TooltipContent>
																	</Tooltip>
																</TooltipProvider>
															</AnimatedBorderCard>
														</div>
													)}
												</Draggable>
											</React.Fragment>
										)
									})}
									{provided.placeholder}
								</div>
							)}
						</Droppable>
					</DragDropContext>

					{questionPack.remainingQuestions.length > 0 && (
						<div className="mt-6">
							<div className="border-t pt-4">
								{/* <MarqueeTips
										tips={["Click + to add a backup question", "Toggle Must‑Haves to focus", "Drag handle to reorder"]}
										className="mb-3"
									/> */}
								<Button
									variant="outline"
									onClick={() => setShowAllQuestions(!showAllQuestions)}
									className="mb-4 w-full"
								>
									<BriefcaseBusiness className="mr-2 h-4 w-4" /> {showAllQuestions ? "Hide" : "Show"} Backup Questions (
									{questionPack.remainingQuestions.length})
								</Button>

								{showAllQuestions && (
									<div className="mt-4 space-y-3">
										<p className="text-gray-600 text-sm">
											Additional questions below the line - click to include in your list:
										</p>
										{questionPack.remainingQuestions.map((question) => (
											<TooltipProvider key={question.id}>
												<Tooltip>
													<TooltipTrigger asChild>
														<Card className="border-none py-2 shadow-none sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-sm">
															<CardContent className="p-2 sm:p-2">
																<div className="flex items-start gap-3">
																	<button
																		onClick={() => addQuestionFromReserve(question)}
																		className="mt-1 flex items-center gap-2 rounded p-1 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900"
																		title="Add question to your pack"
																	>
																		<GripVertical className="h-4 w-4 text-gray-400" />
																		<Plus className="h-4 w-4 text-blue-500" />
																	</button>
																	<div className="min-w-0 flex-1">
																		<div className="mb-2 flex flex-wrap items-center gap-2">
																			{question.source === "user" && (
																				<Badge
																					variant="outline"
																					className="border-blue-200 text-blue-800 dark:border-blue-800 dark:text-blue-200"
																				>
																					<User className="mr-1 h-3 w-3" />
																					Custom
																				</Badge>
																			)}
																			{question.timesAnswered > 0 && (
																				<Badge
																					className={getAnsweredCountColor(question.timesAnswered)}
																					variant="outline"
																				>
																					{question.timesAnswered}
																				</Badge>
																			)}
																		</div>
																		<p
																			className="text-sm leading-relaxed"
																			title={question.rationale ? `Why: ${question.rationale}` : undefined}
																		>
																			{question.text}
																		</p>
																	</div>
																	<div className="flex items-center gap-1">
																		{question.qualityFlag && <QualityFlag qualityFlag={question.qualityFlag} />}
																		<button
																			onClick={() => rejectQuestion(question.id)}
																			className="mt-1 rounded p-1 text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-900"
																			title="Reject this question (won't appear in future generations)"
																		>
																			<X className="h-4 w-4" />
																		</button>
																	</div>
																</div>
															</CardContent>
														</Card>
													</TooltipTrigger>
													<TooltipContent>
														{questionCategories.find((c) => c.id === question.categoryId)?.name || "Other"} • ~
														{Math.round((question as unknown as { estimatedMinutes: number }).estimatedMinutes)}min
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										))}
									</div>
								)}
							</div>
						</div>
					)}

				</div>
			</div>
		</div>
	)
}

export default InterviewQuestionsManager
