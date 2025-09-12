import { BookOpen, MessageCircleQuestion, Mic } from "lucide-react"
import { useSearchParams } from "react-router"
import InterviewQuestionsManager from "~/components/questions/InterviewQuestionsManager"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { OnboardingStepper } from "~/features/onboarding/components/OnboardingStepper"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

export default function QuestionsIndex() {
	const { projectId, projectPath } = useCurrentProject()
	const [params] = useSearchParams()
	const isOnboarding = params.get("onboarding") === "1"
	const routes = useProjectRoutes(projectPath)

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
		<div className="mx-auto max-w-6xl px-4 py-6">
			{isOnboarding && (
				<div className="mb-8">
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
	)
}
