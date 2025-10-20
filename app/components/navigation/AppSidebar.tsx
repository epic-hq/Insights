import { PanelLeftIcon } from "lucide-react"
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
				{APP_SIDEBAR_SECTIONS.map((section) => (
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
