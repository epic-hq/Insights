import { useState } from "react"
import { useNavigate } from "react-router"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useNotification } from "~/contexts/NotificationContext"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { ProcessingResult } from "~/utils/processInterview.server"
import UploadModal from "./UploadModal"

export default function UploadButton() {
	const [open, setOpen] = useState(false)
	const navigate = useNavigate()
	const { showNotification } = useNotification()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const handleSuccess = (result: ProcessingResult) => {
		// Handle successful upload and processing
		// Store result for debugging (accessible via window object in dev tools)
		if (typeof window !== "undefined") {
			;(window as any).lastInterviewResult = result
		}

		// Show success notification
		const insightCount = result.stored?.length || 0
		showNotification(`Interview processed successfully! Generated ${insightCount} insights.`, "success", 4000)

		// Close modal and navigate to the new interview
		setOpen(false)

		if (result.interview?.id) {
			// Navigate to the newly created interview
			navigate(routes.interviews.detail(result.interview.id))
		} else {
			// Fallback: refresh the current page to show the new interview
			window.location.reload()
		}
	}

	return (
		<>
			<button
				onClick={() => setOpen(true)}
				className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
			>
				Add interview
			</button>
			<UploadModal open={open} onClose={() => setOpen(false)} onSuccess={handleSuccess} />
		</>
	)
}
