import consola from "consola"
import {
	ChevronDown,
	ChevronRight,
	Clock,
	GraduationCapIcon,
	HelpCircle,
	Info,
	Loader2,
	Option,
	Plus,
	Target,
	Users,
	X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import InlineEdit from "~/components/ui/inline-edit"
import { Input } from "~/components/ui/input"
import { ProgressDots } from "~/components/ui/ProgressDots"
import { StatusPill } from "~/components/ui/StatusPill"
import { Textarea } from "~/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { getProjectContextGeneric } from "~/features/questions/db"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
import { createClient } from "~/lib/supabase/client"
import type { Project } from "~/types"
import type { ResearchMode } from "~/types/research"
import { useAutoSave } from "../hooks/useAutoSave"
import ContextualSuggestions from "./ContextualSuggestions"

type TemplatePrefill = {
	template_key: string
	customer_problem: string
	target_orgs: string[]
	target_roles: string[]
	offerings: string[]
	competitors: string[]
	research_goal: string
	decision_questions: string[]
	assumptions: string[]
	unknowns: string[]
	custom_instructions: string
}

// Removed sampleData to prevent auto-population

// Zod schema for validation
const projectGoalsSchema = z.object({
	customer_problem: z.string().min(1, "Customer problem is required"),
	// Organizations are optional - user can specify none
	target_orgs: z.array(z.string()).default([]),
	target_roles: z.array(z.string()).min(1, "At least one target role is required"),
	offerings: z.array(z.string()).default([]),
	competitors: z.array(z.string()).default([]),
	research_goal: z.string().min(1, "Research goal is required"),
	decision_questions: z.array(z.string()).min(1, "At least one decision question is required"),
	assumptions: z.array(z.string()).default([]),
	unknowns: z.array(z.string()).min(1, "At least one unknown is required"),
	custom_instructions: z.string().optional(),
})

type ProjectGoalsData = z.infer<typeof projectGoalsSchema>

// Removed sampleGoals to prevent auto-population

// Removed contextual suggestions function to rely solely on AI-generated suggestions

// Removed SuggestionBadges component - no longer needed

interface ProjectGoalsScreenProps {
	onNext: (data: {
		customer_problem: string
		target_orgs: string[]
		target_roles: string[]
		offerings: string[]
		competitors: string[]
		research_goal: string
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
	const [customer_problem, setCustomerProblem] = useState("")
	const [target_orgs, setTargetOrgs] = useState<string[]>([])
	const [target_roles, setTargetRoles] = useState<string[]>([])
	const [offerings, setOfferings] = useState<string[]>([])
	const [competitors, setCompetitors] = useState<string[]>([])
	const [newOrg, setNewOrg] = useState("")
	const [newRole, setNewRole] = useState("")
	const [newOffering, setNewOffering] = useState("")
	const [newCompetitor, setNewCompetitor] = useState("")
	const [research_goal, setResearchGoal] = useState("")
	const [decision_questions, setDecisionQuestions] = useState<string[]>([])
	const [newDecisionQuestion, setNewDecisionQuestion] = useState("")
	const [assumptions, setAssumptions] = useState<string[]>([])
	const [unknowns, setUnknowns] = useState<string[]>([])
	const [newAssumption, setNewAssumption] = useState("")
	const [newUnknown, setNewUnknown] = useState("")
	const [custom_instructions, setCustomInstructions] = useState("")
	const [target_conversations, setTargetConversations] = useState(10)
	const [researchMode, setResearchMode] = useState<ResearchMode>("exploratory")
	const [interview_duration, setInterviewDuration] = useState<number>(30)
	const [isLoading, setIsLoading] = useState(false)
	const [contextLoaded, setContextLoaded] = useState(false)
	const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId)
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const [ensuringStructure, setEnsuringStructure] = useState(false)
	const [showCustomInstructions, setShowCustomInstructions] = useState(false)
	// Removed showGoalSuggestions state - no longer using fallback suggestions
	const [_showDecisionQuestionSuggestions, _setShowDecisionQuestionSuggestions] = useState(false)
	const [showDecisionQuestionInput, setShowDecisionQuestionInput] = useState(false)
	const [showOrgSuggestions, setShowOrgSuggestions] = useState(false)
	const [showRoleSuggestions, setShowRoleSuggestions] = useState(false)
	const [showOfferingSuggestions, setShowOfferingSuggestions] = useState(false)
	const [showAssumptionSuggestions, setShowAssumptionSuggestions] = useState(false)
	const [showUnknownSuggestions, setShowUnknownSuggestions] = useState(false)
	const [activeSuggestionType, setActiveSuggestionType] = useState<string | null>(null)
	const [shownSuggestionsByType, setShownSuggestionsByType] = useState<Record<string, string[]>>({})
	const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
	const [hasAttemptedNext, setHasAttemptedNext] = useState(false)
	const supabase = createClient()

	// Feature flag for chat setup button
	const { isEnabled: isSetupChatEnabled, isLoading: isFeatureFlagLoading } = usePostHogFeatureFlag("ffSetupChat")

	// Accordion state - only one section can be open at a time
	const [openAccordion, setOpenAccordion] = useState<string | null>("research-goal")
	// Reset active suggestion type when accordion changes
	useEffect(() => {
		setActiveSuggestionType(null)
	}, [])

	// Helper function to format research mode display
	const getResearchModeDisplay = (mode: ResearchMode) => {
		switch (mode) {
			case "exploratory":
				return "Exploratory"
			case "validation":
				return "Validation"
			case "user_testing":
				return "User Testing"
			default:
				return "Exploratory"
		}
	}

	// Refs for input fields
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

	const { saveSection, isSaving } = useAutoSave({
		projectId: currentProjectId || "",
		debounceMs: 2000,
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

	// Save settings - upserts to preserve other settings
	const saveSettings = useCallback(
		(updates: { target_conversations?: number; research_mode?: ResearchMode; interview_duration?: number }) => {
			const payload = updates.research_mode ? { ...updates, conversation_type: updates.research_mode } : updates
			saveSection("settings", payload)
		},
		[saveSection]
	)

	const ensureResearchStructure = useCallback(
		async (projectIdToUse: string | undefined) => {
			if (!projectIdToUse) return projectIdToUse
			if (ensuringStructure) return projectIdToUse
			if (!research_goal.trim() || target_roles.length === 0) return projectIdToUse

			setEnsuringStructure(true)
			try {
				const checkResponse = await fetch(`/api/check-research-structure?project_id=${projectIdToUse}`)
				const checkBody = await checkResponse.json()
				if (!checkResponse.ok) {
					throw new Error(checkBody.error || checkBody.details || "Failed to check research structure")
				}

				const summary = (checkBody.summary as Record<string, unknown>) || {}
				const hasExistingStructure = Boolean(summary.has_decision_questions && summary.has_research_questions)
				if (hasExistingStructure) {
					return projectIdToUse
				}

				const formData = new FormData()
				formData.append("project_id", projectIdToUse)
				formData.append("research_goal", research_goal)
				formData.append("research_mode", researchMode)
				if (customer_problem.trim()) formData.append("customer_problem", customer_problem)
				if (target_roles.length > 0) formData.append("target_roles", target_roles.join(", "))
				if (target_orgs.length > 0) formData.append("target_orgs", target_orgs.join(", "))
				if (offerings.length > 0) formData.append("offerings", offerings.join(", "))
				if (competitors.length > 0) formData.append("competitors", competitors.join(", "))
				if (assumptions.length > 0) formData.append("assumptions", assumptions.join("\n"))
				if (unknowns.length > 0) formData.append("unknowns", unknowns.join("\n"))
				if (custom_instructions.trim()) formData.append("custom_instructions", custom_instructions)

				const generateResponse = await fetch("/api/generate-research-structure", {
					method: "POST",
					body: formData,
				})
				const generateBody = await generateResponse.json()
				if (!generateResponse.ok || !generateBody?.success) {
					throw new Error(generateBody?.details || generateBody?.error || "Failed to generate research structure")
				}

				consola.log("[ProjectGoals] Automatically generated research structure", {
					projectId: projectIdToUse,
					decisionQuestions: generateBody?.structure?.decision_questions?.length ?? 0,
					researchQuestions: generateBody?.structure?.research_questions?.length ?? 0,
				})
				return projectIdToUse
			} catch (error) {
				consola.error("[ProjectGoals] ensureResearchStructure failed", error)
				toast.error(error instanceof Error ? error.message : "Failed to generate research structure")
				throw error
			} finally {
				setEnsuringStructure(false)
			}
		},
		[
			assumptions,
			competitors,
			custom_instructions,
			customer_problem,
			ensuringStructure,
			offerings,
			research_goal,
			researchMode,
			target_orgs,
			target_roles,
			unknowns,
		]
	)

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
					if (assumptions.length > 0) saveSection("assumptions", assumptions)
					if (unknowns.length > 0) saveSection("unknowns", unknowns)
					if (research_goal.trim()) saveSection("research_goal", research_goal)
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
		assumptions,
		unknowns,


		saveSection,
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
					(typeof m.customer_problem === "string" && (m.customer_problem as string).length > 0) ||
					(Array.isArray(m.target_orgs) && (m.target_orgs as unknown[]).length > 0) ||
					(Array.isArray(m.target_roles) && (m.target_roles as unknown[]).length > 0) ||
					(Array.isArray(m.offerings) && (m.offerings as unknown[]).length > 0) ||
					(typeof m.offerings === "string" && (m.offerings as string).length > 0) ||
					(Array.isArray(m.competitors) && (m.competitors as unknown[]).length > 0) ||
					(typeof m.research_goal === "string" && (m.research_goal as string).length > 0) ||
					(Array.isArray(m.decision_questions) && (m.decision_questions as unknown[]).length > 0) ||
					(Array.isArray(m.assumptions) && (m.assumptions as unknown[]).length > 0) ||
					(Array.isArray(m.unknowns) && (m.unknowns as unknown[]).length > 0) ||
					(typeof m.custom_instructions === "string" && (m.custom_instructions as string).length > 0)

				if (hasAny) {
					setCustomerProblem((m.customer_problem as string) ?? "")
					setTargetOrgs((m.target_orgs as string[]) ?? [])
					setTargetRoles((m.target_roles as string[]) ?? [])
					// Handle offerings - convert string to array if needed, guard against null
					const loadedOfferings = m.offerings
					if (Array.isArray(loadedOfferings)) {
						setOfferings(loadedOfferings)
					} else if (typeof loadedOfferings === "string" && loadedOfferings.trim()) {
						setOfferings([loadedOfferings])
					} else {
						setOfferings([])
					}
					setCompetitors((m.competitors as string[]) ?? [])
					setResearchGoal((m.research_goal as string) ?? "")
					setAssumptions((m.assumptions as string[]) ?? [])
					setDecisionQuestions((m.decision_questions as string[]) ?? [])
					setUnknowns((m.unknowns as string[]) ?? [])
					setCustomInstructions((m.custom_instructions as string) ?? "")
					setTargetConversations((m.target_conversations as number) ?? 10)
					const mergedMode =
						(m.research_mode as ResearchMode | undefined) ?? (m.conversation_type as ResearchMode | undefined)
					setResearchMode(mergedMode ?? "exploratory")
					setInterviewDuration((m.interview_duration as number) ?? 30)
					populatedFromContext = true
					consola.log("Loaded project context from project_sections (merged)")
				}
			}

			if (!populatedFromContext) {
				const response = await fetch(`/api/load-project-goals?projectId=${currentProjectId}`)
				const result = await response.json()
				if (result.success && result.data) {
					const data = result.data
					setCustomerProblem(data.customer_problem || "")
					setTargetOrgs(data.target_orgs || [])
					setTargetRoles(data.target_roles || [])
					// Handle offerings - convert string to array if needed, guard against null
					if (Array.isArray(data.offerings)) {
						setOfferings(data.offerings)
					} else if (typeof data.offerings === "string" && data.offerings.trim()) {
						setOfferings([data.offerings])
					} else {
						setOfferings([])
					}
					setCompetitors(data.competitors || [])
					setResearchGoal(data.research_goal || "")
					setAssumptions(data.assumptions || [])
					setDecisionQuestions(data.decision_questions || [])
					setUnknowns(data.unknowns || [])
					setCustomInstructions(data.custom_instructions || "")
					setTargetConversations(data.target_conversations || 10)
					const fallbackMode =
						(data.research_mode as ResearchMode | undefined) ?? (data.conversation_type as ResearchMode | undefined)
					setResearchMode(fallbackMode || "exploratory")
					setInterviewDuration(data.interview_duration || 30)
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
			setCustomerProblem(prefill.customer_problem || "")
			setTargetOrgs(prefill.target_orgs || [])
			setTargetRoles(prefill.target_roles || [])
			// Handle offerings - convert string to array if needed, guard against null
			if (Array.isArray(prefill.offerings)) {
				setOfferings(prefill.offerings)
			} else if (typeof prefill.offerings === "string" && prefill.offerings.trim()) {
				setOfferings([prefill.offerings])
			} else {
				setOfferings([])
			}
			setCompetitors(prefill.competitors || [])
			setResearchGoal(prefill.research_goal || "")
			setAssumptions(prefill.assumptions || [])
			setUnknowns(prefill.unknowns || [])
			setCustomInstructions(prefill.custom_instructions || "")
			if ((prefill.decision_questions || []).length > 0) {
				setDecisionQuestions(prefill.decision_questions)
			}

			if (currentProjectId) {
				if (prefill.customer_problem) saveSection("customer_problem", prefill.customer_problem)
				if ((prefill.target_orgs || []).length > 0) saveSection("target_orgs", prefill.target_orgs)
				if ((prefill.target_roles || []).length > 0) saveSection("target_roles", prefill.target_roles)
				if ((prefill.offerings || []).length > 0) saveSection("offerings", prefill.offerings)
				if ((prefill.competitors || []).length > 0) saveSection("competitors", prefill.competitors)
				if (prefill.research_goal) saveSection("research_goal", prefill.research_goal)
				if ((prefill.assumptions || []).length > 0) saveSection("assumptions", prefill.assumptions)
				if ((prefill.unknowns || []).length > 0) saveSection("unknowns", prefill.unknowns)
				if (prefill.custom_instructions) saveSection("custom_instructions", prefill.custom_instructions)
			}
		}
	}, [
		prefill,
		contextLoaded,
		customer_problem,
		target_orgs.length,
		target_roles.length,
		offerings,
		competitors.length,
		research_goal,
		assumptions.length,
		unknowns.length,
		custom_instructions,
		currentProjectId,
		saveSection,
	])

	const addOrg = async () => {
		if (newOrg.trim() && !target_orgs.includes(newOrg.trim())) {
			await createProjectIfNeeded()
			const newOrgs = [...target_orgs, newOrg.trim()]
			setTargetOrgs(newOrgs)
			setNewOrg("")
			saveSection("target_orgs", newOrgs)
		}
	}

	const removeOrg = (org: string) => {
		const newOrgs = target_orgs.filter((o) => o !== org)
		setTargetOrgs(newOrgs)
		saveSection("target_orgs", newOrgs)
	}

	const addRole = async () => {
		if (newRole.trim() && !target_roles.includes(newRole.trim())) {
			await createProjectIfNeeded()
			const newRoles = [...target_roles, newRole.trim()]
			setTargetRoles(newRoles)
			setNewRole("")
			saveSection("target_roles", newRoles)
		}
	}

	const removeRole = (role: string) => {
		const newRoles = target_roles.filter((r) => r !== role)
		setTargetRoles(newRoles)
		saveSection("target_roles", newRoles)
	}

	// Helper to focus input and move cursor to end
	const focusInputAtEnd = (ref: React.RefObject<HTMLTextAreaElement | null>) => {
		if (ref.current) {
			ref.current.focus()
			const len = ref.current.value.length
			ref.current.setSelectionRange(len, len)
		}
	}

	const addDecisionQuestion = async () => {
		if (newDecisionQuestion.trim() && !decision_questions.includes(newDecisionQuestion.trim())) {
			await createProjectIfNeeded()
			const newQuestions = [...decision_questions, newDecisionQuestion.trim()]
			setDecisionQuestions(newQuestions)
			setNewDecisionQuestion("")
			saveSection("decision_questions", newQuestions)
		}
	}

	const updateDecisionQuestion = (index: number, value: string) => {
		const v = value.trim()
		if (!v) return
		const updated = [...decision_questions]
		updated[index] = v
		setDecisionQuestions(updated)
		saveSection("decision_questions", updated)
	}

	const removeDecisionQuestion = (index: number) => {
		const newQuestions = decision_questions.filter((_, i) => i !== index)
		setDecisionQuestions(newQuestions)
		saveSection("decision_questions", newQuestions)
	}

	const addAssumption = async () => {
		if (newAssumption.trim() && !assumptions.includes(newAssumption.trim())) {
			await createProjectIfNeeded()
			const newAssumptions = [...assumptions, newAssumption.trim()]
			setAssumptions(newAssumptions)
			setNewAssumption("")
			saveSection("assumptions", newAssumptions)
		}
	}

	const updateAssumption = (index: number, value: string) => {
		const v = value.trim()
		if (!v) return
		const updated = [...assumptions]
		updated[index] = v
		setAssumptions(updated)
		saveSection("assumptions", updated)
	}

	const addUnknown = async () => {
		if (newUnknown.trim()) {
			await createProjectIfNeeded()
			const newUnknowns = [...unknowns, newUnknown.trim()]
			setUnknowns(newUnknowns)
			setNewUnknown("")
			saveSection("unknowns", newUnknowns)
		}
	}

	const updateUnknown = (index: number, value: string) => {
		const v = value.trim()
		if (!v) return
		const updated = [...unknowns]
		updated[index] = v
		setUnknowns(updated)
		saveSection("unknowns", updated)
	}

	const removeAssumption = (index: number) => {
		const newAssumptions = assumptions.filter((_, i) => i !== index)
		setAssumptions(newAssumptions)
		saveSection("assumptions", newAssumptions)
	}

	const removeUnknown = (index: number) => {
		const newUnknowns = unknowns.filter((_, i) => i !== index)
		setUnknowns(newUnknowns)
		saveSection("unknowns", newUnknowns)
	}

	const handleNext = useCallback(async () => {
		setHasAttemptedNext(true)

		// Validate using Zod schema
		const validationResult = projectGoalsSchema.safeParse({
			customer_problem,
			target_orgs,
			target_roles,
			offerings,
			competitors,
			research_goal,
			decision_questions,
			assumptions,
			unknowns,
			custom_instructions,
		})

		consola.log("[ProjectGoals] Validation result:", validationResult)

		if (!validationResult.success) {
			// Extract and set validation errors
			const errors: Record<string, string> = {}
			const missingFields: string[] = []

			consola.log("[ProjectGoals] Raw validation errors:", validationResult.error.issues)

			validationResult.error?.issues?.forEach((err) => {
				consola.log("[ProjectGoals] Processing error:", err)
				const path = err.path.join(".")
				consola.log("[ProjectGoals] Path:", path, "Message:", err.message)
				errors[path] = err.message

				// Map field names to user-friendly labels
				const fieldLabels: Record<string, string> = {
					customer_problem: "Customer Problem",
					target_roles: "Target Roles",
					research_goal: "Research Goal",
					decision_questions: "Key Decisions",
					unknowns: "Unknowns",
				}

				const fieldLabel = fieldLabels[path]
				consola.log("[ProjectGoals] Field label for", path, ":", fieldLabel)
				if (fieldLabel && !missingFields.includes(fieldLabel)) {
					missingFields.push(fieldLabel)
					consola.log("[ProjectGoals] Added missing field:", fieldLabel)
				}
			})

			setValidationErrors(errors)

			consola.log("[ProjectGoals] Final validation errors:", errors)
			consola.log("[ProjectGoals] Final missing fields:", missingFields)

			// Show error with missing fields - ALWAYS show the toast
			const errorMessage =
				missingFields.length > 0
					? `Missing required fields: ${missingFields.join(", ")}`
					: "Please fill in all required fields"

			consola.log("[ProjectGoals] About to show toast with message:", errorMessage)

			try {
				toast.error(errorMessage, {
					duration: 5000,
				})
				consola.log("[ProjectGoals] Toast.error called successfully")
			} catch (toastError) {
				consola.error("[ProjectGoals] Error calling toast.error:", toastError)
			}

			return
		}

		// Clear validation errors if validation passes
		setValidationErrors({})

		try {
			const resolvedProjectId = (await createProjectIfNeeded()) || currentProjectId
			if (!resolvedProjectId) {
				toast.error("Unable to determine project. Please try again.")
				return
			}

			await ensureResearchStructure(resolvedProjectId)
			saveSection("research_goal", research_goal)
			onNext({
				customer_problem,
				target_orgs,
				target_roles,
				offerings,
				competitors,
				research_goal,
				decision_questions,
				assumptions,
				unknowns,
				custom_instructions: custom_instructions || undefined,
				projectId: resolvedProjectId,
			})
		} catch (error) {
			consola.error("[ProjectGoals] Unable to proceed to questions", error)
		}
	}, [
		assumptions,
		competitors,
		createProjectIfNeeded,
		currentProjectId,
		custom_instructions,
		customer_problem,
		decision_questions,
		ensureResearchStructure,
		offerings,
		onNext,
		research_goal,
		saveSection,
		target_orgs,
		target_roles,
		unknowns,
	])

	const handleResearchGoalBlur = async () => {
		if (!research_goal.trim()) return
		if (!currentProjectId) await createProjectIfNeeded()
		saveSection("research_goal", research_goal)
	}

	const handleCustomInstructionsBlur = () => {
		saveSection("custom_instructions", custom_instructions, { debounced: true })
	}

	// Removed contextualSuggestions fallback - rely only on AI-generated suggestions

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
							<h1 className="font-semibold text-2xl text-foreground">{project?.name}</h1>
							{/*
							-- hiding for now. future use --
							{templateKey === "understand_customer_needs" && (
								<StatusPill variant="neutral" className="mt-2">
									Intent: Understand Customer Needs
								</StatusPill>
							)} */}
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
					{/* 1. Customer Problem Section */}
					<Card>
						<CardHeader className="p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<HelpCircle className="h-5 w-5 text-orange-600" />
									<h2 className="font-semibold text-lg">
										What is the customer's problem?
										<span className="ml-1 text-red-600">*</span>
									</h2>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-flex">
												<Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
											</span>
										</TooltipTrigger>
										<TooltipContent className="max-w-xs">
											<p>Tell us about your business and the customer problem you're addressing.</p>
										</TooltipContent>
									</Tooltip>
								</div>
							</div>
						</CardHeader>

						<CardContent className="p-6 pt-0">
							<Textarea
								placeholder="e.g., Small businesses struggle to manage customer relationships efficiently without expensive CRM tools"
								value={customer_problem}
								onChange={(e) => {
									setCustomerProblem(e.target.value)
									saveSection("customer_problem", e.target.value, { debounced: true })
								}}
								rows={3}
								className="min-h-[80px]"
							/>
						</CardContent>
					</Card>

					{/* 5. Research Goal Accordion */}

					<Card>
						<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-muted/50">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Target className="h-5 w-5 text-blue-600" />
									<h2 className="font-semibold text-lg">
										What goal are you trying to achieve?
										<span className="ml-1 text-red-600">*</span>
									</h2>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-flex">
												<Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
											</span>
										</TooltipTrigger>
										<TooltipContent className="max-w-xs">
											<p>Define your research goal - what you're trying to learn or validate.</p>
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
								className="min-h-[72px] font-semibold text-primary text-xl"
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
								<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-muted/50">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Users className="h-5 w-5 text-purple-600" />
											<h2 className="font-semibold text-lg">
												Who are your ideal customers?
											</h2>
											<span className="rounded-md px-2 py-1 font-medium text-foreground/75 text-xs">
												{target_roles.length}
											</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="inline-flex">
														<Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
													</span>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>Identify the organizations and roles of people you want to interview.</p>
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
										<label className="mb-3 block font-semibold text-base text-foreground">Organizations</label>
										<div className="mb-3 flex flex-wrap gap-2">
											{target_orgs.map((org, index) => (
												<div
													key={`${org}-${index}`}
													className="group flex items-center gap-2 rounded-md border border-blue-300 bg-blue-100 px-3 py-1 text-sm transition-all hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-800/30"
												>
													<InlineEdit
														value={org}
														onSubmit={(val) => {
															const v = val.trim()
															if (!v) return
															const list = [...target_orgs]
															list[index] = v
															setTargetOrgs(list)
															saveSection("target_orgs", list)
														}}
														textClassName="flex-shrink-0 font-medium text-blue-800 dark:text-blue-300"
														inputClassName="h-6 py-0 text-blue-900 dark:text-blue-200"
													/>
													<button
														onClick={() => removeOrg(org)}
														className="rounded-md p-0.5 opacity-60 transition-all hover:bg-blue-300 hover:opacity-100 group-hover:opacity-100 dark:hover:bg-blue-700"
													>
														<X className="h-3 w-3 text-blue-700 dark:text-blue-400" />
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
													shownSuggestions={shownSuggestionsByType.organizations || []}
													isActive={activeSuggestionType === null || activeSuggestionType === "organizations"}
													onSuggestionClick={async (suggestion) => {
														if (!target_orgs.includes(suggestion.trim())) {
															await createProjectIfNeeded()
															const newOrgs = [...target_orgs, suggestion.trim()]
															setTargetOrgs(newOrgs)
															saveSection("target_orgs", newOrgs)
														}
													}}
													onSuggestionShown={(suggestions) => {
														if (activeSuggestionType === null) {
															setActiveSuggestionType("organizations")
														}
														setShownSuggestionsByType((prev) => ({
															...prev,
															organizations: suggestions,
														}))
													}}
												/>
											</div>
										)}
									</div>

									{/* Roles */}
									<div>
										<label className="mb-3 block font-semibold text-base text-foreground">
											People's Roles <span className="text-red-600">*</span>
										</label>
										<div className="mb-3 flex flex-wrap gap-2">
											{target_roles.map((role, index) => (
												<div
													key={`${role}-${index}`}
													className="group flex items-center gap-2 rounded-md border border-blue-300 bg-blue-100 px-3 py-1 text-sm transition-all hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-800/30"
												>
													<InlineEdit
														value={role}
														onSubmit={(val) => {
															const v = val.trim()
															if (!v) return
															const list = [...target_roles]
															list[index] = v
															setTargetRoles(list)
															saveSection("target_roles", list)
														}}
														textClassName="flex-shrink-0 font-medium text-blue-800 dark:text-blue-300"
														inputClassName="h-6 py-0 text-blue-900 dark:text-blue-200"
													/>
													<button
														onClick={() => removeRole(role)}
														className="rounded-md p-0.5 opacity-60 transition-all hover:bg-blue-300 hover:opacity-100 group-hover:opacity-100 dark:hover:bg-blue-700"
													>
														<X className="h-3 w-3 text-blue-700 dark:text-blue-400" />
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
													shownSuggestions={shownSuggestionsByType.roles || []}
													isActive={activeSuggestionType === null || activeSuggestionType === "roles"}
													onSuggestionClick={async (suggestion) => {
														if (!target_roles.includes(suggestion.trim())) {
															await createProjectIfNeeded()
															const newRoles = [...target_roles, suggestion.trim()]
															setTargetRoles(newRoles)
															saveSection("target_roles", newRoles)
														}
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

					{/* 3. Offerings Section */}
					<Card>
						<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-muted/50">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<GraduationCapIcon className="h-5 w-5 text-indigo-600" />
									<h2 className="font-semibold text-lg">What products and services do you offer?</h2>
									<span className="rounded-md px-2 py-1 font-medium text-foreground/75 text-xs">
										{offerings.length}
									</span>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-flex">
												<Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
											</span>
										</TooltipTrigger>
										<TooltipContent className="max-w-xs">
											<p>Describe your solutions - the products and services that address the customer problem.</p>
										</TooltipContent>
									</Tooltip>
								</div>
							</div>
						</CardHeader>

						<CardContent className="p-6 pt-0">
							<div className="mb-3 flex flex-wrap gap-2">
								{offerings.map((offering, index) => (
									<div
										key={`${offering}-${index}`}
										className="group flex items-center gap-2 rounded-md border border-blue-300 bg-blue-100 px-3 py-1 text-sm transition-all hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-800/30"
									>
										<InlineEdit
											value={offering}
											onSubmit={(val) => {
												const v = val.trim()
												if (!v) return
												const list = [...offerings]
												list[index] = v
												setOfferings(list)
												saveSection("offerings", list)
											}}
											textClassName="flex-shrink-0 font-medium text-blue-800 dark:text-blue-300"
											inputClassName="h-6 py-0 text-blue-900 dark:text-blue-200"
										/>
										<button
											onClick={() => {
												const newOfferings = offerings.filter((_, i) => i !== index)
												setOfferings(newOfferings)
												saveSection("offerings", newOfferings)
											}}
											className="rounded-md p-0.5 opacity-60 transition-all hover:bg-blue-300 hover:opacity-100 group-hover:opacity-100 dark:hover:bg-blue-700"
										>
											<X className="h-3 w-3 text-blue-700 dark:text-blue-400" />
										</button>
									</div>
								))}
							</div>
							<div className="flex gap-2">
								<Input
									placeholder="e.g., Cloud CRM platform, Mobile app, Integration marketplace"
									value={newOffering}
									onChange={(e) => setNewOffering(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && newOffering.trim()) {
											const newOfferings = [...offerings, newOffering.trim()]
											setOfferings(newOfferings)
											setNewOffering("")
											saveSection("offerings", newOfferings)
										}
									}}
									className="flex-1"
								/>
								<Button
									onClick={() => {
										if (newOffering.trim()) {
											const newOfferings = [...offerings, newOffering.trim()]
											setOfferings(newOfferings)
											setNewOffering("")
											saveSection("offerings", newOfferings)
										}
									}}
									variant="outline"
									size="sm"
								>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* 4. Competitors Section */}
					<Card>
						<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-muted/50">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Users className="h-5 w-5 text-red-600" />
									<h2 className="font-semibold text-lg">What other products are customers using?</h2>
									<span className="rounded-md px-2 py-1 font-medium text-foreground/75 text-xs">
										{competitors.length}
									</span>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-flex">
												<Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
											</span>
										</TooltipTrigger>
										<TooltipContent className="max-w-xs">
											<p>List the competitive alternatives or solutions customers might be using or considering.</p>
										</TooltipContent>
									</Tooltip>
								</div>
							</div>
						</CardHeader>

						<CardContent className="p-6 pt-0">
							<div className="mb-3 flex flex-wrap gap-2">
								{competitors.map((competitor, index) => (
									<div
										key={`${competitor}-${index}`}
										className="group flex items-center gap-2 rounded-md border border-blue-300 bg-blue-100 px-3 py-1 text-sm transition-all hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-800/30"
									>
										<InlineEdit
											value={competitor}
											onSubmit={(val) => {
												const v = val.trim()
												if (!v) return
												const list = [...competitors]
												list[index] = v
												setCompetitors(list)
												saveSection("competitors", list)
											}}
											textClassName="flex-shrink-0 font-medium text-blue-800 dark:text-blue-300"
											inputClassName="h-6 py-0 text-blue-900 dark:text-blue-200"
										/>
										<button
											onClick={() => {
												const newCompetitors = competitors.filter((_, i) => i !== index)
												setCompetitors(newCompetitors)
												saveSection("competitors", newCompetitors)
											}}
											className="rounded-md p-0.5 opacity-60 transition-all hover:bg-blue-300 hover:opacity-100 group-hover:opacity-100 dark:hover:bg-blue-700"
										>
											<X className="h-3 w-3 text-blue-700 dark:text-blue-400" />
										</button>
									</div>
								))}
							</div>
							<div className="flex gap-2">
								<Input
									placeholder="e.g., Salesforce, HubSpot, Excel spreadsheets"
									value={newCompetitor}
									onChange={(e) => setNewCompetitor(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && newCompetitor.trim()) {
											const newCompetitors = [...competitors, newCompetitor.trim()]
											setCompetitors(newCompetitors)
											setNewCompetitor("")
											saveSection("competitors", newCompetitors)
										}
									}}
									className="flex-1"
								/>
								<Button
									onClick={() => {
										if (newCompetitor.trim()) {
											const newCompetitors = [...competitors, newCompetitor.trim()]
											setCompetitors(newCompetitors)
											setNewCompetitor("")
											saveSection("competitors", newCompetitors)
										}
									}}
									variant="outline"
									size="sm"
								>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* 7. Key Decisions to make Accordion */}
					<Collapsible
						open={openAccordion === "key-questions"}
						onOpenChange={() => setOpenAccordion(openAccordion === "key-questions" ? null : "key-questions")}
					>
						<Card>
							<CollapsibleTrigger asChild>
								<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-muted/50">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Option className="h-5 w-5 text-green-600" />
											<h2 className="font-semibold text-lg">
												What key decisions are you facing?
												<span className="ml-1 text-red-600">*</span>
											</h2>
											<span className="rounded-md px-2 py-1 font-medium text-foreground/75 text-xs">
												{" "}
												{decision_questions.length}
											</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="inline-flex">
														<Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
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
												className="group flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 transition-all duration-200 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-800/30"
											>
												<div className="mt-1 flex-shrink-0">
													<div className="h-2 w-2 rounded-md bg-blue-500" />
												</div>
												<InlineEdit
													value={question}
													onSubmit={(val) => updateDecisionQuestion(index, val)}
													multiline={true}
													autoSize={true}
													textClassName="flex-shrink-0 text-foreground text-sm leading-relaxed"
													inputClassName="text-sm"
													showEditButton={true}
												/>
												<button
													onClick={() => removeDecisionQuestion(index)}
													className="flex-shrink-0 rounded-md p-1 opacity-60 transition-all duration-200 hover:bg-blue-200 hover:opacity-100 group-hover:opacity-100 dark:hover:bg-blue-700"
												>
													<X className="h-3 w-3 text-blue-700 dark:text-blue-400" />
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
												shownSuggestions={shownSuggestionsByType.decision_questions || []}
												isActive={activeSuggestionType === null || activeSuggestionType === "decision_questions"}
												onSuggestionClick={async (suggestion) => {
													if (!decision_questions.includes(suggestion.trim())) {
														await createProjectIfNeeded()
														const newQuestions = [...decision_questions, suggestion.trim()]
														setDecisionQuestions(newQuestions)
														saveSection("decision_questions", newQuestions)
													}
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
								<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-muted/50">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<GraduationCapIcon className="h-5 w-5 text-blue-600" />
											<h2 className="font-semibold text-lg">
												Assumptions & Unknowns
											</h2>
											<span className="rounded-md px-2 py-1 font-medium text-foreground/75 text-xs">
												{" "}
												{unknowns.length}
											</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="inline-flex">
														<Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
													</span>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>Address your riskiest assumptions to gain confidence in your decisions.</p>
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
										<div className="mb-6">
											<label className="mb-3 block font-semibold text-base text-foreground">Assumptions</label>
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
															textClassName="flex-1 text-foreground text-sm leading-relaxed"
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
										</div>

										{/* Unknowns -> Research Questions */}
										<div>
											<label className="mb-3 block font-semibold text-base text-foreground">
												Unknowns <span className="text-red-600">*</span>
											</label>
											<div className="mb-3 space-y-2">
												{unknowns.map((unknown, index) => (
													<div
														key={`unknown-${index}-${unknown.slice(0, 10)}`}
														className="group flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 transition-all hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-800/30"
													>
														<div className="mt-0.5 flex-shrink-0">
															<HelpCircle className="h-4 w-4 text-blue-600" />
														</div>
														<InlineEdit
															value={unknown}
															onSubmit={(val) => updateUnknown(index, val)}
															multiline={true}
															autoSize={true}
															textClassName="flex-shrink-0 text-foreground text-sm leading-relaxed"
															inputClassName="text-sm"
															showEditButton={true}
														/>
														<button
															onClick={() => removeUnknown(index)}
															className="flex-shrink-0 rounded-md p-1 opacity-60 transition-all hover:bg-blue-200 hover:opacity-100 group-hover:opacity-100 dark:hover:bg-blue-700"
														>
															<X className="h-3 w-3 text-blue-700 dark:text-blue-400" />
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
														shownSuggestions={shownSuggestionsByType.unknowns || []}
														isActive={activeSuggestionType === null || activeSuggestionType === "unknowns"}
														onSuggestionClick={async (suggestion) => {
															if (!unknowns.includes(suggestion.trim())) {
																await createProjectIfNeeded()
																const newUnknowns = [...unknowns, suggestion.trim()]
																setUnknowns(newUnknowns)
																saveSection("unknowns", newUnknowns)
															}
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

					{/* Interview Type & Scope Section - Collapsible (relocated) */}
					<Collapsible
						open={openAccordion === "type-scope"}
						onOpenChange={() => setOpenAccordion(openAccordion === "type-scope" ? null : "type-scope")}
					>
						<Card>
							<CollapsibleTrigger asChild>
								<CardHeader className="cursor-pointer p-4 transition-colors hover:bg-muted/50">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Clock className="h-5 w-5 text-green-600" />
											<h2 className="font-semibold text-lg">Interview Type & Scope</h2>
											<span className="rounded-md bg-muted px-2 py-1 font-medium text-muted-foreground text-xs">
												{getResearchModeDisplay(researchMode)} • {interview_duration} min
											</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="inline-flex">
														<Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
													</span>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>Set the interview type, duration, and target number to guide question generation.</p>
												</TooltipContent>
											</Tooltip>
										</div>
										{openAccordion === "type-scope" ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</div>
								</CardHeader>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<CardContent className="p-6 pt-0">
									<div className="grid gap-8 md:grid-cols-2">
										<div className="space-y-6">
											<div>
												<label className="mb-3 block font-semibold text-foreground text-sm">Conversation Type</label>
												<ToggleGroup
													className="grid w-full grid-cols-1 gap-2"
													onValueChange={(value) => {
														if (!value) return
														const mode = value as ResearchMode
														setResearchMode(mode)
														saveSettings({ research_mode: mode })
													}}
													type="single"
													value={researchMode}
												>
													<ToggleGroupItem
														value="exploratory"
														aria-label="Exploratory"
														className="justify-start rounded-lg border-2 px-4 py-3 data-[state=on]:border-primary data-[state=on]:bg-primary/5"
													>
														<div className="flex w-full items-center justify-between">
															<span className="font-medium">Exploratory</span>
															<span className="text-muted-foreground text-xs">Discovery</span>
														</div>
													</ToggleGroupItem>
													<ToggleGroupItem
														value="validation"
														aria-label="Validation"
														className="justify-start rounded-lg border-2 px-4 py-3 data-[state=on]:border-primary data-[state=on]:bg-primary/5"
													>
														<div className="flex w-full items-center justify-between">
															<span className="font-medium">Validation</span>
															<span className="text-muted-foreground text-xs">Testing</span>
														</div>
													</ToggleGroupItem>
													<ToggleGroupItem
														value="user_testing"
														aria-label="User Testing"
														className="justify-start rounded-lg border-2 px-4 py-3 data-[state=on]:border-primary data-[state=on]:bg-primary/5"
													>
														<div className="flex w-full items-center justify-between">
															<span className="font-medium">User Testing</span>
															<span className="text-muted-foreground text-xs">Usability</span>
														</div>
													</ToggleGroupItem>
												</ToggleGroup>
											</div>

											<div>
												<label className="mb-3 block font-semibold text-foreground text-sm">Interview Duration</label>
												<div className="flex items-center gap-3">
													<Input
														value={interview_duration}
														onChange={(e) => {
															const value = Number(e.target.value)
															if (!Number.isNaN(value)) {
																setInterviewDuration(value)
																saveSettings({ interview_duration: value })
															}
														}}
														type="number"
														min={15}
														max={90}
														step={5}
														className="w-24"
													/>
													<span className="text-muted-foreground text-sm">minutes</span>
												</div>
											</div>
										</div>

										<div className="space-y-6">
											<div>
												<label className="mb-3 block font-semibold text-foreground text-sm">Target Conversations</label>
												<div className="items center flex gap-3">
													<Input
														value={target_conversations}
														onChange={(e) => {
															const value = Number(e.target.value)
															if (!Number.isNaN(value)) {
																setTargetConversations(value)
																saveSettings({ target_conversations: value })
															}
														}}
														type="number"
														min={5}
														max={100}
														className="w-24"
													/>
													<span className="text-muted-foreground text-sm">interviews</span>
												</div>
											</div>

											<div className="rounded-lg border border-muted-foreground/30 border-dashed p-4">
												<p className="mb-2 font-semibold text-foreground text-sm">Mode guidance</p>
												<ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
													<li>Exploratory: Use when you're still framing the problem.</li>
													<li>Validation: Use when testing specific hypotheses.</li>
													<li>User Testing: Use when refining usability or adoption.</li>
												</ul>
											</div>
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
						className="flex items-center gap-2 p-0 text-gray-600 text-sm hover:text-foreground"
					>
						{showCustomInstructions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
						Custom Instructions
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex">
									<Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
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
					<div className="mt-8 border-border border-t pt-8">
						<div className="flex items-center justify-center">
							<Button
								onClick={handleNext}
								disabled={isLoading || ensuringStructure}
								size="lg"
								className="px-8 py-3"
							>
								{ensuringStructure ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Generating plan...
									</>
								) : (
									<>
										Conversation Prompts
										<ChevronRight className="ml-2 h-4 w-4" />
									</>
								)}
							</Button>
						</div>
					</div>
				)}
			</div>
		</TooltipProvider>
	)
}
