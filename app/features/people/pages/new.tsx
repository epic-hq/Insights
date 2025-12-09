import consola from "consola"
import { useId } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Button } from "~/components/ui/button"
import { ImageUploader } from "~/components/ui/ImageUploader"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { createPerson } from "~/features/people/db"
import { getPersonas } from "~/features/personas/db"
import { userContext } from "~/server/user-context"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction = () => {
	return [{ title: "New Person | Insights" }, { name: "description", content: "Create a new person" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}
	const [{ data: personas }] = await Promise.all([getPersonas({ supabase, accountId, projectId })])
	return { personas: personas || [] }
}

export async function action({ request, context, params }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId
	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}
	const routes = createProjectRoutes(accountId, projectId)

	const formData = await request.formData()
	const firstname = formData.get("firstname") as string
	const lastname = formData.get("lastname") as string
	const email = formData.get("email") as string
	const title = formData.get("title") as string
	const _segment = formData.get("segment") as string
	const _notes = formData.get("notes") as string
	const image_url = formData.get("image_url") as string
	const _persona_id = formData.get("persona_id") as string

	if (!firstname?.trim()) {
		return { error: "First name is required" }
	}

	// Build contact_info object if email is present
	let contact_info: Record<string, string> | null = null
	if (email?.trim()) {
		contact_info = { email: email.trim() }
	}

	try {
		consola.info("[people/new] Creating person with:", {
			accountId,
			projectId,
			firstname: firstname.trim(),
		})

		const { data, error } = await createPerson({
			supabase: supabase,
			data: {
				firstname: firstname.trim(),
				lastname: lastname?.trim() || null,
				title: title?.trim() || null,
				segment: _segment?.trim() || null,
				description: _notes?.trim() || null,
				image_url: image_url?.trim() || null,
				account_id: accountId,
				project_id: projectId,
				contact_info,
			},
		})

		if (error) {
			consola.error("[people/new] Failed to create person:", error)
			return { error: "Failed to create person" }
		}

		consola.info("[people/new] Created person:", {
			id: data.id,
			project_id: data.project_id,
			firstname: data.firstname,
		})

		// Associate with persona if selected
		if (_persona_id && _persona_id !== "none") {
			const { error: personaError } = await supabase.from("people_personas").upsert(
				{
					person_id: data.id,
					persona_id: _persona_id,
				},
				{ onConflict: "person_id,persona_id" }
			)
			if (personaError) {
				return { error: "Person created, but failed to associate persona" }
			}
		}

		return redirect(routes.people.detail(data.id))
	} catch (_error) {
		return { error: "Failed to create person" }
	}
}

export default function NewPerson() {
	const actionData = useActionData<typeof action>()
	const { personas } = useLoaderData() as {
		personas: { id: string; name: string }[]
	}

	// Generate unique IDs for form fields
	const firstnameId = useId()
	const lastnameId = useId()
	const emailId = useId()
	const titleId = useId()
	const segmentId = useId()
	const personaId = useId()
	const notesId = useId()

	return (
		<PageContainer size="sm" padded={false} className="max-w-2xl px-4 sm:px-6">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-foreground">New Person</h1>
				<p className="mt-2 text-muted-foreground">Create a new person record</p>
			</div>

			<Form method="post" className="space-y-6">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<Label htmlFor={firstnameId}>First Name *</Label>
						<Input
							id={firstnameId}
							name="firstname"
							type="text"
							required
							placeholder="Enter first name"
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor={lastnameId}>Last Name</Label>
						<Input id={lastnameId} name="lastname" type="text" placeholder="Enter last name" className="mt-1" />
					</div>
				</div>

				<div>
					<Label htmlFor={emailId}>Email</Label>
					<Input id={emailId} name="email" type="email" placeholder="Enter email address" className="mt-1" />
				</div>

				<div>
					<Label htmlFor={titleId}>Title</Label>
					<Input
						id={titleId}
						name="title"
						type="text"
						placeholder="e.g., Product Manager, CEO, Engineer"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor={segmentId}>Segment</Label>
					<Input
						id={segmentId}
						name="segment"
						type="text"
						placeholder="e.g., Customer, Prospect, Partner"
						className="mt-1"
					/>
				</div>

				<ImageUploader
					name="image_url"
					category="avatars"
					placeholder="user"
					size="lg"
					circular
					label="Profile Image"
					hint="Upload an image for this person's avatar"
				/>

				<div>
					<Label htmlFor={personaId}>Persona</Label>
					<Select name="persona_id" defaultValue="none">
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select a persona" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">No persona</SelectItem>
							{personas.map((persona) => (
								<SelectItem key={persona.id} value={persona.id}>
									{persona.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div>
					<Label htmlFor={notesId}>Notes</Label>
					<Textarea
						id={notesId}
						name="notes"
						placeholder="Additional notes about this person"
						className="mt-1"
						rows={4}
					/>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Create Person</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</PageContainer>
	)
}
