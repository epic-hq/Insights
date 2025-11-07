import { useId } from "react"
import type { ActionFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLocation } from "react-router-dom"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
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
	const description = formData.get("description") as string
	const kanbanStatus = formData.get("kanban_status") as string
	const stage = formData.get("stage") as string
	const amount = formData.get("amount") as string
	const closeDate = formData.get("close_date") as string
	const interviewId = formData.get("interview_id") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	try {
		// Build metadata to store interview link temporarily
		// TODO: Automatically run BANT extraction if interview_id is provided
		const metadata = interviewId ? { linked_interview_id: interviewId } : {}

		const createData: any = {
			title: title.trim(),
			kanban_status: kanbanStatus || "Explore",
			account_id: accountId,
			project_id: projectId,
			metadata,
		}

		if (description?.trim()) createData.description = description.trim()
		if (stage?.trim()) createData.stage = stage.trim()
		if (amount) createData.amount = Number(amount)
		if (closeDate) createData.close_date = closeDate

		const { data, error } = await createOpportunity({
			supabase,
			data: createData,
		})

		if (error) {
			return { error: "Failed to create opportunity" }
		}

		// Redirect to the opportunity detail page with full path context
		return redirect(`/a/${accountId}/${projectId}/opportunities/${data.id}`)
	} catch (_error) {
		return { error: "Failed to create opportunity" }
	}
}

export default function NewOpportunity() {
	const actionData = useActionData<typeof action>()
	const location = useLocation()

	// Get interview context from location state if navigating from interview detail
	const interviewTitle = (location.state as { interviewTitle?: string })?.interviewTitle
	const interviewId = (location.state as { interviewId?: string })?.interviewId

	// Pre-fill title with interview title or use empty string
	const defaultTitle = interviewTitle ? `Opportunity: ${interviewTitle}` : ""

	return (
		<div className="container mx-auto max-w-3xl px-4 py-8">
			<BackButton />

			<div className="mb-8">
				<h1 className="font-bold text-3xl tracking-tight">New Opportunity</h1>
				<p className="mt-2 text-muted-foreground">Create a new opportunity</p>
				{interviewId && (
					<div className="mt-3">
						<Badge variant="outline" className="gap-1">
							🎙️ Linked to interview
						</Badge>
						<p className="mt-2 text-muted-foreground text-sm">
							This opportunity will be linked to the interview "{interviewTitle}" for BANT extraction.
						</p>
					</div>
				)}
			</div>

			<Form method="post" className="space-y-6">
				<input type="hidden" name="interview_id" value={interviewId || ""} />
				<div>
					<Label htmlFor="title">Title *</Label>
					<Input
						id={useId()}
						name="title"
						type="text"
						required
						defaultValue={defaultTitle}
						placeholder="Enter opportunity title"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id={useId()}
						name="description"
						placeholder="Enter opportunity description"
						className="mt-1 min-h-[100px]"
					/>
				</div>

				<div className="grid gap-6 md:grid-cols-2">
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

					<div>
						<Label htmlFor="stage">Sales Stage</Label>
						<Input
							id={useId()}
							name="stage"
							type="text"
							placeholder="e.g., Discovery, Proposal, Negotiation"
							className="mt-1"
						/>
					</div>
				</div>

				<div className="grid gap-6 md:grid-cols-2">
					<div>
						<Label htmlFor="amount">Deal Value ($)</Label>
						<Input
							id={useId()}
							name="amount"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							className="mt-1"
						/>
					</div>

					<div>
						<Label htmlFor="close_date">Expected Close Date</Label>
						<Input id={useId()} name="close_date" type="date" className="mt-1" />
					</div>
				</div>

				{actionData?.error && (
					<div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
						<p className="text-destructive text-sm">{actionData.error}</p>
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
