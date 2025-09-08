import { useState } from "react"
import ProcessingScreen from "./ProcessingScreen"
import ProjectGoalsScreen from "./ProjectGoalsScreen"
import ProjectStatusScreen from "./ProjectStatusScreen"
import QuestionsScreen from "./QuestionsScreen"
import UploadScreen from "./UploadScreen"

export type OnboardingStep = "welcome" | "questions" | "upload" | "processing" | "complete"

export interface OnboardingData {
	target_orgs: string[]
	target_roles: string[]
	research_goal: string
	research_goal_details: string
	decision_questions: string[]
	assumptions: string[]
	unknowns: string[]
	custom_instructions?: string
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
	onRefresh?: () => void
	projectId?: string
	accountId?: string
	existingProject?: {
		name: string
		target_orgs: string[]
		target_roles: string[]
		research_goal: string
		research_goal_details: string
		decision_questions: string[]
		assumptions: string[]
		unknowns: string[]
		custom_instructions?: string
		questions: string[]
	}
}

export default function OnboardingFlow({
	onComplete,
	onAddMoreInterviews,
	onViewResults,
	onRefresh,
	projectId,
	accountId,
	existingProject,
}: OnboardingFlowProps) {
	// Start at upload step if we have existing project context
	const [currentStep, setCurrentStep] = useState<OnboardingStep>(existingProject ? "upload" : "welcome")
	// TODO: use form library to parse form data, and loader to fetch data
	const [data, setData] = useState<OnboardingData>({
		target_orgs: existingProject?.target_orgs || [],
		target_roles: existingProject?.target_roles || [],
		research_goal: existingProject?.research_goal || "",
		research_goal_details: existingProject?.research_goal_details || "",
		decision_questions: existingProject?.decision_questions || [],
		assumptions: existingProject?.assumptions || [],
		unknowns: existingProject?.unknowns || [],
		custom_instructions: existingProject?.custom_instructions,
		questions: existingProject?.questions || [],
		projectId,
	})

	const handleWelcomeNext = async (welcomeData: {
		target_orgs: string[]
		target_roles: string[]
		research_goal: string
		research_goal_details: string
		decision_questions: string[]
		assumptions: string[]
		unknowns: string[]
		custom_instructions?: string
		projectId?: string
	}) => {
		// Update data with welcome data and projectId if provided
		setData((prev) => ({
			...prev,
			...welcomeData,
			projectId: welcomeData.projectId || prev.projectId || projectId,
		}))

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
					target_orgs: data.target_orgs,
					target_roles: data.target_roles,
					research_goal: data.research_goal,
					research_goal_details: data.research_goal_details,
					decision_questions: data.decision_questions,
					assumptions: data.assumptions,
					unknowns: data.unknowns,
					custom_instructions: data.custom_instructions,
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

	// Generate project name from target orgs and roles
	const getProjectName = () => {
		if (data.target_orgs.length === 0) return "New Project"
		if (data.target_roles.length > 0) {
			return `${data.target_roles[0]} at ${data.target_orgs[0]} Research`
		}
		return `${data.target_orgs[0]} Research`
	}

	// Use the most current projectId - either from data (newly created) or props (existing)
	const currentProjectId = data.projectId || projectId

	switch (currentStep) {
		case "welcome":
			return <ProjectGoalsScreen onNext={handleWelcomeNext} projectId={currentProjectId} />

		case "questions":
			return (
				<QuestionsScreen
					target_orgs={data.target_orgs}
					target_roles={data.target_roles}
					research_goal={data.research_goal}
					research_goal_details={data.research_goal_details}
					decision_questions={data.decision_questions}
					assumptions={data.assumptions}
					unknowns={data.unknowns}
					custom_instructions={data.custom_instructions}
					onNext={handleQuestionsNext}
					onBack={handleBack}
				/>
			)

		case "upload":
			return <UploadScreen onNext={handleUploadNext} onBack={handleBack} projectId={currentProjectId} />

		case "processing":
			return (
				<ProcessingScreen
					fileName={data.file?.name || "Unknown file"}
					onComplete={handleProcessingComplete}
					interviewId={data.interviewId}
				/>
			)

		case "complete":
			return <ProjectStatusScreen projectName={getProjectName()} projectId={data.projectId} accountId={accountId} />

		default:
			return <ProjectGoalsScreen onNext={handleWelcomeNext} projectId={currentProjectId} />
	}
}
