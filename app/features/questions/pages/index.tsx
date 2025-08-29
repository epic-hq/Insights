import consola from "consola"
import React, { useState, useMemo, useCallback, useEffect } from "react"
import { useLoaderData, useParams } from "react-router-dom"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Slider } from "~/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"
import { Switch } from "~/components/ui/switch"
import {
	Clock,
	Plus,
	Trash2,
	Brain,
	CheckCircle,
	GripVertical,
	Play,
	MoreHorizontal,
	Settings,
	BookOpen,
} from "lucide-react"
import { createClient } from "~/lib/supabase/client"
import { useCurrentProject } from "~/contexts/current-project-context"
import type { LoaderFunctionArgs } from "react-router"

// Question categories with weights
const questionCategories = [
	{ id: "context", name: "Context & Background", weight: 1.0, description: "Understanding user's current situation" },
	{
		id: "pain",
		name: "Pain Points & Problems",
		weight: 1.2,
		description: "Identifying key challenges and frustrations",
	},
	{ id: "workflow", name: "Workflow & Behavior", weight: 1.1, description: "How users currently work and behave" },
	{ id: "goals", name: "Goals & Motivations", weight: 1.0, description: "What users want to achieve" },
	{ id: "constraints", name: "Constraints & Barriers", weight: 0.9, description: "What holds users back" },
	{
		id: "willingness",
		name: "Willingness to Pay",
		weight: 0.8,
		description: "Value perception and pricing sensitivity",
	},
]

interface Question {
	id: string
	text: string
	categoryId: string
	scores: { importance: number; goalMatch: number; novelty: number }
	rationale?: string
	status: "proposed" | "asked" | "answered" | "skipped"
	timesAnswered: number
}

type Purpose = "exploratory" | "validation" | "followup"
type Familiarity = "cold" | "warm"

export async function loader({ params }: LoaderFunctionArgs) {
	const { accountId, projectId } = params

	if (!accountId || !projectId) {
		consola.log("ERROR: Missing account or project ID", params)
		throw new Response("Missing account or project ID", { status: 400 })
	}

	consola.log("Questions loader called with:", { accountId, projectId })
	return { accountId, projectId }
}

