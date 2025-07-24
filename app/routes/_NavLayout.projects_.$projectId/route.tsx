import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import type { Database } from "~/../supabase/types"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Project ${params.projectId || ""} | Insights` },
		{ name: "description", content: "Research project details and interviews" },
	]
}

export async function loader({ request, params }: { request: Request; params: { projectId: string } }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	const projectId = params.projectId

	// Fetch project data from database with account filtering for RLS
	const { data: projectData, error: projectError } = await supabase
		.from("projects")
		.select("*")
		.eq("id", projectId)
		.eq("account_id", accountId)
		.single()

	if (projectError) {
		throw new Response(`Error fetching project: ${projectError.message}`, { status: 500 })
	}

	if (!projectData) {
		throw new Response("Project not found", { status: 404 })
	}

	// Use Supabase types directly like interviews pattern
	type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
	const project: ProjectRow = projectData

	// Fetch interviews related to this project
	const { data: interviewsData, error: interviewsError } = await supabase
		.from("interviews")
		.select("*")
		.eq("project_id", projectId)
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })

	if (interviewsError) {
		throw new Response(`Error fetching interviews: ${interviewsError.message}`, { status: 500 })
	}

	// Fetch insights from interviews in this project
	const { data: insightsData, error: insightsError } = await supabase
		.from("insights")
		.select("*")
		.eq("account_id", accountId)
		.in(
			"interview_id",
			(interviewsData || []).map((i) => i.id)
		)

	if (insightsError) {
		throw new Response(`Error fetching insights: ${insightsError.message}`, { status: 500 })
	}

	// Get related projects (same account, different project)
	const { data: relatedProjects } = await supabase
		.from("projects")
		.select("id, title, status, updated_at")
		.eq("account_id", accountId)
		.neq("id", projectId)
		.limit(5)

	return {
		project,
		interviews: interviewsData || [],
		insights: insightsData || [],
		relatedProjects: relatedProjects || [],
	}
}

export default function ProjectDetail() {
	const { project, interviews, insights, relatedProjects } = useLoaderData<typeof loader>()

	if (!project) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-center">
					<h1 className="mb-2 font-bold text-2xl text-gray-900">Project Not Found</h1>
					<p className="text-gray-600">The project you're looking for doesn't exist or has been removed.</p>
				</div>
			</div>
		)
	}

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
		<div className="mx-auto max-w-7xl px-4 py-6">
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
				<div className="lg:col-span-3">
					{/* Project Header */}
					<div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
						<div className="mb-4 flex items-start justify-between">
							<div className="flex-1">
								<h1 className="font-bold text-3xl text-gray-900">{project.title || "Untitled Project"}</h1>
								{project.code && <p className="mt-1 font-mono text-gray-500 text-sm">{project.code}</p>}
							</div>
							<span
								className={`inline-flex items-center rounded-full px-3 py-1 font-medium text-sm ${getStatusColor(project.status)}`}
							>
								{project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : "Unknown"}
							</span>
						</div>

						{project.description && (
							<div className="mb-4">
								<h3 className="mb-2 font-medium text-gray-900">Description</h3>
								<p className="text-gray-700 leading-relaxed">{project.description}</p>
							</div>
						)}

						<div className="flex items-center gap-6 text-gray-500 text-sm">
							<div>
								<span className="font-medium">Created:</span> {new Date(project.created_at).toLocaleDateString()}
							</div>
							<div>
								<span className="font-medium">Updated:</span> {new Date(project.updated_at).toLocaleDateString()}
							</div>
						</div>
					</div>

					{/* Stats Cards */}
					<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
						<div className="rounded-lg bg-white p-4 shadow-sm">
							<p className="text-gray-500 text-sm">Total Interviews</p>
							<p className="font-bold text-2xl">{interviews.length}</p>
						</div>
						<div className="rounded-lg bg-white p-4 shadow-sm">
							<p className="text-gray-500 text-sm">Total Insights</p>
							<p className="font-bold text-2xl">{insights.length}</p>
						</div>
						<div className="rounded-lg bg-white p-4 shadow-sm">
							<p className="text-gray-500 text-sm">Avg. Insights per Interview</p>
							<p className="font-bold text-2xl">
								{interviews.length > 0 ? (insights.length / interviews.length).toFixed(1) : "0"}
							</p>
						</div>
					</div>

					{/* Interviews Section */}
					<div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
						<h2 className="mb-4 font-semibold text-xl">Interviews</h2>
						{interviews.length > 0 ? (
							<div className="space-y-3">
								{interviews.map((interview) => (
									<div
										key={interview.id}
										className="flex items-center justify-between rounded border bg-gray-50 p-3 transition hover:bg-gray-100"
									>
										<div>
											<Link to={`/interviews/${interview.id}`} className="font-medium text-gray-900">
												{interview.title || "Untitled Interview"}
											</Link>
											{interview.participant_pseudonym && (
												<span className="ml-2 text-blue-700">{interview.participant_pseudonym}</span>
											)}
											{interview.interview_date && (
												<span className="ml-2 text-gray-500">
													{new Date(interview.interview_date).toLocaleDateString()}
												</span>
											)}
										</div>
										<Link to={`/interviews/${interview.id}`} className="text-blue-600 text-sm hover:underline">
											View
										</Link>
									</div>
								))}
							</div>
						) : (
							<div className="py-8 text-center text-gray-500">
								<p>No interviews found for this project.</p>
								<p className="mt-1 text-sm">Upload your first interview to get started.</p>
							</div>
						)}
					</div>

					{/* Recent Insights Section */}
					{insights.length > 0 && (
						<div className="rounded-lg bg-white p-6 shadow-sm">
							<div className="mb-4 flex items-center justify-between">
								<h2 className="font-semibold text-xl">Recent Insights</h2>
								<Link to="/insights" className="text-blue-600 text-sm hover:text-blue-800">
									View all insights
								</Link>
							</div>
							<div className="space-y-3">
								{insights.slice(0, 5).map((insight) => (
									<div key={insight.id} className="rounded border bg-gray-50 p-3">
										<Link to={`/insights/${insight.id}`} className="font-medium text-gray-900">
											{insight.name || "Untitled Insight"}
										</Link>
										<div className="mt-1 text-gray-600 text-sm">
											{insight.category && <span className="mr-2">Category: {insight.category}</span>}
											{insight.impact && <span>Impact: {insight.impact}</span>}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Sidebar with Related Projects */}
				<aside className="space-y-4">
					<div className="rounded-lg bg-white p-4 shadow-sm">
						<h2 className="mb-3 font-semibold text-lg">Related Projects</h2>
						{relatedProjects.length > 0 ? (
							<ul className="space-y-2">
								{relatedProjects.map((related) => (
									<li key={related.id} className="rounded border bg-gray-50 p-2 transition hover:bg-gray-100">
										<Link to={`/projects/${related.id}`} className="font-medium text-gray-900 text-sm">
											{related.title || "Untitled"}
										</Link>
										<div className="mt-1 flex items-center justify-between text-xs">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${getStatusColor(related.status)}`}
											>
												{related.status ? related.status.charAt(0).toUpperCase() + related.status.slice(1) : "Unknown"}
											</span>
											<span className="text-gray-500">{new Date(related.updated_at).toLocaleDateString()}</span>
										</div>
									</li>
								))}
							</ul>
						) : (
							<div className="text-gray-400 text-sm italic">No related projects found.</div>
						)}
					</div>
				</aside>
			</div>
		</div>
	)
}
