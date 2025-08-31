import consola from "consola"
import { ArrowRight, Check, Clock, Plus, Sparkles, Trash2, X } from "lucide-react"
import { useCallback, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"

export interface Question {
	id: string
	text: string
	isCustom: boolean
	priority: number
	rationale?: string
	categoryId?: string
	scores?: {
		importance?: number
		goalMatch?: number
		novelty?: number
	}
	status?: "pending" | "answered" | "followup" | "skipped"
}

interface QuestionWidgetProps {
	// Core data
	questions: Question[]
	onQuestionsChange: (questions: Question[]) => void

	// Generation params
	target_orgs: string[]
	target_roles: string[]
	research_goal: string
	research_goal_details: string
	assumptions: string[]
	unknowns: string[]

	// UI customization
	mode?: "onboarding" | "realtime"
	showGenerateButton?: boolean
	showCustomQuestions?: boolean
	maxQuestions?: number

	// Callbacks
	onQuestionStatusChange?: (questionId: string, status: Question["status"]) => void
	onGenerateQuestions?: (instructions?: string) => Promise<void>
}

export function QuestionWidget({
	questions,
	onQuestionsChange,
	target_orgs,
	target_roles,
	research_goal,
	research_goal_details,
	assumptions,
	unknowns,
	mode = "onboarding",
	showGenerateButton = true,
	showCustomQuestions = true,
	maxQuestions = 15,
	onQuestionStatusChange,
	onGenerateQuestions,
}: QuestionWidgetProps) {
	const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
	const [customQuestion, setCustomQuestion] = useState("")
	const [customInstructions, setCustomInstructions] = useState("")

	const generateSmartQuestions = useCallback(
		async (instructions?: string) => {
			if (isGeneratingQuestions) {
				consola.log("Already generating questions, skipping duplicate call")
				return
			}

			setIsGeneratingQuestions(true)
			try {
				const formData = new FormData()
				formData.append("target_orgs", target_orgs.join(", "))
				formData.append("target_roles", target_roles.join(", "))
				formData.append("research_goal", research_goal)
				formData.append("research_goal_details", research_goal_details)
				formData.append("assumptions", assumptions.join(", "))
				formData.append("unknowns", unknowns.join(", "))
				formData.append("session_id", `session_${Date.now()}`)
				formData.append("round", "1")
				formData.append("total_per_round", maxQuestions.toString())
				formData.append("per_category_min", "2")
				formData.append("per_category_max", "4")
				if (instructions) {
					formData.append("custom_instructions", instructions)
				}

				const response = await fetch("/api/generate-questions", {
					method: "POST",
					body: formData,
				})

				if (response.ok) {
					const data = await response.json()
					consola.log("Generated questions response:", data)

					// Handle new QuestionSet format
					if (data.success && data.questionSet?.questions?.length > 0) {
						interface QuestionWithScore {
							id: string
							text: string
							categoryId: string
							rationale?: string
							scores: {
								importance?: number
								goalMatch?: number
								novelty?: number
							}
							compositeScore: number
						}

						const sortedQuestions = data.questionSet.questions
							.map((q: QuestionWithScore) => ({
								...q,
								compositeScore: (q.scores.importance || 0) * (q.scores.goalMatch || 0) * (1 + (q.scores.novelty || 0)),
							}))
							.sort((a: QuestionWithScore, b: QuestionWithScore) => b.compositeScore - a.compositeScore)
							.slice(0, maxQuestions)

						const smartQuestions = sortedQuestions.map((q: QuestionWithScore, index: number) => ({
							id: q.id || `smart_${index}`,
							text: q.text,
							isCustom: false,
							priority: Math.round((q.scores.importance || 0) * 3) || 2,
							rationale: q.rationale,
							categoryId: q.categoryId,
							scores: q.scores,
							status: "pending" as const,
						}))

						const existingCustomQuestions = questions.filter((q) => q.isCustom)
						onQuestionsChange([...existingCustomQuestions, ...smartQuestions])
					}
					// Handle current API response format (simple questions array)
					else if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
						interface SimpleQuestion {
							question: string
							priority?: number
							rationale?: string
						}

						const smartQuestions = data.questions.slice(0, maxQuestions).map((q: SimpleQuestion, index: number) => ({
							id: `smart_${index}`,
							text: q.question,
							isCustom: false,
							priority: q.priority || 2,
							rationale: q.rationale,
							status: "pending" as const,
						}))

						const existingCustomQuestions = questions.filter((q) => q.isCustom)
						onQuestionsChange([...existingCustomQuestions, ...smartQuestions])
					}
					// Fallback to categorized legacy format
					else if (data.success && data.questions && typeof data.questions === "object") {
						interface LegacyQuestion {
							question: string
							priority?: number
							rationale?: string
						}

						const allLegacyQuestions = [
							...(data.questions.core_questions || []),
							...(data.questions.behavioral_questions || []),
							...(data.questions.pain_point_questions || []),
							...(data.questions.solution_questions || []),
							...(data.questions.context_questions || []),
						].slice(0, maxQuestions)

						const smartQuestions = allLegacyQuestions.map((q: LegacyQuestion, index: number) => ({
							id: `smart_${index}`,
							text: q.question,
							isCustom: false,
							priority: q.priority || 2,
							rationale: q.rationale,
							status: "pending" as const,
						}))

						const existingCustomQuestions = questions.filter((q) => q.isCustom)
						onQuestionsChange([...existingCustomQuestions, ...smartQuestions])
					} else {
						consola.log("No questions in response or success was false")
					}
				} else {
					consola.error("API response not ok:", response.status, response.statusText)
				}
			} catch (error) {
				consola.error("Failed to generate questions:", error)
			} finally {
				setIsGeneratingQuestions(false)
			}
		},
		[
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
			questions,
			onQuestionsChange,
			maxQuestions,
			isGeneratingQuestions,
		]
	)

	const addCustomQuestion = useCallback(() => {
		if (customQuestion.trim()) {
			const newQuestion: Question = {
				id: `custom_${Date.now()}`,
				text: customQuestion.trim(),
				isCustom: true,
				priority: 2,
				status: "pending",
			}
			onQuestionsChange([...questions, newQuestion])
			setCustomQuestion("")
		}
	}, [customQuestion, questions, onQuestionsChange])

	const removeQuestion = useCallback(
		(questionId: string) => {
			onQuestionsChange(questions.filter((q) => q.id !== questionId))
		},
		[questions, onQuestionsChange]
	)

	const updateQuestionStatus = useCallback(
		(questionId: string, status: Question["status"]) => {
			const updatedQuestions = questions.map((q) => (q.id === questionId ? { ...q, status } : q))
			onQuestionsChange(updatedQuestions)
			onQuestionStatusChange?.(questionId, status)
		},
		[questions, onQuestionsChange, onQuestionStatusChange]
	)

	const getPriorityColor = (priority: number) => {
		switch (priority) {
			case 1:
				return "bg-red-100 text-red-800 border-red-200"
			case 2:
				return "bg-yellow-100 text-yellow-800 border-yellow-200"
			case 3:
				return "bg-green-100 text-green-800 border-green-200"
			default:
				return "bg-gray-100 text-gray-800 border-gray-200"
		}
	}

	const getStatusIcon = (status?: Question["status"]) => {
		switch (status) {
			case "answered":
				return <Check className="h-4 w-4 text-green-600" />
			case "followup":
				return <ArrowRight className="h-4 w-4 text-blue-600" />
			case "skipped":
				return <X className="h-4 w-4 text-gray-600" />
			default:
				return <Clock className="h-4 w-4 text-yellow-600" />
		}
	}

	// Use the external generate function if provided, otherwise use internal
	const handleGenerateQuestions = onGenerateQuestions || generateSmartQuestions

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Sparkles className="h-5 w-5" />
					Interview Questions
					{mode === "realtime" && (
						<Badge variant="outline" className="ml-auto">
							Live Session
						</Badge>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{showGenerateButton && (
					<div className="space-y-3">
						<Textarea
							placeholder="Any specific instructions for question generation? (optional)"
							value={customInstructions}
							onChange={(e) => setCustomInstructions(e.target.value)}
							rows={2}
						/>
						<Button
							onClick={() => handleGenerateQuestions(customInstructions || undefined)}
							disabled={isGeneratingQuestions}
							className="w-full"
						>
							{isGeneratingQuestions ? (
								<>
									<div className="mr-2 h-4 w-4 animate-spin rounded-full border-white border-b-2" />
									Generating Questions...
								</>
							) : (
								<>
									<Sparkles className="mr-2 h-4 w-4" />
									Generate Smart Questions
								</>
							)}
						</Button>
					</div>
				)}

				{showCustomQuestions && (
					<div className="flex gap-2">
						<Input
							placeholder="Add a custom question..."
							value={customQuestion}
							onChange={(e) => setCustomQuestion(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault()
									addCustomQuestion()
								}
							}}
						/>
						<Button onClick={addCustomQuestion} variant="outline" size="sm">
							<Plus className="h-4 w-4" />
						</Button>
					</div>
				)}

				<div className="space-y-3">
					{questions.map((question) => (
						<Card key={question.id} className="relative">
							<CardContent className="p-4">
								<div className="flex items-start gap-3">
									{mode === "realtime" && (
										<div className="mt-1 flex flex-col gap-1">
											<Button
												size="sm"
												variant={question.status === "answered" ? "default" : "outline"}
												onClick={() => updateQuestionStatus(question.id, "answered")}
											>
												<Check className="h-3 w-3" />
											</Button>
											<Button
												size="sm"
												variant={question.status === "followup" ? "default" : "outline"}
												onClick={() => updateQuestionStatus(question.id, "followup")}
											>
												<ArrowRight className="h-3 w-3" />
											</Button>
											<Button
												size="sm"
												variant={question.status === "skipped" ? "default" : "outline"}
												onClick={() => updateQuestionStatus(question.id, "skipped")}
											>
												<X className="h-3 w-3" />
											</Button>
										</div>
									)}

									<div className="min-w-0 flex-1">
										<div className="mb-2 flex items-center gap-2">
											{getStatusIcon(question.status)}
											<Badge variant="outline" className={getPriorityColor(question.priority)}>
												Priority {question.priority}
											</Badge>
											{question.isCustom && <Badge variant="secondary">Custom</Badge>}
											{question.categoryId && <Badge variant="outline">{question.categoryId}</Badge>}
										</div>

										<p className="mb-2 font-medium text-sm leading-relaxed">{question.text}</p>

										{question.rationale && <p className="text-muted-foreground text-xs italic">{question.rationale}</p>}
									</div>

									<Button
										variant="ghost"
										size="sm"
										onClick={() => removeQuestion(question.id)}
										className="text-red-500 hover:bg-red-50 hover:text-red-700"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>

				{questions.length === 0 && (
					<div className="py-8 text-center text-muted-foreground">
						<Sparkles className="mx-auto mb-2 h-8 w-8 opacity-50" />
						<p>No questions yet. Generate some smart questions to get started!</p>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
