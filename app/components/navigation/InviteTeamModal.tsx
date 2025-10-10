import { UserPlus } from "lucide-react"
import { Link } from "react-router-dom"
import { SidebarMenuButton } from "~/components/ui/sidebar"

interface InviteTeamModalProps {
	collapsed?: boolean
	accountId?: string
}

export function InviteTeamModal({ collapsed = false, accountId }: InviteTeamModalProps) {
	const tooltip = collapsed ? "Invite Team" : undefined
	const manageTeamUrl = accountId ? `/a/${accountId}/team/manage` : "/teams"

	return (
		<SidebarMenuButton asChild tooltip={tooltip}>
			<Link to={manageTeamUrl}>
				<UserPlus className="h-4 w-4" />
				<span>Invite Team</span>
			</Link>
		</SidebarMenuButton>
	)
}
