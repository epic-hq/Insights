import consola from "consola"
import { useId } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
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
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const { id } = params

	if (!accountId || !id) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	try {
		const { data: project, error } = await getProjectById({
			supabase,
			id,
		})

		if (error || !project) {
			throw new Response("Project not found", { status: 404 })
		}

		return { project }
	} catch (error) {
		consola.error("Error loading project:", error)
		throw new Response("Failed to load project", { status: 500 })
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const { id } = params

	if (!accountId || !id) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
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
				consola.error("Error deleting project:", error)
				return { error: "Failed to delete project" }
			}

			return redirect("/projects")
		} catch (error) {
			consola.error("Error deleting project:", error)
			return { error: "Failed to delete project" }
		}
	}

	// Handle update
	const name = formData.get("name") as string
	const description = formData.get("description") as string
	const status = formData.get("status") as string

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
			},
		})

		if (error) {
			consola.error("Error updating project:", error)
			return { error: "Failed to update project" }
		}

		return redirect(`/projects/${data.id}`)
	} catch (error) {
		consola.error("Error updating project:", error)
		return { error: "Failed to update project" }
	}
}

export default function EditProject() {
	const { project } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const nameId = useId()
	const descriptionId = useId()

	return (
		<PageContainer size="sm" padded={false} className="max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900">Edit Project</h1>
				<p className="mt-2 text-gray-600">Update project details</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor={nameId}>Name *</Label>
					<Input
						id={nameId}
						name="name"
						type="text"
						required
						defaultValue={project.name || ""}
						placeholder="Enter project name"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor={descriptionId}>Description</Label>
					<Textarea
						id={descriptionId}
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

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
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
				<h2 className="font-semibold text-lg text-red-600">Danger Zone</h2>
				<p className="mt-2 text-gray-600 text-sm">Permanently delete this project. This action cannot be undone.</p>
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
		</PageContainer>
	)
}
