import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"

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
	const supabase = ctx.supabase
	
	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const opportunityId = params.id

	if (!accountId || !projectId || !opportunityId) {
		throw new Response("Account ID, Project ID, and Opportunity ID are required", { status: 400 })
	}

	try {
		const { data: opportunity, error } = await getOpportunityById({
			supabase,
			accountId,
			projectId,
			id: opportunityId,
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
	const supabase = ctx.supabase
	
	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const opportunityId = params.id

	if (!accountId || !projectId || !opportunityId) {
		throw new Response("Account ID, Project ID, and Opportunity ID are required", { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get("intent") as string

	if (intent === "delete") {
		try {
			const { error } = await deleteOpportunity({
				supabase,
				id: opportunityId,
				accountId,
				projectId,
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
	const kanbanStatus = formData.get("kanban_status") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	try {
		const { data, error } = await updateOpportunity({
			supabase,
			id: opportunityId,
			accountId,
			projectId,
			data: {
				title: title.trim(),
				kanban_status: kanbanStatus || "Explore",
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
					<Label htmlFor="kanban_status">Status</Label>
					<Select name="kanban_status" defaultValue={opportunity.kanban_status || "Explore"}>
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
