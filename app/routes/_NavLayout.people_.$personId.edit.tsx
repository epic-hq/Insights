import {
	type ActionFunctionArgs,
	Form,
	type LoaderFunctionArgs,
	redirect,
	useLoaderData,
	useNavigation,
} from "react-router-dom"
import type { Database } from "~/../supabase/types"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { getServerClient } from "~/lib/supabase/server"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	if (!accountId) throw new Response("Unauthorized", { status: 401 })
	const personId = params.personId as string

	// fetch person with primary persona
	const { data: person, error: personError } = await supabase
		.from("people")
		.select("*, people_personas( persona_id, personas(id,name,color_hex) )")
		.eq("id", personId)
		.eq("account_id", accountId)
		.single()
	if (personError) throw new Response(`Error loading person: ${personError.message}`, { status: 500 })

	const currentPersonaId = person.people_personas?.[0]?.persona_id ?? null

	// fetch personas for picker
	const { data: personas, error } = await supabase
		.from("personas")
		.select("id, name")
		.eq("account_id", accountId)
		.order("name")
	if (error) throw new Response(`Error loading personas: ${error.message}`, { status: 500 })

	return { person, personas, currentPersonaId }
}

type PersonUpdate = Database["public"]["Tables"]["people"]["Update"]

export async function action({ request, params }: ActionFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) throw new Response("Unauthorized", { status: 401 })
	const personId = params.personId as string

	const formData = await request.formData()
	const intent = formData.get("_intent") as string | null

	if (intent === "delete") {
		await supabase.from("people").delete().eq("id", personId).eq("account_id", accountId)
		return redirect("/people")
	}

	const name = (formData.get("name") as string)?.trim()
	if (!name) return json({ error: "Name is required" }, { status: 400 })
	const segment = (formData.get("segment") as string) || null
	const description = (formData.get("description") as string) || null
	const contact_info = (formData.get("contact_info") as string) || null
	const personaId = (formData.get("personaId") as string) || null

	const payload: PersonUpdate = {
		name,
		segment,
		description,
		contact_info,
		updated_at: new Date().toISOString(),
	}

	const { error: updateError } = await supabase
		.from("people")
		.update(payload)
		.eq("id", personId)
		.eq("account_id", accountId)
	if (updateError) throw new Response(`Error updating person: ${updateError.message}`, { status: 500 })

	// manage persona link – clear then add if provided
	await supabase.from("people_personas").delete().eq("person_id", personId)
	if (personaId) {
		await supabase.from("people_personas").upsert({
			person_id: personId,
			persona_id: personaId,
			source: "manual",
		})
	}

	return redirect(`/people/${personId}`)
}

export default function EditPerson() {
	const { person, personas, currentPersonaId } = useLoaderData() as any
	const nav = useNavigation()
	return (
		<div className="mx-auto w-full max-w-xl p-8">
			<h1 className="mb-6 font-bold text-2xl">Edit Person</h1>
			<Form method="post" className="space-y-4">
				<Input name="name" defaultValue={person.name} required />
				<Input name="segment" defaultValue={person.segment ?? ""} placeholder="Segment" />
				<Textarea name="description" defaultValue={person.description ?? ""} rows={4} />
				<Input name="contact_info" defaultValue={person.contact_info ?? ""} placeholder="Contact Info" />
				<Select name="personaId" defaultValue={currentPersonaId ?? undefined}>
					<SelectTrigger>
						<SelectValue placeholder="Select persona" />
					</SelectTrigger>
					<SelectContent>
						{personas.map((p: any) => (
							<SelectItem key={p.id} value={p.id}>
								{p.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="flex gap-2">
					<Button type="submit" disabled={nav.state === "submitting"}>
						Save
					</Button>
					<Button
						variant="destructive"
						name="_intent"
						value="delete"
						type="submit"
						disabled={nav.state === "submitting"}
					>
						Delete
					</Button>
				</div>
			</Form>
		</div>
	)
}
