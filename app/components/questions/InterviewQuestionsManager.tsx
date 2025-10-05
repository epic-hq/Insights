import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import consola from "consola"
import {
	ArrowDownFromLine,
	Brain,
	BriefcaseBusiness,
	Check,
	Clock,
	Edit,
	Eye,
	EyeOff,
	Filter,
	Flag,
	GripVertical,
	HelpCircle,
	MessageCircleQuestion,
	MoreHorizontal,
	Plus,
	RefreshCw,
	Settings,
	Star,
	Trash2,
	User,
	X,
	Zap,
} from "lucide-react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useFetcher } from "react-router"
import { toast } from "sonner"
import { z } from "zod"
import { AnimatedBorderCard } from "~/components/ui/AnimatedBorderCard"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import { ProgressDots } from "~/components/ui/ProgressDots"
import { StatusPill } from "~/components/ui/StatusPill"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { Slider } from "~/components/ui/slider"
import { Textarea } from "~/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import ContextualSuggestions from "~/features/onboarding/components/ContextualSuggestions"
import InterviewQuestionHelp from "~/features/questions/components/InterviewQuestionHelp"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
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
	// When true (default), auto-generates an initial question set for empty projects
	autoGenerateOnEmpty?: boolean
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
	status: "proposed" | "asked" | "answered" | "skipped" | "rejected" | "selected" | "backup" | "deleted"
	timesAnswered: number
	source?: "ai" | "user" // Track whether question is AI-generated or user-created
	isMustHave?: boolean // Track if question is marked as must-have
	qualityFlag?: {
		assessment: "red" | "yellow" | "green"
		score: number
		description: string
		color?: string // Optional custom color override
	}
	estimatedMinutes?: number
	selectedOrder?: number | null
	isSelected?: boolean
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
	{
		id: "demographics",
		name: "Demographics",
		weight: 0.7,
		color: "border-slate-200 text-slate-800 dark:border-slate-800 dark:text-slate-200",
	},
]

// Safe minutes schema for user-entered allocation values
const MinutesSchema = z.coerce.number().refine(Number.isFinite).int().min(0).max(240)

function sanitizeAllocations(input?: Record<string, unknown>): Record<string, number> {
	const out: Record<string, number> = {}
	for (const cat of questionCategories) {
		const parsed = MinutesSchema.safeParse(input?.[cat.id])
		out[cat.id] = parsed.success ? parsed.data : 0
	}
	return out
}

const parseScores = (input: unknown): Question["scores"] => {
	const candidate = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {}
	const importance = typeof candidate.importance === "number" ? candidate.importance : 0.5
	const goalMatch = typeof candidate.goalMatch === "number" ? candidate.goalMatch : 0.5
	const novelty = typeof candidate.novelty === "number" ? candidate.novelty : 0.5
	return { importance, goalMatch, novelty }
}

