import { useId, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData, useLocation } from "react-router-dom"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { createOpportunity } from "~/features/opportunities/db"
import { loadOpportunityStages } from "~/features/opportunities/server/stage-settings.server"
import { ensureStageValue } from "~/features/opportunities/stage-config"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "New Opportunity | Insights" }, { name: "description", content: "Create a new opportunity" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const projectId = params.projectId
	const accountId = params.accountId

	if (!projectId || !accountId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const { stages } = await loadOpportunityStages({ supabase, accountId })

	return { stages }
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
	const stage = formData.get("stage") as string
	const amount = formData.get("amount") as string
	const closeDate = formData.get("close_date") as string
	const interviewId = formData.get("interview_id") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	try {
		const { stages } = await loadOpportunityStages({ supabase, accountId })
		const normalizedStage = ensureStageValue(stage || null, stages)

		// Build metadata to store interview link temporarily
		// TODO: Automatically run BANT extraction if interview_id is provided
		const metadata = interviewId ? { linked_interview_id: interviewId } : {}

		const createData: any = {
			title: title.trim(),
			account_id: accountId,
			project_id: projectId,
			metadata,
		}

		if (description?.trim()) createData.description = description.trim()
		if (normalizedStage) {
			createData.stage = normalizedStage
			createData.kanban_status = normalizedStage
		}
		if (amount) createData.amount = Number(amount)
		if (closeDate) createData.close_date = closeDate

		const { data, error } = await createOpportunity({
			supabase,
			data: createData,
		})

		if (error) {
			return { error: "Failed to create opportunity" }
		}

		// Link interview to opportunity in sales_lens_summaries
		if (interviewId && data?.id) {
			await supabase
				.from("sales_lens_summaries")
				.update({ opportunity_id: data.id })
				.eq("interview_id", interviewId)
				.eq("project_id", projectId)
				.eq("account_id", accountId)
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
	const { stages } = useLoaderData<typeof loader>()
	const [selectedStage, setSelectedStage] = useState(() => ensureStageValue(null, stages))

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
					<div className="md:col-span-2">
						<Label htmlFor="stage">Sales Stage</Label>
						<Select
							name="stage"
							value={selectedStage}
							onValueChange={(value) => setSelectedStage(ensureStageValue(value, stages))}
						>
							<SelectTrigger className="mt-1">
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
							Stages control the kanban columns and dropdowns for this project.
						</p>
					</div>
				</div>

				<div className="grid gap-6 md:grid-cols-2">
					<div>
						<Label htmlFor="amount">Deal Value ($)</Label>
						<Input id={useId()} name="amount" type="number" step="0.01" min="0" placeholder="0.00" className="mt-1" />
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
