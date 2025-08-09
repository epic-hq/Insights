import type { ActionFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { createInsight } from "~/features/insights/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "New Insight | Insights" }, { name: "description", content: "Create a new insight" }]
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
	const content = formData.get("content") as string
	const category = formData.get("category") as string
	const impactScore = formData.get("impact_score") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	if (!content?.trim()) {
		return { error: "Content is required" }
	}

	try {
		const { data, error } = await createInsight({
			supabase,
			data: {
				title: title.trim(),
				content: content.trim(),
				category: category || "general",
				impact_score: impactScore ? Number.parseInt(impactScore, 10) : null,
				account_id: accountId,
				project_id: projectId,
			},
		})

		if (error) {
			console.error("Error creating insight:", error)
			return { error: "Failed to create insight" }
		}

		return redirect(`/a/${accountId}/${projectId}/insights/${data.id}`)
	} catch (error) {
		console.error("Error creating insight:", error)
		return { error: "Failed to create insight" }
	}
}

export default function NewInsight() {
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900">New Insight</h1>
				<p className="mt-2 text-gray-600">Create a new insight</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="title">Title *</Label>
					<Input
						id="title"
						name="title"
						type="text"
						required
						placeholder="Enter insight title"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="content">Content *</Label>
					<Textarea
						id="content"
						name="content"
						required
						placeholder="Enter insight content"
						className="mt-1"
						rows={6}
					/>
				</div>

				<div>
					<Label htmlFor="category">Category</Label>
					<Select name="category" defaultValue="general">
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
						placeholder="Rate the impact from 1-10"
						className="mt-1"
					/>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-sm text-red-700">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Create Insight</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</div>
	)
}
