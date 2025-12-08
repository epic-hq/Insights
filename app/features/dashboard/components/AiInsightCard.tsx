/**
 * AiInsightCard - Proactive AI insight display
 *
 * Shows a key insight from the AI assistant with option to explore further.
 * Designed to encourage chat engagement.
 */

import { ChevronRight, MessageSquare, Sparkles } from "lucide-react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"

export interface AiInsightCardProps {
	/** The insight text to display */
	insight: string
	/** Optional source/context for the insight */
	source?: string
	/** Link to the AI assistant page */
	href?: string
	/** Callback when user wants to explore further (deprecated, use href) */
	onAskFollowUp?: () => void
	/** Whether the card should be interactive */
	interactive?: boolean
	/** Additional CSS classes */
	className?: string
}

export function AiInsightCard({
	insight,
	source,
	href,
	onAskFollowUp,
	interactive = true,
	className,
}: AiInsightCardProps) {
	const cardContent = (
		<Card
			className={cn(
				"border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5",
				interactive && "cursor-pointer transition-all hover:shadow-md active:scale-[0.99]",
				className
			)}
			onClick={interactive && onAskFollowUp && !href ? onAskFollowUp : undefined}
		>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{/* AI Icon */}
					<div className="flex-shrink-0 rounded-full bg-primary/10 p-2.5">
						<Sparkles className="h-5 w-5 text-primary" />
					</div>

					{/* Content */}
					<div className="min-w-0 flex-1">
						<div className="mb-1.5 flex items-center gap-2">
							<span className="font-medium text-primary text-xs">AI Insight</span>
							{source && <span className="text-muted-foreground text-xs">from {source}</span>}
						</div>

						<p className="text-foreground text-sm leading-relaxed">"{insight}"</p>

						{/* Action */}
						{interactive && (href || onAskFollowUp) && (
							<Button
								variant="ghost"
								size="sm"
								className="mt-3 -ml-2 text-primary hover:text-primary"
								asChild={!!href}
								onClick={!href && onAskFollowUp ? (e) => {
									e.stopPropagation()
									onAskFollowUp()
								} : undefined}
							>
								{href ? (
									<Link to={href}>
										<MessageSquare className="h-4 w-4 mr-1.5" />
										Ask follow-up
										<ChevronRight className="h-4 w-4 ml-1" />
									</Link>
								) : (
									<>
										<MessageSquare className="h-4 w-4 mr-1.5" />
										Ask follow-up
										<ChevronRight className="h-4 w-4 ml-1" />
									</>
								)}
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)

	// Wrap entire card in Link if href is provided
	if (href && interactive) {
		return <Link to={href} className="block">{cardContent}</Link>
	}

	return cardContent
}

/**
 * Compact version for inline use
 */
export function AiInsightPill({
	insight,
	onClick,
	className,
}: {
	insight: string
	onClick?: () => void
	className?: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex items-center gap-2 rounded-full px-3 py-2",
				"bg-primary/10 text-primary text-sm",
				"transition-colors hover:bg-primary/20",
				"active:scale-[0.98]",
				className
			)}
		>
			<Sparkles className="h-3.5 w-3.5" />
			<span className="max-w-[200px] truncate">{insight}</span>
			<ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
		</button>
	)
}

export default AiInsightCard
