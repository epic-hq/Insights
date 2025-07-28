import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { getProjects } from "~/features/projects/db"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = () => {
	return [{ title: "Projects" }, { name: "description", content: "Manage research and product projects" }]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { data: projects, error } = await getProjects({ supabase, accountId })

	if (error) {
		throw new Response("Error loading projects", { status: 500 })
	}

	return { projects: projects || [] }
}

export default function ProjectsIndexPage() {
	const { projects } = useLoaderData<typeof loader>()

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
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Projects</h1>
					<p className="text-muted-foreground">
						Manage research and product development projects.
					</p>
				</div>
				<Button asChild>
					<Link to="/projects/new">Create Project</Link>
				</Button>
			</div>

			{projects.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<h3 className="text-lg font-semibold mb-2">No projects yet</h3>
						<p className="text-muted-foreground mb-4">
							Create your first project to start organizing your research and development work.
						</p>
						<Button asChild>
							<Link to="/projects/new">Create Project</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{projects.map((project) => (
						<Card key={project.id} className="hover:shadow-md transition-shadow">
							<CardHeader>
								<div className="flex items-start justify-between">
									<CardTitle className="text-lg">
										<Link
											to={`/projects/${project.id}`}
											className="hover:underline"
										>
											{project.name}
										</Link>
									</CardTitle>
									<Badge className={getStatusColor(project.status || "")}>
										{project.status}
									</Badge>
								</div>
								<CardDescription className="line-clamp-2">
									{project.description}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{project.start_date && (
										<div className="text-sm">
											<span className="font-medium">Start Date:</span>{" "}
											{new Date(project.start_date).toLocaleDateString()}
										</div>
									)}
									{project.end_date && (
										<div className="text-sm">
											<span className="font-medium">End Date:</span>{" "}
											{new Date(project.end_date).toLocaleDateString()}
										</div>
									)}
									<div className="text-sm text-muted-foreground">
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
