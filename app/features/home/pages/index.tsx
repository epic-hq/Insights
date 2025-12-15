import consola from "consola"
import { Hash, Plus } from "lucide-react"
import { Link, type LoaderFunctionArgs, redirect, useLoaderData, useParams, useRouteLoaderData } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { getProjects } from "~/features/projects/db"
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
	if (!supabase || !account_id) {
		consola.error("home loader database or account_id not found")
		return redirect("/login")
	}

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
								<div className="flex flex-col items-end gap-1">
									{project.status && (
										<Badge variant="secondary" className="h-5 px-1.5 text-xs">
											{project.status}
										</Badge>
									)}
								</div>
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
	const params = useParams()
	const accountId = params.accountId as string

	const { accounts } = useRouteLoaderData("routes/_ProtectedLayout") as {
		accounts?: Array<{ account_id: string; name?: string; slug?: string }>
	}

	const currentAccount = accounts?.find((acc) => acc.account_id === accountId)
	const accountBase = `/a/${accountId}`

	// Call hook once at top level for the first project (we'll use it as a template)
	// and create routes dynamically as needed

	return (
		<div className="min-h-screen bg-background">
			<PageContainer className="space-y-10 py-12">
				<section className="text-center">
					<h1 className="font-semibold text-3xl text-foreground">{currentAccount?.name || "Your Research Hub"}</h1>
				</section>

				<section className="space-y-4">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<h2 className="font-semibold text-2xl text-foreground">Projects</h2>
							<p className="text-muted-foreground text-sm">
								Plan, execute, and analyze conversations to drive better insights and outcomes.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button variant="default" asChild>
								<Link to={`${accountBase}/projects/new`}>
									<Plus className="mr-2 h-4 w-4" />
									New Project
								</Link>
							</Button>
						</div>
					</div>
					{projects.length ? (
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
							{projects.slice(0, 4).map((project) => {
								const projectSections = latest_sections.filter((section) => section.project_id === project.id)
								return (
									<CompactProjectCard
										key={project.id}
										project={project}
										projectPath={`${accountBase}/${project.id}/dashboard`}
										sections={projectSections}
									/>
								)
							})}
						</div>
					) : (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
								<div>
									<h3 className="font-semibold text-foreground text-lg">No projects yet</h3>
									<p className="text-muted-foreground text-sm">
										Kick off your first project to start capturing interviews.
									</p>
								</div>
								<Button variant="secondary" asChild>
									<Link to={`${accountBase}/projects/new`}>
										<Plus className="mr-2 h-4 w-4" />
										Create project
									</Link>
								</Button>
							</CardContent>
						</Card>
					)}
				</section>
			</PageContainer>
		</div>
	)
}
