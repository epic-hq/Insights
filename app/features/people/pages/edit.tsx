import { Loader2, Trash2 } from "lucide-react"
import { useMemo } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { deletePerson, getPersonById, updatePerson } from "~/features/people/db"
import { getPersonas } from "~/features/personas/db"
import { getFacetCatalog } from "~/lib/database/facets.server"
import { userContext } from "~/server/user-context"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `Edit ${data?.person?.name || "Person"} | Insights` },
		{ name: "description", content: "Edit person details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const personId = params.personId

	if (!accountId || !projectId || !personId) {
		throw new Response("Account ID, Project ID, and Person ID are required", { status: 400 })
	}

	try {
		const [person, { data: personas }, catalog] = await Promise.all([
			getPersonById({
				supabase,
				accountId,
				projectId,
				id: personId,
			}),
			getPersonas({ supabase, accountId, projectId }),
			getFacetCatalog({ db: supabase, accountId, projectId }),
		])

		if (!person) {
			throw new Response("Person not found", { status: 404 })
		}

		return { person, personas: personas || [], catalog }
	} catch {
		throw new Response("Failed to load person", { status: 500 })
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const personId = params.personId
	if (!accountId || !projectId || !personId) {
		throw new Response("Account ID, Project ID, and Person ID are required", { status: 400 })
	}
	const routes = createProjectRoutes(accountId, projectId)

	const formData = await request.formData()
	const intent = formData.get("intent") as string

	if (intent === "delete") {
		try {
			await deletePerson({
				supabase,
				id: personId,
				accountId,
				projectId,
			})

			return redirect(routes.people.index())
		} catch {
			return { error: "Failed to delete person" }
		}
	}

	// Handle update
	const name = formData.get("name") as string
	const description = formData.get("description") as string
	const segment = formData.get("segment") as string
	const image_url = formData.get("image_url") as string
	const personaId = formData.get("persona_id") as string
	const selectedFacetRefs = formData
		.getAll("facetRefs")
		.map((value) => value.toString())
		.filter((value) => value.trim().length)
	const newFacetKind = formData.get("newFacetKind")?.toString().trim() ?? ""
	const newFacetLabel = formData.get("newFacetLabel")?.toString().trim() ?? ""
	const newFacetSynonyms = formData.get("newFacetSynonyms")?.toString().trim() ?? ""
	const newFacetNotes = formData.get("newFacetNotes")?.toString().trim() ?? ""

	if (!name?.trim()) {
		return { error: "Name is required" }
	}

	try {
		// Update person basic info (no longer includes persona field)
		const data = await updatePerson({
			supabase,
			id: personId,
			accountId,
			projectId,
			data: {
				name: name.trim(),
				description: description?.trim() || null,
				segment: segment?.trim() || null,
				image_url: image_url?.trim() || null,
			},
		})

		if (!data) {
			return { error: "Failed to update person" }
		}

		// Handle persona assignment via junction table
		if (personaId && personaId !== "none") {
			await supabase.from("people_personas").upsert(
				{
					person_id: personId,
					persona_id: personaId,
				},
				{ onConflict: "person_id,persona_id" }
			)
		} else {
			// Remove all persona assignments if "none" is selected
			await supabase.from("people_personas").delete().eq("person_id", personId)
		}

		// Synchronize facet assignments
		const { data: existingFacetRows, error: existingFacetError } = await supabase
			.from("person_facet")
			.select("facet_ref")
			.eq("person_id", personId)
			.eq("project_id", projectId)
		if (existingFacetError) {
			return { error: `Failed to load existing facets: ${existingFacetError.message}` }
		}
		const existingRefs = new Set((existingFacetRows ?? []).map((row) => row.facet_ref))
		const desiredRefs = new Set(selectedFacetRefs)
		const toInsert = selectedFacetRefs.filter((ref) => !existingRefs.has(ref))
		const toRemove = Array.from(existingRefs).filter((ref) => !desiredRefs.has(ref))

		if (toInsert.length) {
			const insertPayload = toInsert.map((facetRef) => ({
				account_id: accountId,
				project_id: projectId,
				person_id: personId,
				facet_ref: facetRef,
				source: "manual",
				confidence: 0.8,
			}))
			const { error: insertError } = await supabase
				.from("person_facet")
				.upsert(insertPayload, { onConflict: "person_id,facet_ref" })
			if (insertError) {
				return { error: `Failed to add facets: ${insertError.message}` }
			}
		}

		if (toRemove.length) {
			const { error: deleteError } = await supabase
				.from("person_facet")
				.delete()
				.eq("person_id", personId)
				.eq("project_id", projectId)
				.in("facet_ref", toRemove)
			if (deleteError) {
				return { error: `Failed to remove facets: ${deleteError.message}` }
			}
		}

		if (newFacetKind && newFacetLabel) {
			const synonyms = newFacetSynonyms
				.split(",")
				.map((value) => value.trim())
				.filter(Boolean)
			const candidatePayload = {
				account_id: accountId,
				project_id: projectId,
				person_id: personId,
				kind_slug: newFacetKind,
				label: newFacetLabel,
				synonyms: synonyms.length ? synonyms : null,
				notes: newFacetNotes || null,
				source: "manual" as const,
				status: "pending" as const,
			}
			const { error: candidateError } = await supabase.from("facet_candidate").upsert(candidatePayload, {
				onConflict: "account_id,project_id,kind_slug,label",
			})
			if (candidateError) {
				return { error: `Failed to create facet candidate: ${candidateError.message}` }
			}
		}

		return redirect(routes.people.detail(data.id))
	} catch (error) {
		// Log error for debugging without using console
		if (typeof window !== "undefined") {
			const globalWindow = window as typeof window & { debugError?: unknown }
			globalWindow.debugError = error
		}
		return { error: "Failed to update person" }
	}
}

export default function EditPerson() {
	const { person, personas, catalog } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()

	const isSubmitting = navigation.state === "submitting"
	const isDeleting = navigation.state === "submitting" && navigation.formData?.get("intent") === "delete"

	// Get current persona from junction table
	const people_personas = person.people_personas || []
	const currentPersona = people_personas.length > 0 ? people_personas[0].personas : null
	const selectedFacetRefs = useMemo(
		() => (person.person_facet ?? []).map((facet) => facet.facet_ref),
		[person.person_facet]
	)
	const totalFacetOptions = catalog.facets.length

	return (
		<PageContainer size="sm" padded={false} className="max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-foreground">Edit Person</h1>
			</div>

			<Form method="post" className="space-y-6">
				<div>
					<Label htmlFor="name">Name *</Label>
					<Input
						id="name"
						name="name"
						type="text"
						required
						defaultValue={person.name || ""}
						placeholder="Enter person's name"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="image_url">Profile Image URL</Label>
					<Input
						id="image_url"
						name="image_url"
						type="url"
						defaultValue={person.image_url || ""}
						placeholder="https://example.com/avatar.jpg"
						className="mt-1"
					/>
					<p className="mt-1 text-muted-foreground text-xs">Direct image URL shown as the person's avatar.</p>
				</div>

				<div>
					<Label htmlFor="persona_id">Persona</Label>
					<Select name="persona_id" defaultValue={currentPersona?.id || "none"}>
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
					<Label htmlFor="segment">Segment</Label>
					<Input
						id="segment"
						name="segment"
						type="text"
						defaultValue={person.segment || ""}
						placeholder="e.g., Customer, Prospect, Partner"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						defaultValue={person.description || ""}
						placeholder="Additional notes about this person"
						className="mt-1"
						rows={4}
					/>
				</div>

				<div>
					<Label htmlFor="facetRefs">Facets</Label>
					<select
						id="facetRefs"
						name="facetRefs"
						multiple
						size={Math.min(10, Math.max(4, totalFacetOptions))}
						defaultValue={selectedFacetRefs}
						className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						{catalog.kinds.map((kind) => {
							const options = catalog.facets.filter((facet) => facet.kind_slug === kind.slug)
							if (!options.length) return null
							return (
								<optgroup key={kind.slug} label={kind.label}>
									{options.map((facet) => (
										<option key={facet.facet_ref} value={facet.facet_ref}>
											{facet.alias || facet.label}
										</option>
									))}
								</optgroup>
							)
						})}
					</select>
					<p className="mt-1 text-muted-foreground text-xs">
						Select one or more facets to associate with this person. Hold Cmd/Ctrl to select multiple entries.
					</p>
				</div>

				<div className="rounded-lg border border-muted-foreground/40 border-dashed p-4">
					<h3 className="font-medium text-sm">Suggest New Facet</h3>
					<p className="mt-1 text-muted-foreground text-xs">
						Can't find the right facet? Add a candidate and it will appear in the review queue.
					</p>
					<div className="mt-4 grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="newFacetKind">Facet Kind</Label>
							<select
								id="newFacetKind"
								name="newFacetKind"
								defaultValue=""
								className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							>
								<option value="">Select kind</option>
								{catalog.kinds.map((kind) => (
									<option key={kind.slug} value={kind.slug}>
										{kind.label}
									</option>
								))}
							</select>
						</div>
						<div>
							<Label htmlFor="newFacetLabel">Facet Label</Label>
							<Input
								id="newFacetLabel"
								name="newFacetLabel"
								placeholder="e.g., Prefers async updates"
								className="mt-1"
							/>
						</div>
					</div>
					<div className="mt-3 grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="newFacetSynonyms">Synonyms</Label>
							<Input id="newFacetSynonyms" name="newFacetSynonyms" placeholder="Comma separated" className="mt-1" />
						</div>
						<div>
							<Label htmlFor="newFacetNotes">Notes</Label>
							<Input id="newFacetNotes" name="newFacetNotes" placeholder="Optional context" className="mt-1" />
						</div>
					</div>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && !isDeleting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Updating...
							</>
						) : (
							"Update Person"
						)}
					</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()} disabled={isSubmitting}>
						Cancel
					</Button>
				</div>
			</Form>

			<div className="mt-12 border-t pt-8">
				<div className="rounded-lg border border-red-200 bg-red-50 p-4">
					<h3 className="mb-2 font-medium text-red-900">Danger Zone</h3>
					<p className="mb-4 text-red-700 text-sm">
						Deleting this person will permanently remove them and all associated data. This action cannot be undone.
					</p>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="destructive" size="sm" className="gap-2" disabled={isSubmitting}>
								<Trash2 className="h-4 w-4" />
								Delete Person
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
								<AlertDialogDescription>
									This action cannot be undone. This will permanently delete "{person.name}" and remove all associated
									data from our servers.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
								<Form method="post">
									<input type="hidden" name="intent" value="delete" />
									<AlertDialogAction
										type="submit"
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										disabled={isDeleting}
									>
										{isDeleting ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Deleting...
											</>
										) : (
											"Delete Person"
										)}
									</AlertDialogAction>
								</Form>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
		</PageContainer>
	)
}
