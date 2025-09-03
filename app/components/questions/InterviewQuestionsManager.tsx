import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import consola from "consola"
import {
	Brain,
	Check,
	ChevronDown,
	Clock,
	GripVertical,
	MessageCircleQuestion,
	MoreHorizontal,
	Pencil,
	Plus,
	Settings,
	Trash2,
	User,
	X,
} from "lucide-react"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Slider } from "~/components/ui/slider"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
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

const _questionCategoriesVariants = {
	context: {
		id: "context",
		name: "Context & Background",
		color: "border-blue-100 text-blue-800 dark:border-blue-900 dark:text-blue-200",
		colorVariant: "blue",
	},
	goals: {
		id: "goals",
		name: "Goals & Outcomes",
		color: "border-green-100 text-green-800 dark:border-green-900 dark:text-green-200",
		colorVariant: "green",
	},
	pain: {
		id: "pain",
		name: "Pain Points",
		color: "border-red-100 text-red-800 dark:border-red-900 dark:text-red-200",
		colorVariant: "red",
	},
	workflow: {
		id: "workflow",
		name: "Workflow & Process",
		color: "border-purple-100 text-purple-800 dark:border-purple-900 dark:text-purple-200",
		colorVariant: "purple",
	},
	motivation: {
		id: "motivation",
		name: "Motivation & Drivers",
		color: "border-yellow-100 text-yellow-800 dark:border-yellow-900 dark:text-yellow-200",
		colorVariant: "yellow",
	},
	constraints: {
		id: "constraints",
		name: "Constraints & Barriers",
		color: "border-orange-100 text-orange-800 dark:border-orange-900 dark:text-orange-200",
		colorVariant: "orange",
	},
	willingness: {
		id: "willingness",
		name: "Willingness & Adoption",
		color: "border-indigo-100 text-indigo-800 dark:border-indigo-900 dark:text-indigo-200",
		colorVariant: "indigo",
	},
} as const

