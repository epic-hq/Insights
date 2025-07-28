import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { deleteOpportunity, getOpportunityById, updateOpportunity } from "~/features/opportunities/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `Edit ${data?.opportunity?.title || "Opportunity"} | Insights` },
		{ name: "description", content: "Edit opportunity details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { id } = params

	if (!id) {
		throw new Response("Opportunity ID is required", { status: 400 })
	}

	try {
		const { data: opportunity, error } = await getOpportunityById({
			supabase,
			accountId,
			id,
		})

		if (error || !opportunity) {
			throw new Response("Opportunity not found", { status: 404 })
		}

		return { opportunity }
	} catch (error) {
		console.error("Error loading opportunity:", error)
		throw new Response("Failed to load opportunity", { status: 500 })
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { id } = params

	if (!id) {
		throw new Response("Opportunity ID is required", { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get("intent") as string

	if (intent === "delete") {
		try {
			const { error } = await deleteOpportunity({
				supabase,
				id,
				accountId,
			})

			if (error) {
				console.error("Error deleting opportunity:", error)
				return { error: "Failed to delete opportunity" }
			}

			return redirect("/opportunities")
		} catch (error) {
			console.error("Error deleting opportunity:", error)
			return { error: "Failed to delete opportunity" }
		}
	}

	// Handle update
	const title = formData.get("title") as string
	const description = formData.get("description") as string
	const status = formData.get("status") as string
	const priority = formData.get("priority") as string
	const estimatedValue = formData.get("estimated_value") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	try {
		const { data, error } = await updateOpportunity({
			supabase,
			id,
			accountId,
			data: {
				title: title.trim(),
				description: description?.trim() || null,
				status: status || "identified",
				priority: priority || "medium",
				estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
			},
		})

		if (error) {
			console.error("Error updating opportunity:", error)
			return { error: "Failed to update opportunity" }
		}

		return redirect(`/opportunities/${data.id}`)
	} catch (error) {
		console.error("Error updating opportunity:", error)
		return { error: "Failed to update opportunity" }
	}
}

export default function EditOpportunity() {
	const { opportunity } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900">Edit Opportunity</h1>
				<p className="mt-2 text-gray-600">Update opportunity details</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="title">Title *</Label>
					<Input
						id="title"
						name="title"
						type="text"
						required
						defaultValue={opportunity.title || ""}
						placeholder="Enter opportunity title"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						defaultValue={opportunity.description || ""}
						placeholder="Enter opportunity description"
						className="mt-1"
						rows={4}
					/>
				</div>

				<div>
					<Label htmlFor="status">Status</Label>
					<Select name="status" defaultValue={opportunity.status || "identified"}>
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
					<Select name="priority" defaultValue={opportunity.priority || "medium"}>
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
						defaultValue={opportunity.estimated_value?.toString() || ""}
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
					<Button type="submit">Update Opportunity</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>

			<div className="mt-12 border-t pt-8">
				<h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
				<p className="mt-2 text-sm text-gray-600">
					Permanently delete this opportunity. This action cannot be undone.
				</p>
				<Form method="post" className="mt-4">
					<input type="hidden" name="intent" value="delete" />
					<Button
						type="submit"
						variant="destructive"
						onClick={(e) => {
							if (!confirm("Are you sure you want to delete this opportunity? This action cannot be undone.")) {
								e.preventDefault()
							}
						}}
					>
						Delete Opportunity
					</Button>
				</Form>
			</div>
		</div>
	)
}
