/**
 * AiInsightCard - Proactive AI insight display
 *
 * Shows a key insight from the AI assistant with option to explore further.
 * Designed to encourage chat engagement.
 */

import { Bot, ChevronRight, MessageSquare, Sparkles } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"

export interface AiInsightCardProps {
	/** The insight text to display */
	insight: string
	/** Optional source/context for the insight */
	source?: string
	/** Callback when user wants to explore further */
	onAskFollowUp?: () => void
	/** Whether the card should be interactive */
	interactive?: boolean
	/** Additional CSS classes */
	className?: string
}

export function AiInsightCard({
	insight,
	source,
	onAskFollowUp,
	interactive = true,
	className,
}: AiInsightCardProps) {
	return (
		<Card
			className={cn(
				"bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20",
				interactive && "cursor-pointer hover:shadow-md transition-all active:scale-[0.99]",
				className
			)}
			onClick={interactive ? onAskFollowUp : undefined}
		>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{/* AI Icon */}
					<div className="flex-shrink-0 rounded-full bg-primary/10 p-2.5">
						<Sparkles className="h-5 w-5 text-primary" />
					</div>

					{/* Content */}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1.5">
							<span className="text-xs font-medium text-primary">AI Insight</span>
							{source && (
								<span className="text-xs text-muted-foreground">
									from {source}
								</span>
							)}
						</div>

						<p className="text-sm text-foreground leading-relaxed">
							"{insight}"
						</p>

						{/* Action */}
						{interactive && onAskFollowUp && (
							<Button
								variant="ghost"
								size="sm"
								className="mt-3 -ml-2 text-primary hover:text-primary"
								onClick={(e) => {
									e.stopPropagation()
									onAskFollowUp()
								}}
							>
								<MessageSquare className="h-4 w-4 mr-1.5" />
								Ask follow-up
								<ChevronRight className="h-4 w-4 ml-1" />
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
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
				"flex items-center gap-2 px-3 py-2 rounded-full",
				"bg-primary/10 text-primary text-sm",
				"hover:bg-primary/20 transition-colors",
				"active:scale-[0.98]",
				className
			)}
		>
			<Sparkles className="h-3.5 w-3.5" />
			<span className="truncate max-w-[200px]">{insight}</span>
			<ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
		</button>
	)
}

export default AiInsightCard
