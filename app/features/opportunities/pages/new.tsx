import type { ActionFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { createOpportunity } from "~/features/opportunities/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "New Opportunity | Insights" }, { name: "description", content: "Create a new opportunity" }]
}

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase

	const formData = await request.formData()
	const title = formData.get("title") as string
	const description = formData.get("description") as string
	const status = formData.get("status") as string
	const priority = formData.get("priority") as string
	const estimatedValue = formData.get("estimated_value") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	try {
		const { data, error } = await createOpportunity({
			supabase,
			data: {
				title: title.trim(),
				description: description?.trim() || null,
				status: status || "identified",
				priority: priority || "medium",
				estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
				account_id: accountId,
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
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						placeholder="Enter opportunity description"
						className="mt-1"
						rows={4}
					/>
				</div>

				<div>
					<Label htmlFor="status">Status</Label>
					<Select name="status" defaultValue="identified">
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="identified">Identified</SelectItem>
							<SelectItem value="researching">Researching</SelectItem>
							<SelectItem value="planning">Planning</SelectItem>
							<SelectItem value="in_progress">In Progress</SelectItem>
							<SelectItem value="completed">Completed</SelectItem>
							<SelectItem value="on_hold">On Hold</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div>
					<Label htmlFor="priority">Priority</Label>
					<Select name="priority" defaultValue="medium">
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select priority" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="low">Low</SelectItem>
							<SelectItem value="medium">Medium</SelectItem>
							<SelectItem value="high">High</SelectItem>
							<SelectItem value="critical">Critical</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div>
					<Label htmlFor="estimated_value">Estimated Value ($)</Label>
					<Input
						id="estimated_value"
						name="estimated_value"
						type="number"
						min="0"
						step="0.01"
						placeholder="Enter estimated value"
						className="mt-1"
					/>
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
