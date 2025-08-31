import consola from "consola"
import { motion } from "framer-motion"
import { Edit3, Plus, Save, Trash2, X } from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { type MetaFunction, redirect, useActionData, useLoaderData } from "react-router-dom"
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
import { Textarea } from "~/components/ui/textarea"
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

	return { project, sections: sections ?? [], kinds }
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

function KindSelector({ name, value, kinds }: { name: string; value?: string; kinds: string[] }) {
	const initial = value && kinds.includes(value) ? value : (kinds[0] ?? "goal")
	const [selected, setSelected] = useState<string>(initial)
	const [isCustom, setIsCustom] = useState<boolean>(!!value && !kinds.includes(value!))
	const [custom, setCustom] = useState<string>(isCustom ? (value as string) : "")

	useEffect(() => {
		if (isCustom) {
			setSelected(custom)
		}
	}, [isCustom, custom])

	return (
		<div className="flex flex-wrap items-center gap-2">
			{kinds.map((k) => (
				<Button
					key={k}
					type="button"
					size="sm"
					variant={!isCustom && selected === k ? "default" : "outline"}
					className={!isCustom && selected === k ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
					onClick={() => {
						setIsCustom(false)
						setSelected(k)
					}}
				>
					{k}
				</Button>
			))}
			<Button
				type="button"
				size="sm"
				variant={isCustom ? "default" : "outline"}
				className={isCustom ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
				onClick={() => setIsCustom((v) => !v)}
			>
				Other…
			</Button>
			{isCustom && (
				<Input
					value={custom}
					onChange={(e) => setCustom(e.target.value)}
					placeholder="custom kind"
					className="h-8 w-40"
				/>
			)}
			<input type="hidden" name={name} value={selected} />
		</div>
	)
}

export default function EditProject() {
	const { project, sections, kinds } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	// UI state management
	const [err, setErr] = useState<string | null>(null)
	const [editingSections, setEditingSections] = useState<Set<string>>(new Set())
	const [showAddForm, setShowAddForm] = useState(false)
	const validateNew = useCallback((e: React.FormEvent<HTMLFormElement>) => {
		const fd = new FormData(e.currentTarget)
		const kind = (fd.get("new_kind") as string)?.trim()
		const content = (fd.get("new_content_md") as string)?.trim()
		if (!kind || !content) {
			e.preventDefault()
			setErr("Kind and content are required")
		}
	}, [])

	const toggleEditing = (sectionId: string) => {
		setEditingSections((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(sectionId)) {
				newSet.delete(sectionId)
			} else {
				newSet.add(sectionId)
			}
			return newSet
		})
	}

	const getKindColor = (kind: string) => {
		const colors: Record<string, string> = {
			goal: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
			target_market: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
			assumptions: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300",
			risks: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
			question: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
		}
		return colors[kind] || "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300"
	}

	const _fmt = (v: unknown) => (v == null ? "" : String(v))

	return (
		<div className="mx-auto max-w-4xl px-4 py-6">
			{/* wider */}
			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
				<Card>
					<CardHeader>
						<CardTitle className="text-2xl">Edit Project</CardTitle>
						<div className="text-muted-foreground text-xs">
							<span>Created: {new Date(project.created_at).toLocaleString()}</span>
							<span className="mx-2">•</span>
							<span>Updated: {new Date(project.updated_at).toLocaleString()}</span>
						</div>
					</CardHeader>
					<CardContent className="space-y-8">
						{actionData?.error && (
							<div className="rounded-md bg-red-50 p-4 text-red-700 text-sm">{actionData.error}</div>
						)}

						{/* Core project fields */}
						<form method="post" className="space-y-4">
							<input type="hidden" name="intent" value="update_project" />
							<div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
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
							<div className="flex gap-3">
								<Button type="submit" className="flex-1">
									Save Project
								</Button>
							</div>
						</form>

						{/* Project Sections - Clean Card-Based Design */}
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<h2 className="font-semibold text-foreground text-lg">Project Sections</h2>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setShowAddForm(true)}
									className="gap-2"
								>
									<Plus className="h-4 w-4" />
									Add Section
								</Button>
							</div>

							{/* Existing Sections */}
							<form method="post" className="space-y-4">
								<input type="hidden" name="intent" value="save_sections" />
								<div className="grid gap-4">
									{sections.map((s) => {
										const isEditing = editingSections.has(s.id)
										return (
											<motion.div
												key={s.id}
												initial={{ opacity: 0, y: 20 }}
												animate={{ opacity: 1, y: 0 }}
												className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
											>
												<input type="hidden" name="section_id[]" value={s.id} />

												{/* Header with content and controls */}
												<div className="flex items-start justify-between gap-4">
													<div className="min-w-0 flex-1">
														{/* Content - prominent at top */}
														{isEditing ? (
															<Textarea
																name="section_content_md[]"
																className="mb-4 resize-none font-mono"
																rows={4}
																defaultValue={s.content_md || ""}
																placeholder="Enter section content..."
															/>
														) : (
															<div className="mb-4">
																<p className="font-medium text-gray-900 text-lg leading-relaxed dark:text-white">
																	{s.content_md || "No content"}
																</p>
															</div>
														)}

														{/* Kind and Position - only show when editing */}
														{isEditing && (
															<div className="mb-4 flex gap-3">
																<div className="flex-1">
																	<Label className="mb-1 text-gray-500 text-xs">Kind</Label>
																	<KindSelector name="section_kind[]" value={s.kind} kinds={kinds} />
																</div>
																<div className="w-24">
																	<Label className="mb-1 text-gray-500 text-xs">Position</Label>
																	<Input
																		name="section_position[]"
																		type="number"
																		defaultValue={s.position ?? ""}
																		placeholder="#"
																		size="sm"
																	/>
																</div>
															</div>
														)}
													</div>

													{/* Controls */}
													<div className="flex flex-shrink-0 items-center gap-2">
														{!isEditing && (
															<div className={`rounded-full px-3 py-1 font-medium text-xs ${getKindColor(s.kind)}`}>
																{s.kind}
															</div>
														)}

														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => toggleEditing(s.id)}
															className="h-8 w-8 p-0"
														>
															{isEditing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
														</Button>

														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>Delete section?</AlertDialogTitle>
																	<AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel>Cancel</AlertDialogCancel>
																	<AlertDialogAction
																		onClick={() => {
																			const f = document.getElementById(`delete-section-${s.id}`) as HTMLFormElement
																			f?.requestSubmit()
																		}}
																	>
																		Delete
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													</div>
												</div>
											</motion.div>
										)
									})}
								</div>

								{/* Save Button - only show if editing */}
								{editingSections.size > 0 && (
									<div className="flex justify-end border-t pt-4">
										<Button type="submit" className="gap-2">
											<Save className="h-4 w-4" />
											Save Changes
										</Button>
									</div>
								)}
							</form>

							{/* Hidden delete forms */}
							{sections.map((s) => (
								<form key={`delete-${s.id}`} id={`delete-section-${s.id}`} method="post" style={{ display: "none" }}>
									<input type="hidden" name="intent" value="delete_section" />
									<input type="hidden" name="section_id" value={s.id} />
								</form>
							))}

							{/* Add New Section Form */}
							{showAddForm && (
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									className="rounded-2xl border border-gray-300 border-dashed p-6 dark:border-gray-600"
								>
									<form method="post" onSubmit={validateNew} className="space-y-4">
										<input type="hidden" name="intent" value="add_section" />

										<div className="mb-4 flex items-center justify-between">
											<h3 className="font-medium text-lg">Add New Section</h3>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => setShowAddForm(false)}
												className="h-8 w-8 p-0"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>

										{err && (
											<div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 text-sm dark:bg-red-950/20">{err}</div>
										)}

										<div className="space-y-4">
											<div>
												<Label htmlFor="new_content_md" className="mb-2 block">
													Content *
												</Label>
												<Textarea
													id="new_content_md"
													name="new_content_md"
													rows={4}
													className="font-mono"
													placeholder="Enter the section content..."
													required
												/>
											</div>

											<div className="grid grid-cols-2 gap-4">
												<div>
													<Label htmlFor="new_kind" className="mb-2 block">
														Kind *
													</Label>
													<KindSelector name="new_kind" kinds={kinds} />
												</div>
												<div>
													<Label htmlFor="new_position" className="mb-2 block">
														Position
													</Label>
													<Input id="new_position" name="new_position" type="number" placeholder="Optional" />
												</div>
											</div>
										</div>

										<div className="flex gap-3 pt-4">
											<Button type="submit" className="gap-2">
												<Plus className="h-4 w-4" />
												Add Section
											</Button>
											<Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
												Cancel
											</Button>
										</div>
									</form>
								</motion.div>
							)}
						</div>

						{/* Danger zone: delete project */}
						<div className="border-t pt-6">
							<div className="rounded-lg border border-red-200 bg-red-50 p-4">
								<h3 className="mb-2 font-medium text-red-900">Danger Zone</h3>
								<p className="mb-4 text-red-700 text-sm">
									Deleting this project will permanently remove it and its sections. This action cannot be undone.
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
							</div>
						</div>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	)
}
