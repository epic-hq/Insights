import consola from "consola";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useInterviewProgress,
  useRealtimeInterview,
} from "~/hooks/useInterviewProgress";
import type { UploadProgress } from "~/utils/r2-upload.client";

interface ProcessingScreenProps {
  fileName: string;
  onComplete: () => void;
  interviewId?: string;
  triggerRunId?: string;
  triggerAccessToken?: string;
  uploadProgress?: UploadProgress;
  isUploading?: boolean;
}

export default function ProcessingScreen({
  fileName,
  onComplete,
  interviewId,
  triggerRunId,
  triggerAccessToken,
  uploadProgress,
  isUploading,
}: ProcessingScreenProps) {
  const [pollingAttempted, setPollingAttempted] = useState(false);
  const stuckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  // Fetch interview data with realtime subscription (fallback when Trigger.dev unavailable)
  const interview = useRealtimeInterview(interviewId);

  // Compute progress from interview data + Trigger.dev realtime
  const { progressInfo, isRealtime } = useInterviewProgress({
    interview,
    runId: triggerRunId,
    accessToken: triggerAccessToken,
  });
  const {
    progress,
    label: processingStage,
    isComplete,
    hasError,
    status,
  } = progressInfo;
  const showUploadProgress = isUploading && uploadProgress != null;
  const displayProgress = showUploadProgress
    ? uploadProgress.percent
    : progress;

  // Build stage text with part info if multipart upload
  const displayStage = (() => {
    if (!showUploadProgress) return processingStage;
    if (uploadProgress.phase === "completing") return "Finalizing upload...";
    if (uploadProgress.part) {
      return `Uploading part ${uploadProgress.part.index} of ${uploadProgress.part.total}`;
    }
    return "Uploading...";
  })();

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  // Polling fallback: if stuck in transcription without Trigger.dev, poll AssemblyAI
  const checkStuckTranscription = useCallback(async () => {
    if (!interviewId || pollingAttempted) return;

    consola.info("[ProcessingScreen] Checking stuck transcription...");
    setPollingAttempted(true);

    try {
      const response = await fetch("/api/interviews/check-transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      });

      const result = await response.json();
      consola.info("[ProcessingScreen] Check result:", result);

      if (result.runId) {
        consola.success(
          "[ProcessingScreen] Processing resumed via polling fallback",
        );
      }
    } catch (error) {
      consola.error("[ProcessingScreen] Polling fallback failed:", error);
    }
  }, [interviewId, pollingAttempted]);

  // Detect stuck transcription: no Trigger.dev run and status hasn't changed
  useEffect(() => {
    const currentStatus = interview?.status;

    // Clear timer if status changed or we have a Trigger.dev run
    if (currentStatus !== lastStatusRef.current || isRealtime || isComplete) {
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = null;
      }
      lastStatusRef.current = currentStatus ?? null;
    }

    // Start stuck detection if in transcription/processing without Trigger.dev
    const isStuckCandidate =
      !isRealtime &&
      !isComplete &&
      !pollingAttempted &&
      (currentStatus === "processing" || currentStatus === "uploaded");

    if (isStuckCandidate && !stuckTimerRef.current) {
      consola.info("[ProcessingScreen] Starting stuck detection timer (30s)");
      stuckTimerRef.current = setTimeout(() => {
        consola.warn(
          "[ProcessingScreen] Interview appears stuck, triggering polling fallback",
        );
        checkStuckTranscription();
      }, 30000);
    }

    return () => {
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
      }
    };
  }, [
    interview?.status,
    isRealtime,
    isComplete,
    pollingAttempted,
    checkStuckTranscription,
  ]);

  // Auto-complete when processing is done
  useEffect(() => {
    if (isComplete) {
      setTimeout(onComplete, 1000);
    }
  }, [isComplete, onComplete]);

  // Derive display status
  const getStatusText = () => {
    if (showUploadProgress) return "Uploading";
    if (hasError) return "Error";
    if (isComplete) return "Complete";
    if (isRealtime) return "Connected";
    if (triggerRunId) return "Connecting...";
    return "Queued";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Spinner */}
        <div className="flex justify-center">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            {isRealtime && (
              <span className="-right-1 -top-1 absolute h-3 w-3 rounded-full bg-green-500" />
            )}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <h1 className="font-medium text-foreground text-xl">
            {displayStage}
          </h1>
          <p className="text-muted-foreground text-sm">{fileName}</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>
              {showUploadProgress && uploadProgress.totalBytes > 0
                ? `${formatBytes(uploadProgress.bytesSent)} / ${formatBytes(uploadProgress.totalBytes)}`
                : `${Math.round(displayProgress)}%`}
            </span>
            <span>{getStatusText()}</span>
          </div>
        </div>

        {/* Navigation safety message */}
        <p className="text-muted-foreground text-sm">
          {showUploadProgress
            ? "Please stay on this page while uploading. Leaving will cancel the upload."
            : "You can safely navigate away. We'll notify you when processing is complete."}
        </p>

        {/* Debug info (only in development or when stuck) */}
        {(status === "loading" || hasError) && (
          <div className="space-y-1 rounded-md bg-muted/50 p-3 text-left font-mono text-xs">
            <div className="text-muted-foreground">
              Interview: {interviewId ? interviewId.slice(0, 8) + "..." : "—"}
            </div>
            <div className="text-muted-foreground">
              Run: {triggerRunId ? triggerRunId.slice(0, 12) + "..." : "—"}
            </div>
            <div className="text-muted-foreground">
              Status: {status} | Realtime: {isRealtime ? "yes" : "no"}
            </div>
            {hasError && (
              <div className="text-destructive">{processingStage}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
