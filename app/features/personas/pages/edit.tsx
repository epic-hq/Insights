import { motion } from "framer-motion"
import { Trash2 } from "lucide-react"
import { type ActionFunctionArgs, type MetaFunction, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/types"

type PersonaRow = Database["public"]["Tables"]["personas"]["Row"]
type PersonaUpdate = Database["public"]["Tables"]["personas"]["Update"]

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Edit Persona ${params.personaId || ""} | Insights` },
		{ name: "description", content: "Edit persona details" },
	]
}

export async function loader({ request, params }: { request: Request; params: { personaId: string } }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const personaId = params.personaId

	const { data: persona, error } = await supabase
		.from("personas")
		.select("*")
		.eq("id", personaId)
		.eq("account_id", accountId)
		.single()

	if (error) {
		throw new Response(`Error fetching persona: ${error.message}`, { status: 500 })
	}

	if (!persona) {
		throw new Response("Persona not found", { status: 404 })
	}

	return { persona }
}

export async function action({ request, params }: ActionFunctionArgs) {
	const formData = await request.formData()
	const intent = formData.get("intent")
	const personaId = params.personaId

	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	if (intent === "delete") {
		const { error } = await supabase
			.from("personas")
			.delete()
			.eq("id", personaId)
			.eq("account_id", accountId)

		if (error) {
			return { error: `Failed to delete persona: ${error.message}` }
		}

		return redirect("/personas")
	}

	// Update persona
	const name = (formData.get("name") as string)?.trim()
	if (!name) return { error: "Name is required" }

	const description = (formData.get("description") as string) || null
	const color_hex = (formData.get("color_hex") as string) || "#6b7280"
	const image_url = (formData.get("image_url") as string) || null

	const personaData: PersonaUpdate = {
		name,
		description,
		color_hex,
		image_url,
		updated_at: new Date().toISOString(),
	}

	const { data: persona, error } = await supabase
		.from("personas")
		.update(personaData)
		.eq("id", personaId)
		.eq("account_id", accountId)
		.select()
		.single()

	if (error) {
		return { error: `Failed to update persona: ${error.message}` }
	}

	return redirect(`/personas/${persona.id}`)
}

export default function EditPersona() {
	const { persona } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl px-4 py-6">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<Card>
					<CardHeader>
						<CardTitle className="text-2xl">Edit Persona</CardTitle>
					</CardHeader>
					<CardContent>
						<form method="post" className="space-y-6">
							{actionData?.error && (
								<div className="rounded-md bg-red-50 p-4">
									<div className="text-sm text-red-700">{actionData.error}</div>
								</div>
							)}

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
								<span className="text-xs text-muted-foreground">
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
									<span className="text-sm text-muted-foreground">
										Choose a color to represent this persona
									</span>
								</div>
							</div>

							<div className="flex gap-3 pt-4">
								<Button type="submit" className="flex-1">
									Update Persona
								</Button>
								<Button type="button" variant="outline" asChild>
									<a href={`/personas/${persona.id}`}>Cancel</a>
								</Button>
							</div>
						</form>

						{/* Delete Section */}
						<div className="mt-8 border-t pt-6">
							<div className="rounded-lg border border-red-200 bg-red-50 p-4">
								<h3 className="mb-2 font-medium text-red-900">Danger Zone</h3>
								<p className="mb-4 text-sm text-red-700">
									Deleting this persona will permanently remove it and all associated data. This action cannot be undone.
								</p>
								<form method="post" className="inline">
									<input type="hidden" name="intent" value="delete" />
									<Button
										type="submit"
										variant="destructive"
										size="sm"
										className="gap-2"
										onClick={(e) => {
											if (!confirm("Are you sure you want to delete this persona? This action cannot be undone.")) {
												e.preventDefault()
											}
										}}
									>
										<Trash2 className="h-4 w-4" />
										Delete Persona
									</Button>
								</form>
							</div>
						</div>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	)
}