// Ensure a list of questions has unique IDs against an existing set and within itself
function ensureUniqueQuestionIds(newQs: Question[], existingQs: Question[]): Question[] {
	const used = new Set<string>(existingQs.map((q) => q.id))
	const result: Question[] = []
	for (const q of newQs) {
		let id = q.id && q.id.length > 0 ? q.id : crypto.randomUUID()
		while (used.has(id)) {
			id = crypto.randomUUID()
		}
		used.add(id)
		result.push({ ...q, id })
	}
	return result
}

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
		autoGenerateOnEmpty = true,
		defaultTimeMinutes = 30,
		defaultPurpose = "exploratory",
		defaultFamiliarity = "cold",
		defaultGoDeep = false,
		onSelectionChange,
		onSelectedQuestionsChange,
	} = props

	const routes = useProjectRoutes(projectPath)
	const isLoadingRef = useRef(false)
	const lastLoadedRef = useRef<{ projectId?: string; ts: number }>({ projectId: undefined, ts: 0 })
	const existingPromptIdsRef = useRef<string[]>([])
	// Suppress deletions during critical saves (e.g., adding a follow-up)
	const suppressDeletionRef = useRef(false)
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
	const [showCustomInstructions, _setShowCustomInstructions] = useState(false)
	const [showAddCustomQuestion, setShowAddCustomQuestion] = useState(false)
	const [newQuestionText, setNewQuestionText] = useState("")
	const [newQuestionCategory, setNewQuestionCategory] = useState("context")
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingText, setEditingText] = useState("")
	const [addingCustomQuestion, setAddingCustomQuestion] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const [autoGenerateInitial, setAutoGenerateInitial] = useState(false)
	const [showingFollowupFor, setShowingFollowupFor] = useState<string | null>(null)
	const [followupInput, setFollowupInput] = useState("")
	const [followupCategory, setFollowupCategory] = useState("context")
	const [mustHavesOnly, setMustHavesOnly] = useState(false)
	const [showHelp, setShowHelp] = useState(false)
	const [improvingId, setImprovingId] = useState<string | null>(null)
	const [improveOptions, setImproveOptions] = useState<string[]>([])
	const [evaluatingId, setEvaluatingId] = useState<string | null>(null)
	// Category-focused enhancements
	const [categoryTimeAllocations, setCategoryTimeAllocations] = useState<Record<string, number>>({})
	const [generatingCategoryId, setGeneratingCategoryId] = useState<string | null>(null)
	// How many new questions to generate when user clicks "Generate More"
	// Default "Generate More" count to 8 instead of 3
	const [moreCount, setMoreCount] = useState<number>(3)
	const previousSelectionRef = React.useRef<string[] | null>(null)
	const recentlyAddedTimeoutsRef = React.useRef<Record<string, number>>({})
	const [recentlyAddedQuestionIds, setRecentlyAddedQuestionIds] = useState<string[]>([])
	const [pendingGeneratedQuestions, setPendingGeneratedQuestions] = useState<Question[]>([])
	const [showPendingModal, setShowPendingModal] = useState(false)
	const [pendingInsertionChoices, setPendingInsertionChoices] = useState<Record<string, string>>({})
	const [processingPendingId, setProcessingPendingId] = useState<string | null>(null)

	// Category/time visibility toggle
	const [showCategoryTime, setShowCategoryTime] = useState(false)

	// Inline question adding
	const [showInlineAdd, setShowInlineAdd] = useState(false)
	const [inlineQuestionText, setInlineQuestionText] = useState("")
	const [inlineQuestionCategory, setInlineQuestionCategory] = useState("context")

	// Fetcher for soft delete operations
	const deleteFetcher = useFetcher()

	// Interview sync
	const [syncingInterviews, setSyncingInterviews] = useState(false)

	// ContextualSuggestions state
	const [contextualInput, setContextualInput] = useState("")
	const [contextualCategory, setContextualCategory] = useState("context")
	const [loadedResearchGoal, setLoadedResearchGoal] = useState("")
	const [showContextualInput, setShowContextualInput] = useState(false)
	const contextualInputRef = useRef<HTMLTextAreaElement>(null)

	// Load research goal from API
	useEffect(() => {
		if (!projectId) return

		const loadResearchGoal = async () => {
			try {
				const response = await fetch(`/api/load-project-goals?projectId=${projectId}`)

				if (response.ok) {
					const result = await response.json()
					consola.log("🔍 Loaded project goals response:", result)
					const researchGoal = result.data?.research_goal || ""
					consola.log("🔍 Extracted research goal:", researchGoal)
					setLoadedResearchGoal(researchGoal)
				}
			} catch (error) {
				console.error("Failed to load research goal:", error)
			}
		}

		loadResearchGoal()
	}, [projectId])

	// Use research_goal prop if provided, otherwise use loaded research goal
	const effectiveResearchGoal = research_goal || loadedResearchGoal

	consola.log("🎯 ContextualSuggestions Debug:", {
		research_goal_prop: research_goal,
		loadedResearchGoal,
		effectiveResearchGoal,
		willShow: !!effectiveResearchGoal,
	})

	// PostHog feature flag to gate Quality Check
	const { isEnabled: isEvalEnabled } = usePostHogFeatureFlag("ffEvalQuestion")

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

					const formattedNewQuestions: Question[] = newQuestions.map((q: QuestionInput) => {
						const baseQuestion: Question = {
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
							isMustHave: (q as QuestionInput & { isMustHave?: boolean }).isMustHave || false,
						}
						return {
							...baseQuestion,
							estimatedMinutes:
								(q as QuestionInput & { estimatedMinutes?: number }).estimatedMinutes ??
								estimateMinutesPerQuestion(baseQuestion, purpose, familiarity),
							selectedOrder: typeof q.selectedOrder === "number" ? q.selectedOrder : null,
							isSelected: true, // Auto-select all generated questions
							status: "selected" as const, // Set status to selected
						}
					})

					// Deduplicate questions by ID against existing and within this batch (and pending list)
					const deduplicatedQuestions = ensureUniqueQuestionIds(formattedNewQuestions, [
						...questions,
						...pendingGeneratedQuestions,
					])

					setPendingGeneratedQuestions((prev) => [...prev, ...deduplicatedQuestions])
					setPendingInsertionChoices((prev) => ({
						...prev,
						...deduplicatedQuestions.reduce<Record<string, string>>((acc, question) => {
							acc[question.id] = "end"
							return acc
						}, {}),
					}))
					setShowPendingModal(true)

					// Reload questions from database to get the freshly saved data
					await loadQuestions()

					if (autoGenerateInitial) {
						setAutoGenerateInitial(false)
						toast.success(`Generated ${deduplicatedQuestions.length} initial questions`, {
							description: "Questions have been saved and loaded from database.",
							duration: 5000,
						})
					} else {
						toast.success(`Generated ${deduplicatedQuestions.length} new questions`, {
							description: "Questions have been saved and loaded from database.",
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

	// Auto-generate questions on first load (optional)
	useEffect(() => {
		if (!autoGenerateOnEmpty) return
		if (!loading && !hasInitialized && questions.length === 0 && projectId) {
			setAutoGenerateInitial(true)
			generateQuestions()
		}
	}, [autoGenerateOnEmpty, loading, hasInitialized, questions.length, projectId])

	useEffect(() => {
		return () => {
			Object.values(recentlyAddedTimeoutsRef.current).forEach((id) => {
				window.clearTimeout(id)
			})
			recentlyAddedTimeoutsRef.current = {}
		}
	}, [])

	const supabase = createClient()

	const getBaseSelectedIds = useCallback((): string[] => {
		if (mustHavesOnly) {
			const stored = previousSelectionRef.current
			if (stored && stored.length > 0) return [...stored]
		}
		return [...selectedQuestionIds]
	}, [mustHavesOnly, selectedQuestionIds])

	const commitSelection = useCallback(
		(nextBaseIds: string[]) => {
			previousSelectionRef.current = [...nextBaseIds]
			if (mustHavesOnly) {
				const filtered = nextBaseIds.filter((id) => {
					const q = questions.find((question) => question.id === id)
					return q?.isMustHave
				})
				setSelectedQuestionIds(filtered)
			} else {
				setSelectedQuestionIds(nextBaseIds)
			}
		},
		[mustHavesOnly, questions]
	)

	// Extract loadQuestions as a standalone function so it can be called from generateQuestions
	const loadQuestions = useCallback(async () => {
		if (!projectId) {
			setLoading(false)
			return
		}
		try {
			setLoading(true)
			const [promptRes, sectionRes, answerRes] = await Promise.all([
				supabase
					.from("interview_prompts")
					.select("*")
					.eq("project_id", projectId)
					.order("order_index", { ascending: true, nullsFirst: true })
					.order("created_at", { ascending: true }),
				supabase
					.from("project_sections")
					.select("meta")
					.eq("project_id", projectId)
					.eq("kind", "questions")
					.order("created_at", { ascending: false })
					.limit(1)
					.maybeSingle(),
				supabase.from("project_answers").select("question_id, status").eq("project_id", projectId),
			])

			if (promptRes.error) consola.warn("Failed to load interview_prompts", promptRes.error.message)
			if (sectionRes.error && sectionRes.error.code !== "PGRST116") throw sectionRes.error
			if (answerRes.error) consola.warn("Failed to load project_answers", answerRes.error.message)

			existingPromptIdsRef.current = (promptRes.data ?? []).map((row) => row.id)

			const answerCountMap = new Map<string, number>()
			for (const row of answerRes.data ?? []) {
				if (row.question_id && row.status === "answered") {
					const current = answerCountMap.get(row.question_id) || 0
					answerCountMap.set(row.question_id, current + 1)
				}
			}

			const meta = (sectionRes.data?.meta as Record<string, unknown>) || {}
			const settings = (meta.settings as Record<string, unknown> | undefined) || {}
			if (typeof settings.timeMinutes === "number") setTimeMinutes(settings.timeMinutes)
			if (typeof settings.purpose === "string") setPurpose(settings.purpose as Purpose)
			if (typeof settings.familiarity === "string") setFamiliarity(settings.familiarity as Familiarity)
			if (typeof settings.goDeepMode === "boolean") setGoDeepMode(settings.goDeepMode)
			if (typeof settings.customInstructions === "string") setCustomInstructions(settings.customInstructions)
			const catTimesRaw = (settings as { categoryTimeAllocations?: Record<string, unknown> } | undefined)
				?.categoryTimeAllocations
			setCategoryTimeAllocations(sanitizeAllocations(catTimesRaw))

			let formattedQuestions: Question[] = []
			let selectedIds: string[] = []

			const promptRows: any[] = Array.isArray(promptRes.data) ? (promptRes.data as any[]) : []
			if (promptRows.length > 0) {
				formattedQuestions = promptRows
					.filter((row: any) => row.status !== "deleted" && row.status !== "rejected")
					.map((row: any) => ({
						id: row.id,
						text: row.text,
						categoryId: row.category || "context",
						scores: parseScores(row.scores),
						rationale: row.rationale || "",
						status: (row.status as Question["status"]) || "proposed",
						timesAnswered: answerCountMap.get(row.id) || 0,
						source: (row.source as Question["source"]) || "ai",
						isMustHave: row.is_must_have ?? false,
						estimatedMinutes: row.estimated_time_minutes ?? undefined,
						selectedOrder: typeof row.selected_order === "number" ? row.selected_order : null,
						isSelected: row.is_selected ?? false,
					}))
				selectedIds = promptRows
					.filter(
						(row: any) =>
							row.status !== "deleted" &&
							row.status !== "rejected" &&
							(row.is_selected || typeof row.selected_order === "number")
					)
					.sort(
						(a, b) => (a.selected_order ?? Number.POSITIVE_INFINITY) - (b.selected_order ?? Number.POSITIVE_INFINITY)
					)
					.map((row) => row.id)
			} else {
				existingPromptIdsRef.current = []
				const legacyQuestions = ((meta.questions as QuestionInput[] | undefined) || []).filter(
					(q) => (q.status as Question["status"]) !== "deleted" && (q.status as Question["status"]) !== "rejected"
				)
				const resolvedIds = legacyQuestions.map((q) => q.id || crypto.randomUUID())
				formattedQuestions = legacyQuestions.map((q, idx) => ({
					id: resolvedIds[idx],
					text: q.text || q.question || "",
					categoryId: q.categoryId || q.category || "context",
					scores: parseScores(
						q.scores ?? {
							importance: q.importance,
							goalMatch: q.goalMatch,
							novelty: q.novelty,
						}
					),
					rationale: q.rationale || "",
					status: (q.status as Question["status"]) || "proposed",
					timesAnswered: answerCountMap.get(resolvedIds[idx]) || 0,
					source: (q as QuestionInput & { source?: "ai" | "user" }).source || "ai",
					isMustHave: (q as QuestionInput & { isMustHave?: boolean }).isMustHave || false,
					estimatedMinutes: (q as QuestionInput & { estimatedMinutes?: number }).estimatedMinutes,
					selectedOrder: typeof q.selectedOrder === "number" ? q.selectedOrder : null,
					isSelected: (q as QuestionInput & { isSelected?: boolean }).isSelected ?? false,
				}))
				selectedIds = legacyQuestions
					.map((q, idx) => ({ q, idx }))
					.filter(
						({ q }) =>
							q && ((q as QuestionInput & { isSelected?: boolean }).isSelected || typeof q.selectedOrder === "number")
					)
					.sort(
						(a, b) =>
							((a.q.selectedOrder as number | undefined) ?? Number.POSITIVE_INFINITY) -
							((b.q.selectedOrder as number | undefined) ?? Number.POSITIVE_INFINITY)
					)
					.map(({ idx }) => resolvedIds[idx])
			}

			const seen = new Set<string>()
			const deduped = formattedQuestions.map((q) => {
				if (seen.has(q.id)) {
					const newId = crypto.randomUUID()
					seen.add(newId)
					return { ...q, id: newId }
				}
				seen.add(q.id)
				return q
			})

			setQuestions(deduped)
			if (selectedIds.length > 0) {
				setSelectedQuestionIds(selectedIds)
				commitSelection(selectedIds)
				setHasInitialized(true)
			} else {
				setSelectedQuestionIds([])
			}
		} catch (error) {
			consola.error("Error loading questions:", error)
		} finally {
			setLoading(false)
		}
	}, [projectId, supabase, commitSelection])

	const markQuestionAsRecentlyAdded = useCallback((id: string) => {
		setRecentlyAddedQuestionIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
		if (recentlyAddedTimeoutsRef.current[id]) {
			window.clearTimeout(recentlyAddedTimeoutsRef.current[id])
		}
		const timeoutId = window.setTimeout(() => {
			setRecentlyAddedQuestionIds((prev) => prev.filter((existing) => existing !== id))
			delete recentlyAddedTimeoutsRef.current[id]
		}, 6000)
		recentlyAddedTimeoutsRef.current[id] = timeoutId
	}, [])

	useEffect(() => {
		const baseIds = getBaseSelectedIds()
		onSelectionChange?.(baseIds)
	}, [getBaseSelectedIds, onSelectionChange])

	// Load canonical interview prompts when projectId is provided
	useEffect(() => {
		if (isLoadingRef.current) return
		const now = Date.now()
		if (lastLoadedRef.current.projectId === projectId && now - lastLoadedRef.current.ts < 1500) return
		isLoadingRef.current = true
		loadQuestions().finally(() => {
			lastLoadedRef.current = { projectId, ts: Date.now() }
			isLoadingRef.current = false
		})
	}, [projectId, loadQuestions])

	const estimateMinutesPerQuestion = useCallback((q: Question, p: Purpose, f: Familiarity): number => {
		const baseTimes = { exploratory: 3.5, validation: 2.5, followup: 2.0 }
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
		return Math.max(1.0, Math.min(4.0, baseTime + categoryAdj + familiarityAdjustment))
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

	const baseSelectedIdsForModal = useMemo(() => getBaseSelectedIds(), [getBaseSelectedIds])
	const baseSelectedQuestionsForModal = useMemo(
		() =>
			baseSelectedIdsForModal.map((id) => questions.find((q) => q.id === id)).filter((q): q is Question => Boolean(q)),
		[baseSelectedIdsForModal, questions]
	)

	// Initialize selected questions once after computing the pack (no state changes inside useMemo)
	useEffect(() => {
		if (!hasInitialized && selectedQuestionIds.length === 0 && questionPack.questions.length > 0) {
			const ids = questionPack.questions.map((q) => q.id)
			commitSelection(ids)
			setHasInitialized(true)
		}
	}, [hasInitialized, selectedQuestionIds.length, questionPack.questions, commitSelection])

	// Time used per category for currently selected questions
	const usedMinutesByCategory = useMemo(() => {
		const acc: Record<string, number> = {}
		for (const q of questionPack.questions as Array<{ categoryId: string; estimatedMinutes: number }>) {
			acc[q.categoryId] = (acc[q.categoryId] || 0) + (q.estimatedMinutes || 0)
		}
		return acc
	}, [questionPack.questions])

	// Grouping helper is not required for DnD; headers are inserted inline

	// Notify parent when the selected questions (with text) change
	useEffect(() => {
		if (!onSelectedQuestionsChange) return
		const baseIds = getBaseSelectedIds()
		const minimal = baseIds
			.map((id) => {
				const match = questions.find((q) => q.id === id)
				return match ? { id: match.id, text: match.text } : null
			})
			.filter(Boolean) as { id: string; text: string }[]
		onSelectedQuestionsChange(minimal)
	}, [getBaseSelectedIds, onSelectedQuestionsChange, questions])

	const saveQuestionsToDatabase = useCallback(
		async (questionsToSave: Question[], selectedIds: string[]) => {
			if (!projectId) return
			try {
				setSaving(true)

				// ALLOWED VALUES TABLE FOR DEBUGGING
				const ALLOWED_STATUS_VALUES = ["proposed", "asked", "answered", "skipped", "rejected"] as const
				const ALLOWED_SOURCE_VALUES = ["ai", "user"] as const

				console.group("🔍 SAVE QUESTIONS TO DATABASE DEBUG")
				console.log("📊 ALLOWED VALUES:")
				console.table({
					"Status Values": ALLOWED_STATUS_VALUES.join(", "),
					"Source Values": ALLOWED_SOURCE_VALUES.join(", "),
					"Project ID": projectId,
					"Questions Count": questionsToSave.length,
					"Selected IDs Count": selectedIds.length,
				})

				const withOrder = questionsToSave.map((q, index) => {
					const selectedIndex = selectedIds.indexOf(q.id)
					const estimated = q.estimatedMinutes ?? estimateMinutesPerQuestion(q, purpose, familiarity)
					return {
						...q,
						estimatedMinutes: estimated,
						status: q.status,
						selectedOrder: selectedIndex >= 0 ? selectedIndex : null,
						isSelected: selectedIndex >= 0,
					}
				})

				const promptPayloads = withOrder.map((q, index) => {
					const selectedIndex = selectedIds.indexOf(q.id)
					const payload = {
						id: q.id,
						project_id: projectId,
						text: q.text,
						category: q.categoryId,
						estimated_time_minutes: Math.round(
							q.estimatedMinutes ?? estimateMinutesPerQuestion(q, purpose, familiarity)
						),
						is_must_have: q.isMustHave ?? false,
						status: q.status,
						order_index: index + 1,
						scores: q.scores,
						source: q.source ?? "ai",
						rationale: q.rationale || null,
						is_selected: q.isSelected ?? selectedIndex >= 0,
						selected_order: q.selectedOrder ?? (selectedIndex >= 0 ? selectedIndex : null),
					}

					// Log each payload for debugging
					if (q.status === "rejected" || q.isMustHave) {
						console.log(`🔴 CRITICAL QUESTION [${q.id.slice(0, 8)}]:`, {
							text: q.text.slice(0, 50) + "...",
							status: q.status,
							is_must_have: payload.is_must_have,
							payload_status: payload.status,
						})
					}

					return payload
				})

				console.log("📤 SENDING TO DATABASE:", {
					payloads_count: promptPayloads.length,
					rejected_count: promptPayloads.filter((p) => p.status === "rejected").length,
					must_have_count: promptPayloads.filter((p) => p.is_must_have).length,
				})

				const { data, error: promptError } = await supabase
					.from("interview_prompts")
					.upsert(promptPayloads, { onConflict: "id" })
					.select("id")

				if (promptError) {
					console.error("❌ DATABASE ERROR:", promptError)
					throw promptError
				}

				console.log("✅ DATABASE RESPONSE:", {
					returned_count: data?.length || 0,
					upserted_ids: data?.map((d) => d.id.slice(0, 8)).join(", ") || "none",
				})
				console.groupEnd()

				const keepIds = new Set(promptPayloads.map((p) => p.id))
				// Avoid deleting a just-added prompt if a debounced save with stale state runs
				if (!suppressDeletionRef.current && existingPromptIdsRef.current.length) {
					const toDelete = existingPromptIdsRef.current.filter((id) => !keepIds.has(id))
					if (toDelete.length) {
						const { error: deleteError } = await supabase
							.from("interview_prompts")
							.delete()
							.eq("project_id", projectId)
							.in("id", toDelete)
						if (deleteError) throw deleteError
					}
				}
				existingPromptIdsRef.current = Array.from(keepIds)

				const { error: sectionError } = await supabase.from("project_sections").upsert(
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
								categoryTimeAllocations,
							},
						},
					},
					{ onConflict: "project_id,kind", ignoreDuplicates: false }
				)
				if (sectionError) consola.error("Error saving questions meta:", sectionError)
			} catch (e) {
				consola.error("Error saving questions to database:", e)
			} finally {
				setSaving(false)
			}
		},
		[
			projectId,
			supabase,
			timeMinutes,
			purpose,
			familiarity,
			goDeepMode,
			customInstructions,
			categoryTimeAllocations,
			estimateMinutesPerQuestion,
		]
	)

	// Generate a single question focused on a specific category
	const generateOneInCategory = useCallback(
		async (categoryId: string) => {
			if (generating || generatingCategoryId) return
			setGeneratingCategoryId(categoryId)
			try {
				const formData = new FormData()
				formData.append("project_id", projectId || "")
				formData.append("questionCount", "1")
				formData.append("interview_time_limit", timeMinutes.toString())
				// Bias the model toward a category without changing saved instructions
				const catName = questionCategories.find((c) => c.id === categoryId)?.name || categoryId
				const augmented = `${customInstructions || ""}\nFocus on the category: ${catName}.`
				formData.append("custom_instructions", augmented)

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
				if (!response.ok) {
					const err = await response.json().catch(() => ({}))
					throw new Error(err?.error || `Server error ${response.status}`)
				}
				const data = await response.json()
				if (data.success && Array.isArray(data.questionSet?.questions)) {
					const result = data.questionSet.questions as QuestionInput[]
					const formatted: Question[] = result.map((q) => {
						const baseQuestion: Question = {
							id: q.id || crypto.randomUUID(),
							text: q.text || "",
							categoryId: categoryId,
							scores: {
								importance: (q.scores?.importance ?? 0.5) as number,
								goalMatch: (q.scores?.goalMatch ?? 0.5) as number,
								novelty: (q.scores?.novelty ?? 0.5) as number,
							},
							rationale: q.rationale || "",
							status: "selected",
							timesAnswered: 0,
							source: "ai",
							isMustHave: false,
						}
						return {
							...baseQuestion,
							estimatedMinutes:
								(q as QuestionInput & { estimatedMinutes?: number }).estimatedMinutes ??
								estimateMinutesPerQuestion(baseQuestion, purpose, familiarity),
							selectedOrder: null,
							isSelected: true, // Auto-select generated questions
							status: "selected" as const, // Set status to selected
						}
					})

					setPendingGeneratedQuestions((prev) => [...prev, ...formatted])
					setPendingInsertionChoices((prev) => ({
						...prev,
						...formatted.reduce<Record<string, string>>((acc, q) => {
							acc[q.id] = "end"
							return acc
						}, {}),
					}))
					setShowPendingModal(true)
					toast.success("Generated 1 question", { description: `Added to review for ${catName}.` })
				} else {
					throw new Error("No question returned")
				}
			} catch (e) {
				toast.error("Failed to generate in category", { description: e instanceof Error ? e.message : "Unknown error" })
			} finally {
				setGeneratingCategoryId(null)
			}
		},
		[
			generating,
			generatingCategoryId,
			projectId,
			timeMinutes,
			customInstructions,
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
		]
	)

	// Save settings changes to database (separate from question changes)
	useEffect(() => {
		if (!projectId || !hasInitialized || skipDebounce || suppressDeletionRef.current) return
		const timeoutId = setTimeout(() => {
			// Double-check flags haven't been set during the timeout
			if (skipDebounce || suppressDeletionRef.current) return
			const baseIds = getBaseSelectedIds()
			console.log("🔍 DEBUG: Debounced save triggered with", questions.length, "questions")
			saveQuestionsToDatabase(questions, baseIds)
		}, 1000) // Debounce saves - longer timeout for settings
		return () => clearTimeout(timeoutId)
	}, [projectId, hasInitialized, questions, getBaseSelectedIds, saveQuestionsToDatabase, skipDebounce])

	// Removed: category allocation auto-persist to avoid network loops

	const removeQuestion = useCallback(
		(id: string) => {
			const baseIds = getBaseSelectedIds().filter((qId) => qId !== id)
			commitSelection(baseIds)

			// Create form data for the API
			const formData = new FormData()
			formData.append("intent", "delete")

			// Use fetcher to submit the delete intent
			deleteFetcher.submit(formData, {
				method: "post",
				action: `/api/questions/${id}`,
				encType: "application/x-www-form-urlencoded",
			})

			// Optimistic UI update: remove from local state entirely
			setQuestions((qs) => qs.filter((q) => q.id !== id))

			// Show toast notification
			toast.success("Question deleted", {
				description: "The question has been moved to deleted status",
			})
		},
		[getBaseSelectedIds, commitSelection, deleteFetcher, setQuestions]
	)

	const moveQuestion = useCallback(
		async (fromIndex: number, toIndex: number) => {
			const visibleIds = selectedQuestionIds.length > 0 ? selectedQuestionIds : questionPack.questions.map((q) => q.id)
			const reorderedVisible = [...visibleIds]
			const [removed] = reorderedVisible.splice(fromIndex, 1)
			reorderedVisible.splice(toIndex, 0, removed)
			const baseIds = getBaseSelectedIds()
			const visibleSet = new Set(visibleIds)
			let visiblePointer = 0
			const newBaseIds = baseIds.map((id) => {
				if (!visibleSet.has(id)) return id
				const replacement = reorderedVisible[visiblePointer++]
				return replacement
			})
			commitSelection(newBaseIds)
			markQuestionAsRecentlyAdded(removed)
			setHasInitialized(true)
			setSkipDebounce(true)
			await saveQuestionsToDatabase(questions, newBaseIds)
			setTimeout(() => setSkipDebounce(false), 1500)
		},
		[
			selectedQuestionIds,
			questionPack.questions,
			getBaseSelectedIds,
			commitSelection,
			questions,
			saveQuestionsToDatabase,
		]
	)

	const onDragEnd = (result: DropResult) => {
		if (!result.destination) return
		const { source, destination } = result
		if (source.index !== destination.index) moveQuestion(source.index, destination.index)
	}

	const addQuestionFromReserve = useCallback(
		async (question: Question) => {
			const baseIds = getBaseSelectedIds()
			if (baseIds.includes(question.id)) return
			const newBaseIds = [...baseIds, question.id]
			commitSelection(newBaseIds)
			setHasInitialized(true)
			setSkipDebounce(true)
			await saveQuestionsToDatabase(questions, newBaseIds)
			setTimeout(() => setSkipDebounce(false), 1500)
		},
		[getBaseSelectedIds, commitSelection, questions, saveQuestionsToDatabase]
	)

	const addCustomQuestion = useCallback(async () => {
		if (!newQuestionText.trim()) {
			toast.error("Please enter a question")
			return
		}

		setAddingCustomQuestion(true)
		try {
			if (!isEvalEnabled) {
				const baseQuestion = {
					id: crypto.randomUUID(),
					text: newQuestionText.trim(),
					categoryId: newQuestionCategory,
					scores: { importance: 0.7, goalMatch: 0.6, novelty: 0.5 },
					rationale: "Custom user question",
					status: "proposed" as const,
					timesAnswered: 0,
					source: "user" as const,
					isMustHave: false,
				} as Question
				const customQuestion: Question = {
					...baseQuestion,
					estimatedMinutes: estimateMinutesPerQuestion(baseQuestion, purpose, familiarity),
					selectedOrder: null,
					isSelected: true,
				}
				const updatedQuestions = [...questions, customQuestion]
				const baseIds = [...getBaseSelectedIds(), customQuestion.id]
				setQuestions(updatedQuestions)
				commitSelection(baseIds)
				setHasInitialized(true)
				markQuestionAsRecentlyAdded(customQuestion.id)
				setSkipDebounce(true)
				await saveQuestionsToDatabase(updatedQuestions, baseIds)
				setTimeout(() => setSkipDebounce(false), 1500)
				setNewQuestionText("")
				setNewQuestionCategory("context")
				setShowAddCustomQuestion(false)
				return
			}
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
			const baseQuestion = {
				id: crypto.randomUUID(),
				text: newQuestionText.trim(),
				categoryId: newQuestionCategory,
				scores: {
					importance: Math.max(0.3, evaluation.score / 100),
					goalMatch: 0.6,
					novelty: 0.5,
				},
				rationale: `Custom user question (AI quality score: ${evaluation.score}/100)`,
				status: "proposed" as const,
				timesAnswered: 0,
				source: "user" as const,
				isMustHave: false,
				qualityFlag: {
					assessment: evaluation.overall_quality as "red" | "yellow" | "green",
					score: evaluation.score,
					description: evaluation.quick_feedback || "Quality assessment completed",
				},
			} as Question
			const customQuestion: Question = {
				...baseQuestion,
				estimatedMinutes: estimateMinutesPerQuestion(baseQuestion, purpose, familiarity),
				selectedOrder: null,
				isSelected: true,
			}

			const updatedQuestions = [...questions, customQuestion]
			const baseIds = [...getBaseSelectedIds(), customQuestion.id]
			setQuestions(updatedQuestions)
			commitSelection(baseIds)
			setHasInitialized(true)
			markQuestionAsRecentlyAdded(customQuestion.id)

			setSkipDebounce(true)
			await saveQuestionsToDatabase(updatedQuestions, baseIds)
			setTimeout(() => setSkipDebounce(false), 1500)

			setNewQuestionText("")
			setNewQuestionCategory("context")
			setShowAddCustomQuestion(false)
		} catch (error) {
			console.error("Question evaluation/addition error:", error)

			// Fallback to adding without evaluation
			const fallbackQuestion = {
				id: crypto.randomUUID(),
				text: newQuestionText.trim(),
				categoryId: newQuestionCategory,
				scores: { importance: 0.7, goalMatch: 0.6, novelty: 0.5 },
				rationale: "Custom user question",
				status: "proposed" as const,
				timesAnswered: 0,
				source: "user" as const,
				isMustHave: false,
				qualityFlag: {
					assessment: "yellow",
					score: 50,
					description: "Quality evaluation failed - added without assessment",
				},
			} as Question
			const customQuestion: Question = {
				...fallbackQuestion,
				estimatedMinutes: estimateMinutesPerQuestion(fallbackQuestion, purpose, familiarity),
				selectedOrder: null,
				isSelected: true,
			}

			const updatedQuestions = [...questions, customQuestion]
			const baseIds = [...getBaseSelectedIds(), customQuestion.id]
			setQuestions(updatedQuestions)
			commitSelection(baseIds)
			setHasInitialized(true)
			markQuestionAsRecentlyAdded(customQuestion.id)

			setSkipDebounce(true)
			await saveQuestionsToDatabase(updatedQuestions, baseIds)
			setTimeout(() => setSkipDebounce(false), 1500)

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
		getBaseSelectedIds,
		commitSelection,
		markQuestionAsRecentlyAdded,
		saveQuestionsToDatabase,
		research_goal,
		target_roles,
		isEvalEnabled,
	])

	// Auto-evaluate question quality when text changes are saved
	const evaluateQuestionQuality = useCallback(
		async (text: string) => {
			if (!isEvalEnabled) return null
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
		[research_goal, target_roles, isEvalEnabled]
	)

	const rejectQuestion = useCallback(
		async (questionId: string) => {
			const updatedQuestions = questions.map((q) => (q.id === questionId ? { ...q, status: "rejected" as const } : q))
			setQuestions(updatedQuestions)

			const baseIds = getBaseSelectedIds().filter((id) => id !== questionId)
			commitSelection(baseIds)

			setSkipDebounce(true)
			await saveQuestionsToDatabase(updatedQuestions, baseIds)
			setTimeout(() => setSkipDebounce(false), 1500)

			toast.success("Question rejected", {
				description: "This question won't appear in future generations",
			})
		},
		[questions, getBaseSelectedIds, commitSelection, saveQuestionsToDatabase]
	)

	const getAnsweredCountColor = (count: number) => {
		if (count === 0) return "bg-transparent text-muted-foreground"
		if (count <= 3) return "bg-transparent text-yellow-600 dark:text-yellow-400"
		if (count <= 10) return "bg-transparent text-green-600 dark:text-green-400"
		return "bg-transparent text-blue-600 dark:text-blue-400"
	}

	const handlePendingInsertionChange = useCallback((questionId: string, value: string) => {
		setPendingInsertionChoices((prev) => ({ ...prev, [questionId]: value }))
	}, [])

	const handlePendingCategoryChange = useCallback((questionId: string, categoryId: string) => {
		setPendingGeneratedQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, categoryId } : q)))
	}, [])

	const handleRejectPendingQuestion = useCallback((questionId: string) => {
		setPendingGeneratedQuestions((prev) => prev.filter((q) => q.id !== questionId))
		setPendingInsertionChoices((prev) => {
			const next = { ...prev }
			delete next[questionId]
			return next
		})
		toast.info("Question rejected", {
			description: "This generated question was discarded.",
		})
	}, [])

	// Handle inline question adding
	const handleInlineQuestionAdd = useCallback(async () => {
		if (!inlineQuestionText.trim()) {
			toast.error("Please enter a question")
			return
		}

		setAddingCustomQuestion(true)
		try {
			const baseQuestion = {
				id: crypto.randomUUID(),
				text: inlineQuestionText.trim(),
				categoryId: inlineQuestionCategory,
				scores: { importance: 0.7, goalMatch: 0.6, novelty: 0.5 },
				rationale: "Custom user question",
				status: "proposed" as const,
				timesAnswered: 0,
				source: "user" as const,
				isMustHave: false,
			} as Question

			const customQuestion: Question = {
				...baseQuestion,
				estimatedMinutes: estimateMinutesPerQuestion(baseQuestion, purpose, familiarity),
				selectedOrder: null,
				isSelected: true,
			}

			const updatedQuestions = [...questions, customQuestion]
			const baseIds = [...getBaseSelectedIds(), customQuestion.id]
			setQuestions(updatedQuestions)
			commitSelection(baseIds)
			setHasInitialized(true)
			markQuestionAsRecentlyAdded(customQuestion.id)
			await saveQuestionsToDatabase(updatedQuestions, baseIds)

			// Reset form
			setInlineQuestionText("")
			setInlineQuestionCategory("context")
			setShowInlineAdd(false)
			toast.success("Question added successfully")
		} catch (error) {
			consola.error("Error adding custom question:", error)
			toast.error("Failed to add question")
		} finally {
			setAddingCustomQuestion(false)
		}
	}, [
		inlineQuestionText,
		inlineQuestionCategory,
		questions,
		getBaseSelectedIds,
		commitSelection,
		markQuestionAsRecentlyAdded,
		saveQuestionsToDatabase,
		estimateMinutesPerQuestion,
		purpose,
		familiarity,
	])

	// Handle suggestion click from ContextualSuggestions
	const handleSuggestionClick = useCallback((suggestion: string) => {
		setInlineQuestionText(suggestion)
	}, [])

	// Handle contextual suggestion click - fill input and focus, do NOT add immediately
	const handleContextualSuggestionClick = useCallback((suggestion: string) => {
		setContextualInput(suggestion)
		contextualInputRef.current?.focus()
	}, [])

	// Add contextual input as a new question (Enter key or + button)
	const handleAddContextualQuestion = useCallback(async () => {
		const text = contextualInput.trim()
		if (!text) return

		try {
			setAddingCustomQuestion(true)

			// Create the question object to save to database
			const questionToSave = {
				text,
				category: contextualCategory,
				is_selected: true,
				selected_order: questions.filter((q) => q.isSelected).length,
				project_id: projectId!,
			}

			// Save to database first
			const { data: savedQuestion, error } = await supabase
				.from("interview_prompts")
				.insert(questionToSave)
				.select()
				.single()

			if (error) throw error

			// Create local question object
			const newQuestion: Question = {
				id: savedQuestion.id,
				text: savedQuestion.text,
				categoryId: (savedQuestion as any).category || "context",
				estimatedMinutes: estimateMinutesPerQuestion(
					{
						id: savedQuestion.id,
						text: savedQuestion.text,
						categoryId: (savedQuestion as any).category || "context",
						scores: { importance: 3, goalMatch: 3, novelty: 3 },
						status: "selected",
						timesAnswered: 0,
					} as Question,
					purpose,
					familiarity
				),
				isMustHave: false,
				status: "selected",
				source: "user",
				scores: { importance: 3, goalMatch: 3, novelty: 3 },
				isSelected: true,
				timesAnswered: 0,
			}

			// Update local state without flashing
			setQuestions((prev) => [...prev, newQuestion])

			// Clear input and hide form
			setContextualInput("")
			setShowContextualInput(false)

			// Show brief success feedback
			setRecentlyAddedQuestionIds([newQuestion.id])
			setTimeout(() => setRecentlyAddedQuestionIds([]), 2000)

			toast.success("Question added")
		} catch (error) {
			console.error("Error adding contextual question:", error)
			toast.error("Failed to add question")
		} finally {
			setAddingCustomQuestion(false)
		}
	}, [
		contextualInput,
		contextualCategory,
		questions,
		projectId,
		purpose,
		familiarity,
		estimateMinutesPerQuestion,
		supabase,
	])

	const syncExistingInterviews = useCallback(async () => {
		if (!projectId || syncingInterviews) return

		try {
			setSyncingInterviews(true)

			// Get all interviews for this project
			const { data: interviews, error: interviewsError } = await supabase
				.from("interviews")
				.select("id")
				.eq("project_id", projectId)

			if (interviewsError) throw interviewsError

			// Sync questions for each interview
			for (const interview of interviews || []) {
				const formData = new FormData()
				formData.append("projectId", projectId)
				formData.append("interviewId", interview.id)

				const response = await fetch("/api/refresh-interview-questions", {
					method: "POST",
					body: formData,
				})

				if (!response.ok) {
					throw new Error(`Failed to sync interview ${interview.id}`)
				}
			}

			toast.success(`Synced questions for ${interviews?.length || 0} interviews`)
		} catch (error) {
			console.error("Error syncing interviews:", error)
			toast.error("Failed to sync interview questions")
		} finally {
			setSyncingInterviews(false)
		}
	}, [projectId, syncingInterviews, supabase])

	const handleAcceptPendingQuestion = useCallback(
		async (questionId: string, mode: "end" | "after") => {
			setProcessingPendingId(questionId)
			const pending = pendingGeneratedQuestions.find((q) => q.id === questionId)
			if (!pending) {
				setProcessingPendingId(null)
				return
			}
			const baseIds = getBaseSelectedIds()
			let newBaseIds: string[]
			if (mode === "after") {
				const anchorId = pendingInsertionChoices[questionId]
				const anchorIndex = anchorId && baseIds.includes(anchorId) ? baseIds.indexOf(anchorId) : baseIds.length - 1
				if (anchorIndex >= 0) {
					newBaseIds = [...baseIds.slice(0, anchorIndex + 1), pending.id, ...baseIds.slice(anchorIndex + 1)]
				} else {
					newBaseIds = [...baseIds, pending.id]
				}
			} else {
				newBaseIds = [...baseIds, pending.id]
			}

			setSkipDebounce(true)
			try {
				const updatedQuestions = [...questions, pending]
				setQuestions(updatedQuestions)
				commitSelection(newBaseIds)
				setHasInitialized(true)
				markQuestionAsRecentlyAdded(pending.id)
				setPendingGeneratedQuestions((prev) => prev.filter((q) => q.id !== questionId))
				setPendingInsertionChoices((prev) => {
					const next = { ...prev }
					delete next[questionId]
					return next
				})

				await saveQuestionsToDatabase(updatedQuestions, newBaseIds)

				// Reload from database to ensure UI reflects actual DB state
				await loadQuestions()
				toast.success("Question added", {
					description:
						mode === "after"
							? "Inserted right after your chosen question."
							: "Added to the end of your interview plan.",
				})
			} finally {
				setTimeout(() => setSkipDebounce(false), 1500)
				setProcessingPendingId(null)
			}
		},
		[
			pendingGeneratedQuestions,
			getBaseSelectedIds,
			pendingInsertionChoices,
			questions,
			commitSelection,
			markQuestionAsRecentlyAdded,
			saveQuestionsToDatabase,
		]
	)

	useEffect(() => {
		if (pendingGeneratedQuestions.length === 0) {
			setShowPendingModal(false)
		}
	}, [pendingGeneratedQuestions])

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
				<p className="hidden text-muted-foreground text-sm md:visible">
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

				{/* Settings Button Row with Filters */}
				<div className="flex items-center justify-between">
					<Button
						variant="outline"
						onClick={() => setShowSettings(!showSettings)}
						className="flex items-center gap-2 whitespace-nowrap"
					>
						<Settings className="h-4 w-4" />
						{purpose.charAt(0).toUpperCase() + purpose.slice(1)} • {timeMinutes}m
					</Button>

					{/* Filter Group - Moved here */}
					<div className="flex items-center gap-2">
						{/* Category/Time Visibility Toggle */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowCategoryTime(!showCategoryTime)}
										className={showCategoryTime ? "border-blue-200 bg-blue-50" : ""}
									>
										{showCategoryTime ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
										<span className="ml-1 hidden sm:inline">{showCategoryTime ? "Hide" : "Show"} Categories</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>{showCategoryTime ? "Hide" : "Show"} category and time information</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											if (!mustHavesOnly) {
												// Save current selection before filtering
												previousSelectionRef.current =
													selectedQuestionIds.length > 0
														? [...selectedQuestionIds]
														: questionPack.questions.map((q) => q.id)
												// Filter to must-haves from interview_prompts table only
												const mustHaveIds = questions
													.filter((q) => q.isMustHave && q.status !== "rejected")
													.map((q) => q.id)
												setSelectedQuestionIds(mustHaveIds)
											} else {
												// Restore previous selection
												setSelectedQuestionIds(previousSelectionRef.current || [])
											}
											setMustHavesOnly(!mustHavesOnly)
										}}
										className={mustHavesOnly ? "border-orange-200 bg-orange-50" : ""}
									>
										<Filter className="h-4 w-4" />
										<span className="ml-1 hidden sm:inline">{mustHavesOnly ? "Show All" : "Filter"}</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{mustHavesOnly ? "Show all questions" : "Show only must-have questions"}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
				</div>
			</div>

			{/* Expandable Settings Panel */}
			{showSettings && (
				<Card className="border-blue-100">
					<CardContent className="p-3">
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

			{/* Interview Summary */}
			{showSettings && (
				<div className="rounded-lg bg-blue-50 p-4 text-sm">
					<p className="text-blue-800">
						<strong>Interview Plan:</strong> I want to conduct a{" "}
						<strong>
							{timeMinutes}-minute {purpose}
						</strong>{" "}
						interview with <strong>{familiarity === "cold" ? "new" : "familiar"}</strong> participants to gather
						insights for my research.
					</p>
				</div>
			)}

			{/* Main Question List Section */}
			<div className="space-y-4">
				{/* Simple Add Question Button */}
				<div className="flex items-center justify-between">
					{!showContextualInput ? (
						<Button onClick={() => setShowContextualInput(true)} variant="outline" size="sm" className="border-dashed">
							<Plus className="mr-2 h-4 w-4" />
							Add Prompt
						</Button>
					) : (
						<div>
							<div className="flex flex-row items-center gap-2">
								<Button
									onClick={() => setShowContextualInput(false)}
									variant="outline"
									size="sm"
									className="border-dashed"
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Prompt
								</Button>
								<Select value={contextualCategory} onValueChange={setContextualCategory}>
									<SelectTrigger className="w-48">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{questionCategories.map((cat) => (
											<SelectItem key={cat.id} value={cat.id}>
												{cat.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex w-full items-center gap-2">
								<Textarea
									ref={contextualInputRef as any}
									placeholder="e.g., What challenges do you face with your current solution?"
									value={contextualInput}
									onChange={(e) => setContextualInput(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddContextualQuestion()}
									className="flex-1 resize-none"
									rows={2}
									autoFocus
								/>
								<div className="flex flex-col gap-1">
									<Button
										onClick={handleAddContextualQuestion}
										variant="outline"
										size="sm"
										disabled={!contextualInput.trim() || addingCustomQuestion}
										className="h-8 w-8 p-0"
									>
										<Check className="h-4 w-4" />
									</Button>
									<Button
										onClick={() => {
											setShowContextualInput(false)
											setContextualInput("")
										}}
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Contextual Suggestions - only show when input is active */}
				{showContextualInput && effectiveResearchGoal && (
					<ContextualSuggestions
						researchGoal={
							effectiveResearchGoal ||
							"Help startups identify bottlenecks and resolve them through discipline and guidance so they can increase success rates."
						}
						currentInput={contextualInput}
						suggestionType="interview_questions"
						questionCategory={contextualCategory}
						existingItems={questions.map((q) => q.text)}
						onSuggestionClick={handleContextualSuggestionClick}
						apiPath="api/contextual-suggestions"
						isActive={true}
					/>
				)}

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
									{improveOptions.map((opt) => (
										<Button
											key={opt}
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
												await saveQuestionsToDatabase(updated, getBaseSelectedIds())
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

				<div className="space-y-4">
					<DragDropContext onDragEnd={onDragEnd}>
						<Droppable droppableId="question-pack">
							{(provided) => (
								<div className="space-y-3" {...provided.droppableProps} ref={provided.innerRef}>
									{questionPack.questions.map((question, index) => {
										const isFirstOverflow = index === questionPack.overflowIndex
										const cat = questionCategories.find((c) => c.id === question.categoryId)

										return (
											<React.Fragment key={question.id}>
												{isFirstOverflow && (
													<div className="mt-6 border-orange-300 border-t-2 border-dashed pt-4">
														<div className="mb-4 flex items-center gap-2">
															<Clock className="h-4 w-4 text-orange-600" />
															<span className="font-medium text-orange-600 text-sm">
																Questions below may not fit in your {timeMinutes}-minute time limit
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
															<Card
																className={`border-l-4 p-1 shadow-sm transition-all ${recentlyAddedQuestionIds.includes(question.id) ? "border-l-green-500 bg-green-50" : "border-l-gray-200"}`}
															>
																<CardContent className="p-2">
																	<div className="flex items-start gap-3">
																		<div className="flex items-start gap-2">
																			<div {...provided.dragHandleProps}>
																				<GripVertical className="mt-0.5 h-4 w-4 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing" />
																			</div>
																			<div className="mt-0.5 min-w-[1.5rem] font-medium text-foreground/60 text-sm">
																				{index + 1}.
																			</div>
																		</div>
																		<div className="min-w-0 flex-1">
																			{editingId === question.id ? (
																				<div className="mb-2 flex items-center gap-2">
																					<Textarea
																						value={editingText}
																						onChange={(e) => setEditingText(e.target.value)}
																						autoFocus
																						rows={2}
																						className="resize-none"
																					/>
																					<div className="flex flex-col gap-2">
																						<Button
																							variant="ghost"
																							size="icon"
																							onClick={async () => {
																								setEvaluatingId(question.id)
																								const quality = isEvalEnabled
																									? await evaluateQuestionQuality(editingText)
																									: null
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
																								await saveQuestionsToDatabase(updated, getBaseSelectedIds())
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
																				</div>
																			) : (
																				<div className="mb-2">
																					<p
																						className="-mx-1 cursor-pointer rounded-md px-1 font-medium text-sm hover:bg-gray-50"
																						title={question.rationale ? `Why: ${question.rationale}` : undefined}
																						onClick={() => {
																							setEditingId(question.id)
																							setEditingText(question.text)
																						}}
																					>
																						{question.text}
																					</p>
																					{/* Inline badges */}
																					<div className="mt-1 flex flex-wrap items-center gap-2">
																						{/* {question.source === "user" && (
																							<Badge
																								variant="outline"
																								className="border-blue-200 text-blue-800 dark:border-blue-800 dark:text-blue-200"
																							>
																								<User className="mr-1 h-3 w-3" />
																								Custom
																							</Badge>
																						)} */}
																						{/* {question.timesAnswered > 0 && (
																							<Badge
																								className={getAnsweredCountColor(question.timesAnswered)}
																								variant="outline"
																							>
																								{question.timesAnswered}
																							</Badge>
																						)} */}
																						{question.isMustHave && (
																							<Badge
																								variant="outline"
																								className="border-red-200 text-red-800 dark:border-red-800 dark:text-red-200"
																							>
																								<Star className="mr-1 h-3 w-3 fill-current" />
																								Must-Have
																							</Badge>
																						)}
																					</div>
																				</div>
																			)}

																			{/* Category/Time display on small screens */}
																			{showCategoryTime && (
																				<div className="mt-2 sm:hidden">
																					<span
																						className={`inline-flex items-center rounded-md border px-2 py-1 text-xs ${cat?.color || "border-gray-200 bg-gray-50 text-gray-700"}`}
																					>
																						{cat?.name || "Other"} • ~{Math.round(question.estimatedMinutes || 3)}min
																					</span>
																				</div>
																			)}
																		</div>
																		<div className="flex items-center gap-1">
																			{isEvalEnabled && question.qualityFlag && (
																				<QualityFlag qualityFlag={question.qualityFlag} />
																			)}
																			{showCategoryTime && (
																				<span
																					className={`hidden items-center rounded-md border px-2 py-1 text-xs sm:inline-flex ${cat?.color || "border-gray-200 bg-gray-50 text-gray-700"}`}
																					title="View question details"
																				>
																					{questionCategories.find((c) => c.id === question.categoryId)?.name ||
																						"Other"}{" "}
																					• ~{Math.round(question.estimatedMinutes || 3)}min
																				</span>
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
																							// Use new intent-based API
																							const formData = new FormData()
																							formData.append("intent", "toggle-must-have")

																							try {
																								const response = await fetch(`/api/questions/${question.id}`, {
																									method: "POST",
																									body: formData,
																								})

																								const result = await response.json()

																								if (result.success) {
																									// Update UI state with server response
																									const updated = questions.map((q) =>
																										q.id === question.id
																											? { ...q, isMustHave: result.question.is_must_have }
																											: q
																									)
																									setQuestions(updated)
																									toast.success(result.message)
																								} else {
																									toast.error("Failed to toggle must-have", {
																										description: result.error || "Please try again",
																									})
																								}
																							} catch (error) {
																								console.error("❌ Network error:", error)
																								toast.error("Failed to toggle must-have", {
																									description: "Network error, please try again",
																								})
																							}
																						}}
																					>
																						<Star className="mr-2 h-4 w-4" />
																						{question.isMustHave ? "Remove Must-Have" : "Mark Must-Have"}
																					</DropdownMenuItem>
																					<DropdownMenuItem
																						onClick={() => {
																							setShowingFollowupFor(question.id)
																							setFollowupCategory(question.categoryId)
																							setFollowupInput("")
																							setFollowupCategory(question.categoryId)
																						}}
																					>
																						<ArrowDownFromLine className="mr-2 h-4 w-4" />
																						Add Followup
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
																						className="text-orange-600 focus:text-orange-600"
																					>
																						<Trash2 className="mr-2 h-4 w-4" />
																						Backup
																					</DropdownMenuItem>
																					<DropdownMenuItem
																						onClick={async () => {
																							console.group(`🗑️ DELETE QUESTION [${question.id.slice(0, 8)}]`)

																							// Use new intent-based API
																							const formData = new FormData()
																							formData.append("intent", "delete")

																							try {
																								const response = await fetch(`/api/questions/${question.id}`, {
																									method: "POST",
																									body: formData,
																								})

																								const result = await response.json()

																								if (result.success) {
																									// Update UI state with server response
																									const updated = questions.map((q) =>
																										q.id === question.id ? { ...q, status: "deleted" as const } : q
																									)
																									setQuestions(updated)
																									const baseIds = getBaseSelectedIds().filter(
																										(id) => id !== question.id
																									)
																									commitSelection(baseIds)

																									console.log("✅ Delete operation completed successfully")
																									toast.success(result.message)
																								} else {
																									console.error("❌ Failed to delete question:", result.error)
																									toast.error("Failed to delete question", {
																										description: result.error || "Please try again",
																									})
																								}
																							} catch (error) {
																								console.error("❌ Network error:", error)
																								toast.error("Failed to delete question", {
																									description: "Network error, please try again",
																								})
																							} finally {
																								console.groupEnd()
																							}
																						}}
																						className="text-red-600 focus:text-red-600"
																					>
																						<X className="mr-2 h-4 w-4" />
																						Delete
																					</DropdownMenuItem>
																				</DropdownMenuContent>
																			</DropdownMenu>
																		</div>
																	</div>
																</CardContent>
															</Card>

															{/* Contextual Suggestions for Follow-up Questions */}
															{showingFollowupFor === question.id && (
																<div className="mt-2 ml-8 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
																	<div className="mb-3 flex items-center justify-between">
																		<div className="flex flex-start flex-row font-medium text-blue-900 text-sm">
																			<ArrowDownFromLine className="mr-2 h-4 w-4" />
																			Add follow-up question:
																		</div>
																		<Button
																			variant="ghost"
																			size="sm"
																			onClick={() => {
																				setShowingFollowupFor(null)
																				setFollowupInput("")
																				setFollowupCategory(question.categoryId)
																			}}
																			className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
																		>
																			<X className="h-4 w-4" />
																		</Button>
																	</div>

																	<div className="mb-3 space-y-2">
																		<Textarea
																			placeholder="e.g., Can you walk me through a specific example of that challenge?"
																			value={followupInput}
																			onChange={(e) => setFollowupInput(e.target.value)}
																			className="resize-none"
																			rows={2}
																		/>
																		<Select value={followupCategory} onValueChange={setFollowupCategory}>
																			<SelectTrigger className="w-full">
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
																		<div className="flex items-center gap-2">
																			<Button
																				onClick={async () => {
																					console.log("🔍 DEBUG: Button clicked, input:", followupInput.trim())
																					if (!followupInput.trim()) return

																					try {
																						setAddingCustomQuestion(true)
																						console.log("🔍 DEBUG: Starting followup addition")

																						// Create the follow-up question
																						const followupQuestion: Question = {
																							id: crypto.randomUUID(),
																							text: followupInput.trim(),
																							categoryId: followupCategory,
																							scores: { importance: 0.7, goalMatch: 0.8, novelty: 0.6 },
																							rationale: `Follow-up to: ${question.text}`,
																							status: "selected",
																							timesAnswered: 0,
																							source: "user",
																							isMustHave: false,
																							estimatedMinutes: estimateMinutesPerQuestion(
																								{ categoryId: followupCategory } as Question,
																								purpose,
																								familiarity
																							),
																							selectedOrder: null,
																							isSelected: true,
																						}
																						console.log("🔍 DEBUG: Created followup question:", followupQuestion)

																						// Insert after the current question
																						const baseIds = getBaseSelectedIds()
																						const currentIndex = baseIds.indexOf(question.id)
																						console.log(
																							"🔍 DEBUG: Current question position:",
																							currentIndex,
																							"in",
																							baseIds
																						)

																						const newBaseIds = [
																							...baseIds.slice(0, currentIndex + 1),
																							followupQuestion.id,
																							...baseIds.slice(currentIndex + 1),
																						]
																						console.log("🔍 DEBUG: New baseIds:", newBaseIds)

																						const updatedQuestions = [...questions, followupQuestion]
																						console.log("🔍 DEBUG: Updated questions count:", updatedQuestions.length)

																						setQuestions(updatedQuestions)
																						commitSelection(newBaseIds)
																						markQuestionAsRecentlyAdded(followupQuestion.id)

																						// Prevent debounced save from racing this change
																						suppressDeletionRef.current = true
																						setSkipDebounce(true)
																						console.log("🔍 DEBUG: About to save to database")
																						await saveQuestionsToDatabase(updatedQuestions, newBaseIds)

																						// Reload from database to ensure UI reflects actual DB state
																						await loadQuestions()
																						setTimeout(() => {
																							setSkipDebounce(false)
																							suppressDeletionRef.current = false
																						}, 3000) // longer timeout to prevent debounced save override

																						setFollowupInput("")
																						setFollowupCategory(question.categoryId)
																						setShowingFollowupFor(null)
																						toast.success("Follow-up question added")
																						console.log("DEBUG: Followup addition completed")
																					} catch (error) {
																						console.error("Error adding follow-up:", error)
																						toast.error("Failed to add follow-up question")
																					} finally {
																						setAddingCustomQuestion(false)
																					}
																				}}
																				size="sm"
																			>
																				<Plus className="mr-1 h-3 w-3" />
																				Add Follow-up
																			</Button>
																		</div>
																	</div>

																	{effectiveResearchGoal && (
																		<ContextualSuggestions
																			researchGoal={effectiveResearchGoal}
																			currentInput={followupInput}
																			suggestionType="interview_questions"
																			questionCategory={question.categoryId}
																			customInstructions={`Generate deeper follow-up questions specifically for: "${question.text}"`}
																			existingItems={questions.map((q) => q.text)}
																			onSuggestionClick={(suggestion) => setFollowupInput(suggestion)}
																			apiPath="api/contextual-suggestions"
																			isActive={true}
																			responseCount={3}
																		/>
																	)}
																</div>
															)}
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
											Generated backup questions - Click <Plus className="inline h-3 w-3" /> to add to your interview
											plan:
										</p>
										{questionPack.remainingQuestions.map((question) => (
											<TooltipProvider key={question.id}>
												<Tooltip>
													<TooltipTrigger asChild>
														<Card className="border-none py-2 shadow-none sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-sm">
															<CardContent className="p-0 md:p-2">
																<div className="flex items-start gap-3">
																	<div className="min-w-0 flex-1">
																		<div className="mb-2">
																			<Badge variant="outline" className="text-xs">
																				{questionCategories.find((c) => c.id === question.categoryId)?.name || "Other"}
																			</Badge>
																		</div>
																		<p className="text-sm leading-relaxed">{question.text}</p>
																	</div>
																	<div className="flex items-center gap-2">
																		<Button
																			size="sm"
																			variant="outline"
																			onClick={() => addQuestionFromReserve(question)}
																			className="border-green-500 text-green-600 hover:bg-green-50"
																			title="Add to selected questions"
																		>
																			<Plus className="h-4 w-4" />
																		</Button>
																		<DropdownMenu>
																			<DropdownMenuTrigger asChild>
																				<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
																					<MoreHorizontal className="h-4 w-4" />
																				</Button>
																			</DropdownMenuTrigger>
																			<DropdownMenuContent align="end">
																				<DropdownMenuItem
																					onClick={() => {
																						// TODO: Implement edit functionality for backup questions
																						toast.info("Edit functionality coming soon")
																					}}
																				>
																					<Edit className="mr-2 h-4 w-4" />
																					Edit Question
																				</DropdownMenuItem>
																				<DropdownMenuItem
																					onClick={() => rejectQuestion(question.id)}
																					className="text-red-600 focus:text-red-600"
																				>
																					<X className="mr-2 h-4 w-4" />
																					Delete
																				</DropdownMenuItem>
																			</DropdownMenuContent>
																		</DropdownMenu>
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
