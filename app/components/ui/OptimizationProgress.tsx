/**
 * OptimizationProgress — shows media file optimization status inline.
 *
 * Displays a compact progress bar with size savings info and a skip button.
 * Designed to sit between file selection and upload in the upload flow.
 */

import { Loader2, SkipForward, Sparkles, Zap } from "lucide-react";
import { cn } from "~/lib/utils";
import type { MediaOptimizerState } from "~/hooks/useMediaOptimizer";
import { formatBytes } from "~/utils/media-optimizer.client";

interface OptimizationProgressProps {
	state: MediaOptimizerState;
	onSkip: () => void;
	className?: string;
}

export function OptimizationProgress({ state, onSkip, className }: OptimizationProgressProps) {
	const { status, progress } = state;

	if (status === "idle" || !progress) return null;

	const isOptimizing = status === "optimizing";
	const isDone = status === "done";
	const isSkipped = status === "skipped";
	const isError = status === "error";

	const savings =
		isDone && progress.originalSize > 0 && progress.optimizedSize > 0
			? Math.round((1 - progress.optimizedSize / progress.originalSize) * 100)
			: 0;

	return (
		<div
			className={cn(
				"rounded-lg border p-3 transition-all",
				isOptimizing && "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
				isDone && "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
				isSkipped && "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50",
				isError && "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
				className,
			)}
		>
			<div className="flex items-center justify-between gap-3">
				{/* Left: icon + text */}
				<div className="flex min-w-0 flex-1 items-center gap-2">
					{isOptimizing && (
						<Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
					)}
					{isDone && <Sparkles className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />}
					{isSkipped && <SkipForward className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />}
					{isError && <Zap className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}

					<div className="min-w-0 flex-1">
						<p className="truncate font-medium text-sm">
							{isOptimizing && progress.message}
							{isDone && (
								<>
									{formatBytes(progress.originalSize)} → {formatBytes(progress.optimizedSize)}
									<span className="ml-1 font-bold text-green-700 dark:text-green-400">
										({savings}% smaller)
									</span>
								</>
							)}
							{isSkipped && progress.message}
							{isError && progress.message}
						</p>

						{isOptimizing && progress.multiThreaded && (
							<p className="text-blue-600 text-xs dark:text-blue-400">Multi-threaded mode</p>
						)}
					</div>
				</div>

				{/* Right: skip button */}
				{isOptimizing && (
					<button
						type="button"
						onClick={onSkip}
						className="shrink-0 rounded-md px-2 py-1 text-blue-700 text-xs hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/50"
					>
						Skip
					</button>
				)}
			</div>

			{/* Progress bar */}
			{isOptimizing && (
				<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-800">
					<div
						className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-400"
						style={{ width: `${Math.max(2, progress.percent)}%` }}
					/>
				</div>
			)}
		</div>
	);
}
