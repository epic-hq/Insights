import consola from "consola"
import { ChevronDown, ChevronRight, HelpCircle, Plus, Target, Users, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { z } from "zod"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { ProgressDots } from "~/components/ui/ProgressDots"
import { StatusPill } from "~/components/ui/StatusPill"
import { Textarea } from "~/components/ui/textarea"
import { getProjectContextGeneric } from "~/features/questions/db"
import { createClient } from "~/lib/supabase/client"
import type { Project } from "~/types"
import { useAutoSave } from "../hooks/useAutoSave"

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

// Template-focused suggestions for "Understand Customer Needs"
const sampleData = [
	{
		goal: "Understand core customer outcomes for pricing & packaging",
		orgs: ["Early-stage SaaS", "Mid-market B2B teams", "Ecommerce brands", "Digital services"],
		roles: ["Product Manager", "Head of Growth", "UX Researcher", "Customer Success Lead", "Founder/CEO"],
		assumptions: [
			"Users buy to achieve outcome X, not feature Y",
			"Clear onboarding reduces early churn",
			"Price sensitivity drops when value is obvious",
		],
		unknowns: [
			"Which 1–2 outcomes matter most enough to switch",
			"Where in the journey do users hit most friction",
			"What alternatives are commonly compared and why",
		],
	},
	{
		goal: "Map jobs-to-be-done for our new collaboration feature",
		orgs: ["Product-led SaaS", "B2B platforms"],
		roles: ["PM", "Design Lead", "Operations Manager", "Engineering Manager"],
		assumptions: ["Teams care about speed over completeness", "Adoption hinges on low setup cost"],
		unknowns: ["What triggers collaboration needs", "What evaluation criteria decide team adoption"],
	},
]

// Zod schema for validation
const projectGoalsSchema = z.object({
	target_orgs: z.array(z.string()).min(1, "At least one target organization is required"),
	target_roles: z.array(z.string()).min(1, "At least one target role is required"),
	research_goal: z.string().min(1, "Research goal is required"),
	research_goal_details: z.string().optional(),
	decision_questions: z.array(z.string()).min(1, "At least one decision question is required"),
	assumptions: z.array(z.string()),
	unknowns: z.array(z.string()),
	custom_instructions: z.string().optional(),
})

type ProjectGoalsData = z.infer<typeof projectGoalsSchema>

// Sample suggestions extracted from data
const sampleGoals = sampleData.map((item) => item.goal)

// Context-aware suggestions based on research goal
const getContextualSuggestions = (goal: string) => {
	const sample = sampleData.find((item) => {
		const goalLower = goal.toLowerCase()
		const sampleGoalLower = item.goal.toLowerCase()
		return (
			goalLower.length > 3 &&
			(sampleGoalLower.includes(goalLower) ||
				(goalLower.includes("newsletter") && sampleGoalLower.includes("newsletter")) ||
				(goalLower.includes("automation") && sampleGoalLower.includes("automation")) ||
				(goalLower.includes("meal") && sampleGoalLower.includes("meal")) ||
				(goalLower.includes("community") && sampleGoalLower.includes("community")))
		)
	})

	if (sample) {
		return {
			orgs: sample.orgs,
			roles: sample.roles,
			assumptions: sample.assumptions,
			unknowns: sample.unknowns,
		}
	}

	return {
		orgs: ["Early-stage SaaS", "Mid-market B2B product teams", "Ecommerce brands", "Digital services"],
		roles: ["Product Manager", "Head of Growth", "UX Researcher", "Customer Success Lead", "Founder/CEO"],
		assumptions: [
			"Users buy to achieve outcomes, not features",
			"Onboarding clarity drives early retention",
			"Pricing is justified when value is obvious",
		],
		unknowns: [
			"Which outcomes have highest willingness-to-pay",
			"Where the journey has most friction",
			"Which alternatives users compare and why",
		],
	}
}

// Suggestion badge component
interface SuggestionBadgesProps {
	suggestions: string[]
	onSuggestionClick: (suggestion: string) => void
	show: boolean
	color?: "blue" | "green" | "purple" | "amber"
}

function SuggestionBadges({ suggestions, onSuggestionClick, show }: SuggestionBadgesProps) {
	if (!show || suggestions.length === 0) return null
	const neutralClasses = "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"

	return (
		<div className="mt-3 mb-4 flex flex-wrap gap-2">
			{suggestions.slice(0, 4).map((suggestion, index) => (
				<button
					key={index}
					onMouseDown={(e) => {
						e.preventDefault()
						onSuggestionClick(suggestion)
					}}
					className={`cursor-pointer rounded-full px-2.5 py-1 font-medium text-xs transition-colors ${neutralClasses}`}
				>
					+ {suggestion}
				</button>
			))}
		</div>
	)
}

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
	showStepper?: boolean
	showNextButton?: boolean
	templateKey?: string
	prefill?: TemplatePrefill
}

