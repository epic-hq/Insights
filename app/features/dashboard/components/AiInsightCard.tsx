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

export function AiInsightCard({ insight, source, onAskFollowUp, interactive = true, className }: AiInsightCardProps) {
	return (
		<Card
			className={cn(
				"border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5",
				interactive && "cursor-pointer transition-all hover:shadow-md active:scale-[0.99]",
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
					<div className="min-w-0 flex-1">
						<div className="mb-1.5 flex items-center gap-2">
							<span className="font-medium text-primary text-xs">AI Insight</span>
							{source && <span className="text-muted-foreground text-xs">from {source}</span>}
						</div>

						<p className="text-foreground text-sm leading-relaxed">"{insight}"</p>

						{/* Action */}
						{interactive && onAskFollowUp && (
							<Button
								variant="ghost"
								size="sm"
								className="-ml-2 mt-3 text-primary hover:text-primary"
								onClick={(e) => {
									e.stopPropagation()
									onAskFollowUp()
								}}
							>
								<MessageSquare className="mr-1.5 h-4 w-4" />
								Ask follow-up
								<ChevronRight className="ml-1 h-4 w-4" />
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
