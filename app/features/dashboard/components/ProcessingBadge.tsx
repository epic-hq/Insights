/**
 * ProcessingBadge - Compact indicator for processing conversations
 *
 * Small badge-style component showing processing count with reset option.
 */

import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export interface ProcessingBadgeProps {
	/** Number of items currently processing */
	processingCount: number;
	/** Additional CSS classes */
	className?: string;
}

export function ProcessingBadge({ processingCount, className }: ProcessingBadgeProps) {
	const [isResetting, setIsResetting] = useState(false);
	const [open, setOpen] = useState(false);
	const fetcher = useFetcher();
	const revalidator = useRevalidator();

	// Revalidate page data when reset completes successfully
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data?.success && isResetting) {
			revalidator.revalidate();
		}
	}, [fetcher.state, fetcher.data, revalidator, isResetting]);

	// Track when revalidation completes
	useEffect(() => {
		if (revalidator.state === "idle" && isResetting && fetcher.data?.success) {
			setIsResetting(false);
			setOpen(false);
		}
	}, [revalidator.state, isResetting, fetcher.data]);

	const handleReset = () => {
		setIsResetting(true);
		fetcher.submit(
			{ fixAll: true },
			{
				method: "POST",
				action: "/api/fix-stuck-interview",
				encType: "application/json",
			}
		);
	};

	if (processingCount === 0) {
		return null;
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700 text-xs dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
						className
					)}
				>
					<Loader2 className="h-3 w-3 animate-spin" />
					<span>
						Processing {processingCount} conversation{processingCount !== 1 ? "s" : ""}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-56 p-3" align="end">
				<div className="space-y-2">
					<p className="text-muted-foreground text-xs">
						AI is analyzing your conversations. This usually takes a few minutes.
					</p>
					{isResetting ? (
						<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
							<Loader2 className="h-3 w-3 animate-spin" />
							<span>Resetting...</span>
						</div>
					) : (
						<Button variant="ghost" size="sm" className="h-7 w-full text-xs" onClick={handleReset}>
							<RotateCcw className="mr-1.5 h-3 w-3" />
							Reset stuck interviews
						</Button>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export default ProcessingBadge;
