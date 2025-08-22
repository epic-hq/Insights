import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { ChevronDown, Upload, Mic } from "lucide-react"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { ProcessingResult } from "~/utils/processInterview.server"
import AddInterview from "./AddInterview"

export default function AddInterviewButton() {
	const [open, setOpen] = useState(false)
	const { accountId, projectId } = useCurrentProject()
	const navigate = useNavigate()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const handleSuccess = (result: ProcessingResult) => {
		// You could navigate to the new interview here once API returns the id

		if (result.interview?.id) {
			navigate(routes.interviews.detail(result.interview.id))
		} else {
			// fallback if id missing
			window.location.reload()
		}
	}

	const handleLiveTranscription = () => {
		navigate(routes.liveTranscription.index())
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button className="flex items-center gap-2">
						Add Interview
						<ChevronDown className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => setOpen(true)} className="flex items-center gap-2">
						<Upload className="h-4 w-4" />
						Upload File
					</DropdownMenuItem>
					<DropdownMenuItem onClick={handleLiveTranscription} className="flex items-center gap-2">
						<Mic className="h-4 w-4" />
						Record Live
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<AddInterview
				open={open}
				onClose={() => setOpen(false)}
				onSuccess={handleSuccess}
				accountId={accountId}
				projectId={projectId}
			/>
		</>
	)
}
