import { Bot, Plus } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { useCurrentProject } from "~/contexts/current-project-context"

interface BottomActionBarProps {
	onToggleChat: () => void
}

export function BottomActionBar({ onToggleChat }: BottomActionBarProps) {
	const navigate = useNavigate()
	const params = useParams()
	const { accountId, projectId } = params
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	return (
		<div className="fixed right-0 bottom-0 left-0 border-gray-800 border-t bg-black p-3 pb-safe z-50">
			<div className="mx-auto max-w-md">
				<div className="grid grid-cols-3 gap-2">
					{/* Add Encounter → Modern Onboarding Flow */}
					<button
						className="flex h-14 cursor-pointer flex-col items-center justify-center rounded-lg bg-emerald-600 text-white transition-all duration-200 hover:scale-[1.02] active:scale-95"
						onClick={() => navigate(`/a/${accountId}/${projectId}/new`)}
						type="button"
					>
						<Plus className="h-4 w-4" />
						<span className="mt-1 font-medium text-xs leading-tight">Add Encounter</span>
					</button>

					{/* New Project → navigate to routes.projects.new() */}
					<button
						className="flex h-14 cursor-pointer flex-col items-center justify-center rounded-lg bg-purple-600 text-white transition-all duration-200 hover:scale-[1.02] active:scale-95"
						onClick={() => navigate(routes.interviews.onboard())}
						type="button"
					>
						<Plus className="h-4 w-4" />
						<span className="mt-1 font-medium text-xs leading-tight">New Project</span>
					</button>

					{/* AI Chat Toggle */}
					<button
						className="flex h-14 cursor-pointer flex-col items-center justify-center rounded-lg bg-indigo-600 text-white transition-all duration-200 hover:scale-[1.02] active:scale-95"
						onClick={onToggleChat}
						type="button"
					>
						<Bot className="h-4 w-4" />
						<span className="mt-1 font-medium text-xs leading-tight">AI Chat</span>
					</button>
				</div>
			</div>
		</div>
	)
}