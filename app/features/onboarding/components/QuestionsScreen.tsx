import consola from "consola"
import { ChevronDown, ChevronLeft, ChevronRight, Lightbulb, Loader2, Plus, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"

interface Question {
	id: string
	text: string
	isCustom: boolean
	priority?: number
	rationale?: string
}

interface QuestionsScreenProps {
	icp: string
	role: string
	goal: string
	onNext: (questions: string[]) => void
	onBack: () => void
}

export default function QuestionsScreen({ icp, role, goal, onNext, onBack }: QuestionsScreenProps) {
	const [questions, setQuestions] = useState<Question[]>([])
	const [newQuestion, setNewQuestion] = useState("")
	const [showAddQuestion, setShowAddQuestion] = useState(false)
	const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
	const [showCustomInstructions, setShowCustomInstructions] = useState(false)
	const [customInstructions, setCustomInstructions] = useState("")
	const hasInitialized = useRef(false)

	const generateSmartQuestions = useCallback(
		async (instructions?: string) => {
			// Prevent duplicate calls
			if (isGeneratingQuestions) {
				consola.log("Already generating questions, skipping duplicate call")
				return
			}

			setIsGeneratingQuestions(true)
			try {
				const response = await fetch("/api/generate-questions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						icp,
						role,
						goal,
						customInstructions: instructions,
						questionCount: 4,
					}),
				})

				if (response.ok) {
					const data = await response.json()
					consola.log("Generated questions response:", data)
					if (data.success && data.questions?.length > 0) {
						const smartQuestions = data.questions.map((q: any, index: number) => ({
							id: `smart_${index}`,
							text: q.question,
							isCustom: false,
							priority: q.priority,
							rationale: q.rationale,
						}))

						// Use a function to get current state and preserve custom questions
						setQuestions((currentQuestions) => {
							const existingCustomQuestions = currentQuestions.filter((q) => q.isCustom)
							return [...existingCustomQuestions, ...smartQuestions]
						})
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
		[icp, role, goal, isGeneratingQuestions]
	)

	useEffect(() => {
		if (icp && role && goal && !hasInitialized.current && !isGeneratingQuestions) {
			hasInitialized.current = true
			generateSmartQuestions()
		}
	}, [icp, role, goal, generateSmartQuestions, isGeneratingQuestions])

	const removeQuestion = (id: string) => {
		setQuestions(questions.filter((q) => q.id !== id))
	}

	const updateQuestion = (id: string, text: string) => {
		setQuestions(questions.map((q) => (q.id === id ? { ...q, text } : q)))
	}

	const addCustomQuestion = () => {
		if (newQuestion.trim()) {
			const newId = `custom_${Date.now()}`
			setQuestions([
				...questions,
				{
					id: newId,
					text: newQuestion.trim(),
					isCustom: true,
					priority: 1, // User questions are always high priority
				},
			])
			setNewQuestion("")
			setShowAddQuestion(false)
		}
	}

	const handleNext = () => {
		const validQuestions = questions.filter((q) => q.text.trim()).map((q) => q.text.trim())
		if (validQuestions.length > 0) {
			onNext(validQuestions)
		}
	}

	const isValid = questions.some((q) => q.text.trim())

	return (
		<div className="relative min-h-screen bg-black text-white">
			{/* Header */}
			<div className="border-gray-800 border-b bg-black p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-white hover:bg-gray-800">
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-medium text-sm text-white">
							2
						</div>
						<h1 className="font-semibold text-lg text-white">Questions</h1>
					</div>
					{/* <div className="text-gray-400 text-sm">Step 2 of 3</div> */}
				</div>
			</div>

			{/* Main Content */}
			<div className="p-4">
				<div className="space-y-6">
					{/* AI Generation Section */}
					<div className="space-y-3">
						{/* Status */}
						{isGeneratingQuestions && (
							<div className="flex items-center gap-2 text-green-400">
								<Lightbulb className="h-4 w-4" />
								<span className="text-sm">Generating questions...</span>
							</div>
						)}

						{/* Regenerate Controls */}
						{hasInitialized.current && !isGeneratingQuestions && (
							<div className="space-y-2">
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											if (!isGeneratingQuestions) {
												generateSmartQuestions()
											}
										}}
										disabled={isGeneratingQuestions}
										className="flex-1 border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
									>
										<Lightbulb className="mr-2 h-3 w-3" />
										Regenerate Questions
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowCustomInstructions(!showCustomInstructions)}
										className="border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white"
									>
										<ChevronDown
											className={`h-3 w-3 transition-transform ${showCustomInstructions ? "rotate-180" : ""}`}
										/>
									</Button>
								</div>

								{showCustomInstructions && (
									<div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
										<Textarea
											value={customInstructions}
											onChange={(e) => setCustomInstructions(e.target.value)}
											placeholder="Add specific instructions (e.g., 'Focus on pricing questions', 'Include onboarding flow questions')"
											className="mb-2 min-h-[60px] border-none bg-transparent text-sm text-white placeholder:text-gray-500"
										/>
										<div className="flex gap-2">
											<Button
												size="sm"
												onClick={() => {
													if (!isGeneratingQuestions && customInstructions.trim()) {
														generateSmartQuestions(customInstructions)
														setCustomInstructions("")
														setShowCustomInstructions(false)
													}
												}}
												disabled={!customInstructions.trim() || isGeneratingQuestions}
												className="bg-blue-600 text-white hover:bg-blue-700"
											>
												Generate with Instructions
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => {
													setCustomInstructions("")
													setShowCustomInstructions(false)
												}}
												className="text-gray-400 hover:text-white"
											>
												Cancel
											</Button>
										</div>
									</div>
								)}
							</div>
						)}
					</div>

					{/* Questions List */}
					<div className="space-y-3">
						{isGeneratingQuestions ? (
							<div className="flex flex-col items-center justify-center space-y-4 py-12">
								<Loader2 className="h-8 w-8 animate-spin text-blue-400" />
								<div className="text-center">
									<p className="font-medium text-white">Generating smart questions...</p>
									<p className="text-gray-400 text-sm">This may take a few seconds</p>
								</div>
							</div>
						) : (
							<>
								{questions.map((question) => (
									<div
										key={question.id}
										className={`rounded-lg border bg-gray-900 p-4 ${question.priority === 1 ? "border-red-400" : question.priority === 2 ? "border-yellow-400" : "border-slate-300"}`}
									>
										<div className="flex items-start gap-3">
											<div className="min-w-0 flex-1">
												<Textarea
													value={question.text}
													onChange={(e) => updateQuestion(question.id, e.target.value)}
													className="min-h-[60px] resize-none border-none bg-transparent p-0 text-sm text-white focus:ring-0"
													placeholder="Enter your research question..."
												/>
											</div>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => removeQuestion(question.id)}
												className="mt-1 h-6 w-6 text-gray-400 hover:text-red-400"
											>
												<X className="h-3 w-3" />
											</Button>
										</div>
									</div>
								))}

								{/* Add Question */}
								{!isGeneratingQuestions && showAddQuestion ? (
									<div className="rounded-lg border border-blue-700 bg-gray-900 p-4">
										<div className="flex items-start gap-3">
											<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
											<div className="min-w-0 flex-1">
												<Textarea
													value={newQuestion}
													onChange={(e) => setNewQuestion(e.target.value)}
													onBlur={() => {
														if (newQuestion.trim()) {
															addCustomQuestion()
														}
													}}
													className="min-h-[60px] resize-none border-none bg-transparent p-0 text-sm text-white focus:ring-0"
													placeholder="What would you like to learn about your target audience?"
													autoFocus
												/>
											</div>
											<div className="flex gap-1">
												<Button
													variant="ghost"
													size="icon"
													onClick={addCustomQuestion}
													disabled={!newQuestion.trim()}
													className="h-6 w-6 text-green-400 hover:text-green-300"
												>
													<ChevronRight className="h-3 w-3" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => {
														setShowAddQuestion(false)
														setNewQuestion("")
													}}
													className="h-6 w-6 text-gray-400 hover:text-red-400"
												>
													<X className="h-3 w-3" />
												</Button>
											</div>
										</div>
									</div>
								) : (
									!isGeneratingQuestions && (
										<Button
											variant="ghost"
											onClick={() => setShowAddQuestion(true)}
											className="h-12 w-full border border-gray-600 border-dashed text-gray-300 hover:border-blue-500 hover:text-blue-400"
										>
											<Plus className="mr-2 h-4 w-4" />
											Add custom question
										</Button>
									)
								)}
							</>
						)}
					</div>

					{/* Help Text */}
					{!isGeneratingQuestions && (
						<div className="rounded-lg bg-gray-900 p-4">
							<div className="flex items-start gap-3">
								<div className="mt-1 h-2 w-2 rounded-full bg-yellow-400" />
								<div>
									<p className="font-medium text-sm text-white">Good questions are specific</p>
									<p className="text-gray-300 text-xs leading-relaxed">
										Focus on behaviors, motivations, and specific scenarios rather than yes/no questions. The AI will
										analyze your interviews to find answers to these questions.
									</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Bottom Action */}
			<div className="mt-8 mb-20 border-gray-800 border-t bg-black p-4">
				<Button
					onClick={handleNext}
					disabled={!isValid}
					className="h-12 w-full bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-400"
				>
					Continue
					<ChevronRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}
