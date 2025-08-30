import { useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronRight, HelpCircle, Plus, Target, Users, X } from "lucide-react"
import { z } from "zod"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import consola from "consola"
import { useAutoSave } from "../hooks/useAutoSave"
import { createClient } from "~/lib/supabase/client"
import { getProjectContextGeneric } from "~/features/questions/db"

// Zod schema for validation
const projectGoalsSchema = z.object({
	target_orgs: z.array(z.string()).min(1, "At least one target organization is required"),
	target_roles: z.array(z.string()).min(1, "At least one target role is required"),
	research_goal: z.string().min(1, "Research goal is required"),
	research_goal_details: z.string().min(1, "Research goal details are required"),
	assumptions: z.array(z.string()),
	unknowns: z.array(z.string()),
	custom_instructions: z.string().optional(),
})

type ProjectGoalsData = z.infer<typeof projectGoalsSchema>

interface ProjectGoalsScreenProps {
	onNext: (data: {
		target_orgs: string[]
		target_roles: string[]
		research_goal: string
		research_goal_details: string
		assumptions: string[]
		unknowns: string[]
		custom_instructions?: string
	}) => void
	projectId?: string
}

export default function ProjectGoalsScreen({ onNext, projectId }: ProjectGoalsScreenProps) {
	const [target_orgs, setTargetOrgs] = useState<string[]>([])
	const [target_roles, setTargetRoles] = useState<string[]>([])
	const [newOrg, setNewOrg] = useState("")
	const [newRole, setNewRole] = useState("")
	const [research_goal, setResearchGoal] = useState("")
	const [research_goal_details, setResearchGoalDetails] = useState("")
	const [assumptions, setAssumptions] = useState<string[]>([])
	const [unknowns, setUnknowns] = useState<string[]>([])
	const [newAssumption, setNewAssumption] = useState("")
	const [newUnknown, setNewUnknown] = useState("")
	const [custom_instructions, setCustomInstructions] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId)
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const [showCustomInstructions, setShowCustomInstructions] = useState(false)
	const supabase = createClient()

	// Auto-save hook - always call but skip operations when no projectId
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

	// Function to create project on first input
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

				// Force update the auto-save hook with new projectId
				setTimeout(() => {
					// Save any pending data now that we have a projectId
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
			// Prefer loading directly from project_sections via generic context merge
			const ctx = await getProjectContextGeneric(supabase, currentProjectId)
			let populatedFromContext = false
			if (ctx?.merged) {
				const m = ctx.merged as Record<string, unknown>
				const hasAny =
					(Array.isArray(m["target_orgs"]) && (m["target_orgs"] as unknown[]).length > 0) ||
					(Array.isArray(m["target_roles"]) && (m["target_roles"] as unknown[]).length > 0) ||
					(typeof m["research_goal"] === "string" && (m["research_goal"] as string).length > 0) ||
					(Array.isArray(m["assumptions"]) && (m["assumptions"] as unknown[]).length > 0) ||
					(Array.isArray(m["unknowns"]) && (m["unknowns"] as unknown[]).length > 0) ||
					(typeof m["custom_instructions"] === "string" && (m["custom_instructions"] as string).length > 0)

				if (hasAny) {
					setTargetOrgs(((m["target_orgs"] as string[]) ?? []))
					setTargetRoles(((m["target_roles"] as string[]) ?? []))
					setResearchGoal(((m["research_goal"] as string) ?? ""))
					setResearchGoalDetails(((m["research_goal_details"] as string) ?? ""))
					setAssumptions(((m["assumptions"] as string[]) ?? []))
					setUnknowns(((m["unknowns"] as string[]) ?? []))
					setCustomInstructions(((m["custom_instructions"] as string) ?? ""))
					populatedFromContext = true
					consola.log("Loaded project context from project_sections (merged)")
				}
			}

			// Fallback to API if context empty or unavailable
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
		}
	}, [currentProjectId, supabase])

	// Load existing data if projectId is provided
	useEffect(() => {
		if (currentProjectId) {
			loadProjectData()
		}
	}, [currentProjectId, loadProjectData])

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

	const addAssumption = async () => {
		if (newAssumption.trim() && !assumptions.includes(newAssumption.trim())) {
			if (!currentProjectId) {
				await createProjectIfNeeded()
				// Don't save here, wait for projectId to be set
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
		if (target_orgs.length > 0 && target_roles.length > 0 && research_goal.trim() && research_goal_details.trim()) {
			// Pass snake_case data to next step
			onNext({
				target_orgs,
				target_roles,
				research_goal,
				research_goal_details,
				assumptions,
				unknowns,
				custom_instructions: custom_instructions || undefined,
				projectId: currentProjectId,
			})
		}
	}

	// Auto-save handlers for blur (immediate save, non-debounced)
	const handleResearchGoalBlur = async () => {
		if (!research_goal.trim()) return
		if (!currentProjectId) await createProjectIfNeeded()
		saveResearchGoal(research_goal, research_goal_details, false)
	}

	const handleResearchGoalDetailsBlur = async () => {
		if (!research_goal.trim()) return
		if (!currentProjectId) await createProjectIfNeeded()
		saveResearchGoal(research_goal, research_goal_details, false)
	}

	const handleCustomInstructionsBlur = () => {
		if (custom_instructions.trim()) {
			saveCustomInstructions(custom_instructions)
		}
	}

	// Custom instructions: blur-only save to reduce chatter

	const isValid =
		target_orgs.length > 0 && target_roles.length > 0 && research_goal.trim() && research_goal_details.trim()

	const onboardingSteps = [
		{ id: "goals", title: "Project Goals" },
		{ id: "questions", title: "Questions" },
		{ id: "upload", title: "Upload" },
	]

	return (
		<div className="mx-auto min-h-screen max-w-4xl bg-background p-4 text-foreground sm:p-4 md:p-6 lg:p-8">
			{/* Stepper */}
			<div className="mb-6">
				<div className="flex items-start justify-center gap-4 sm:gap-6 md:gap-10">
					{onboardingSteps.map((step, index) => (
						<div key={step.id} className="flex items-center">
							<div className="flex flex-col items-center">
								<div
									className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium sm:h-8 sm:w-8 sm:text-sm ${
										step.id === "goals" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
									}`}
								>
									{index + 1}
								</div>
								<span
									className={`mt-1 line-clamp-1 text-[10px] font-medium sm:text-xs md:text-sm ${
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

			<div className="mb-8">
				<div className="mb-4 flex items-center gap-3">
					{isSaving && <div className="text-muted-foreground text-sm">Auto-saving...</div>}
				</div>
				{/* <p className="text-muted-foreground sm:hidden l:visible">
					Define your research goals and target audience to get started with evidence-based insights.
				</p> */}
			</div>

			<div className="space-y-8">
				{/* Research Goal - moved first */}
				<div className="flex items-center gap-2 mb-3">
					<Target className="h-5 w-5" /> Research Goal
				</div>
				<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
					<CardContent className="space-y-3 sm:p-3">
						<div>
							<label className="mb-2 block text-foreground">What do we want to learn?</label>
							<Input
								placeholder="e.g., Understanding price sensitivity for our new pricing tier"
								value={research_goal}
								onChange={(e) => setResearchGoal(e.target.value)}
								onBlur={handleResearchGoalBlur}
							/>
						</div>

						<div>
							<label className="mb-2 block text-foreground">Goal Details</label>
							<Textarea
								placeholder="Describe what you want to learn and why it matters for your product/business decisions..."
								value={research_goal_details}
								onChange={(e) => setResearchGoalDetails(e.target.value)}
								rows={4}
								className="border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-3 text-base leading-relaxed shadow-sm transition-all duration-200 hover:border-gray-300 resize-none"
							/>
						</div>

						<div>
							<label className="mb-2 block text-foreground">What do we not know?</label>
							<div className="mb-4 flex gap-3">
								<Input
									placeholder="Add something you're unsure about..."
									value={newUnknown}
									onChange={(e) => setNewUnknown(e.target.value)}
									onKeyPress={(e) => e.key === "Enter" && addUnknown()}
									className="border-2 border-amber-200 bg-amber-50 text-gray-900 placeholder:text-amber-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200"
								/>
								<Button onClick={addUnknown} className="bg-amber-500 hover:bg-amber-600 text-white border-0 rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200">
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<div className="space-y-2">
								{unknowns.map((unknown, index) => (
									<div
										key={`unknown-${index}-${unknown.slice(0, 10)}`}
										className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 group"
									>
										<div className="flex-shrink-0 mt-0.5">
											<HelpCircle className="h-5 w-5 text-amber-600" />
										</div>
										<span className="flex-1 text-gray-800 font-medium leading-relaxed">{unknown}</span>
										<button 
											onClick={() => removeUnknown(index)}
											className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-full hover:bg-amber-200"
										>
											<X className="h-4 w-4 text-amber-700" />
										</button>
									</div>
								))}
							</div>
						</div>

						<div>
							<label className="mb-2 block text-foreground">What do we think we know?</label>
							<div className="mb-4 flex gap-3">
								<Input
									placeholder="Add something you believe to be true..."
									value={newAssumption}
									onChange={(e) => setNewAssumption(e.target.value)}
									onKeyPress={(e) => e.key === "Enter" && addAssumption()}
									className="border-2 border-blue-200 bg-blue-50 text-gray-900 placeholder:text-blue-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200"
								/>
								<Button onClick={addAssumption} className="bg-blue-500 hover:bg-blue-600 text-white border-0 rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200">
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<div className="space-y-2">
								{assumptions.map((assumption, index) => (
									<div
										key={`assumption-${index}-${assumption.slice(0, 10)}`}
										className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 group"
									>
										<div className="flex-shrink-0 mt-1">
											<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
										</div>
										<span className="flex-1 text-gray-800 font-medium leading-relaxed">{assumption}</span>
										<button 
											onClick={() => removeAssumption(index)}
											className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-full hover:bg-blue-200"
										>
											<X className="h-4 w-4 text-blue-700" />
										</button>
									</div>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
				{/* Target Audience - moved after Research Goal */}
				<div className="flex items-center gap-2 mb-3">
					<Users className="h-5 w-5" />
					Your Market
				</div>
				<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm py-0">
					<CardContent className="space-y-3 sm:p-3">
						<div>
							<label className="mb-2 block text-foreground">Organizations</label>
							<div className="mb-4 flex gap-3">
								<Input
									placeholder="e.g., B2B SaaS companies, E-commerce retailers"
									value={newOrg}
									onChange={(e) => setNewOrg(e.target.value)}
									onKeyPress={(e) => e.key === "Enter" && addOrg()}
									className="border-2 border-green-200 bg-green-50 text-gray-900 placeholder:text-green-600 focus:border-green-400 focus:ring-2 focus:ring-green-400/20 rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200"
								/>
								<Button onClick={addOrg} className="bg-green-500 hover:bg-green-600 text-white border-0 rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200">
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<div className="flex flex-wrap gap-3">
								{target_orgs.map((org) => (
									<div key={org} className="bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 group">
										<span className="text-green-800 font-medium">{org}</span>
										<button 
											onClick={() => removeOrg(org)}
											className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-0.5 rounded-full hover:bg-green-200"
										>
											<X className="h-3 w-3 text-green-700" />
										</button>
									</div>
								))}
							</div>
						</div>

						<div>
							<label className="mb-2 block text-foreground">People's Roles</label>
							<div className="mb-4 flex gap-3">
								<Input
									placeholder="e.g., Product Manager, Marketing Director"
									value={newRole}
									onChange={(e) => setNewRole(e.target.value)}
									onKeyPress={(e) => e.key === "Enter" && addRole()}
									className="border-2 border-purple-200 bg-purple-50 text-gray-900 placeholder:text-purple-600 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200"
								/>
								<Button onClick={addRole} className="bg-purple-500 hover:bg-purple-600 text-white border-0 rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200">
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<div className="flex flex-wrap gap-3">
								{target_roles.map((role) => (
									<div key={role} className="bg-gradient-to-r from-purple-100 to-violet-100 border border-purple-300 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 group">
										<span className="text-purple-800 font-medium">{role}</span>
										<button 
											onClick={() => removeRole(role)}
											className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-0.5 rounded-full hover:bg-purple-200"
										>
											<X className="h-3 w-3 text-purple-700" />
										</button>
									</div>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
				{/* Custom Instructions Collapsible Section */}
				<div className="mb-6">
					<Button
						variant="ghost"
						onClick={() => setShowCustomInstructions(!showCustomInstructions)}
						className="flex items-center gap-2 p-0 text-sm text-muted-foreground hover:text-foreground"
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
				<div className="flex justify-between">
					<div className="flex items-center">
						{isSaving && <div className="text-muted-foreground text-sm">Auto-saving...</div>}
					</div>
					<Button onClick={handleNext} disabled={!isValid || isLoading}>
						Generate Interview Questions
						<ChevronRight className="ml-2 h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	)
}
