import consola from "consola"
import { ArrowRight, Hash, House, Mic, Target } from "lucide-react"
import { useState } from "react"
import { Link, type LoaderFunctionArgs, redirect, useLoaderData, useNavigate, useRouteLoaderData } from "react-router"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { getProjects } from "~/features/projects/db"
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Project, Project_Section } from "~/types"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	if (!ctx) {
		consola.error("home loader context not found")
		// If middleware didn't populate context (e.g., session not yet visible), send user to login
		return redirect("/login")
	}
	const { supabase, account_id } = ctx // account_id is now team account from middleware
	const user_settings = ctx.user_settings

	// Use account_id from middleware (already resolved to team account)
	consola.log("home loader account_id:", account_id)

	const _signup_completed = user_settings?.signup_data?.completed ?? false
	// if (!signup_completed) {
	// 	consola.log("Signup not completed. Redirecting to signup-chat.")
	// 	return redirect("/signup-chat")
	// }

	// if !onboarding_completed redirect to /onboarding
	// const onboardingCompleted = user_settings?.onboarding_completed ?? false
	// if (!onboardingCompleted) {
	// 	consola.log("Onboarding not completed. Redirecting to onboarding.")
	// 	return redirect("/onboarding")
	// }

	if (!account_id) {
		return {
			projects: [],
			latest_sections: [],
		}
	}
	// TODO make helper for getProjects from user_id
	const { data: projects } = await getProjects({
		supabase,
		accountId: account_id,
	})

	// Don't redirect if no projects - let user choose their path
	// if (!projects || projects.length === 0) {
	// 	throw redirect(`/a/${account_id}/projects/new`)
	// }
	// consola.log("projects:", projects)
	// Get project sections for the current account
	const { data: latest_sections } = await supabase
		.from("project_sections")
		.select("*")
		.in("project_id", projects?.map((project) => project.id) || [])
		.order("position", { ascending: true, nullsFirst: false })
		.order("created_at", { ascending: false })
		.limit(10)

	return {
		projects: projects || [],
		latest_sections: latest_sections || [],
	}
}

// Utility functions
function stringToColor(str: string) {
	let hash = 0
	for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
	const c = (hash & 0x00ffffff).toString(16).toUpperCase()
	return `#${"00000".substring(0, 6 - c.length)}${c}`
}

// Compact Project Card for home page
interface CompactProjectCardProps {
	project: Project
	projectPath: string
	sections: Project_Section[]
}

