import consola from "consola"
import { LogOut, User } from "lucide-react"
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

export function UserProfile() {
	const { user, signOut } = useAuth()

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
					) : null}
					<User
						className="absolute h-5 w-5 text-foreground"
						style={{ display: user.user_metadata?.avatar_url ? "none" : "block" }}
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
