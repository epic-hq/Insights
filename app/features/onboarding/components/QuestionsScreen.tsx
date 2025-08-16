import { ChevronLeft, ChevronRight, HelpCircle, Plus, X } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"

interface Question {
	id: string
	text: string
	isCustom: boolean
}

interface QuestionsScreenProps {
	icp: string
	goal: string
	onNext: (questions: string[]) => void
	onBack: () => void
}

export default function QuestionsScreen({ icp, goal, onNext, onBack }: QuestionsScreenProps) {
	const getDefaultQuestions = (): Question[] => {
		const baseQuestions = [
			{ id: "1", text: `What motivates ${icp} to make purchase decisions?`, isCustom: false },
			{ id: "2", text: `What pain points do ${icp} experience with current solutions?`, isCustom: false },
			{ id: "3", text: `How do ${icp} discover new products/services?`, isCustom: false },
		]

		if (goal === "willingness") {
			return [
				{ id: "1", text: `What features would ${icp} pay the most for?`, isCustom: false },
				{ id: "2", text: `What's ${icp}'s budget range for this type of solution?`, isCustom: false },
				{ id: "3", text: `What would convince ${icp} to switch from their current solution?`, isCustom: false },
			]
		}

		return baseQuestions
	}

	const [questions, setQuestions] = useState<Question[]>(getDefaultQuestions())
	const [newQuestion, setNewQuestion] = useState("")
	const [showAddQuestion, setShowAddQuestion] = useState(false)

	const removeQuestion = (id: string) => {
		setQuestions(questions.filter((q) => q.id !== id))
	}

	const updateQuestion = (id: string, text: string) => {
		setQuestions(questions.map((q) => (q.id === id ? { ...q, text } : q)))
	}

	const addCustomQuestion = () => {
		if (newQuestion.trim()) {
			const newId = `custom_${Date.now()}`
			setQuestions([...questions, { id: newId, text: newQuestion.trim(), isCustom: true }])
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
						<h1 className="font-semibold text-lg text-white">Key research questions</h1>
					</div>
					<div className="text-gray-400 text-sm">Step 2 of 3</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="p-4 pb-24">
				<div className="space-y-6">
					{/* Instructions */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-green-400">
							<HelpCircle className="h-5 w-5" />
							<span className="font-medium text-sm">Research Focus</span>
						</div>
						<h2 className="font-bold text-2xl text-white">What questions do you want answered?</h2>
						<p className="text-gray-300 text-sm leading-relaxed">
							We've suggested some questions based on your research goal. Feel free to edit, remove, or add your own.
						</p>
					</div>

					{/* Questions List */}
					<div className="space-y-3">
						{questions.map((question) => (
							<div key={question.id} className="rounded-lg border border-gray-700 bg-gray-900 p-4">
								<div className="flex items-start gap-3">
									<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" />
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
						{showAddQuestion ? (
							<div className="rounded-lg border border-blue-700 bg-gray-900 p-4">
								<div className="flex items-start gap-3">
									<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
									<div className="min-w-0 flex-1">
										<Textarea
											value={newQuestion}
											onChange={(e) => setNewQuestion(e.target.value)}
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
							<Button
								variant="ghost"
								onClick={() => setShowAddQuestion(true)}
								className="h-12 w-full border border-gray-600 border-dashed text-gray-300 hover:border-blue-500 hover:text-blue-400"
							>
								<Plus className="mr-2 h-4 w-4" />
								Add custom question
							</Button>
						)}
					</div>

					{/* Help Text */}
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
				</div>
			</div>

			{/* Bottom Action */}
			<div className="fixed right-0 bottom-0 left-0 border-gray-800 border-t bg-black p-4">
				<Button
					onClick={handleNext}
					disabled={!isValid}
					className="h-12 w-full bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400"
				>
					Continue
					<ChevronRight className="ml-2 h-4 w-4" />
				</Button>
				{questions.length > 0 && (
					<p className="mt-2 text-center text-gray-400 text-xs">
						{questions.filter((q) => q.text.trim()).length} questions ready
					</p>
				)}
			</div>
		</div>
	)
}
