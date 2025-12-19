/**
 * Hook to track theme consolidation progress via Trigger.dev realtime
 *
 * Subscribes to the consolidateThemesTask and provides progress updates.
 */

import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { useCallback, useMemo } from "react"

export interface ConsolidateProgressInfo {
	status: string
	progress: number
	step: string
	label: string
	clustersFound: number
	themesDeleted: number
	evidenceMoved: number
	isComplete: boolean
	hasError: boolean
}

interface UseConsolidateProgressOptions {
	runId: string | null | undefined
	accessToken: string | null | undefined
	/** Called when the run completes (success or error) */
	onComplete?: () => void
}

export function useConsolidateProgress({ runId, accessToken, onComplete }: UseConsolidateProgressOptions) {
	const shouldSubscribe = Boolean(runId && accessToken)

	const handleComplete = useCallback(
		(run: any, err?: Error) => {
			console.log("[useConsolidateProgress] onComplete:", {
				runId: run?.id,
				status: run?.status,
				error: err?.message,
			})
			onComplete?.()
		},
		[onComplete]
	)

	const realtimeOptions = useMemo(() => {
		if (!shouldSubscribe) {
			return { enabled: false as const }
		}
		return {
			accessToken: accessToken as string,
			onComplete: handleComplete,
			stopOnCompletion: true,
		}
	}, [shouldSubscribe, accessToken, handleComplete])

	const { run, error: realtimeError } = useRealtimeRun(shouldSubscribe ? (runId as string) : undefined, realtimeOptions)

	const progressInfo = useMemo<ConsolidateProgressInfo>(() => {
		if (!run) {
			return {
				status: realtimeError ? "error" : "idle",
				progress: 0,
				step: "",
				label: realtimeError ? "Connection error" : "",
				clustersFound: 0,
				themesDeleted: 0,
				evidenceMoved: 0,
				isComplete: false,
				hasError: Boolean(realtimeError),
			}
		}

		const status = run.status ?? "UNKNOWN"
		const isComplete = status === "COMPLETED"
		const hasError = status === "FAILED" || status === "CANCELED"

		// Get progress from metadata (set by consolidateThemesTask)
		const metadata = run.metadata as {
			progress?: number
			step?: string
			status?: string
			clustersFound?: number
			themesDeleted?: number
			evidenceMoved?: number
		} | null

		const progress = typeof metadata?.progress === "number" ? metadata.progress : isComplete ? 100 : hasError ? 0 : 10

		const step = typeof metadata?.step === "string" ? metadata.step : ""
		const label =
			typeof metadata?.status === "string"
				? metadata.status
				: isComplete
					? "Complete!"
					: hasError
						? "Failed"
						: "Processing..."

		return {
			status,
			progress: Math.round(progress),
			step,
			label,
			clustersFound: metadata?.clustersFound ?? 0,
			themesDeleted: metadata?.themesDeleted ?? 0,
			evidenceMoved: metadata?.evidenceMoved ?? 0,
			isComplete,
			hasError,
		}
	}, [run, realtimeError])

	return {
		progressInfo,
		isSubscribed: shouldSubscribe && !realtimeError,
		run,
		error: realtimeError,
	}
}
