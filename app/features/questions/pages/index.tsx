import { AnimatePresence, motion } from "framer-motion"
import { Mic, UploadCloud } from "lucide-react"
import { useCallback, useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useNavigate } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import InterviewQuestionsManager from "~/components/questions/InterviewQuestionsManager"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { ProjectSetupChat } from "~/features/projects/components/ProjectSetupChat"
import { type SetupMode, SetupModeToggle } from "~/features/projects/components/SetupModeToggle"
import { SetupVoiceChat } from "~/features/projects/components/SetupVoiceChat"
import { getProjectContextGeneric } from "~/features/questions/db"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { useRecordNow } from "~/hooks/useRecordNow"
import { getServerClient } from "~/lib/supabase/client.server"

export async function loader({ params, request }: LoaderFunctionArgs) {
	const { projectId } = params
	if (!projectId) {
		return {
			projectName: "Project",
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

	// Load project name
	const { data: project } = await supabase.from("projects").select("name").eq("id", projectId).single()

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
		projectName: project?.name || "Project",
		research_goal,
		target_roles,
		target_orgs,
		assumptions,
		unknowns,
		hasPrompts,
		needsGeneration,
	}
}

// Hide the project status agent sidebar on this page
export const handle = {
	hideProjectStatusAgent: true,
}

export default function QuestionsIndex() {
	const loaderData = useLoaderData<typeof loader>()
	const { accountId, projectId, projectPath } = useCurrentProject()
	const navigate = useNavigate()
	const routes = useProjectRoutes(projectPath)
	const { recordNow, isRecording } = useRecordNow()

	// Mode state: form (default), chat, or voice
	const [mode, setMode] = useState<SetupMode>("form")

	// Voice mode feature flag
	const { isEnabled: isVoiceEnabled } = usePostHogFeatureFlag("ffVoice")

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

	// Context is complete when research_goal is set
	const contextComplete = Boolean(loaderData.research_goal)
	// Questions sub-step is complete when prompts are generated
	const questionsComplete = loaderData.hasPrompts
	// Plan phase is complete when both are done
	const planComplete = contextComplete && questionsComplete

	return (
		<div className="flex min-h-screen flex-col">
			{/* Page header with inline mode toggle */}
			<div className="flex items-center justify-between border-b px-6 py-3">
				<h1 className="font-semibold text-lg">Interview Prompts</h1>
				<SetupModeToggle mode={mode} onModeChange={setMode} showVoice={isVoiceEnabled} />
			</div>

			{/* Content based on mode */}
			<AnimatePresence mode="wait">
				{mode === "form" ? (
					<motion.div
						key="form"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						className="flex-1"
					>
						<PageContainer size="lg" className="py-6">
							<InterviewQuestionsManager
								projectId={projectId}
								projectPath={projectPath}
								research_goal={loaderData.research_goal || undefined}
								target_roles={loaderData.target_roles}
								target_orgs={loaderData.target_orgs}
								assumptions={loaderData.assumptions}
								unknowns={loaderData.unknowns}
							/>

							{/* Ready to collect? CTA section */}
							{questionsComplete && (
								<div className="mt-8 rounded-lg border bg-muted/30 p-6 text-center">
									<h3 className="mb-2 font-semibold text-lg">Ready to start collecting?</h3>
									<p className="mb-4 text-muted-foreground text-sm">
										Your questions are set. Now conduct interviews or upload recordings.
									</p>
									<div className="flex flex-row justify-center gap-3">
										<Button onClick={handleRecordNow} variant="default" disabled={isRecording} className="gap-2">
											<Mic className="h-4 w-4" />
											Record Live
										</Button>
										<Button
											onClick={() => {
												if (routes) {
													navigate(routes.interviews.upload())
												}
											}}
											variant="outline"
											className="gap-2"
										>
											<UploadCloud className="h-4 w-4" />
											Upload Recording
										</Button>
									</div>
								</div>
							)}
						</PageContainer>
					</motion.div>
				) : (
					<motion.div
						key="chat-voice"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						className="flex-1 overflow-y-auto"
					>
						<div className="mx-auto max-w-2xl px-4 py-6">
							{mode === "voice" ? (
								<SetupVoiceChat
									accountId={accountId}
									projectId={projectId}
									projectName={loaderData.projectName}
									onSetupComplete={() => navigate(routes.dashboard())}
								/>
							) : (
								<ProjectSetupChat
									accountId={accountId}
									projectId={projectId}
									projectName={loaderData.projectName}
									onSetupComplete={() => navigate(routes.dashboard())}
									initialMessage="Help me create or refine interview prompts for this project."
								/>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
