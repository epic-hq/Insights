/**
 * Hook to track lens application progress via Trigger.dev realtime
 *
 * Uses the onComplete callback from useRealtimeRun - the proper way.
 */

import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { useCallback, useMemo } from "react"

export interface LensProgressInfo {
	status: string
	progress: number
	label: string
	isComplete: boolean
	hasError: boolean
}

interface UseLensProgressOptions {
	runId: string | null | undefined
	accessToken: string | null | undefined
	/** Called when the run completes (success or error) */
	onComplete?: () => void
}

export function useLensProgress({ runId, accessToken, onComplete }: UseLensProgressOptions) {
	const shouldSubscribe = Boolean(runId && accessToken)

	// Wrap onComplete to add logging
	const handleComplete = useCallback(
		(run: any, err?: Error) => {
			console.log("[useLensProgress] onComplete fired:", {
				runId: run?.id,
				status: run?.status,
				error: err?.message,
			})
			onComplete?.()
		},
		[onComplete]
	)

	// Build options with onComplete callback - this is the key
	const realtimeOptions = useMemo(() => {
		if (!shouldSubscribe) {
			return { enabled: false as const }
		}
		return {
			accessToken: accessToken as string,
			onComplete: handleComplete,
			stopOnCompletion: true, // Stop subscription when done
		}
	}, [shouldSubscribe, accessToken, handleComplete])

	// Subscribe to the run
	const { run, error: realtimeError } = useRealtimeRun(shouldSubscribe ? (runId as string) : undefined, realtimeOptions)

	// Log subscription state
	if (shouldSubscribe && !run && !realtimeError) {
		console.log("[useLensProgress] Waiting for run data...", runId)
	}

	// Calculate progress info from run
	const progressInfo = useMemo<LensProgressInfo>(() => {
		if (!run) {
			return {
				status: realtimeError ? "error" : "idle",
				progress: 0,
				label: realtimeError ? "Connection error" : "",
				isComplete: false,
				hasError: Boolean(realtimeError),
			}
		}

		const status = run.status ?? "UNKNOWN"
		const isComplete = status === "COMPLETED"
		const hasError = status === "FAILED" || status === "CANCELED"

		// Get progress from task metadata
		const percent =
			typeof run.metadata?.progressPercent === "number"
				? run.metadata.progressPercent
				: isComplete
					? 100
					: hasError
						? 0
						: status === "EXECUTING"
							? 50
							: 10

		const label =
			typeof run.metadata?.stageLabel === "string"
				? run.metadata.stageLabel
				: status === "COMPLETED"
					? "Complete!"
					: status === "FAILED"
						? "Failed"
						: status === "EXECUTING"
							? "Processing..."
							: "Queued..."

		console.log("[useLensProgress] Run status:", status, "progress:", percent)

		return {
			status,
			progress: Math.round(percent),
			label,
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
