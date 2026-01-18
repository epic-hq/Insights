import { BarChart3, ChevronsUpDown, ClipboardList, CreditCard, LogOut, Settings, User, Users } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuItem, useSidebar } from "~/components/ui/sidebar"
import { ThemeToggle } from "~/components/ui/theme-toggle"
import { useAuth } from "~/contexts/AuthContext"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import { PATHS } from "~/paths"

function getInitials(source: string) {
	return source
		.trim()
		.split(/\s+/)
		.map((segment) => segment[0] ?? "")
		.join("")
		.slice(0, 2)
		.toUpperCase()
}

interface UserProfileProps {
	collapsed?: boolean
	className?: string
}

export function UserProfile({ collapsed: collapsedProp, className }: UserProfileProps) {
	const [open, setOpen] = useState(false)
	const { user, signOut, user_settings } = useAuth()
	const { projectPath, accountId } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const { state } = useSidebar()

	// Use prop if provided, otherwise derive from sidebar state
	const collapsed = collapsedProp ?? state === "collapsed"

	if (!user) return null

	const displayName = user.user_metadata?.full_name?.trim() || user.email || "User"
	const email = user.email ?? ""
	const avatarUrl = user.user_metadata?.avatar_url ?? ""
	const initials = getInitials(displayName || email || "U")
	const accountSettingsPath = accountId ? `/a/${accountId}/settings` : null
	const billingPath = accountId ? `/a/${accountId}/billing` : null

	const handleSignOut = async () => {
		try {
			await signOut()
		} catch {
			// Auth context already surfaces errors
		}
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu open={open} onOpenChange={setOpen}>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							className={cn("w-full justify-start gap-3 px-2 py-1.5", collapsed && "justify-center px-2", className)}
						>
							<Avatar className="h-8 w-8 rounded-lg">
								<AvatarImage src={avatarUrl} alt={displayName} />
								<AvatarFallback className="rounded-lg font-semibold text-xs uppercase">{initials}</AvatarFallback>
							</Avatar>
							{!collapsed && (
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">{displayName}</span>
									{email && <span className="truncate text-muted-foreground text-xs">{email}</span>}
								</div>
							)}
							{!collapsed && <ChevronsUpDown className="ml-auto size-4" />}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-64 rounded-lg" align="end" sideOffset={8}>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage src={avatarUrl} alt={displayName} />
									<AvatarFallback className="rounded-lg font-semibold text-xs uppercase">{initials}</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">{displayName}</span>
									{email && <span className="truncate text-muted-foreground text-xs">{email}</span>}
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-wide">
							Personal
						</DropdownMenuLabel>
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link to={PATHS.PROFILE} className="flex items-center gap-2">
									<User className="h-4 w-4" />
									<span>Profile</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to="/my-responses" className="flex items-center gap-2">
									<ClipboardList className="h-4 w-4" />
									<span>My Responses</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem className="flex items-center justify-between">
								<span>Theme</span>
								<ThemeToggle />
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={handleSignOut}
								className="flex items-center gap-2 text-destructive focus:text-destructive"
							>
								<LogOut className="h-4 w-4" />
								<span>Sign out</span>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-wide">
							Account
						</DropdownMenuLabel>
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link to={routes.team.members() || PATHS.TEAMS} className="flex items-center gap-2">
									<Users className="h-4 w-4" />
									<span>Manage access</span>
								</Link>
							</DropdownMenuItem>
							{billingPath && (
								<DropdownMenuItem asChild>
									<Link to={billingPath} className="flex items-center gap-2">
										<CreditCard className="h-4 w-4" />
										<span>Billing</span>
									</Link>
								</DropdownMenuItem>
							)}
							{accountSettingsPath && (
								<DropdownMenuItem asChild>
									<Link to={accountSettingsPath} className="flex items-center gap-2">
										<Settings className="h-4 w-4" />
										<span>Account settings</span>
									</Link>
								</DropdownMenuItem>
							)}
						</DropdownMenuGroup>
						{user_settings?.is_platform_admin && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-wide">
									Admin
								</DropdownMenuLabel>
								<DropdownMenuGroup>
									<DropdownMenuItem asChild>
										<Link to="/admin/usage" className="flex items-center gap-2">
											<BarChart3 className="h-4 w-4" />
											<span>Usage Dashboard</span>
										</Link>
									</DropdownMenuItem>
								</DropdownMenuGroup>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
