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
import { createClient } from "~/lib/supabase/client"

export function UserProfile() {
	const { user } = useAuth()
	const supabase = createClient()

	const handleSignOut = async () => {
		if (supabase) {
			await supabase.auth.signOut()
		}
	}

	if (!user) return null

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-8 w-8 rounded-full">
					{user.user_metadata?.avatar_url ? (
						<img className="h-8 w-8 rounded-full" src={user.user_metadata.avatar_url} alt={user.email || "User"} />
					) : (
						<User className="h-4 w-4" />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end" forceMount>
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="font-medium text-sm leading-none">{user.user_metadata?.full_name || user.email}</p>
						<p className="text-muted-foreground text-xs leading-none">{user.email}</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOut}>
					<LogOut className="mr-2 h-4 w-4" />
					<span>Log out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
