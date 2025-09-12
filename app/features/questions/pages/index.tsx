import { BookOpen, MessageCircleQuestion } from "lucide-react"
import { useSearchParams } from "react-router"
import InterviewQuestionsManager from "~/components/questions/InterviewQuestionsManager"
import { useCurrentProject } from "~/contexts/current-project-context"
import { OnboardingStepper } from "~/features/onboarding/components/OnboardingStepper"

export default function QuestionsIndex() {
	const { projectId, projectPath } = useCurrentProject()
	const [params] = useSearchParams()
	const isOnboarding = params.get("onboarding") === "1"

	if (!projectId) {
		return (
			<div className="mx-auto max-w-7xl p-4 sm:p-8">
				<div className="text-center">
					<p className="text-gray-500">Loading project...</p>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-7xl p-4 sm:p-6">
			{isOnboarding && (
				<div className="mb-6">
					<OnboardingStepper
						steps={[
							{ id: "goals", title: "Project Goals" },
							{ id: "questions", title: "Questions" },
							{ id: "upload", title: "Upload" },
						]}
						currentStepId="questions"
					/>
				</div>
			)}

			<InterviewQuestionsManager projectId={projectId} projectPath={projectPath} />
		</div>
	)
}
