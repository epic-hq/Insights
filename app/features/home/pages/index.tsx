import consola from "consola"
import { ArrowRight, Handshake, Hash, House, Mic, Sparkles, Target } from "lucide-react"
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
	const workflowLabel = project.workflow_type === "sales" ? "Sales" : "Research"

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
									<Badge variant="outline" className="h-5 px-2 text-xs">
										{workflowLabel}
									</Badge>
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

	const researchProjects = (projects || []).filter((project) => project.workflow_type !== "sales")
	const salesProjects = (projects || []).filter((project) => project.workflow_type === "sales")

	const navigate = useNavigate()
	const [creatingSales, setCreatingSales] = useState(false)
	const [salesError, setSalesError] = useState<string | null>(null)

	// Lightweight entry point for standalone call analysis.
	function handleOpenConversationAnalyzer() {
		navigate("/conversation-analyzer")
	}

	// Creates a sales-focused project and routes directly to the sales lens view.
	async function handleCreateSalesWorkspace() {
		try {
			setSalesError(null)
			setCreatingSales(true)
			const response = await fetch(`${accountBase}/api/sales/create-workspace`, { method: "POST" })
			const payload = await response.json().catch(() => ({ error: "Failed to create workspace" }))

			if (!response.ok || !payload?.projectId) {
				const message = payload?.error ?? "Unable to create workspace"
				setSalesError(message)
				return
			}

			navigate(`/a/${auth.accountId}/${payload.projectId}/sales-lenses`)
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to create workspace"
			setSalesError(message)
		} finally {
			setCreatingSales(false)
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
			<div className="mb-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
				<Card className="group relative overflow-hidden border-2 transition-all hover:border-blue-500 hover:shadow-lg">
					<CardHeader className="pb-6">
						<CardTitle className="flex flex-row text-2xl">
							<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
								<Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
							</div>
							<div className="px-2 pt-3">Discovery Research</div>
						</CardTitle>
						<CardDescription className="text-base">
							Clarify hypotheses, build interview guides, and orchestrate customer discovery work.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-0">
						<Button asChild size="lg" className="w-full group-hover:bg-blue-600">
							<Link to={`${accountBase}/projects/new`}>
								Start planning
								<ArrowRight className="ml-2 h-5 w-5" />
							</Link>
						</Button>
					</CardContent>
				</Card>

				<Card className="group relative overflow-hidden border-2 transition-all hover:border-green-500 hover:shadow-lg">
					<CardHeader className="pb-4">
						<CardTitle className="flex flex-row text-2xl">
							<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
								<Handshake className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
							</div>
							<div className="px-2 pt-3">Sales Hygiene Workspace</div>
						</CardTitle>
						<CardDescription className="text-base">
							Map MEDDIC/BANT data, draft MAPs, and coach revenue teams on CRM completeness.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3 pt-0">
						{salesError && <p className="text-destructive text-sm">{salesError}</p>}
						<Button
							size="lg"
							className="w-full bg-emerald-600 hover:bg-emerald-700 group-hover:bg-emerald-700"
							onClick={handleCreateSalesWorkspace}
							disabled={creatingSales}
						>
							{creatingSales ? "Creating…" : "Launch sales workspace"}
							<ArrowRight className="ml-2 h-5 w-5" />
						</Button>
					</CardContent>
				</Card>

				<Card className="group relative overflow-hidden border-2 transition-all hover:border-purple-500 hover:shadow-lg">
					<CardHeader className="pb-6">
						<CardTitle className="flex flex-row text-2xl">
							<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/20">
								<Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400" />
							</div>
							<div className="px-2 pt-3">Conversation Analyzer</div>
						</CardTitle>
						<CardDescription className="text-base">
							Upload a recording and get extracted questions, buyer goals, and ready-to-send follow-ups.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-0">
						<Button
							size="lg"
							className="w-full bg-purple-600 hover:bg-purple-700 group-hover:bg-purple-700"
							onClick={handleOpenConversationAnalyzer}
						>
							Analyze a conversation
							<Mic className="ml-2 h-5 w-5" />
						</Button>
					</CardContent>
				</Card>
			</div>

			{/* Existing Projects Section */}

			<div className="space-y-8">
				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="font-semibold text-2xl">Discovery projects</h2>
							<p className="hidden text-muted-foreground text-sm md:block">
								Continue refining your research programs and interview guides.
							</p>
						</div>
						{researchProjects.length > 4 && (
							<Button variant="outline" asChild>
								<Link to={`${accountBase}/projects`}>
									View all
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						)}
					</div>
					{researchProjects.length ? (
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
							{researchProjects.slice(0, 4).map((project) => {
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
					) : (
						<p className="text-muted-foreground text-sm">
							No discovery projects yet. Start one above to capture interviews.
						</p>
					)}
				</section>

				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="font-semibold text-2xl">Sales workspaces</h2>
							<p className="hidden text-muted-foreground text-sm md:block">
								Track stakeholder hygiene, objections, and MAPs across your deals.
							</p>
						</div>
					</div>
					{salesProjects.length ? (
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
							{salesProjects.slice(0, 4).map((project) => {
								const projectSections = latest_sections.filter((section) => section.project_id === project.id)
								return (
									<CompactProjectCard
										key={project.id}
										project={project}
										projectPath={`${accountBase}/${project.id}/sales-lenses`}
										sections={projectSections}
									/>
								)
							})}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							Launch a sales workspace to see MEDDIC coverage and draft MAPs automatically.
						</p>
					)}
				</section>
			</div>
		</div>
	)
}
