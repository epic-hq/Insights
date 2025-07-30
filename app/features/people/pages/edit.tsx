import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { deletePerson, getPersonById, updatePerson } from "~/features/people/db"
import { getPersonas } from "~/features/personas/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `Edit ${data?.person?.name || "Person"} | Insights` },
		{ name: "description", content: "Edit person details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { personId } = params

	if (!personId) {
		throw new Response("Person ID is required", { status: 400 })
	}

	try {
		const [person, { data: personas }] = await Promise.all([
			getPersonById({
				supabase,
				accountId,
				id: personId,
			}),
			getPersonas({ supabase, accountId }),
		])

		if (!person) {
			throw new Response("Person not found", { status: 404 })
		}

		return { person, personas: personas || [] }
	} catch {
		throw new Response("Failed to load person", { status: 500 })
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { personId } = params

	if (!personId) {
		throw new Response("Person ID is required", { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get("intent") as string

	if (intent === "delete") {
		try {
			await deletePerson({
				supabase,
				id: personId,
				accountId,
			})

			return redirect("/people")
		} catch {
			return { error: "Failed to delete person" }
		}
	}

	// Handle update
	const name = formData.get("name") as string
	const description = formData.get("description") as string
	const segment = formData.get("segment") as string
	const personaId = formData.get("persona_id") as string

	if (!name?.trim()) {
		return { error: "Name is required" }
	}

	try {
		// Update person basic info (no longer includes persona field)
		const data = await updatePerson({
			supabase,
			id: personId,
			accountId,
			data: {
				name: name.trim(),
				description: description?.trim() || null,
				segment: segment?.trim() || null,
			},
		})

		if (!data) {
			return { error: "Failed to update person" }
		}

		// Handle persona assignment via junction table
		if (personaId && personaId !== "none") {
			await supabase.from("people_personas").upsert(
				{
					person_id: personId,
					persona_id: personaId,
				},
				{ onConflict: "person_id,persona_id" }
			)
		} else {
			// Remove all persona assignments if "none" is selected
			await supabase.from("people_personas").delete().eq("person_id", personId)
		}

		return redirect(`/people/${data.id}`)
	} catch (error) {
		// Log error for debugging without using console
		if (typeof window !== "undefined") {
			;(window as any).debugError = error
		}
		return { error: "Failed to update person" }
	}
}

export default function EditPerson() {
	const { person, personas } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	// Get current persona from junction table
	const people_personas = person.people_personas || []
	const currentPersona = people_personas.length > 0 ? people_personas[0].personas : null

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900">Edit Person</h1>
				<p className="mt-2 text-gray-600">Update person details</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="name">Name *</Label>
					<Input
						id="name"
						name="name"
						type="text"
						required
						defaultValue={person.name || ""}
						placeholder="Enter person's name"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="persona_id">Persona</Label>
					<Select name="persona_id" defaultValue={currentPersona?.id || "none"}>
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select a persona" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">No persona</SelectItem>
							{personas.map((persona) => (
								<SelectItem key={persona.id} value={persona.id}>
									{persona.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div>
					<Label htmlFor="segment">Segment</Label>
					<Input
						id="segment"
						name="segment"
						type="text"
						defaultValue={person.segment || ""}
						placeholder="e.g., Customer, Prospect, Partner"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						defaultValue={person.description || ""}
						placeholder="Additional notes about this person"
						className="mt-1"
						rows={4}
					/>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Update Person</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>

			<div className="mt-12 border-t pt-8">
				<h2 className="font-semibold text-lg text-red-600">Danger Zone</h2>
				<p className="mt-2 text-gray-600 text-sm">Permanently delete this person. This action cannot be undone.</p>
				<Form method="post" className="mt-4">
					<input type="hidden" name="intent" value="delete" />
					<Button
						type="submit"
						variant="destructive"
						onClick={(e) => {
							if (!confirm("Are you sure you want to delete this person? This action cannot be undone.")) {
								e.preventDefault()
							}
						}}
					>
						Delete Person
					</Button>
				</Form>
			</div>
		</div>
	)
}
