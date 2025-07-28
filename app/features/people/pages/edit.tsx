import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { deletePerson, getPersonById, updatePerson } from "~/features/people/db"
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
	const { id } = params

	if (!id) {
		throw new Response("Person ID is required", { status: 400 })
	}

	try {
		const { data: person, error } = await getPersonById({
			supabase,
			accountId,
			id,
		})

		if (error || !person) {
			throw new Response("Person not found", { status: 404 })
		}

		return { person }
	} catch (error) {
		console.error("Error loading person:", error)
		throw new Response("Failed to load person", { status: 500 })
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { id } = params

	if (!id) {
		throw new Response("Person ID is required", { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get("intent") as string

	if (intent === "delete") {
		try {
			const { error } = await deletePerson({
				supabase,
				id,
				accountId,
			})

			if (error) {
				console.error("Error deleting person:", error)
				return { error: "Failed to delete person" }
			}

			return redirect("/people")
		} catch (error) {
			console.error("Error deleting person:", error)
			return { error: "Failed to delete person" }
		}
	}

	// Handle update
	const name = formData.get("name") as string
	const email = formData.get("email") as string
	const segment = formData.get("segment") as string
	const notes = formData.get("notes") as string

	if (!name?.trim()) {
		return { error: "Name is required" }
	}

	try {
		const { data, error } = await updatePerson({
			supabase,
			id,
			accountId,
			data: {
				name: name.trim(),
				email: email?.trim() || null,
				segment: segment?.trim() || null,
				notes: notes?.trim() || null,
			},
		})

		if (error) {
			console.error("Error updating person:", error)
			return { error: "Failed to update person" }
		}

		return redirect(`/people/${data.id}`)
	} catch (error) {
		console.error("Error updating person:", error)
		return { error: "Failed to update person" }
	}
}

export default function EditPerson() {
	const { person } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900">Edit Person</h1>
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
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						defaultValue={person.email || ""}
						placeholder="Enter email address"
						className="mt-1"
					/>
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
					<Label htmlFor="notes">Notes</Label>
					<Textarea
						id="notes"
						name="notes"
						defaultValue={person.notes || ""}
						placeholder="Additional notes about this person"
						className="mt-1"
						rows={4}
					/>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-sm text-red-700">{actionData.error}</p>
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
				<h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
				<p className="mt-2 text-sm text-gray-600">
					Permanently delete this person. This action cannot be undone.
				</p>
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
