import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import { useDeviceDetection } from "~/hooks/useDeviceDetection";
import { isPaidPlan, useAccountPlan } from "~/hooks/useAccountPlan";
import {
  extractAudioOnly,
  isVideoFile,
  optimizeMediaFile,
  shouldOptimize,
} from "~/utils/media-optimizer.client";
import {
  type UploadProgress,
  uploadToR2WithProgress,
} from "~/utils/r2-upload.client";
import ProcessingScreen from "./ProcessingScreen";
import ProjectGoalsScreen from "./ProjectGoalsScreen";
import ProjectStatusScreen from "./ProjectStatusScreen";
import QuestionsScreen from "./QuestionsScreen";
import UploadScreen from "./UploadScreen";

/**
 * Capture a thumbnail frame from a video file using a hidden video element + canvas.
 * Seeks to 1 second (or 0 if short) and captures a 640px-wide JPEG.
 */
async function captureVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    let resolved = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    }, 10000);

    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% of duration, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          "image/jpeg",
          0.8,
        );
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve(null);
      }
    };

    video.src = url;
  });
}

type OnboardingStep =
  | "welcome"
  | "questions"
  | "upload"
  | "processing"
  | "complete";

export interface OnboardingData {
  target_orgs: string[];
  target_roles: string[];
  research_goal: string;
  research_goal_details: string;
  decision_questions: string[];
  assumptions: string[];
  unknowns: string[];
  custom_instructions?: string;
  questions: string[];
  file?: File;
  mediaType?: string;
  interviewId?: string;
  projectId?: string;
  uploadLabel?: string;
  uploadedUrl?: string;
  triggerRunId?: string;
  triggerAccessToken?: string | null;
  error?: string;
  personId?: string;
}

type UploadResponse<T> =
  | {
      ok: true;
      status: number;
      data: T;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

interface OnboardingStartResponseData {
  interview?: {
    id?: string;
    account_id?: string;
  };
  project?: {
    id?: string;
    account_id?: string;
  };
  triggerRun?: {
    id?: string;
    publicToken?: string | null;
  };
}

const MULTIPART_COMPLETE_TIMEOUT_MS = 2 * 60 * 1000;
const MULTIPART_ABORT_TIMEOUT_MS = 30 * 1000;

type UploadSourceType =
  | "audio_upload"
  | "video_upload"
  | "document"
  | "transcript";

type PresignedUploadResponse =
  | {
      type: "single";
      uploadUrl: string;
      key: string;
      expiresAt: string;
    }
  | {
      type: "multipart";
      key: string;
      uploadId: string;
      partUrls: Record<number, string>;
      partSize: number;
      totalParts: number;
      expiresAt: string;
    };

function postFormDataWithProgress<T>({
  url,
  formData,
  onProgress,
  onStatusChange,
}: {
  url: string;
  formData: FormData;
  onProgress?: (progress: number) => void;
  onStatusChange?: (status: string) => void;
}): Promise<UploadResponse<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    // 10 minute timeout for large files
    xhr.timeout = 600000;

    // Track upload start to confirm XHR is actually sending
    xhr.upload.onloadstart = () => {
      console.log("[Upload] Upload started");
      onStatusChange?.("uploading");
    };

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        console.log("[Upload] Progress event (not computable)");
        return;
      }
      const percent = Math.round((event.loaded / event.total) * 100);
      console.log(
        `[Upload] Progress: ${percent}% (${event.loaded}/${event.total})`,
      );
      onProgress?.(percent);
    };

    xhr.upload.onload = () => {
      console.log("[Upload] Upload complete, waiting for server response...");
      onStatusChange?.("processing");
    };

    xhr.upload.onerror = (event) => {
      console.error("[Upload] Upload error:", event);
      onStatusChange?.("error");
    };

    xhr.onload = () => {
      const status = xhr.status;
      console.log(`[Upload] Server response: ${status}`);
      const responseBody =
        xhr.response ??
        (() => {
          try {
            return xhr.responseText ? JSON.parse(xhr.responseText) : null;
          } catch {
            return null;
          }
        })();

      if (status >= 200 && status < 300) {
        resolve({ ok: true, status, data: responseBody as T });
        return;
      }

      const errorMessage =
        (responseBody &&
        typeof responseBody === "object" &&
        "error" in responseBody
          ? String((responseBody as { error?: string }).error)
          : xhr.statusText) || "Upload failed";
      resolve({ ok: false, status, error: errorMessage });
    };

    xhr.onerror = (event) => {
      console.error(
        "[Upload] XHR error:",
        event,
        "readyState:",
        xhr.readyState,
        "status:",
        xhr.status,
      );
      reject(
        new Error(
          `Upload failed: Network error (readyState: ${xhr.readyState})`,
        ),
      );
    };

    xhr.ontimeout = () => {
      console.error("[Upload] XHR timeout after 10 minutes");
      reject(
        new Error(
          "Upload timed out after 10 minutes. Try a smaller file or check your connection.",
        ),
      );
    };

    xhr.onabort = () => {
      console.log("[Upload] XHR aborted");
      reject(new Error("Upload was cancelled"));
    };

    // Log before sending to confirm we reach this point
    console.log("[Upload] Starting XHR send to:", url);
    xhr.send(formData);
  });
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getUploadSourceType(file: File): UploadSourceType {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (
    mimeType.startsWith("text/") ||
    ["txt", "md", "markdown"].includes(extension || "")
  ) {
    return "transcript";
  }
  if (mimeType === "application/pdf" || extension === "pdf") {
    return "transcript";
  }
  if (
    mimeType.includes("document") ||
    mimeType.includes("spreadsheet") ||
    ["doc", "docx", "csv", "xlsx"].includes(extension || "")
  ) {
    return "document";
  }
  if (
    mimeType.startsWith("video/") ||
    ["mp4", "mov", "avi", "mkv", "webm"].includes(extension || "")
  ) {
    return "video_upload";
  }
  if (
    mimeType.startsWith("audio/") ||
    ["mp3", "wav", "m4a", "ogg", "flac"].includes(extension || "")
  ) {
    return "audio_upload";
  }
  return "document";
}

