import { BookOpen } from "lucide-react"
import InterviewQuestionsManager from "~/components/questions/InterviewQuestionsManager"
import { useCurrentProject } from "~/contexts/current-project-context"

export default function QuestionsIndex() {
	const { projectId, projectPath } = useCurrentProject()

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
		<div className="mx-auto max-w-7xl p-4 sm:p-8">
			<div className="mb-6 sm:mb-8">
				<h2 className="mb-2 flex items-center gap-2 text-2xl sm:text-3xl">
					<BookOpen className="h-8 w-8" />
					Interview Questions
				</h2>
				<p className="text-gray-600">Manage your interview questions</p>
			</div>

			<InterviewQuestionsManager projectId={projectId} projectPath={projectPath} />
		</div>
	)
}
