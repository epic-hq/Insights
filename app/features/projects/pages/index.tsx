import consola from "consola"
import { ExternalLink, Globe, HelpCircle, MessageSquare, MessageSquareText } from "lucide-react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, useRouteLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
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
		throw new Response(`Error loading projects: ${error.message}`, {
			status: 500,
		})
	}

	// Fetch additional counts for each project in parallel
	const projectIds = (projects || []).map((p) => p.id)

	// Get questions count (interview_prompts) and responses count (survey_response + public_chat interviews) per project
	const [promptsResult, responsesResult] = await Promise.all([
		// Count interview_prompts per project
		supabase
			.from("interview_prompts")
			.select("project_id")
			.in("project_id", projectIds),
		// Count interviews that are responses (survey or chat)
		supabase
			.from("interviews")
			.select("project_id, source_type")
			.in("project_id", projectIds)
			.in("source_type", ["survey_response", "public_chat"]),
	])

	// Build count maps
	const questionsCountMap = new Map<string, number>()
	;(promptsResult.data || []).forEach((prompt) => {
		const count = questionsCountMap.get(prompt.project_id) || 0
		questionsCountMap.set(prompt.project_id, count + 1)
	})

	const responsesCountMap = new Map<string, number>()
	;(responsesResult.data || []).forEach((interview) => {
		if (!interview.project_id) return
		const count = responsesCountMap.get(interview.project_id) || 0
		responsesCountMap.set(interview.project_id, count + 1)
	})

	// Enrich projects with counts
	const enrichedProjects = (projects || []).map((project) => ({
		...project,
		questionsCount: questionsCountMap.get(project.id) || 0,
		responsesCount: responsesCountMap.get(project.id) || 0,
	}))

	consola.log("🚀 PROJECTS LOADER SUCCESS - returning projects:", enrichedProjects?.length || 0)
	return { projects: enrichedProjects, accountId }
}

export default function ProjectsIndexPage() {
	const { projects, accountId } = useLoaderData<typeof loader>()
	// Demo code to access current project context
	const currentProjectContext = useCurrentProject()
	const { accounts } = useRouteLoaderData("routes/_ProtectedLayout")
	const routes = useProjectRoutes(currentProjectContext?.projectPath || "")

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

	// Build project-specific route helper
	const getProjectRoutes = (projectId: string) => {
		const projectPath = `/a/${accountId}/${projectId}`
		return {
			interviews: (type?: string) => (type ? `${projectPath}/interviews?type=${type}` : `${projectPath}/interviews`),
			dashboard: () => `${projectPath}`,
		}
	}

	return (
		<TooltipProvider>
			<div className="space-y-6 px-6 py-8">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-bold text-3xl tracking-tight">My Projects</h1>
						<p className="mt-1 text-muted-foreground">Manage your research projects and collect feedback</p>
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
						{projects.map((project) => {
							const projectRoutes = getProjectRoutes(project.id)
							const hasPublicUrl = project.is_public && project.public_slug

							return (
								<Card key={project.id} className="transition-shadow hover:shadow-md">
									<CardHeader className="pb-3">
										<div className="flex items-start justify-between gap-2">
											<CardTitle className="text-lg">
												<Link to={projectRoutes.dashboard()} className="hover:underline">
													{project.name}
												</Link>
											</CardTitle>
											<div className="flex items-center gap-1.5">
												{hasPublicUrl && (
													<Tooltip>
														<TooltipTrigger asChild>
															<Badge
																variant="outline"
																className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
															>
																<Globe className="h-3 w-3" />
																Live
															</Badge>
														</TooltipTrigger>
														<TooltipContent>
															<p>Public URL active: /r/{project.public_slug}</p>
														</TooltipContent>
													</Tooltip>
												)}
												<Badge className={getStatusColor(project.status || "")}>{project.status}</Badge>
											</div>
										</div>
										{project.description && (
											<CardDescription className="line-clamp-2">{project.description}</CardDescription>
										)}
									</CardHeader>
									<CardContent className="space-y-3">
										{/* Stats row */}
										<div className="flex items-center gap-4 text-sm">
											<Tooltip>
												<TooltipTrigger asChild>
													<div className="flex items-center gap-1.5 text-muted-foreground">
														<HelpCircle className="h-4 w-4" />
														<span className="font-medium">{project.questionsCount}</span>
														<span>questions</span>
													</div>
												</TooltipTrigger>
												<TooltipContent>
													<p>Interview prompts configured for this project</p>
												</TooltipContent>
											</Tooltip>

											{project.responsesCount > 0 && (
												<Link
													to={projectRoutes.interviews("responses")}
													className="flex items-center gap-1.5 text-purple-600 transition-colors hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
												>
													<MessageSquareText className="h-4 w-4" />
													<span className="font-medium">{project.responsesCount}</span>
													<span>responses</span>
												</Link>
											)}
										</div>

										{/* Public URL if enabled */}
										{hasPublicUrl && (
											<div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
												<Globe className="h-4 w-4 text-muted-foreground" />
												<code className="flex-1 text-xs">/r/{project.public_slug}</code>
												<Tooltip>
													<TooltipTrigger asChild>
														<a
															href={`/r/${project.public_slug}`}
															target="_blank"
															rel="noopener noreferrer"
															className="text-muted-foreground transition-colors hover:text-foreground"
														>
															<ExternalLink className="h-4 w-4" />
														</a>
													</TooltipTrigger>
													<TooltipContent>Open public survey</TooltipContent>
												</Tooltip>
											</div>
										)}

										<div className="border-t pt-2 text-muted-foreground text-xs">
											Created {new Date(project.created_at).toLocaleDateString()}
										</div>
									</CardContent>
								</Card>
							)
						})}
					</div>
				)}
			</div>
		</TooltipProvider>
	)
}