function CompactProjectCard({ project, projectPath, sections }: CompactProjectCardProps) {
	const themeColor = stringToColor(project.slug || project.name || "P")
	const initials = (project.slug || project.name || "P")
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2)

	const researchGoal = sections.find((s) => s.kind === "research_goal")
	const interviewCount = sections.filter((s) => s.kind === "interview").length

	return (
		<Card className="group cursor-pointer transition-all hover:shadow-md">
			<Link to={projectPath} className="block">
				<CardContent className="p-4">
					<div className="flex items-start gap-3">
						<Avatar className="h-10 w-10 shrink-0 border" style={{ borderColor: themeColor }}>
							<AvatarFallback className="font-medium text-sm text-white" style={{ backgroundColor: themeColor }}>
								{initials}
							</AvatarFallback>
						</Avatar>

						<div className="min-w-0 flex-1">
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<h3 className="truncate font-semibold text-base group-hover:underline" style={{ color: themeColor }}>
										{project.name}
									</h3>
									{project.slug && (
										<div className="flex items-center gap-1 text-muted-foreground text-xs">
											<Hash className="h-3 w-3" />
											{project.slug}
										</div>
									)}
								</div>
								{project.status && (
									<Badge variant="secondary" className="h-5 px-1.5 text-xs">
										{project.status}
									</Badge>
								)}
							</div>

							{researchGoal && (
								<p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
									{researchGoal.content_md?.replace(/[*`_#>-]+/g, " ").trim()}
								</p>
							)}

							<div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
								<span>{sections.length} sections</span>
								{interviewCount > 0 && <span>{interviewCount} interviews</span>}
							</div>
						</div>
					</div>
				</CardContent>
			</Link>
		</Card>
	)
}

export default function Index() {
	const { projects, latest_sections } = useLoaderData<typeof loader>()
	const { auth, user_settings } = useRouteLoaderData("routes/_ProtectedLayout") as {
		auth: { accountId: string }
		user_settings: { last_used_project_id?: string | null }
	}

	// Choose a project: last used if available, else first project
	const lastUsed = user_settings?.last_used_project_id || undefined
	const selectedProjectId = (projects || []).find((p) => p.id === lastUsed)?.id || projects?.[0]?.id || undefined

	const accountBase = `/a/${auth.accountId}`
	const _projectBase = selectedProjectId ? `${accountBase}/${selectedProjectId}` : null
	const _routes = selectedProjectId ? useProjectRoutesFromIds(auth.accountId, selectedProjectId) : null

	const navigate = useNavigate()
	const [creating, setCreating] = useState(false)

	async function handleRecordNow() {
		try {
			setCreating(true)
			const res = await fetch(`${accountBase}/api/interviews/record-now`, { method: "POST" })
			const data = await res.json()
			if (!res.ok) {
				consola.error("Record Now failed:", data?.error)
				return navigate(`${accountBase}/projects/new?from=record`)
			}
			const { projectId, interviewId } = data
			if (projectId && interviewId) {
				return navigate(`/a/${auth.accountId}/${projectId}/interviews/${interviewId}/realtime`)
			}
			navigate(`${accountBase}/projects/new?from=record`)
		} catch (e) {
			consola.error("Record Now error:", e)
			navigate(`${accountBase}/projects/new?from=record`)
		} finally {
			setCreating(false)
		}
	}

	return (
		<div className="mx-auto w-full max-w-7xl px-6 py-8">
			<div className="mb-4 flex items-center gap-2">
				<House className="h-6 w-6" />
				<h1 className="font-semibold text-2xl">Home</h1>
				{/* <p className="text-lg text-muted-foreground">Choose how you'd like to get started with user research</p> */}
			</div>

			{/* Main Action Cards */}
			<div className="mb-12 grid gap-8 md:grid-cols-2">
				{/* Plan New Research Project */}
				<Card className="group relative overflow-hidden border-2 transition-all hover:border-blue-500 hover:shadow-lg">
					<CardHeader className="pb-6">
						<CardTitle className="flex flex-row text-2xl">
							<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
								<Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
							</div>
							<div className="px-2 pt-3">New Research Project</div>
						</CardTitle>
						<CardDescription className="text-base">
							Clarify Goals &gt; Develop Interview Guide &gt; Collect Interviews.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-0">
						<Button asChild size="lg" className="w-full group-hover:bg-blue-600">
							<Link to={`${accountBase}/projects/new`}>
								Start Planning
								<ArrowRight className="ml-2 h-5 w-5" />
							</Link>
						</Button>
					</CardContent>
				</Card>

				{/* Record Now */}
				<Card className="group relative overflow-hidden border-2 transition-all hover:border-red-500 hover:shadow-lg">
					<CardHeader className="pb-6">
						<CardTitle className="flex flex-row text-2xl">
							<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20">
								<Mic className="h-8 w-8 text-red-600 dark:text-red-400" />
							</div>
							<div className="px-2 pt-3">Record Now</div>
						</CardTitle>
						<CardDescription className="text-base">Record Live Now and get Instant Insights.</CardDescription>
					</CardHeader>
					<CardContent className="pt-0">
						<Button
							size="lg"
							className="w-full bg-red-600 hover:bg-red-700 group-hover:bg-red-700"
							onClick={handleRecordNow}
							disabled={creating}
						>
							{creating ? "Starting…" : "Record Now"}
							<Mic className="ml-2 h-5 w-5" />
						</Button>
					</CardContent>
				</Card>
			</div>

			{/* Existing Projects Section */}

			<div className="space-y-3">
				<div className="mb-6 flex items-center justify-between">
					<div>
						<h2 className="font-semibold text-2xl">Existing Projects</h2>
						<p className="hidden text-muted-foreground text-sm md:block">Continue working on your research projects</p>
					</div>
				</div>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{projects.slice(0, 4).map((project) => {
						const projectSections = latest_sections.filter((section) => section.project_id === project.id)
						return (
							<CompactProjectCard
								key={project.id}
								project={project}
								projectPath={`${accountBase}/${project.id}`}
								sections={projectSections}
							/>
						)
					})}
				</div>

				<div className="flex flex-wrap">
					{projects?.length > 4 && (
						<Button variant="outline" asChild>
							<Link to={`${accountBase}/projects`}>
								View All ({projects.length})
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
