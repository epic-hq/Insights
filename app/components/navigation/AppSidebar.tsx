// app/components/layout/AppSidebar.tsx
import { Briefcase, Building2, Handshake, HandshakeIcon, SquareCheckBig, Users } from "lucide-react"
import { useMemo } from "react"
import { Link, NavLink, useLocation, useRouteLoaderData } from "react-router-dom"
import { Badge } from "~/components/ui/badge" // ⬅️ for right-aligned counts
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
} from "~/components/ui/sidebar"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useValidationView } from "~/contexts/ValidationViewContext"
import { useCurrentProjectData } from "~/hooks/useCurrentProjectData"
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag"
import { useProjectDataAvailability } from "~/hooks/useProjectDataAvailability"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { useSidebarCounts } from "~/hooks/useSidebarCounts" // ⬅️ counts hook
import { UserProfile } from "../auth/UserProfile"
import { Logo, LogoBrand } from "../branding"
import { APP_SIDEBAR_SECTIONS, APP_SIDEBAR_UTILITY_LINKS } from "./app-sidebar.config"
import { InviteTeamModal } from "./InviteTeamModal"
import { TeamSwitcher } from "./TeamSwitcher"

interface ProjectRecord {
	id: string
	account_id: string
	name?: string | null
	slug?: string | null
	workflow_type?: string | null
}

interface AccountRecord {
	account_id: string
	name?: string | null
	personal_account?: boolean | null
	projects?: ProjectRecord[] | null
}

interface ProtectedLayoutData {
	accounts?: AccountRecord[] | null
	user_settings?: {
		last_used_account_id?: string | null
		last_used_project_id?: string | null
	} | null
}

