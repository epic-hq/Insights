/**
 * Unified Project Setup Page - Voice-First Design
 *
 * Combines voice, chat, and form modes for setting up project context.
 * Entry point shows ChatGPT-like input with mode options.
 * All modes share state via ProjectSetupProvider and sync in real-time.
 *
 * Modes:
 * - Entry: SetupModeSelector with voice/chat/form options
 * - Voice: VoiceOrb with CapturedPanel (LiveKit integration)
 * - Chat: ProjectSetupChat with AI conversation
 * - Form: TypeformQuestion one-question-at-a-time flow
 */

// Soft import baml client (works even if new function not generated yet)
import { b } from "baml_client"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useFetcher, useLoaderData, useNavigate, useOutletContext } from "react-router"
import type { AppLayoutOutletContext } from "~/components/layout/AppLayout"
import { PageContainer } from "~/components/layout/PageContainer"
import ProjectGoalsScreenRedesigned from "~/features/onboarding/components/ProjectGoalsScreenRedesigned"
import { MethodSettingsButton } from "~/features/projects/components/InputChannelSettings"
import { ProjectSetupChat } from "~/features/projects/components/ProjectSetupChat"
import { SetupModeSelector } from "~/features/projects/components/SetupModeSelector"
import { type SetupMode, SetupModeToggle } from "~/features/projects/components/SetupModeToggle"
import { SetupVoiceChat } from "~/features/projects/components/SetupVoiceChat"
import { TypeformQuestion } from "~/features/projects/components/TypeformQuestion"
import { ProjectSetupProvider, useProjectSections } from "~/features/projects/contexts/project-setup-context"
import { getProjectById } from "~/features/projects/db"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

type TemplatePrefill = {
	template_key: string
	customer_problem: string
	target_orgs: string[]
	target_roles: string[]
	offerings: string
	competitors: string[]
	research_goal: string
	research_goal_details: string
	decision_questions: string[]
	assumptions: string[]
	unknowns: string[]
	custom_instructions: string
}

type SignupData = {
	goal?: unknown
	challenges?: unknown
	custom_instructions?: string
} & Record<string, unknown>

function fallbackPrefill(templateKey: string, projectName: string, signup: SignupData): TemplatePrefill {
	const goalFromSignup = (signup?.goal || "").toString().trim()
	const challenges = (signup?.challenges || "").toString().trim()
	const _inferredGoal = goalFromSignup || `Understand customer needs for ${projectName}`

	const pre: TemplatePrefill = {
		template_key: templateKey,
		customer_problem: "",
		target_orgs: [],
		target_roles: [],
		offerings: "",
		competitors: [],
		research_goal: goalFromSignup || "",
		research_goal_details: challenges || "",
		decision_questions: [],
		assumptions: [],
		unknowns: [],
		custom_instructions: "",
	}

	return pre
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const projectId = params.projectId

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 })
	}

	// Verify project exists and user has access
	const projectResult = await getProjectById({
		supabase: ctx.supabase,
		id: projectId,
	})

	if (!projectResult.data) {
		throw new Response("Project not found", { status: 404 })
	}

	// Fetch account company context for context panel
	let accountData: {
		website_url?: string | null
		company_description?: string | null
		customer_problem?: string | null
		offerings?: string[] | null
		target_orgs?: string[] | null
		target_roles?: string[] | null
	} | null = null
	let hasCompanyContext = false

	if (ctx.supabase) {
		const { data } = await ctx.supabase
			.schema("accounts")
			.from("accounts")
			.select("website_url, company_description, customer_problem, offerings, target_orgs, target_roles")
			.eq("id", accountId)
			.single()

		accountData = data
		hasCompanyContext = Boolean(
			data?.company_description ||
				data?.customer_problem ||
				(Array.isArray(data?.offerings) && data.offerings.length > 0)
		)
	}

	// Default template: Understand Customer Needs
	const template_key = "understand_customer_needs"
	const signup: SignupData = { ...(ctx.user_settings?.signup_data || {}) }

	// Allow optional prefill instructions via query param for quick re-runs
	try {
		const url = new URL(request.url)
		const extra = url.searchParams.get("prefillInstructions")
		if (extra && extra.trim().length > 0) {
			signup.custom_instructions = String(extra)
		}
	} catch {}

	let prefill: TemplatePrefill = fallbackPrefill(template_key, projectResult.data.name || "Project", signup)
	try {
		// Try BAML-based prefill if available
		// @ts-expect-error - function may not exist until baml generate runs
		if (b?.FillProjectTemplate) {
			const filled = await b.FillProjectTemplate({
				inputs: {
					template_key,
					signup_data: JSON.stringify(signup || {}),
					project_name: projectResult.data.name || "Project",
				},
			})
			// Basic normalization/guards
			prefill = {
				template_key: filled.template_key || template_key,
				customer_problem: filled.customer_problem || prefill.customer_problem,
				target_orgs: (filled.target_orgs || []).slice(0, 3),
				target_roles: (filled.target_roles || []).slice(0, 8),
				offerings: filled.offerings || prefill.offerings,
				competitors: (filled.competitors || []).slice(0, 8),
				research_goal: filled.research_goal || prefill.research_goal,
				research_goal_details: filled.research_goal_details || prefill.research_goal_details,
				decision_questions: (filled.decision_questions || prefill.decision_questions).slice(0, 6),
				assumptions: (filled.assumptions || prefill.assumptions).slice(0, 8),
				unknowns: (filled.unknowns || prefill.unknowns).slice(0, 8),
				custom_instructions: filled.custom_instructions || prefill.custom_instructions,
			}
		}
	} catch (_e) {
		// Ignore and use fallback
	}

	// Fetch existing project sections for initial state
	const initialSections: Record<string, unknown> = {}
	if (ctx.supabase) {
		const { data: sections } = await ctx.supabase
			.from("project_sections")
			.select("kind, content_md, meta")
			.eq("project_id", projectId)

		// Transform sections into initial data for the store
		if (sections) {
			for (const section of sections) {
				const meta = section.meta as Record<string, unknown> | null
				// Extract value from meta or content_md
				const value = meta?.[section.kind] ?? section.content_md ?? ""
				initialSections[section.kind] = value
			}
		}
	}

	return {
		project: projectResult.data,
		accountId,
		projectId,
		template_key,
		prefill,
		initialSections,
		hasCompanyContext,
		accountData,
	}
}

