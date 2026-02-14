import { useRealtimeRun } from "@trigger.dev/react-hooks";
import consola from "consola";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { processInterviewOrchestratorV2 } from "~/../src/trigger/interview/v2/orchestrator";
import { createClient } from "~/lib/supabase/client";
import type { Database } from "~/types";

export interface ProgressInfo {
	status: string;
	progress: number;
	label: string;
	isComplete: boolean;
	hasError: boolean;
	currentStep?: string;
	completedSteps?: string[];
	canCancel?: boolean;
	analysisJobId?: string;
	triggerRunId?: string;
}

/** Minimal interview data needed for progress tracking */
export interface InterviewProgressData {
	id: string;
	status: string | null;
	processing_metadata?: unknown;
	conversation_analysis?: unknown;
}

interface UseInterviewProgressOptions {
	/** Minimal interview data: id, status, processing_metadata, conversation_analysis */
	interview?: InterviewProgressData | null;
	/** Trigger.dev run ID for realtime run status */
	runId?: string;
	/** Access token for Trigger.dev realtime */
	accessToken?: string;
}

type ProgressMetadata = {
	current_step?: string;
	progress?: number;
	status_detail?: string;
	trigger_run_id?: string;
	failed_at?: string;
	completed_steps?: string[];
	error?: string;
};

/**
 * Hook to compute interview processing progress.
 * Pure computation from interview data + optional Trigger.dev realtime.
 */
