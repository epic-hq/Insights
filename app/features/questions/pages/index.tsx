import { Mic, UploadCloud } from "lucide-react"
import { useCallback } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useSearchParams } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import InterviewQuestionsManager from "~/components/questions/InterviewQuestionsManager"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { OnboardingStepper } from "~/features/onboarding/components/OnboardingStepper"
import { getProjectContextGeneric } from "~/features/questions/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { useRecordNow } from "~/hooks/useRecordNow"
import { getServerClient } from "~/lib/supabase/client.server"

export async function loader({ params, request }: LoaderFunctionArgs) {
	const { projectId } = params
	if (!projectId) {
		return {
			research_goal: null,
			target_roles: [],
			target_orgs: [],
			assumptions: [],
			unknowns: [],
			hasPrompts: false,
			needsGeneration: false,
		}
	}

	const { client: supabase } = getServerClient(request)

	// Load full project context using the generic helper
	const projectContext = await getProjectContextGeneric(supabase, projectId)
	const merged = projectContext?.merged || {}

	// Check if interview_prompts exist
	const { data: prompts } = await supabase.from("interview_prompts").select("id").eq("project_id", projectId).limit(1)

	const hasPrompts = (prompts?.length ?? 0) > 0

	// Extract arrays safely
	const toStringArray = (val: unknown): string[] => {
		if (Array.isArray(val)) return val.filter((v) => typeof v === "string")
		return []
	}

	const research_goal = typeof merged.research_goal === "string" ? merged.research_goal : null
	const target_roles = toStringArray(merged.target_roles)
	const target_orgs = toStringArray(merged.target_orgs)
	const assumptions = toStringArray(merged.assumptions)
	const unknowns = toStringArray(merged.unknowns)

	// Determine if we need to auto-generate
	const needsGeneration = !hasPrompts && !!research_goal && target_roles.length > 0

	return {
		research_goal,
		target_roles,
		target_orgs,
		assumptions,
		unknowns,
		hasPrompts,
		needsGeneration,
	}
}

export default function QuestionsIndex() {
	const loaderData = useLoaderData<typeof loader>()
	const { projectId, projectPath } = useCurrentProject()
	const [params] = useSearchParams()
	const isOnboarding = params.get("onboarding") === "1"
	const routes = useProjectRoutes(projectPath)
	const { recordNow, isRecording } = useRecordNow()

	const handleRecordNow = useCallback(() => {
		if (projectId) {
			recordNow({ projectId })
		}
	}, [projectId, recordNow])

	if (!projectId) {
		return (
			<div className="mx-auto max-w-7xl p-4 sm:p-8">
				<div className="text-center">
					<p className="text-gray-500">Loading project...</p>
				</div>
			</div>
		)
	}

	return (
		<PageContainer size="lg">
			{isOnboarding && (
				<div className="mb-8">
					<OnboardingStepper
						steps={[
							{ id: "goals", title: "Project Goals", href: routes.projects.setup() },
							{ id: "questions", title: "Questions", href: routes.questions.index() },
							{ id: "upload", title: "Upload", href: routes.interviews.upload() },
						]}
						currentStepId="questions"
					/>
				</div>
			)}

			<InterviewQuestionsManager
				projectId={projectId}
				projectPath={projectPath}
				research_goal={loaderData.research_goal || undefined}
				target_roles={loaderData.target_roles}
				target_orgs={loaderData.target_orgs}
				assumptions={loaderData.assumptions}
				unknowns={loaderData.unknowns}
			/>
			<div className="flex flex-row justify-center gap-3 p-4">
				<Button
					onClick={handleRecordNow}
					variant="default"
					disabled={isRecording}
					className="mx-auto max-w-sm justify-center border-red-600 bg-red-700 hover:bg-red-700"
				>
					<Mic className="mr-2 h-4 w-4" />
					Record Live
				</Button>
				<Button
					onClick={() => {
						if (routes) {
							window.location.href = routes.interviews.upload()
						}
					}}
					variant="default"
					// disabled={questionPack.questions.length === 0}
					className="mx-auto max-w-sm justify-center border-red-600 bg-blue-700 hover:bg-blue-700"
				>
					<UploadCloud className="mr-2 h-4 w-4" />
					Upload Audio / Transcript
				</Button>
			</div>
		</PageContainer>
	)
}
