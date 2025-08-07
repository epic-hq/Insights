import consola from "consola"
import type { ActionFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { createProject } from "~/features/projects/db"
import { userContext } from "~/server/user-context"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction = () => {
	return [{ title: "New Project | Insights" }, { name: "description", content: "Create a new project" }]
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	// From URL params - consistent, explicit, RESTful
	const accountId = params.accountId

	if (!accountId) {
		throw new Response("Account ID is required", { status: 400 })
	}

	const formData = await request.formData()
	const name = formData.get("name") as string
	const description = formData.get("description") as string
	const status = formData.get("status") as string

	if (!name?.trim()) {
		return { error: "Name is required" }
	}

	try {
		const { data, error } = await createProject({
			supabase,
			data: {
				name: name.trim(),
				description: description?.trim() || null,
				status: status || "planning",
				account_id: accountId,
			},
		})

		if (error) {
			return { error: "Failed to create project" }
		}

		// get the new projectId and create project routes server side definition
		const projectRoutes = createProjectRoutes(accountId, data.id)

		return redirect(projectRoutes.projects.dashboard(data.id))
	} catch (error) {
		consola.error("Error creating project:", error)
		return { error: "Failed to create project" }
	}
}

export default function NewProject() {
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900">New Project</h1>
				<p className="mt-2 text-gray-600">Create a new project</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="name">Name *</Label>
					<Input id="name" name="name" type="text" required placeholder="Enter project name" className="mt-1" />
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						placeholder="Enter project description"
						className="mt-1"
						rows={4}
					/>
				</div>

				<div>
					<Label htmlFor="status">Status</Label>
					<Select name="status" defaultValue="planning">
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="planning">Planning</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="on_hold">On Hold</SelectItem>
							<SelectItem value="completed">Completed</SelectItem>
							<SelectItem value="cancelled">Cancelled</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Create Project</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</div>
	)
}
