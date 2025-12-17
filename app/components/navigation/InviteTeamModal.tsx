import { UserPlus } from "lucide-react"
import { Link } from "react-router-dom"
import { SidebarMenuButton } from "~/components/ui/sidebar"

interface InviteTeamModalProps {
	accountId?: string
}

export function InviteTeamModal({ accountId }: InviteTeamModalProps) {
	const tooltip = "Access • Collaborate on insights."
	const manageTeamUrl = accountId ? `/a/${accountId}/team/manage` : "/teams"

	return (
		<SidebarMenuButton asChild tooltip={tooltip} showTooltipWhenExpanded>
			<Link to={manageTeamUrl}>
				<UserPlus className="h-4 w-4" />
				<span>Access</span>
			</Link>
		</SidebarMenuButton>
	)
}
