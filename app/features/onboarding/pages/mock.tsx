import consola from "consola"
import ProcessingScreen from "../components/ProcessingScreen"
import ProjectGoalsScreen from "../components/ProjectGoalsScreen"
import ProjectStatusScreen from "../components/ProjectStatusScreen"
import QuestionsScreen from "../components/QuestionsScreen"
import UploadScreen from "../components/UploadScreen"

// Mock data for testing components
const mockQuestionsData = {
	icp: "College students",
	goal: "needs",
}

function MockWelcomeScreen() {
	const handleNext = (data: { icp: string; goal: string; customGoal?: string }) => {
		consola.log("Welcome screen next:", data)
	}

	return <ProjectGoalsScreen onNext={handleNext} />
}

function MockQuestionsScreen() {
	const handleNext = (questions: string[]) => {
		consola.log("Questions screen next:", questions)
	}

	const handleBack = () => {
		consola.log("Questions screen back")
	}

	return (
		<QuestionsScreen
			icp={mockQuestionsData.icp}
			goal={mockQuestionsData.goal}
			onNext={handleNext}
			onBack={handleBack}
		/>
	)
}

function MockUploadScreen() {
	const handleNext = (file: File, mediaType: string) => {
		consola.log("Upload screen next:", { fileName: file.name, mediaType })
	}

	const handleBack = () => {
		consola.log("Upload screen back")
	}

	return <UploadScreen onNext={handleNext} onBack={handleBack} />
}

function MockProcessingScreen() {
	const handleComplete = () => {
		consola.log("Processing complete")
	}

	return <ProcessingScreen fileName="customer-interview.mp3" onComplete={handleComplete} />
}

function MockProjectStatusScreen() {
	const handleAddMore = () => {
		consola.log("Add more interviews")
	}

	const handleViewResults = () => {
		consola.log("View results")
	}

	return (
		<ProjectStatusScreen
			projectName="SaaS Founders Research"
			icp="SaaS founders"
			onAddMore={handleAddMore}
			onViewResults={handleViewResults}
		/>
	)
}

// Main page component showing all onboarding screens
export default function OnboardingMockPage() {
	return (
		<div className="min-h-screen bg-gray-50 p-8">
			<div className="mx-auto max-w-4xl space-y-8">
				<div className="text-center">
					<h1 className="font-bold text-3xl text-gray-900">Onboarding Components Showcase</h1>
					<p className="mt-2 text-gray-600">All onboarding screens with mock data for testing</p>
				</div>

				<hr className="border-gray-300" />

				<div>
					<h2 className="mb-4 font-semibold text-gray-800 text-xl">Welcome Screen</h2>
					<div className="rounded-lg border bg-white shadow-sm">
						<MockWelcomeScreen />
					</div>
				</div>

				<hr className="border-gray-300" />

				<div>
					<h2 className="mb-4 font-semibold text-gray-800 text-xl">Questions Screen</h2>
					<div className="rounded-lg border bg-white shadow-sm">
						<MockQuestionsScreen />
					</div>
				</div>

				<hr className="border-gray-300" />

				<div>
					<h2 className="mb-4 font-semibold text-gray-800 text-xl">Upload Screen</h2>
					<div className="rounded-lg border bg-white shadow-sm">
						<MockUploadScreen />
					</div>
				</div>

				<hr className="border-gray-300" />

				<div>
					<h2 className="mb-4 font-semibold text-gray-800 text-xl">Processing Screen</h2>
					<div className="rounded-lg border bg-white shadow-sm">
						<MockProcessingScreen />
					</div>
				</div>

				<hr className="border-gray-300" />

				<div>
					<h2 className="mb-4 font-semibold text-gray-800 text-xl">Project Status Screen</h2>
					<div className="rounded-lg border bg-white shadow-sm">
						<MockProjectStatusScreen />
					</div>
				</div>

				<hr className="border-gray-300" />

				<div className="text-center text-gray-500 text-sm">
					<p>Check browser console for interaction logs</p>
				</div>
			</div>
		</div>
	)
}
