import { type MetaFunction, useLoaderData, useSearchParams } from "react-router"
import { Link } from "react-router-dom"
import { Button } from "~/components/ui/button"
import EnhancedPersonaCard from "~/features/personas/components/EnhancedPersonaCard"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = () => {
	return [
		{ title: "Personas | Insights" },
		{ name: "description", content: "User personas based on research insights" },
	]
}

export async function loader({ request }: { request: Request }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	// Fetch personas with related people data
	const { data: personas, error: personasError } = await supabase
		.from("personas")
		.select(`
			*,
			people_personas(
				people(
					id,
					name,
					segment
				)
			)
		`)
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })

	if (personasError) {
		throw new Response(`Error fetching personas: ${personasError.message}`, { status: 500 })
	}

	// Note: calculation method functionality removed for simplified persona display

	return { personas: personas || [] }
}

export default function Personas() {
	const { personas } = useLoaderData<typeof loader>()
	const [, setSearchParams] = useSearchParams()

	const _handleMethodChange = (method: "participant" | "segment") => {
		setSearchParams((prev: URLSearchParams) => {
			const newParams = new URLSearchParams(prev)
			newParams.set("method", method)
			return newParams
		})
	}

	return (
		<div className="mx-auto max-w-7xl px-4 py-6">
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-3xl text-gray-900">Personas</h1>
				</div>
				<Button asChild>
					<Link to="/personas/new">Add Persona</Link>
				</Button>
			</div>

			<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{personas.map((persona) => (
					<EnhancedPersonaCard key={persona.id} persona={persona} />
				))}
			</div>
		</div>
	)
}
