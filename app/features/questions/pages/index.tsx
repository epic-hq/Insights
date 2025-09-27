import { Mic, UploadCloud } from "lucide-react"
import { useCallback } from "react"
import { useSearchParams } from "react-router"
import InterviewQuestionsManager from "~/components/questions/InterviewQuestionsManager"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { OnboardingStepper } from "~/features/onboarding/components/OnboardingStepper"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { useRecordNow } from "~/hooks/useRecordNow"

export default function QuestionsIndex() {
	const { projectId, projectPath } = useCurrentProject()
	const [params] = useSearchParams()
	const isOnboarding = params.get("onboarding") === "1"
	const routes = useProjectRoutes(projectPath)
	const { recordNow, isRecording } = useRecordNow()

	const handleRecordNow = useCallback(() => {
		if (projectId) {
			recordNow({ projectId })
		}
	}, [projectId, recordNow])

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
							{ id: "goals", title: "Project Goals", href: routes.projects.setup() },
							{ id: "questions", title: "Questions", href: routes.questions.index() },
							{ id: "upload", title: "Upload", href: routes.interviews.upload() },
						]}
						currentStepId="questions"
					/>
				</div>
			)}

			<InterviewQuestionsManager projectId={projectId} projectPath={projectPath} />
			<div className="flex flex-row justify-center gap-3 p-4">
				<Button
					onClick={handleRecordNow}
					variant="default"
					disabled={isRecording}
					className="mx-auto max-w-sm justify-center border-red-600 bg-red-700 hover:bg-red-700"
				>
					<Mic className="mr-2 h-4 w-4" />
					Record Live
				</Button>
				<Button
					onClick={() => {
						if (routes) {
							window.location.href = routes.interviews.upload()
						}
					}}
					variant="default"
					// disabled={questionPack.questions.length === 0}
					className="mx-auto max-w-sm justify-center border-red-600 bg-blue-700 hover:bg-blue-700"
				>
					<UploadCloud className="mr-2 h-4 w-4" />
					Upload Audio / Transcript
				</Button>
			</div>
		</div>
	)
}
