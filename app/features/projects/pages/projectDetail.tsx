import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { getProjectById } from "~/features/projects/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.project?.name || "Project"} | Insights` },
		{ name: "description", content: "Project details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { projectId } = params

	if (!projectId) {
		throw new Response("Project ID is required", { status: 400 })
	}

	try {
		const { data: project, error } = await getProjectById({
			supabase,
			accountId,
			id: projectId,
		})

		if (error || !project) {
			throw new Response("Project not found", { status: 404 })
		}

		return { project }
	} catch (error) {
		console.error("Error loading project:", error)
		throw new Response("Failed to load project", { status: 500 })
	}
}

export default function ProjectDetail() {
	const { project } = useLoaderData<typeof loader>()

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

	const people = project.project_people || []
	const personas = project.project_personas || []

	return (
		<div className="mx-auto max-w-4xl">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<div className="mb-2 flex items-center gap-2">
						<Link to="/projects" className="text-blue-600 hover:text-blue-800">
							Projects
						</Link>
						<span className="text-gray-500">/</span>
						<span className="text-gray-900">{project.name}</span>
					</div>
					<h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
					
					<div className="mt-2 flex flex-wrap items-center gap-2">
						{project.status && (
							<Badge className={getStatusColor(project.status)}>
								{project.status.replace("_", " ")}
							</Badge>
						)}
					</div>
				</div>
				<div className="flex gap-2">
					<Button asChild variant="outline">
						<Link to={`/projects/${project.id}/edit`}>Edit</Link>
					</Button>
					<Button asChild variant="outline">
						<Link to="/projects">Back to Projects</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<div className="rounded-lg border bg-white p-6">
						<h2 className="mb-4 text-xl font-semibold">Description</h2>
						{project.description ? (
							<p className="text-gray-700 whitespace-pre-wrap">{project.description}</p>
						) : (
							<p className="text-gray-500 italic">No description provided</p>
						)}
					</div>

					{people.length > 0 && (
						<div className="mt-8 rounded-lg border bg-white p-6">
							<h2 className="mb-4 text-xl font-semibold">Team Members</h2>
							<div className="space-y-3">
								{people.map((projectPerson) => (
									<div key={projectPerson.people.id} className="border-l-4 border-blue-500 pl-4">
										<Link
											to={`/people/${projectPerson.people.id}`}
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
						<div className="mt-8 rounded-lg border bg-white p-6">
							<h2 className="mb-4 text-xl font-semibold">Target Personas</h2>
							<div className="space-y-3">
								{personas.map((projectPersona) => (
									<div key={projectPersona.personas.id} className="border-l-4 border-green-500 pl-4">
										<Link
											to={`/personas/${projectPersona.personas.id}`}
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
								<label className="text-sm font-medium text-gray-500">Status</label>
								<div className="mt-1">
									<Badge className={getStatusColor(project.status || "")}>
										{project.status?.replace("_", " ") || "Unknown"}
									</Badge>
								</div>
							</div>

							{project.start_date && (
								<div>
									<label className="text-sm font-medium text-gray-500">Start Date</label>
									<div className="mt-1 text-sm text-gray-900">
										{new Date(project.start_date).toLocaleDateString()}
									</div>
								</div>
							)}

							{project.end_date && (
								<div>
									<label className="text-sm font-medium text-gray-500">End Date</label>
									<div className="mt-1 text-sm text-gray-900">
										{new Date(project.end_date).toLocaleDateString()}
									</div>
								</div>
							)}

							<div>
								<label className="text-sm font-medium text-gray-500">Created</label>
								<div className="mt-1 text-sm text-gray-900">
									{new Date(project.created_at).toLocaleDateString()}
								</div>
							</div>

							{project.updated_at && (
								<div>
									<label className="text-sm font-medium text-gray-500">Last Updated</label>
									<div className="mt-1 text-sm text-gray-900">
										{new Date(project.updated_at).toLocaleDateString()}
									</div>
								</div>
							)}
						</div>
					</div>

					<div className="rounded-lg border bg-white p-6">
						<h3 className="mb-4 font-semibold">Statistics</h3>
						<div className="space-y-3">
							<div>
								<label className="text-sm font-medium text-gray-500">Team Size</label>
								<div className="mt-1 text-2xl font-bold text-gray-900">{people.length}</div>
							</div>

							<div>
								<label className="text-sm font-medium text-gray-500">Target Personas</label>
								<div className="mt-1 text-2xl font-bold text-gray-900">{personas.length}</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
