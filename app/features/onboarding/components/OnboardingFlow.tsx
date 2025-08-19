import { useState } from "react"
import ProcessingScreen from "./ProcessingScreen"
import ProjectStatusScreen from "./ProjectStatusScreen"
import QuestionsScreen from "./QuestionsScreen"
import UploadScreen from "./UploadScreen"
import WelcomeScreen from "./WelcomeScreen"

export type OnboardingStep = "welcome" | "questions" | "upload" | "processing" | "complete"

interface OnboardingData {
	icp: string
	role: string
	goal: string
	customGoal?: string
	questions: string[]
	file?: File
	mediaType?: string
	interviewId?: string
	projectId?: string
}

interface OnboardingFlowProps {
	onComplete: (data: OnboardingData) => void
	onAddMoreInterviews: () => void
	onViewResults: () => void
	projectId?: string
}

export default function OnboardingFlow({
	onComplete,
	onAddMoreInterviews,
	onViewResults,
	projectId,
}: OnboardingFlowProps) {
	const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome")
	const [data, setData] = useState<OnboardingData>({
		icp: "",
		role: "",
		goal: "",
		questions: [],
	})

	const handleWelcomeNext = (welcomeData: { icp: string; role: string; goal: string; customGoal?: string }) => {
		setData((prev) => ({ ...prev, ...welcomeData }))
		setCurrentStep("questions")
	}

	const handleQuestionsNext = (questions: string[]) => {
		setData((prev) => ({ ...prev, questions }))
		setCurrentStep("upload")
	}

	const handleUploadNext = async (file: File, mediaType: string, uploadProjectId?: string) => {
		const updatedData = { ...data, file, mediaType }
		setData(updatedData)
		setCurrentStep("processing")

		try {
			// Create FormData for the API call
			const formData = new FormData()
			formData.append("file", file)
			formData.append(
				"onboardingData",
				JSON.stringify({
					icp: data.icp,
					role: data.role,
					goal: data.goal,
					customGoal: data.customGoal,
					questions: data.questions,
					mediaType,
				})
			)
			// accountId will be retrieved from authenticated user by API
			if (uploadProjectId) {
				formData.append("projectId", uploadProjectId)
			}

			// Call the new onboarding-start API
			const response = await fetch("/api/onboarding-start", {
				method: "POST",
				body: formData,
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || "Upload failed")
			}

			const result = await response.json()

			// Store interview ID and project ID for progress tracking
			if (result.interview?.id) {
				setData((prev) => ({ ...prev, interviewId: result.interview.id }))
			}
			if (result.project?.id) {
				setData((prev) => ({ ...prev, projectId: result.project.id }))
			}
		} catch (error) {
			// Handle error - could show error state or retry
			const errorMessage = error instanceof Error ? error.message : "Upload failed"
			setData((prev) => ({ ...prev, error: errorMessage }))
		}
	}

	const handleProcessingComplete = () => {
		setCurrentStep("complete")
		onComplete(data)
	}

	const handleBack = () => {
		switch (currentStep) {
			case "questions":
				setCurrentStep("welcome")
				break
			case "upload":
				setCurrentStep("questions")
				break
			default:
				break
		}
	}

	// Generate project name from ICP and role
	const getProjectName = () => {
		if (!data.icp) return "New Project"
		if (data.role) {
			return `${data.role} at ${data.icp} Research`
		}
		return `${data.icp} Research`
	}

	switch (currentStep) {
		case "welcome":
			return <WelcomeScreen onNext={handleWelcomeNext} />

		case "questions":
			return (
				<QuestionsScreen
					icp={data.icp}
					role={data.role}
					goal={data.goal}
					onNext={handleQuestionsNext}
					onBack={handleBack}
				/>
			)

		case "upload":
			return <UploadScreen onNext={handleUploadNext} onBack={handleBack} projectId={projectId} />

		case "processing":
			return (
				<ProcessingScreen
					fileName={data.file?.name || "Unknown file"}
					onComplete={handleProcessingComplete}
					interviewId={data.interviewId}
				/>
			)

		case "complete":
			return (
				<ProjectStatusScreen
					projectName={getProjectName()}
					icp={data.icp}
					projectId={data.projectId}
					onAddMore={onAddMoreInterviews}
					onViewResults={onViewResults}
				/>
			)

		default:
			return <WelcomeScreen onNext={handleWelcomeNext} />
	}
}
