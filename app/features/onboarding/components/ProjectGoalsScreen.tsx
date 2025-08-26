import consola from "consola"
import { ChevronRight, HelpCircle, Plus, Target, Users, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { z } from "zod"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"

// Zod schema for validation
const projectGoalsSchema = z.object({
	targetOrg: z.string().min(1, "Target organization is required"),
	targetRoles: z.array(z.string()).min(1, "At least one target role is required"),
	goalTitle: z.string().min(1, "Goal title is required"),
	goalDetail: z.string().min(1, "Goal details are required"),
	assumptions: z.array(z.string()),
	unknowns: z.array(z.string()),
})

type ProjectGoalsData = z.infer<typeof projectGoalsSchema>

interface ProjectGoalsScreenProps {
	onNext: (data: { icp: string; role: string; goal: string; customGoal?: string }) => void
	projectId?: string
}

export default function ProjectGoalsScreen({ onNext, projectId }: ProjectGoalsScreenProps) {
	const [targetOrg, setTargetOrg] = useState("")
	const [targetRoles, setTargetRoles] = useState<string[]>([])
	const [newRole, setNewRole] = useState("")
	const [goalTitle, setGoalTitle] = useState("")
	const [goalDetail, setGoalDetail] = useState("")
	const [assumptions, setAssumptions] = useState<string[]>([])
	const [unknowns, setUnknowns] = useState<string[]>([])
	const [newAssumption, setNewAssumption] = useState("")
	const [newUnknown, setNewUnknown] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [hasChanges, setHasChanges] = useState(false)

	const loadProjectData = useCallback(async () => {
		if (!projectId) return

		try {
			const response = await fetch(`/api/load-project-goals?projectId=${projectId}`)
			const result = await response.json()

			if (result.success && result.data) {
				const data = result.data
				setTargetOrg(data.targetOrg || "")
				setTargetRoles(data.targetRoles || [])
				setGoalTitle(data.goalTitle || "")
				setGoalDetail(data.goalDetail || "")
				setAssumptions(data.assumptions || [])
				setUnknowns(data.unknowns || [])
				consola.log("Successfully loaded project data from database")
			}
		} catch (error) {
			consola.error("Failed to load project data:", error)
		}
	}, [projectId])

	// Load existing data if projectId is provided
	useEffect(() => {
		if (projectId) {
			loadProjectData()
		}
	}, [projectId, loadProjectData])

	const saveProjectData = useCallback(async () => {
		if (!projectId || !hasChanges) return

		setIsLoading(true)
		try {
			const payload = {
				projectId,
				targetOrg,
				targetRoles,
				goalTitle,
				goalDetail,
				assumptions,
				unknowns,
			}

			const response = await fetch("/api/save-project-goals", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			})

			const result = await response.json()

			if (result.success) {
				setHasChanges(false)
				consola.log("Project data saved successfully to database")
			} else {
				consola.error("Failed to save project data:", result.error)
			}
		} catch (error) {
			consola.error("Failed to save project data:", error)
		} finally {
			setIsLoading(false)
		}
	}, [projectId, hasChanges])

	// Auto-save when fields lose focus and data has changed
	useEffect(() => {
		if (hasChanges) {
			const timeout = setTimeout(saveProjectData, 1000) // Debounce saves
			return () => clearTimeout(timeout)
		}
	}, [hasChanges, saveProjectData])

	const markChanged = () => setHasChanges(true)

	const addRole = () => {
		if (newRole.trim() && !targetRoles.includes(newRole.trim())) {
			setTargetRoles([...targetRoles, newRole.trim()])
			setNewRole("")
			markChanged()
		}
	}

	const removeRole = (role: string) => {
		setTargetRoles(targetRoles.filter((r) => r !== role))
		markChanged()
	}

	const addAssumption = () => {
		if (newAssumption.trim()) {
			setAssumptions([...assumptions, newAssumption.trim()])
			setNewAssumption("")
			markChanged()
		}
	}

	const addUnknown = () => {
		if (newUnknown.trim()) {
			setUnknowns([...unknowns, newUnknown.trim()])
			setNewUnknown("")
			markChanged()
		}
	}

	const removeAssumption = (index: number) => {
		setAssumptions(assumptions.filter((_, i) => i !== index))
		markChanged()
	}

	const removeUnknown = (index: number) => {
		setUnknowns(unknowns.filter((_, i) => i !== index))
		markChanged()
	}

	const handleNext = () => {
		if (targetOrg.trim() && targetRoles.length > 0 && goalTitle.trim()) {
			// Save before proceeding
			saveProjectData()

			// Convert to legacy format for onNext callback
			onNext({
				icp: targetOrg.trim(),
				role: targetRoles.join(", "),
				goal: "custom",
				customGoal: goalTitle.trim(),
			})
		}
	}

	const handleFieldBlur = () => {
		// Mark as changed when field loses focus and value is different
		markChanged()
	}

	const isValid = targetOrg.trim() && targetRoles.length > 0 && goalTitle.trim() && goalDetail.trim()

	return (
		<div className="mx-auto min-h-screen max-w-4xl bg-background p-8 text-foreground">
			<div className="mb-8">
				<div className="mb-4 flex items-center gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
						1
					</div>
					<h1 className="mb-2 text-3xl text-foreground">Project Setup</h1>
					{isLoading && <div className="text-muted-foreground text-sm">Saving...</div>}
				</div>
				<p className="text-muted-foreground">
					Define your target audience and research goals to get started with evidence-based insights.
				</p>
			</div>

			<div className="space-y-8">
				{/* Target Audience */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Target Audience
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						<div>
							<label className="mb-2 block text-foreground">Target Organization Type</label>
							<Input
								placeholder="e.g., B2B SaaS companies, E-commerce retailers, Healthcare providers"
								value={targetOrg}
								onChange={(e) => setTargetOrg(e.target.value)}
								onBlur={handleFieldBlur}
								className="border-border bg-background text-foreground"
								autoFocus
							/>
						</div>

						<div>
							<label className="mb-2 block text-foreground">Target Roles</label>
							<div className="mb-3 flex gap-2">
								<Input
									placeholder="e.g., Product Manager, Marketing Director"
									value={newRole}
									onChange={(e) => setNewRole(e.target.value)}
									onKeyPress={(e) => e.key === "Enter" && addRole()}
									className="border-border bg-background text-foreground"
								/>
								<Button onClick={addRole} variant="outline">
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<div className="flex flex-wrap gap-2">
								{targetRoles.map((role) => (
									<Badge key={role} variant="secondary" className="flex items-center gap-1">
										{role}
										<X className="h-3 w-3 cursor-pointer" onClick={() => removeRole(role)} />
									</Badge>
								))}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Research Goal */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5" />
							Research Goal
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						<div>
							<label className="mb-2 block text-foreground">Goal Title</label>
							<Input
								placeholder="e.g., Understanding price sensitivity for our new pricing tier"
								value={goalTitle}
								onChange={(e) => setGoalTitle(e.target.value)}
								onBlur={handleFieldBlur}
								className="border-border bg-background text-foreground"
							/>
						</div>

						<div>
							<label className="mb-2 block text-foreground">Goal Details</label>
							<Textarea
								placeholder="Describe what you want to learn and why it matters for your product/business decisions..."
								value={goalDetail}
								onChange={(e) => setGoalDetail(e.target.value)}
								onBlur={handleFieldBlur}
								rows={4}
								className="border-border bg-background text-foreground"
							/>
						</div>

						<div>
							<label className="mb-2 block text-foreground">Current Assumptions</label>
							<div className="mb-3 flex gap-2">
								<Input
									placeholder="What do you currently believe to be true?"
									value={newAssumption}
									onChange={(e) => setNewAssumption(e.target.value)}
									onKeyPress={(e) => e.key === "Enter" && addAssumption()}
									className="border-border bg-background text-foreground"
								/>
								<Button onClick={addAssumption} variant="outline">
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<div className="space-y-2">
								{assumptions.map((assumption, index) => (
									<div key={`assumption-${index}-${assumption.slice(0, 10)}`} className="flex items-center gap-2 rounded bg-blue-50 p-2 dark:bg-blue-950">
										<span className="flex-1 text-foreground">{assumption}</span>
										<X
											className="h-4 w-4 cursor-pointer text-muted-foreground"
											onClick={() => removeAssumption(index)}
										/>
									</div>
								))}
							</div>
						</div>

						<div>
							<label className="mb-2 block text-foreground">Key Unknowns</label>
							<div className="mb-3 flex gap-2">
								<Input
									placeholder="What are you unsure about?"
									value={newUnknown}
									onChange={(e) => setNewUnknown(e.target.value)}
									onKeyPress={(e) => e.key === "Enter" && addUnknown()}
									className="border-border bg-background text-foreground"
								/>
								<Button onClick={addUnknown} variant="outline">
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<div className="space-y-2">
								{unknowns.map((unknown, index) => (
									<div key={`unknown-${index}-${unknown.slice(0, 10)}`} className="flex items-center gap-2 rounded bg-amber-50 p-2 dark:bg-amber-950">
										<HelpCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
										<span className="flex-1 text-foreground">{unknown}</span>
										<X className="h-4 w-4 cursor-pointer text-muted-foreground" onClick={() => removeUnknown(index)} />
									</div>
								))}
							</div>
						</div>
					</CardContent>
				</Card>

				<div className="flex justify-between">
					<Button variant="outline" onClick={saveProjectData} disabled={isLoading}>
						{isLoading ? "Saving..." : "Save as Draft"}
					</Button>
					<Button onClick={handleNext} disabled={!isValid || isLoading}>
						Generate Interview Questions
						<ChevronRight className="ml-2 h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	)
}
