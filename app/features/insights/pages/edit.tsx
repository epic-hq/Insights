import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { deleteInsight, getInsightById, updateInsight } from "~/features/insights/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `Edit ${data?.insight?.name || "Insight"} | Insights` },
		{ name: "description", content: "Edit insight details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	
	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const { id } = params

	if (!accountId || !projectId || !id) {
		throw new Response("Account ID, Project ID, and Insight ID are required", { status: 400 })
	}

	try {
		const data = await getInsightById({
			supabase,
			accountId,
			projectId,
			id,
		})

		if (!data) {
			throw new Response("Insight not found", { status: 404 })
		}

		// Transform to include snake_case fields and process tags
		const insight = {
			...data,
			tags: data.insight_tags?.map((it: { tags: { id: string; tag: string } }) => ({ id: it.tags.id, tag: it.tags.tag })) ?? [],
		}

		return { insight }
	} catch {
		throw new Response("Failed to load insight", { status: 500 })
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	
	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const { id } = params

	if (!accountId || !projectId || !id) {
		throw new Response("Account ID, Project ID, and Insight ID are required", { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get("intent") as string

	if (intent === "delete") {
		try {
			await deleteInsight({
				supabase,
				id,
				accountId,
				projectId,
			})

			return redirect("/insights")
		} catch {
			return { error: "Failed to delete insight" }
		}
	}

	// Handle update - using snake_case fields that match database schema
	const name = formData.get("name") as string
	const details = formData.get("details") as string
	const category = formData.get("category") as string
	const impactScore = formData.get("impact_score") as string

	if (!name?.trim()) {
		return { error: "Name is required" }
	}

	if (!details?.trim()) {
		return { error: "Details are required" }
	}

	try {
		const { data } = await updateInsight({
			supabase,
			id,
			accountId,
			projectId,
			data: {
				name: name.trim(),
				details: details.trim(),
				category: category || "general",
				impact: impactScore ? Number.parseInt(impactScore, 10) : null,
			},
		})

		if (!data) {
			return { error: "Failed to update insight" }
		}

		return redirect(`/insights/${data.id}`)
	} catch {
		return { error: "Failed to update insight" }
	}
}

export default function EditInsight() {
	const { insight } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900">Edit Insight</h1>
				<p className="mt-2 text-gray-600">Update insight details</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="name">Name *</Label>
					<Input
						id="name"
						name="name"
						type="text"
						required
						defaultValue={insight.name || ""}
						placeholder="Enter insight name"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="details">Details *</Label>
					<Textarea
						id="details"
						name="details"
						required
						defaultValue={insight.details || ""}
						placeholder="Enter insight details"
						className="mt-1"
						rows={6}
					/>
				</div>

				<div>
					<Label htmlFor="category">Category</Label>
					<Select name="category" defaultValue={insight.category || "general"}>
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select a category" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="general">General</SelectItem>
							<SelectItem value="user_behavior">User Behavior</SelectItem>
							<SelectItem value="feature_request">Feature Request</SelectItem>
							<SelectItem value="pain_point">Pain Point</SelectItem>
							<SelectItem value="opportunity">Opportunity</SelectItem>
							<SelectItem value="technical">Technical</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div>
					<Label htmlFor="impact_score">Impact Score (1-10)</Label>
					<Input
						id="impact_score"
						name="impact_score"
						type="number"
						min="1"
						max="10"
						defaultValue={insight.impact?.toString() || ""}
						placeholder="Rate the impact from 1-10"
						className="mt-1"
					/>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Update Insight</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>

			<div className="mt-12 border-t pt-8">
				<h2 className="font-semibold text-lg text-red-600">Danger Zone</h2>
				<p className="mt-2 text-gray-600 text-sm">Permanently delete this insight. This action cannot be undone.</p>
				<Form method="post" className="mt-4">
					<input type="hidden" name="intent" value="delete" />
					<Button
						type="submit"
						variant="destructive"
						onClick={(e) => {
							if (!confirm("Are you sure you want to delete this insight? This action cannot be undone.")) {
								e.preventDefault()
							}
						}}
					>
						Delete Insight
					</Button>
				</Form>
			</div>
		</div>
	)
}
