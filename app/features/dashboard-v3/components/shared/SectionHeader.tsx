/**
 * SectionHeader - Consistent header for dashboard sections
 *
 * Displays section title with optional icon, count badge and "View all" link.
 * Establishes visual hierarchy for dashboard content.
 */

import type { LucideIcon } from "lucide-react"
import { ChevronRight } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"

export interface SectionHeaderProps {
	/** Section title */
	title: string
	/** Optional icon to display before title */
	icon?: LucideIcon
	/** Optional count to display in badge */
	count?: number
	/** Optional "View all" link href */
	viewAllHref?: string
	/** Optional "View all" link text */
	viewAllText?: string
	/** Additional CSS classes */
	className?: string
}

export function SectionHeader({
	title,
	icon: Icon,
	count,
	viewAllHref,
	viewAllText = "View all",
	className,
}: SectionHeaderProps) {
	return (
		<div className={cn("flex items-center justify-between", className)}>
			<div className="flex items-center gap-2">
				{Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
				<h2 className="font-semibold text-foreground">{title}</h2>
				{typeof count === "number" && count > 0 && (
					<Badge variant="secondary" className="px-2 py-0.5 text-xs">
						{count}
					</Badge>
				)}
			</div>

			{viewAllHref && (
				<Link
					to={viewAllHref}
					className="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					{viewAllText}
					<ChevronRight className="h-4 w-4" />
				</Link>
			)}
		</div>
	)
}

export default SectionHeader
