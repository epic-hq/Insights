/**
 * Video editor component for per-question intro videos
 * Supports: record in-app, upload file, or add remote URL
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Link2,
  Loader2,
  RefreshCw,
  Square,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type QuestionVideoEditorProps = {
  listId: string;
  questionId: string;
  existingVideoUrl?: string | null;
  onVideoChange: (videoUrl: string | null) => void;
};

type EditorMode = "idle" | "record" | "upload" | "url";

type RecordingState =
  | "idle"
  | "requesting_permission"
  | "preview"
  | "recording"
  | "stopped"
  | "uploading"
  | "complete"
  | "error";

const MAX_RECORDING_SECONDS = 180; // 3 minutes max for question intro

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

export function QuestionVideoEditor({
  listId,
  questionId,
  existingVideoUrl,
  onVideoChange,
}: QuestionVideoEditorProps) {
  const [mode, setMode] = useState<EditorMode>("idle");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const startPreview = useCallback(async () => {
    setRecordingState("requesting_permission");
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

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        await videoPreviewRef.current.play();
      }

      setRecordingState("preview");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "Camera access denied. Please allow camera and microphone access."
            : err.message
          : "Failed to access camera";
      setError(message);
      setRecordingState("error");
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!mediaStreamRef.current) return;

    chunksRef.current = [];
    const mimeType = getSupportedVideoMimeType();

    const recorder = new MediaRecorder(mediaStreamRef.current, {
      mimeType,
      videoBitsPerSecond: 2500000,
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

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      setRecordingState("stopped");
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecordingState("recording");
    setRecordingSeconds(0);

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

  const cancelMode = useCallback(() => {
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
    setRecordingState("idle");
    setMode("idle");
    setUrlInput("");
    setError(null);
  }, [videoUrl]);

  const uploadRecordedVideo = useCallback(async () => {
    if (!videoUrl || chunksRef.current.length === 0) return;

    setRecordingState("uploading");
    setError(null);

    try {
      const mimeType = getSupportedVideoMimeType();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `question-video.${ext}`, {
        type: mimeType,
      });

      const formData = new FormData();
      formData.append("video", file);
      formData.append("questionId", questionId);

      const response = await fetch(
        `/api/research-links/${listId}/upload-question-video`,
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
      setRecordingState("complete");
      onVideoChange(result.videoUrl);
      setMode("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setRecordingState("error");
    }
  }, [videoUrl, listId, questionId, onVideoChange]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        setError("Please select a video file");
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("video", file);
        formData.append("questionId", questionId);

        const response = await fetch(
          `/api/research-links/${listId}/upload-question-video`,
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
        onVideoChange(result.videoUrl);
        setMode("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [listId, questionId, onVideoChange],
  );

  const handleUrlSubmit = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
      onVideoChange(trimmed);
      setMode("idle");
      setUrlInput("");
    } catch {
      setError("Please enter a valid URL");
    }
  }, [urlInput, onVideoChange]);

  const handleDelete = useCallback(() => {
    onVideoChange(null);
  }, [onVideoChange]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // If there's an existing video, show it with option to delete/replace
  if (existingVideoUrl && mode === "idle") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-muted-foreground text-xs">
              Video attached
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
              onClick={() => setMode("record")}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground text-xs hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Remove
            </Button>
          </div>
        </div>
        <video
          src={existingVideoUrl}
          className="aspect-video w-full rounded-lg bg-black"
          controls
          playsInline
        />
      </div>
    );
  }

  // Idle state - show add video options
  if (mode === "idle") {
    return (
      <div className="flex items-center gap-2">
        <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground text-xs">Add intro video:</span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
            onClick={() => {
              setMode("record");
              startPreview();
            }}
          >
            <Camera className="mr-1 h-3 w-3" />
            Record
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
            onClick={() => {
              setMode("upload");
              fileInputRef.current?.click();
            }}
          >
            <Upload className="mr-1 h-3 w-3" />
            Upload
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
            onClick={() => setMode("url")}
          >
            <Link2 className="mr-1 h-3 w-3" />
            URL
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFileUpload(file);
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  // URL input mode
  if (mode === "url") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="Enter video URL"
            className="h-8 flex-1 text-xs"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleUrlSubmit();
              }
            }}
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8"
            onClick={handleUrlSubmit}
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={cancelMode}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // Upload mode (shows uploading state)
  if (mode === "upload") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Upload className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {isUploading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Uploading video...
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={cancelMode}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFileUpload(file);
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  // Record mode
  return (
    <div className="space-y-2">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black/90">
        {/* Requesting permission */}
        {recordingState === "requesting_permission" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            <p className="text-sm text-white/60">Requesting camera...</p>
          </div>
        )}

        {/* Preview & Recording */}
        {(recordingState === "preview" || recordingState === "recording") && (
          <>
            <video
              ref={videoPreviewRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />
            {recordingState === "recording" && (
              <div className="absolute top-2 left-2 flex items-center gap-2 rounded-full bg-red-500 px-2.5 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                <span className="font-medium text-white text-xs">
                  {formatTime(recordingSeconds)}
                </span>
              </div>
            )}
          </>
        )}

        {/* Playback */}
        {(recordingState === "stopped" || recordingState === "uploading") &&
          videoUrl && (
            <video
              src={videoUrl}
              className="h-full w-full object-cover"
              controls
              playsInline
            />
          )}

        {/* Uploading overlay */}
        {recordingState === "uploading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <p className="text-sm text-white">Uploading...</p>
          </div>
        )}

        {/* Error state */}
        {recordingState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <p className="text-center text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-2">
        {recordingState === "preview" && (
          <>
            <Button
              type="button"
              onClick={startRecording}
              size="sm"
              className="gap-2 bg-red-500 text-white hover:bg-red-600"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
              Record
            </Button>
            <Button
              type="button"
              onClick={cancelMode}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </>
        )}

        {recordingState === "recording" && (
          <Button
            type="button"
            onClick={stopRecording}
            size="sm"
            className="gap-2 bg-white text-black hover:bg-white/90"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </Button>
        )}

        {recordingState === "stopped" && (
          <>
            <Button
              type="button"
              onClick={resetRecording}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Redo
            </Button>
            <Button
              type="button"
              onClick={uploadRecordedVideo}
              size="sm"
              className="gap-2"
            >
              <Upload className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button
              type="button"
              onClick={cancelMode}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </>
        )}

        {recordingState === "error" && (
          <>
            <Button
              type="button"
              onClick={startPreview}
              variant="outline"
              size="sm"
            >
              Try Again
            </Button>
            <Button
              type="button"
              onClick={cancelMode}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
