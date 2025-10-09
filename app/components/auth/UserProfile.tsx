import { ChevronsUpDown, FolderOpen, LogOut, Mail, User, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
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

export function UserProfile({ collapsed = false, className }: UserProfileProps) {
	const { user, signOut } = useAuth()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	if (!user) return null

	const displayName = user.user_metadata?.full_name?.trim() || user.email || "User"
	const email = user.email ?? ""
	const avatarUrl = user.user_metadata?.avatar_url ?? ""
	const initials = getInitials(displayName || email || "U")

	const handleSignOut = async () => {
		try {
			await signOut()
		} catch {
			// Auth context already surfaces errors
		}
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus:outline-none data-[state=open]:bg-accent/60",
						collapsed ? "justify-center gap-0 px-1" : "justify-start",
						className
					)}
				>
					<Avatar className="h-9 w-9 rounded-lg">
						<AvatarImage src={avatarUrl} alt={displayName} />
						<AvatarFallback className="rounded-lg font-semibold text-xs uppercase">{initials}</AvatarFallback>
					</Avatar>
					<div
						className={cn("min-w-0 flex-1 text-left leading-tight", collapsed ? "hidden" : "grid")}
						data-testid="user-profile-text"
					>
						<span className="truncate font-medium">{displayName}</span>
						{email && <span className="truncate text-muted-foreground text-xs">{email}</span>}
					</div>
					{!collapsed && <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground" />}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-64 rounded-lg border bg-popover p-0 shadow-lg"
				align="end"
				sideOffset={8}
				forceMount
			>
				<DropdownMenuLabel className="px-3 py-2">
					<div className="flex items-center gap-3">
						<Avatar className="h-9 w-9 rounded-lg">
							<AvatarImage src={avatarUrl} alt={displayName} />
							<AvatarFallback className="rounded-lg font-semibold text-xs uppercase">{initials}</AvatarFallback>
						</Avatar>
						<div className="min-w-0 text-sm leading-tight">
							<p className="truncate font-medium">{displayName}</p>
							{email && <p className="truncate text-muted-foreground text-xs">{email}</p>}
						</div>
					</div>
				</DropdownMenuLabel>
				{/* <DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link to={routes.projects.index()} className="flex items-center gap-2">
							<FolderOpen className="h-4 w-4" />
							<span>Switch Projects</span>
						</Link>
					</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to={routes.team.members()} className="flex items-center gap-2">
						<Mail className="h-4 w-4" />
						<span>Invite Team</span>
					</Link>
				</DropdownMenuItem>
					</DropdownMenuGroup> */}
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link to={routes.team.members() || PATHS.TEAMS} className="flex items-center gap-2">
							<Users className="h-4 w-4" />
							<span>Manage Team</span>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to={PATHS.PROFILE} className="flex items-center gap-2">
							<User className="h-4 w-4" />
							<span>Profile</span>
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem className="flex items-center justify-between">
					<span>Theme</span>
					<ThemeToggle />
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={handleSignOut}
					className="flex items-center gap-2 text-destructive focus:text-destructive"
				>
					<LogOut className="h-4 w-4" />
					<span>Sign out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
