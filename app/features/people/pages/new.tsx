import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { createPerson } from "~/features/people/db"
import { getPersonas } from "~/features/personas/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "New Person | Insights" }, { name: "description", content: "Create a new person" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}
	const { data: personas } = await getPersonas({ supabase, accountId, projectId })
	return { personas: personas || [] }
}

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const _accountId = ctx.account_id
	const _supabase = ctx.supabase

	const formData = await request.formData()
	const name = formData.get("name") as string
	const email = formData.get("email") as string
	const _segment = formData.get("segment") as string
	const _notes = formData.get("notes") as string
	const image_url = formData.get("image_url") as string
	const _persona_id = formData.get("persona_id") as string

	if (!name?.trim()) {
		return { error: "Name is required" }
	}

	// Build contact_info object if either email or image_url is present
	let contact_info: Record<string, string> | null = null
	if (email?.trim() || image_url?.trim()) {
		contact_info = {}
		if (email?.trim()) contact_info.email = email.trim()
		if (image_url?.trim()) contact_info.image_url = image_url.trim()
	}

	try {
		const { data, error } = await createPerson({
			supabase: _supabase,
			data: {
				name: name.trim(),
				segment: _segment?.trim() || null,
				description: _notes?.trim() || null,
				account_id: _accountId,
				contact_info,
			},
		})

		if (error) {
			return { error: "Failed to create person" }
		}

		// Associate with persona if selected
		if (_persona_id && _persona_id !== "none") {
			const { error: personaError } = await _supabase.from("people_personas").upsert(
				{
					person_id: data.id,
					persona_id: _persona_id,
				},
				{ onConflict: "person_id,persona_id" }
			)
			if (personaError) {
				return { error: "Person created, but failed to associate persona" }
			}
		}

		return redirect(`/people/${data.id}`)
	} catch (_error) {
		return { error: "Failed to create person" }
	}
}

import { useLoaderData } from "react-router-dom"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"

export default function NewPerson() {
	const actionData = useActionData<typeof action>()
	const { personas } = useLoaderData() as { personas: { id: string; name: string }[] }

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900">New Person</h1>
				<p className="mt-2 text-gray-600">Create a new person record</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="name">Name *</Label>
					<Input id="name" name="name" type="text" required placeholder="Enter person's name" className="mt-1" />
				</div>

				<div>
					<Label htmlFor="email">Email</Label>
					<Input id="email" name="email" type="email" placeholder="Enter email address" className="mt-1" />
				</div>

				<div>
					<Label htmlFor="segment">Segment</Label>
					<Input
						id="segment"
						name="segment"
						type="text"
						placeholder="e.g., Customer, Prospect, Partner"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="image_url">Image URL</Label>
					<Input
						id="image_url"
						name="image_url"
						type="text"
						placeholder="https://example.com/image.jpg"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="persona_id">Persona</Label>
					<Select name="persona_id" defaultValue="none">
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
					<Label htmlFor="notes">Notes</Label>
					<Textarea
						id="notes"
						name="notes"
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
					<Button type="submit">Create Person</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</div>
	)
}
