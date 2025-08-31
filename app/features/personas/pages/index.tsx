import consola from "consola"
import { Sparkle, Users } from "lucide-react"
import { useEffect } from "react"
import { type MetaFunction, useLoaderData, useSearchParams } from "react-router"
// GeneratePersonasButton component
import { Link, useFetcher } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import EnhancedPersonaCard from "~/features/personas/components/EnhancedPersonaCard"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = () => {
	return [
		{ title: "Personas | Insights" },
		{ name: "description", content: "User personas based on research insights" },
	]
}

export async function loader({ request, params }: { request: Request; params: { projectId: string } }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	const projectId = params.projectId

	consola.log("Account ID:", accountId)
	// Fetch personas with people count
	const { data: personas, error: personasError } = await supabase
		.from("personas")
		.select(`
			*,
			people_personas(count)
		`)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })

	if (personasError) {
		throw new Response(`Error fetching personas: ${personasError.message}`, { status: 500 })
	}

	// Note: calculation method functionality removed for simplified persona display
	consola.log("load personas: ", personas, projectId)
	return { personas: personas || [] }
}

export default function Personas() {
	const { personas } = useLoaderData<typeof loader>()
	const [, setSearchParams] = useSearchParams()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const _handleMethodChange = (method: "participant" | "segment") => {
		setSearchParams((prev: URLSearchParams) => {
			const newParams = new URLSearchParams(prev)
			newParams.set("method", method)
			return newParams
		})
	}

	return (
		<div className="relative min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Compact Subnav */}
			<PersonaPeopleSubnav />

			{/* Clean Header - Metro Style */}
			<div className="border-gray-200 border-b bg-white px-6 py-8 dark:border-gray-800 dark:bg-gray-950">
				<div className="mx-auto max-w-6xl">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h1 className="font-light text-3xl text-gray-900 tracking-tight dark:text-white">User Personas</h1>
							<p className="mt-2 text-gray-600 text-lg dark:text-gray-400">
								Research-based user archetypes and behavioral patterns
							</p>
						</div>
						<div className="flex flex-wrap gap-3">
							<GeneratePersonasButton />
							<Button asChild variant="outline" className="border-gray-300 dark:border-gray-600">
								<Link to={routes.personas.new()}>Add Persona</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="mx-auto max-w-6xl px-6 py-8">
				{personas.length === 0 ? (
					<div className="py-8 text-center">
						<div className="mx-auto max-w-md">
							<div className="mb-6 flex justify-center">
								<div className="rounded-full bg-gray-100 p-6 dark:bg-gray-800">
									<Users className="h-12 w-12 text-gray-400 dark:text-gray-500" />
								</div>
							</div>
							<h3 className="mb-3 font-semibold text-gray-900 text-xl dark:text-white">No personas yet</h3>
							<p className="mb-8 text-gray-600 dark:text-gray-400">
								Generate personas from your research data or create them manually to understand your users better.
							</p>
							<div className="flex justify-center gap-3">
								<GeneratePersonasButton />
								<Button asChild variant="outline">
									<Link to={routes.personas.new()}>Create Manually</Link>
								</Button>
							</div>
						</div>
					</div>
				) : (
					<div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
						{personas.map((persona) => (
							<EnhancedPersonaCard key={persona.id} persona={persona} />
						))}
					</div>
				)}
			</div>
		</div>
	)
}

function GeneratePersonasButton() {
	const fetcher = useFetcher()
	const isGenerating = fetcher.state === "submitting" || fetcher.state === "loading"

	useEffect(() => {
		if (fetcher.data?.success) {
			window.location.reload()
		}
	}, [fetcher.data])

	return (
		<fetcher.Form method="post" action="api/generate-personas">
			<Button type="submit" variant="secondary" disabled={isGenerating}>
				<Sparkle className="mr-2 h-4 w-4" />
				{isGenerating ? "Generating..." : "Generate Personas"}
			</Button>
		</fetcher.Form>
	)
}