// Hide the project status agent sidebar on this page (we have our own chat)
export const handle = {
	hideProjectStatusAgent: true,
}

// Company context questions (for new accounts) - asked FIRST
const COMPANY_QUESTIONS = [
	{
		key: "website_url",
		question: "What's your company website?",
		description: "We'll auto-fill your company info from your website. Or skip to describe manually.",
		fieldType: "url" as const,
		required: false,
		placeholder: "https://yourcompany.com",
		hasAutoResearch: true,
	},
	{
		key: "company_description",
		question: "What does your company do?",
		description: "A brief description of your business (1-2 sentences).",
		fieldType: "textarea" as const,
		required: false,
		showSTT: true,
		skipIfPrefilled: true, // Skip if auto-filled from URL research
	},
	{
		key: "customer_problem",
		question: "What problem do you solve for customers?",
		description: "The main pain point or challenge you help with.",
		fieldType: "textarea" as const,
		required: false,
		showSTT: true,
		skipIfPrefilled: true,
	},
	{
		key: "target_orgs",
		question: "Who are your target customers?",
		description: "Industries or types of organizations you serve.",
		fieldType: "tags" as const,
		required: false,
		suggestionType: "organizations" as const,
		skipIfPrefilled: true,
	},
	{
		key: "target_roles",
		question: "What roles do you typically sell to or talk with?",
		description: "Job titles of your buyers or users.",
		fieldType: "tags" as const,
		required: false,
		suggestionType: "roles" as const,
		skipIfPrefilled: true,
	},
]

// Project-specific questions (asked AFTER company context)
const PROJECT_QUESTIONS = [
	{
		key: "research_goal",
		question: "What are you trying to learn from this research?",
		description: "Be specific about your research goals and what decisions you're trying to make.",
		fieldType: "textarea" as const,
		required: true,
		showSTT: true,
		suggestionType: "decision_questions" as const,
	},
]

// Legacy alias for compatibility
const SETUP_QUESTIONS = PROJECT_QUESTIONS

