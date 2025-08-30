import { BookOpen } from "lucide-react"
import { useCurrentProject } from "~/contexts/current-project-context"
import InterviewQuestionsManager from "~/components/questions/InterviewQuestionsManager"

export default function QuestionsIndex() {
	const { projectId } = useCurrentProject()

	if (!projectId) {
		return (
			<div className="p-4 sm:p-8 max-w-7xl mx-auto">
				<div className="text-center">
					<p className="text-gray-500">Loading project...</p>
				</div>
			</div>
		)
	}

	return (
		<div className="p-4 sm:p-8 max-w-7xl mx-auto">
			<div className="mb-6 sm:mb-8">
				<h2 className="mb-2 flex items-center gap-2 text-2xl sm:text-3xl">
					<BookOpen className="h-8 w-8" />
					Interview Questions
				</h2>
				<p className="text-gray-600">
					Manage your interview questions
				</p>
			</div>

			<InterviewQuestionsManager projectId={projectId} />
		</div>
	)
}