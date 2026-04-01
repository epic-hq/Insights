/**
 * InterviewInsights — merged Key Takeaways (structured AI) + AI Takeaways (editable freeform).
 * Shows takeaways from conversation analysis with "See source" links.
 * Priority is de-emphasized — content-first approach.
 */

import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { useFetcher, useRevalidator } from "react-router";
import { Streamdown } from "streamdown";
import { Button } from "~/components/ui/button";
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
	/** Interview ID for re-analyze action */
	interviewId?: string;
}

export function InterviewInsights({
	aiKeyTakeaways,
	conversationUpdatedLabel,
	onSourceClick,
	interviewId,
}: InterviewInsightsProps) {
	const reanalyzeFetcher = useFetcher();
	const revalidator = useRevalidator();
	const isReanalyzing = reanalyzeFetcher.state !== "idle";
	const unlinkedCount = aiKeyTakeaways.filter((t) => !t.evidenceId).length;

	if (aiKeyTakeaways.length === 0) return null;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-2">
					<Sparkles className="h-5 w-5 text-amber-500" />
					<h3 className="font-semibold text-base text-foreground">Key Insights</h3>
				</div>
				<div className="flex items-center gap-2">
					{conversationUpdatedLabel && (
						<span className="text-muted-foreground text-xs">Updated {conversationUpdatedLabel}</span>
					)}
					{interviewId && unlinkedCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 gap-1.5 text-xs"
							disabled={isReanalyzing}
							onClick={() => {
								reanalyzeFetcher.submit(
									{
										interview_id: interviewId,
										template_key: "conversation-overview",
									},
									{ method: "POST", action: "/api/apply-lens" }
								);
								setTimeout(() => revalidator.revalidate(), 2000);
							}}
						>
							<RefreshCw className={cn("h-3 w-3", isReanalyzing && "animate-spin")} />
							{isReanalyzing ? "Re-analyzing..." : `Re-analyze (${unlinkedCount} unlinked)`}
						</Button>
					)}
				</div>
			</div>
			<div className="space-y-2">
				{aiKeyTakeaways.map((takeaway, index) => (
					<div
						key={`${takeaway.summary}-${index}`}
						className="rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
					>
						<div className="space-y-1.5">
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
				))}
			</div>
		</div>
	);
}
