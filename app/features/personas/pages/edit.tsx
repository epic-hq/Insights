import consola from "consola"
import { motion } from "framer-motion"
import { Trash2 } from "lucide-react"
import { Form, redirect, useActionData, useLoaderData } from "react-router"
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
import { getServerClient } from "~/lib/supabase/client.server"
import type { Database } from "~/types"
import { createProjectRoutes } from "~/utils/routes.server"

type PersonaUpdate = Database["public"]["Tables"]["personas"]["Update"]

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Edit Persona ${params.personaId || ""} | Insights` },
		{ name: "description", content: "Edit persona details" },
	]
}

export async function loader({
	request,
	params,
}: {
	request: Request
	params: { accountId: string; personaId: string; projectId: string }
}) {
	consola.log("Initializing Supabase client")
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	// const accountId = jwt?.claims.sub
	const accountId = params.accountId
	const personaId = params.personaId
	const projectId = params.projectId
	consola.log("Parameters:", { accountId, personaId, projectId })
	const _routes = createProjectRoutes(accountId, projectId)
	consola.log("persona loader: ", { params })

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { data: persona, error } = await supabase
		.from("personas")
		.select("*")
		.eq("id", personaId)
		// .eq("account_id", accountId)
		// .eq("project_id", projectId)
		.limit(1)
	consola.log("Query result:", persona)

	if (error) {
		consola.error("Error fetching persona:", error)
		if (error.code === "PGRST116") {
			throw new Response("Persona not found", { status: 404 })
		}
		throw new Response(`Error fetching persona: ${error.message}`, { status: 500 })
	}

	if (!persona) {
		consola.warn("Persona not found for ID:", personaId)
		throw new Response("Persona not found", { status: 404 })
	}

	if (persona.length === 0) {
		throw new Response("Persona not found", { status: 404 })
	}
	return { persona: persona[0] }
}

export async function action({
	request,
	params,
}: {
	request: Request
	params: { accountId: string; personaId: string; projectId: string }
}) {
	const formData = await request.formData()
	const intent = formData.get("intent")
	const _personaId = params.personaId

	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	// const accountId = jwt?.claims.sub

	const accountId = params.accountId
	const personaId = params.personaId
	const projectId = params.projectId
	consola.log("persona edit: ", { accountId, personaId, projectId })
	const routes = createProjectRoutes(accountId, projectId)

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	if (intent === "delete") {
		const { error } = await supabase.from("personas").delete().eq("id", personaId)
		// .eq("account_id", accountId)
		// .eq("project_id", projectId)

		if (error) {
			return { error: `Failed to delete persona: ${error.message}` }
		}

		return redirect(routes.personas.index())
	}

	// Update persona
	const name = (formData.get("name") as string)?.trim()
	if (!name) return { error: "Name is required" }

	const description = (formData.get("description") as string) || null
	const color_hex = (formData.get("color_hex") as string) || "#6b7280"
	const image_url = (formData.get("image_url") as string) || null

	// New fields
	const age = (formData.get("age") as string) || null
	const gender = (formData.get("gender") as string) || null
	const location = (formData.get("location") as string) || null
	const education = (formData.get("education") as string) || null
	const occupation = (formData.get("occupation") as string) || null
	const income = (formData.get("income") as string) || null
	const languages = (formData.get("languages") as string) || null
	const segment = (formData.get("segment") as string) || null
	const role = (formData.get("role") as string) || null
	const learning_style = (formData.get("learning_style") as string) || null
	const tech_comfort_level = (formData.get("tech_comfort_level") as string) || null
	const frequency_of_purchase = (formData.get("frequency_of_purchase") as string) || null
	const frequency_of_use = (formData.get("frequency_of_use") as string) || null
	const percentageRaw = formData.get("percentage")
	const percentage = percentageRaw !== null && percentageRaw !== "" ? Number.parseFloat(percentageRaw as string) : null

	// Array fields: comma-separated or newline for quotes
	function parseArray(val: FormDataEntryValue | null | undefined) {
		if (!val) return null
		const str = String(val)
		const arr = str
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
		return arr.length > 0 ? arr : null
	}
	function parseArrayNewline(val: FormDataEntryValue | null | undefined) {
		if (!val) return null
		const str = String(val)
		const arr = str
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean)
		return arr.length > 0 ? arr : null
	}

	const motivations = parseArray(formData.get("motivations"))
	const values = parseArray(formData.get("values"))
	const frustrations = parseArray(formData.get("frustrations"))
	const key_tasks = parseArray(formData.get("key_tasks"))
	const tools_used = parseArray(formData.get("tools_used"))
	const secondary_goals = parseArray(formData.get("secondary_goals"))
	const sources = parseArray(formData.get("sources"))
	const quotes = parseArrayNewline(formData.get("quotes"))
	const primary_goal = (formData.get("primary_goal") as string) || null
	const preferences = (formData.get("preferences") as string) || null

	const personaData: PersonaUpdate = {
		name,
		description,
		color_hex,
		image_url,
		age,
		gender,
		location,
		education,
		occupation,
		income,
		languages,
		segment,
		role,
		learning_style,
		tech_comfort_level,
		frequency_of_purchase,
		frequency_of_use,
		percentage,
		motivations,
		values,
		frustrations,
		key_tasks,
		tools_used,
		primary_goal,
		secondary_goals,
		sources,
		quotes,
		preferences,
		updated_at: new Date().toISOString(),
	}

	const { data: persona, error } = await supabase
		.from("personas")
		.update(personaData)
		.eq("id", personaId)
		// .eq("account_id", accountId)
		// .eq("project_id", projectId)
		.select()
		.single()

	if (error) {
		return { error: `Failed to update persona: ${error.message}` }
	}

	return redirect(routes.personas.detail(persona.id))
}

export default function EditPersona() {
	consola.log("persona actionData: ")
	const { persona } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	return (
		<div className="mx-auto max-w-2xl px-4 py-6">
			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
				<Card>
					<CardHeader>
						<CardTitle className="text-2xl">Edit Persona</CardTitle>
					</CardHeader>
					<CardContent>
						<form method="post" className="space-y-6">
							{actionData?.error && (
								<div className="rounded-md bg-red-50 p-4">
									<div className="text-red-700 text-sm">{actionData.error}</div>
								</div>
							)}

							<div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="name">Name *</Label>
									<Input
										id="name"
										name="name"
										type="text"
										required
										defaultValue={persona.name || ""}
										placeholder="e.g., Tech-Savvy Professional"
										className="w-full"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="description">Description</Label>
									<Textarea
										id="description"
										name="description"
										defaultValue={persona.description || ""}
										placeholder="Describe this persona's characteristics, needs, and behaviors..."
										rows={4}
										className="w-full"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="image_url">Profile Image URL</Label>
									<Input
										id="image_url"
										name="image_url"
										type="url"
										defaultValue={persona.image_url || ""}
										placeholder="https://example.com/image.jpg"
										className="w-full"
									/>
									<span className="text-muted-foreground text-xs">
										Optional: URL to an image that represents this persona
									</span>
								</div>

								<div className="space-y-2">
									<Label htmlFor="color_hex">Theme Color</Label>
									<div className="flex items-center gap-3">
										<Input
											id="color_hex"
											name="color_hex"
											type="color"
											defaultValue={persona.color_hex || "#6b7280"}
											className="h-10 w-20"
										/>
										<span className="text-muted-foreground text-sm">Choose a color to represent this persona</span>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="age">Age</Label>
									<Input id="age" name="age" type="text" defaultValue={persona.age || ""} placeholder="e.g., 25-34" />
								</div>
								<div className="space-y-2">
									<Label htmlFor="gender">Gender</Label>
									<Input
										id="gender"
										name="gender"
										type="text"
										defaultValue={persona.gender || ""}
										placeholder="e.g., Female"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="location">Location</Label>
									<Input
										id="location"
										name="location"
										type="text"
										defaultValue={persona.location || ""}
										placeholder="e.g., San Francisco"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="education">Education</Label>
									<Input
										id="education"
										name="education"
										type="text"
										defaultValue={persona.education || ""}
										placeholder="e.g., Bachelor's"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="occupation">Occupation</Label>
									<Input
										id="occupation"
										name="occupation"
										type="text"
										defaultValue={persona.occupation || ""}
										placeholder="e.g., Product Manager"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="income">Income</Label>
									<Input
										id="income"
										name="income"
										type="text"
										defaultValue={persona.income || ""}
										placeholder="e.g., $80,000"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="languages">Languages</Label>
									<Input
										id="languages"
										name="languages"
										type="text"
										defaultValue={persona.languages || ""}
										placeholder="e.g., English, Spanish"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="segment">Segment</Label>
									<Input
										id="segment"
										name="segment"
										type="text"
										defaultValue={persona.segment || ""}
										placeholder="e.g., Early Adopters"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="role">Role</Label>
									<Input
										id="role"
										name="role"
										type="text"
										defaultValue={persona.role || ""}
										placeholder="e.g., Team Lead"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="learning_style">Learning Style</Label>
									<Input
										id="learning_style"
										name="learning_style"
										type="text"
										defaultValue={persona.learning_style || ""}
										placeholder="e.g., Visual"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="tech_comfort_level">Tech Comfort Level</Label>
									<Input
										id="tech_comfort_level"
										name="tech_comfort_level"
										type="text"
										defaultValue={persona.tech_comfort_level || ""}
										placeholder="e.g., High"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="frequency_of_purchase">Frequency of Purchase</Label>
									<Input
										id="frequency_of_purchase"
										name="frequency_of_purchase"
										type="text"
										defaultValue={persona.frequency_of_purchase || ""}
										placeholder="e.g., Monthly"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="frequency_of_use">Frequency of Use</Label>
									<Input
										id="frequency_of_use"
										name="frequency_of_use"
										type="text"
										defaultValue={persona.frequency_of_use || ""}
										placeholder="e.g., Daily"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="percentage">Percentage</Label>
									<Input
										id="percentage"
										name="percentage"
										type="number"
										step="0.1"
										min="0"
										max="100"
										defaultValue={persona.percentage ?? ""}
										placeholder="e.g., 12.5"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="motivations">Motivations</Label>
									<Input
										id="motivations"
										name="motivations"
										type="text"
										defaultValue={Array.isArray(persona.motivations) ? persona.motivations.join(", ") : ""}
										placeholder="Comma-separated"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="values">Values</Label>
									<Input
										id="values"
										name="values"
										type="text"
										defaultValue={Array.isArray(persona.values) ? persona.values.join(", ") : ""}
										placeholder="Comma-separated"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="frustrations">Frustrations</Label>
									<Input
										id="frustrations"
										name="frustrations"
										type="text"
										defaultValue={Array.isArray(persona.frustrations) ? persona.frustrations.join(", ") : ""}
										placeholder="Comma-separated"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="preferences">Preferences</Label>
									<Input
										id="preferences"
										name="preferences"
										type="text"
										defaultValue={persona.preferences || ""}
										placeholder="e.g., Prefers mobile apps"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="key_tasks">Key Tasks</Label>
									<Input
										id="key_tasks"
										name="key_tasks"
										type="text"
										defaultValue={Array.isArray(persona.key_tasks) ? persona.key_tasks.join(", ") : ""}
										placeholder="Comma-separated"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="tools_used">Tools Used</Label>
									<Input
										id="tools_used"
										name="tools_used"
										type="text"
										defaultValue={Array.isArray(persona.tools_used) ? persona.tools_used.join(", ") : ""}
										placeholder="Comma-separated"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="primary_goal">Primary Goal</Label>
									<Input
										id="primary_goal"
										name="primary_goal"
										type="text"
										defaultValue={persona.primary_goal || ""}
										placeholder="e.g., Increase productivity"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="secondary_goals">Secondary Goals</Label>
									<Input
										id="secondary_goals"
										name="secondary_goals"
										type="text"
										defaultValue={Array.isArray(persona.secondary_goals) ? persona.secondary_goals.join(", ") : ""}
										placeholder="Comma-separated"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="sources">Sources</Label>
									<Input
										id="sources"
										name="sources"
										type="text"
										defaultValue={Array.isArray(persona.sources) ? persona.sources.join(", ") : ""}
										placeholder="Comma-separated"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="quotes">Quotes</Label>
									<Textarea
										id="quotes"
										name="quotes"
										defaultValue={Array.isArray(persona.quotes) ? persona.quotes.join("\n") : ""}
										placeholder="One quote per line"
										rows={3}
									/>
								</div>
							</div>

							<div className="flex gap-3 pt-4">
								<Button type="submit" className="flex-1">
									Update Persona
								</Button>
								<Button type="button" variant="outline" asChild>
									<a href={routes.personas.detail(persona.id)}>Cancel</a>
								</Button>
							</div>
						</form>

						{/* Delete Section */}
						<div className="mt-8 border-t pt-6">
							<div className="rounded-lg border border-red-200 bg-red-50 p-4">
								<h3 className="mb-2 font-medium text-red-900">Danger Zone</h3>
								<p className="mb-4 text-red-700 text-sm">
									Deleting this persona will permanently remove it and all associated data. This action cannot be
									undone.
								</p>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button variant="destructive" size="sm" className="gap-2">
											<Trash2 className="h-4 w-4" />
											Delete Persona
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
											<AlertDialogDescription>
												This action cannot be undone. This will permanently delete the persona "{persona.name}" and
												remove all associated data from our servers.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<Form method="post">
												<input type="hidden" name="intent" value="delete" />
												<AlertDialogAction
													type="submit"
													className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
												>
													Delete Persona
												</AlertDialogAction>
											</Form>
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
