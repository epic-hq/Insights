import { BookOpen, ChevronLeft, ChevronRight, MessageCircleQuestionMark, Mic } from "lucide-react"
import { useState } from "react"
import InterviewQuestionsManager from "~/components/questions/InterviewQuestionsManager"
import { Button } from "~/components/ui/button"
import { OnboardingStepper } from "~/components/ui/onboarding-stepper"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

interface QuestionsScreenProps {
	target_orgs: string[]
	target_roles: string[]
	research_goal: string
	research_goal_details: string
	decision_questions: string[]
	assumptions: string[]
	unknowns: string[]
	custom_instructions?: string
	onNext: (questions: string[]) => void
	onBack: () => void
	/** When true (default), shows the onboarding 1-2-3 progress header */
	showStepper?: boolean
	/** Optional projectId to load/save questions context when available */
	projectId?: string
	/** Optional projectPath for routing */
	projectPath?: string
}

export default function QuestionsScreen({
	target_orgs,
	target_roles,
	research_goal,
	research_goal_details,
	decision_questions,
	assumptions,
	unknowns,
	onNext,
	onBack,
	showStepper = true,
	projectId,
	projectPath,
}: QuestionsScreenProps) {
	// Collect the current selection from the shared manager to pass on Next
	const [selectedForNext, setSelectedForNext] = useState<{ id: string; text: string }[]>([])
	const routes = useProjectRoutes(projectPath)

	const handleNext = () => {
		const questionTexts = selectedForNext.map((q) => q.text)
		onNext(questionTexts)
	}

	return (
		<div className="mx-auto max-w-7xl p-4 sm:p-2">
			{/* Onboarding Progress Header */}
			{showStepper && <OnboardingStepper currentStep="questions" />}

			<div className="mb-6 sm:mb-8">
				<h2 className="mb-2 flex items-center gap-2 text-2xl sm:text-3xl">
					<MessageCircleQuestionMark className="h-8 w-8" />
					Interview Questions
				</h2>
				<p className="text-gray-600">
					Generate smart questions based on your research goals and customize your question pack.
				</p>
			</div>

			{/* Shared Questions Manager */}
			<div className="mb-6">
				<InterviewQuestionsManager
					projectId={projectId}
					projectPath={projectPath}
					target_orgs={target_orgs}
					target_roles={target_roles}
					research_goal={research_goal}
					research_goal_details={research_goal_details}
					assumptions={assumptions}
					unknowns={unknowns}
					onSelectedQuestionsChange={(list) => setSelectedForNext(list)}
				/>
				<div className="flex justify-center">
					<Button
						onClick={() => {
							if (routes) {
								window.location.href = routes.interviews.upload()
							}
						}}
						variant="default"
						// disabled={questionPack.questions.length === 0}
						className="mx-auto w-full max-w-sm justify-center bg-blue-600 hover:bg-blue-700"
					>
						<Mic className="mr-2 h-4 w-4" />
						Add Interview
					</Button>
				</div>
			</div>

			{/* Navigation */}
			<div className="flex justify-between pt-6">
				<Button variant="outline" onClick={onBack}>
					<ChevronLeft className="mr-2 h-4 w-4" />
					Back
				</Button>
				<Button onClick={handleNext} disabled={selectedForNext.length === 0}>
					Next
					<ChevronRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}
