import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { deleteProject, getProjectById, updateProject } from "~/features/projects/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `Edit ${data?.project?.name || "Project"} | Insights` },
		{ name: "description", content: "Edit project details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { id } = params

	if (!id) {
		throw new Response("Project ID is required", { status: 400 })
	}

	try {
		const { data: project, error } = await getProjectById({
			supabase,
			accountId,
			id,
		})

		if (error || !project) {
			throw new Response("Project not found", { status: 404 })
		}

		return { project }
	} catch (error) {
		console.error("Error loading project:", error)
		throw new Response("Failed to load project", { status: 500 })
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { id } = params

	if (!id) {
		throw new Response("Project ID is required", { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get("intent") as string

	if (intent === "delete") {
		try {
			const { error } = await deleteProject({
				supabase,
				id,
				accountId,
			})

			if (error) {
				console.error("Error deleting project:", error)
				return { error: "Failed to delete project" }
			}

			return redirect("/projects")
		} catch (error) {
			console.error("Error deleting project:", error)
			return { error: "Failed to delete project" }
		}
	}

	// Handle update
	const name = formData.get("name") as string
	const description = formData.get("description") as string
	const status = formData.get("status") as string
	const startDate = formData.get("start_date") as string
	const endDate = formData.get("end_date") as string

	if (!name?.trim()) {
		return { error: "Name is required" }
	}

	try {
		const { data, error } = await updateProject({
			supabase,
			id,
			accountId,
			data: {
				name: name.trim(),
				description: description?.trim() || null,
				status: status || "planning",
				start_date: startDate || null,
				end_date: endDate || null,
			},
		})

		if (error) {
			console.error("Error updating project:", error)
			return { error: "Failed to update project" }
		}

		return redirect(`/projects/${data.id}`)
	} catch (error) {
		console.error("Error updating project:", error)
		return { error: "Failed to update project" }
	}
}

export default function EditProject() {
	const { project } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900">Edit Project</h1>
				<p className="mt-2 text-gray-600">Update project details</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="name">Name *</Label>
					<Input
						id="name"
						name="name"
						type="text"
						required
						defaultValue={project.name || ""}
						placeholder="Enter project name"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						defaultValue={project.description || ""}
						placeholder="Enter project description"
						className="mt-1"
						rows={4}
					/>
				</div>

				<div>
					<Label htmlFor="status">Status</Label>
					<Select name="status" defaultValue={project.status || "planning"}>
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

				<div>
					<Label htmlFor="start_date">Start Date</Label>
					<Input
						id="start_date"
						name="start_date"
						type="date"
						defaultValue={project.start_date || ""}
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="end_date">End Date</Label>
					<Input
						id="end_date"
						name="end_date"
						type="date"
						defaultValue={project.end_date || ""}
						className="mt-1"
					/>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-sm text-red-700">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Update Project</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>

			<div className="mt-12 border-t pt-8">
				<h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
				<p className="mt-2 text-sm text-gray-600">
					Permanently delete this project. This action cannot be undone.
				</p>
				<Form method="post" className="mt-4">
					<input type="hidden" name="intent" value="delete" />
					<Button
						type="submit"
						variant="destructive"
						onClick={(e) => {
							if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
								e.preventDefault()
							}
						}}
					>
						Delete Project
					</Button>
				</Form>
			</div>
		</div>
	)
}
