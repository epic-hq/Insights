import { useMemo } from "react"
import { NavLink, useLocation, useRouteLoaderData } from "react-router-dom"
import { PanelLeftIcon } from "lucide-react"
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
		if (fallbackAccount?.projects?.length) {
			return fallbackAccount.projects[0] || null
		}
		return null
	}, [fallbackAccount, projectId])

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
				<div className="flex items-center gap-2 px-2">
					<div className="-ml-2 flex items-center gap-2">{isCollapsed ? <Logo /> : <LogoBrand />}</div>
				</div>
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
				<span className="sr-only">Toggle Sidebar</span>
				<div className="pointer-events-none absolute top-3 -right-4 hidden size-7 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-colors duration-200 ease-linear group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground md:flex">
					<PanelLeftIcon className="size-4" />
				</div>
			</SidebarRail>
		</Sidebar>
	)
}
