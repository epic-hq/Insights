/**
 * Insights Explainer Card
 *
 * Displays contextual guidance about the insights building process.
 * Shows when themes exist but have not been consolidated yet,
 * explaining that more interviews = better consolidated insights.
 */

import { CheckCircle, Layers, Loader2, Settings, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

interface InsightsExplainerCardProps {
	interviewCount: number;
	themeCount: number;
	evidenceCount: number;
	projectId: string;
	accountId: string;
	/** Whether consolidation has ever been run */
	hasConsolidated?: boolean;
	/** Similarity threshold from settings (0-1) */
	similarityThreshold?: number;
}

export function InsightsExplainerCard({
	interviewCount,
	themeCount,
	evidenceCount,
	projectId,
	accountId,
	hasConsolidated = false,
	similarityThreshold = 0.85,
}: InsightsExplainerCardProps) {
	const consolidateFetcher = useFetcher();
	const revalidator = useRevalidator();
	const isSubmitting = consolidateFetcher.state === "submitting";
	const [status, setStatus] = useState<"idle" | "working" | "done">("idle");
	// Track which runId we've already processed
	const processedRunIdRef = useRef<string | null>(null);

	// Handle consolidation response
	useEffect(() => {
		if (consolidateFetcher.state === "idle" && consolidateFetcher.data) {
			const data = consolidateFetcher.data as {
				ok?: boolean;
				runId?: string;
				error?: string;
			};
			// Only process each runId once
			if (data.ok && data.runId && processedRunIdRef.current !== data.runId) {
				processedRunIdRef.current = data.runId;
				setStatus("working");
				// Poll for completion (simple approach - task is fast)
				setTimeout(() => {
					setStatus("done");
					revalidator.revalidate();
					// Hide after showing "done" briefly
					setTimeout(() => setStatus("idle"), 2000);
				}, 5000);
			} else if (data.error) {
				setStatus("idle");
			}
		}
	}, [consolidateFetcher.state, consolidateFetcher.data, revalidator]);

	// Reset when starting new submission
	useEffect(() => {
		if (isSubmitting) {
			processedRunIdRef.current = null;
			setStatus("idle");
		}
	}, [isSubmitting]);

	// Determine the state
	const needsMoreData = interviewCount < 3;
	const hasEnoughForConsolidation = interviewCount >= 3 || evidenceCount >= 15;
	// Only show consolidation prompt when > 10 themes
	const tooManyThemes = themeCount > 10 && hasEnoughForConsolidation && !hasConsolidated;

	// Early stage: Not enough data yet
	if (needsMoreData) {
		return (
			<Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
				<TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
				<AlertTitle className="text-blue-900 dark:text-blue-100">Building Your Insights</AlertTitle>
				<AlertDescription className="text-blue-800 dark:text-blue-200">
					<p className="mb-2">
						You have <strong>{interviewCount}</strong> interview
						{interviewCount !== 1 ? "s" : ""} and <strong>{themeCount}</strong> emerging theme
						{themeCount !== 1 ? "s" : ""}.
					</p>
					<p className="text-sm opacity-80">
						Add {3 - interviewCount} more interview
						{3 - interviewCount !== 1 ? "s" : ""} to unlock automatic theme consolidation. The more interviews you add,
						the stronger your insights will become.
					</p>
				</AlertDescription>
			</Alert>
		);
	}

	// Ready for consolidation but hasn't been done yet
	if (tooManyThemes) {
		const isWorking = isSubmitting || status === "working";
		const isDone = status === "done";
		const thresholdPercent = Math.round(similarityThreshold * 100);

		return (
			<Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
				<Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
				<AlertTitle className="text-amber-900 dark:text-amber-100">Ready to Consolidate</AlertTitle>
				<AlertDescription className="text-amber-800 dark:text-amber-200">
					<p className="mb-3">
						You have <strong>{themeCount}</strong> themes from <strong>{interviewCount}</strong> interviews. That's a
						lot to navigate. Consolidation will merge similar themes into stronger insights.
					</p>
					<div className="flex items-center gap-3">
						<consolidateFetcher.Form method="post" action="/api/consolidate-themes" className="inline">
							<input type="hidden" name="project_id" value={projectId} />
							<input type="hidden" name="account_id" value={accountId} />
							<input type="hidden" name="similarity_threshold" value={similarityThreshold.toString()} />
							<Button
								type="submit"
								size="sm"
								variant="secondary"
								disabled={isWorking}
								className="gap-2 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:hover:bg-amber-900/50"
							>
								{isDone ? (
									<>
										<CheckCircle className="h-4 w-4 text-green-600" />
										Done!
									</>
								) : isWorking ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Working...
									</>
								) : (
									<>
										<Sparkles className="h-4 w-4" />
										Consolidate Themes
									</>
								)}
							</Button>
						</consolidateFetcher.Form>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex cursor-help items-center gap-1 text-amber-700 text-xs dark:text-amber-300">
									<Settings className="h-3 w-3" />
									{thresholdPercent}% similarity
								</span>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-xs">
								<p className="text-sm">
									Themes with {thresholdPercent}%+ semantic similarity will be merged. Adjust this in the{" "}
									<strong className="font-medium">Settings</strong> button above for more or fewer merges.
								</p>
							</TooltipContent>
						</Tooltip>
					</div>
				</AlertDescription>
			</Alert>
		);
	}

	// Good state - already consolidated or reasonable theme count
	return null;
}
