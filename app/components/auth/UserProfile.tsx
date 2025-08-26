import consola from "consola"
import { LogOut, User, FolderOpen } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "~/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useAuth } from "~/contexts/AuthContext"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { useCurrentProject } from "~/contexts/current-project-context"
import { PATHS } from "~/paths"

export function UserProfile() {
	const { user, signOut } = useAuth()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const handleSignOut = async () => {
		try {
			consola.log("click signout")
			await signOut()
		} catch {
			// Error handling is managed by the AuthContext
			// Page will reload to sync auth state
		}
	}

	if (!user) return null

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative h-10 w-10 rounded-full border border-border/30 bg-background transition-colors hover:border-border/70 hover:bg-accent/50 dark:bg-background/90 dark:hover:bg-accent/30"
					aria-label="User profile menu"
				>
					{user.user_metadata?.avatar_url ? (
						<img
							className="h-8 w-8 rounded-full object-cover"
							src={user.user_metadata.avatar_url}
							alt={user.email || "User"}
							onError={(e) => {
								// Fallback to icon if image fails to load
								const target = e.target as HTMLImageElement
								target.style.display = "none"
								const icon = target.nextSibling as HTMLElement
								if (icon) icon.style.display = "block"
							}}
						/>
					) : (
						// Generate avatar from initials if no avatar URL
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
							{(user.user_metadata?.full_name || user.email || "U")
								.split(" ")
								.map((name: string) => name[0])
								.join("")
								.toUpperCase()
								.slice(0, 2)}
						</div>
					)}
					<User
						className="absolute h-5 w-5 text-foreground"
						style={{ display: user.user_metadata?.avatar_url ? "none" : "none" }}
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-56 rounded-md border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
				align="end"
				forceMount
			>
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="font-medium text-foreground text-sm leading-none">
							{user.user_metadata?.full_name || user.email}
						</p>
						<p className="text-muted-foreground text-xs leading-none">{user.email}</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator className="bg-border/50" />
				<DropdownMenuItem
					asChild
					className="cursor-pointer text-foreground hover:bg-accent"
				>
					<Link to={routes.projects.index()} className="flex items-center">
						<FolderOpen className="mr-2 h-4 w-4" />
						<span>Switch Project</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator className="bg-border/50" />
				<DropdownMenuItem
					asChild
					className="cursor-pointer text-foreground focus:bg-destructive/10 focus:text-destructive"
				>
					<Link to={PATHS.PROFILE}>Profile</Link>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={handleSignOut}
					className="cursor-pointer text-foreground focus:bg-destructive/10 focus:text-destructive"
				>
					<LogOut className="mr-2 h-4 w-4" />
					<span>Sign out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
