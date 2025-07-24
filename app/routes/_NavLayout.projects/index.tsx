import { Plus } from "lucide-react"
import type { MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import type { Database } from "~/../supabase/types"
import { Button } from "~/components/ui/button"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = () => {
	return [{ title: "Projects | Research Insights" }, { name: "description", content: "All research projects" }]
}

export async function loader({ request }: { request: Request }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	// Build query with account filtering for RLS
	type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
	const query = supabase
		.from("projects")
		.select("*")
		.eq("account_id", accountId)
		.order("updated_at", { ascending: false })

	const { data: rows, error } = await query
	if (error) {
		throw new Response(`Error fetching projects: ${error.message}`, { status: 500 })
	}

	// Use Supabase types directly like interviews pattern
	const projects: ProjectRow[] = rows || []

	// Calculate stats
	const stats = {
		total: projects.length,
		active: projects.filter((p) => p.status === "active").length,
		completed: projects.filter((p) => p.status === "completed").length,
		draft: projects.filter((p) => p.status === "draft").length,
	}

	return {
		projects,
		stats,
	}
}

export default function Projects() {
	const { projects, stats } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Research Projects</h1>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					New Project
				</Button>
			</div>

			{/* Stats Cards */}
			<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<p className="text-gray-500 text-sm dark:text-gray-400">Total Projects</p>
					<p className="font-bold text-2xl">{stats.total}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<p className="text-gray-500 text-sm dark:text-gray-400">Active</p>
					<p className="font-bold text-2xl">{stats.active}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<p className="text-gray-500 text-sm dark:text-gray-400">Completed</p>
					<p className="font-bold text-2xl">{stats.completed}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<p className="text-gray-500 text-sm dark:text-gray-400">Draft</p>
					<p className="font-bold text-2xl">{stats.draft}</p>
				</div>
			</div>

			{/* Projects Table */}
			<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-semibold text-xl">All Projects</h2>
					<Link to="/interviews" className="text-blue-600 hover:text-blue-800">
						View interviews
					</Link>
				</div>
				{projects.length > 0 ? (
					<ProjectTable projects={projects} />
				) : (
					<div className="py-12 text-center text-gray-500">
						<p className="text-lg">No projects found</p>
						<p className="mt-2 text-sm">Create your first research project to get started.</p>
					</div>
				)}
			</div>
		</div>
	)
}

function ProjectTable({ projects }: { projects: Database["public"]["Tables"]["research_projects"]["Row"][] }) {
	const getStatusColor = (status: string | null) => {
		switch (status) {
			case "active":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
			case "completed":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
			case "draft":
				return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
		}
	}

	return (
		<div className="overflow-x-auto">
			<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead>
					<tr>
						<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
							Project
						</th>
						<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
							Code
						</th>
						<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
							Status
						</th>
						<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
							Updated
						</th>
						<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
					{projects.map((project) => (
						<tr key={project.id}>
							<td className="px-4 py-3">
								<div>
									<div className="font-medium text-gray-900 dark:text-gray-100">
										{project.title || "Untitled Project"}
									</div>
									{project.description && (
										<div className="text-gray-500 text-sm dark:text-gray-400">
											{project.description.length > 100
												? `${project.description.substring(0, 100)}...`
												: project.description}
										</div>
									)}
								</div>
							</td>
							<td className="whitespace-nowrap px-4 py-3 font-mono text-sm">{project.code || "N/A"}</td>
							<td className="whitespace-nowrap px-4 py-3">
								<span
									className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${getStatusColor(project.status)}`}
								>
									{project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : "Unknown"}
								</span>
							</td>
							<td className="whitespace-nowrap px-4 py-3 text-gray-500 text-sm dark:text-gray-400">
								{new Date(project.updated_at).toLocaleDateString()}
							</td>
							<td className="whitespace-nowrap px-4 py-3">
								<Link to={`/projects/${project.id}`} className="text-blue-600 hover:text-blue-800">
									View
								</Link>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