export default function ProjectGoalsScreen({
	onNext,
	project,
	projectId,
	showStepper = true,
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
	const [showGoalSuggestions, setShowGoalSuggestions] = useState(false)
	const [showDecisionQuestionSuggestions, setShowDecisionQuestionSuggestions] = useState(false)
	const [showOrgSuggestions, setShowOrgSuggestions] = useState(false)
	const [showRoleSuggestions, setShowRoleSuggestions] = useState(false)
	const [showAssumptionSuggestions, setShowAssumptionSuggestions] = useState(false)
	const [showUnknownSuggestions, setShowUnknownSuggestions] = useState(false)
	const supabase = createClient()

	const {
		saveTargetOrgs,
		saveTargetRoles,
		saveResearchGoal,
		saveAssumptions,
		saveUnknowns,
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
					target_orgs: target_orgs.length > 0 ? target_orgs : ["New Organization"],
					target_roles: target_roles.length > 0 ? target_roles : ["New Role"],
					research_goal: research_goal || "New Research Project",
					research_goal_details: research_goal_details || "",
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
					(Array.isArray(m.assumptions) && (m.assumptions as unknown[]).length > 0) ||
					(Array.isArray(m.unknowns) && (m.unknowns as unknown[]).length > 0) ||
					(typeof m.custom_instructions === "string" && (m.custom_instructions as string).length > 0)

				if (hasAny) {
					setTargetOrgs((m.target_orgs as string[]) ?? [])
					setTargetRoles((m.target_roles as string[]) ?? [])
					setResearchGoal((m.research_goal as string) ?? "")
					setResearchGoalDetails((m.research_goal_details as string) ?? "")
					setAssumptions((m.assumptions as string[]) ?? [])
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
			if (!currentProjectId) {
				await createProjectIfNeeded()
				const newQuestions = [...decision_questions, newDecisionQuestion.trim()]
				setDecisionQuestions(newQuestions)
				setNewDecisionQuestion("")
				return
			}
			const newQuestions = [...decision_questions, newDecisionQuestion.trim()]
			setDecisionQuestions(newQuestions)
			setNewDecisionQuestion("")
			// TODO: Save to backend when available
		}
	}

	const removeDecisionQuestion = (index: number) => {
		const newQuestions = decision_questions.filter((_, i) => i !== index)
		setDecisionQuestions(newQuestions)
		// TODO: Save to backend when available
	}

	const addAssumption = async () => {
		if (newAssumption.trim() && !assumptions.includes(newAssumption.trim())) {
			if (!currentProjectId) {
				await createProjectIfNeeded()
				const newAssumptions = [...assumptions, newAssumption.trim()]
				setAssumptions(newAssumptions)
				setNewAssumption("")
				return
			}
			const newAssumptions = [...assumptions, newAssumption.trim()]
			setAssumptions(newAssumptions)
			setNewAssumption("")
			saveAssumptions(newAssumptions)
		}
	}

	const addUnknown = async () => {
		if (newUnknown.trim()) {
			if (!currentProjectId) {
				await createProjectIfNeeded()
				const newUnknowns = [...unknowns, newUnknown.trim()]
				setUnknowns(newUnknowns)
				setNewUnknown("")
				return
			}
			const newUnknowns = [...unknowns, newUnknown.trim()]
			setUnknowns(newUnknowns)
			setNewUnknown("")
			saveUnknowns(newUnknowns)
		}
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
		if (target_orgs.length > 0 && target_roles.length > 0 && research_goal.trim() && decision_questions.length > 0) {
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

	const contextualSuggestions = getContextualSuggestions(research_goal)
	// Prefill seeds up to 3, but users may add more as needed

	const isValid =
		target_orgs.length > 0 && target_roles.length > 0 && research_goal.trim() && decision_questions.length > 0

	const onboardingSteps = [
		{ id: "goals", title: "Project Goals" },
		{ id: "questions", title: "Questions" },
		{ id: "upload", title: "Upload" },
	]

	useEffect(() => {
		if (!prefill) return
		if (
			decision_questions.length === 0 &&
			Array.isArray(prefill.decision_questions) &&
			prefill.decision_questions.length > 0
		) {
			setDecisionQuestions(prefill.decision_questions.slice(0, 3))
		}
	}, [prefill, decision_questions.length])

	return (
		<div className="mx-auto min-h-screen max-w-4xl bg-background p-4 text-foreground sm:p-4 md:p-6 lg:p-8">
			{/* Stepper - only show in onboarding mode */}
			{showStepper && (
				<div className="mb-6">
					<div className="flex items-start justify-center gap-4 sm:gap-6 md:gap-10">
						{onboardingSteps.map((step, index) => (
							<div key={step.id} className="flex items-center">
								<div className="flex flex-col items-center">
									<div
										className={`flex h-7 w-7 items-center justify-center rounded-full font-medium text-xs sm:h-8 sm:w-8 sm:text-sm ${
											step.id === "goals" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
										}`}
									>
										{index + 1}
									</div>
									<span
										className={`mt-1 line-clamp-1 font-medium text-[10px] sm:text-xs md:text-sm ${
											step.id === "goals" ? "text-foreground" : "text-muted-foreground"
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

			<div className="text-semibold text-xl">Project: {project?.name}</div>
			{templateKey === "understand_customer_needs" && (
				<StatusPill variant="neutral">Intent: Understand Customer Needs</StatusPill>
			)}

			<div className="mb-8">
				<div className="mb-4 flex items-center gap-3">
					{isSaving ? (
						<StatusPill variant="active">
							Saving <ProgressDots className="ml-1" />
						</StatusPill>
					) : null}
				</div>
			</div>

			<div className="space-y-6">
				{/* Research Goal */}
				<div>
					<div className="mb-4 flex items-center gap-2">
						<Target className="h-5 w-5" />{" "}
						{templateKey === "understand_customer_needs" ? "Customer Needs Goal" : "Goal"}
					</div>
					<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
						<CardContent className="space-y-3 p-3 sm:p-4">
							<div>
								<label className="mb-2 block font-semibold text-foreground">Primary research goal</label>
								<Input
									placeholder={
										templateKey === "understand_customer_needs"
											? "e.g., Understand the core jobs, outcomes, and pains for [target customers] when [situation]"
											: "e.g., Understanding price sensitivity for our new pricing tier"
									}
									value={research_goal}
									onChange={(e) => setResearchGoal(e.target.value)}
									onFocus={() => setShowGoalSuggestions(true)}
									onBlur={() => {
										handleResearchGoalBlur()
										setTimeout(() => setShowGoalSuggestions(false), 150)
									}}
								/>
								<SuggestionBadges
									suggestions={sampleGoals}
									onSuggestionClick={(goal) => {
										setResearchGoal(goal)
										setShowGoalSuggestions(false)
									}}
									show={showGoalSuggestions}
								/>
							</div>

							<div>
								<label className="mb-2 block font-semibold text-foreground">Key decision questions</label>
								<div className="mb-4 flex gap-3">
									<Input
										placeholder={
											templateKey === "understand_customer_needs"
												? "What do we need to decide to build the right thing?"
												: "What specific decisions need to be made?"
										}
										value={newDecisionQuestion}
										onChange={(e) => setNewDecisionQuestion(e.target.value)}
										onKeyPress={(e) => e.key === "Enter" && addDecisionQuestion()}
										onFocus={() => setShowDecisionQuestionSuggestions(true)}
										onBlur={() => setTimeout(() => setShowDecisionQuestionSuggestions(false), 150)}
										className="flex-1"
									/>
									<Button
										onClick={addDecisionQuestion}
										className="bg-blue-500 px-3 py-2 text-white transition-all duration-200 hover:bg-blue-600"
							disabled={!newDecisionQuestion.trim()}
									>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
								<SuggestionBadges
									suggestions={
										templateKey === "understand_customer_needs"
											? [
													"Which outcomes do customers value most and why",
													"What jobs-to-be-done trigger adoption",
													"What pains and frictions block progress now",
													"What evaluation criteria decide solution choice",
													"What contexts and triggers drive usage",
												]
											: [
													"Which pricing tier drives highest conversion",
													"What content format engages users most",
													"Which features justify premium pricing",
													"What onboarding flow reduces churn",
												]
									}
									onSuggestionClick={(suggestion) => {
										setNewDecisionQuestion(suggestion)
										setShowDecisionQuestionSuggestions(false)
									}}
									show={showDecisionQuestionSuggestions}
								/>
								<div className="space-y-2">
									{decision_questions.map((question, index) => (
										<div
											key={`decision-${index}-${question.slice(0, 10)}`}
											className="group flex w-fit items-start gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 py-1 shadow-sm transition-all duration-200 hover:shadow-md"
										>
											<div className="mt-2 flex-shrink-0">
												<div className="h-2 w-2 rounded-full bg-blue-500" />
											</div>
											<span className="flex-1 font-medium text-gray-800 leading-relaxed">{question}</span>
											<button
												onClick={() => removeDecisionQuestion(index)}
												className="flex-shrink-0 rounded-full p-1 opacity-0 transition-opacity duration-200 hover:bg-blue-200 group-hover:opacity-100"
											>
												<X className="h-4 w-4 text-blue-700" />
											</button>
										</div>
									))}
								</div>
							</div>

							{/* Assumptions */}
							<div>
								<label className="mb-2 block font-semibold text-foreground">What do we think we know?</label>
								<div className="mb-4 flex gap-3">
									<Input
										placeholder="Add something you believe to be true..."
										value={newAssumption}
										onChange={(e) => setNewAssumption(e.target.value)}
										onKeyPress={(e) => e.key === "Enter" && addAssumption()}
										onFocus={() => setShowAssumptionSuggestions(true)}
										onBlur={() => setTimeout(() => setShowAssumptionSuggestions(false), 150)}
										className="flex-1"
									/>
									<Button
										onClick={addAssumption}
										className="w-auto bg-blue-500 px-2.5 py-1.5 text-white transition-all duration-200 hover:bg-blue-600"
									>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
								<SuggestionBadges
									suggestions={contextualSuggestions.assumptions}
									onSuggestionClick={(assumption) => {
										setNewAssumption(assumption)
										setShowAssumptionSuggestions(false)
									}}
									show={showAssumptionSuggestions}
								/>
								<div className="space-y-2">
									{assumptions.map((assumption, index) => (
										<div
											key={`assumption-${index}-${assumption.slice(0, 10)}`}
											className="group flex w-fit items-start gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 py-1 shadow-sm transition-all duration-200 hover:shadow-md"
										>
											<div className="mt-2 flex-shrink-0">
												<div className="h-2 w-2 rounded-full bg-blue-500" />
											</div>
											<span className="flex-1 font-medium text-gray-800 leading-relaxed">{assumption}</span>
											<button
												onClick={() => removeAssumption(index)}
												className="flex-shrink-0 rounded-full p-1 opacity-0 transition-opacity duration-200 hover:bg-blue-200 group-hover:opacity-100"
											>
												<X className="h-4 w-4 text-blue-700" />
											</button>
										</div>
									))}
								</div>
							</div>

							{/* Unknowns */}
							<div>
								<label className="mb-2 block font-semibold text-foreground">What do we not know?</label>
								<div className="mb-4 flex gap-3">
									<Input
										placeholder={
											templateKey === "understand_customer_needs"
												? "Add the biggest unknown that would change our direction..."
												: "Add something you're unsure about..."
										}
										value={newUnknown}
										onChange={(e) => setNewUnknown(e.target.value)}
										onKeyPress={(e) => e.key === "Enter" && addUnknown()}
										onFocus={() => setShowUnknownSuggestions(true)}
										onBlur={() => setTimeout(() => setShowUnknownSuggestions(false), 150)}
										className="flex-1"
									/>
									<Button
										onClick={addUnknown}
										className="w-auto bg-amber-500 px-2.5 py-1.5 text-white transition-all duration-200 hover:bg-amber-600"
									>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
								<SuggestionBadges
									suggestions={contextualSuggestions.unknowns}
									onSuggestionClick={(unknown) => {
										setNewUnknown(unknown)
										setShowUnknownSuggestions(false)
									}}
									show={showUnknownSuggestions}
								/>
								<div className="space-y-2">
									{unknowns.map((unknown, index) => (
										<div
											key={`unknown-${index}-${unknown.slice(0, 10)}`}
											className="group flex w-fit items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 py-1 shadow-sm transition-all duration-200 hover:shadow-md"
										>
											<div className="mt-0.5 flex-shrink-0">
												<HelpCircle className="h-5 w-5 text-amber-600" />
											</div>
											<span className="flex-1 font-medium text-gray-800 leading-relaxed">{unknown}</span>
											<button
												onClick={() => removeUnknown(index)}
												className="flex-shrink-0 rounded-full p-1 opacity-0 transition-opacity duration-200 hover:bg-amber-200 group-hover:opacity-100"
											>
												<X className="h-4 w-4 text-amber-700" />
											</button>
										</div>
									))}
								</div>
							</div>

							{/* Target Audience - moved after Research Goal */}
							<div>
								<div className="mb-4 flex items-center gap-2">
									<Users className="h-5 w-5" />
									Your Market
								</div>
								<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
									<CardContent className="space-y-3 p-3 sm:p-4">
										<div>
											<label className="mb-2 block font-semibold text-foreground">Organizations</label>
											<div className="mb-4 flex gap-3">
												<Input
													placeholder={
														templateKey === "understand_customer_needs"
															? "e.g., Early-stage SaaS, Mid-market B2B teams, Ecommerce brands"
															: "e.g., B2B SaaS companies, E-commerce retailers"
													}
													value={newOrg}
													onChange={(e) => setNewOrg(e.target.value)}
													onKeyPress={(e) => e.key === "Enter" && addOrg()}
													onFocus={() => setShowOrgSuggestions(true)}
													onBlur={() => setTimeout(() => setShowOrgSuggestions(false), 150)}
													className="flex-1"
												/>
												<Button
													onClick={addOrg}
													className="w-auto bg-green-500 px-2.5 py-1.5 text-white transition-all duration-200 hover:bg-green-600"
												>
													<Plus className="h-4 w-4" />
												</Button>
											</div>
											<SuggestionBadges
												suggestions={contextualSuggestions.orgs}
												onSuggestionClick={(org) => {
													setNewOrg(org)
													setShowOrgSuggestions(false)
												}}
												show={showOrgSuggestions}
											/>
											<div className="flex flex-wrap gap-3">
												{target_orgs.map((org) => (
													<div
														key={org}
														className="group flex w-fit items-center gap-2 rounded-full border border-green-300 bg-gradient-to-r from-green-100 to-emerald-100 px-4 py-1 shadow-sm transition-all duration-200 hover:shadow-md"
													>
														<span className="font-medium text-green-800">{org}</span>
														<button
															onClick={() => removeOrg(org)}
															className="rounded-full p-0.5 opacity-0 transition-opacity duration-200 hover:bg-green-200 group-hover:opacity-100"
														>
															<X className="h-3 w-3 text-green-700" />
														</button>
													</div>
												))}
											</div>
										</div>

										<div>
											<label className="mb-2 block font-semibold text-foreground">People's Roles</label>
											<div className="mb-4 flex gap-3">
												<Input
													placeholder={
														templateKey === "understand_customer_needs"
															? "e.g., Product Manager, Head of Growth, UX Researcher, Customer Success Lead"
															: "e.g., Product Manager, Marketing Director"
													}
													value={newRole}
													onChange={(e) => setNewRole(e.target.value)}
													onKeyPress={(e) => e.key === "Enter" && addRole()}
													onFocus={() => setShowRoleSuggestions(true)}
													onBlur={() => setTimeout(() => setShowRoleSuggestions(false), 150)}
													className="flex-1"
												/>
												<Button
													onClick={addRole}
													className="w-auto bg-purple-500 px-2.5 py-1.5 text-white transition-all duration-200 hover:bg-purple-600"
												>
													<Plus className="h-4 w-4" />
												</Button>
											</div>
											<SuggestionBadges
												suggestions={contextualSuggestions.roles}
												onSuggestionClick={(role) => {
													setNewRole(role)
													setShowRoleSuggestions(false)
												}}
												show={showRoleSuggestions}
											/>
											<div className="flex flex-wrap gap-3">
												{target_roles.map((role) => (
													<div
														key={role}
														className="group flex w-fit items-center gap-2 rounded-full border border-purple-300 bg-gradient-to-r from-purple-100 to-violet-100 px-4 py-1 shadow-sm transition-all duration-200 hover:shadow-md"
													>
														<span className="font-medium text-purple-800">{role}</span>
														<button
															onClick={() => removeRole(role)}
															className="rounded-full p-0.5 opacity-0 transition-opacity duration-200 hover:bg-purple-200 group-hover:opacity-100"
														>
															<X className="h-3 w-3 text-purple-700" />
														</button>
													</div>
												))}
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Custom Instructions Collapsible Section */}
				<div className="mb-6">
					<Button
						variant="ghost"
						onClick={() => setShowCustomInstructions(!showCustomInstructions)}
						className="flex items-center gap-2 p-0 text-muted-foreground text-sm hover:text-foreground"
					>
						{showCustomInstructions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
						Custom Instructions (Optional)
					</Button>

					{showCustomInstructions && (
						<div className="mt-3">
							<Textarea
								placeholder="Any specific instructions for the AI analysis or interview generation..."
								value={custom_instructions}
								onChange={(e) => setCustomInstructions(e.target.value)}
								onBlur={handleCustomInstructionsBlur}
								rows={3}
								className="border-border bg-background text-foreground"
							/>
						</div>
					)}
				</div>

				{showNextButton && (
					<div className="flex justify-between">
						<div className="flex items-center">
							{isSaving ? (
								<StatusPill variant="active">
									Saving <ProgressDots className="ml-1" />
								</StatusPill>
							) : null}
						</div>
						<Button onClick={handleNext} disabled={!isValid || isLoading}>
							Generate Interview Questions
							<ChevronRight className="ml-2 h-4 w-4" />
						</Button>
					</div>
				)}
			</div>
		</div>
	)
}
