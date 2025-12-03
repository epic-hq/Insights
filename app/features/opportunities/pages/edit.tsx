import { useId, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { BackButton } from "~/components/ui/back-button"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"

import { deleteOpportunity, getOpportunityById, updateOpportunity } from "~/features/opportunities/db"
import { loadOpportunityStages } from "~/features/opportunities/server/stage-settings.server"
import { ensureStageValue } from "~/features/opportunities/stage-config"
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

		const { stages } = await loadOpportunityStages({ supabase, accountId })

		return { opportunity, stages }
	} catch (_error) {
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
				return { error: "Failed to delete opportunity" }
			}

			// Redirect to opportunities list with full path context
			return redirect(`/a/${accountId}/${projectId}/opportunities`)
		} catch (_error) {
			return { error: "Failed to delete opportunity" }
		}
	}

	// Handle update
	const title = formData.get("title") as string
	const description = formData.get("description") as string
	const kanbanStatus = formData.get("kanban_status") as string
	const stage = formData.get("stage") as string
	const amount = formData.get("amount") as string
	const closeDate = formData.get("close_date") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	try {
		const { stages } = await loadOpportunityStages({ supabase, accountId })
		const normalizedStage = ensureStageValue(stage || kanbanStatus || null, stages)
		const updateData: any = {
			title: title.trim(),
		}

		if (description?.trim()) updateData.description = description.trim()
		if (normalizedStage) {
			updateData.stage = normalizedStage
			updateData.kanban_status = normalizedStage
		}
		if (amount) updateData.amount = Number(amount)
		if (closeDate) updateData.close_date = closeDate

		const { data, error } = await updateOpportunity({
			supabase,
			id: opportunityId,
			accountId,
			projectId,
			data: updateData,
		})

		if (error) {
			return { error: "Failed to update opportunity" }
		}

		// Redirect to opportunity detail with full path context
		return redirect(`/a/${accountId}/${projectId}/opportunities/${data.id}`)
	} catch (_error) {
		return { error: "Failed to update opportunity" }
	}
}

export default function EditOpportunity() {
	const { opportunity, stages } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const [selectedStage, setSelectedStage] = useState(() =>
		ensureStageValue(opportunity.stage || opportunity.kanban_status, stages)
	)

	return (
		<div className="container mx-auto max-w-3xl px-4 py-8">
			<BackButton />

			<div className="mb-8">
				<h1 className="font-bold text-3xl tracking-tight">Edit Opportunity</h1>
				<p className="mt-2 text-muted-foreground">Update opportunity details</p>
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
						className="mt-1 min-h-[100px]"
					/>
				</div>

				<div className="grid gap-6 md:grid-cols-2">
					<div className="md:col-span-2">
						<Label htmlFor="stage">Sales Stage</Label>
						<Select
							name="stage"
							value={selectedStage}
							onValueChange={(value) => setSelectedStage(ensureStageValue(value, stages))}
						>
							<SelectTrigger className="mt-1" id="stage">
								<SelectValue placeholder="Select stage" />
							</SelectTrigger>
							<SelectContent>
								{stages.map((stage) => (
									<SelectItem key={stage.id} value={stage.id}>
										<div className="flex flex-col items-start">
											<span className="font-medium">{stage.label}</span>
											{stage.description && <span className="text-muted-foreground text-xs">{stage.description}</span>}
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<input type="hidden" name="kanban_status" value={selectedStage} />
						<p className="mt-2 text-muted-foreground text-xs">
							Updating the stage moves this deal across your kanban columns.
						</p>
					</div>
				</div>

				<div className="grid gap-6 md:grid-cols-2">
					<div>
						<Label htmlFor="amount">Deal Value ($)</Label>
						<Input
							id="amount"
							name="amount"
							type="number"
							step="0.01"
							min="0"
							defaultValue={opportunity.amount ? Number(opportunity.amount) : ""}
							placeholder="0.00"
							className="mt-1"
						/>
					</div>

					<div>
						<Label htmlFor="close_date">Expected Close Date</Label>
						<Input
							id="close_date"
							name="close_date"
							type="date"
							defaultValue={opportunity.close_date ? new Date(opportunity.close_date).toISOString().split("T")[0] : ""}
							className="mt-1"
						/>
					</div>
				</div>

				{actionData?.error && (
					<div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
						<p className="text-destructive text-sm">{actionData.error}</p>
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
				<h2 className="font-semibold text-destructive text-lg">Danger Zone</h2>
				<p className="mt-2 text-muted-foreground text-sm">
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