// Quality flag component
function QualityFlag({ qualityFlag }: { qualityFlag: Question["qualityFlag"] }) {
	if (!qualityFlag) return null
	
	const getColorClasses = (assessment: string) => {
		switch (assessment) {
			case "red":
				return "bg-red-100 text-red-700 border-red-200"
			case "yellow":
				return "bg-yellow-100 text-yellow-700 border-yellow-200"
			case "green":
				return "bg-green-100 text-green-700 border-green-200"
			default:
				return "bg-gray-100 text-gray-700 border-gray-200"
		}
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getColorClasses(qualityFlag.assessment)}`}>
						Q
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<div className="max-w-xs">
						<div className="font-semibold">Quality Assessment</div>
						<div className="text-xs text-muted-foreground">
							Score: {qualityFlag.score}/100 ({qualityFlag.assessment.toUpperCase()})
						</div>
						<div className="mt-1 text-xs">{qualityFlag.description}</div>
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
	const [questions, setQuestions] = useState<Question[]>([])
	const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
	const [hasInitialized, setHasInitialized] = useState(false)
	const [skipDebounce, setSkipDebounce] = useState(false)
	const [showAllQuestions, setShowAllQuestions] = useState(false)
	const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState(false)
	const [showCustomInstructions, setShowCustomInstructions] = useState(false)
	const [showAddCustomQuestion, setShowAddCustomQuestion] = useState(false)
	const [newQuestionText, setNewQuestionText] = useState("")
	const [newQuestionCategory, setNewQuestionCategory] = useState("context")
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingText, setEditingText] = useState("")
	const [addingCustomQuestion, setAddingCustomQuestion] = useState(false)

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
				if (settings.timeMinutes) setTimeMinutes(settings.timeMinutes)
				if (settings.purpose) setPurpose(settings.purpose)
				if (settings.familiarity) setFamiliarity(settings.familiarity)
				if (settings.goDeepMode !== undefined) setGoDeepMode(settings.goDeepMode)
				if (settings.customInstructions) setCustomInstructions(settings.customInstructions)

				const formattedQuestions: Question[] = questionsData.map((q: QuestionInput, idx: number) => ({
					id: resolvedIds[idx],
					text: q.text || q.question || "",
					categoryId: q.categoryId || q.category || "context",
					scores: {
						importance: q.scores?.importance ?? q.importance ?? 0.5,
						goalMatch: q.scores?.goalMatch ?? q.goalMatch ?? 0.5,
						novelty: q.scores?.novelty ?? q.novelty ?? 0.5,
					},
					rationale: q.rationale || "",
					status: (q.status as Question["status"]) || "proposed",
					timesAnswered: answerCountMap.get(q.id || resolvedIds[idx]) || 0,
					source: (q as QuestionInput & { source?: "ai" | "user" }).source || "ai", // Default to AI for existing questions
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
			15: { base: 3, validation: +1, cold: -1 },
			30: { base: 5, validation: +1, cold: -1 },
			45: { base: 7, validation: +1, cold: -1 },
			60: { base: 9, validation: +1, cold: -1 },
		}

		const tc = targetCounts[timeMinutes]
		const targetCount = Math.max(
			2,
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

		const orderedSelectedQuestions = idsToUse.map((id) => byId.get(id)!)

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
				const withOrder = questionsToSave.map((q) => {
					const selectedIndex = selectedIds.indexOf(q.id)
					return {
						...q,
						status: "proposed",
						selectedOrder: selectedIndex >= 0 ? selectedIndex : null,
						isSelected: selectedIndex >= 0,
						source: q.source || "ai", // Ensure source is preserved
					}
				})
				const { error } = await supabase.from("project_sections").upsert(
					{
						project_id: projectId,
						kind: "questions",
						content_md: `# Interview Questions\n\nManaged ${withOrder.length} questions for interview planning.`,
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
			const qualityMessage = `Quality Score: ${evaluation.score}/100 (${evaluation.overall_quality.toUpperCase()})`

			if (evaluation.overall_quality === "red") {
				toast.error("Question quality needs improvement", {
					description: `${qualityMessage}. ${evaluation.quick_feedback}`,
					duration: 6000,
					className: "text-red-600"
				})
				// Still add the question but warn the user
			} else if (evaluation.overall_quality === "yellow") {
				toast.warning("Question could be improved", {
					description: `${qualityMessage}. ${evaluation.quick_feedback}`,
					duration: 5000,
					className: "text-yellow-600"
				})
			} else {
				toast.success("Great question!", {
					description: `${qualityMessage}. ${evaluation.quick_feedback}`,
					duration: 4000,
					className: "text-green-600"
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
				qualityFlag: {
					assessment: evaluation.overall_quality as "red" | "yellow" | "green",
					score: evaluation.score,
					description: evaluation.quick_feedback || "Quality assessment completed"
				}
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
				qualityFlag: {
					assessment: "yellow",
					score: 50,
					description: "Quality evaluation failed - added without assessment"
				}
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
				className: "text-red-600"
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

	const getCategoryColor = (categoryId: string) => {
		const category = questionCategories.find((c) => c.id === categoryId)
		return category?.color || "border-gray-100 text-gray-800 dark:border-gray-900 dark:text-gray-200"
	}

	const getAnsweredCountColor = (count: number) => {
		if (count === 0) return "bg-transparent text-gray-600 dark:text-gray-400"
		if (count <= 3) return "bg-transparent text-yellow-600 dark:text-yellow-400"
		if (count <= 10) return "bg-transparent text-green-600 dark:text-green-400"
		return "bg-transparent text-blue-600 dark:text-blue-400"
	}

	const generateQuestions = async () => {
		if (generating) return
		setGenerating(true)
		try {
			// Create FormData for remix-style API
			const formData = new FormData()
			formData.append("project_id", projectId || "")
			formData.append("custom_instructions", customInstructions || "")
			formData.append("questionCount", "10")
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
								content_md: `# Interview Questions\n\nGenerated ${allQuestions.length} questions for interview planning.`,
								meta: { questions: allQuestions },
							},
							{ onConflict: "project_id,kind", ignoreDuplicates: false }
						)
					}

					const formattedNewQuestions: Question[] = newQuestions.map((q: QuestionInput) => ({
						id: q.id || crypto.randomUUID(),
						text: q.text,
						categoryId: q.categoryId || "context",
						scores: q.scores || { importance: 0.5, goalMatch: 0.5, novelty: 0.5 },
						rationale: q.rationale || "",
						status: "proposed",
						timesAnswered: 0,
						source: "ai",
					}))
					setQuestions((prev) => [...prev, ...formattedNewQuestions])
					toast.success(`Added ${formattedNewQuestions.length} new questions to the bottom of your available list`, {
						description: "You can now select them to add to your question pack",
						duration: 4000,
					})
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
		}
	}

	if (loading) {
		return (
			<div className="p-4 sm:p-8">
				<div className="animate-pulse">
					<div className="mb-4 h-8 w-1/3 rounded bg-gray-200">{""}</div>
					<div className="mb-8 h-4 w-2/3 rounded bg-gray-200">{""}</div>
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-24 rounded bg-gray-200">
								{""}
							</div>
						))}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
			{/* Left Column: Settings & AI Generation */}
			<div className="space-y-6">
				<Card>
					<Accordion
						type="single"
						collapsible
						value={isDesktopSettingsOpen ? "settings" : ""}
						onValueChange={(v) => setIsDesktopSettingsOpen(v === "settings")}
					>
						<AccordionItem value="settings">
							<AccordionTrigger className="px-3 py-3 hover:no-underline">
								<div className="flex items-center gap-2">
									<Settings className="h-4 w-4" />
									{isDesktopSettingsOpen ? (
										<span>Interview Settings</span>
									) : (
										<span>
											{purpose.charAt(0).toUpperCase() + purpose.slice(1)} {timeMinutes}m
										</span>
									)}
								</div>
							</AccordionTrigger>
							<AccordionContent>
								<CardContent className="space-y-4">
									<div className="space-y-4">
										<div>
											<label className="mb-3 block text-sm">Available Time: {timeMinutes} minutes</label>
											<Slider
												value={[timeMinutes]}
												onValueChange={(v) => setTimeMinutes(v[0])}
												max={60}
												min={15}
												step={15}
												className="w-full"
											/>
											<div className="mt-1 flex justify-between text-gray-500 text-xs">
												<span>15m</span>
												<span>30m</span>
												<span>45m</span>
												<span>60m</span>
											</div>
										</div>

										<div>
											<label className="mb-2 block text-sm">Interview Purpose</label>
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
											<label className="mb-2 block text-sm">Participant Familiarity</label>
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
										{/*
										<div className="flex items-center justify-between">
											<label className="text-sm">Go Deep Quick Mode</label>
											<Switch checked={goDeepMode} onCheckedChange={setGoDeepMode} />
										</div> */}
									</div>
								</CardContent>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</Card>

				<Card>
					<CardContent className="space-y-3 p-3">
						{showCustomInstructions && (
							<Textarea
								placeholder="Modify questions"
								value={customInstructions}
								onChange={(e) => setCustomInstructions(e.target.value)}
								rows={3}
							/>
						)}
						<div className="flex gap-2">
							<Button onClick={generateQuestions} disabled={generating} variant="outline" className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50">
								{generating ? (
									<>
										<div className="mr-2 h-4 w-4 animate-spin rounded-full border-current border-b-2" /> Generating
										Questions...
									</>
								) : (
									<>
										<Brain className="mr-2 h-4 w-4" /> Generate New Questions
									</>
								)}
							</Button>
							<Button
								onClick={() => setShowCustomInstructions(!showCustomInstructions)}
								variant="outline"
								size="icon"
								className="shrink-0"
							>
								<ChevronDown className={`h-4 w-4 transition-transform ${showCustomInstructions ? "rotate-180" : ""}`} />
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="space-y-3 p-3">
						{showAddCustomQuestion ? (
							<div className="space-y-3">
								<Textarea
									placeholder="Enter your custom question..."
									value={newQuestionText}
									onChange={(e) => setNewQuestionText(e.target.value)}
									rows={3}
								/>
								<Select value={newQuestionCategory} onValueChange={setNewQuestionCategory}>
									<SelectTrigger>
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
								<div className="flex gap-2">
									<Button
										onClick={addCustomQuestion}
										disabled={!newQuestionText.trim() || addingCustomQuestion}
										variant="default"
										className="flex flex-1 items-center gap-2"
									>
										{addingCustomQuestion ? (
											<>
												<div className="mr-2 h-4 w-4 animate-spin rounded-full border-current border-b-2" />
												Evaluating Quality...
											</>
										) : (
											<>
												<Plus className="h-4 w-4" />
												<Brain className="h-4 w-4" />
												Add Question (with Quality Check)
											</>
										)}
									</Button>
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
								</div>
							</div>
						) : (
							<Button onClick={() => setShowAddCustomQuestion(true)} variant="outline" className="w-full border-blue-500 text-blue-600 hover:bg-blue-50">
								<MessageCircleQuestion className="mr-2 h-4 w-4" /> Add Custom Question
							</Button>
						)}
					</CardContent>
				</Card>

				<Button
					onClick={() => {
						if (routes) {
							window.location.href = routes.interviews.upload()
						}
					}}
					variant="outline"
					disabled={questionPack.questions.length === 0}
					className="border-blue-500 text-blue-600 hover:bg-blue-50"
				>
					Add Interview
				</Button>
			</div>

			{/* Right Column: Question Pack */}
			<div className="space-y-6 lg:col-span-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span>Your Question Pack ({questionPack.questions.length})</span>
					</div>
					<div className="text-right">
						<div
							className={`font-medium text-sm ${questionPack.totalEstimatedTime > questionPack.targetTime ? "text-red-600" : "text-green-600"}`}
						>
							{Math.round(questionPack.totalEstimatedTime)}m / {questionPack.targetTime}m
						</div>
					</div>
				</div>
				<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
					<CardContent className="p-3 sm:p-4">
						<DragDropContext onDragEnd={onDragEnd}>
							<Droppable droppableId="question-pack">
								{(provided) => (
									<div className="space-y-4" {...provided.droppableProps} ref={provided.innerRef}>
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
																<Card
																	className={`border-0 shadow-none sm:rounded-xl sm:border sm:border-l-4 sm:shadow-sm ${fitsInTime ? "sm:border-l-blue-500" : "bg-orange-50/30 sm:border-l-orange-500 dark:bg-orange-950/30"}`}
																>
																	<CardContent className="p-3 sm:p-4">
																		<div className="flex items-start gap-3">
																			<div className="mt-0.5 flex items-center gap-2">
																				<div {...provided.dragHandleProps}>
																					<GripVertical className="h-4 w-4 cursor-grab text-gray-400 active:cursor-grabbing" />
																				</div>
																				<Badge variant="outline" className="text-foreground/50 text-xs">
																					{index + 1}
																				</Badge>
																			</div>
																			<div className="min-w-0 flex-1">
																				<div className="flex flex-wrap items-center gap-2">
																					<Badge variant="outline" className={getCategoryColor(question.categoryId)}>
																						{questionCategories.find((c) => c.id === question.categoryId)?.name ||
																							question.categoryId
																								?.replace(/[-_]/g, " ")
																								.replace(/\b\w/g, (m) => m.toUpperCase()) ||
																							"Other"}
																					</Badge>
																					<Badge variant="outline" className="text-muted-foreground text-xs">
																						~{Math.round(question.estimatedMinutes)}m
																					</Badge>
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
																								const updated = questions.map((q) =>
																									q.id === question.id ? { ...q, text: editingText } : q
																								)
																								setQuestions(updated)
																								setSkipDebounce(true)
																								await saveQuestionsToDatabase(updated, selectedQuestionIds)
																								setTimeout(() => setSkipDebounce(false), 1500)
																								setEditingId(null)
																								setEditingText("")
																							}}
																							className="text-green-600"
																						>
																							<Check className="h-4 w-4" />
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
																				<Button
																					variant="ghost"
																					size="sm"
																					onClick={() => setEditingId(question.id) || setEditingText(question.text)}
																					className="text-gray-500 hover:text-gray-700"
																				>
																					<Pencil className="h-4 w-4" />
																				</Button>
																			</div>
																			<Button
																				variant="ghost"
																				size="sm"
																				onClick={() => removeQuestion(question.id)}
																				className="text-red-500 hover:text-red-700"
																			>
																				<Trash2 className="h-4 w-4" />
																			</Button>
																		</div>
																	</CardContent>
																</Card>
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
									<Button
										variant="outline"
										onClick={() => setShowAllQuestions(!showAllQuestions)}
										className="mb-4 w-full"
									>
										<MoreHorizontal className="mr-2 h-4 w-4" /> {showAllQuestions ? "Hide" : "Show"} Additional
										Questions ({questionPack.remainingQuestions.length})
									</Button>

									{showAllQuestions && (
										<div className="mt-4 space-y-3">
											<p className="text-gray-600 text-sm">
												Additional questions below the line - click to include in your pack:
											</p>
											{questionPack.remainingQuestions.map((question) => (
												<Card
													key={question.id}
													className="border-0 py-2 shadow-none sm:rounded-xl sm:border sm:border-gray-300 sm:border-dashed sm:shadow-sm"
												>
													<CardContent className="p-3 sm:p-4">
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
																	<Badge variant="outline" className={getCategoryColor(question.categoryId)}>
																		{questionCategories.find((c) => c.id === question.categoryId)?.name ||
																			question.categoryId
																				?.replace(/[-_]/g, " ")
																				.replace(/\b\w/g, (m) => m.toUpperCase()) ||
																			"Other"}
																	</Badge>
																	<Badge variant="outline" className="text-muted-foreground text-xs">
																		~
																		{Math.round((question as unknown as { estimatedMinutes: number }).estimatedMinutes)}
																		m
																	</Badge>
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
																		<Badge className={getAnsweredCountColor(question.timesAnswered)} variant="outline">
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
																{question.qualityFlag && (
																	<QualityFlag qualityFlag={question.qualityFlag} />
																)}
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
											))}
										</div>
									)}
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

export default InterviewQuestionsManager
