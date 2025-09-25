import consola from "consola"
import { ArrowRight, Check, ChevronRight, Edit3, HelpCircle, Plus, Sparkles, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

// Types for the research structure
interface DecisionQuestion {
	id: string
	text: string
	rationale?: string
}

interface ResearchQuestion {
	id: string
	text: string
	rationale?: string
	decision_question_id: string
}

interface ResearchStructure {
	decision_questions: DecisionQuestion[]
	research_questions: ResearchQuestion[]
}

interface ResearchStructureManagerProps {
	projectId: string
	projectPath: string
	research_goal?: string
	target_roles?: string
	target_orgs?: string
	assumptions?: string
	unknowns?: string
	onStructureValidated?: (structure: ResearchStructure) => void
}

export function ResearchStructureManager({
	projectId,
	projectPath,
	research_goal,
	target_roles,
	target_orgs,
	assumptions,
	unknowns,
	onStructureValidated,
}: ResearchStructureManagerProps) {
	const pc = useCurrentProject()
	// TODO fix bug
	consola.log("[ResearchStructureManager] projectPath2: ", JSON.stringify(pc), projectPath)
	const routes = useProjectRoutes(pc.projectPath)
	const [structure, setStructure] = useState<ResearchStructure>({
		decision_questions: [],
		research_questions: [],
	})
	const [loading, setLoading] = useState(false)
	const [generating, setGenerating] = useState(false)
	const [editingDQ, setEditingDQ] = useState<string | null>(null)
	const [editingRQ, setEditingRQ] = useState<string | null>(null)
	const [editText, setEditText] = useState("")
	const [editRationale, setEditRationale] = useState("")

	// Generate initial structure
	const generateStructure = useCallback(async () => {
		if (!research_goal?.trim()) {
			toast.error("Research goal is required to generate structure")
			return
		}

		setGenerating(true)
		try {
			const formData = new FormData()
			formData.append("project_id", projectId)
			formData.append("research_goal", research_goal)
			if (target_roles) formData.append("target_roles", target_roles)
			if (target_orgs) formData.append("target_orgs", target_orgs)
			if (assumptions) formData.append("assumptions", assumptions)
			if (unknowns) formData.append("unknowns", unknowns)

			const response = await fetch("/api/generate-research-structure", {
				method: "POST",
				body: formData,
			})

			const result = await response.json()

			if (!response.ok) {
				throw new Error(result.details || result.error || "Failed to generate structure")
			}

			setStructure({
				decision_questions: result.structure.decision_questions,
				research_questions: result.structure.research_questions,
			})

			toast.success(result.message)
		} catch (error) {
			console.error("Structure generation failed:", error)
			toast.error(error instanceof Error ? error.message : "Failed to generate research structure")
		} finally {
			setGenerating(false)
		}
	}, [projectId, research_goal, target_roles, target_orgs, assumptions, unknowns])

	// Load existing structure from database
	const loadExistingStructure = useCallback(async () => {
		setLoading(true)
		try {
			const response = await fetch(`/api/check-research-structure?project_id=${projectId}`)
			const result = await response.json()

			if (!response.ok) {
				throw new Error(result.error || "Failed to load structure")
			}

			if (result.summary.has_decision_questions && result.summary.has_research_questions) {
				setStructure({
					decision_questions: result.decision_questions,
					research_questions: result.research_questions,
				})
				toast.success("Loaded existing research structure")
			} else {
				toast.info("No existing research structure found")
			}
		} catch (error) {
			console.error("Load structure failed:", error)
			toast.error("Failed to load existing structure")
		} finally {
			setLoading(false)
		}
	}, [projectId])

	// Migrate from project sections
	const migrateFromProjectData = useCallback(async () => {
		if (!research_goal?.trim()) {
			toast.error("Research goal is required for migration")
			return
		}

		setGenerating(true)
		try {
			const formData = new FormData()
			formData.append("project_id", projectId)
			formData.append("force", "true")

			const response = await fetch("/api/migrate-research-structure", {
				method: "POST",
				body: formData,
			})

			const result = await response.json()

			if (!response.ok) {
				throw new Error(result.details || result.error || "Migration failed")
			}

			// Reload the structure after migration
			await loadExistingStructure()
			toast.success(result.message)
		} catch (error) {
			console.error("Migration failed:", error)
			toast.error(error instanceof Error ? error.message : "Migration failed")
		} finally {
			setGenerating(false)
		}
	}, [projectId, research_goal, loadExistingStructure])

	// Edit decision question
	const startEditingDQ = (dq: DecisionQuestion) => {
		setEditingDQ(dq.id)
		setEditText(dq.text)
		setEditRationale(dq.rationale || "")
	}

	const saveEditDQ = async () => {
		if (!editingDQ) return

		try {
			// Update local state
			setStructure((prev) => ({
				...prev,
				decision_questions: prev.decision_questions.map((dq) =>
					dq.id === editingDQ ? { ...dq, text: editText, rationale: editRationale } : dq
				),
			}))

			// Save to database
			const response = await fetch(`/api/questions/${editingDQ}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: editText,
					rationale: editRationale,
					table: "decision_questions",
				}),
			})

			if (!response.ok) {
				throw new Error("Failed to save changes")
			}

			toast.success("Decision question updated")
		} catch (error) {
			toast.error("Failed to save changes")
			console.error("Save error:", error)
		}

		setEditingDQ(null)
		setEditText("")
		setEditRationale("")
	}

	// Edit research question
	const startEditingRQ = (rq: ResearchQuestion) => {
		setEditingRQ(rq.id)
		setEditText(rq.text)
		setEditRationale(rq.rationale || "")
	}

	const saveEditRQ = async () => {
		if (!editingRQ) return

		try {
			// Update local state
			setStructure((prev) => ({
				...prev,
				research_questions: prev.research_questions.map((rq) =>
					rq.id === editingRQ ? { ...rq, text: editText, rationale: editRationale } : rq
				),
			}))

			// Save to database
			const response = await fetch(`/api/questions/${editingRQ}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: editText,
					rationale: editRationale,
					table: "research_questions",
				}),
			})

			if (!response.ok) {
				throw new Error("Failed to save changes")
			}

			toast.success("Research question updated")
		} catch (error) {
			toast.error("Failed to save changes")
			console.error("Save error:", error)
		}

		setEditingRQ(null)
		setEditText("")
		setEditRationale("")
	}

	// Delete items
	const deleteDQ = (id: string) => {
		setStructure((prev) => ({
			decision_questions: prev.decision_questions.filter((dq) => dq.id !== id),
			research_questions: prev.research_questions.filter((rq) => rq.decision_question_id !== id),
		}))
	}

	const deleteRQ = (id: string) => {
		setStructure((prev) => ({
			...prev,
			research_questions: prev.research_questions.filter((rq) => rq.id !== id),
		}))
	}

	// Validate and proceed
	const validateStructure = () => {
		if (structure.decision_questions.length === 0) {
			toast.error("At least one decision question is required")
			return
		}

		if (structure.research_questions.length === 0) {
			toast.error("At least one research question is required")
			return
		}

		onStructureValidated?.(structure)
		toast.success("Research structure validated! Ready to generate interview questions.")
	}

	// Load existing structure on mount
	useEffect(() => {
		loadExistingStructure()
	}, [loadExistingStructure])

	const hasStructure = structure.decision_questions.length > 0

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
			{/* Header */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<h1 className="font-bold text-2xl">Research Structure</h1>
					<Button variant="outline" size="sm" className="gap-2">
						<HelpCircle className="h-4 w-4" />
						Help
					</Button>
				</div>
				<p className="text-muted-foreground text-sm">
					Define the key decisions and research questions before generating interview prompts.{" "}
					<Link to={routes.projects.setup()} className="text-blue-600 hover:underline">
						Update project goals
					</Link>{" "}
					if needed.
				</p>
			</div>

			{/* Context Summary */}
			{research_goal && (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Research Context</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<Label className="font-medium text-sm">Research Goal</Label>
							<p className="text-muted-foreground text-sm">{research_goal}</p>
						</div>
						{target_roles && (
							<div>
								<Label className="font-medium text-sm">Target Roles</Label>
								<p className="text-muted-foreground text-sm">{target_roles}</p>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Generation Controls */}
			<div className="flex gap-3">
				<Button onClick={generateStructure} disabled={generating || !research_goal} className="gap-2">
					<Sparkles className="h-4 w-4" />
					{generating ? "Generating..." : "Generate Structure"}
				</Button>

				<Button variant="outline" onClick={loadExistingStructure} disabled={loading} className="gap-2">
					Load Existing
				</Button>

				<Button
					variant="outline"
					onClick={migrateFromProjectData}
					disabled={generating || !research_goal}
					className="gap-2"
				>
					Migrate from Project Data
				</Button>
			</div>

			{/* Structure Display */}
			{hasStructure && (
				<div className="space-y-6">
					{/* Decision Questions */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<span>Decision Questions</span>
								<Badge variant="secondary">{structure.decision_questions.length}</Badge>
							</CardTitle>
							<p className="text-muted-foreground text-sm">
								Key business decisions that need to be made based on research findings.
							</p>
						</CardHeader>
						<CardContent className="space-y-4">
							{structure.decision_questions.map((dq, index) => (
								<div key={dq.id} className="rounded-lg border p-4">
									<div className="flex items-start justify-between gap-3">
										<div className="flex-1 space-y-2">
											<div className="flex items-center gap-2">
												<Badge variant="outline" className="text-xs">
													DQ{index + 1}
												</Badge>
											</div>

											{editingDQ === dq.id ? (
												<div className="space-y-3">
													<div>
														<Label>Decision Question</Label>
														<Textarea
															value={editText}
															onChange={(e) => setEditText(e.target.value)}
															placeholder="What key decision needs to be made?"
															className="mt-1"
														/>
													</div>
													<div>
														<Label>Rationale</Label>
														<Textarea
															value={editRationale}
															onChange={(e) => setEditRationale(e.target.value)}
															placeholder="Why is this decision important?"
															className="mt-1"
														/>
													</div>
													<div className="flex gap-2">
														<Button size="sm" onClick={saveEditDQ}>
															<Check className="h-4 w-4" />
														</Button>
														<Button size="sm" variant="outline" onClick={() => setEditingDQ(null)}>
															<X className="h-4 w-4" />
														</Button>
													</div>
												</div>
											) : (
												<div className="space-y-2">
													<p className="font-medium">{dq.text}</p>
													{dq.rationale && <p className="text-muted-foreground text-sm">{dq.rationale}</p>}
												</div>
											)}
										</div>

										{editingDQ !== dq.id && (
											<div className="flex gap-1">
												<Button size="sm" variant="ghost" onClick={() => startEditingDQ(dq)}>
													<Edit3 className="h-4 w-4" />
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => deleteDQ(dq.id)}
													className="text-red-600 hover:text-red-700"
												>
													<X className="h-4 w-4" />
												</Button>
											</div>
										)}
									</div>

									{/* Related Research Questions */}
									<div className="mt-4 space-y-2">
										<div className="flex items-center gap-2">
											<ChevronRight className="h-4 w-4 text-muted-foreground" />
											<span className="font-medium text-muted-foreground text-sm">Research Questions</span>
										</div>

										{structure.research_questions
											.filter((rq) => rq.decision_question_id === dq.id)
											.map((rq, rqIndex) => (
												<div key={rq.id} className="ml-6 rounded border-blue-200 border-l-2 bg-blue-50/50 p-3">
													<div className="flex items-start justify-between gap-3">
														<div className="flex-1">
															<div className="mb-2 flex items-center gap-2">
																<Badge variant="outline" className="text-xs">
																	RQ{rqIndex + 1}
																</Badge>
															</div>

															{editingRQ === rq.id ? (
																<div className="space-y-3">
																	<div>
																		<Label>Research Question</Label>
																		<Textarea
																			value={editText}
																			onChange={(e) => setEditText(e.target.value)}
																			placeholder="What do we need to learn?"
																			className="mt-1"
																		/>
																	</div>
																	<div>
																		<Label>Rationale</Label>
																		<Textarea
																			value={editRationale}
																			onChange={(e) => setEditRationale(e.target.value)}
																			placeholder="How does this help answer the decision question?"
																			className="mt-1"
																		/>
																	</div>
																	<div className="flex gap-2">
																		<Button size="sm" onClick={saveEditRQ}>
																			<Check className="h-4 w-4" />
																		</Button>
																		<Button size="sm" variant="outline" onClick={() => setEditingRQ(null)}>
																			<X className="h-4 w-4" />
																		</Button>
																	</div>
																</div>
															) : (
																<div className="space-y-1">
																	<p className="font-medium text-sm">{rq.text}</p>
																	{rq.rationale && <p className="text-muted-foreground text-xs">{rq.rationale}</p>}
																</div>
															)}
														</div>

														{editingRQ !== rq.id && (
															<div className="flex gap-1">
																<Button size="sm" variant="ghost" onClick={() => startEditingRQ(rq)}>
																	<Edit3 className="h-3 w-3" />
																</Button>
																<Button
																	size="sm"
																	variant="ghost"
																	onClick={() => deleteRQ(rq.id)}
																	className="text-red-600 hover:text-red-700"
																>
																	<X className="h-3 w-3" />
																</Button>
															</div>
														)}
													</div>
												</div>
											))}
									</div>
								</div>
							))}
						</CardContent>
					</Card>

					{/* Validation & Next Steps */}
					<Card>
						<CardContent className="pt-6">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="font-medium">Ready to Generate Interview Questions?</h3>
									<p className="text-muted-foreground text-sm">
										Review your structure above, then generate specific interview prompts.
									</p>
								</div>
								<Button onClick={validateStructure} className="gap-2">
									Generate Questions
									<ArrowRight className="h-4 w-4" />
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Empty State */}
			{!hasStructure && !generating && (
				<Card>
					<CardContent className="py-12 text-center">
						<div className="mx-auto max-w-sm space-y-4">
							<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
								<Sparkles className="h-6 w-6 text-blue-600" />
							</div>
							<div>
								<h3 className="font-medium">No Research Structure Yet</h3>
								<p className="text-muted-foreground text-sm">
									Generate a structured approach to your research with decision questions and research questions.
								</p>
							</div>
							<Button onClick={generateStructure} disabled={!research_goal}>
								Get Started
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
