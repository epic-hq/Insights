/**
 * LensResultCard - Individual card showing lens analysis summary
 *
 * Displays a lens with its key metrics and navigation to full results.
 * Mobile-first design with touch-friendly targets.
 */

import { Briefcase, ChevronRight, FlaskConical, Package, Sparkles } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"

export interface LensResultCardProps {
	/** Lens template key (e.g., "BANT_GPCT", "CUSTOMER_DISCOVERY") */
	templateKey: string
	/** Display name of the lens */
	name: string
	/** Category: sales, research, product */
	category: "sales" | "research" | "product" | string
	/** Number of conversations analyzed with this lens */
	conversationCount: number
	/** Primary metric or insight summary */
	summary?: string
	/** Link to the full lens results page */
	href: string
	/** Whether the lens has meaningful data to show */
	hasData?: boolean
}

/**
 * Get icon for a lens category
 */
function getCategoryIcon(category: string) {
	switch (category) {
		case "research":
			return <FlaskConical className="h-5 w-5" />
		case "sales":
			return <Briefcase className="h-5 w-5" />
		case "product":
			return <Package className="h-5 w-5" />
		default:
			return <Sparkles className="h-5 w-5" />
	}
}

/**
 * Get color scheme for a lens category
 */
function getCategoryColors(category: string): {
	bg: string
	text: string
	border: string
	iconBg: string
} {
	switch (category) {
		case "research":
			return {
				bg: "bg-purple-50 dark:bg-purple-950/30",
				text: "text-purple-700 dark:text-purple-300",
				border: "border-purple-200 dark:border-purple-800",
				iconBg: "bg-purple-100 dark:bg-purple-900/50",
			}
		case "sales":
			return {
				bg: "bg-blue-50 dark:bg-blue-950/30",
				text: "text-blue-700 dark:text-blue-300",
				border: "border-blue-200 dark:border-blue-800",
				iconBg: "bg-blue-100 dark:bg-blue-900/50",
			}
		case "product":
			return {
				bg: "bg-green-50 dark:bg-green-950/30",
				text: "text-green-700 dark:text-green-300",
				border: "border-green-200 dark:border-green-800",
				iconBg: "bg-green-100 dark:bg-green-900/50",
			}
		default:
			return {
				bg: "bg-gray-50 dark:bg-gray-800/50",
				text: "text-gray-700 dark:text-gray-300",
				border: "border-gray-200 dark:border-gray-700",
				iconBg: "bg-gray-100 dark:bg-gray-800",
			}
	}
}

export function LensResultCard({
	templateKey,
	name,
	category,
	conversationCount,
	summary,
	href,
	hasData = true,
}: LensResultCardProps) {
	const colors = getCategoryColors(category)

	return (
		<Link to={href} className="block">
			<Card className={cn("transition-all hover:shadow-md active:scale-[0.98]", colors.border, "min-h-[100px]")}>
				<CardContent className="p-4">
					<div className="flex items-start justify-between gap-3">
						{/* Icon and content */}
						<div className="flex min-w-0 flex-1 items-start gap-3">
							<div className={cn("flex-shrink-0 rounded-lg p-2.5", colors.iconBg, colors.text)}>
								{getCategoryIcon(category)}
							</div>
							<div className="min-w-0 flex-1">
								<h3 className="truncate font-medium text-foreground">{name}</h3>
								{hasData && summary ? (
									<p className="mt-1 line-clamp-2 text-muted-foreground text-sm dark:text-gray-300">{summary}</p>
								) : (
									<p className="mt-1 text-muted-foreground text-sm dark:text-gray-300">
										{conversationCount > 0
											? `${conversationCount} conversation${conversationCount !== 1 ? "s" : ""} analyzed`
											: "No data yet"}
									</p>
								)}
							</div>
						</div>

						{/* Arrow and badge */}
						<div className="flex flex-shrink-0 flex-col items-end gap-2">
							<ChevronRight className="h-5 w-5 text-muted-foreground" />
							{hasData && conversationCount > 0 && (
								<Badge variant="secondary" className={cn("text-xs", colors.bg, colors.text)}>
									{conversationCount}
								</Badge>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</Link>
	)
}

export default LensResultCard
