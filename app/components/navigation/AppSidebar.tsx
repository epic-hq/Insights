import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ComponentType } from "react"
import { useMemo, useState } from "react"
import { Link, NavLink, useRouteLoaderData } from "react-router-dom"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import { PATHS } from "~/paths"
import { UserProfile } from "../auth/UserProfile"
import { Logo, LogoBrand } from "../branding"
import { AccountProjectSwitcher } from "./AccountProjectSwitcher"
import { APP_SIDEBAR_SECTIONS, APP_SIDEBAR_UTILITY_LINKS } from "./app-sidebar.config"

interface ProtectedLayoutAccount {
	account_id: string
	name?: string | null
	projects?: { id: string }[] | null
}

interface ProtectedLayoutData {
	accounts?: ProtectedLayoutAccount[] | null
}

export function AppSidebar() {
	const { accountId, projectId, projectPath } = useCurrentProject()
	const [isCollapsed, setIsCollapsed] = useState(false)
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null

	const accounts = useMemo(() => {
		if (!protectedData?.accounts) return [] as ProtectedLayoutAccount[]
		return protectedData.accounts.filter(Boolean) as ProtectedLayoutAccount[]
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
	const routes = useProjectRoutes(projectPath)
	const canNavigate = Boolean(effectiveAccountId && effectiveProjectId)
	const dashboardHref = canNavigate ? routes.dashboard() : PATHS.HOME
	const showLabels = !isCollapsed

	const renderNavItem = (
		title: string,
		Icon: ComponentType<{ className?: string }>,
		to: string | undefined,
		key: string,
		variant: "primary" | "secondary"
	) => {
		const baseClasses = cn(
			"flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
			isCollapsed && "justify-center",
			variant === "secondary" && "text-muted-foreground hover:bg-accent hover:text-foreground"
		)

		if (!canNavigate || !to) {
			return (
				<div key={key} className={cn(baseClasses, "text-muted-foreground/70")} aria-disabled>
					<Icon className="h-4 w-4 flex-shrink-0" />
					{showLabels ? <span className="truncate">{title}</span> : <span className="sr-only">{title}</span>}
				</div>
			)
		}

		return (
			<NavLink
				key={key}
				to={to}
				className={({ isActive }) =>
					cn(
						baseClasses,
						variant === "primary"
							? isActive
								? "bg-primary/10 text-primary"
								: "text-foreground hover:bg-accent hover:text-foreground"
							: isActive
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-accent hover:text-foreground"
					)
				}
			>
				<Icon className="h-4 w-4 flex-shrink-0" />
				{showLabels ? <span className="truncate">{title}</span> : <span className="sr-only">{title}</span>}
			</NavLink>
		)
	}

	return (
		<aside
			className={cn(
				"hidden h-screen border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:flex md:flex-col",
				"relative transition-[width] duration-200 ease-in-out",
				isCollapsed ? "md:w-20" : "md:w-72"
			)}
			data-collapsed={isCollapsed}
		>
			<div className={cn("flex h-16 items-center border-b px-4", isCollapsed ? "justify-center" : "gap-2")}>
				<Link
					to={dashboardHref}
					className={cn("flex items-center gap-2", isCollapsed && "justify-center")}
					aria-label="Go to dashboard"
				>
					{isCollapsed ? <Logo /> : <LogoBrand />}
				</Link>
			</div>

			<button
				type="button"
				aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
				onClick={() => setIsCollapsed((prev) => !prev)}
				className="-right-8 absolute top-8 hidden h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm md:flex"
			>
				{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
			</button>

			<div className={cn("px-4 py-2", isCollapsed && "px-2")} aria-label="Account and project switcher">
				<AccountProjectSwitcher collapsed={isCollapsed} />
			</div>

			<nav className={cn("flex-1 overflow-y-auto px-3 py-4", isCollapsed && "px-2")} aria-label="Primary">
				<div className="space-y-6">
					{APP_SIDEBAR_SECTIONS.map((section) => (
						<div key={section.key} className="space-y-2">
							{showLabels && (
								<p className="px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
									{section.title}
								</p>
							)}
							<div className="space-y-1">
								{section.items.map((item) =>
									renderNavItem(item.title, item.icon, canNavigate ? item.to(routes) : undefined, item.key, "primary")
								)}
							</div>
						</div>
					))}
				</div>
			</nav>

			<div className={cn("border-t px-2", isCollapsed && "px-2")} aria-label="Secondary">
				<div className="space-y-1">
					{APP_SIDEBAR_UTILITY_LINKS.map((item) =>
						renderNavItem(item.title, item.icon, canNavigate ? item.to(routes) : undefined, item.key, "secondary")
					)}
				</div>
			</div>

			<div className={cn("border-b px-3 py-3", isCollapsed && "px-2")} aria-label="User menu">
				<UserProfile collapsed={isCollapsed} className="w-full" />
			</div>
		</aside>
	)
}
