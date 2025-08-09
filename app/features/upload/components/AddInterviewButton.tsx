import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "~/components/ui/button"
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

	return (
		<>
			<Button onClick={() => setOpen(true)}>Add Interview</Button>
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
