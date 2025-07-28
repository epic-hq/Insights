// biome-ignore assist/source/organizeImports: <explanation>
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router-dom"
import { Form, useLoaderData, useNavigation } from "react-router-dom"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/../supabase/types"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"

export async function loader({ request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	if (!accountId) throw new Response("Unauthorized", { status: 401 })

	// fetch personas for picker
	const { data: personas, error } = await supabase
		.from("personas")
		.select("id, name")
		.eq("account_id", accountId)
		.order("name")
	if (error) throw new Response(`Error loading personas: ${error.message}`, { status: 500 })
	return { personas }
}

type PersonInsert = Database["public"]["Tables"]["people"]["Insert"]

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const name = (formData.get("name") as string)?.trim()
	if (!name) return { error: "Name is required" }
	const segment = (formData.get("segment") as string) || null
	const description = (formData.get("description") as string) || null
	const contact_info = (formData.get("contact_info") as string) || null
	const personaId = (formData.get("personaId") as string) || null

	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	if (!accountId) throw new Response("Unauthorized", { status: 401 })

	const payload: PersonInsert = {
		id: crypto.randomUUID(),
		account_id: accountId,
		name,
		segment,
		description,
		contact_info,
	}
	const { data: person, error: personError } = await supabase.from("people").insert(payload).select().single()
	if (personError) throw new Response(`Error creating person: ${personError.message}`, { status: 500 })

	// optionally link persona
	if (personaId) {
		await supabase.from("people_personas").upsert({
			person_id: person.id,
			persona_id: personaId,
			source: "manual",
		})
	}
	return redirect(`/people/${person.id}`)
}

export default function NewPerson() {
	const { personas } = useLoaderData() as { personas: { id: string; name: string }[] }
	const nav = useNavigation()
	return (
		<div className="mx-auto w-full max-w-xl p-8">
			<h1 className="mb-6 font-bold text-2xl">Add Person</h1>
			<Form method="post" className="space-y-4">
				<Input name="name" placeholder="Name" required />
				<Input name="segment" placeholder="Segment" />
				<Textarea name="description" placeholder="Description" rows={4} />
				<Input name="contact_info" placeholder="Contact Info" />
				<Select name="personaId">
					<SelectTrigger>
						<SelectValue placeholder="Select persona (optional)" />
					</SelectTrigger>
					<SelectContent>
						{personas.map((p) => (
							<SelectItem key={p.id} value={p.id}>
								{p.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button type="submit" disabled={nav.state === "submitting"}>
					Create
				</Button>
			</Form>
		</div>
	)
}
