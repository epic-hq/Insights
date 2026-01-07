/**
 * Walkthrough video recorder for Ask link creators
 * Records the creator explaining questions while navigating through them
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Square,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type WalkthroughRecorderProps = {
  listId: string;
  existingVideoUrl?: string | null;
  onUploadComplete?: (videoUrl: string) => void;
  onDelete?: () => void;
};

type RecordingState =
  | "idle"
  | "requesting_permission"
  | "preview"
  | "recording"
  | "stopped"
  | "uploading"
  | "complete"
  | "error";

const MAX_RECORDING_SECONDS = 300; // 5 minutes max

function getSupportedVideoMimeType(): string {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return (
    types.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm"
  );
}

export function WalkthroughRecorder({
  listId,
  existingVideoUrl,
  onUploadComplete,
  onDelete,
}: WalkthroughRecorderProps) {
  const [state, setState] = useState<RecordingState>(
    existingVideoUrl ? "complete" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Attach stream to video element when preview/recording state
  useEffect(() => {
    if (
      (state === "preview" || state === "recording") &&
      mediaStreamRef.current &&
      videoPreviewRef.current
    ) {
      videoPreviewRef.current.srcObject = mediaStreamRef.current;
      videoPreviewRef.current.play().catch(() => {
        // Autoplay may be blocked, user will need to interact
      });
    }
  }, [state]);

  const startPreview = useCallback(async () => {
    setState("requesting_permission");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      mediaStreamRef.current = stream;
      setState("preview");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "Camera access denied. Please allow camera and microphone access."
            : err.message
          : "Failed to access camera";
      setError(message);
      setState("error");
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!mediaStreamRef.current) return;

    chunksRef.current = [];
    const mimeType = getSupportedVideoMimeType();

    const recorder = new MediaRecorder(mediaStreamRef.current, {
      mimeType,
      videoBitsPerSecond: 2500000, // 2.5 Mbps
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);

      // Stop the preview stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      setState("stopped");
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000); // Collect data every second
    setState("recording");
    setRecordingSeconds(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => {
        const next = prev + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    setRecordingSeconds(0);
    chunksRef.current = [];
    startPreview();
  }, [videoUrl, startPreview]);

  const cancelRecording = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    chunksRef.current = [];
    setRecordingSeconds(0);
    setState("idle");
  }, [videoUrl]);

  const uploadVideo = useCallback(async () => {
    if (!videoUrl || chunksRef.current.length === 0) return;

    setState("uploading");
    setError(null);

    try {
      const mimeType = getSupportedVideoMimeType();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `walkthrough.${ext}`, { type: mimeType });

      const formData = new FormData();
      formData.append("video", file);

      const response = await fetch(
        `/api/research-links/${listId}/upload-walkthrough`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const result = await response.json();
      setState("complete");
      onUploadComplete?.(result.videoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("error");
    }
  }, [videoUrl, listId, onUploadComplete]);

  const handleDelete = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/research-links/${listId}/delete-walkthrough`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }

      setState("idle");
      onDelete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }, [listId, onDelete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Simple drag handling
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      const startX = e.clientX - position.x;
      const startY = e.clientY - position.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        setPosition({
          x: moveEvent.clientX - startX,
          y: moveEvent.clientY - startY,
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [position],
  );

  // Idle state - show button to start
  if (state === "idle") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Video className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Record a walkthrough video</p>
          <p className="text-muted-foreground text-xs">
            Explain your questions while clicking through them
          </p>
        </div>
        <Button onClick={startPreview} size="sm" className="gap-2">
          <Camera className="h-4 w-4" />
          Start Recording
        </Button>
      </div>
    );
  }

  // Complete state with existing video
  if (state === "complete" && existingVideoUrl) {
    return (
      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="font-medium text-sm">Walkthrough video saved</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setState("idle");
              }}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-record
            </Button>
            <Button
              onClick={handleDelete}
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
        <video
          src={existingVideoUrl}
          className="aspect-video w-full rounded-md bg-black"
          controls
          playsInline
        />
      </div>
    );
  }

  // Recording/Preview states - floating overlay
  return (
    <AnimatePresence>
      <motion.div
        ref={dragRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn(
          "fixed z-50 overflow-hidden rounded-xl border border-white/20 bg-black/90 shadow-2xl backdrop-blur",
          isExpanded ? "h-auto w-96" : "h-auto w-72",
        )}
        style={{ left: position.x, top: position.y }}
      >
        {/* Header - draggable */}
        <div
          className="flex cursor-move items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-white/40" />
            <span className="font-medium text-sm text-white">
              {state === "recording" ? "Recording..." : "Camera Preview"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              className="rounded p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Video area */}
        <div className="relative aspect-video bg-black">
          {/* Requesting permission */}
          {state === "requesting_permission" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
              <p className="text-sm text-white/60">Requesting camera...</p>
            </div>
          )}

          {/* Preview & Recording */}
          {(state === "preview" || state === "recording") && (
            <>
              <video
                ref={videoPreviewRef}
                className="h-full w-full object-cover"
                autoPlay
                playsInline
                muted
              />
              {state === "recording" && (
                <div className="absolute top-2 left-2 flex items-center gap-2 rounded-full bg-red-500 px-2.5 py-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  <span className="font-medium text-xs text-white">
                    {formatTime(recordingSeconds)}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Playback */}
          {(state === "stopped" || state === "uploading") && videoUrl && (
            <video
              ref={videoPlaybackRef}
              src={videoUrl}
              className="h-full w-full object-cover"
              controls
              playsInline
            />
          )}

          {/* Uploading overlay */}
          {state === "uploading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
              <p className="text-sm text-white">Uploading...</p>
            </div>
          )}

          {/* Error state */}
          {state === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
              <AlertCircle className="h-6 w-6 text-red-400" />
              <p className="text-center text-sm text-red-300">{error}</p>
              <Button
                onClick={() => {
                  setError(null);
                  setState("idle");
                }}
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="border-t border-white/10 bg-white/5 p-3">
          {state === "preview" && (
            <div className="flex justify-center gap-2">
              <Button
                onClick={startRecording}
                size="sm"
                className="gap-2 bg-red-500 text-white hover:bg-red-600"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-white" />
                Record
              </Button>
            </div>
          )}

          {state === "recording" && (
            <div className="flex flex-col items-center gap-2">
              <Button
                onClick={stopRecording}
                size="sm"
                className="gap-2 bg-white text-black hover:bg-white/90"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop
              </Button>
              <p className="text-xs text-white/50">
                Max {Math.floor(MAX_RECORDING_SECONDS / 60)} min
              </p>
            </div>
          )}

          {state === "stopped" && (
            <div className="flex justify-center gap-2">
              <Button
                onClick={resetRecording}
                variant="outline"
                size="sm"
                className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Redo
              </Button>
              <Button
                onClick={uploadVideo}
                size="sm"
                className="gap-2 bg-white text-black hover:bg-white/90"
              >
                <Upload className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
