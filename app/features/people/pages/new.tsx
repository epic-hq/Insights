import type { ActionFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { createPerson } from "~/features/people/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "New Person | Insights" }, { name: "description", content: "Create a new person" }]
}

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase

	const formData = await request.formData()
	const name = formData.get("name") as string
	const email = formData.get("email") as string
	const segment = formData.get("segment") as string
	const notes = formData.get("notes") as string

	if (!name?.trim()) {
		return { error: "Name is required" }
	}

	try {
		const { data, error } = await createPerson({
			supabase,
			data: {
				name: name.trim(),
				email: email?.trim() || null,
				segment: segment?.trim() || null,
				notes: notes?.trim() || null,
				account_id: accountId,
			},
		})

		if (error) {
			console.error("Error creating person:", error)
			return { error: "Failed to create person" }
		}

		return redirect(`/people/${data.id}`)
	} catch (error) {
		console.error("Error creating person:", error)
		return { error: "Failed to create person" }
	}
}

export default function NewPerson() {
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900">New Person</h1>
				<p className="mt-2 text-gray-600">Create a new person record</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="name">Name *</Label>
					<Input
						id="name"
						name="name"
						type="text"
						required
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
						placeholder="e.g., Customer, Prospect, Partner"
						className="mt-1"
					/>
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
						<p className="text-sm text-red-700">{actionData.error}</p>
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
