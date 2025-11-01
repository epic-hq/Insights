import consola from "consola"
import { ArrowRight, BarChart3, FolderOpen, Handshake, Hash, House, Plus, Settings, Target, Users } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useEffect, useState } from "react"
import {
	Link,
	type LoaderFunctionArgs,
	redirect,
	useLoaderData,
	useNavigate,
	useParams,
	useRouteLoaderData,
} from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { getProjects } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
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

	let salesWorkspace: {
		project: Project
		kpis: { organizations: number; people: number; opportunities: number }
	} | null = null

	const salesProjects = (projects || []).filter((project) => project.workflow_type === "sales")

	if (salesProjects.length > 0) {
		const primarySalesProject = salesProjects[0]
		try {
			consola.log("[HOME] Sales workspace KPI queries starting", {
				account_id,
				primarySalesProjectId: primarySalesProject.id,
			})

			const [organizationsResult, peopleResult, opportunitiesResult] = await Promise.all([
				supabase.from("organizations").select("id", { count: "exact", head: true }).eq("account_id", account_id),
				supabase.from("people").select("id", { count: "exact", head: true }).eq("account_id", account_id),
				supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("account_id", account_id),
			])

			consola.log("[HOME] Sales workspace KPI query results", {
				organizationsResult: { count: organizationsResult.count, error: organizationsResult.error },
				peopleResult: { count: peopleResult.count, error: peopleResult.error },
				opportunitiesResult: { count: opportunitiesResult.count, error: opportunitiesResult.error },
			})

			if (organizationsResult.error || peopleResult.error || opportunitiesResult.error) {
				consola.warn("[HOME] Sales KPI query errors", {
					organizationsError: organizationsResult.error?.message,
					peopleError: peopleResult.error?.message,
					opportunitiesError: opportunitiesResult.error?.message,
				})
			}

			const organizations = organizationsResult.count ?? 0
			const people = peopleResult.count ?? 0
			const opportunities = opportunitiesResult.count ?? 0

			consola.log("[HOME] Sales workspace KPI counts", {
				account_id,
				organizations,
				people,
				opportunities,
			})

			salesWorkspace = {
				project: primarySalesProject,
				kpis: { organizations, people, opportunities },
			}
		} catch (error) {
			consola.warn("[HOME] Failed to load sales workspace KPIs", error)
			salesWorkspace = {
				project: primarySalesProject,
				kpis: { organizations: 0, people: 0, opportunities: 0 },
			}
		}
	}

	return {
		projects: projects || [],
		latest_sections: latest_sections || [],
		salesWorkspace,
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
	const { projects, latest_sections, salesWorkspace } = useLoaderData<typeof loader>()
	const params = useParams()
	const accountId = params.accountId as string

	const { accounts } = useRouteLoaderData("routes/_ProtectedLayout") as {
		accounts?: Array<{ account_id: string; name?: string; slug?: string }>
	}

	const currentAccount = accounts?.find((acc) => acc.account_id === accountId)
	const accountBase = `/a/${accountId}`

	const researchProjects = (projects || []).filter((project) => project.workflow_type !== "sales")
	const primaryResearchProject = researchProjects[0] ?? null
	const primaryProjectPath = primaryResearchProject ? `${accountBase}/${primaryResearchProject.id}` : ""
	const primaryProjectRoutes = useProjectRoutes(primaryProjectPath)
	const manageFacetsPath = primaryResearchProject ? primaryProjectRoutes.facets() : null

	const totalProjects = projects?.length ?? 0
	const totalResearchProjects = researchProjects.length
	const latestInterviewSections = latest_sections.filter((section) => section.kind === "interview").length
	const salesWorkspaceActive = Boolean(salesWorkspace?.project)

	const navigate = useNavigate()
	const [creatingSales, setCreatingSales] = useState(false)
	const [salesError, setSalesError] = useState<string | null>(null)
	const posthog = usePostHog()

	// Check PostHog feature flag for Sales CRM
	const [salesCrmEnabled, setSalesCrmEnabled] = useState(false)
	const [salesCrmLoading, setSalesCrmLoading] = useState(true)

	// Computed values that depend on state
	const isSalesCtaDisabled = salesCrmLoading || (!salesWorkspaceActive && !salesCrmEnabled)
	const salesCtaLabel = salesCrmLoading
		? "Checking access…"
		: salesWorkspaceActive
			? "Open sales workspace"
			: salesCrmEnabled
				? creatingSales
					? "Creating…"
					: "Launch sales workspace"
				: "Sales workspace coming soon"

	useEffect(() => {
		if (!posthog) {
			setSalesCrmLoading(false)
			return
		}

		// Wait for flags to be loaded
		posthog.onFeatureFlags(() => {
			const flagValue = posthog.isFeatureEnabled("ffSalesCRM")
			setSalesCrmEnabled(flagValue || false)
			setSalesCrmLoading(false)
		})
	}, [posthog])

	const salesProject = salesWorkspace?.project ?? null
	const salesProjectColor = salesProject != null ? stringToColor(salesProject.slug || salesProject.name || "S") : null
	const salesProjectInitials =
		salesProject != null
			? (salesProject.slug || salesProject.name || "S")
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2)
			: ""

	// Use the route helper for consistent path construction
	const salesRoutes = useProjectRoutes(salesProject ? `${accountBase}/${salesProject.id}` : "")
	const salesBase = salesProject ? salesRoutes.salesBase() : null

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

			navigate(`/a/${accountId}/${payload.projectId}/sales-lenses`)
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to create workspace"
			setSalesError(message)
		} finally {
			setCreatingSales(false)
		}
	}

	return (
		<div className="min-h-screen bg-slate-50">
			<PageContainer className="space-y-10 py-12">
				<section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 shadow-xl">
					<div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle at top left, rgba(255,255,255,0.2), transparent 45%)" }} />
					<div className="relative flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
						<div className="space-y-4">
							<div className="flex items-center gap-3 text-slate-300">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/70">
									<House className="h-5 w-5" />
								</div>
								<div className="space-y-1">
									<p className="text-slate-300/80 text-xs uppercase tracking-wider">Workspace</p>
									<h1 className="font-semibold text-2xl text-white lg:text-3xl">
										{currentAccount?.name || "Your Research Hub"}
									</h1>
									{currentAccount?.slug && (
										<Badge variant="secondary" className="bg-white/10 text-white text-xs">
											<Hash className="mr-1 h-3 w-3" />
											{currentAccount.slug}
										</Badge>
									)}
								</div>
							</div>
							<p className="max-w-2xl text-slate-200/80 text-sm">
								Plan interviews, surface insights, and keep teams aligned on where to focus next. Start a new project or revisit the research that matters most right now.
							</p>
							<div className="flex flex-wrap gap-3">
								<Button size="sm" variant="secondary" asChild className="bg-white text-slate-900 hover:bg-slate-100">
									<Link to={`${accountBase}/projects/new`}>
										<Plus className="mr-2 h-4 w-4" />New Project
									</Link>
								</Button>
								{manageFacetsPath ? (
									<Button size="sm" variant="outline" asChild className="border-white/30 text-white hover:bg-white/10">
										<Link to={manageFacetsPath}>
											<Settings className="mr-2 h-4 w-4" />Manage facets
										</Link>
									</Button>
								) : null}
								<Button
									variant="ghost"
									size="sm"
									onClick={handleCreateSalesWorkspace}
									disabled={isSalesCtaDisabled}
									className="text-white hover:bg-white/10"
								>
									<Handshake className="mr-2 h-4 w-4" />
									{salesCtaLabel}
								</Button>
							</div>
						</div>
						<div className="relative grid gap-4 rounded-2xl bg-white/5 p-5 text-slate-100 text-sm md:grid-cols-2">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
									<FolderOpen className="h-5 w-5" />
								</div>
								<div>
									<p className="text-white/70 text-xs uppercase tracking-wide">Active projects</p>
									<p className="font-semibold text-xl">{totalResearchProjects}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
									<Users className="h-5 w-5" />
								</div>
								<div>
									<p className="text-white/70 text-xs uppercase tracking-wide">Interview sections</p>
									<p className="font-semibold text-xl">{latestInterviewSections}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
									<Target className="h-5 w-5" />
								</div>
								<div>
									<p className="text-white/70 text-xs uppercase tracking-wide">Total initiatives</p>
									<p className="font-semibold text-xl">{totalProjects}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
									<BarChart3 className="h-5 w-5" />
								</div>
								<div>
									<p className="text-white/70 text-xs uppercase tracking-wide">Sales workspace</p>
									<p className="font-semibold text-xl">{salesWorkspaceActive ? "Active" : salesCrmEnabled ? "Available" : "Beta"}</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section className="space-y-4">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<h2 className="font-semibold text-2xl text-foreground">Discovery projects</h2>
							<p className="text-muted-foreground text-sm">
								Plan, execute, and analyze conversations to drive better insights and outcomes.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button variant="default" asChild>
								<Link to={`${accountBase}/projects/new`}>
									<Plus className="mr-2 h-4 w-4" />New Project
								</Link>
							</Button>
						</div>
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
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
								<div>
									<h3 className="font-semibold text-foreground text-lg">No discovery projects yet</h3>
									<p className="text-muted-foreground text-sm">
										Kick off your first project to start capturing interviews.
									</p>
								</div>
								<Button variant="secondary" asChild>
									<Link to={`${accountBase}/projects/new`}>
										<Plus className="mr-2 h-4 w-4" />Create project
									</Link>
								</Button>
							</CardContent>
						</Card>
					)}
				</section>

				{salesCrmEnabled && (
					<section className="space-y-4">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<h2 className="font-semibold text-2xl text-foreground">Sales workspace</h2>
								<p className="text-muted-foreground text-sm">
									Monitor CRM hygiene and MAP progress at a glance.
								</p>
							</div>
							{salesWorkspace?.project ? (
								<Button asChild>
									<Link to={`${accountBase}/${salesWorkspace.project.id}/sales-lenses`}>
										Open workspace
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							) : (
								<Button onClick={handleCreateSalesWorkspace} disabled={isSalesCtaDisabled}>
									{salesCtaLabel}
								</Button>
							)}
						</div>
						{salesWorkspace?.project ? (
							<Card>
								<CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
									<Link to={`${salesBase!}/sales-lenses`} className="flex flex-1 items-center gap-3">
										<Avatar
											className="h-12 w-12 border"
											style={salesProjectColor ? { borderColor: salesProjectColor } : undefined}
										>
											<AvatarFallback
												className="font-semibold text-base text-white"
												style={salesProjectColor ? { backgroundColor: salesProjectColor } : undefined}
											>
												{salesProjectInitials}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0">
											<h3 className="truncate font-semibold text-lg">{salesProject?.name}</h3>
											{salesProject?.slug && (
												<div className="flex items-center gap-1 text-muted-foreground text-xs">
													<Hash className="h-3 w-3" />
													{salesProject.slug}
												</div>
											)}
											{salesProject?.status && (
												<Badge variant="secondary" className="mt-2 h-5 w-fit px-2 text-xs">
													{salesProject.status}
												</Badge>
											)}
										</div>
									</Link>
									<div className="flex flex-wrap gap-3">
										<Link to={`${salesBase!}/organizations`} className="inline-flex">
											<Badge variant="outline" className="px-3 py-1.5 text-sm">
												{salesWorkspace.kpis.organizations} Organizations
											</Badge>
										</Link>
										<Link to={`${salesBase!}/people`} className="inline-flex">
											<Badge variant="outline" className="px-3 py-1.5 text-sm">
												{salesWorkspace.kpis.people} People
											</Badge>
										</Link>
										<Link to={`${salesBase!}/opportunities`} className="inline-flex">
											<Badge variant="outline" className="px-3 py-1.5 text-sm">
												{salesWorkspace.kpis.opportunities} Opportunities
											</Badge>
										</Link>
									</div>
								</CardContent>
							</Card>
						) : (
							<Card className="border-dashed">
								<CardContent className="space-y-3 p-6 text-muted-foreground text-sm">
									<p>Launch a sales workspace to see MEDDIC coverage and draft MAPs automatically.</p>
									{salesError && <p className="text-destructive">{salesError}</p>}
								</CardContent>
							</Card>
						)}
					</section>
				)}
			</PageContainer>
		</div>
	)
}
