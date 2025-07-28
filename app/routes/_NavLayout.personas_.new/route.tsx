import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router-dom"
import { Form, useLoaderData, useNavigation } from "react-router-dom"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/../supabase/types"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export async function loader({ request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	if (!accountId) throw new Response("Unauthorized", { status: 401 })

	return { accountId }
}

type PersonaInsert = Database["public"]["Tables"]["personas"]["Insert"]

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const name = (formData.get("name") as string)?.trim()
	if (!name) return { error: "Name is required" }
	
	const description = (formData.get("description") as string) || null
	const color_hex = (formData.get("color_hex") as string) || "#6b7280"

	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	if (!accountId) throw new Response("Unauthorized", { status: 401 })

	const personaData: PersonaInsert = {
		name,
		description,
		color_hex,
		account_id: accountId,
	}

	const { data: persona, error } = await supabase
		.from("personas")
		.insert(personaData)
		.select()
		.single()

	if (error) {
		// Log error for debugging
		return { error: `Failed to create persona: ${error.message}` }
	}

	return redirect(`/personas/${persona.id}`)
}

export default function NewPersona() {
	useLoaderData<typeof loader>()
	const navigation = useNavigation()
	const isSubmitting = navigation.state === "submitting"

	const colorOptions = [
		{ value: "#ef4444", label: "Red", color: "#ef4444" },
		{ value: "#f97316", label: "Orange", color: "#f97316" },
		{ value: "#eab308", label: "Yellow", color: "#eab308" },
		{ value: "#22c55e", label: "Green", color: "#22c55e" },
		{ value: "#3b82f6", label: "Blue", color: "#3b82f6" },
		{ value: "#8b5cf6", label: "Purple", color: "#8b5cf6" },
		{ value: "#ec4899", label: "Pink", color: "#ec4899" },
		{ value: "#6b7280", label: "Gray", color: "#6b7280" },
	]

	return (
		<div className="mx-auto max-w-2xl px-4 py-6">
			<div className="mb-6">
				<h1 className="font-bold text-3xl text-gray-900">Add New Persona</h1>
				<p className="mt-2 text-gray-600">Create a new user persona for your research insights</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Persona Details</CardTitle>
				</CardHeader>
				<CardContent>
					<Form method="post" className="space-y-6">
						<div>
							<label htmlFor="name" className="block font-medium text-gray-700 text-sm">
								Name *
							</label>
							<Input
								id="name"
								name="name"
								type="text"
								required
								placeholder="e.g., Tech-Savvy Professional"
								className="mt-1"
							/>
						</div>

						<div>
							<label htmlFor="description" className="block font-medium text-gray-700 text-sm">
								Description
							</label>
							<Textarea
								id="description"
								name="description"
								placeholder="Describe this persona's characteristics, needs, and behaviors..."
								className="mt-1"
								rows={4}
							/>
						</div>

						<div>
							<label htmlFor="color_hex" className="block font-medium text-gray-700 text-sm">
								Color
							</label>
							<div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
								{colorOptions.map((option) => (
									<label key={option.value} className="cursor-pointer">
										<input
											type="radio"
											name="color_hex"
											value={option.value}
											defaultChecked={option.value === "#6b7280"}
											className="sr-only"
										/>
										<div
											className="h-8 w-8 rounded-full border-2 border-gray-300 transition-all hover:scale-110 hover:border-gray-400"
											style={{ backgroundColor: option.color }}
											title={option.label}
										/>
									</label>
								))}
							</div>
						</div>

						<div className="flex justify-end space-x-3">
							<Button type="button" variant="outline" asChild>
								<a href="/personas">Cancel</a>
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Creating..." : "Create Persona"}
							</Button>
						</div>
					</Form>
				</CardContent>
			</Card>
		</div>
	)
}
