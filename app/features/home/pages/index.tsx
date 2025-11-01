import consola from "consola"
import { ArrowRight, Handshake, Hash, House } from "lucide-react"
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

	const navigate = useNavigate()
	const [creatingSales, setCreatingSales] = useState(false)
	const [salesError, setSalesError] = useState<string | null>(null)
	const posthog = usePostHog()

	// Check PostHog feature flag for Sales CRM
	const [salesCrmEnabled, setSalesCrmEnabled] = useState(false)
	const [salesCrmLoading, setSalesCrmLoading] = useState(true)

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
		<div className="mx-auto w-full max-w-7xl px-6 py-8">
			<div className="mb-4 flex items-center gap-2">
				<House className="h-6 w-6" />
				<div className="flex items-center gap-2">
					{currentAccount?.name && <span className="font-medium text-xl">{currentAccount.name}</span>}
					{currentAccount?.slug && (
						<Badge variant="secondary" className="h-6 px-2 text-xs">
							<Hash className="mr-1 h-3 w-3" />
							{currentAccount.slug}
						</Badge>
					)}
				</div>
			</div>

			{/* Main Action Cards */}
			<div className="mb-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
				{salesCrmLoading
					? null
					: salesCrmEnabled &&
					!salesWorkspace?.project && (
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
					)}
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
						<div className="flex flex-wrap items-center gap-2">
							{manageFacetsPath ? (
								<Button variant="ghost" asChild>
									<Link to={manageFacetsPath}>Manage facets</Link>
								</Button>
							) : null}
							<Button variant="outline" asChild>
								<Link to={`${accountBase}/projects/new`}>New Project</Link>
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
						<p className="text-muted-foreground text-sm">
							No discovery projects yet. Start one above to capture interviews.
						</p>
					)}
				</section>

				{salesCrmEnabled && (
					<section className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="font-semibold text-2xl">Sales workspace</h2>
								<p className="hidden text-muted-foreground text-sm md:block">
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
								<Button onClick={handleCreateSalesWorkspace} disabled={creatingSales}>
									{creatingSales ? "Creating…" : "Launch sales workspace"}
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
							<p className="text-muted-foreground text-sm">
								Launch a sales workspace to see MEDDIC coverage and draft MAPs automatically.
							</p>
						)}
					</section>
				)}
			</div>
		</div>
	)
}
