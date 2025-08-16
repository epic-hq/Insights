import { useState } from "react"
import ProcessingScreen from "./ProcessingScreen"
import ProjectStatusScreen from "./ProjectStatusScreen"
import QuestionsScreen from "./QuestionsScreen"
import UploadScreen from "./UploadScreen"
import WelcomeScreen from "./WelcomeScreen"

export type OnboardingStep = "welcome" | "questions" | "upload" | "processing" | "complete"

interface OnboardingData {
	icp: string
	goal: string
	customGoal?: string
	questions: string[]
	file?: File
	mediaType?: string
}

interface OnboardingFlowProps {
	onComplete: (data: OnboardingData) => void
	onAddMoreInterviews: () => void
	onViewResults: () => void
}

export default function OnboardingFlow({ onComplete, onAddMoreInterviews, onViewResults }: OnboardingFlowProps) {
	const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome")
	const [data, setData] = useState<OnboardingData>({
		icp: "",
		goal: "",
		questions: [],
	})

	const handleWelcomeNext = (welcomeData: { icp: string; goal: string; customGoal?: string }) => {
		setData((prev) => ({ ...prev, ...welcomeData }))
		setCurrentStep("questions")
	}

	const handleQuestionsNext = (questions: string[]) => {
		setData((prev) => ({ ...prev, questions }))
		setCurrentStep("upload")
	}

	const handleUploadNext = (file: File, mediaType: string) => {
		const updatedData = { ...data, file, mediaType }
		setData(updatedData)
		setCurrentStep("processing")

		// Start the actual upload/processing here
		// In a real app, this would trigger the backend processing
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

	// Generate project name from ICP
	const getProjectName = () => {
		if (!data.icp) return "New Project"
		return `${data.icp} Research`
	}

	switch (currentStep) {
		case "welcome":
			return <WelcomeScreen onNext={handleWelcomeNext} />

		case "questions":
			return <QuestionsScreen icp={data.icp} goal={data.goal} onNext={handleQuestionsNext} onBack={handleBack} />

		case "upload":
			return <UploadScreen onNext={handleUploadNext} onBack={handleBack} />

		case "processing":
			return <ProcessingScreen fileName={data.file?.name || "Unknown file"} onComplete={handleProcessingComplete} />

		case "complete":
			return (
				<ProjectStatusScreen
					projectName={getProjectName()}
					icp={data.icp}
					onAddMore={onAddMoreInterviews}
					onViewResults={onViewResults}
				/>
			)

		default:
			return <WelcomeScreen onNext={handleWelcomeNext} />
	}
}
