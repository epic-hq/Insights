import { SquareCheckBig } from "lucide-react"
import { useMemo } from "react"
import { Link, NavLink, useLocation, useRouteLoaderData } from "react-router-dom"
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
import { useProjectDataAvailability } from "~/hooks/useProjectDataAvailability"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
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
	const { project } = useCurrentProjectData()
	const { showValidationView, setShowValidationView } = useValidationView()

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

		// Respect user's last used project preference
		const lastUsedProjectId = protectedData?.user_settings?.last_used_project_id
		if (lastUsedProjectId && fallbackAccount?.projects?.length) {
			const lastUsedProject = fallbackAccount.projects.find((p) => p.id === lastUsedProjectId)
			if (lastUsedProject) {
				console.log("[AppSidebar] Using last_used_project_id:", lastUsedProjectId)
				return lastUsedProject
			}
			console.warn("[AppSidebar] last_used_project_id not found in current account projects:", {
				lastUsedProjectId,
				availableProjects: fallbackAccount.projects.map((p) => p.id),
			})
		}

		// Final fallback to first project
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

	// Filter sections based on data availability
	const visibleSections = useMemo(() => {
		return APP_SIDEBAR_SECTIONS.filter((section) => {
			// Show analyze section only if there's analysis data (interviews or evidence)
			if (section.key === "analyze") {
				return hasAnalysisData
			}
			// Show all other sections
			return true
		})
	}, [hasAnalysisData])

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
				{visibleSections.map((section) => (
					<SidebarGroup key={section.key}>
						{section.key !== "home" && <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
						<SidebarGroupContent>
							<SidebarMenu>
								{section.items.map((item) => {
									const href = canNavigate ? item.to(routes) : undefined
									const isActive = href ? location.pathname === href : false

									return (
										<SidebarMenuItem key={item.key}>
											{href ? (
												<SidebarMenuButton asChild isActive={isActive} tooltip={buildTooltip(item.title)}>
													<NavLink to={href}>
														<item.icon />
														<span>{item.title}</span>
													</NavLink>
												</SidebarMenuButton>
											) : (
												<SidebarMenuButton disabled tooltip={item.title}>
													<item.icon />
													<span>{item.title}</span>
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
								<SidebarMenuItem>
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
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>

			<SidebarFooter>
				{/* Utility Links - closer to user profile */}
				<SidebarMenu>
					{/* Invite Team Modal */}
					<SidebarMenuItem>
						<InviteTeamModal collapsed={isCollapsed} accountId={effectiveAccountId} />
					</SidebarMenuItem>

					{/* Other utility links */}
					{APP_SIDEBAR_UTILITY_LINKS.map((item) => {
						const href = canNavigate ? item.to(routes) : undefined
						const isActive = href ? location.pathname === href : false

						return (
							<SidebarMenuItem key={item.key}>
								{href ? (
									<SidebarMenuButton asChild isActive={isActive} tooltip={buildTooltip(item.title)}>
										<NavLink to={href}>
											<item.icon />
											<span>{item.title}</span>
										</NavLink>
									</SidebarMenuButton>
								) : (
									<SidebarMenuButton disabled tooltip={item.title}>
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
