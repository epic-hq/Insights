// integrate these changes into InterviewQuestionsManager.tsx

import { ChevronLeft, ChevronRight, BookOpen, Settings, Brain, Play } from "lucide-react"
import { useState, useMemo, useCallback, useEffect } from "react"
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
import { Trash2, Plus, Clock, MoreHorizontal, GripVertical } from "lucide-react"

// Use the same types and logic as QuestionsIndex
type Purpose = "exploratory" | "validation" | "followup"
type Familiarity = "cold" | "warm"

interface Question {
	id: string
	text: string
	categoryId: string
	scores: {
		importance: number
		goalMatch: number
		novelty: number
	}
	rationale?: string
	status: "proposed" | "shown" | "rejected" | "asked" | "answered"
	estimatedMinutes: number
	timesAnswered: number
}

interface QuestionsScreenProps {
	target_orgs: string[]
	target_roles: string[]
	research_goal: string
	research_goal_details: string
	assumptions: string[]
	unknowns: string[]
	custom_instructions?: string
	onNext: (questions: string[]) => void
	onBack: () => void
}

const questionCategories = [
	{
		id: "context",
		name: "Context & Background",
		color: "border-blue-100 text-blue-800 dark:border-blue-900 dark:text-blue-200",
		colorVariant: "blue",
	},
	{
		id: "goals",
		name: "Goals & Outcomes",
		color: "border-green-100 text-green-800 dark:border-green-900 dark:text-green-200",
		colorVariant: "green",
	},
	{
		id: "pain",
		name: "Pain Points",
		color: "border-red-100 text-red-800 dark:border-red-900 dark:text-red-200",
		colorVariant: "red",
	},
	{
		id: "workflow",
		name: "Workflow & Process",
		color: "border-purple-100 text-purple-800 dark:border-purple-900 dark:text-purple-200",
		colorVariant: "purple",
	},
	{
		id: "motivation",
		name: "Motivation & Drivers",
		color: "border-yellow-100 text-yellow-800 dark:border-yellow-900 dark:text-yellow-200",
		colorVariant: "yellow",
	},
	{
		id: "constraints",
		name: "Constraints & Barriers",
		color: "border-orange-100 text-orange-800 dark:border-orange-900 dark:text-orange-200",
		colorVariant: "orange",
	},
	{
		id: "willingness",
		name: "Willingness & Adoption",
		color: "border-indigo-100 text-indigo-800 dark:border-indigo-900 dark:text-indigo-200",
		colorVariant: "indigo",
	},
]

