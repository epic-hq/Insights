import type { ActionFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { createInterview } from "~/features/interviews/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "New Interview | Insights" }, { name: "description", content: "Create a new interview" }]
}

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase

	const formData = await request.formData()
	const title = formData.get("title") as string
	const interviewDate = formData.get("interview_date") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	try {
		const { data, error } = await createInterview({
			supabase,
			data: {
				title: title.trim(),
				interview_date: interviewDate || null,
				account_id: accountId,
			},
		})

		if (error) {
			return { error: "Failed to create interview" }
		}

		return redirect(`/interviews/${data.id}`)
	} catch (_error) {
		return { error: "Failed to create interview" }
	}
}

export default function NewInterview() {
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900">New Interview</h1>
				<p className="mt-2 text-gray-600">Create a new interview record</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="title">Title *</Label>
					<Input id="title" name="title" type="text" required placeholder="Enter interview title" className="mt-1" />
				</div>

				<div>
					<Label htmlFor="interview_date">Interview Date</Label>
					<Input id="interview_date" name="interview_date" type="date" className="mt-1" />
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						placeholder="Enter interview description"
						className="mt-1"
						rows={4}
					/>
				</div>

				<div>
					<Label htmlFor="interview_date">Interview Date</Label>
					<Input id="interview_date" name="interview_date" type="date" className="mt-1" />
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Create Interview</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</div>
	)
}
