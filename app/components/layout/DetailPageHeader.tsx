import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

interface DetailPageHeaderProps {
	/** Icon component to display in the badge */
	icon: LucideIcon
	/** Type label (e.g., "Organization", "Person", "Persona") */
	typeLabel: string
	/** Main title/name */
	title: string
	/** Optional subtitle or metadata row */
	metadata?: ReactNode
	/** Optional badges row */
	badges?: ReactNode
	/** Optional description/bio content */
	description?: string | null
	/** Optional additional content in the card body */
	children?: ReactNode
}

export function DetailPageHeader({
	icon: Icon,
	typeLabel,
	title,
	metadata,
	badges,
	description,
	children,
}: DetailPageHeaderProps) {
	return (
		<Card className="mb-8 border border-border/80">
			<CardHeader className="space-y-3">
				<Badge variant="secondary" className="w-fit gap-1 text-xs">
					<Icon className="h-3.5 w-3.5" /> {typeLabel}
				</Badge>
				<CardTitle className="font-bold text-3xl text-foreground">{title}</CardTitle>
				{metadata && <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">{metadata}</div>}
				{badges && <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">{badges}</div>}
			</CardHeader>
			{(description || children) && (
				<CardContent>
					{description && <p className="text-muted-foreground">{description}</p>}
					{children}
				</CardContent>
			)}
		</Card>
	)
}