const questionCategoriesVariants = {
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

export default function QuestionsScreen({
	target_orgs,
	target_roles,
	research_goal,
	research_goal_details,
	assumptions,
	unknowns,
	onNext,
	onBack,
}: QuestionsScreenProps) {
	const [timeMinutes, setTimeMinutes] = useState(30)
	const [purpose, setPurpose] = useState<Purpose>("exploratory")
	const [familiarity, setFamiliarity] = useState<Familiarity>("cold")
	const [goDeepMode, setGoDeepMode] = useState(false)
	const [customInstructions, setCustomInstructions] = useState("")
	const [generating, setGenerating] = useState(false)
	const [questions, setQuestions] = useState<Question[]>([])
	const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
	const [hasInitialized, setHasInitialized] = useState(false)
	const [showAllQuestions, setShowAllQuestions] = useState(false)
	const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState(true)

	// Question pack logic (same as QuestionsIndex)
	const questionPack = useMemo(() => {
		const allQuestionsWithScores = questions.map((q) => ({
			...q,
			compositeScore: q.scores.importance * q.scores.goalMatch * (1 + q.scores.novelty),
			estimatedMinutes: q.estimatedMinutes || 4,
		}))

		const targetTime = timeMinutes * 0.8 // Use 80% of available time
		let autoSelectedIds: string[] = []

		if (!hasInitialized || selectedQuestionIds.length === 0) {
			// Auto-select questions that fit in time, prioritized by composite score
			const sortedQuestions = [...allQuestionsWithScores].sort((a, b) => b.compositeScore - a.compositeScore)

			let runningTime = 0
			for (const question of sortedQuestions) {
				if (runningTime + question.estimatedMinutes <= targetTime) {
					autoSelectedIds.push(question.id)
					runningTime += question.estimatedMinutes
				}
			}
		}

		// Get the actually selected questions in order
		const idsToUse = selectedQuestionIds.length > 0 ? selectedQuestionIds : autoSelectedIds
		const orderedSelectedQuestions = idsToUse
			.map((id) => allQuestionsWithScores.find((q) => q.id === id))
			.filter(Boolean) as (Question & { compositeScore: number; estimatedMinutes: number })[]

		const totalEstimatedTime = orderedSelectedQuestions.reduce((sum, q) => sum + q.estimatedMinutes, 0)

		return {
			questions: orderedSelectedQuestions,
			remainingQuestions: allQuestionsWithScores.filter((q) => !idsToUse.includes(q.id)),
			totalEstimatedTime,
			targetTime,
			selectedIdsUsed: idsToUse,
		}
	}, [timeMinutes, questions, selectedQuestionIds, hasInitialized])

	const removeQuestion = useCallback(
		async (id: string) => {
			const newSelectedQuestionIds = selectedQuestionIds.filter((qId) => qId !== id)
			setSelectedQuestionIds(newSelectedQuestionIds)
		},
		[selectedQuestionIds]
	)

	const moveQuestion = useCallback(
		async (fromIndex: number, toIndex: number) => {
			const currentIds = selectedQuestionIds.length > 0 ? selectedQuestionIds : questionPack.questions.map((q) => q.id)
			const newSelectedQuestionIds = [...currentIds]
			const [removed] = newSelectedQuestionIds.splice(fromIndex, 1)
			newSelectedQuestionIds.splice(toIndex, 0, removed)
			setSelectedQuestionIds(newSelectedQuestionIds)
			setHasInitialized(true)
		},
		[selectedQuestionIds, questionPack.questions]
	)

	const onDragEnd = (result: any) => {
		if (!result.destination) return
		const sourceIndex = result.source.index
		const destinationIndex = result.destination.index
		if (sourceIndex !== destinationIndex) {
			moveQuestion(sourceIndex, destinationIndex)
		}
	}

	const addQuestionFromReserve = useCallback(
		async (question: Question) => {
			if (!selectedQuestionIds.includes(question.id)) {
				// If nothing has been explicitly selected yet, seed with the current auto-selected ids
				const baseIds =
					selectedQuestionIds.length === 0 ? (questionPack.selectedIdsUsed as string[]) : selectedQuestionIds
				const newSelectedQuestionIds = baseIds.includes(question.id) ? baseIds : [...baseIds, question.id]
				setSelectedQuestionIds(newSelectedQuestionIds)
				setHasInitialized(true)
			}
		},
		[selectedQuestionIds, questionPack.selectedIdsUsed]
	)

	const getCategoryColor = (categoryId: string) => {
		const category = questionCategories.find((c) => c.id === categoryId)
		return category?.color || "bg-gray-100 text-gray-800"
	}

	const getCategoryColorVariant = (categoryId: string) => {
		const category = questionCategories.find((c) => c.id === categoryId)
		return category?.colorVariant || "bg-gray-100 text-gray-800"
	}

	const getAnsweredCountColor = (count: number) => {
		if (count === 0) return "bg-transparent text-gray-600"
		if (count <= 3) return "bg-transparent text-yellow-600"
		if (count <= 10) return "bg-transparent text-green-600"
		return "bg-transparent text-blue-600"
	}

	const generateQuestions = async () => {
		setGenerating(true)
		try {
			const response = await fetch("/api/generate-questions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					target_org: target_orgs.join(", "),
					target_roles: target_roles.join(", "),
					research_goal,
					research_goal_details,
					assumptions: assumptions.join(", "),
					unknowns: unknowns.join(", "),
					custom_instructions: customInstructions || undefined,
					interview_time_limit: timeMinutes,
					purpose,
					familiarity,
					go_deep_mode: goDeepMode,
				}),
			})

			if (response.ok) {
				const data = await response.json()
				if (data.success && data.questionSet?.questions?.length > 0) {
					const newQuestions = data.questionSet.questions

					const formattedNewQuestions = newQuestions.map((q: any) => ({
						id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						text: q.text,
						categoryId: q.categoryId || "context",
						scores: q.scores || { importance: 0.5, goalMatch: 0.5, novelty: 0.5 },
						rationale: q.rationale || "",
						status: "proposed",
						estimatedMinutes: q.estimatedMinutes || 4,
						timesAnswered: 0,
					}))

					setQuestions((prev) => [...prev, ...formattedNewQuestions])
					toast.success(`Added ${formattedNewQuestions.length} new questions to the bottom of your available list`, {
						description: "You can now select them to add to your question pack",
						duration: 4000,
					})
				}
			}
		} catch (error) {
			console.error("Error generating questions:", error)
		} finally {
			setGenerating(false)
		}
	}

	const handleNext = () => {
		const questionTexts = questionPack.questions.map((q) => q.text)
		onNext(questionTexts)
	}

	return (
		<div className= "p-4 sm:p-8 max-w-7xl mx-auto" >
		<div className="mb-6 sm:mb-8" >
			<h2 className="text-2xl sm:text-3xl mb-2 flex items-center gap-2" >
				<BookOpen className="h-8 w-8" />
					Interview Questions
						</h2>
						< p className = "text-gray-600" >
							Generate smart questions based on your research goals and customize your question pack.
				</p>
								</div>

								< div className = "grid grid-cols-1 lg:grid-cols-3 gap-8" >
									{/* Left Column: Settings & AI Generation */ }
									< div className = "space-y-6" >
										{/* Settings and Controls */ }
										< Card >
										<Accordion
							type="single"
	collapsible
	value = { isDesktopSettingsOpen? "settings": "" }
	onValueChange = {(value) => setIsDesktopSettingsOpen(value === "settings")
}
						>
	<AccordionItem value="settings" >
		<AccordionTrigger className="hover:no-underline px-3 py-4" >
			<div className="flex items-center gap-2" >
				<Settings className="w-5 h-5" />
					Interview Settings
						</div>
						</AccordionTrigger>
						< AccordionContent >
						<CardContent className="space-y-4" >
							<div className="space-y-4" >
								<div>
								<label className="block text-sm mb-3" > Available Time: { timeMinutes } minutes </label>
									< Slider
value = { [timeMinutes]}
onValueChange = {(value) => setTimeMinutes(value[0])}
max = { 60}
min = { 15}
step = { 15}
className = "w-full"
	/>
	<div className="flex justify-between text-xs text-gray-500 mt-1" >
		<span>15m </span>
			< span > 30m </span>
				< span > 45m </span>
					< span > 60m </span>
						</div>
						</div>

						< div >
						<label className="block text-sm mb-2" > Interview Purpose </label>
							< Select value = { purpose } onValueChange = {(value: Purpose) => setPurpose(value)}>
								<SelectTrigger>
								<SelectValue />
								</SelectTrigger>
								< SelectContent >
								<SelectItem value="exploratory" > Exploratory(open - ended) </SelectItem>
									< SelectItem value = "validation" > Validation(hypothesis testing) </SelectItem>
										< SelectItem value = "followup" > Follow - up(specific topics) </SelectItem>
											</SelectContent>
											</Select>
											</div>

											< div >
											<label className="block text-sm mb-2" > Participant Familiarity </label>
												< Select value = { familiarity } onValueChange = {(value: Familiarity) => setFamiliarity(value)}>
													<SelectTrigger>
													<SelectValue />
													</SelectTrigger>
													< SelectContent >
													<SelectItem value="cold" > Cold(first interaction) </SelectItem>
														< SelectItem value = "warm" > Warm(established rapport) </SelectItem>
															</SelectContent>
															</Select>
															</div>

															< div className = "flex items-center justify-between" >
																<label className="text-sm" > Go Deep Quick Mode </label>
																	< Switch checked = { goDeepMode } onCheckedChange = { setGoDeepMode } />
																		</div>
																		</div>
																		</CardContent>
																		</AccordionContent>
																		</AccordionItem>
																		</Accordion>
																		</Card>

{/* AI Generate Questions */ }
<Card>
	<CardContent className="p-3 space-y-3" >
		<Textarea
								placeholder="Modify questions"
value = { customInstructions }
onChange = {(e) => setCustomInstructions(e.target.value)}
rows = { 3}
	/>
	<Button onClick={ generateQuestions } disabled = { generating } variant = "outline" className = "w-full" >
	{
		generating?(
									<>
		<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
			Generating Questions...
</>
								) : (
	<>
	<Brain className= "w-4 h-4 mr-2" />
	Generate New Questions
		</>
								)}
</Button>
	</CardContent>
	</Card>
	</div>

{/* Right Column: Question Pack */ }
<div className="lg:col-span-2 space-y-6" >
	{/* Question Pack */ }
	< Card >
	<CardHeader>
	<CardTitle className="flex items-center justify-between" >
		<div className="flex items-center gap-2" >
			<span>Your Question Pack({ questionPack.questions.length }) </span>
				</div>
				< div className = "text-right" >
					<div
										className={
	`text-sm font-medium ${questionPack.totalEstimatedTime > questionPack.targetTime ? "text-red-600" : "text-green-600"
	}`
}
									>
	{ Math.round(questionPack.totalEstimatedTime) }m / { questionPack.targetTime }m
		</div>
		</div>
		</CardTitle>
		</CardHeader>
		< CardContent >
		<DragDropContext onDragEnd={ onDragEnd }>
			<Droppable droppableId="question-pack" >
				{(provided) => (
					<div className= "space-y-4" {...provided.droppableProps } ref = { provided.innerRef } >
					{
						questionPack.questions.map((question, index) => {
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
								<div key= { question.id } >
								{ isFirstOverflow && (
									<div className="border-t-2 border-dashed border-orange-300 pt-4 mt-6" >
										<div className="flex items-center gap-2 mb-4" >
											<Clock className="w-4 h-4 text-orange-600" />
												<span className="text-sm font-medium text-orange-600" >
													Questions below may not fit in your { timeMinutes } -minute time limit
														</span>
														</div>
														</div>
														)
					}
						< Draggable draggableId = { question.id } index = { index } >
							{(provided, snapshot) => (
								<div
																	ref= { provided.innerRef }
{...provided.draggableProps }
className = {`${snapshot.isDragging ? "opacity-50" : ""}`}
																>
	<Card
																		className={
	`border-l-4 ${fitsInTime
		? "border-l-blue-500"
		: "border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/30"
	}`
}
																	>
	<CardContent className="px-3" >
		<div className="flex items-start gap-3" >
			<div className="flex items-center gap-2 mt-0.5" >
				<div { ...provided.dragHandleProps } >
				<GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
					</div>
					< Badge variant = "outline" className = "text-xs" >
																						#{ index + 1 }
</Badge>
	</div>

	< div className = "flex-1 min-w-0" >
		<div className="flex items-center gap-2 flex-wrap" >
			<Badge
																							variant="outline"
color = {
	questionCategoriesVariants[
		question.categoryId as keyof typeof questionCategoriesVariants
	].colorVariant
}
	>
	{ questionCategories.find((c) => c.id === question.categoryId)?.name }
	</Badge>
	< Badge variant = "outline" className = "text-xs text-muted-foreground" >
		~{ Math.round(question.estimatedMinutes) }m
			</Badge>
{/* Answered */ }
{
	question.timesAnswered > 0 && (
		<Badge
																								className={ getAnsweredCountColor(question.timesAnswered) }
	variant = "outline"
		>
		{ question.timesAnswered }
		</Badge>
																						)
}
{
	goDeepMode && index < 3 && (
		<Badge className="bg-yellow-100 text-yellow-800 text-xs" >
			Power Question
				</Badge>
																						)
}
</div>
	< p
className = "text-sm font-medium leading-relaxed mb-2"
title = { question.rationale ? `Why: ${question.rationale}` : undefined }
	>
	{ question.text }
	</p>
	</div>

	< Button
variant = "ghost"
size = "sm"
onClick = {() => removeQuestion(question.id)}
className = "text-red-500/70 hover:text-red-700"
	>
	<Trash2 className="w-4 h-4" />
		</Button>
		</div>
		</CardContent>
		</Card>
		</div>
															)}
</Draggable>
	</div>
												)
											})}
{ provided.placeholder }
</div>
									)}
