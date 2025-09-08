import consola from "consola"
import { type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction, redirect } from "react-router"
import { Form, useActionData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { createProject } from "~/features/projects/db"
import { userContext } from "~/server/user-context"
import { generateTwoWordSlug } from "~/utils/random-name"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction = () => {
	return [{ title: "New Project | Insights" }, { name: "description", content: "Create a new project" }]
}

// Auto-create on GET when coming from home with no projects
export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const user = ctx.claims
	const accountId = params.accountId

	if (!accountId) {
		throw new Response("Account ID is required", { status: 400 })
	}

	// Check if account already has projects; if yes, show manual create form
	const { data: existingProjects, error: checkError } = await supabase
		.from("projects")
		.select("id")
		.eq("account_id", accountId)
		.limit(1)

	if (checkError) {
		consola.error("Error checking existing projects:", checkError)
	}

	if (existingProjects && existingProjects.length > 0) {
		return {}
	}

	// Auto-create minimal project with a friendly two-word slug name (e.g., "fancy-bear")
	const defaultName = generateTwoWordSlug()

	const { data: created, error } = await createProject({
		supabase,
		data: {
			account_id: accountId,
			name: defaultName,
			description: null,
			status: "planning",
		},
	})

	if (error || !created) {
		consola.error("Auto-create project failed:", error)
		// Fall back to manual form if auto-create fails
		return {}
	}

	// Persist last-used pointers for better resume UX
	await supabase
		.from("user_settings")
		.update({ last_used_account_id: accountId, last_used_project_id: created.id })
		.eq("user_id", user.sub)

	const projectRoutes = createProjectRoutes(accountId, created.id)
	throw redirect(projectRoutes.projects.setup())
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

		return redirect(projectRoutes.projects.setup())
	} catch (error) {
		consola.error("Error creating project:", error)
		return { error: "Failed to create project" }
	}
}

export default function NewProject() {
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-7xl">
			<div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8">
				<div className="mx-auto max-w-2xl">
					<div className="mb-6 sm:mb-8">
						<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">New Project</h1>
						{/* <p className="mt-2 text-gray-600">Create a new project</p> */}
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
			</div>
		</div>
	)
}