function isAudioVideoSourceType(sourceType: UploadSourceType): boolean {
  return sourceType === "audio_upload" || sourceType === "video_upload";
}

function createOnboardingPayload(data: OnboardingData, mediaType: string) {
  return {
    target_orgs: data.target_orgs,
    target_roles: data.target_roles,
    research_goal: data.research_goal,
    research_goal_details: data.research_goal_details,
    decision_questions: data.decision_questions,
    assumptions: data.assumptions,
    unknowns: data.unknowns,
    custom_instructions: data.custom_instructions,
    questions: data.questions,
    mediaType,
  };
}

async function requestPresignedUpload({
  projectId,
  file,
}: {
  projectId: string;
  file: File;
}): Promise<PresignedUploadResponse> {
  let presignedResponse: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    presignedResponse = await fetch("/api/upload/presigned-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
      }),
    });

    if (presignedResponse.status !== 503 || attempt === 2) break;
    console.warn(
      `[Upload] Presigned URL returned 503, retrying (attempt ${attempt + 1}/3)...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }

  if (!presignedResponse?.ok) {
    const errorData = await presignedResponse?.json().catch(() => ({}));
    throw new Error(
      errorData?.error ||
        `Failed to get upload URL (${presignedResponse?.status ?? "unknown"})`,
    );
  }

  return (await presignedResponse.json()) as PresignedUploadResponse;
}

async function uploadFileWithPresignedUrl({
  file,
  presignedData,
  onProgress,
  onMultipartPhase,
}: {
  file: File;
  presignedData: PresignedUploadResponse;
  onProgress: (progress: UploadProgress) => void;
  onMultipartPhase?: (progress: UploadProgress) => void;
}): Promise<string> {
  if (presignedData.type === "multipart") {
    await uploadToR2WithProgress({
      file,
      singlePartUrl: "",
      contentType: file.type || "application/octet-stream",
      multipartThresholdBytes: 0,
      partSizeBytes: presignedData.partSize,
      multipartHandlers: {
        createMultipartUpload: async () => ({
          uploadId: presignedData.uploadId,
          partUrls: presignedData.partUrls,
        }),
        completeMultipartUpload: async ({ parts }) => {
          const completeResponse = await fetchWithTimeout(
            "/api/upload/presigned-url?action=complete",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: presignedData.key,
                uploadId: presignedData.uploadId,
                parts: parts.map((part) => ({
                  partNumber: part.partNumber,
                  etag: part.etag,
                })),
              }),
            },
            MULTIPART_COMPLETE_TIMEOUT_MS,
          );

          if (!completeResponse.ok) {
            const errorData = await completeResponse.json().catch(() => ({}));
            throw new Error(
              errorData.error || "Failed to complete multipart upload",
            );
          }
        },
        abortMultipartUpload: async () => {
          const abortResponse = await fetchWithTimeout(
            "/api/upload/presigned-url?action=abort",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: presignedData.key,
                uploadId: presignedData.uploadId,
              }),
            },
            MULTIPART_ABORT_TIMEOUT_MS,
          );

          if (!abortResponse.ok) {
            const errorData = await abortResponse.json().catch(() => ({}));
            throw new Error(
              errorData.error || "Failed to abort multipart upload",
            );
          }
        },
      },
      onProgress: (progress) => {
        onMultipartPhase?.(progress);
        onProgress(progress);
      },
    });

    return presignedData.key;
  }

  await uploadToR2WithProgress({
    file,
    singlePartUrl: presignedData.uploadUrl,
    contentType: file.type || "application/octet-stream",
    onProgress,
  });

  return presignedData.key;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
  onAddMoreInterviews: () => void;
  onViewResults: () => void;
  onRefresh?: () => void;
  projectId?: string;
  accountId?: string;
  existingProject?: {
    name: string;
    target_orgs: string[];
    target_roles: string[];
    research_goal: string;
    research_goal_details: string;
    decision_questions: string[];
    assumptions: string[];
    unknowns: string[];
    custom_instructions?: string;
    questions: string[];
  };
}

export default function OnboardingFlow({
  onComplete,
  onAddMoreInterviews: _onAddMoreInterviews,
  onViewResults: _onViewResults,
  onRefresh: _onRefresh,
  projectId,
  accountId,
  existingProject,
}: OnboardingFlowProps) {
  const accountPlanId = useAccountPlan();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isMobile } = useDeviceDetection();
  const isOnboarding = searchParams.get("onboarding") === "true";
  const preselectedPersonId = searchParams.get("personId") ?? undefined;

  // Show mobile header when accessing upload from existing project (not full onboarding)
  const showMobileHeader = isMobile && existingProject && !isOnboarding;

  // Start at upload step if we have existing project context
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    existingProject ? "upload" : "welcome",
  );
  // TODO: use form library to parse form data, and loader to fetch data
  const [data, setData] = useState<OnboardingData>({
    target_orgs: existingProject?.target_orgs || [],
    target_roles: existingProject?.target_roles || [],
    research_goal: existingProject?.research_goal || "",
    research_goal_details: existingProject?.research_goal_details || "",
    decision_questions: existingProject?.decision_questions || [],
    assumptions: existingProject?.assumptions || [],
    unknowns: existingProject?.unknowns || [],
    custom_instructions: existingProject?.custom_instructions,
    questions: existingProject?.questions || [],
    projectId,
    triggerAccessToken: null,
    personId: preselectedPersonId,
  });
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const uploadProgressRef = useRef<UploadProgress | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Flush latest progress to state at paint boundaries (avoids React 18 batching lag)
  const handleUploadProgress = useCallback((progress: UploadProgress) => {
    uploadProgressRef.current = progress;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (uploadProgressRef.current) {
          setUploadProgress({ ...uploadProgressRef.current });
        }
      });
    }
  }, []);

  // Clean up rAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const handleWelcomeNext = useCallback(
    async (welcomeData: {
      target_orgs: string[];
      target_roles: string[];
      research_goal: string;
      research_goal_details: string;
      decision_questions: string[];
      assumptions: string[];
      unknowns: string[];
      custom_instructions?: string;
      projectId?: string;
    }) => {
      // Update data with welcome data and projectId if provided
      setData((prev) => ({
        ...prev,
        ...welcomeData,
        projectId: welcomeData.projectId || prev.projectId || projectId,
      }));

      setCurrentStep("questions");
    },
    [projectId],
  );

  const handleQuestionsNext = useCallback((questions: string[]) => {
    setData((prev) => ({ ...prev, questions }));
    setCurrentStep("upload");
  }, []);

  const handleUploadNext = useCallback(
    async (
      file: File,
      mediaType: string,
      uploadProjectId?: string,
      attachmentData?: {
        attachType: "todo" | "existing" | "new" | "general" | "skip";
        entityId?: string;
        fileExtension?: string;
        sourceType?: string;
      },
    ) => {
      const updatedData = {
        ...data,
        file,
        mediaType,
        triggerRunId: undefined,
        triggerAccessToken: null,
        uploadLabel: file.name,
        uploadedUrl: undefined,
      };
      setData(updatedData);
      setCurrentStep("processing");
      setIsUploading(true);
      setUploadProgress({
        bytesSent: 0,
        totalBytes: file.size,
        percent: 0,
        phase: "uploading",
      });

      try {
        const sourceType =
          (attachmentData?.sourceType as UploadSourceType | undefined) ||
          getUploadSourceType(file);
        const isAudioVideo = isAudioVideoSourceType(sourceType);

        // Smart media optimization:
        // - Video files: extract audio only (instant) for transcription
        //   Paid accounts also upload original video for server-side optimization
        // - Audio files: re-encode to 128k AAC if large (fast in WASM)
        let uploadFile = file;
        let originalVideoR2Key: string | null = null;
        let thumbnailR2Key: string | null = null;

        if (isAudioVideo && isVideoFile(file)) {
          // Video: extract audio track (near-instant, no re-encoding)
          console.log(
            "[Upload] Extracting audio from video:",
            file.name,
            `(${(file.size / 1024 / 1024).toFixed(1)} MB)`,
          );
          setUploadProgress({
            bytesSent: 0,
            totalBytes: file.size,
            percent: 0,
            phase: "optimizing",
          });

          // Generate thumbnail from video before we discard it
          let thumbnailBlob: Blob | null = null;
          try {
            thumbnailBlob = await captureVideoThumbnail(file);
            if (thumbnailBlob) {
              console.log(
                "[Upload] Thumbnail captured:",
                `${(thumbnailBlob.size / 1024).toFixed(1)} KB`,
              );
            }
          } catch (thumbErr) {
            console.warn("[Upload] Thumbnail capture failed:", thumbErr);
          }

          const audioResult = await extractAudioOnly(file, {
            onProgress: (p) => {
              setUploadProgress({
                bytesSent: 0,
                totalBytes: file.size,
                percent: Math.round(p.percent),
                phase: "optimizing",
              });
            },
          });
          uploadFile = audioResult.file;
          console.log(
            "[Upload] Audio extracted:",
            `${(file.size / 1024 / 1024).toFixed(1)} MB → ${(audioResult.finalSize / 1024 / 1024).toFixed(1)} MB`,
          );

          // Upload thumbnail to R2 if we captured one
          if (thumbnailBlob && uploadProjectId) {
            try {
              const thumbFile = new File([thumbnailBlob], "thumbnail.jpg", {
                type: "image/jpeg",
              });
              const thumbPresigned = await requestPresignedUpload({
                projectId: uploadProjectId,
                file: thumbFile,
              });
              const thumbR2Key = await uploadFileWithPresignedUrl({
                file: thumbFile,
                presignedData: thumbPresigned,
                onProgress: () => {},
              });
              thumbnailR2Key = thumbR2Key;
              console.log("[Upload] Thumbnail uploaded:", thumbR2Key);
            } catch (thumbUploadErr) {
              console.warn("[Upload] Thumbnail upload failed:", thumbUploadErr);
            }
          }

          // Upload original video for server-side optimization + playback
          if (uploadProjectId) {
            console.log(
              "[Upload] Uploading original video for server-side optimization",
            );
            try {
              const videoPresigned = await requestPresignedUpload({
                projectId: uploadProjectId,
                file,
              });
              originalVideoR2Key = await uploadFileWithPresignedUrl({
                file,
                presignedData: videoPresigned,
                onProgress: handleUploadProgress,
              });
              console.log(
                "[Upload] Original video uploaded:",
                originalVideoR2Key,
              );
            } catch (videoUploadError) {
              // Non-fatal: analysis still works from audio
              console.warn(
                "[Upload] Video upload failed, continuing with audio-only:",
                videoUploadError,
              );
            }
          }
        } else if (isAudioVideo && shouldOptimize(file)) {
          // Audio: re-encode to 128k AAC (fast in WASM)
          console.log(
            "[Upload] Optimizing audio before upload:",
            file.name,
            `(${(file.size / 1024 / 1024).toFixed(1)} MB)`,
          );
          setUploadProgress({
            bytesSent: 0,
            totalBytes: file.size,
            percent: 0,
            phase: "optimizing",
          });
          const result = await optimizeMediaFile(file, {
            onProgress: (p) => {
              setUploadProgress({
                bytesSent: 0,
                totalBytes: file.size,
                percent: Math.round(p.percent),
                phase: "optimizing",
              });
            },
          });
          uploadFile = result.file;
          if (result.wasOptimized) {
            console.log(
              "[Upload] Audio optimized:",
              `${(file.size / 1024 / 1024).toFixed(1)} MB → ${(result.finalSize / 1024 / 1024).toFixed(1)} MB`,
            );
          }
        }

        let r2Key: string | null = null;

        // Audio/video files MUST go through direct R2 upload — no server fallback
        if (isAudioVideo && uploadProjectId) {
          console.log(
            "[Upload] Direct R2 upload for",
            uploadFile.name,
            "to project",
            uploadProjectId,
          );
          const presignedData = await requestPresignedUpload({
            projectId: uploadProjectId,
            file: uploadFile,
          });
          console.log("[Upload] Got presigned URL:", presignedData.type);

          let lastPartStarted = 0;
          let lastPartCompleted = 0;
          let loggedCompleting = false;
          r2Key = await uploadFileWithPresignedUrl({
            file: uploadFile,
            presignedData,
            onProgress: handleUploadProgress,
            onMultipartPhase: (progress) => {
              if (progress.phase === "completing" && !loggedCompleting) {
                loggedCompleting = true;
                console.log("[Upload] Finalizing multipart upload");
              }

              if (!progress.part) return;
              if (
                progress.part.bytesSent === 0 &&
                progress.part.index !== lastPartStarted
              ) {
                lastPartStarted = progress.part.index;
                console.log(
                  `[Upload] Multipart part ${progress.part.index}/${progress.part.total} started`,
                );
              }
              if (
                progress.part.bytesSent === progress.part.size &&
                progress.part.index !== lastPartCompleted
              ) {
                lastPartCompleted = progress.part.index;
                console.log(
                  `[Upload] Multipart part ${progress.part.index}/${progress.part.total} complete`,
                );
              }
            },
          });

          console.log("[Upload] Direct R2 upload complete:", r2Key);
        }

        // Step 3: Call onboarding-start API (with r2Key if direct upload was used)
        const formData = new FormData();
        if (r2Key) {
          // Direct upload path - send r2Key instead of file
          formData.append("r2Key", r2Key);
          formData.append("originalFilename", file.name);
          formData.append("originalFileSize", String(file.size));
          formData.append("originalContentType", file.type);
          if (originalVideoR2Key) {
            formData.append("originalVideoR2Key", originalVideoR2Key);
          }
          if (thumbnailR2Key) {
            formData.append("thumbnailR2Key", thumbnailR2Key);
          }
        } else if (isAudioVideo) {
          // Should never reach here — R2 upload is mandatory for audio/video
          throw new Error(
            "Upload failed: could not upload file to storage. Please try again.",
          );
        } else {
          // Non-audio/video files (documents, text) can go through server
          formData.append("file", file);
        }
        formData.append(
          "onboardingData",
          JSON.stringify(createOnboardingPayload(data, mediaType)),
        );
        if (uploadProjectId) {
          formData.append("projectId", uploadProjectId);
        }
        if (accountId) {
          formData.append("accountId", accountId);
        }
        if (data.personId) {
          formData.append("personId", data.personId);
        }

        // Add attachment data to form
        if (attachmentData) {
          formData.append("attachType", attachmentData.attachType);
          if (attachmentData.entityId) {
            formData.append("entityId", attachmentData.entityId);
          }
          if (attachmentData.fileExtension) {
            formData.append("fileExtension", attachmentData.fileExtension);
          }
          if (attachmentData.sourceType) {
            formData.append("sourceType", attachmentData.sourceType);
          }
        }
        if (!formData.has("fileExtension")) {
          formData.append(
            "fileExtension",
            file.name.split(".").pop()?.toLowerCase() || "",
          );
        }
        if (!formData.has("sourceType")) {
          formData.append("sourceType", sourceType);
        }

        // Call the onboarding-start API
        // For direct R2 uploads, this just triggers processing (no file upload)
        // For non-audio files, this uploads through server (small files only)
        const response: UploadResponse<OnboardingStartResponseData> = r2Key
          ? await fetch("/api/onboarding-start", {
              method: "POST",
              body: formData,
            }).then(async (res) => {
              const body = await res.json().catch(() => ({}));
              return {
                ok: res.ok,
                status: res.status,
                data: body as Record<string, unknown>,
                error: res.ok ? undefined : (body as { error?: string }).error,
              };
            })
          : await postFormDataWithProgress<OnboardingStartResponseData>({
              url: "/api/onboarding-start",
              formData,
              onProgress: (percent) =>
                setUploadProgress({
                  bytesSent: 0,
                  totalBytes: 100,
                  percent,
                  phase: "uploading",
                }),
            });

        if (!response.ok) {
          throw new Error(response.error || "Upload failed");
        }

        const result = response.data;
        setIsUploading(false);
        setUploadProgress(null);

        // Redirect to interview page immediately after upload completes
        // Processing will continue in the background via Trigger.dev
        if (result.interview?.id && result.project?.id) {
          // Use accountId from props, or extract from API response if available
          const finalAccountId =
            accountId ||
            result.interview?.account_id ||
            result.project?.account_id;
          console.log("OnboardingFlow redirect:", {
            accountId,
            finalAccountId,
            projectId: result.project.id,
            interviewId: result.interview.id,
          });

          if (!finalAccountId) {
            console.error("No accountId available for redirect!");
            // Don't redirect if we don't have an accountId
            return;
          }

          const interviewUrl = `/a/${finalAccountId}/${result.project.id}/interviews/${result.interview.id}`;
          console.log("Redirecting to:", interviewUrl);
          navigate(interviewUrl, { replace: true });
          return;
        }

        // Fallback: Store interview ID and project ID for progress tracking (legacy flow)
        if (result.interview?.id) {
          setData((prev) => ({ ...prev, interviewId: result.interview.id }));
        }
        if (result.project?.id) {
          setData((prev) => ({ ...prev, projectId: result.project.id }));
        }
        if (result.triggerRun?.id) {
          setData((prev) => ({
            ...prev,
            triggerRunId: result.triggerRun.id,
            triggerAccessToken: result.triggerRun.publicToken ?? null,
          }));

          if (!result.triggerRun.publicToken) {
            try {
              const tokenResponse = await fetch("/api/trigger-run-token", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ runId: result.triggerRun.id }),
              });

              if (tokenResponse.ok) {
                const tokenData = (await tokenResponse.json()) as {
                  token?: string;
                };
                if (tokenData.token) {
                  setData((prev) => ({
                    ...prev,
                    triggerAccessToken: tokenData.token ?? null,
                  }));
                }
              }
            } catch (tokenError) {
              console.error("Failed to fetch Trigger.dev token", tokenError);
            }
          }
        }
      } catch (error) {
        // Handle error - show error message and return to upload screen
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        console.error("[Upload] Failed:", errorMessage, error);
        setIsUploading(false);
        setUploadProgress(null);
        setData((prev) => ({ ...prev, error: errorMessage }));
        setCurrentStep("upload"); // Return to upload screen so user can retry
      }
    },
    [data, accountId, handleUploadProgress, navigate],
  );

  const handleUploadNextBatch = useCallback(
    async (files: File[]) => {
      setCurrentStep("processing");
      setIsUploading(true);
      const uploadProjectId = data.projectId || projectId;
      setData((prev) => ({
        ...prev,
        file: undefined,
        mediaType: "interview",
        uploadLabel: `${files.length} files`,
        triggerRunId: undefined,
        triggerAccessToken: null,
        error: undefined,
      }));

      try {
        if (!uploadProjectId) {
          throw new Error(
            "A project is required before uploading multiple files.",
          );
        }

        const setBatchProgress = (fileIndex: number, filePercent: number) => {
          setUploadProgress({
            bytesSent: 0,
            totalBytes: 0,
            percent: Math.round(
              ((fileIndex + filePercent / 100) / files.length) * 100,
            ),
            phase: "uploading",
          });
        };

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const sourceType = getUploadSourceType(file);
          const isAudioVideo = isAudioVideoSourceType(sourceType);
          const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";

          const formData = new FormData();
          let uploadFile = file;
          let r2Key: string | null = null;
          let batchOriginalVideoR2Key: string | null = null;

          if (isAudioVideo && isVideoFile(file)) {
            // Video: extract audio (instant)
            setUploadProgress({
              bytesSent: 0,
              totalBytes: file.size,
              percent: 0,
              phase: "optimizing",
            });
            const audioResult = await extractAudioOnly(file, {
              onProgress: (progress) => {
                setUploadProgress({
                  bytesSent: 0,
                  totalBytes: file.size,
                  percent: Math.round(progress.percent),
                  phase: "optimizing",
                });
              },
            });
            uploadFile = audioResult.file;

            // Upload original video for server-side optimization + playback
            {
              try {
                const videoPresigned = await requestPresignedUpload({
                  projectId: uploadProjectId,
                  file,
                });
                batchOriginalVideoR2Key = await uploadFileWithPresignedUrl({
                  file,
                  presignedData: videoPresigned,
                  onProgress: (progress) => {
                    setBatchProgress(i, progress.percent * 0.3);
                  },
                });
              } catch {
                console.warn(
                  "[BatchUpload] Video upload failed for",
                  file.name,
                );
              }
            }
          } else if (isAudioVideo && shouldOptimize(file)) {
            // Audio: re-encode to 128k AAC
            setUploadProgress({
              bytesSent: 0,
              totalBytes: file.size,
              percent: 0,
              phase: "optimizing",
            });
            const optimizationResult = await optimizeMediaFile(file, {
              onProgress: (progress) => {
                setUploadProgress({
                  bytesSent: 0,
                  totalBytes: file.size,
                  percent: Math.round(progress.percent),
                  phase: "optimizing",
                });
              },
            });
            uploadFile = optimizationResult.file;
          }

          if (isAudioVideo) {
            const presignedData = await requestPresignedUpload({
              projectId: uploadProjectId,
              file: uploadFile,
            });
            r2Key = await uploadFileWithPresignedUrl({
              file: uploadFile,
              presignedData,
              onProgress: (progress) => {
                const filePercent = 30 + progress.percent * 0.65;
                setBatchProgress(i, filePercent);
              },
            });

            formData.append("r2Key", r2Key);
            formData.append("originalFilename", file.name);
            formData.append("originalFileSize", String(file.size));
            formData.append(
              "originalContentType",
              file.type || "application/octet-stream",
            );
            if (batchOriginalVideoR2Key) {
              formData.append("originalVideoR2Key", batchOriginalVideoR2Key);
            }
          } else {
            formData.append("file", file);
          }

          formData.append(
            "onboardingData",
            JSON.stringify(createOnboardingPayload(data, "interview")),
          );
          formData.append("projectId", uploadProjectId);
          if (accountId) {
            formData.append("accountId", accountId);
          }
          formData.append("attachType", "skip");
          formData.append("sourceType", sourceType);
          formData.append("fileExtension", fileExtension);

          const response = r2Key
            ? await fetch("/api/onboarding-start", {
                method: "POST",
                body: formData,
              }).then(async (res) => {
                const body = await res.json().catch(() => ({}));
                return {
                  ok: res.ok,
                  status: res.status,
                  data: body as Record<string, unknown>,
                  error: res.ok
                    ? undefined
                    : (body as { error?: string }).error,
                };
              })
            : await postFormDataWithProgress<Record<string, unknown>>({
                url: "/api/onboarding-start",
                formData,
                onProgress: (percent) => {
                  const filePercent = 30 + percent * 0.65;
                  setBatchProgress(i, filePercent);
                },
              });

          if (!response.ok) {
            throw new Error(
              (response as { error?: string }).error ||
                `Failed to start processing for ${file.name}`,
            );
          }

          setBatchProgress(i, 100);
        }

        setIsUploading(false);
        setUploadProgress(null);

        // Redirect to interviews list after all files are uploaded
        const finalAccountId = accountId;
        if (finalAccountId && uploadProjectId) {
          window.location.href = `/a/${finalAccountId}/${uploadProjectId}/interviews`;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Batch upload failed";
        console.error("[BatchUpload] Failed:", errorMessage, error);
        setIsUploading(false);
        setUploadProgress(null);
        setData((prev) => ({ ...prev, error: errorMessage }));
        setCurrentStep("upload");
      }
    },
    [accountId, data, projectId],
  );

  const handleProcessingComplete = useCallback(() => {
    setCurrentStep("complete");
    onComplete(data);
  }, [data, onComplete]);

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case "questions":
        setCurrentStep("welcome");
        break;
      case "upload":
        setCurrentStep("questions");
        break;
      default:
        break;
    }
  }, [currentStep]);

  // Generate project name from target orgs and roles
  const getProjectName = useCallback(() => {
    if (data.target_orgs.length === 0) return "New Project";
    if (data.target_roles.length > 0) {
      return `${data.target_roles[0]} at ${data.target_orgs[0]} Research`;
    }
    return `${data.target_orgs[0]} Research`;
  }, [data.target_orgs, data.target_roles]);

  // Handle exit from onboarding
  const handleExit = useCallback(() => {
    if (isOnboarding) {
      // Exit onboarding and go to home - remove onboarding param
      navigate("/home");
    } else {
      // Regular navigation behavior
      navigate(-1);
    }
  }, [isOnboarding, navigate]);

  // Use the most current projectId - either from data (newly created) or props (existing)
  const currentProjectId = useMemo(
    () => data.projectId || projectId,
    [data.projectId, projectId],
  );

  const handleUploadFromUrl = useCallback(
    async (items: Array<{ url: string; personId?: string }>) => {
      if (!currentProjectId) {
        setData((prev) => ({
          ...prev,
          error: "A project is required to import from a URL.",
        }));
        throw new Error("A project is required to import from a URL.");
      }

      const normalizedItems = items
        .map((item) => ({
          url: item.url.trim(),
          ...(item.personId ? { personId: item.personId } : {}),
        }))
        .filter((item) => item.url.length > 0);

      if (normalizedItems.length === 0) {
        throw new Error("At least one URL is required.");
      }

      const primaryUrl = normalizedItems[0]?.url ?? "";
      const uploadLabel =
        normalizedItems.length > 1
          ? `${normalizedItems.length} URLs`
          : primaryUrl;

      setData((prev) => ({
        ...prev,
        file: undefined,
        mediaType: "interview",
        uploadLabel,
        uploadedUrl: primaryUrl,
        triggerRunId: undefined,
        triggerAccessToken: null,
        interviewId: undefined,
        error: undefined,
      }));
      setCurrentStep("processing");

      try {
        const formData = new FormData();
        formData.append("projectId", currentProjectId);
        formData.append("urls", JSON.stringify(normalizedItems));

        // Keep legacy fields for backward compatibility with older server versions.
        formData.append("url", primaryUrl);
        if (normalizedItems.length === 1 && normalizedItems[0]?.personId) {
          formData.append("personId", normalizedItems[0].personId);
        }

        const response = await fetch("/api/upload-from-url", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Upload failed");
        }

        const result = await response.json();

        setData((prev) => ({
          ...prev,
          interviewId: result.interviewId ?? prev.interviewId,
          projectId: prev.projectId || currentProjectId,
          uploadLabel,
          uploadedUrl: primaryUrl,
          triggerRunId: result.triggerRunId ?? prev.triggerRunId,
          triggerAccessToken: result.publicRunToken ?? prev.triggerAccessToken,
        }));

        if (result.interviewId && accountId) {
          const interviewUrl = `/a/${accountId}/${currentProjectId}/interviews/${result.interviewId}`;
          window.location.href = interviewUrl;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        setData((prev) => ({ ...prev, error: errorMessage }));
        setCurrentStep("upload");
        throw new Error(errorMessage);
      }
    },
    [accountId, currentProjectId],
  );

  // Render navigation controls for onboarding mode
  const renderOnboardingHeader = useCallback(() => {
    if (!isOnboarding) return null;

    return (
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleExit}>
            ← Exit Onboarding
          </Button>
          <div className="text-muted-foreground text-sm">
            Step{" "}
            {currentStep === "welcome"
              ? 1
              : currentStep === "questions"
                ? 2
                : currentStep === "upload"
                  ? 3
                  : 4}{" "}
            of 4
          </div>
        </div>
      </div>
    );
  }, [isOnboarding, handleExit, currentStep]);

  const stepContent = useMemo(() => {
    switch (currentStep) {
      case "welcome":
        return (
          <ProjectGoalsScreen
            onNext={handleWelcomeNext}
            projectId={currentProjectId}
          />
        );

      case "questions":
        return (
          <QuestionsScreen
            target_orgs={data.target_orgs}
            target_roles={data.target_roles}
            research_goal={data.research_goal}
            research_goal_details={data.research_goal_details}
            decision_questions={data.decision_questions}
            assumptions={data.assumptions}
            unknowns={data.unknowns}
            custom_instructions={data.custom_instructions}
            onNext={handleQuestionsNext}
            onBack={handleBack}
          />
        );

      case "upload":
        return (
          <UploadScreen
            onNext={handleUploadNext}
            onNextBatch={handleUploadNextBatch}
            onUploadFromUrl={handleUploadFromUrl}
            onBack={handleBack}
            projectId={currentProjectId}
            accountId={accountId}
            error={data.error}
          />
        );

      case "processing":
        return (
          <ProcessingScreen
            fileName={data.uploadLabel || data.file?.name || "Unknown file"}
            onComplete={handleProcessingComplete}
            interviewId={data.interviewId}
            triggerRunId={data.triggerRunId}
            triggerAccessToken={data.triggerAccessToken ?? undefined}
            uploadProgress={uploadProgress ?? undefined}
            isUploading={isUploading}
          />
        );

      case "complete":
        return (
          <ProjectStatusScreen
            projectName={getProjectName()}
            projectId={data.projectId}
            accountId={accountId}
          />
        );

      default:
        return (
          <ProjectGoalsScreen
            onNext={handleWelcomeNext}
            projectId={currentProjectId}
          />
        );
    }
  }, [
    currentStep,
    handleWelcomeNext,
    currentProjectId,
    data,
    handleQuestionsNext,
    handleBack,
    handleUploadNext,
    handleUploadNextBatch,
    handleUploadFromUrl,
    handleProcessingComplete,
    getProjectName,
    accountId,
    uploadProgress,
    isUploading,
  ]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile close button - for upload from existing project */}
      {showMobileHeader && (
        <div className="sticky top-0 z-10 flex items-center justify-end border-b bg-background px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(-1)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      )}
      {renderOnboardingHeader()}
      {stepContent}
    </div>
  );
}
