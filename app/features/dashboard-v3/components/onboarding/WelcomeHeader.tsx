/**
 * WelcomeHeader - Personalized greeting for onboarding dashboard
 *
 * Displays project name with welcoming message.
 * Optionally shows "Skip Tour" for experienced users.
 */

import { cn } from "~/lib/utils"

export interface WelcomeHeaderProps {
	/** Project name to display */
	projectName: string
	/** Optional subtitle text */
	subtitle?: string
	/** Additional CSS classes */
	className?: string
}

export function WelcomeHeader({ projectName, subtitle = "", className }: WelcomeHeaderProps) {
	return (
		<header className={cn("text-center", className)}>
			<h1 className="mb-2 font-semibold text-2xl text-foreground">Welcome to {projectName}</h1>
			<p className="text-muted-foreground">{subtitle}</p>
		</header>
	)
}

export default WelcomeHeader