</Droppable>
	</DragDropContext>

{/* Show More Questions */ }
{
	questionPack.remainingQuestions.length > 0 && (
		<div className="mt-6" >
			<div className="border-t pt-4" >
				<Button
											variant="outline"
	onClick = {() => setShowAllQuestions(!showAllQuestions)
}
className = "w-full mb-4"
	>
	<MoreHorizontal className="w-4 h-4 mr-2" />
		{ showAllQuestions? "Hide": "Show" } Additional Questions(
			{ questionPack.remainingQuestions.length })
			</Button>

{
	showAllQuestions && (
		<div className="mt-4 space-y-3" >
			<p className="text-sm text-gray-600" >
				Additional questions below the line - click to include in your pack:
	</p>
	{
		questionPack.remainingQuestions.map((question) => (
			<Card
														key= { question.id }
														className = "border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
														onClick = {() => addQuestionFromReserve(question)}
													>
		<CardContent className="p-3" >
			<div className="flex items-start gap-3" >
				<div className="flex items-center gap-2 mt-1" >
					<GripVertical className="w-4 h-4 text-gray-400" />
						<Plus className="w-4 h-4 text-gray-400" />
							</div>

							< div className = "flex-1 min-w-0" >
								<div className="flex items-center gap-2 mb-2 flex-wrap" >
									<Badge
																			variant="outline"
	color = { questionCategoriesVariants[question.categoryId].colorVariant }
		>
		{ questionCategories.find((c) => c.id === question.categoryId)?.name }
		</Badge>
		< Badge variant = "outline" className = "text-xs" >
			~{ Math.round(question.estimatedMinutes) }m
				</Badge>
				< Badge className = { getAnsweredCountColor(question.timesAnswered) } variant = "outline" >
					{ question.timesAnswered }x answered
						</Badge>
						</div>

						< p
	className = "text-sm leading-relaxed"
	title = { question.rationale ? `Why: ${question.rationale}` : undefined }
		>
		{ question.text }
		</p>
		</div>
		</div>
		</CardContent>
		</Card>
												))
}
</div>
										)}
</div>
	</div>
							)}
</CardContent>
	</Card>
	</div>
	</div>

{/* Navigation */ }
<div className="flex justify-between pt-6" >
	<Button variant="outline" onClick = { onBack } >
		<ChevronLeft className="mr-2 h-4 w-4" />
			Back
			</Button>
			< Button onClick = { handleNext } disabled = { questionPack.questions.length === 0 } >
				Next
				< ChevronRight className = "ml-2 h-4 w-4" />
					</Button>
					</div>
					</div>
	)
}
