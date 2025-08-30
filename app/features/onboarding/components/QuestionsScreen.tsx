import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import InterviewQuestionsManager from "~/components/questions/InterviewQuestionsManager"
import { OnboardingStepper } from "~/components/ui/onboarding-stepper"

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
	/** When true (default), shows the onboarding 1-2-3 progress header */
	showStepper?: boolean
	/** Optional projectId to load/save questions context when available */
	projectId?: string
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
	showStepper = true,
	projectId,
}: QuestionsScreenProps) {
	// Collect the current selection from the shared manager to pass on Next
	const [selectedForNext, setSelectedForNext] = useState<{ id: string; text: string }[]>([])

	const handleNext = () => {
		const questionTexts = selectedForNext.map((q) => q.text)
		onNext(questionTexts)
	}

	return (
		<div className="p-4 sm:p-8 max-w-7xl mx-auto">
			{/* Onboarding Progress Header */}
			{showStepper && <OnboardingStepper currentStep="questions" />}

			<div className="mb-6 sm:mb-8">
				<h2 className="text-2xl sm:text-3xl mb-2 flex items-center gap-2">
					<BookOpen className="h-8 w-8" />
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
					target_orgs={target_orgs}
					target_roles={target_roles}
					research_goal={research_goal}
					research_goal_details={research_goal_details}
					assumptions={assumptions}
					unknowns={unknowns}
					onSelectedQuestionsChange={(list) => setSelectedForNext(list)}
				/>
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
