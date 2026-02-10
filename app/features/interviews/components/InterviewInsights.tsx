/**
 * InterviewInsights — merged Key Takeaways (structured AI) + AI Takeaways (editable freeform).
 * Shows priority-badged takeaways from conversation analysis with "See source" links,
 * plus an editable AI summary with regenerate capability and user notes.
 */

import { ArrowRight, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";
import { cn } from "~/lib/utils";

interface KeyTakeaway {
	priority: "high" | "medium" | "low";
	summary: string;
	evidenceSnippets: string[];
	/** Optional evidence ID to link to */
	evidenceId?: string;
}

interface InterviewInsightsProps {
	/** Structured takeaways from conversation analysis */
	aiKeyTakeaways: KeyTakeaway[];
	/** When the conversation analysis was last updated (formatted) */
	conversationUpdatedLabel: string | null;
	/** Callback when user clicks "See source" on a takeaway with a matched evidence ID */
	onSourceClick?: (evidenceId: string) => void;
}

export function InterviewInsights({ aiKeyTakeaways, conversationUpdatedLabel, onSourceClick }: InterviewInsightsProps) {
	if (aiKeyTakeaways.length === 0) return null;

	return (
		<div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-2">
					<Sparkles className="h-5 w-5 text-amber-500" />
					<h3 className="font-semibold text-base text-foreground">Key Insights</h3>
				</div>
				{conversationUpdatedLabel && (
					<span className="text-muted-foreground text-xs">Updated {conversationUpdatedLabel}</span>
				)}
			</div>
			<div className="space-y-2.5">
				{aiKeyTakeaways.map((takeaway, index) => {
					const borderColor =
						takeaway.priority === "high"
							? "border-l-red-500"
							: takeaway.priority === "medium"
								? "border-l-amber-500"
								: "border-l-blue-500";
					const badgeColor =
						takeaway.priority === "high"
							? "bg-red-500/10 text-red-500 dark:text-red-400"
							: takeaway.priority === "medium"
								? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
								: "bg-blue-500/10 text-blue-600 dark:text-blue-400";

					return (
						<div
							key={`${takeaway.summary}-${index}`}
							className={cn(
								"flex gap-3 rounded-r-md border-l-[3px] bg-muted/30 p-3 transition-colors hover:bg-muted/50",
								borderColor
							)}
						>
							<span
								className={cn(
									"mt-0.5 inline-flex shrink-0 items-center rounded px-2 py-0.5 font-semibold text-[11px] uppercase tracking-wider",
									badgeColor
								)}
							>
								{takeaway.priority}
							</span>
							<div className="flex-1 space-y-1.5">
								<Streamdown className="prose prose-sm max-w-none text-foreground leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
									{takeaway.summary}
								</Streamdown>
								{takeaway.evidenceId ? (
									<button
										type="button"
										onClick={() => {
											if (takeaway.evidenceId) onSourceClick?.(takeaway.evidenceId);
										}}
										className="inline-flex items-center gap-1 font-medium text-primary text-xs transition-colors hover:text-primary/80"
									>
										See source
										<ArrowRight className="h-3 w-3" />
									</button>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
