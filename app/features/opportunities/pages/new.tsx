import type { ActionFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"

import { createOpportunity } from "~/features/opportunities/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "New Opportunity | Insights" }, { name: "description", content: "Create a new opportunity" }]
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	
	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	
	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const formData = await request.formData()
	const title = formData.get("title") as string
	const kanbanStatus = formData.get("kanban_status") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	try {
		const { data, error } = await createOpportunity({
			supabase,
			data: {
				title: title.trim(),
				kanban_status: kanbanStatus || "Explore",
				account_id: accountId,
				project_id: projectId,
			},
		})

		if (error) {
			console.error("Error creating opportunity:", error)
			return { error: "Failed to create opportunity" }
		}

		return redirect(`/opportunities/${data.id}`)
	} catch (error) {
		console.error("Error creating opportunity:", error)
		return { error: "Failed to create opportunity" }
	}
}

export default function NewOpportunity() {
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900">New Opportunity</h1>
				<p className="mt-2 text-gray-600">Create a new opportunity</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="title">Title *</Label>
					<Input
						id="title"
						name="title"
						type="text"
						required
						placeholder="Enter opportunity title"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="kanban_status">Status</Label>
					<Select name="kanban_status" defaultValue="Explore">
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="Explore">Explore</SelectItem>
							<SelectItem value="Validate">Validate</SelectItem>
							<SelectItem value="Build">Build</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-sm text-red-700">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Create Opportunity</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</div>
	)
}
