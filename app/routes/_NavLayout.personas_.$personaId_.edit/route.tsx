import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Form, redirect, useLoaderData, useNavigation } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/types"

type PersonaInsert = Database["public"]["Tables"]["personas"]["Insert"]

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	if (!accountId) throw new Response("Unauthorized", { status: 401 })

	const personaId = params.personaId
	if (!personaId) throw new Response("Persona ID required", { status: 400 })

	const { data: persona, error } = await supabase
		.from("personas")
		.select("*")
		.eq("id", personaId)
		.eq("account_id", accountId)
		.single()

	if (error || !persona) {
		throw new Response("Persona not found", { status: 404 })
	}

	return { persona }
}

export async function action({ request, params }: ActionFunctionArgs) {
	const formData = await request.formData()
	const intent = formData.get("intent") as string

	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	if (!accountId) throw new Response("Unauthorized", { status: 401 })

	const personaId = params.personaId
	if (!personaId) throw new Response("Persona ID required", { status: 400 })

	if (intent === "delete") {
		// Handle delete
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

	// Handle update
	const name = (formData.get("name") as string)?.trim()
	if (!name) return { error: "Name is required" }

	const description = (formData.get("description") as string) || null
	const color_hex = (formData.get("color_hex") as string) || "#6b7280"

	const personaData: Partial<PersonaInsert> = {
		name,
		description,
		color_hex,
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

const colorOptions = [
	{ value: "#ef4444", color: "#ef4444", label: "Red" },
	{ value: "#f97316", color: "#f97316", label: "Orange" },
	{ value: "#eab308", color: "#eab308", label: "Yellow" },
	{ value: "#22c55e", color: "#22c55e", label: "Green" },
	{ value: "#06b6d4", color: "#06b6d4", label: "Cyan" },
	{ value: "#3b82f6", color: "#3b82f6", label: "Blue" },
	{ value: "#8b5cf6", color: "#8b5cf6", label: "Purple" },
	{ value: "#ec4899", color: "#ec4899", label: "Pink" },
	{ value: "#6b7280", color: "#6b7280", label: "Gray" },
	{ value: "#374151", color: "#374151", label: "Dark Gray" },
]

export default function EditPersona() {
	const { persona } = useLoaderData<typeof loader>()
	const navigation = useNavigation()
	const isSubmitting = navigation.state === "submitting"

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">Edit Persona</h1>
				<Form method="post" className="inline">
					<input type="hidden" name="intent" value="delete" />
					<Button
						type="submit"
						variant="destructive"
						size="sm"
						disabled={isSubmitting}
						onClick={(e) => {
							if (!confirm("Are you sure you want to delete this persona? This action cannot be undone.")) {
								e.preventDefault()
							}
						}}
					>
						Delete Persona
					</Button>
				</Form>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Persona Details</CardTitle>
				</CardHeader>
				<CardContent>
					<Form method="post" className="space-y-6">
						<div>
							<label htmlFor="name" className="block text-sm font-medium text-gray-700">
								Name *
							</label>
							<Input
								id="name"
								name="name"
								type="text"
								required
								defaultValue={persona.name}
								placeholder="e.g., Tech-Savvy Professional"
								className="mt-1"
							/>
						</div>

						<div>
							<label htmlFor="description" className="block text-sm font-medium text-gray-700">
								Description
							</label>
							<Textarea
								id="description"
								name="description"
								defaultValue={persona.description || ""}
								placeholder="Describe this persona's characteristics, needs, and behaviors..."
								className="mt-1"
								rows={4}
							/>
						</div>

						<div>
							<label htmlFor="color_hex" className="block text-sm font-medium text-gray-700">
								Color
							</label>
							<div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
								{colorOptions.map((option) => (
									<label key={option.value} className="cursor-pointer">
										<input
											type="radio"
											name="color_hex"
											value={option.value}
											defaultChecked={option.value === persona.color_hex}
											className="sr-only"
										/>
										<div
											className="h-8 w-8 rounded-full border-2 border-gray-300 transition-all hover:scale-110 hover:border-gray-400"
											style={{ backgroundColor: option.color }}
											title={option.label}
										/>
									</label>
								))}
							</div>
						</div>

						<div className="flex justify-end space-x-3">
							<Button type="button" variant="outline" asChild>
								<a href={`/personas/${persona.id}`}>Cancel</a>
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Updating..." : "Update Persona"}
							</Button>
						</div>
					</Form>
				</CardContent>
			</Card>
		</div>
	)
}