export default function QuestionsIndex() {
	const { accountId, projectId } = useLoaderData<typeof loader>()
	consola.log("QuestionsIndex component mounted with:", { accountId, projectId })

	const [timeMinutes, setTimeMinutes] = useState(30)
	const [purpose, setPurpose] = useState<Purpose>("exploratory")
	const [familiarity, setFamiliarity] = useState<Familiarity>("cold")
	const [goDeepMode, setGoDeepMode] = useState(false)
	const [questions, setQuestions] = useState<Question[]>([])
	const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
	const [hasInitialized, setHasInitialized] = useState(false)
	const [showAllQuestions, setShowAllQuestions] = useState(false)
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState(true)
	const [customInstructions, setCustomInstructions] = useState("")
	const [loading, setLoading] = useState(true)
	const [generating, setGenerating] = useState(false)

	const supabase = createClient()

	// Load questions from project_sections
	useEffect(() => {
		const loadQuestions = async () => {
			if (!projectId) return

			try {
				// Get questions section
				const { data: questionsSection, error: sectionError } = await supabase
					.from("project_sections")
					.select("*")
					.eq("project_id", projectId)
					.eq("kind", "questions")
					.order("created_at", { ascending: false })
					.limit(1)
					.single()

				if (sectionError && sectionError.code !== "PGRST116") throw sectionError

				// Get answer counts for questions
				const { data: answerCounts, error: countsError } = await supabase
					.from("project_answers")
					.select("question_id, status")
					.eq("project_id", projectId)

				if (countsError) throw countsError

				// Count answers per question
				const answerCountMap = new Map<string, number>()
				answerCounts?.forEach((answer) => {
					if (answer.status === "answered") {
						const count = answerCountMap.get(answer.question_id || "") || 0
						answerCountMap.set(answer.question_id || "", count + 1)
					}
				})

				// Parse questions from meta field
				const questionsData = questionsSection?.meta?.questions || []
				const formattedQuestions: Question[] = questionsData.map((q: unknown, index: number) => {
					const question = q as Record<string, unknown>
					return {
						id: (question.id as string) || `q_${index}`,
						text: (question.text as string) || (question.question as string),
						categoryId: (question.categoryId as string) || (question.category as string) || "context",
						scores: {
							importance: (question.scores as any)?.importance || (question.importance as number) || 0.5,
							goalMatch: (question.scores as any)?.goalMatch || (question.goalMatch as number) || 0.5,
							novelty: (question.scores as any)?.novelty || (question.novelty as number) || 0.5,
						},
						rationale: (question.rationale as string) || "",
						status: (question.status as Question["status"]) || "proposed",
						timesAnswered: answerCountMap.get((question.id as string) || `q_${index}`) || 0,
					}
				})

				// Load selected question order if it exists
				const selectedQuestionsWithOrder = questionsData
					.filter((q: any) => q.isSelected === true)
					.sort((a: any, b: any) => (a.selectedOrder || 0) - (b.selectedOrder || 0))
					.map((q: any) => q.id as string)

				setQuestions(formattedQuestions)
				if (selectedQuestionsWithOrder.length > 0) {
					setSelectedQuestionIds(selectedQuestionsWithOrder)
					setHasInitialized(true)
				}
			} catch (error) {
				console.error("Error loading questions:", error)
			} finally {
				setLoading(false)
			}
		}

		loadQuestions()
	}, [projectId, supabase])

	// Calculate time estimates per question
	const estimateMinutesPerQuestion = (q: Question, purpose: Purpose, familiarity: Familiarity): number => {
		const baseTimes = {
			exploratory: 6.5,
			validation: 4.5,
			followup: 3.5,
		}

		const categoryAdjustments = {
			pain: 0.5,
			workflow: 0.5,
			goals: 0.25,
			willingness: 0.25,
			constraints: 0,
			context: 0,
		}

		const familiarityAdjustment = familiarity === "warm" ? -0.5 : familiarity === "cold" ? 0.5 : 0

		const baseTime = baseTimes[purpose]
		const categoryAdj = categoryAdjustments[q.categoryId as keyof typeof categoryAdjustments] || 0

		return Math.max(2.5, baseTime + categoryAdj + familiarityAdjustment)
	}

	// Calculate composite score for question prioritization
	const calculateCompositeScore = (q: Question): number => {
		const categoryWeight = questionCategories.find((c) => c.id === q.categoryId)?.weight || 1
		const scores = q.scores
		return (
			(0.5 * (scores.importance || 0) + 0.35 * (scores.goalMatch || 0) + 0.15 * (scores.novelty || 0)) * categoryWeight
		)
	}

	// Build question pack based on time and constraints
	const questionPack = useMemo(() => {
		const targetCounts = {
			15: { base: 3, validation: +1, cold: -1 },
			30: { base: 5, validation: +1, cold: -1 },
			45: { base: 7, validation: +1, cold: -1 },
			60: { base: 9, validation: +1, cold: -1 },
		}

		const targetCount = Math.max(
			2,
			targetCounts[timeMinutes as keyof typeof targetCounts].base +
				(purpose === "validation" ? targetCounts[timeMinutes as keyof typeof targetCounts].validation : 0) +
				(familiarity === "cold" ? targetCounts[timeMinutes as keyof typeof targetCounts].cold : 0)
		)

		const allQuestionsWithScores = questions
			.filter((q) => q.status === "proposed")
			.map((q) => ({
				...q,
				compositeScore: calculateCompositeScore(q),
				estimatedMinutes: estimateMinutesPerQuestion(q, purpose, familiarity),
			}))

		// If no manual selection, use algorithm
		let autoSelectedIds: string[] = []
		if (selectedQuestionIds.length === 0) {
			// Go Deep Mode: Start with top 3 highest value questions
			let selectedQuestions = []
			if (goDeepMode) {
				selectedQuestions = [...allQuestionsWithScores]
					.sort((a, b) => b.compositeScore - a.compositeScore)
					.slice(0, Math.min(3, targetCount))
			}

			// Category balancing and remaining selection logic
			const categoryMap = new Map<string, typeof allQuestionsWithScores>()
			for (const q of allQuestionsWithScores) {
				if (!categoryMap.has(q.categoryId)) {
					categoryMap.set(q.categoryId, [])
				}
				categoryMap.get(q.categoryId)!.push(q)
			}

			for (const categoryQuestions of categoryMap.values()) {
				categoryQuestions.sort((a, b) => b.compositeScore - a.compositeScore)
			}

			const priorityCategories = ["context", "pain", "workflow"]
			for (const categoryId of priorityCategories) {
				const categoryQuestions = categoryMap.get(categoryId) || []
				const alreadySelected = selectedQuestions.find((q) => q.categoryId === categoryId)

				if (!alreadySelected && categoryQuestions.length > 0 && selectedQuestions.length < targetCount) {
					const best = categoryQuestions[0]
					if (!selectedQuestions.find((q) => q.id === best.id)) {
						selectedQuestions.push(best)
					}
				}
			}

			const remainingQuestions = allQuestionsWithScores
				.filter((q) => !selectedQuestions.find((s) => s.id === q.id))
				.sort((a, b) => b.compositeScore - a.compositeScore)

			let currentBudget = timeMinutes
			for (const q of selectedQuestions) {
				currentBudget -= q.estimatedMinutes
			}

			for (const q of remainingQuestions) {
				if (selectedQuestions.length >= targetCount) break
				if (currentBudget - q.estimatedMinutes < 0) continue

				selectedQuestions.push(q)
				currentBudget -= q.estimatedMinutes
			}

			autoSelectedIds = selectedQuestions.map((q) => q.id)
			// Set the initial selection only once
			if (!hasInitialized && selectedQuestionIds.length === 0) {
				setSelectedQuestionIds(autoSelectedIds)
				setHasInitialized(true)
			}
		}

		// Get the actually selected questions in order
		const idsToUse = selectedQuestionIds.length > 0 ? selectedQuestionIds : autoSelectedIds
		const orderedSelectedQuestions = idsToUse
			.map((id) => {
				const found = allQuestionsWithScores.find((q) => q.id === id)
				if (!found) {
					consola.log(
						"WARNING: Question not found for id:",
						id,
						"Available question ids:",
						allQuestionsWithScores.map((q) => q.id)
					)
				}
				return found
			})
			.filter(Boolean) as (Question & { compositeScore: number; estimatedMinutes: number })[]

		if (idsToUse.length !== orderedSelectedQuestions.length) {
			consola.log("MISMATCH: Selected IDs vs Found Questions", {
				selectedIds: idsToUse,
				foundQuestions: orderedSelectedQuestions.map((q) => q.id),
				allAvailableIds: allQuestionsWithScores.map((q) => q.id),
			})
		}

		const totalEstimatedTime = orderedSelectedQuestions.reduce((sum, q) => sum + q.estimatedMinutes, 0)

		return {
			questions: orderedSelectedQuestions,
			totalEstimatedTime,
			targetTime: timeMinutes,
			remainingQuestions: allQuestionsWithScores.filter((q) => !orderedSelectedQuestions.find((s) => s.id === q.id)),
		}
	}, [timeMinutes, purpose, familiarity, goDeepMode, questions, selectedQuestionIds, hasInitialized])

	// Debug logging for state changes
	useEffect(() => {
		consola.log("STATE UPDATE:", {
			questionsCount: questions.length,
			selectedQuestionIds: selectedQuestionIds,
			questionPackCount: questionPack.questions.length,
			hasInitialized,
			questionPackQuestionIds: questionPack.questions.map((q) => q.id),
		})
	}, [questions, selectedQuestionIds, questionPack.questions.length, hasInitialized])

	// Save questions with selection order to database
	const saveQuestionsToDatabase = useCallback(
		async (questionsToSave: Question[], selectedIds: string[]) => {
			if (!projectId) return

			try {
				// Create questions array with selection order
				const questionsWithOrder = questionsToSave.map((q, index) => {
					const selectedIndex = selectedIds.indexOf(q.id)
					return {
						...q,
						status: "proposed", // Ensure status is preserved
						selectedOrder: selectedIndex >= 0 ? selectedIndex : null,
						isSelected: selectedIndex >= 0,
					}
				})

				const { error } = await supabase.from("project_sections").upsert(
					{
						project_id: projectId,
						kind: "questions",
						content_md: `# Interview Questions\n\nManaged ${questionsWithOrder.length} questions for interview planning.`,
						meta: { questions: questionsWithOrder },
					},
					{
						onConflict: "project_id,kind",
						ignoreDuplicates: false,
					}
				)

				if (error) {
					consola.log("Error saving questions:", error)
				}
			} catch (error) {
				consola.log("Error saving questions to database:", error)
			}
		},
		[projectId, supabase]
	)

	const removeQuestion = useCallback(
		async (id: string) => {
			const newSelectedQuestionIds = selectedQuestionIds.filter((qId) => qId !== id)
			setSelectedQuestionIds(newSelectedQuestionIds)

			// Persist to database immediately
			await saveQuestionsToDatabase(questions, newSelectedQuestionIds)
			consola.log("Removed question, new selection:", newSelectedQuestionIds)
		},
		[selectedQuestionIds, questions, saveQuestionsToDatabase]
	)

	const moveQuestion = useCallback(
		async (fromIndex: number, toIndex: number) => {
			// Use the same logic as questionPack to get the current array
			const currentIds = selectedQuestionIds.length > 0 ? selectedQuestionIds : questionPack.questions.map((q) => q.id)

			consola.log(
				"Moving question from",
				fromIndex,
				"to",
				toIndex,
				"current selection:",
				selectedQuestionIds,
				"actual current:",
				currentIds
			)

			const newSelectedQuestionIds = [...currentIds]
			const [removed] = newSelectedQuestionIds.splice(fromIndex, 1)
			newSelectedQuestionIds.splice(toIndex, 0, removed)

			consola.log("New selection order:", newSelectedQuestionIds)
			setSelectedQuestionIds(newSelectedQuestionIds)
			setHasInitialized(true) // Ensure we're initialized after manual interaction

			// Persist to database immediately
			await saveQuestionsToDatabase(questions, newSelectedQuestionIds)
		},
		[selectedQuestionIds, questionPack.questions, questions, saveQuestionsToDatabase]
	)

	const onDragEnd = (result: any) => {
		consola.log("Drag ended:", result)

		if (!result.destination) {
			consola.log("No destination, drag cancelled")
			return
		}

		const sourceIndex = result.source.index
		const destinationIndex = result.destination.index

		consola.log("Drag from", sourceIndex, "to", destinationIndex)

		if (sourceIndex !== destinationIndex) {
			moveQuestion(sourceIndex, destinationIndex)
		}
	}

	const addQuestionFromReserve = useCallback(
		async (question: Question) => {
			if (selectedQuestionIds.includes(question.id)) return

			// If this is the first manual selection, seed with the current auto-selected pack
			const baseIds =
				selectedQuestionIds.length > 0
					? selectedQuestionIds
					: (questionPack.questions.map((q) => q.id))

			const newSelectedQuestionIds = [...baseIds, question.id]
			setSelectedQuestionIds(newSelectedQuestionIds)
			setHasInitialized(true)

			// Persist to database immediately
			await saveQuestionsToDatabase(questions, newSelectedQuestionIds)
			consola.log("Added question from reserve, seeded selection if needed. New selection:", newSelectedQuestionIds)
		},
		[selectedQuestionIds, questionPack.questions, questions, saveQuestionsToDatabase]
	)

	const getCategoryColor = (categoryId: string) => {
		const colors = {
			context: "bg-blue-100 text-blue-800",
			pain: "bg-red-100 text-red-800",
			workflow: "bg-purple-100 text-purple-800",
			goals: "bg-green-100 text-green-800",
			constraints: "bg-yellow-100 text-yellow-800",
			willingness: "bg-orange-100 text-orange-800",
		}
		return colors[categoryId as keyof typeof colors] || "bg-gray-100 text-gray-800"
	}

	const getAnsweredCountColor = (count: number) => {
		if (count === 0) return "bg-transparent text-gray-600"
		if (count <= 3) return "bg-transparent text-yellow-600"
		if (count <= 10) return "bg-transparent text-green-600"
		return "bg-transparent text-blue-600"
	}

	const generateQuestions = async () => {
		if (!projectId || generating) return

		setGenerating(true)
		try {
			// Get project sections for context
			const { data: sections } = await supabase.from("project_sections").select("*").eq("project_id", projectId)

			const goalSection = sections?.find((s) => s.kind === "goal")
			const icpSection = sections?.find((s) => s.kind === "target_market")
			const assumptionsSection = sections?.find((s) => s.kind === "assumptions")
			const unknownsSection = sections?.find((s) => s.kind === "unknowns")

			const formData = new FormData()
			formData.append("target_orgs", icpSection?.content_md || "B2B companies and organizations")
			formData.append("target_roles", "Product managers, decision makers, and end users")
			formData.append("research_goal", goalSection?.content_md || "Research user needs and validate assumptions")
			formData.append(
				"research_goal_details",
				"Understand user pain points, workflows, and willingness to pay for solutions"
			)
			formData.append(
				"assumptions",
				assumptionsSection?.content_md || "Users have current pain points that need solving"
			)
			formData.append(
				"unknowns",
				unknownsSection?.content_md || "What specific features users value most and their budget constraints"
			)
			formData.append("custom_instructions", customInstructions)
			formData.append("questionCount", "10")
			formData.append("interview_time_limit", timeMinutes.toString())

			const response = await fetch("/api/generate-questions", {
				method: "POST",
				body: formData,
			})

			if (response.ok) {
				const data = await response.json()
				if (data.success && data.questionSet?.questions) {
					// Use the complete questionSet structure
					const newQuestions = data.questionSet.questions

					// Save to project_sections with kind="questions"
					// Use the same format as saveQuestionsToDatabase to preserve selection data
					const existingQuestions = questions.map((q) => {
						const selectedIndex = selectedQuestionIds.indexOf(q.id)
						return {
							id: q.id,
							text: q.text,
							categoryId: q.categoryId,
							scores: q.scores,
							rationale: q.rationale,
							status: "proposed",
							selectedOrder: selectedIndex >= 0 ? selectedIndex : null,
							isSelected: selectedIndex >= 0,
						}
					})

					const allQuestions = [...existingQuestions, ...newQuestions]

					const { error: upsertError } = await supabase.from("project_sections").upsert(
						{
							project_id: projectId,
							kind: "questions",
							content_md: `# Interview Questions\n\nGenerated ${allQuestions.length} questions for interview planning.`,
							meta: { questions: allQuestions },
						},
						{
							onConflict: "project_id,kind",
							ignoreDuplicates: false,
						}
					)

					if (!upsertError) {
						// Add to local state
						const formattedNewQuestions: Question[] = newQuestions.map((q: any) => ({
							id: q.id || crypto.randomUUID(),
							text: q.text,
							categoryId: q.categoryId || "context",
							scores: q.scores || { importance: 0.5, goalMatch: 0.5, novelty: 0.5 },
							rationale: q.rationale || "",
							status: "proposed",
							timesAnswered: 0,
						}))

						// Add new questions to the bottom of the available list (not selected by default)
						setQuestions((prev) => [...prev, ...formattedNewQuestions])

						// Show success toast notification
						toast.success(`Added ${formattedNewQuestions.length} new questions to the bottom of your available list`, {
							description: "You can now select them to add to your question pack",
							duration: 4000,
						})
					}
				}
			}
		} catch (error) {
			consola.log("Error generating questions:", error)
		} finally {
			setGenerating(false)
		}
	}

	if (loading) {
		return (
			<div className="p-4 sm:p-8 max-w-6xl mx-auto">
				<div className="animate-pulse">
					<div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
					<div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-24 bg-gray-200 rounded"></div>
						))}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="p-4 sm:p-8 max-w-7xl mx-auto">
			<div className="mb-6 sm:mb-8">
				<h1 className="text-2xl sm:text-3xl mb-2 flex items-center gap-2">
					<BookOpen className="h-8 w-8" />
					Interview Questions
				</h1>
				<p className="text-gray-600">
					Manage and plan your interview questions with time-optimized selection based on research best practices.
				</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Left Column: Settings & AI Generation */}
				<div className="space-y-6">
					{/* Settings and Controls */}
					<Card>
						<Accordion
							type="single"
							collapsible
							value={isDesktopSettingsOpen ? "settings" : ""}
							onValueChange={(value) => setIsDesktopSettingsOpen(value === "settings")}
						>
							<AccordionItem value="settings">
								<AccordionTrigger className="hover:no-underline px-3 py-0">
									<div className="flex items-center gap-2">
										<Settings className="w-5 h-5" />
										Interview Settings
									</div>
								</AccordionTrigger>
								<AccordionContent>
									<CardContent className="space-y-4">
										<div className="space-y-4">
											<div>
												<label className="block text-sm mb-3">Available Time: {timeMinutes} minutes</label>
												<Slider
													value={[timeMinutes]}
													onValueChange={(value) => setTimeMinutes(value[0])}
													max={60}
													min={15}
													step={15}
													className="w-full"
												/>
												<div className="flex justify-between text-xs text-gray-500 mt-1">
													<span>15m</span>
													<span>30m</span>
													<span>45m</span>
													<span>60m</span>
												</div>
											</div>

											<div>
												<label className="block text-sm mb-2">Interview Purpose</label>
												<Select value={purpose} onValueChange={(value: Purpose) => setPurpose(value)}>
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
												<label className="block text-sm mb-2">Participant Familiarity</label>
												<Select value={familiarity} onValueChange={(value: Familiarity) => setFamiliarity(value)}>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="cold">Cold (first interaction)</SelectItem>
														<SelectItem value="warm">Warm (established rapport)</SelectItem>
													</SelectContent>
												</Select>
											</div>

											<div className="flex items-center justify-between">
												<label className="text-sm">Go Deep Quick Mode</label>
												<Switch checked={goDeepMode} onCheckedChange={setGoDeepMode} />
											</div>
										</div>
									</CardContent>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</Card>

					{/* AI Generate Questions */}
					<Card>
						<CardContent className="p-3 space-y-3">
							<Textarea
								placeholder="Modify questions"
								value={customInstructions}
								onChange={(e) => setCustomInstructions(e.target.value)}
								rows={3}
							/>
							<Button onClick={generateQuestions} disabled={generating} variant="outline" className="w-full">
								{generating ? (
									<>
										<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
										Generating Questions...
									</>
								) : (
									<>
										<Brain className="w-4 h-4 mr-2" />
										Generate New Questions
									</>
								)}
							</Button>
						</CardContent>
					</Card>

					{/* Start Interview */}
					<Button size="lg" className="w-full">
						<Play className="w-5 h-5 mr-2" />
						Upload New Interview
					</Button>
				</div>

				{/* Right Column: Question Pack */}
				<div className="lg:col-span-2 space-y-6">
					{/* Question Pack */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span>Your Question Pack ({questionPack.questions.length})</span>
								</div>
								<div className="text-right">
									<div
										className={`text-sm font-medium ${
											questionPack.totalEstimatedTime > questionPack.targetTime ? "text-red-600" : "text-green-600"
										}`}
									>
										{Math.round(questionPack.totalEstimatedTime)}m / {questionPack.targetTime}m
									</div>
									{/* {questionPack.totalEstimatedTime > questionPack.targetTime && (
										<div className="text-xs text-red-600">
											Consider removing {Math.ceil((questionPack.totalEstimatedTime - questionPack.targetTime) / 4)}{" "}
											questions
										</div>
									)} */}
								</div>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<DragDropContext onDragEnd={onDragEnd}>
								<Droppable droppableId="question-pack">
									{(provided) => (
										<div className="space-y-4" {...provided.droppableProps} ref={provided.innerRef}>
											{questionPack.questions.map((question, index) => {
												// Calculate running time to determine if this question fits
												const runningTime = questionPack.questions
													.slice(0, index + 1)
													.reduce((sum, q) => sum + q.estimatedMinutes, 0)
												const fitsInTime = runningTime <= timeMinutes
												const isFirstOverflow =
													!fitsInTime &&
													(index === 0 ||
														questionPack.questions.slice(0, index).reduce((sum, q) => sum + q.estimatedMinutes, 0) <=
															timeMinutes)

												return (
													<React.Fragment key={question.id}>
														{isFirstOverflow && (
															<div className="border-t-2 border-dashed border-orange-300 pt-4 mt-6">
																<div className="flex items-center gap-2 mb-4">
																	<Clock className="w-4 h-4 text-orange-600" />
																	<span className="text-sm font-medium text-orange-600">
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
																		className={`border-l-4 ${
																			fitsInTime
																				? "border-l-blue-500"
																				: "border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/30"
																		}`}
																	>
																		<CardContent className="px-3">
																			<div className="flex items-start gap-3">
																				<div className="flex items-center gap-2 mt-0.5">
																					<div {...provided.dragHandleProps}>
																						<GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
																					</div>
																					<Badge variant="outline" className="text-xs">
																						#{index + 1}
																					</Badge>
																				</div>

																				<div className="flex-1 min-w-0">
																					<p
																						className="text-sm font-medium leading-relaxed mb-2"
																						title={question.rationale ? `Why: ${question.rationale}` : undefined}
																					>
																						{question.text}
																					</p>

																					<div className="flex items-center gap-2 flex-wrap">
																						<Badge className={getCategoryColor(question.categoryId)}>
																							{questionCategories.find((c) => c.id === question.categoryId)?.name}
																						</Badge>
																						<Badge variant="outline" className="text-xs">
																							~{Math.round(question.estimatedMinutes)}m
																						</Badge>
																						<Badge
																							className={getAnsweredCountColor(question.timesAnswered)}
																							variant="outline"
																						>
																							{question.timesAnswered}x answered
																						</Badge>
																						{goDeepMode && index < 3 && (
																							<Badge className="bg-yellow-100 text-yellow-800 text-xs">
																								Power Question
																							</Badge>
																						)}
																					</div>
																				</div>

																				<Button
																					variant="ghost"
																					size="sm"
																					onClick={() => removeQuestion(question.id)}
																					className="text-red-500 hover:text-red-700"
																				>
																					<Trash2 className="w-4 h-4" />
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

							{/* Show More Questions */}
							{questionPack.remainingQuestions.length > 0 && (
								<div className="mt-6">
									<div className="border-t pt-4">
										<Button
											variant="outline"
											onClick={() => setShowAllQuestions(!showAllQuestions)}
											className="w-full mb-4"
										>
											<MoreHorizontal className="w-4 h-4 mr-2" />
											{showAllQuestions ? "Hide" : "Show"} Additional Questions (
											{questionPack.remainingQuestions.length})
										</Button>

										{showAllQuestions && (
											<div className="mt-4 space-y-3">
												<p className="text-sm text-gray-600">
													Additional questions below the line - click to include in your pack:
												</p>
												{questionPack.remainingQuestions.map((question, index) => (
													<Card
														key={question.id}
														className="border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors py-2"
														onClick={() => addQuestionFromReserve(question)}
													>
														<CardContent className="p-3">
															<div className="flex items-start gap-3">
																<div className="flex items-center gap-2 mt-1">
																	<GripVertical className="w-4 h-4 text-gray-400" />
																	<Plus className="w-4 h-4 text-gray-400" />
																</div>

																<div className="flex-1 min-w-0">
																	<p
																		className="text-sm leading-relaxed"
																		title={question.rationale ? `Why: ${question.rationale}` : undefined}
																	>
																		{question.text}
																	</p>
																	<div className="flex items-center gap-2 mb-2 flex-wrap">
																		<Badge className={getCategoryColor(question.categoryId)} variant="outline">
																			{questionCategories.find((c) => c.id === question.categoryId)?.name}
																		</Badge>
																		<Badge variant="outline" className="text-xs">
																			~{Math.round(question.estimatedMinutes)}m
																		</Badge>
																		<Badge className={getAnsweredCountColor(question.timesAnswered)} variant="outline">
																			{question.timesAnswered}x answered
																		</Badge>
																	</div>
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
		</div>
	)
}
