/**
 * WelcomeHeader - Personalized greeting for onboarding dashboard
 *
 * Displays project name with welcoming message.
 * Optionally shows "Skip Tour" for experienced users.
 */

import { Pencil } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "~/lib/utils"

export interface WelcomeHeaderProps {
	/** Project name to display */
	projectName: string
	/** Base path for project routes */
	projectPath: string
	/** Optional subtitle text */
	subtitle?: string
	/** Additional CSS classes */
	className?: string
}

export function WelcomeHeader({ projectName, projectPath, subtitle = "", className }: WelcomeHeaderProps) {
	return (
		<header className={cn("text-center", className)}>
			<div className="mb-2 flex items-center justify-center gap-3">
				<h1 className="font-semibold text-2xl text-foreground">Welcome to {projectName}</h1>
				<Link
					to={`${projectPath}/settings`}
					className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title="Edit project settings"
				>
					<Pencil className="h-4 w-4" />
				</Link>
			</div>
			<p className="text-muted-foreground">{subtitle}</p>
		</header>
	)
}

export default WelcomeHeader
