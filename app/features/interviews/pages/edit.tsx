import consola from "consola"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { deleteInterview, getInterviewById, updateInterview } from "~/features/interviews/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `Edit ${data?.interview?.title || "Interview"} | Insights` },
		{ name: "description", content: "Edit interview details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const interviewId = params.interviewId

	if (!accountId || !projectId || !interviewId) {
		throw new Response("Account ID, Project ID, and Interview ID are required", { status: 400 })
	}

	try {
		const { data: interview, error } = await getInterviewById({
			supabase,
			accountId,
			projectId,
			id: interviewId,
		})

		if (error || !interview) {
			throw new Response("Interview not found", { status: 404 })
		}

		return { interview }
	} catch (_error) {
		throw new Response("Failed to load interview", { status: 500 })
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const interviewId = params.interviewId

	if (!accountId || !projectId || !interviewId) {
		throw new Response("Account ID, Project ID, and Interview ID are required", { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get("intent") as string

	if (intent === "delete") {
		try {
			const { error } = await deleteInterview({
				supabase,
				id: interviewId,
				accountId,
				projectId,
			})

			if (error) {
				return { error: "Failed to delete interview" }
			}

			return redirect("/interviews")
		} catch (_error) {
			return { error: "Failed to delete interview" }
		}
	}

	// Handle update
	const title = (formData.get("title") as string) || ""

	if (!title.trim()) {
		return { error: "Title is required" }
	}

	// Gather optional fields safely
	const interview_date_raw = formData.get("interview_date") as string | null
	const interview_date = interview_date_raw && interview_date_raw !== "" ? interview_date_raw : null
	const open_questions_and_next_steps = (formData.get("open_questions_and_next_steps") as string) || null
	const observations_and_notes = (formData.get("observations_and_notes") as string) || null
	const media_url = (formData.get("media_url") as string) || null
	
	// Handle high_impact_themes - can be JSON string or regular string
	const high_impact_themes_raw = formData.get("high_impact_themes") as string | null
	let high_impact_themes = null
	if (high_impact_themes_raw) {
		try {
			// Try to parse as JSON array first
			high_impact_themes = JSON.parse(high_impact_themes_raw)
		} catch {
			// If not JSON, treat as regular string
			high_impact_themes = high_impact_themes_raw
		}
	}

	try {
		const { data, error } = await updateInterview({
			supabase,
			id: interviewId,
			accountId,
			projectId,
			data: {
				title: title.trim(),
				interview_date,
				open_questions_and_next_steps,
				observations_and_notes,
				media_url,
				high_impact_themes,
			},
		})

		if (error) {
			return { error: "Failed to update interview" }
		}

		return redirect(`/interviews/${data.id}`)
	} catch (error) {
		consola.error("Error updating interview:", error)
		return { error: "Failed to update interview" }
	}
}

export default function EditInterview() {
	const { interview } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900">Edit Interview</h1>
				<p className="mt-2 text-gray-600">Update interview details</p>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="title">Title *</Label>
					<Input
						id="title"
						name="title"
						type="text"
						required
						defaultValue={interview.title || ""}
						placeholder="Enter interview title"
						className="mt-1"
					/>
				</div>

				{/* <div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						defaultValue={interview.description || ""}
						placeholder="Enter interview description"
						className="mt-1"
						rows={4}
					/>
				</div> */}

				<div>
					<Label htmlFor="interview_date">Interview Date</Label>
					<Input
						id="interview_date"
						name="interview_date"
						type="date"
						defaultValue={interview.interview_date || ""}
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="open_questions_and_next_steps">Open Questions & Next Steps</Label>
					<Textarea
						id="open_questions_and_next_steps"
						name="open_questions_and_next_steps"
						defaultValue={interview.open_questions_and_next_steps || ""}
						placeholder="Enter open questions and next steps"
						className="mt-1"
						rows={4}
					/>
				</div>

				<div>
					<Label htmlFor="observations_and_notes">Observations & Notes</Label>
					<Textarea
						id="observations_and_notes"
						name="observations_and_notes"
						defaultValue={interview.observations_and_notes || ""}
						placeholder="Enter observations and notes"
						className="mt-1"
						rows={4}
					/>
				</div>

				<div>
					<Label htmlFor="media_url">Media URL</Label>
					<Input
						id="media_url"
						name="media_url"
						type="url"
						defaultValue={interview.media_url || ""}
						placeholder="https://..."
						className="mt-1"
					/>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Update Interview</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>

			<div className="mt-12 border-t pt-8">
				<h2 className="font-semibold text-lg text-red-600">Danger Zone</h2>
				<p className="mt-2 text-gray-600 text-sm">Permanently delete this interview. This action cannot be undone.</p>
				<Form method="post" className="mt-4">
					<input type="hidden" name="intent" value="delete" />
					<Button
						type="submit"
						variant="destructive"
						onClick={(e) => {
							if (!confirm("Are you sure you want to delete this interview? This action cannot be undone.")) {
								e.preventDefault()
							}
						}}
					>
						Delete Interview
					</Button>
				</Form>
			</div>
		</div>
	)
}
