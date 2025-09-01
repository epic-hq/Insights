import consola from "consola"
import { Sparkle, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { type MetaFunction, useLoaderData, useSearchParams } from "react-router"
// GeneratePersonasButton component
import { Link, useFetcher } from "react-router-dom"
import { Button } from "~/components/ui/button"
import NavPageLayout from "~/components/layout/NavPageLayout"
import { useCurrentProject } from "~/contexts/current-project-context"
import EnhancedPersonaCard from "~/features/personas/components/EnhancedPersonaCard"
import PersonaCompareBoard from "~/features/personas/components/PersonaCompareBoard"
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
	const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const _handleMethodChange = (method: "participant" | "segment") => {
		setSearchParams((prev: URLSearchParams) => {
			const newParams = new URLSearchParams(prev)
			newParams.set("method", method)
			return newParams
		})
	}

	// Transform personas data for PersonaCompareBoard
	const transformedPersonas = personas.map(persona => ({
		id: persona.id,
		name: persona.name,
		kind: persona.kind || "core" as const,
		avatarUrl: persona.image_url,
		color: persona.color,
		tags: persona.tags || [],
		goals: persona.goals || [],
		pains: persona.pains || [],
		differentiators: persona.differentiators || [],
		behaviors: persona.behaviors || [],
		roles: persona.roles || [],
		spectra1d: persona.spectra1d || {},
		spectra2d: persona.spectra2d || {},
	}))

	return (
		<NavPageLayout
			title="User Personas"
			description="Research-based user archetypes and behavioral patterns"
			viewMode={viewMode}
			onViewModeChange={setViewMode}
			showViewToggle={personas.length > 0}
			showSubnav={true}
			subnav={<PersonaPeopleSubnav />}
			itemCount={personas.length}
			actionButtons={[
				<GeneratePersonasButton key="generate" />,
			]}
			primaryAction={
				<Button asChild variant="outline" className="border-gray-300 dark:border-gray-600">
					<Link to={routes.personas.new()}>Add Persona</Link>
				</Button>
			}
		>
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
			) : viewMode === "cards" ? (
				<div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
					{personas.map((persona) => (
						<EnhancedPersonaCard key={persona.id} persona={persona} />
					))}
				</div>
			) : (
				<PersonaCompareBoard 
					personas={transformedPersonas}
					visibleFields={["goals", "pains", "differentiators"]}
				/>
			)}
		</NavPageLayout>
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

	const handleGenerate = () => {
		const confirmed = window.confirm(
			"⚠️ This will generate additional personas based on your research data. This feature is experimental and may create duplicate or similar personas. Do you want to proceed?"
		)
		if (confirmed) {
			fetcher.submit({}, { method: "post", action: "api/generate-personas" })
		}
	}

	return (
		<Button 
			onClick={handleGenerate} 
			variant="secondary" 
			disabled={isGenerating}
			type="button"
		>
			<Sparkle className="mr-2 h-4 w-4" />
			{isGenerating ? "Generating..." : "Generate Personas"}
		</Button>
	)
}