export function useInterviewProgress({ interview, runId, accessToken }: UseInterviewProgressOptions) {
	const [syntheticProgress, setSyntheticProgress] = useState(5);
	const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
	const lastStatusRef = useRef<string | null>(null);

	// Trigger.dev realtime subscription
	const shouldSubscribeToRun = Boolean(runId && accessToken);

	const realtimeOptions = useMemo(() => {
		if (!shouldSubscribeToRun) {
			return { enabled: false as const };
		}
		return { accessToken: accessToken as string };
	}, [shouldSubscribeToRun, accessToken]);

	const realtimeRunId = shouldSubscribeToRun ? runId : undefined;

	const { run, error: realtimeError } = useRealtimeRun<typeof processInterviewOrchestratorV2>(
		realtimeRunId,
		realtimeOptions
	);

	const isRealtime = Boolean(shouldSubscribeToRun && run && !realtimeError);

	useEffect(() => {
		if (realtimeError) {
			consola.warn("Trigger.dev realtime connection failed", realtimeError);
		}
	}, [realtimeError]);

	const cleanupTimers = useCallback(() => {
		if (progressTimerRef.current) {
			clearInterval(progressTimerRef.current);
			progressTimerRef.current = null;
		}
	}, []);

	const getProgressDuration = useCallback((status: string): number => {
		switch (status) {
			case "uploading":
			case "uploaded":
				return 15;
			case "transcribing":
				return 45;
			case "processing":
				return 30;
			default:
				return 10;
		}
	}, []);

	const startSyntheticProgress = useCallback(
		(currentStatus: string, startProgress: number, targetProgress: number) => {
			cleanupTimers();
			setSyntheticProgress(startProgress);

			const duration = getProgressDuration(currentStatus);
			const steps = duration * 4;
			const increment = (targetProgress - startProgress) / steps;

			let currentStep = 0;
			progressTimerRef.current = setInterval(() => {
				currentStep++;
				const newProgress = Math.min(startProgress + increment * currentStep, targetProgress);
				setSyntheticProgress(newProgress);

				if (currentStep >= steps) {
					cleanupTimers();
				}
			}, 250);
		},
		[cleanupTimers, getProgressDuration]
	);

	useEffect(() => {
		return () => cleanupTimers();
	}, [cleanupTimers]);

	const progressInfo = useMemo((): ProgressInfo => {
		// Priority 1: Interview data (single source of truth for completion/error)
		if (!interview) {
			return {
				status: "loading",
				progress: 0,
				label: "Loading...",
				isComplete: false,
				hasError: false,
			};
		}

		const metadata =
			((interview.processing_metadata ?? interview.conversation_analysis) as ProgressMetadata | null) ?? null;

		if (interview.status === "ready") {
			return {
				status: "ready",
				progress: 100,
				label: "Analysis complete!",
				isComplete: true,
				hasError: false,
			};
		}

		if (interview.status === "error") {
			const errorMsg = metadata?.error || "Processing failed";
			return {
				status: "error",
				progress: 0,
				label: errorMsg,
				isComplete: false,
				hasError: true,
			};
		}

		// Priority 2: Trigger.dev run metadata (only while interview is still active)
		if (run && !realtimeError) {
			const runStatus = run.status ?? "UNKNOWN";
			const isComplete = runStatus === "COMPLETED";
			const hasError = runStatus === "FAILED" || runStatus === "CANCELED";

			const percent =
				typeof run.metadata?.progressPercent === "number"
					? run.metadata.progressPercent
					: isComplete
						? 100
						: runStatus === "EXECUTING"
							? 60
							: 15;

			const labelFromMetadata = typeof run.metadata?.stageLabel === "string" ? run.metadata.stageLabel : null;

			const label =
				labelFromMetadata ??
				(() => {
					switch (runStatus) {
						case "QUEUED":
							return "Queued for processing...";
						case "EXECUTING":
							return "Processing...";
						case "COMPLETED":
							return "Analysis complete!";
						case "FAILED":
						case "CANCELED":
							return "Processing failed";
						default:
							return "Processing...";
					}
				})();

			return {
				status: runStatus,
				progress: Math.round(percent),
				label,
				isComplete,
				hasError,
			};
		}

		if (metadata?.current_step) {
			const currentStep = metadata.current_step;
			const jobProgress = metadata.progress ?? 0;
			const statusDetail = metadata.status_detail;
			const triggerRunId = metadata.trigger_run_id;

			const isActiveJob = interview.status === "processing";
			const isComplete = currentStep === "complete";
			const hasError = Boolean(metadata.failed_at);
			const canCancel = isActiveJob && Boolean(triggerRunId);

			const stepLabels: Record<string, string> = {
				upload: "Uploading and transcribing...",
				evidence: "Extracting evidence...",
				insights: "Generating insights...",
				personas: "Assigning personas...",
				answers: "Attributing to questions...",
				finalize: "Finalizing analysis...",
				complete: "Analysis complete!",
			};

			const label = statusDetail || stepLabels[currentStep] || "Processing...";

			return {
				status: interview.status ?? "unknown",
				progress: Math.round(jobProgress),
				label,
				isComplete,
				hasError,
				currentStep,
				completedSteps: metadata.completed_steps,
				canCancel,
				analysisJobId: interview.id,
				triggerRunId: triggerRunId ?? undefined,
			};
		}

		// Fallback: derive from status with synthetic progress
		const status = interview.status;
		let baseProgress = 0;
		let label = "Starting...";
		let isComplete = false;
		let hasError = false;

		switch (status) {
			case "uploading":
				baseProgress = 5;
				label = "Uploading file...";
				break;
			case "uploaded":
				baseProgress = 25;
				label = "Upload complete, starting transcription...";
				break;
			case "transcribing":
				baseProgress = 35;
				label = "Transcribing audio...";
				break;
			case "transcribed":
				baseProgress = 65;
				label = "Transcription complete...";
				break;
			case "processing":
				baseProgress = 75;
				label = "Analyzing content...";
				break;
			case "ready":
				baseProgress = 100;
				label = "Analysis complete!";
				isComplete = true;
				break;
			case "error":
				baseProgress = 0;
				label = "Processing failed";
				hasError = true;
				break;
			default:
				baseProgress = 5;
				label = "Initializing...";
		}

		const displayProgress = isComplete || hasError ? baseProgress : syntheticProgress;

		return {
			status: status ?? "unknown",
			progress: Math.round(displayProgress),
			label,
			isComplete,
			hasError,
		};
	}, [interview, run, realtimeError, syntheticProgress]);

	// Synthetic progress animation
	useEffect(() => {
		if (!interview) return;
		if (run && !realtimeError) return;

		const metadata =
			((interview.processing_metadata ?? interview.conversation_analysis) as ProgressMetadata | null) ?? null;
		if (metadata?.current_step) return;

		const status = interview.status;
		if (!status) return;

		const progressRanges: Record<string, [number, number]> = {
			uploading: [5, 25],
			uploaded: [25, 35],
			transcribing: [35, 65],
			transcribed: [65, 75],
			processing: [75, 95],
		};

		const range = progressRanges[status];
		if (range && lastStatusRef.current !== status) {
			startSyntheticProgress(status, range[0], range[1]);
			lastStatusRef.current = status;
		} else if (status === "ready" || status === "error") {
			cleanupTimers();
			lastStatusRef.current = status;
		}
	}, [interview, run, realtimeError, startSyntheticProgress, cleanupTimers]);

	return {
		progressInfo,
		isRealtime,
	};
}

/**
 * Hook to fetch and subscribe to interview updates.
 * Use this when you don't have interview data from a parent component.
 */
export function useRealtimeInterview(interviewId: string | null | undefined) {
	const [interview, setInterview] = useState<InterviewProgressData | null>(null);
	const supabase = useMemo(() => createClient(), []);

	useEffect(() => {
		if (!interviewId) return;

		const fetchData = async () => {
			const { data, error } = await supabase
				.from("interviews")
				.select("id, status, processing_metadata, conversation_analysis")
				.eq("id", interviewId)
				.single();

			if (data && !error) {
				setInterview(data);
			} else {
				consola.error("[useRealtimeInterview] Failed to fetch", error);
			}
		};

		fetchData();

		const channel = supabase
			.channel(`interview_progress_${interviewId}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "interviews",
					filter: `id=eq.${interviewId}`,
				},
				(payload) => {
					const raw = payload.new as Database["public"]["Tables"]["interviews"]["Row"] | undefined;
					if (raw) {
						setInterview({
							id: raw.id,
							status: raw.status,
							processing_metadata: raw.processing_metadata,
							conversation_analysis: raw.conversation_analysis,
						});
					}
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [interviewId, supabase]);

	return interview;
}
