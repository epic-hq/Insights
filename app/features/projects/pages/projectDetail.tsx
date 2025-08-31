import consola from "consola"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { FlowDiagram } from "~/features/projects/components/Flow"
import { getProjectById } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.project?.name || "Project"} | Insights` },
		{ name: "description", content: "Project details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// From URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const { projectId } = params

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	try {
		const { data: project, error } = await getProjectById({
			supabase,
			id: projectId,
		})

		if (error || !project) {
			throw new Response("Project not found", { status: 404 })
		}

		return { project }
	} catch (error) {
		consola.error("Error loading project:", error)
		throw new Response("Failed to load project", { status: 500 })
	}
}

export default function ProjectDetail() {
	const { project } = useLoaderData<typeof loader>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const getStatusColor = (status: string) => {
		switch (status) {
			case "completed":
				return "bg-green-100 text-green-800"
			case "active":
				return "bg-blue-100 text-blue-800"
			case "planning":
				return "bg-yellow-100 text-yellow-800"
			case "on_hold":
				return "bg-gray-100 text-gray-800"
			case "cancelled":
				return "bg-red-100 text-red-800"
			default:
				return "bg-gray-100 text-gray-800"
		}
	}

	const people = project.project_people ?? []
	const personas = project.project_personas ?? []

	return (
		<div className="mx-auto max-w-4xl">
			<div className="mb-12 flex items-start justify-between">
				<div className="flex-1">
					<h1 className="mb-3 font-light text-4xl text-gray-900 tracking-tight">{project.name}</h1>
					<div className="flex items-center gap-3">
						{project.status && (
							<Badge className={getStatusColor(project.status)}>{project.status.replace("_", " ")}</Badge>
						)}
					</div>
				</div>
				<div className="flex gap-3">
					<Button asChild variant="outline" className="border-gray-300 hover:border-gray-400">
						<Link to={routes.projects.edit(project.id)}>Edit Project</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-12 lg:grid-cols-3">
				<div className="space-y-8">
					{/* Research Flow */}
					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
						<h2 className="mb-6 text-center font-light text-2xl text-gray-900">Research Flow</h2>
						<FlowDiagram
							counts={{
								questionsTotal: 12,
								questionsAnswered: 8,
								inputs: 15,
								evidence: 45,
								quotes: 28,
								people: people.length,
								personas: personas.length,
								themes: 8,
								insights: 12,
								opportunities: 6,
							}}
							labels={{
								researchGoals: "Key questions to answer",
								inputs: "Interviews & conversations",
								evidence: "Organized findings",
								personasThemes: "Patterns & archetypes",
								insights: "Key learnings",
								opportunities: "Action items",
							}}
							compact={true}
							onNodeClick={(_id) => {
								// Navigate to relevant section based on node clicked
								// TODO: Implement navigation to specific sections
							}}
						/>
					</div>
				</div>

				<div className="space-y-8 lg:col-span-2">
					<div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
						<div className="mb-6 flex items-center justify-between">
							<h2 className="font-light text-2xl text-gray-900">Description</h2>
							<Button asChild variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
								<Link to={routes.projects.edit(project.id)}>Edit</Link>
							</Button>
						</div>
						{project.description ? (
							<p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{project.description}</p>
						) : (
							<p className="text-gray-400 italic">No description provided</p>
						)}
					</div>

					{people.length > 0 && (
						<div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
							<h2 className="mb-6 font-light text-2xl text-gray-900">Team Members</h2>
							<div className="space-y-3">
								{people.map((projectPerson) => (
									<div key={projectPerson.people.id} className="border-blue-500 border-l-4 pl-4">
										<Link
											to={routes.people.detail(projectPerson.people.id)}
											className="font-medium text-blue-600 hover:text-blue-800"
										>
											{projectPerson.people.name}
										</Link>
										{projectPerson.people.segment && (
											<Badge variant="secondary" className="ml-2">
												{projectPerson.people.segment}
											</Badge>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{personas.length > 0 && (
						<div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
							<h2 className="mb-6 font-light text-2xl text-gray-900">Target Personas</h2>
							<div className="space-y-3">
								{personas.map((projectPersona) => (
									<div key={projectPersona.personas.id} className="border-green-500 border-l-4 pl-4">
										<Link
											to={routes.personas.detail(projectPersona.personas.id)}
											className="font-medium text-blue-600 hover:text-blue-800"
										>
											{projectPersona.personas.name}
										</Link>
										<Badge
											className="ml-2 text-white"
											style={{ backgroundColor: projectPersona.personas.color_hex || "#6B7280" }}
										>
											{projectPersona.personas.name}
										</Badge>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="space-y-6">
					<div className="rounded-lg border bg-white p-6">
						<h3 className="mb-4 font-semibold">Details</h3>
						<div className="space-y-3">
							<div>
								<label className="font-medium text-gray-500 text-sm">Status</label>
								<div className="mt-1">
									<Badge className={getStatusColor(project.status || "")}>
										{project.status?.replace("_", " ") || "Unknown"}
									</Badge>
								</div>
							</div>

							<div>
								<label className="font-medium text-gray-500 text-sm">Created</label>
								<div className="mt-1 text-gray-900 text-sm">{new Date(project.created_at).toLocaleDateString()}</div>
							</div>

							{project.updated_at && (
								<div>
									<label className="font-medium text-gray-500 text-sm">Last Updated</label>
									<div className="mt-1 text-gray-900 text-sm">{new Date(project.updated_at).toLocaleDateString()}</div>
								</div>
							)}
						</div>
					</div>

					<div className="rounded-lg border bg-white p-6">
						<h3 className="mb-4 font-semibold">Statistics</h3>
						<div className="space-y-3">
							<div>
								<label className="font-medium text-gray-500 text-sm">Team Size</label>
								<div className="mt-1 font-bold text-2xl text-gray-900">{people.length}</div>
							</div>

							<div>
								<label className="font-medium text-gray-500 text-sm">Target Personas</label>
								<div className="mt-1 font-bold text-2xl text-gray-900">{personas.length}</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
