import consola from "consola"
import type { ActionFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
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
	const name = formData.get("name") as string
	const pain = formData.get("pain") as string
	const details = formData.get("details") as string
	const category = formData.get("category") as string
	const desired_outcome = formData.get("desired_outcome") as string
	const journey_stage = formData.get("journey_stage") as string
	const evidence = formData.get("evidence") as string

	if (!name?.trim()) {
		return { error: "Name is required" }
	}

	if (!pain?.trim()) {
		return { error: "Pain is required" }
	}

	try {
		const { data, error } = await createInsight({
			supabase,
			data: {
				name: name.trim(),
				pain: pain.trim(),
				details: details.trim(),
				category: category || "general",
				desired_outcome: desired_outcome.trim(),
				journey_stage: journey_stage.trim(),
				evidence: evidence.trim(),
				account_id: accountId,
				project_id: projectId,
			},
		})

		if (error) {
			consola.error("Error creating insight:", error)
			return { error: "Failed to create insight" }
		}

		return redirect(`/a/${accountId}/${projectId}/insights/${data.id}`)
	} catch (error) {
		consola.error("Error creating insight:", error)
		return { error: "Failed to create insight" }
	}
}

export default function NewInsight() {
	const actionData = useActionData<typeof action>()

	return (
		<PageContainer size="sm" padded={false} className="max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900">New Insight</h1>
				<p className="mt-2 text-gray-600">Create a new insight</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="name">Name</Label>
					<Input id="name" name="name" type="text" required placeholder="Enter insight title" className="mt-1" />
				</div>

				<div>
					<Label htmlFor="pain">Pain *</Label>
					<Textarea id="pain" name="pain" required placeholder="Enter insight pain" className="mt-1" rows={6} />
				</div>
				<div>
					<Label htmlFor="details">Details</Label>
					<Textarea id="details" name="details" placeholder="Enter insight details" className="mt-1" rows={6} />
				</div>

				<div>
					<Label htmlFor="desired_outcome">Desired Outcome</Label>
					<Textarea
						id="desired_outcome"
						name="desired_outcome"
						placeholder="Enter insight desired outcome"
						className="mt-1"
						rows={6}
					/>
				</div>

				<div>
					<Label htmlFor="journey_stage">Journey Stage</Label>
					<Select name="journey_stage" defaultValue="general">
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select a journey stage" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="Awareness">Awareness</SelectItem>
							<SelectItem value="Onboarding">Onboarding</SelectItem>
							<SelectItem value="Planning">Planning</SelectItem>
							<SelectItem value="Learning">Learning</SelectItem>
							<SelectItem value="Assessing">Assessing</SelectItem>
							<SelectItem value="Progress">Progress</SelectItem>
							<SelectItem value="Community">Community</SelectItem>
							<SelectItem value="Support">Support</SelectItem>
							<SelectItem value="Other">Other</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div>
					<Label htmlFor="evidence">Evidence</Label>
					<Textarea id="evidence" name="evidence" placeholder="Enter insight evidence" className="mt-1" rows={6} />
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Create Insight</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</PageContainer>
	)
}