export function AppSidebar() {
	const { accountId, projectId, projectPath } = useCurrentProject()
	const location = useLocation()
	const { state } = useSidebar()
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null
	const { hasAnalysisData } = useProjectDataAvailability()
	const { isEnabled: icpFeatureEnabled } = usePostHogFeatureFlag("ffICP")
	const { project } = useCurrentProjectData()
	const { showValidationView, setShowValidationView } = useValidationView()
	const { isEnabled: salesCrmEnabled } = usePostHogFeatureFlag("ffSalesCRM")

	const accounts = useMemo(() => {
		if (!protectedData?.accounts) return [] as AccountRecord[]
		return protectedData.accounts.filter(Boolean) as AccountRecord[]
	}, [protectedData?.accounts])

	const fallbackAccount = useMemo(() => {
		if (accountId) {
			return accounts.find((acct) => acct.account_id === accountId) || null
		}
		return accounts[0] || null
	}, [accounts, accountId])

	const fallbackProject = useMemo(() => {
		if (projectId) return { id: projectId }

		const lastUsedProjectId = protectedData?.user_settings?.last_used_project_id
		if (lastUsedProjectId && fallbackAccount?.projects?.length) {
			const lastUsedProject = fallbackAccount.projects.find((p) => p.id === lastUsedProjectId)
			if (lastUsedProject) {
				console.log("[AppSidebar] Using last_used_project_id:", lastUsedProjectId)
				return lastUsedProject
			}
			console.warn("[AppSidebar] last_used_project_id not found in current account projects:", {
				lastUsedProjectId,
				availableProjects: fallbackAccount?.projects?.map((p) => p.id),
			})
		}

		if (fallbackAccount?.projects?.length) {
			console.log("[AppSidebar] Falling back to first project:", fallbackAccount.projects[0].id)
			return fallbackAccount.projects[0] || null
		}
		return null
	}, [fallbackAccount, projectId, protectedData?.user_settings?.last_used_project_id])

	const effectiveAccountId = accountId || fallbackAccount?.account_id || ""
	const effectiveProjectId = fallbackProject?.id || ""

	// Construct proper project path
	const effectiveProjectPath =
		effectiveAccountId && effectiveProjectId ? `/a/${effectiveAccountId}/${effectiveProjectId}` : projectPath || ""

	const routes = useProjectRoutes(effectiveProjectPath)
	const canNavigate = Boolean(effectiveAccountId && effectiveProjectId)
	const isCollapsed = state === "collapsed"
	const salesProject = useMemo(() => {
		const account = (accounts.find((acct) => acct.account_id === effectiveAccountId) ||
			fallbackAccount ||
			null) as AccountRecord | null
		const fromAccounts =
			account?.projects?.find((proj) => (proj as ProjectRecord | null)?.workflow_type === "sales") || null

		if (fromAccounts) {
			return fromAccounts
		}

		if (project?.workflow_type === "sales" && effectiveAccountId && projectId) {
			return {
				id: projectId,
				account_id: effectiveAccountId,
				name: project?.name,
				slug: project?.slug,
				workflow_type: "sales",
			} satisfies ProjectRecord
		}

		return null
	}, [accounts, effectiveAccountId, fallbackAccount, project, projectId])

	const salesProjectBasePath = useMemo(() => {
		if (!salesProject) return null
		const accountIdForSales = salesProject.account_id || effectiveAccountId
		if (!accountIdForSales || !salesProject.id) return null
		return `/a/${accountIdForSales}/${salesProject.id}`
	}, [salesProject, effectiveAccountId])

	const salesRoutes = useProjectRoutes(salesProjectBasePath ?? "")

	// Filter sections based on data availability
	const visibleSections = useMemo(() => {
		return APP_SIDEBAR_SECTIONS.filter((section) => {
			if (section.key === "analyze") {
				return hasAnalysisData
			}
			return true
		})
	}, [hasAnalysisData])

	const salesSection = useMemo(() => {
		if (!salesCrmEnabled || !salesProject || !salesProjectBasePath) {
			return null
		}

		const base = salesRoutes.salesBase()
		if (!base) return null

		return {
			key: "sales",
			title: "Sales",
			items: [
				{
					key: "sales-lenses",
					title: "Sales Lenses",
					icon: Handshake,
					to: () => `${base}/sales-lenses`,
				},
				{
					key: "accounts",
					title: "Organizations",
					icon: Building2,
					to: () => `${base}/organizations`,
				},
				{
					key: "contacts",
					title: "People",
					icon: Users,
					to: () => `${base}/people`,
				},
				{
					key: "deals",
					title: "Opportunities",
					icon: Briefcase,
					to: () => `${base}/opportunities`,
				},
			],
		}
	}, [salesCrmEnabled, salesProject, salesProjectBasePath, salesRoutes])

	const sectionsToRender = useMemo(() => {
		const baseSections = salesSection ? [...visibleSections, salesSection] : visibleSections

		// Filter items within sections based on feature flags
		return baseSections
			.map((section) => ({
				...section,
				items: section.items.filter((item) => {
					if (!icpFeatureEnabled && ["insights", "segments", "product-lens"].includes(item.key)) {
						return false
					}
					// Hide "Insights" item when sales CRM is enabled
					if (item.key === "insights" && salesCrmEnabled) {
						return false
					}
					// Only show BANT Lens when the ffSalesCRM flag is on
					if (item.key === "bant-lens") {
						return salesCrmEnabled
					}
					return true
				}),
			}))
			.filter((section) => section.items.length > 0) // Remove sections with no items
	}, [visibleSections, salesSection, salesCrmEnabled, icpFeatureEnabled])

	// ────────────────────────────────────────────────────────────────
	// Counts → show small badges on matching items
	// Map your item keys to count keys (leave unmapped to skip)
	const COUNT_KEY_BY_ITEM: Record<
		string,
		"encounters" | "personas" | "themes" | "insights" | "people" | "organizations" | "accounts" | "deals" | "contacts" | "opportunities"
	> = {
		// Discovery (your current keys)
		conversations: "encounters", // your "Conversations" list = encounters
		personas: "personas",
		topics: "themes", // "Topics" item = themes count
		insights: "insights",

		// Directory
		people: "people",
		organizations: "organizations",

		// Revenue (future keys, safe to keep here)
		accounts: "accounts",
		deals: "deals",
		contacts: "contacts",
		opportunities: "opportunities"
	}

	const { counts, loading: countsLoading } = useSidebarCounts(effectiveProjectId, project?.workflow_type)

	const renderRightBadge = (itemKey: string, isActive: boolean) => {
		const countKey = COUNT_KEY_BY_ITEM[itemKey]
		const countVal = countKey ? counts[countKey] : undefined

		if (typeof countVal === "number") {
			return (
				<Badge
					variant={isActive ? "secondary" : "outline"}
					className="ml-2 rounded-full px-2 py-0.5 text-[10px] leading-4"
				>
					{countVal}
				</Badge>
			)
		}

		// Optional: subtle placeholder while loading counts
		if (countsLoading && countKey) {
			return <span className="ml-2 h-4 w-6 animate-pulse rounded-full bg-muted-foreground/20" />
		}

		return null
	}
	// ────────────────────────────────────────────────────────────────

	const buildTooltip = (title: string) => (isCollapsed ? title : undefined)

	return (
		<Sidebar collapsible="icon" variant="sidebar">
			<SidebarHeader>
				<Link to="/home" className="flex items-center gap-2 px-2">
					<div className="-ml-2 flex items-center gap-2">{isCollapsed ? <Logo /> : <LogoBrand />}</div>
				</Link>
				<TeamSwitcher accounts={accounts} collapsed={isCollapsed} />
			</SidebarHeader>

			<SidebarContent>
				{sectionsToRender.map((section) => (
					<SidebarGroup key={section.key}>
						{section.key !== "home" && <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
						<SidebarGroupContent>
							<SidebarMenu>
								{section.items.map((item) => {
									const href = canNavigate ? item.to(routes) : undefined
									const isActive = href ? location.pathname === href : false

									return (
										<SidebarMenuItem key={item.key} className="py-0.5">
											{href ? (
												<SidebarMenuButton asChild isActive={isActive} tooltip={buildTooltip(item.title)}>
													<NavLink to={href} className="flex items-center gap-2">
														<item.icon />
														<span>{item.title}</span>
														{renderRightBadge(item.key, isActive)}
													</NavLink>
												</SidebarMenuButton>
											) : (
												<SidebarMenuButton disabled tooltip={item.title} className="flex items-center gap-2">
													<item.icon />
													<span>{item.title}</span>
													{renderRightBadge(item.key, isActive)}
												</SidebarMenuButton>
											)}
										</SidebarMenuItem>
									)
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}

				{/* Validation Status Toggle for Sales Projects */}
				{project?.workflow_type === "sales" && (
					<SidebarGroup>
						<SidebarGroupLabel>Revenue</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem className="py-0">
									<SidebarMenuButton
										onClick={() => setShowValidationView(!showValidationView)}
										tooltip={buildTooltip(showValidationView ? "Dashboard View" : "Validation Status")}
										className={
											showValidationView
												? "bg-emerald-600 text-white hover:bg-emerald-700"
												: "border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 hover:from-emerald-100 hover:to-green-100 hover:text-emerald-800 dark:from-emerald-950/20 dark:to-green-950/20 dark:text-emerald-300 dark:hover:from-emerald-900/30 dark:hover:to-green-900/30"
										}
									>
										<SquareCheckBig className="h-4 w-4" />
										<span>{showValidationView ? "Dashboard View" : "Validation Status"}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem className="py-0.5">
									<SidebarMenuButton>
										<HandshakeIcon className="h-4 w-4" />
										<span>Opportunities</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>

			<SidebarFooter>
				{/* Utility Links - closer to user profile */}
				<SidebarMenu>
					{/* Invite Team Modal */}
					<SidebarMenuItem className="py-0.5">
						<InviteTeamModal collapsed={isCollapsed} accountId={effectiveAccountId} />
					</SidebarMenuItem>

					{/* Other utility links */}
					{APP_SIDEBAR_UTILITY_LINKS.map((item) => {
						const href = canNavigate ? item.to(routes) : undefined
						const isActive = href ? location.pathname === href : false

						return (
							<SidebarMenuItem key={item.key} className="py-0.5">
								{href ? (
									<SidebarMenuButton asChild isActive={isActive} tooltip={buildTooltip(item.title)}>
										<NavLink to={href} className="flex items-center gap-2">
											<item.icon />
											<span>{item.title}</span>
										</NavLink>
									</SidebarMenuButton>
								) : (
									<SidebarMenuButton disabled tooltip={item.title} className="flex items-center gap-2">
										<item.icon />
										<span>{item.title}</span>
									</SidebarMenuButton>
								)}
							</SidebarMenuItem>
						)
					})}
				</SidebarMenu>

				{/* User Profile at bottom */}
				<UserProfile />
			</SidebarFooter>

			<SidebarRail className="group pointer-events-auto">
				<SidebarTrigger className="-right-4 absolute top-3" />
			</SidebarRail>
		</Sidebar>
	)
}
