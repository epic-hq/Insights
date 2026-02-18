/**
 * UploadRecording Gen-UI Widget
 *
 * Compact, inline file upload for the chat — supports audio, video, text, and PDF.
 * Posts to /api/upload-file and shows progress + result inline.
 */

import {
  CheckCircle,
  FileAudio,
  FileText,
  FileVideo,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface UploadRecordingData {
  projectId: string;
  accountId: string;
  title?: string;
  description?: string;
  participantName?: string;
  participantOrganization?: string;
  acceptTypes?: Array<"audio" | "video" | "text" | "pdf">;
  interviewListUrl?: string;
}

type UploadState = "idle" | "uploading" | "processing" | "success" | "error";

const ACCEPT_MAP: Record<string, Record<string, string[]>> = {
  audio: { "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".webm"] },
  video: { "video/*": [".mp4", ".mov", ".avi", ".webm"] },
  text: { "text/*": [".txt", ".md"] },
  pdf: { "application/pdf": [".pdf"] },
};

function buildAccept(
  types?: Array<"audio" | "video" | "text" | "pdf">,
): Record<string, string[]> {
  const cats = types?.length ? types : ["audio", "video", "text", "pdf"];
  const accept: Record<string, string[]> = {};
  for (const cat of cats) {
    const mapping = ACCEPT_MAP[cat];
    if (mapping) {
      for (const [mime, exts] of Object.entries(mapping)) {
        accept[mime] = [...(accept[mime] ?? []), ...exts];
      }
    }
  }
  return accept;
}

function fileIcon(file: File) {
  if (file.type.startsWith("audio/"))
    return <FileAudio className="h-5 w-5 text-violet-500" />;
  if (file.type.startsWith("video/"))
    return <FileVideo className="h-5 w-5 text-blue-500" />;
  return <FileText className="h-5 w-5 text-amber-500" />;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_MESSAGES: Record<UploadState, string> = {
  idle: "",
  uploading: "Uploading file...",
  processing: "Analyzing conversation...",
  success: "Upload complete!",
  error: "Upload failed",
};

export function UploadRecording({
  data,
}: {
  data: UploadRecordingData;
  isStreaming?: boolean;
}) {
  const [state, setState] = useState<UploadState>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    interviewId?: string;
    title?: string;
    insightCount?: number;
    detailUrl?: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setState("uploading");
      setStatusMsg("Uploading file...");
      setErrorMsg("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", data.projectId);
        formData.append("accountId", data.accountId);
        if (data.participantName)
          formData.append("participantName", data.participantName);
        if (data.participantOrganization)
          formData.append(
            "participantOrganization",
            data.participantOrganization,
          );

        setState("processing");
        const isText =
          file.type.startsWith("text/") ||
          file.name.endsWith(".txt") ||
          file.name.endsWith(".md") ||
          file.name.endsWith(".pdf");
        setStatusMsg(
          isText
            ? "Reading and extracting insights..."
            : "Transcribing and analyzing...",
        );

        const response = await fetch("/api/upload-file", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        const json = await response.json();

        setResult({
          interviewId: json.interviewId,
          title: json.title || file.name,
          insightCount: json.insights?.length ?? 0,
          detailUrl: data.interviewListUrl,
        });
        setState("success");
        setStatusMsg("Upload complete!");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState("idle");
          setStatusMsg("");
          return;
        }
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
        setStatusMsg("");
      } finally {
        abortRef.current = null;
      }
    },
    [data],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setState("idle");
    setSelectedFile(null);
    setStatusMsg("");
    setErrorMsg("");
    setResult(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && handleUpload(files[0]),
    accept: buildAccept(data.acceptTypes),
    multiple: false,
    disabled: state === "uploading" || state === "processing",
  });

  const isWorking = state === "uploading" || state === "processing";

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Header */}
      <div className="border-b bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h4 className="font-semibold">{data.title || "Upload Recording"}</h4>
        </div>
        {data.description && (
          <p className="mt-1 text-muted-foreground text-sm">
            {data.description}
          </p>
        )}
      </div>

      <div className="p-4">
        {/* Success state */}
        {state === "success" && result && (
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-green-900 dark:text-green-100">
                {result.title}
              </p>
              <p className="mt-0.5 text-green-700 text-sm dark:text-green-300">
                {(result.insightCount ?? 0) > 0
                  ? `${result.insightCount} insights extracted`
                  : "Processing in the background..."}
              </p>
              <div className="mt-3 flex gap-2">
                {result.detailUrl && (
                  <Link
                    to={result.detailUrl}
                    className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-green-700"
                  >
                    View Interviews
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Upload Another
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div className="flex items-start gap-3">
            <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-red-900 dark:text-red-100">
                Upload failed
              </p>
              <p className="mt-0.5 text-red-700 text-sm dark:text-red-300">
                {errorMsg}
              </p>
              <button
                type="button"
                onClick={handleCancel}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Idle / working states — drop zone */}
        {(state === "idle" || isWorking) && (
          <>
            <div
              {...getRootProps()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors",
                isDragActive && "border-primary bg-primary/5",
                !isDragActive &&
                  !isWorking &&
                  "border-muted-foreground/25 hover:border-muted-foreground/50",
                isWorking && "cursor-default border-muted-foreground/15",
              )}
            >
              <input {...getInputProps()} />

              {isWorking && selectedFile ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      {fileIcon(selectedFile)}
                      <span className="font-medium text-sm">
                        {selectedFile.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        ({humanSize(selectedFile.size)})
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {statusMsg || STATUS_MESSAGES[state]}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="font-medium text-sm">
                    {isDragActive
                      ? "Drop file here"
                      : "Drop a file or click to browse"}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Audio, video, text transcripts, or PDF
                  </p>
                </div>
              )}
            </div>

            {isWorking && (
              <button
                type="button"
                onClick={handleCancel}
                className="mt-2 text-muted-foreground text-xs hover:text-foreground"
              >
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
