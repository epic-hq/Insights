import consola from "consola"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, useRouteLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getProjects } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "Projects" }, { name: "description", content: "Manage research and product projects" }]
}

export async function loader({ context, request, params }: LoaderFunctionArgs) {
	const user = context.get(userContext)
	const supabase = user.supabase

	// Use accountId from URL - this is the canonical team account ID
	// Best practice for multi-tenant SaaS: account context comes from URL
	const accountId = params.accountId

	consola.log("🚀 PROJECTS LOADER FINAL accountId: ", accountId)
	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { data: projects, error } = await getProjects({ supabase, accountId })

	consola.log("🚀 PROJECTS LOADER DB RESPONSE:", { projects, error })

	if (error) {
		consola.error("🚀 PROJECTS LOADER DB ERROR:", error)
		throw new Response(`Error loading projects: ${error.message}`, { status: 500 })
	}

	consola.log("🚀 PROJECTS LOADER SUCCESS - returning projects:", projects?.length || 0)
	return { projects }
}

export default function ProjectsIndexPage() {
	const { projects } = useLoaderData<typeof loader>()
	// Demo code to access current project context
	const currentProjectContext = useCurrentProject()
	const { accounts } = useRouteLoaderData("routes/_ProtectedLayout")
	const routes = useProjectRoutes(currentProjectContext?.projectPath || "")
	consola.log("projects index page: acct accounts & currentProjectContext:", accounts, currentProjectContext)
	consola.log("projects index page: projects:", projects)

	const getStatusColor = (status: string) => {
		switch (status) {
			case "planning":
				return "bg-blue-100 text-blue-800"
			case "active":
				return "bg-green-100 text-green-800"
			case "on_hold":
				return "bg-yellow-100 text-yellow-800"
			case "completed":
				return "bg-gray-100 text-gray-800"
			case "cancelled":
				return "bg-red-100 text-red-800"
			default:
				return "bg-gray-100 text-gray-800"
		}
	}

	return (
		<div className="space-y-6 px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">My Projects</h1>
					{/* <p className="text-muted-foreground">Group your.</p> */}
				</div>
				<Button asChild>
					<Link to={routes.projects.new()}>Create Project</Link>
				</Button>
			</div>

			{projects.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<h3 className="mb-2 font-semibold text-lg">No projects yet</h3>
						<p className="mb-4 text-muted-foreground">
							Create your first project to start organizing your research and development work.
						</p>
						<Button asChild>
							<Link to={routes.projects.new()}>Create Project</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{projects.map((project) => (
						<Card key={project.id} className="transition-shadow hover:shadow-md">
							<CardHeader>
								<div className="flex items-start justify-between">
									<CardTitle className="text-lg">
										<Link to={routes.projects.dashboard(project.id)} className="hover:underline">
											{project.name}
										</Link>
									</CardTitle>
									<Badge className={getStatusColor(project.status || "")}>{project.status}</Badge>
								</div>
								<CardDescription className="line-clamp-2">{project.description}</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="text-muted-foreground text-sm">
										Created {new Date(project.created_at).toLocaleDateString()}
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