// Captured panel items for voice/chat mode
const CAPTURED_ITEMS = [
	{
		key: "research_goal",
		label: "Research goal",
		status: "pending" as const,
		required: true,
	},
	{
		key: "customer_problem",
		label: "Customer problem",
		status: "pending" as const,
	},
	{ key: "target_orgs", label: "Target audience", status: "pending" as const },
	{ key: "target_roles", label: "Target roles", status: "pending" as const },
]

export default function ProjectSetupPage() {
	const { project, accountId, projectId, template_key, prefill, initialSections, hasCompanyContext, accountData } =
		useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)
	const outletContext = useOutletContext<AppLayoutOutletContext | undefined>()
	const companyFetcher = useFetcher()
	const researchFetcher = useFetcher()

	// Collapse sidebar during setup for cleaner experience
	// Extract the function reference to avoid re-running effect on every render
	const setForceSidebarCollapsed = outletContext?.setForceSidebarCollapsed
	useEffect(() => {
		setForceSidebarCollapsed?.(true)
		return () => {
			setForceSidebarCollapsed?.(false)
		}
	}, [setForceSidebarCollapsed])

	// Voice mode feature flag
	const { isEnabled: isVoiceEnabled } = usePostHogFeatureFlag("ffVoice")

	// Mode: "chat" is now the default - we skip the entry screen per v2 spec
	// The conversation IS the onboarding, with tappable suggested responses
	const [mode, setMode] = useState<SetupMode | null>("chat")

	// Form phase: "company" (if needed) then "project"
	const [formPhase, setFormPhase] = useState<"company" | "project">(hasCompanyContext ? "project" : "company")
	const [formStep, setFormStep] = useState(0)
	const [formDirection, setFormDirection] = useState(1)
	const [isResearching, setIsResearching] = useState(false)

	// Company context values (for new accounts)
	const [companyValues, setCompanyValues] = useState<Record<string, string | string[]>>({
		website_url: "",
		company_description: "",
		customer_problem: "",
		target_orgs: [],
		target_roles: [],
	})

	// Project values
	const [formValues, setFormValues] = useState<Record<string, string | string[]>>(() => {
		// Initialize from prefill or initialSections
		const initial: Record<string, string | string[]> = {}
		for (const q of SETUP_QUESTIONS) {
			const existing = initialSections[q.key]
			if (existing) {
				initial[q.key] = Array.isArray(existing) ? existing : String(existing)
			} else if (q.fieldType === "tags") {
				initial[q.key] = []
			} else {
				initial[q.key] = ""
			}
		}
		// Apply prefill values
		if (prefill.research_goal) initial.research_goal = prefill.research_goal
		if (prefill.customer_problem) initial.customer_problem = prefill.customer_problem
		if (prefill.target_orgs?.length) initial.target_orgs = prefill.target_orgs
		if (prefill.target_roles?.length) initial.target_roles = prefill.target_roles
		return initial
	})

	// Get current questions based on phase
	const currentQuestions = formPhase === "company" ? COMPANY_QUESTIONS : PROJECT_QUESTIONS
	const currentQuestion = currentQuestions[formStep]
	const currentValues = formPhase === "company" ? companyValues : formValues

	// Handle URL research results
	useEffect(() => {
		if (researchFetcher.state === "idle" && researchFetcher.data) {
			setIsResearching(false)
			const result = researchFetcher.data as {
				success?: boolean
				error?: string
				data?: {
					description?: string
					customer_problem?: string
					offerings?: string[]
					target_orgs?: string[]
					industry?: string
				}
			}
			if (result.success && result.data) {
				// Auto-fill company values from research
				setCompanyValues((prev) => ({
					...prev,
					company_description: result.data?.description || prev.company_description,
					customer_problem: result.data?.customer_problem || prev.customer_problem,
					target_orgs: result.data?.target_orgs || prev.target_orgs,
				}))
			}
		}
	}, [researchFetcher.state, researchFetcher.data])

	// Research company website
	const handleResearchWebsite = (url: string) => {
		if (!url?.trim()) return
		setIsResearching(true)
		const formData = new FormData()
		formData.append("intent", "research_website")
		formData.append("website_url", url)
		researchFetcher.submit(formData, {
			method: "POST",
			action: `/a/${accountId}/settings`,
		})
	}

	// Save company context to account
	const saveCompanyContext = () => {
		const formData = new FormData()
		formData.append("intent", "update_company_context")
		formData.append(
			"payload",
			JSON.stringify({
				website_url: companyValues.website_url || null,
				company_description: companyValues.company_description || null,
				customer_problem: companyValues.customer_problem || null,
				target_orgs: companyValues.target_orgs || null,
				target_roles: companyValues.target_roles || null,
			})
		)
		companyFetcher.submit(formData, {
			method: "POST",
			action: `/a/${accountId}/settings`,
		})
	}

	// Save project sections to database
	const saveProjectSections = async () => {
		const sections = [
			{ kind: "research_goal", data: formValues.research_goal },
			{ kind: "research_goal_details", data: formValues.research_goal_details },
			{ kind: "decision_questions", data: formValues.decision_questions },
			{ kind: "assumptions", data: formValues.assumptions },
			{ kind: "unknowns", data: formValues.unknowns },
		]

		for (const section of sections) {
			if (section.data && (Array.isArray(section.data) ? section.data.length > 0 : section.data)) {
				const formData = new FormData()
				formData.append("action", "save-section")
				formData.append("projectId", projectId)
				formData.append("sectionKind", section.kind)
				formData.append("sectionData", JSON.stringify(section.data))

				await fetch("/api/save-project-goals", {
					method: "POST",
					body: formData,
					credentials: "include",
				})
			}
		}
	}

	// Captured panel state - temporarily disabled to simplify UI
	// const capturedPanel = useCapturedPanel(
	//   CAPTURED_ITEMS.map((item) => {
	//     const value = initialSections[item.key];
	//     const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value);
	//     return {
	//       ...item,
	//       status: hasValue ? ("complete" as const) : ("pending" as const),
	//       preview: hasValue
	//         ? Array.isArray(value)
	//           ? value.slice(0, 2).join(", ")
	//           : String(value).slice(0, 50)
	//         : undefined,
	//     };
	//   }),
	// );

	const handleNext = () => {
		// After form, go to questions step inside project context
		const dest = routes.questions.index()
		const url = dest.includes("?") ? `${dest}&onboarding=1` : `${dest}?onboarding=1`
		navigate(url)
	}

	const handleSetupComplete = () => {
		// Navigate to dashboard after setup
		navigate(routes.dashboard())
	}

	const handleModeSelect = (selectedMode: SetupMode) => {
		setMode(selectedMode)
	}

	const handleFormNext = () => {
		// Check if we need to skip questions that were pre-filled by URL research
		const getNextStep = (currentStep: number): number => {
			let nextStep = currentStep + 1
			if (formPhase === "company") {
				// Skip questions that are already filled from URL research
				while (nextStep < COMPANY_QUESTIONS.length) {
					const nextQ = COMPANY_QUESTIONS[nextStep]
					const value = companyValues[nextQ.key]
					const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value)
					if (nextQ.skipIfPrefilled && hasValue) {
						nextStep++
					} else {
						break
					}
				}
			}
			return nextStep
		}

		const nextStep = getNextStep(formStep)

		if (nextStep < currentQuestions.length) {
			setFormDirection(1)
			setFormStep(nextStep)
		} else if (formPhase === "company") {
			// Company phase done - save and move to project phase
			saveCompanyContext()
			setFormPhase("project")
			setFormStep(0)
			setFormDirection(1)
		} else {
			// All questions done - save sections then go to questions generation
			saveProjectSections().then(() => {
				handleNext()
			})
		}
	}

	const handleFormBack = () => {
		if (formStep > 0) {
			setFormDirection(-1)
			setFormStep((s) => s - 1)
		} else if (formPhase === "project" && !hasCompanyContext) {
			// Go back to company phase
			setFormPhase("company")
			setFormStep(COMPANY_QUESTIONS.length - 1)
			setFormDirection(-1)
		}
	}

	const handleFormSkip = () => {
		handleFormNext()
	}

	const handleFormChange = (key: string, value: string | string[]) => {
		if (formPhase === "company") {
			setCompanyValues((prev) => ({ ...prev, [key]: value }))
		} else {
			setFormValues((prev) => ({ ...prev, [key]: value }))
		}
	}

	// State to hold initial message for chat
	const [initialChatMessage, setInitialChatMessage] = useState<string | null>(null)

	// Calculate form mode values
	const companyStepCount = hasCompanyContext ? 0 : COMPANY_QUESTIONS.length
	const totalSteps = companyStepCount + PROJECT_QUESTIONS.length
	const currentStepNumber = formPhase === "company" ? formStep + 1 : companyStepCount + formStep + 1
	const isUrlQuestion = currentQuestion?.key === "website_url"

	// Render mode content with smooth fade transitions
	const renderModeContent = () => {
		// Entry screen - no mode selected
		if (mode === null) {
			return (
				<motion.div
					key="entry"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15 }}
					className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30"
				>
					<SetupModeSelector
						onStartChat={(message) => {
							setInitialChatMessage(message)
							setMode("chat")
						}}
						onUpload={() => navigate(routes.interviews.upload())}
						onExplore={() => navigate(routes.dashboard())}
						transcribeEnabled={true}
					/>
				</motion.div>
			)
		}

		// Form mode - simplified with journey header only
		if (mode === "form") {
			return (
				<motion.div
					key="form"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15 }}
					className="flex min-h-screen flex-col"
				>
					{/* Page header with inline mode toggle */}
					<div className="flex items-center justify-between border-b px-6 py-3">
						<h1 className="font-semibold text-lg">Project Context</h1>
						<SetupModeToggle mode={mode} onModeChange={(m) => setMode(m as SetupMode)} showVoice={isVoiceEnabled} />
					</div>

					{/* Main content - full width, no sidebar */}
					<div className="flex-1 overflow-y-auto">
						<div className="mx-auto max-w-2xl px-4 py-6">
							<AnimatePresence mode="wait">
								{currentQuestion && (
									<TypeformQuestion
										key={`${formPhase}-${currentQuestion.key}`}
										question={currentQuestion.question}
										description={currentQuestion.description}
										fieldType={currentQuestion.fieldType}
										value={currentValues[currentQuestion.key] || (currentQuestion.fieldType === "tags" ? [] : "")}
										onChange={(value) => handleFormChange(currentQuestion.key, value)}
										onNext={handleFormNext}
										onBack={
											formStep > 0 || (formPhase === "project" && !hasCompanyContext) ? handleFormBack : undefined
										}
										onSkip={!currentQuestion.required ? handleFormSkip : undefined}
										stepNumber={currentStepNumber}
										totalSteps={totalSteps}
										required={currentQuestion.required}
										showSTT={currentQuestion.showSTT}
										direction={formDirection}
										placeholder={"placeholder" in currentQuestion ? currentQuestion.placeholder : undefined}
										isResearching={isUrlQuestion && isResearching}
										onResearch={
											isUrlQuestion
												? () => {
														const url = currentValues.website_url as string
														if (url?.trim()) {
															handleResearchWebsite(url)
														}
													}
												: undefined
										}
									/>
								)}
							</AnimatePresence>
						</div>
					</div>
				</motion.div>
			)
		}

		// Chat/Voice mode - simplified header
		return (
			<motion.div
				key="chat"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15 }}
				className="flex min-h-screen flex-col"
			>
				{/* Page header with inline mode toggle */}
				<div className="flex items-center justify-between border-b px-6 py-3">
					<h1 className="font-semibold text-lg">Project Context</h1>
					<SetupModeToggle mode={mode} onModeChange={(m) => setMode(m as SetupMode)} showVoice={isVoiceEnabled} />
				</div>

				{/* Main Content Area - full width, no sidebar */}
				<div className="flex-1 overflow-y-auto">
					<div className="mx-auto max-w-2xl px-4 py-6">
						{mode === "voice" ? (
							<SetupVoiceChat
								accountId={accountId}
								projectId={projectId}
								projectName={project?.name || "Project"}
								onSetupComplete={handleSetupComplete}
							/>
						) : (
							<ProjectSetupChat
								accountId={accountId}
								projectId={projectId}
								projectName={project?.name || "Project"}
								onSetupComplete={handleSetupComplete}
								initialMessage={initialChatMessage}
							/>
						)}
					</div>
				</div>
			</motion.div>
		)
	}

	// Single return with unified AnimatePresence wrapper
	return (
		<ProjectSetupProvider projectId={projectId} initialData={initialSections as Record<string, unknown>}>
			<AnimatePresence mode="wait">{renderModeContent()}</AnimatePresence>
		</ProjectSetupProvider>
	)
}
