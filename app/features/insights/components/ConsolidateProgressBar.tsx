/**
 * Progress bar for theme consolidation with real-time updates
 */

import { CheckCircle, Loader2, XCircle } from "lucide-react"
import { Progress } from "~/components/ui/progress"
import type { ConsolidateProgressInfo } from "../hooks/useConsolidateProgress"

interface ConsolidateProgressBarProps {
	progress: ConsolidateProgressInfo
	onDismiss?: () => void
}

export function ConsolidateProgressBar({ progress, onDismiss }: ConsolidateProgressBarProps) {
	if (progress.status === "idle") return null

	const getStepIcon = () => {
		if (progress.isComplete) {
			return <CheckCircle className="h-4 w-4 text-green-600" />
		}
		if (progress.hasError) {
			return <XCircle className="h-4 w-4 text-red-600" />
		}
		return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
	}

	return (
		<div className="rounded-lg border bg-card p-4 shadow-sm">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					{getStepIcon()}
					<div className="min-w-0 flex-1">
						<div className="font-medium text-sm">
							{progress.isComplete
								? "Consolidation Complete!"
								: progress.hasError
									? "Consolidation Failed"
									: "Consolidating Themes..."}
						</div>
						<div className="text-muted-foreground text-xs">{progress.label}</div>
					</div>
				</div>
				<div className="flex items-center gap-4">
					{progress.themesDeleted > 0 && (
						<div className="text-right text-xs">
							<span className="font-medium">{progress.themesDeleted}</span>
							<span className="text-muted-foreground"> merged</span>
						</div>
					)}
					{progress.evidenceMoved > 0 && (
						<div className="text-right text-xs">
							<span className="font-medium">{progress.evidenceMoved}</span>
							<span className="text-muted-foreground"> moved</span>
						</div>
					)}
					<div className="w-24">
						<Progress value={progress.progress} className="h-2" />
					</div>
					<span className="w-10 text-right font-medium text-xs">{progress.progress}%</span>
					{(progress.isComplete || progress.hasError) && onDismiss && (
						<button
							type="button"
							onClick={onDismiss}
							className="text-muted-foreground text-xs underline-offset-2 hover:underline"
						>
							Dismiss
						</button>
					)}
				</div>
			</div>
		</div>
	)
}
