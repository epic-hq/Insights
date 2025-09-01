import consola from "consola"
import { motion } from "framer-motion"
import { BookOpen, Save, Settings2, Target, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { type MetaFunction, redirect, useActionData, useLoaderData, useSearchParams } from "react-router-dom"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Textarea } from "~/components/ui/textarea"
import ProjectGoalsScreen from "~/features/onboarding/components/ProjectGoalsScreen"
import QuestionsScreen from "~/features/onboarding/components/QuestionsScreen"
import { getProjectSectionKinds, getProjectSections } from "~/features/projects/db"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/types"
import { createProjectRoutes } from "~/utils/routes.server"

// Types from Supabase
export type Project = Database["public"]["Tables"]["projects"]["Row"]
type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]
type SectionRow = Database["public"]["Tables"]["project_sections"]["Row"]
type SectionUpdate = Database["public"]["Tables"]["project_sections"]["Update"]
type SectionInsert = Database["public"]["Tables"]["project_sections"]["Insert"]

// Simple server-side slugify fallback if slug is blank
function slugify(input: string) {
	return input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
}

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Edit Project ${params.projectId || ""} | Insights` },
		{ name: "description", content: "Edit project & sections" },
	]
}

export async function loader({
	request,
	params,
}: {
	request: Request
	params: { accountId: string; projectId: string }
}) {
	const { client: supabase } = getServerClient(request)

	const accountId = params.accountId
	const projectId = params.projectId
	const _routes = createProjectRoutes(accountId, projectId)

	if (!accountId) throw new Response("Unauthorized", { status: 401 })

	const { data: project, error } = await supabase.from("projects").select("*").eq("id", projectId).single()

	if (error) {
		consola.error("Error fetching project:", error)
		if ((error as any).code === "PGRST116") throw new Response("Project not found", { status: 404 })
		throw new Response(`Error fetching project: ${error.message}`, { status: 500 })
	}
	if (!project) throw new Response("Project not found", { status: 404 })

	// Fetch sections using db function
	const { data: sections, error: sErr } = await getProjectSections({ supabase, projectId })
	if (sErr) throw new Response(`Error fetching sections: ${sErr.message}`, { status: 500 })

	// Fetch available kinds using db function
	const { data: kindsRows, error: kErr } = await getProjectSectionKinds({ supabase })
	if (kErr) throw new Response(`Error fetching section kinds: ${kErr.message}`, { status: 500 })

	const kinds = (kindsRows ?? []).map((k) => k.id)

	// Extract structured data from project_sections for rich components
	const extractProjectData = (sections: any[]) => {
		let target_orgs: string[] = []
		let target_roles: string[] = []
		let research_goal = ""
		let research_goal_details = ""
		let assumptions: string[] = []
		let unknowns: string[] = []
		let custom_instructions = ""
		let questions: string[] = []

		sections.forEach(section => {
			const meta = section.meta || {}
			if (section.kind === "target_market") {
				target_orgs = meta.target_orgs || meta.icp ? [meta.icp] : []
				target_roles = meta.target_roles || meta.role ? [meta.role] : []
			} else if (section.kind === "goal") {
				research_goal = meta.goalType || meta.research_goal || section.content_md || ""
				research_goal_details = meta.customGoal || meta.research_goal_details || ""
			} else if (section.kind === "assumptions") {
				assumptions = meta.assumptions || []
			} else if (section.kind === "unknowns") {
				unknowns = meta.unknowns || []
			} else if (section.kind === "custom_instructions") {
				custom_instructions = section.content_md || ""
			} else if (section.kind === "questions") {
				questions = meta.questions || []
			}
		})

		return { target_orgs, target_roles, research_goal, research_goal_details, assumptions, unknowns, custom_instructions, questions }
	}

	const projectData = extractProjectData(sections ?? [])

	return { project, sections: sections ?? [], kinds, projectData }
}

export async function action({
	request,
	params,
}: {
	request: Request
	params: { accountId: string; projectId: string }
}) {
	const formData = await request.formData()
	const intent = (formData.get("intent") as string) || ""

	const { client: supabase } = getServerClient(request)
	const accountId = params.accountId
	const projectId = params.projectId
	const routes = createProjectRoutes(accountId, projectId)

	if (!accountId) throw new Response("Unauthorized", { status: 401 })

	// Delete entire project
	if (intent === "delete_project") {
		const { error } = await supabase.from("projects").delete().eq("id", projectId)
		if (error) return { error: `Failed to delete project: ${error.message}` }
		return redirect(`${routes.projects.index}`)
	}

	// Update core project fields
	if (intent === "update_project") {
		const name = (formData.get("name") as string)?.trim()
		if (!name) return { error: "Name is required" }
		const description = ((formData.get("description") as string) || "").trim() || null
		const status = ((formData.get("status") as string) || "").trim() || null
		const providedSlug = ((formData.get("slug") as string) || "").trim()
		const slug = providedSlug || slugify(name)

		const projectData: ProjectUpdate = { name, description, status, slug, updated_at: new Date().toISOString() }
		const { data: proj, error } = await supabase
			.from("projects")
			.update(projectData)
			.eq("id", projectId)
			.select()
			.single()
		if (error) return { error: `Failed to update project: ${error.message}` }
		return redirect(`${routes.projects.detail(proj.id)}`)
	}

	// Add a new section
	if (intent === "add_section") {
		const kind = ((formData.get("new_kind") as string) || "").trim()
		const content_md = ((formData.get("new_content_md") as string) || "").trim()
		const posStr = ((formData.get("new_position") as string) || "").trim()
		const position = posStr ? Number(posStr) : null
		if (!kind || !content_md) return { error: "Kind and content are required" }

		const insert: SectionInsert = { project_id: projectId, kind, content_md, position }
		const { error } = await supabase.from("project_sections").insert(insert)
		if (error) return { error: `Failed to add section: ${error.message}` }
		return redirect(`${routes.dashboard()}`)
	}

	// Update multiple sections
	if (intent === "save_sections") {
		const ids = formData.getAll("section_id[]") as string[]
		const kinds = formData.getAll("section_kind[]") as string[]
		const contents = formData.getAll("section_content_md[]") as string[]
		const positions = formData.getAll("section_position[]") as string[]

		for (let i = 0; i < ids.length; i++) {
			const id = (ids[i] || "").trim()
			if (!id) continue
			const patch: SectionUpdate = {
				kind: (kinds[i] || "").trim() || undefined,
				content_md: (contents[i] || "").trim(),
				position: positions[i] ? Number(positions[i]) : null,
				updated_at: new Date().toISOString(),
			}
			const { error } = await supabase.from("project_sections").update(patch).eq("id", id)
			if (error) return { error: `Failed to update a section: ${error.message}` }
		}
		return redirect(`${routes.dashboard()}`)
	}

	// Delete a section
	if (intent === "delete_section") {
		const sectionId = (formData.get("section_id") as string) || ""
		if (!sectionId) return { error: "Missing section_id" }
		const { error } = await supabase.from("project_sections").delete().eq("id", sectionId)
		if (error) return { error: `Failed to delete section: ${error.message}` }
		return redirect(`${routes.dashboard()}`)
	}

	return { error: "Unknown action" }
}

export default function EditProject() {
	const { project, projectData } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const [searchParams, setSearchParams] = useSearchParams()
	const [activeTab, setActiveTab] = useState("goals")

	// Initialize tab from URL search params
	useEffect(() => {
		const tabParam = searchParams.get("tab")
		if (tabParam && ["goals", "questions", "settings"].includes(tabParam)) {
			setActiveTab(tabParam)
		}
	}, [searchParams])

	// Update URL when tab changes
	const handleTabChange = (newTab: string) => {
		setActiveTab(newTab)
		const newSearchParams = new URLSearchParams(searchParams)
		newSearchParams.set("tab", newTab)
		setSearchParams(newSearchParams, { replace: true })
	}

	// Handle project goals update (just auto-save, no navigation)
	const handleGoalsUpdate = () => {
		// Goals are auto-saved by ProjectGoalsScreen, no action needed
		consola.log("Project goals updated via auto-save")
	}

	// Handle questions update (just auto-save, no navigation) 
	const handleQuestionsUpdate = () => {
		// Questions are auto-saved by QuestionsScreen, no action needed
		consola.log("Project questions updated via auto-save")
	}

	return (
		<div className="mx-auto max-w-6xl px-4 py-6">
			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-3 text-2xl">
							<Settings2 className="h-6 w-6 text-blue-600" />
							Edit Project: {project.name}
						</CardTitle>
						<div className="text-muted-foreground text-xs">
							<span>Created: {new Date(project.created_at).toLocaleString()}</span>
							<span className="mx-2">•</span>
							<span>Updated: {new Date(project.updated_at).toLocaleString()}</span>
						</div>
					</CardHeader>
					<CardContent className="space-y-6">
						{actionData?.error && (
							<div className="rounded-md bg-red-50 p-4 text-red-700 text-sm">{actionData.error}</div>
						)}

						<Tabs value={activeTab} onValueChange={handleTabChange}>
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger value="goals" className="flex items-center gap-2">
									<Target className="h-4 w-4" />
									Goals & Target Market
								</TabsTrigger>
								<TabsTrigger value="questions" className="flex items-center gap-2">
									<BookOpen className="h-4 w-4" />
									Interview Questions
								</TabsTrigger>
								<TabsTrigger value="settings" className="flex items-center gap-2">
									<Settings2 className="h-4 w-4" />
									Project Settings
								</TabsTrigger>
							</TabsList>

							<TabsContent value="goals" className="mt-6">
								<ProjectGoalsScreen
									onNext={handleGoalsUpdate}
									projectId={project.id}
									showStepper={false}
									showNextButton={false}
								/>
							</TabsContent>

							<TabsContent value="questions" className="mt-6">
								<QuestionsScreen
									target_orgs={projectData.target_orgs}
									target_roles={projectData.target_roles}
									research_goal={projectData.research_goal}
									research_goal_details={projectData.research_goal_details}
									assumptions={projectData.assumptions}
									unknowns={projectData.unknowns}
									custom_instructions={projectData.custom_instructions}
									onNext={handleQuestionsUpdate}
									onBack={() => setActiveTab("goals")}
									showStepper={false}
									projectId={project.id}
								/>
							</TabsContent>

							<TabsContent value="settings" className="mt-6">
								<div className="space-y-6">
									{/* Core project settings */}
									<Card>
										<CardHeader>
											<CardTitle className="text-lg">Project Settings</CardTitle>
										</CardHeader>
										<CardContent>
											<form method="post" className="space-y-4">
												<input type="hidden" name="intent" value="update_project" />
												<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
													<div className="space-y-2 md:col-span-2">
														<Label htmlFor="name">Name *</Label>
														<Input id="name" name="name" type="text" required defaultValue={project.name || ""} />
													</div>
													<div className="space-y-2 md:col-span-2">
														<Label htmlFor="description">Description</Label>
														<Textarea id="description" name="description" rows={3} defaultValue={project.description || ""} />
													</div>
													<div className="space-y-2">
														<Label htmlFor="status">Status</Label>
														<Input
															id="status"
															name="status"
															type="text"
															defaultValue={project.status || ""}
															placeholder="active | paused | archived"
														/>
													</div>
													<div className="space-y-2">
														<Label htmlFor="slug">Slug</Label>
														<Input
															id="slug"
															name="slug"
															type="text"
															defaultValue={project.slug || ""}
															placeholder="auto-generated if blank"
														/>
													</div>
												</div>
												<Button type="submit" className="gap-2">
													<Save className="h-4 w-4" />
													Save Project Settings
												</Button>
											</form>
										</CardContent>
									</Card>

									{/* Danger zone */}
									<Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
										<CardHeader>
											<CardTitle className="text-red-900 dark:text-red-300">Danger Zone</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="mb-4 text-red-700 text-sm dark:text-red-400">
												Deleting this project will permanently remove it and all associated data. This action cannot be undone.
											</p>
											<form id="delete-project" method="post">
												<input type="hidden" name="intent" value="delete_project" />
											</form>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button variant="destructive" size="sm" className="gap-2">
														<Trash2 className="h-4 w-4" /> Delete Project
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete this project?</AlertDialogTitle>
														<AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															onClick={() => (document.getElementById("delete-project") as HTMLFormElement)?.requestSubmit()}
														>
															Yes, delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</CardContent>
									</Card>
								</div>
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	)
}
