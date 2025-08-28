import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { QuestionWidget, type Question } from "~/components/questions/QuestionWidget"
import { Button } from "~/components/ui/button"

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
	const [questions, setQuestions] = useState<Question[]>([])

	const handleNext = () => {
		const questionTexts = questions.map(q => q.text)
		onNext(questionTexts)
	}

	return (
		<div className="space-y-6">
			<div className="text-center">
				<h2 className="mb-2 text-2xl font-bold text-gray-900">Interview Questions</h2>
				<p className="text-gray-600">
					Generate smart questions based on your research goals, or add your own custom questions.
				</p>
			</div>

			<QuestionWidget
				questions={questions}
				onQuestionsChange={setQuestions}
				target_orgs={target_orgs}
				target_roles={target_roles}
				research_goal={research_goal}
				research_goal_details={research_goal_details}
				assumptions={assumptions}
				unknowns={unknowns}
				mode="onboarding"
				showGenerateButton={true}
				showCustomQuestions={true}
				maxQuestions={15}
			/>

			{/* Navigation */}
			<div className="flex justify-between pt-6">
				<Button variant="outline" onClick={onBack}>
					<ChevronLeft className="mr-2 h-4 w-4" />
					Back
				</Button>
				<Button onClick={handleNext} disabled={questions.length === 0}>
					Next
					<ChevronRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}
