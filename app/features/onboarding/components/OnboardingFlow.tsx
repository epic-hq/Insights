import { useCallback, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Button } from "~/components/ui/button"
import ProcessingScreen from "./ProcessingScreen"
import ProjectGoalsScreen from "./ProjectGoalsScreen"
import ProjectStatusScreen from "./ProjectStatusScreen"
import QuestionsScreen from "./QuestionsScreen"
import UploadScreen from "./UploadScreen"

type OnboardingStep = "welcome" | "questions" | "upload" | "processing" | "complete"

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
	triggerRunId?: string
	triggerAccessToken?: string | null
	error?: string
	personId?: string
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
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const isOnboarding = searchParams.get("onboarding") === "true"
	const preselectedPersonId = searchParams.get("personId") ?? undefined

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
		triggerAccessToken: null,
		personId: preselectedPersonId,
	})

	const handleWelcomeNext = useCallback(
		async (welcomeData: {
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
		},
		[projectId]
	)

	const handleQuestionsNext = useCallback((questions: string[]) => {
		setData((prev) => ({ ...prev, questions }))
		setCurrentStep("upload")
	}, [])

	const handleUploadNext = useCallback(
		async (file: File, mediaType: string, uploadProjectId?: string) => {
			const updatedData = { ...data, file, mediaType, triggerRunId: undefined, triggerAccessToken: null }
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
				if (data.personId) {
					formData.append("personId", data.personId)
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

				// Redirect to interview page immediately after upload completes
				// Processing will continue in the background via Trigger.dev
				if (result.interview?.id && result.project?.id) {
					// Use accountId from props, or extract from API response if available
					const finalAccountId = accountId || result.interview?.account_id || result.project?.account_id
					console.log("OnboardingFlow redirect:", {
						accountId,
						finalAccountId,
						projectId: result.project.id,
						interviewId: result.interview.id,
					})

					if (!finalAccountId) {
						console.error("No accountId available for redirect!")
						// Don't redirect if we don't have an accountId
						return
					}

					const interviewUrl = `/a/${finalAccountId}/${result.project.id}/interviews/${result.interview.id}`
					console.log("Redirecting to:", interviewUrl)
					window.location.href = interviewUrl
					return
				}

				// Fallback: Store interview ID and project ID for progress tracking (legacy flow)
				if (result.interview?.id) {
					setData((prev) => ({ ...prev, interviewId: result.interview.id }))
				}
				if (result.project?.id) {
					setData((prev) => ({ ...prev, projectId: result.project.id }))
				}
				if (result.triggerRun?.id) {
					setData((prev) => ({
						...prev,
						triggerRunId: result.triggerRun.id,
						triggerAccessToken: result.triggerRun.publicToken ?? null,
					}))

					if (!result.triggerRun.publicToken) {
						try {
							const tokenResponse = await fetch("/api/trigger-run-token", {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ runId: result.triggerRun.id }),
							})

							if (tokenResponse.ok) {
								const tokenData = (await tokenResponse.json()) as { token?: string }
								if (tokenData.token) {
									setData((prev) => ({
										...prev,
										triggerAccessToken: tokenData.token ?? null,
									}))
								}
							}
						} catch (tokenError) {
							console.error("Failed to fetch Trigger.dev token", tokenError)
						}
					}
				}
			} catch (error) {
				// Handle error - show error message and return to upload screen
				const errorMessage = error instanceof Error ? error.message : "Upload failed"
				setData((prev) => ({ ...prev, error: errorMessage }))
				setCurrentStep("upload") // Return to upload screen so user can retry
			}
		},
		[data]
	)

	const handleProcessingComplete = useCallback(() => {
		setCurrentStep("complete")
		onComplete(data)
	}, [data, onComplete])

	const handleBack = useCallback(() => {
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
	}, [currentStep])

	// Generate project name from target orgs and roles
	const getProjectName = useCallback(() => {
		if (data.target_orgs.length === 0) return "New Project"
		if (data.target_roles.length > 0) {
			return `${data.target_roles[0]} at ${data.target_orgs[0]} Research`
		}
		return `${data.target_orgs[0]} Research`
	}, [data.target_orgs, data.target_roles])

	// Handle exit from onboarding
	const handleExit = useCallback(() => {
		if (isOnboarding) {
			// Exit onboarding and go to home - remove onboarding param
			navigate("/home")
		} else {
			// Regular navigation behavior
			navigate(-1)
		}
	}, [isOnboarding, navigate])

	// Use the most current projectId - either from data (newly created) or props (existing)
	const currentProjectId = useMemo(() => data.projectId || projectId, [data.projectId, projectId])

	// Render navigation controls for onboarding mode
	const renderOnboardingHeader = useCallback(() => {
		if (!isOnboarding) return null

		return (
			<div className="flex items-center justify-between border-b p-4">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="sm" onClick={handleExit}>
						← Exit Onboarding
					</Button>
					<div className="text-muted-foreground text-sm">
						Step {currentStep === "welcome" ? 1 : currentStep === "questions" ? 2 : currentStep === "upload" ? 3 : 4} of
						4
					</div>
				</div>
			</div>
		)
	}, [isOnboarding, handleExit, currentStep])

	const stepContent = useMemo(() => {
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
				return (
					<UploadScreen onNext={handleUploadNext} onBack={handleBack} projectId={currentProjectId} error={data.error} />
				)

			case "processing":
				return (
					<ProcessingScreen
						fileName={data.file?.name || "Unknown file"}
						onComplete={handleProcessingComplete}
						interviewId={data.interviewId}
						triggerRunId={data.triggerRunId}
						triggerAccessToken={data.triggerAccessToken ?? undefined}
					/>
				)

			case "complete":
				return <ProjectStatusScreen projectName={getProjectName()} projectId={data.projectId} accountId={accountId} />

			default:
				return <ProjectGoalsScreen onNext={handleWelcomeNext} projectId={currentProjectId} />
		}
	}, [
		currentStep,
		handleWelcomeNext,
		currentProjectId,
		data,
		handleQuestionsNext,
		handleBack,
		handleUploadNext,
		handleProcessingComplete,
		getProjectName,
		accountId,
	])

	return (
		<div className="min-h-screen bg-background">
			{renderOnboardingHeader()}
			{stepContent}
		</div>
	)
}
