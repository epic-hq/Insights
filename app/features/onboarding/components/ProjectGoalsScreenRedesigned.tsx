import consola from "consola"
import { ChevronDown, ChevronRight, HelpCircle, Info, Plus, Target, TargetIcon, Users, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { z } from "zod"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import InlineEdit from "~/components/ui/inline-edit"
import { Input } from "~/components/ui/input"
import { ProgressDots } from "~/components/ui/ProgressDots"
import { StatusPill } from "~/components/ui/StatusPill"
import { Textarea } from "~/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { getProjectContextGeneric } from "~/features/questions/db"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
import { createClient } from "~/lib/supabase/client"
import type { Project } from "~/types"
import { useAutoSave } from "../hooks/useAutoSave"
import ContextualSuggestions from "./ContextualSuggestions"

type TemplatePrefill = {
	template_key: string
	target_orgs: string[]
	target_roles: string[]
	research_goal: string
	research_goal_details: string
	decision_questions: string[]
	assumptions: string[]
	unknowns: string[]
	custom_instructions: string
}

// Removed sampleData to prevent auto-population

// Zod schema for validation
const projectGoalsSchema = z.object({
	// Organizations are optional - user can specify none
	target_orgs: z.array(z.string()).default([]),
	target_roles: z.array(z.string()).min(1, "At least one target role is required"),
	research_goal: z.string().min(1, "Research goal is required"),
	research_goal_details: z.string().optional(),
	decision_questions: z.array(z.string()).min(1, "At least one decision question is required"),
	assumptions: z.array(z.string()),
	unknowns: z.array(z.string()),
	custom_instructions: z.string().optional(),
})

type ProjectGoalsData = z.infer<typeof projectGoalsSchema>

// Removed sampleGoals to prevent auto-population

// Removed contextual suggestions function to rely solely on AI-generated suggestions

// Removed SuggestionBadges component - no longer needed

interface ProjectGoalsScreenProps {
	onNext: (data: {
		target_orgs: string[]
		target_roles: string[]
		research_goal: string
		research_goal_details: string
		decision_questions: string[]
		assumptions: string[]
		unknowns: string[]
		custom_instructions?: string
		projectId?: string
	}) => void
	project?: Project
	projectId?: string
	accountId?: string
	showStepper?: boolean
	showNextButton?: boolean
	templateKey?: string
	prefill?: TemplatePrefill
}

export default function ProjectGoalsScreen({
	onNext,
	project,
	projectId,
	accountId,
	showStepper = false,
	showNextButton = true,
	templateKey,
	prefill,
}: ProjectGoalsScreenProps) {
	const [target_orgs, setTargetOrgs] = useState<string[]>([])
	const [target_roles, setTargetRoles] = useState<string[]>([])
	const [newOrg, setNewOrg] = useState("")
	const [newRole, setNewRole] = useState("")
	const [research_goal, setResearchGoal] = useState("")
	const [research_goal_details, setResearchGoalDetails] = useState("")
	const [decision_questions, setDecisionQuestions] = useState<string[]>([])
	const [newDecisionQuestion, setNewDecisionQuestion] = useState("")
	const [assumptions, setAssumptions] = useState<string[]>([])
	const [unknowns, setUnknowns] = useState<string[]>([])
	const [newAssumption, setNewAssumption] = useState("")
	const [newUnknown, setNewUnknown] = useState("")
	const [custom_instructions, setCustomInstructions] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [contextLoaded, setContextLoaded] = useState(false)
	const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId)
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const [showCustomInstructions, setShowCustomInstructions] = useState(false)
	// Removed showGoalSuggestions state - no longer using fallback suggestions
	const [showDecisionQuestionSuggestions, setShowDecisionQuestionSuggestions] = useState(false)
	const [showDecisionQuestionInput, setShowDecisionQuestionInput] = useState(false)
	const [showOrgSuggestions, setShowOrgSuggestions] = useState(false)
	const [showRoleSuggestions, setShowRoleSuggestions] = useState(false)
	const [showAssumptionSuggestions, setShowAssumptionSuggestions] = useState(false)
	const [showUnknownSuggestions, setShowUnknownSuggestions] = useState(false)
	const [activeSuggestionType, setActiveSuggestionType] = useState<string | null>(null)
	const [shownSuggestionsByType, setShownSuggestionsByType] = useState<Record<string, string[]>>({})
	const supabase = createClient()

	// Feature flag for chat setup button
	const { isEnabled: isSetupChatEnabled, isLoading: isFeatureFlagLoading } = usePostHogFeatureFlag("ffSetupChat")

	// Accordion state - only one section can be open at a time
	const [openAccordion, setOpenAccordion] = useState<string | null>("research-goal")

	// Reset active suggestion type when accordion changes
	useEffect(() => {
		setActiveSuggestionType(null)
	}, [openAccordion])

	// Refs for input fields to handle focus after suggestion selection
	const decisionQuestionInputRef = useRef<HTMLTextAreaElement>(null)
	const orgInputRef = useRef<HTMLTextAreaElement>(null)
	const roleInputRef = useRef<HTMLTextAreaElement>(null)
	const assumptionInputRef = useRef<HTMLTextAreaElement>(null)
	const unknownInputRef = useRef<HTMLTextAreaElement>(null)

	// Construct the protected API path
	const apiPath =
		accountId && currentProjectId
			? `/a/${accountId}/${currentProjectId}/api/contextual-suggestions`
			: "/api/contextual-suggestions" // fallback

	// Helper function to focus input and set cursor at end
	const focusInputAtEnd = (inputRef: React.RefObject<HTMLTextAreaElement | null>) => {
		setTimeout(() => {
			if (inputRef.current) {
				inputRef.current.focus()
				const length = inputRef.current.value.length
				inputRef.current.setSelectionRange(length, length)
			}
		}, 0)
	}

	const {
		saveTargetOrgs,
		saveTargetRoles,
		saveResearchGoal,
		saveAssumptions,
		saveUnknowns,
		saveDecisionQuestions,
		saveCustomInstructions,
		isSaving,
	} = useAutoSave({
		projectId: currentProjectId || "",
		onSaveStart: () => {
			consola.log("🔄 Auto-save started", { projectId: currentProjectId })
		},
		onSaveComplete: () => {
			consola.log("✅ Auto-save completed", { projectId: currentProjectId })
		},
		onSaveError: (error) => {
			consola.error("❌ Auto-save error:", error, { projectId: currentProjectId })
		},
	})

	const createProjectIfNeeded = useCallback(async () => {
		if (currentProjectId || isCreatingProject) return currentProjectId

		setIsCreatingProject(true)
		try {
			const formData = new FormData()
			formData.append(
				"projectData",
				JSON.stringify({
					target_orgs: target_orgs,
					target_roles: target_roles,
					research_goal: research_goal,
					research_goal_details: research_goal_details,
				})
			)

			const response = await fetch("/api/create-project", {
				method: "POST",
				body: formData,
				credentials: "include",
			})

			if (!response.ok) {
				throw new Error("Project creation failed")
			}

			const result = await response.json()
			const newProjectId = result.project?.id

			if (newProjectId) {
				setCurrentProjectId(newProjectId)
				consola.log("🎯 Created project on first input:", newProjectId)

				setTimeout(() => {
					if (assumptions.length > 0) saveAssumptions(assumptions)
					if (unknowns.length > 0) saveUnknowns(unknowns)
					if (research_goal.trim()) saveResearchGoal(research_goal, research_goal_details)
				}, 200)

				return newProjectId
			}
		} catch (error) {
			consola.error("Failed to create project:", error)
		} finally {
			setIsCreatingProject(false)
		}
		return currentProjectId
	}, [
		currentProjectId,
		isCreatingProject,
		target_orgs,
		target_roles,
		research_goal,
		research_goal_details,
		assumptions,
		unknowns,
		saveAssumptions,
		saveUnknowns,
		saveResearchGoal,
	])

	const loadProjectData = useCallback(async () => {
		if (!currentProjectId) return
		setIsLoading(true)

		try {
			const ctx = await getProjectContextGeneric(supabase, currentProjectId)
			let populatedFromContext = false
			if (ctx?.merged) {
				const m = ctx.merged as Record<string, unknown>
				const hasAny =
					(Array.isArray(m.target_orgs) && (m.target_orgs as unknown[]).length > 0) ||
					(Array.isArray(m.target_roles) && (m.target_roles as unknown[]).length > 0) ||
					(typeof m.research_goal === "string" && (m.research_goal as string).length > 0) ||
					(Array.isArray(m.decision_questions) && (m.decision_questions as unknown[]).length > 0) ||
					(Array.isArray(m.assumptions) && (m.assumptions as unknown[]).length > 0) ||
					(Array.isArray(m.unknowns) && (m.unknowns as unknown[]).length > 0) ||
					(typeof m.custom_instructions === "string" && (m.custom_instructions as string).length > 0)

				if (hasAny) {
					setTargetOrgs((m.target_orgs as string[]) ?? [])
					setTargetRoles((m.target_roles as string[]) ?? [])
					setResearchGoal((m.research_goal as string) ?? "")
					setResearchGoalDetails((m.research_goal_details as string) ?? "")
					setAssumptions((m.assumptions as string[]) ?? [])
					setDecisionQuestions((m.decision_questions as string[]) ?? [])
					setUnknowns((m.unknowns as string[]) ?? [])
					setCustomInstructions((m.custom_instructions as string) ?? "")
					populatedFromContext = true
					consola.log("Loaded project context from project_sections (merged)")
				}
			}

			if (!populatedFromContext) {
				const response = await fetch(`/api/load-project-goals?projectId=${currentProjectId}`)
				const result = await response.json()
				if (result.success && result.data) {
					const data = result.data
					setTargetOrgs(data.target_orgs || [])
					setTargetRoles(data.target_roles || [])
					setResearchGoal(data.research_goal || "")
					setResearchGoalDetails(data.research_goal_details || "")
					setAssumptions(data.assumptions || [])
					setDecisionQuestions(data.decision_questions || [])
					setUnknowns(data.unknowns || [])
					setCustomInstructions(data.custom_instructions || "")
					consola.log("Loaded project goals via API fallback")
				}
			}
		} catch (error) {
			consola.error("Failed to load project data:", error)
		} finally {
			setIsLoading(false)
			setContextLoaded(true)
		}
	}, [currentProjectId, supabase])

	useEffect(() => {
		if (currentProjectId) {
			loadProjectData()
		}
	}, [currentProjectId, loadProjectData])

	useEffect(() => {
		if (!prefill) return
		if (!contextLoaded) return
		const noData =
			target_orgs.length === 0 &&
			target_roles.length === 0 &&
			!research_goal &&
			assumptions.length === 0 &&
			unknowns.length === 0 &&
			!custom_instructions

		if (noData) {
			setTargetOrgs(prefill.target_orgs || [])
			setTargetRoles(prefill.target_roles || [])
			setResearchGoal(prefill.research_goal || "")
			setResearchGoalDetails(prefill.research_goal_details || "")
			setAssumptions(prefill.assumptions || [])
			setUnknowns(prefill.unknowns || [])
			setCustomInstructions(prefill.custom_instructions || "")
			if ((prefill.decision_questions || []).length > 0) {
				setDecisionQuestions(prefill.decision_questions)
			}

			if (currentProjectId) {
				if ((prefill.target_orgs || []).length > 0) saveTargetOrgs(prefill.target_orgs)
				if ((prefill.target_roles || []).length > 0) saveTargetRoles(prefill.target_roles)
				if (prefill.research_goal) saveResearchGoal(prefill.research_goal, prefill.research_goal_details || "", false)
				if ((prefill.assumptions || []).length > 0) saveAssumptions(prefill.assumptions)
				if ((prefill.unknowns || []).length > 0) saveUnknowns(prefill.unknowns)
				if (prefill.custom_instructions) saveCustomInstructions(prefill.custom_instructions)
			}
		}
	}, [
		prefill,
		contextLoaded,
		target_orgs.length,
		target_roles.length,
		research_goal,
		assumptions.length,
		unknowns.length,
		custom_instructions,
		currentProjectId,
		saveTargetOrgs,
		saveTargetRoles,
		saveResearchGoal,
		saveAssumptions,
		saveUnknowns,
		saveCustomInstructions,
	])

	const addOrg = async () => {
		if (newOrg.trim() && !target_orgs.includes(newOrg.trim())) {
			await createProjectIfNeeded()
			const newOrgs = [...target_orgs, newOrg.trim()]
			setTargetOrgs(newOrgs)
			setNewOrg("")
			saveTargetOrgs(newOrgs)
		}
	}

	const removeOrg = (org: string) => {
		const newOrgs = target_orgs.filter((o) => o !== org)
		setTargetOrgs(newOrgs)
		saveTargetOrgs(newOrgs)
	}

	const addRole = async () => {
		if (newRole.trim() && !target_roles.includes(newRole.trim())) {
			await createProjectIfNeeded()
			const newRoles = [...target_roles, newRole.trim()]
			setTargetRoles(newRoles)
			setNewRole("")
			saveTargetRoles(newRoles)
		}
	}

	const removeRole = (role: string) => {
		const newRoles = target_roles.filter((r) => r !== role)
		setTargetRoles(newRoles)
		saveTargetRoles(newRoles)
	}

	const addDecisionQuestion = async () => {
		if (newDecisionQuestion.trim() && !decision_questions.includes(newDecisionQuestion.trim())) {
			await createProjectIfNeeded()
			const newQuestions = [...decision_questions, newDecisionQuestion.trim()]
			setDecisionQuestions(newQuestions)
			setNewDecisionQuestion("")
			saveDecisionQuestions(newQuestions)
		}
	}

	const updateDecisionQuestion = (index: number, value: string) => {
		const v = value.trim()
		if (!v) return
		const updated = [...decision_questions]
		updated[index] = v
		setDecisionQuestions(updated)
		saveDecisionQuestions(updated)
	}

	const removeDecisionQuestion = (index: number) => {
		const newQuestions = decision_questions.filter((_, i) => i !== index)
		setDecisionQuestions(newQuestions)
		saveDecisionQuestions(newQuestions)
	}

	const addAssumption = async () => {
		if (newAssumption.trim() && !assumptions.includes(newAssumption.trim())) {
			await createProjectIfNeeded()
			const newAssumptions = [...assumptions, newAssumption.trim()]
			setAssumptions(newAssumptions)
			setNewAssumption("")
			saveAssumptions(newAssumptions)
		}
	}

	const updateAssumption = (index: number, value: string) => {
		const v = value.trim()
		if (!v) return
		const updated = [...assumptions]
		updated[index] = v
		setAssumptions(updated)
		saveAssumptions(updated)
	}

	const addUnknown = async () => {
		if (newUnknown.trim()) {
			await createProjectIfNeeded()
			const newUnknowns = [...unknowns, newUnknown.trim()]
			setUnknowns(newUnknowns)
			setNewUnknown("")
			saveUnknowns(newUnknowns)
		}
	}

	const updateUnknown = (index: number, value: string) => {
		const v = value.trim()
		if (!v) return
		const updated = [...unknowns]
		updated[index] = v
		setUnknowns(updated)
		saveUnknowns(updated)
	}

	const removeAssumption = (index: number) => {
		const newAssumptions = assumptions.filter((_, i) => i !== index)
		setAssumptions(newAssumptions)
		saveAssumptions(newAssumptions)
	}

	const removeUnknown = (index: number) => {
		const newUnknowns = unknowns.filter((_, i) => i !== index)
		setUnknowns(newUnknowns)
		saveUnknowns(newUnknowns)
	}

	const handleNext = () => {
		// Align with isValid: do not require target_orgs to proceed
		if (target_roles.length > 0 && research_goal.trim() && decision_questions.length > 0) {
			saveResearchGoal(research_goal, research_goal_details, false)
			onNext({
				target_orgs,
				target_roles,
				research_goal,
				research_goal_details,
				decision_questions,
				assumptions,
				unknowns,
				custom_instructions: custom_instructions || undefined,
				projectId: currentProjectId,
			})
		}
	}

	const handleResearchGoalBlur = async () => {
		if (!research_goal.trim()) return
		if (!currentProjectId) await createProjectIfNeeded()
		saveResearchGoal(research_goal, research_goal_details, false)
	}

	const handleCustomInstructionsBlur = () => {
		if (custom_instructions.trim()) {
			saveCustomInstructions(custom_instructions)
		}
	}

	// Removed contextualSuggestions fallback - rely only on AI-generated suggestions

	const isValid =
		target_roles.length > 0 && research_goal.trim() && decision_questions.length > 0 && unknowns.length > 0

	const onboardingSteps = [
		{ id: "goals", title: "Project Goals" },
		{ id: "questions", title: "Questions" },
		{ id: "upload", title: "Upload" },
	]

	// Removed auto-population logic - rely on contextual AI suggestions instead

	return (
		<TooltipProvider>
			<div className="mx-auto min-h-screen max-w-7xl bg-background px-2 py-4 text-foreground sm:p-4 md:p-6 lg:p-8">
				{/* Stepper - only show in onboarding mode */}
				{showStepper && (
					<div className="mb-6">
						<div className="flex items-start justify-center gap-4 sm:gap-6 md:gap-10">
							{onboardingSteps.map((step, index) => (
								<div key={step.id} className="flex items-center">
									<div className="flex flex-col items-center">
										<div
											className={`flex h-7 w-7 items-center justify-center rounded-full font-medium text-xs sm:h-8 sm:w-8 sm:text-sm ${step.id === "goals" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
												}`}
										>
											{index + 1}
										</div>
										<span
											className={`mt-1 line-clamp-1 font-medium text-[10px] sm:text-xs md:text-sm ${step.id === "goals" ? "text-foreground" : "text-muted-foreground"
												}`}
										>
											{step.title}
										</span>
									</div>
									{index < onboardingSteps.length - 1 && (
										<div className="mx-3 hidden h-px w-10 bg-border sm:block md:w-16" />
									)}
								</div>
							))}
						</div>
					</div>
				)}

				{/* Header */}
				<div className="mb-8">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="font-semibold text-2xl text-gray-900">{project?.name}</h1>
							{templateKey === "understand_customer_needs" && (
								<StatusPill variant="neutral" className="mt-2">
									Intent: Understand Customer Needs
								</StatusPill>
							)}
						</div>
						<div className="flex items-center gap-2 text-right">
							{accountId && currentProjectId && isSetupChatEnabled && !isFeatureFlagLoading ? (
								<Link to={`/a/${accountId}/${currentProjectId}/project-chat`}>
									<Button variant="outline" size="sm">
										Use Chat Setup
									</Button>
								</Link>
							) : null}
							{isSaving ? (
								<StatusPill variant="active">
									Saving <ProgressDots className="ml-1" />
								</StatusPill>
							) : null}
						</div>
					</div>
				</div>

				{/* Main Content - Single Column Accordion Layout */}
				<div className="mx-auto max-w-4xl space-y-4">
					{/* Research Goal Accordion */}

					<Card>
						<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-gray-50">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Target className="h-5 w-5 text-blue-600" />
									<h2 className="font-semibold text-lg">
										{templateKey === "understand_customer_needs" ? "Business Goal" : "Primary Goal"}
									</h2>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-flex">
												<Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
											</span>
										</TooltipTrigger>
										<TooltipContent className="max-w-xs">
											<p>
												What problem would you like to solve? This will guide your research and interview questions.
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
								{openAccordion === "research-goal" ? (
									<ChevronDown className="h-4 w-4" />
								) : (
									<ChevronRight className="h-4 w-4" />
								)}
							</div>
						</CardHeader>

						<CardContent className="p-6 pt-0">
							<Textarea
								placeholder={
									templateKey === "understand_customer_needs"
										? "e.g., Understand key decision factors for SaaS buyers, or discover shopping motivations for mobile app users"
										: "e.g., Validate product-market fit for enterprise clients, or understand user onboarding friction for consumers"
								}
								value={research_goal}
								onChange={(e) => setResearchGoal(e.target.value)}
								onBlur={handleResearchGoalBlur}
								rows={2}
								className="min-h-[72px]"
							/>
							{/* Removed SuggestionBadges - rely only on ContextualSuggestions */}
						</CardContent>
					</Card>

					{/* Target Market Accordion */}
					<Collapsible
						open={openAccordion === "target-market"}
						onOpenChange={() => setOpenAccordion(openAccordion === "target-market" ? null : "target-market")}
					>
						<Card>
							<CollapsibleTrigger asChild>
								<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-gray-50">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Users className="h-5 w-5 text-purple-600" />
											<h2 className="font-semibold text-lg">Who are we talking to?</h2>
											<span className="rounded-md px-2 py-1 font-medium text-foreground/75 text-xs">
												{target_roles.length}
											</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="inline-flex">
														<Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
													</span>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>
														Define the types of organizations and roles you want to research. This helps target the
														right interview participants.
													</p>
												</TooltipContent>
											</Tooltip>
										</div>
										{openAccordion === "target-market" ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</div>
								</CardHeader>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<CardContent className="p-6 pt-0">
									{/* Organizations */}
									<div className="mb-6">
										<label className="mb-3 block font-medium text-gray-900 text-sm">Organizations</label>
										<div className="mb-3 flex flex-wrap gap-2">
											{target_orgs.map((org, index) => (
												<div
													key={`${org}-${index}`}
													className="group flex items-center gap-2 rounded-md border border-green-300 bg-green-100 px-3 py-1 text-sm transition-all hover:bg-green-200"
												>
													<InlineEdit
														value={org}
														onSubmit={(val) => {
															const v = val.trim()
															if (!v) return
															const list = [...target_orgs]
															list[index] = v
															setTargetOrgs(list)
															saveTargetOrgs(list)
														}}
														textClassName="font-medium text-green-800"
														inputClassName="h-6 py-0 text-green-900"
													/>
													<button
														onClick={() => removeOrg(org)}
														className="rounded-md p-0.5 opacity-60 transition-all hover:bg-green-300 hover:opacity-100 group-hover:opacity-100"
													>
														<X className="h-3 w-3 text-green-700" />
													</button>
												</div>
											))}
										</div>
										{!showOrgSuggestions ? (
											<Button
												onClick={() => {
													setShowOrgSuggestions(true)
													setActiveSuggestionType("organizations")
												}}
												variant="outline"
												size="sm"
												className="w-full justify-center border-dashed"
											>
												<Plus className="mr-2 h-4 w-4" />
												Add organization type
											</Button>
										) : (
											<div className="space-y-3">
												<div className="flex gap-2">
													<Textarea
														ref={orgInputRef}
														placeholder="e.g., Enterprise software companies, D2C fashion brands, Healthcare startups"
														value={newOrg}
														onChange={(e) => setNewOrg(e.target.value)}
														onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addOrg()}
														className="flex-1 resize-none"
														rows={2}
														autoFocus
													/>
													<Button onClick={addOrg} variant="outline" size="sm">
														<Plus className="h-4 w-4" />
													</Button>
													<Button
														onClick={() => {
															setShowOrgSuggestions(false)
															setNewOrg("")
														}}
														variant="ghost"
														size="sm"
													>
														<X className="h-4 w-4" />
													</Button>
												</div>

												<ContextualSuggestions
													suggestionType="organizations"
													currentInput={newOrg}
													researchGoal={research_goal}
													existingItems={target_orgs}
													apiPath={apiPath}
													shownSuggestions={shownSuggestionsByType["organizations"] || []}
													isActive={activeSuggestionType === null || activeSuggestionType === "organizations"}
													onSuggestionClick={(suggestion) => {
														setNewOrg(suggestion)
														focusInputAtEnd(orgInputRef)
													}}
													onSuggestionShown={(suggestions) => {
														if (activeSuggestionType === null) {
															setActiveSuggestionType("organizations")
														}
														setShownSuggestionsByType((prev) => ({
															...prev,
															organizations: [...(prev.organizations || []), ...suggestions],
														}))
													}}
												/>
											</div>
										)}
									</div>

									{/* Roles */}
									<div>
										<label className="mb-3 block font-medium text-gray-900 text-sm">People's Roles</label>
										<div className="mb-3 flex flex-wrap gap-2">
											{target_roles.map((role, index) => (
												<div
													key={`${role}-${index}`}
													className="group flex items-center gap-2 rounded-md border border-purple-300 bg-purple-100 px-3 py-1 text-sm transition-all hover:bg-purple-200"
												>
													<InlineEdit
														value={role}
														onSubmit={(val) => {
															const v = val.trim()
															if (!v) return
															const list = [...target_roles]
															list[index] = v
															setTargetRoles(list)
															saveTargetRoles(list)
														}}
														textClassName="font-medium text-purple-800"
														inputClassName="h-6 py-0 text-purple-900"
													/>
													<button
														onClick={() => removeRole(role)}
														className="rounded-md p-0.5 opacity-60 transition-all hover:bg-purple-300 hover:opacity-100 group-hover:opacity-100"
													>
														<X className="h-3 w-3 text-purple-700" />
													</button>
												</div>
											))}
										</div>
										{!showRoleSuggestions ? (
											<Button
												onClick={() => {
													setShowRoleSuggestions(true)
													setActiveSuggestionType("roles")
												}}
												variant="outline"
												size="sm"
												className="w-full justify-center border-dashed"
											>
												<Plus className="mr-2 h-4 w-4" />
												Add target role
											</Button>
										) : (
											<div className="space-y-3">
												<div className="flex gap-2">
													<Textarea
														ref={roleInputRef}
														placeholder="e.g., Chief Technology Officer, Marketing Director, End Users, Small Business Owners"
														value={newRole}
														onChange={(e) => setNewRole(e.target.value)}
														onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addRole()}
														className="flex-1 resize-none"
														rows={2}
														autoFocus
													/>
													<Button onClick={addRole} variant="outline" size="sm">
														<Plus className="h-4 w-4" />
													</Button>
													<Button
														onClick={() => {
															setShowRoleSuggestions(false)
															setNewRole("")
														}}
														variant="ghost"
														size="sm"
													>
														<X className="h-4 w-4" />
													</Button>
												</div>

												<ContextualSuggestions
													suggestionType="roles"
													currentInput={newRole}
													researchGoal={research_goal}
													existingItems={target_roles}
													apiPath={apiPath}
													shownSuggestions={shownSuggestionsByType["roles"] || []}
													isActive={activeSuggestionType === null || activeSuggestionType === "roles"}
													onSuggestionClick={(suggestion) => {
														setNewRole(suggestion)
														focusInputAtEnd(roleInputRef)
													}}
													onSuggestionShown={(suggestions) => {
														if (activeSuggestionType === null) {
															setActiveSuggestionType("roles")
														}
														setShownSuggestionsByType((prev) => ({
															...prev,
															roles: [...(prev.roles || []), ...suggestions],
														}))
													}}
												/>
											</div>
										)}
									</div>
								</CardContent>
							</CollapsibleContent>
						</Card>
					</Collapsible>

					{/* Key Decisions to make Accordion */}
					<Collapsible
						open={openAccordion === "key-questions"}
						onOpenChange={() => setOpenAccordion(openAccordion === "key-questions" ? null : "key-questions")}
					>
						<Card>
							<CollapsibleTrigger asChild>
								<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-gray-50">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<TargetIcon className="h-5 w-5 text-green-600" />
											<h2 className="font-semibold text-lg">What Decisions Need to be Made?</h2>
											<span className="rounded-md px-2 py-1 font-medium text-foreground/75 text-xs">
												{" "}
												{decision_questions.length}
											</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="inline-flex">
														<Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
													</span>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>These questions will guide your research and help shape the interviews.</p>
												</TooltipContent>
											</Tooltip>
										</div>
										{openAccordion === "key-questions" ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</div>
								</CardHeader>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<CardContent className="p-6 pt-0">
									{/* Question List */}
									<div className="mb-4 space-y-2">
										{decision_questions.map((question, index) => (
											<div
												key={`decision-${index}-${question.slice(0, 10)}`}
												className="group flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 transition-all duration-200 hover:bg-green-100"
											>
												<div className="mt-1 flex-shrink-0">
													<div className="h-2 w-2 rounded-md bg-green-500" />
												</div>
												<InlineEdit
													value={question}
													onSubmit={(val) => updateDecisionQuestion(index, val)}
													multiline={false}
													textClassName="flex-1 text-gray-800 text-sm leading-relaxed"
													inputClassName="text-sm"
													showEditButton={true}
												/>
												<button
													onClick={() => removeDecisionQuestion(index)}
													className="flex-shrink-0 rounded-md p-1 opacity-60 transition-all duration-200 hover:bg-green-200 hover:opacity-100 group-hover:opacity-100"
												>
													<X className="h-3 w-3 text-green-700" />
												</button>
											</div>
										))}
									</div>

									{/* Add Question UI */}
									{!showDecisionQuestionInput ? (
										<Button
											onClick={() => {
												setShowDecisionQuestionInput(true)
												setActiveSuggestionType("decision_questions")
											}}
											variant="outline"
											size="sm"
											className="w-full justify-center border-dashed"
										>
											<Plus className="mr-2 h-4 w-4" />
											Add research question
										</Button>
									) : (
										<div className="space-y-3">
											<div className="flex gap-2">
												<Textarea
													ref={decisionQuestionInputRef}
													placeholder="e.g., What drives B2B purchase decisions? What causes consumer app abandonment?"
													value={newDecisionQuestion}
													onChange={(e) => setNewDecisionQuestion(e.target.value)}
													onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addDecisionQuestion()}
													className="flex-1 resize-none"
													rows={2}
													autoFocus
												/>
												<Button
													onClick={addDecisionQuestion}
													variant="outline"
													size="sm"
													disabled={!newDecisionQuestion.trim()}
												>
													<Plus className="h-4 w-4" />
												</Button>
												<Button
													onClick={() => {
														setShowDecisionQuestionInput(false)
														setNewDecisionQuestion("")
													}}
													variant="ghost"
													size="sm"
												>
													<X className="h-4 w-4" />
												</Button>
											</div>

											{/* Contextual Suggestions */}
											<ContextualSuggestions
												suggestionType="decision_questions"
												currentInput={newDecisionQuestion}
												researchGoal={research_goal}
												existingItems={decision_questions}
												apiPath={apiPath}
												shownSuggestions={shownSuggestionsByType["decision_questions"] || []}
												isActive={activeSuggestionType === null || activeSuggestionType === "decision_questions"}
												onSuggestionClick={(suggestion) => {
													setNewDecisionQuestion(suggestion)
													focusInputAtEnd(decisionQuestionInputRef)
												}}
												onSuggestionShown={(suggestions) => {
													if (activeSuggestionType === null) {
														setActiveSuggestionType("decision_questions")
													}
													setShownSuggestionsByType((prev) => ({
														...prev,
														decision_questions: [...(prev.decision_questions || []), ...suggestions],
													}))
												}}
											/>
										</div>
									)}
								</CardContent>
							</CollapsibleContent>
						</Card>
					</Collapsible>



					{/* Research Questions Accordion */}
					<Collapsible
						open={openAccordion === "research-context"}
						onOpenChange={() => setOpenAccordion(openAccordion === "research-context" ? null : "research-context")}
					>
						<Card>
							<CollapsibleTrigger asChild>
								<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-gray-50">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<HelpCircle className="h-5 w-5 text-blue-600" />
											<h2 className="font-semibold text-lg">Research Questions</h2>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="inline-flex">
														<Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
													</span>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>
														What do we need to learn in order to make decisions?
													</p>
												</TooltipContent>
											</Tooltip>
										</div>
										{openAccordion === "research-context" ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</div>
								</CardHeader>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<CardContent className="p-6 pt-0">
									<div className="mb-6">
										{/* Assumptions */}
										{/* <div className="mb-6">
											<label className="mb-3 block font-medium text-gray-900 text-sm">Assumptions</label>
											<div className="mb-3 space-y-2">
												{assumptions.map((assumption, index) => (
													<div
														key={`assumption-${index}-${assumption.slice(0, 10)}`}
														className="group flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 transition-all hover:bg-blue-100"
													>
														<div className="mt-1 flex-shrink-0">
															<div className="h-2 w-2 rounded-md bg-blue-500" />
														</div>
														<InlineEdit
															value={assumption}
															onSubmit={(val) => updateAssumption(index, val)}
															multiline={false}
															textClassName="flex-1 text-gray-800 text-sm leading-relaxed"
															inputClassName="text-sm"
															showEditButton={true}
														/>
														<button
															onClick={() => removeAssumption(index)}
															className="flex-shrink-0 rounded-md p-1 opacity-60 transition-all hover:bg-blue-200 hover:opacity-100 group-hover:opacity-100"
														>
															<X className="h-3 w-3 text-blue-700" />
														</button>
													</div>
												))}
											</div>
											{!showAssumptionSuggestions ? (
												<Button
													onClick={() => {
														setShowAssumptionSuggestions(true)
														setActiveSuggestionType("assumptions")
													}}
													variant="outline"
													size="sm"
													className="w-full justify-center border-dashed"
												>
													<Plus className="mr-2 h-4 w-4" />
													Add assumption
												</Button>
											) : (
												<div className="space-y-3">
													<div className="flex gap-2">
														<Textarea
															ref={assumptionInputRef}
															placeholder="e.g., Enterprise buyers need ROI proof, or Consumers value ease of use over features"
															value={newAssumption}
															onChange={(e) => setNewAssumption(e.target.value)}
															onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addAssumption()}
															className="flex-1 resize-none"
															rows={2}
															autoFocus
														/>
														<Button onClick={addAssumption} variant="outline" size="sm">
															<Plus className="h-4 w-4" />
														</Button>
														<Button
															onClick={() => {
																setShowAssumptionSuggestions(false)
																setNewAssumption("")
															}}
															variant="ghost"
															size="sm"
														>
															<X className="h-4 w-4" />
														</Button>
													</div>

													<ContextualSuggestions
														suggestionType="assumptions"
														currentInput={newAssumption}
														researchGoal={research_goal}
														existingItems={assumptions}
														apiPath={apiPath}
														shownSuggestions={shownSuggestionsByType["assumptions"] || []}
														isActive={activeSuggestionType === null || activeSuggestionType === "assumptions"}
														onSuggestionClick={(suggestion) => {
															setNewAssumption(suggestion)
															focusInputAtEnd(assumptionInputRef)
														}}
														onSuggestionShown={(suggestions) => {
															if (activeSuggestionType === null) {
																setActiveSuggestionType("assumptions")
															}
															setShownSuggestionsByType((prev) => ({
																...prev,
																assumptions: [...(prev.assumptions || []), ...suggestions],
															}))
														}}
													/>
												</div>
											)}
										</div> */}

										{/* Unknowns -> Research Questions */}
										<div>
											{/* <label className="mb-3 block font-medium text-gray-900 text-sm">Research Questions (Unknowns)</label> */}
											<div className="mb-3 space-y-2">
												{unknowns.map((unknown, index) => (
													<div
														key={`unknown-${index}-${unknown.slice(0, 10)}`}
														className="group flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 transition-all hover:bg-amber-100"
													>
														<div className="mt-0.5 flex-shrink-0">
															<HelpCircle className="h-4 w-4 text-amber-600" />
														</div>
														<InlineEdit
															value={unknown}
															onSubmit={(val) => updateUnknown(index, val)}
															multiline={false}
															textClassName="flex-1 text-gray-800 text-sm leading-relaxed"
															inputClassName="text-sm"
															showEditButton={true}
														/>
														<button
															onClick={() => removeUnknown(index)}
															className="flex-shrink-0 rounded-md p-1 opacity-60 transition-all hover:bg-amber-200 hover:opacity-100 group-hover:opacity-100"
														>
															<X className="h-3 w-3 text-amber-700" />
														</button>
													</div>
												))}
											</div>
											{!showUnknownSuggestions ? (
												<Button
													onClick={() => {
														setShowUnknownSuggestions(true)
														setActiveSuggestionType("unknowns")
													}}
													variant="outline"
													size="sm"
													className="w-full justify-center border-dashed"
												>
													<Plus className="mr-2 h-4 w-4" />
													Add key unknown
												</Button>
											) : (
												<div className="space-y-3">
													<div className="flex gap-2">
														<Textarea
															ref={unknownInputRef}
															placeholder="e.g., Which pricing model B2B customers prefer, or What mobile features drive user retention"
															value={newUnknown}
															onChange={(e) => setNewUnknown(e.target.value)}
															onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addUnknown()}
															className="flex-1 resize-none"
															rows={2}
															autoFocus
														/>
														<Button onClick={addUnknown} variant="outline" size="sm">
															<Plus className="h-4 w-4" />
														</Button>
														<Button
															onClick={() => {
																setShowUnknownSuggestions(false)
																setNewUnknown("")
															}}
															variant="ghost"
															size="sm"
														>
															<X className="h-4 w-4" />
														</Button>
													</div>

													<ContextualSuggestions
														suggestionType="unknowns"
														currentInput={newUnknown}
														researchGoal={research_goal}
														existingItems={unknowns}
														apiPath={apiPath}
														shownSuggestions={shownSuggestionsByType["unknowns"] || []}
														isActive={activeSuggestionType === null || activeSuggestionType === "unknowns"}
														onSuggestionClick={(suggestion) => {
															setNewUnknown(suggestion)
															focusInputAtEnd(unknownInputRef)
														}}
														onSuggestionShown={(suggestions) => {
															if (activeSuggestionType === null) {
																setActiveSuggestionType("unknowns")
															}
															setShownSuggestionsByType((prev) => ({
																...prev,
																unknowns: [...(prev.unknowns || []), ...suggestions],
															}))
														}}
													/>
												</div>
											)}
										</div>
									</div>
								</CardContent>
							</CollapsibleContent>
						</Card>
					</Collapsible>
				</div>

				{/* Custom Instructions Collapsible Section */}
				<div className="mb-8">
					<Button
						variant="ghost"
						onClick={() => setShowCustomInstructions(!showCustomInstructions)}
						className="flex items-center gap-2 p-0 text-gray-600 text-sm hover:text-gray-900"
					>
						{showCustomInstructions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
						Custom Instructions
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex">
									<Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
								</span>
							</TooltipTrigger>
							<TooltipContent className="max-w-xs">
								<p>Add specific instructions for AI analysis or interview generation (optional).</p>
							</TooltipContent>
						</Tooltip>
					</Button>

					{showCustomInstructions && (
						<Card className="mt-4">
							<CardContent className="p-4">
								<Textarea
									placeholder="Any specific instructions for the AI analysis or interview generation..."
									value={custom_instructions}
									onChange={(e) => setCustomInstructions(e.target.value)}
									onBlur={handleCustomInstructionsBlur}
									rows={3}
									className="resize-none"
								/>
							</CardContent>
						</Card>
					)}
				</div>

				{showNextButton && (
					<div className="mt-8 border-gray-200 border-t pt-8">
						<div className="flex items-center justify-center">
							<Button onClick={handleNext} disabled={!isValid || isLoading} size="lg" className="px-8 py-3">
								Next
								<ChevronRight className="ml-2 h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</div>
		</TooltipProvider>
	)
}
