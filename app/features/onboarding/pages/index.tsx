import consola from "consola"
import { useNavigate } from "react-router-dom"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { OnboardingData } from "../components/OnboardingFlow"
import OnboardingFlow from "../components/OnboardingFlow"

export default function OnboardingPage() {
	const navigate = useNavigate()
	const { projectPath, projectId } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	
	// For standalone onboarding route, projectId might be empty initially
	// The OnboardingFlow will create a new project and update the projectId

	const handleOnboardingComplete = async (data: OnboardingData) => {
		// In a real app, this would:
		// 1. Create the project in the database
		// 2. Upload the file and start processing
		// 3. Store the research questions and context
		// 4. Navigate to the project dashboard

		consola.log("Onboarding completed with data:", data)

		// For now, simulate a delay and redirect
		setTimeout(() => {
			// Navigate to project dashboard or processing status
			if (routes.dashboard) {
				navigate(routes.dashboard())
			} else {
				navigate("/dashboard")
			}
		}, 1000)
	}

	const handleAddMoreInterviews = () => {
		// Navigate to upload/add interview page
		if (routes.interviews?.new) {
			navigate(routes.interviews.new())
		} else {
			navigate("/interviews/new")
		}
	}

	const handleViewResults = () => {
		// Navigate to full project dashboard
		if (routes.dashboard) {
			navigate(routes.dashboard())
		} else {
			navigate("/dashboard")
		}
	}

	return (
		<OnboardingFlow
			onComplete={handleOnboardingComplete}
			onAddMoreInterviews={handleAddMoreInterviews}
			onViewResults={handleViewResults}
			projectId={projectId || undefined}
		/>
	)
}
