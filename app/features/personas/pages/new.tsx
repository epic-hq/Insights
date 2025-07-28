import { motion } from "framer-motion"
import { type ActionFunctionArgs, type MetaFunction, redirect, useActionData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/types"

type PersonaInsert = Database["public"]["Tables"]["personas"]["Insert"]

export const meta: MetaFunction = () => {
	return [
		{ title: "New Persona | Insights" },
		{ name: "description", content: "Create a new user persona" },
	]
}

export async function loader({ request }: { request: Request }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	return {}
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const name = (formData.get("name") as string)?.trim()
	if (!name) return { error: "Name is required" }

	const description = (formData.get("description") as string) || null
	const color_hex = (formData.get("color_hex") as string) || "#6b7280"
	const image_url = (formData.get("image_url") as string) || null

	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	if (!accountId) throw new Response("Unauthorized", { status: 401 })

	const personaData: PersonaInsert = {
		name,
		description,
		color_hex,
		image_url,
		account_id: accountId,
	}

	const { data: persona, error } = await supabase
		.from("personas")
		.insert(personaData)
		.select()
		.single()

	if (error) {
		return { error: `Failed to create persona: ${error.message}` }
	}

	return redirect(`/personas/${persona.id}`)
}

export default function NewPersona() {
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-2xl px-4 py-6">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<Card>
					<CardHeader>
						<CardTitle className="text-2xl">Create New Persona</CardTitle>
					</CardHeader>
					<CardContent>
						<form method="post" className="space-y-6">
							{actionData?.error && (
								<div className="rounded-md bg-red-50 p-4">
									<div className="text-sm text-red-700">{actionData.error}</div>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="name">Name *</Label>
								<Input
									id="name"
									name="name"
									type="text"
									required
									placeholder="e.g., Tech-Savvy Professional"
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									name="description"
									placeholder="Describe this persona's characteristics, needs, and behaviors..."
									rows={4}
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="image_url">Profile Image URL</Label>
								<Input
									id="image_url"
									name="image_url"
									type="url"
									placeholder="https://example.com/image.jpg"
									className="w-full"
								/>
								<span className="text-xs text-muted-foreground">
									Optional: URL to an image that represents this persona
								</span>
							</div>

							<div className="space-y-2">
								<Label htmlFor="color_hex">Theme Color</Label>
								<div className="flex items-center gap-3">
									<Input
										id="color_hex"
										name="color_hex"
										type="color"
										defaultValue="#6b7280"
										className="h-10 w-20"
									/>
									<span className="text-sm text-muted-foreground">
										Choose a color to represent this persona
									</span>
								</div>
							</div>

							<div className="flex gap-3 pt-4">
								<Button type="submit" className="flex-1">
									Create Persona
								</Button>
								<Button type="button" variant="outline" asChild>
									<a href="/personas">Cancel</a>
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	)
}
