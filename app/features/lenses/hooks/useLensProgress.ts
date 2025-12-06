import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { useMemo } from "react"

export interface LensProgressInfo {
	status: string
	progress: number
	label: string
	stage: string | null
	isComplete: boolean
	hasError: boolean
}

interface UseLensProgressOptions {
	runId: string | null | undefined
	accessToken: string | null | undefined
}

/**
 * Hook to track lens application progress via Trigger.dev realtime
 */
export function useLensProgress({ runId, accessToken }: UseLensProgressOptions) {
	const shouldSubscribe = Boolean(runId && accessToken)

	const realtimeOptions = useMemo(() => {
		if (!shouldSubscribe) {
			return { enabled: false as const }
		}
		return {
			accessToken: accessToken as string,
		}
	}, [shouldSubscribe, accessToken])

	const realtimeRunId = shouldSubscribe ? runId : undefined

	// Use generic run type since this works with both applyLensTask and applyAllLensesTask
	const { run, error: realtimeError } = useRealtimeRun(realtimeRunId as string | undefined, realtimeOptions)

	const progressInfo = useMemo<LensProgressInfo>(() => {
		if (!run || realtimeError) {
			return {
				status: "idle",
				progress: 0,
				label: "",
				stage: null,
				isComplete: false,
				hasError: Boolean(realtimeError),
			}
		}

		const runStatus = run.status ?? "UNKNOWN"
		const isComplete = runStatus === "COMPLETED"
		const hasError = runStatus === "FAILED" || runStatus === "CANCELED"

		// Debug: log status changes
		if (typeof window !== "undefined") {
			console.log("[useLensProgress] Run update:", {
				id: run.id,
				status: runStatus,
				isComplete,
				metadata: run.metadata,
			})
		}

		const percent =
			typeof run.metadata?.progressPercent === "number"
				? run.metadata.progressPercent
				: isComplete
					? 100
					: runStatus === "EXECUTING"
						? 30
						: 10

		const stage = typeof run.metadata?.stage === "string" ? run.metadata.stage : null
		const labelFromMetadata = typeof run.metadata?.stageLabel === "string" ? run.metadata.stageLabel : null

		const label =
			labelFromMetadata ??
			(() => {
				switch (runStatus) {
					case "QUEUED":
						return "Queued for processing..."
					case "EXECUTING":
						return "Applying lens..."
					case "COMPLETED":
						return "Analysis complete!"
					case "FAILED":
					case "CANCELED":
						return "Processing failed"
					default:
						return "Processing..."
				}
			})()

		return {
			status: runStatus,
			progress: Math.round(percent),
			label,
			stage,
			isComplete,
			hasError,
		}
	}, [run, realtimeError])

	return {
		progressInfo,
		isSubscribed: shouldSubscribe && !realtimeError,
		error: realtimeError,
	}
}
