/**
 * Interview Detail page — orchestrator component.
 * Loader and action are extracted to separate files for maintainability.
 */
import consola from "consola";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type MetaFunction,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { toast } from "sonner";
import type { Database } from "~/../supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useInterviewProgress } from "~/hooks/useInterviewProgress";
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { getSupabaseClient } from "~/lib/supabase/client";
import { AnalysisWorkspace } from "../components/AnalysisWorkspace";
import { DocumentViewer } from "../components/DocumentViewer";
import { EvidenceVerificationDrawer } from "../components/EvidenceVerificationDrawer";
import { InterviewDetailHeader } from "../components/InterviewDetailHeader";
import { InterviewSourcePanel } from "../components/InterviewSourcePanel";
import { InterviewTasks } from "../components/InterviewTasks";
import { ManagePeopleAssociations } from "../components/ManagePeopleAssociations";
import { NoteViewer } from "../components/NoteViewer";
import { useCustomLensDefaults } from "../hooks/useCustomLensDefaults";
import { useEmpathySpeakers } from "../hooks/useEmpathySpeakers";
import { usePersonalFacetSummary } from "../hooks/usePersonalFacetSummary";
import { useTranscriptSpeakers } from "../hooks/useTranscriptSpeakers";
import type { AnalysisJobSummary } from "../lib/interviewDetailHelpers";
import {
  extractAnalysisFromInterview,
  matchTakeawaysToEvidence,
  normalizeMultilineText,
} from "../lib/interviewDetailHelpers";

export { action } from "./detail.action";
// Re-export loader and action from extracted modules
export { loader } from "./detail.loader";

/**
 * Revalidate on form submissions and explicit revalidator calls,
 * but skip when only searchParams change (tab/lens/source are client-only UI state).
 */
export function shouldRevalidate({
  formAction,
  currentUrl,
  nextUrl,
}: {
  formAction?: string;
  defaultShouldRevalidate: boolean;
  currentUrl: URL;
  nextUrl: URL;
}) {
  // Always revalidate on form submissions (actions)
  if (formAction) return true;
  // Skip revalidation when only search params changed on the same page
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return true;
}

const ACTIVE_ANALYSIS_STATUSES = new Set<
  Database["public"]["Enums"]["job_status"]
>(["pending", "in_progress", "retry"]);
const TERMINAL_ANALYSIS_STATUSES = new Set<
  Database["public"]["Enums"]["job_status"]
>(["done", "error"]);

export const meta: MetaFunction = ({ data }) => {
  const d = data as { interview?: { title?: string | null } } | undefined;
  return [
    { title: `${d?.interview?.title || "Interview"} | Insights` },
    { name: "description", content: "Interview details and transcript" },
  ];
};

export default function InterviewDetail({
  enableRecording = false,
}: {
  enableRecording?: boolean;
}) {
  const {
    accountId,
    projectId,
    interview,
    insights,
    evidence,
    evidenceVoteCounts,
    empathyMap,
    linkedTasks,
    peopleOptions,
    creatorName,
    analysisJob,
    assistantMessages,
    conversationAnalysis,
    linkedOpportunity,
    lensTemplates,
    lensAnalyses,
  } = useLoaderData() as any;

  const is_missing_interview_data = !interview || !accountId || !projectId;
  const is_note_type =
    interview?.source_type === "note" ||
    interview?.media_type === "note" ||
    interview?.media_type === "meeting_notes" ||
    interview?.media_type === "voice_memo";
  const is_document_type =
    interview?.source_type === "document" ||
    (interview?.source_type === "transcript" &&
      interview?.media_type !== "interview");

  const fetcher = useFetcher();
  const notesFetcher = useFetcher();
  const deleteFetcher = useFetcher<{
    success?: boolean;
    redirectTo?: string;
    error?: string;
  }>();
  const participantFetcher = useFetcher();
  const lensFetcher = useFetcher();
  const slotFetcher = useFetcher();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const {
    accountId: contextAccountId,
    projectId: contextProjectId,
    projectPath,
  } = useCurrentProject();
  const routes = useProjectRoutes(`/a/${contextAccountId}/${contextProjectId}`);
  const evidenceFilterLink = `${routes.evidence.index()}?interview_id=${encodeURIComponent(interview.id)}`;
  const shareProjectPath =
    projectPath ||
    (contextAccountId && contextProjectId
      ? `/a/${contextAccountId}/${contextProjectId}`
      : "");
  const { isEnabled: salesCrmEnabled } = usePostHogFeatureFlag("ffSalesCRM");
  // Single source of truth for interview - updated by realtime subscription
  const [interviewState, setInterviewState] = useState(interview);
  const [analysisState, setAnalysisState] = useState<AnalysisJobSummary | null>(
    analysisJob,
  );
  const [triggerAuth, setTriggerAuth] = useState<{
    runId: string;
    token: string;
  } | null>(null);
  const [tokenErrorRunId, setTokenErrorRunId] = useState<string | null>(null);
  const [_customLensOverrides, setCustomLensOverrides] = useState<
    Record<string, { summary?: string; notes?: string }>
  >({});
  const [_isChatOpen, _setIsChatOpen] = useState(
    () => assistantMessages.length > 0,
  );
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [regeneratePopoverOpen, setRegeneratePopoverOpen] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [verifyDrawerOpen, setVerifyDrawerOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null,
  );
  // Create evidence map for lens timestamp hydration
  const evidenceMap = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        anchors?: unknown;
        start_ms?: number | null;
        gist?: string | null;
      }
    >();
    for (const e of evidence || []) {
      map.set(e.id, {
        id: e.id,
        anchors: e.anchors,
        start_ms: e.start_ms,
        gist: e.gist,
      });
    }
    return map;
  }, [evidence]);

  const activeRunId = analysisState?.trigger_run_id ?? null;
  const triggerAccessToken =
    triggerAuth?.runId === activeRunId ? triggerAuth.token : undefined;

  // Pass only minimal data to progress hook (avoids passing large transcript)
  const interviewProgressData = useMemo(
    () =>
      interviewState
        ? {
            id: interviewState.id,
            status: interviewState.status,
            processing_metadata: interviewState.processing_metadata,
            conversation_analysis: interviewState.conversation_analysis,
          }
        : null,
    [
      interviewState?.id,
      interviewState?.status,
      interviewState?.processing_metadata,
      interviewState?.conversation_analysis,
    ],
  );

  const { progressInfo, isRealtime } = useInterviewProgress({
    interview: interviewProgressData,
    runId: activeRunId ?? undefined,
    accessToken: triggerAccessToken,
  });
  const _progressPercent = Math.min(100, Math.max(0, progressInfo.progress));

  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);
  revalidatorRef.current = revalidator;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const selectedLensKey = searchParams.get("lens") || null;
  const refreshTriggeredRef = useRef(false);
  const fetcherPrevStateRef = useRef(fetcher.state);
  const takeawaysPollTaskIdRef = useRef<string | null>(null);
  const takeawaysPollTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>(
    [],
  );
  if (!Array.isArray(takeawaysPollTimeoutsRef.current)) {
    takeawaysPollTimeoutsRef.current = [];
  }

  const getTakeawaysPollTimeouts = useCallback((): Array<
    ReturnType<typeof setTimeout>
  > => {
    return Array.isArray(takeawaysPollTimeoutsRef.current)
      ? takeawaysPollTimeoutsRef.current
      : [];
  }, []);

  const clearTakeawaysPollTimeouts = useCallback(() => {
    for (const timeout of getTakeawaysPollTimeouts()) {
      clearTimeout(timeout);
    }
    takeawaysPollTimeoutsRef.current = [];
  }, [getTakeawaysPollTimeouts]);

  const submitInterviewFieldUpdate = (
    field_name: string,
    field_value: string,
  ) => {
    const target =
      field_name === "observations_and_notes" ? notesFetcher : fetcher;
    target.submit(
      {
        entity: "interview",
        entityId: interview.id,
        accountId,
        projectId,
        fieldName: field_name,
        fieldValue: field_value,
      },
      { method: "post", action: "/api/update-field" },
    );
  };

  const handleSourceClick = useCallback((evidenceId: string) => {
    setSelectedEvidenceId(evidenceId);
    setVerifyDrawerOpen(true);
  }, []);
  const handleParticipantsUpdated = useCallback(() => {
    revalidator.revalidate();
  }, [revalidator]);

  const getEvidenceSpeakerNames = useCallback((item: unknown): string[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as {
      evidence_people?: Array<{ people?: { name?: string | null } | null }>;
      anchors?: unknown;
    };
    const links = Array.isArray(record.evidence_people)
      ? record.evidence_people
      : [];
    const names = links
      .map((link) => link?.people?.name?.trim())
      .filter((name): name is string => Boolean(name && name.length > 0));
    if (names.length > 0) return Array.from(new Set(names));

    const anchors = Array.isArray(record.anchors) ? record.anchors : [];
    const anchorSpeakers = anchors
      .map((anchor) => {
        if (!anchor || typeof anchor !== "object") return null;
        const speaker = (
          anchor as { speaker?: unknown; speaker_label?: unknown }
        ).speaker;
        if (typeof speaker === "string" && speaker.trim().length > 0)
          return speaker.trim();
        const speakerLabel = (anchor as { speaker_label?: unknown })
          .speaker_label;
        if (typeof speakerLabel === "string" && speakerLabel.trim().length > 0)
          return speakerLabel.trim();
        return null;
      })
      .filter((name): name is string =>
        Boolean(name && name.toLowerCase() !== "unknown speaker"),
      );
    return Array.from(new Set(anchorSpeakers));
  }, []);

  const selectedEvidence = useMemo(() => {
    if (!selectedEvidenceId) return null;
    const item = evidence.find((e) => e.id === selectedEvidenceId);
    if (!item) return null;
    return {
      id: item.id,
      verbatim: item.verbatim ?? null,
      gist: item.gist ?? null,
      topic: item.topic ?? null,
      support: item.support ?? null,
      confidence: item.confidence ?? null,
      anchors: item.anchors,
      thumbnail_url:
        (item as { thumbnail_url?: string | null }).thumbnail_url ?? null,
      speakerNames: getEvidenceSpeakerNames(item),
    };
  }, [selectedEvidenceId, evidence, getEvidenceSpeakerNames]);

  useEffect(() => {
    const prevState = fetcherPrevStateRef.current;
    fetcherPrevStateRef.current = fetcher.state;
    if (prevState === "idle" || fetcher.state !== "idle") return;

    const data = fetcher.data as unknown;
    if (!data || typeof data !== "object") return;

    if ("success" in data && (data as { success?: boolean }).success) {
      revalidator.revalidate();
      return;
    }

    if ("ok" in data && (data as { ok?: boolean }).ok && "taskId" in data) {
      const taskId = (data as { taskId?: string }).taskId;
      if (!taskId) return;
      if (takeawaysPollTaskIdRef.current === taskId) return;

      takeawaysPollTaskIdRef.current = taskId;
      clearTakeawaysPollTimeouts();

      const intervals = [2000, 5000, 8000, 12000, 16000, 22000, 30000];
      const nextTimeouts = getTakeawaysPollTimeouts();
      for (const delay of intervals) {
        nextTimeouts.push(setTimeout(() => revalidator.revalidate(), delay));
      }
      takeawaysPollTimeoutsRef.current = nextTimeouts;
    }
  }, [
    fetcher.state,
    fetcher.data,
    revalidator,
    clearTakeawaysPollTimeouts,
    getTakeawaysPollTimeouts,
  ]);

  useEffect(() => {
    return () => {
      clearTakeawaysPollTimeouts();
    };
  }, [clearTakeawaysPollTimeouts]);

  useEffect(() => {
    if (deleteFetcher.state !== "idle") return;
    const redirectTo = deleteFetcher.data?.redirectTo;
    if (redirectTo) {
      navigate(redirectTo);
    }
  }, [deleteFetcher.state, deleteFetcher.data, navigate]);

  useEffect(() => {
    if (notesFetcher.state !== "idle") return;
    const data = notesFetcher.data as
      | { success?: boolean; error?: string }
      | undefined;
    if (data && !data.success) {
      toast.error(data.error ?? "Failed to save notes");
    }
  }, [notesFetcher.state, notesFetcher.data]);

  // Helper function for date formatting
  function formatReadable(dateString: string) {
    const d = new Date(dateString);
    const parts = d.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    // Make AM/PM lower-case and use dash after month
    const lower = parts.replace(/AM|PM/, (m) => m.toLowerCase());
    return lower.replace(/^(\w{3}) (\d{2}), /, "$1-$2 ");
  }

  // Extract data needed for memoized computations
  const participants = interview.participants || [];
  const interviewTitle = interview.title || "Untitled Interview";
  const _primaryParticipant = participants[0]?.people;

  // Calculate transcript speakers for the Manage Participants dialog
  const transcriptSpeakers = useTranscriptSpeakers(
    interview.transcript_formatted,
  );

  // Match takeaways to evidence for "See source" linking
  const aiKeyTakeaways = useMemo(() => {
    const takeaways = conversationAnalysis?.keyTakeaways ?? [];
    if (!takeaways.length || !evidence?.length) return takeaways;

    // Create mutable copies and match them to evidence
    const takeawaysWithEvidence = takeaways.map((t) => ({ ...t }));
    matchTakeawaysToEvidence(
      takeawaysWithEvidence,
      evidence.map((e) => ({ id: e.id, verbatim: e.verbatim, gist: e.gist })),
    );
    return takeawaysWithEvidence;
  }, [conversationAnalysis?.keyTakeaways, evidence]);
  const conversationUpdatedLabel =
    conversationAnalysis?.updatedAt &&
    !Number.isNaN(new Date(conversationAnalysis.updatedAt).getTime())
      ? formatReadable(conversationAnalysis.updatedAt)
      : null;

  // Simplified status-based processing indicator
  // Use interviewState (updated by realtime subscription) for live status checks
  const currentStatus = interviewState?.status ?? interview.status;
  const isRealtimeLive =
    interview.source_type === "realtime_recording" &&
    currentStatus === "transcribing";
  const isProcessing =
    !isRealtimeLive &&
    (currentStatus === "uploading" ||
      currentStatus === "uploaded" ||
      currentStatus === "transcribing" ||
      currentStatus === "processing");
  const hasError = currentStatus === "error";

  // Revalidate when processing finishes (isProcessing true → false)
  const wasProcessingRef = useRef(isProcessing);
  useEffect(() => {
    const wasProcessing = wasProcessingRef.current;
    wasProcessingRef.current = isProcessing;
    if (wasProcessing && !isProcessing) {
      consola.info("[detail] Processing finished, triggering revalidation");
      const timer = setTimeout(() => {
        if (revalidatorRef.current.state === "idle") {
          revalidatorRef.current.revalidate();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isProcessing]);

  // Get human-readable status label
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "uploading":
        return "Uploading file...";
      case "uploaded":
        return "Upload complete, preparing for transcription";
      case "transcribing":
        return "Transcribing audio";
      case "processing":
        return "Analyzing transcript and generating insights";
      case "ready":
        return "Analysis complete";
      case "error":
        return "Processing failed";
      default:
        return status;
    }
  };

  // Move all useMemo and useEffect hooks to the top
  const keyTakeawaysDraft = useMemo(
    () => normalizeMultilineText(interview.high_impact_themes).trim(),
    [interview.high_impact_themes],
  );
  const notesDraft = useMemo(
    () => normalizeMultilineText(interview.observations_and_notes).trim(),
    [interview.observations_and_notes],
  );
  const personalFacetSummary = usePersonalFacetSummary(participants);

  const _interviewSystemContext = useMemo(() => {
    const sections: string[] = [];
    sections.push(`Interview title: ${interviewTitle}`);
    if (interview.segment)
      sections.push(`Target segment: ${interview.segment}`);
    if (keyTakeawaysDraft)
      sections.push(`Key takeaways draft:\n${keyTakeawaysDraft}`);
    if (personalFacetSummary)
      sections.push(`Personal facets:\n${personalFacetSummary}`);
    if (notesDraft) sections.push(`Notes:\n${notesDraft}`);

    const combined = sections.filter(Boolean).join("\n\n");
    if (combined.length > 2000) {
      return `${combined.slice(0, 2000)}…`;
    }

    return combined;
  }, [
    interviewTitle,
    interview.segment,
    keyTakeawaysDraft,
    personalFacetSummary,
    notesDraft,
  ]);

  const _initialInterviewPrompt =
    "Summarize the key takeaways from this interview and list 2 next steps that consider the participant's personal facets.";
  const _hasAnalysisError = analysisState
    ? analysisState.status === "error"
    : false;
  const formatStatusLabel = (status: string) =>
    status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  const _analysisStatusLabel = analysisState?.status
    ? formatStatusLabel(analysisState.status)
    : null;
  const _analysisStatusTone = analysisState?.status
    ? ACTIVE_ANALYSIS_STATUSES.has(analysisState.status)
      ? "bg-primary/10 text-primary"
      : analysisState.status === "error"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground"
    : "";

  const { uniqueSpeakers, personLenses: _personLenses } =
    useEmpathySpeakers(empathyMap);

  const _customLensDefaults = useCustomLensDefaults(
    conversationAnalysis,
    empathyMap,
    interview,
  );

  useEffect(() => {
    setCustomLensOverrides({});
  }, [conversationAnalysis]);

  // Sync interview state when loader data changes (navigation to different interview)
  useEffect(() => {
    setInterviewState(interview);
  }, [interview]);

  useEffect(() => {
    setAnalysisState(analysisJob);
    // Reset trigger auth when navigating to a different interview or run
    if (!analysisJob?.trigger_run_id) {
      setTriggerAuth(null);
      setTokenErrorRunId(null);
    }
  }, [analysisJob]);

  // Check if any action is in progress (but not search param changes)
  const isNavigatingAway =
    navigation.state === "loading" &&
    navigation.location?.pathname !== globalThis.location?.pathname;
  const isSubmitting = navigation.state === "submitting";
  const isFetcherBusy =
    fetcher.state !== "idle" || participantFetcher.state !== "idle";
  const showBlockingOverlay = isNavigatingAway || isSubmitting || isFetcherBusy;
  const overlayLabel = isNavigatingAway
    ? "Loading..."
    : isSubmitting || isFetcherBusy
      ? "Saving changes..."
      : "Processing...";

  useEffect(() => {
    if (!interview?.id) return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`analysis-${interview.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "interviews",
          filter: `id=eq.${interview.id}`,
        },
        (payload) => {
          const raw = (
            payload as {
              new?: Database["public"]["Tables"]["interviews"]["Row"];
            }
          ).new;
          if (!raw) return;

          // Update interview state (single source of truth)
          setInterviewState(raw as typeof interview);

          // Revalidate loader data when interview reaches terminal status
          const terminalStatuses = new Set(["ready", "error"]);
          if (raw.status && terminalStatuses.has(raw.status)) {
            consola.info(
              `[realtime] Interview status → ${raw.status}, revalidating`,
            );
            setTimeout(() => {
              if (revalidatorRef.current.state === "idle") {
                revalidatorRef.current.revalidate();
              }
            }, 1500);
          }

          // Also update analysisState for backward compatibility
          setAnalysisState((prev) => {
            const nextSummary = extractAnalysisFromInterview(raw);
            if (!nextSummary) return prev;
            if (!prev) {
              return nextSummary;
            }

            const prevCreated = prev.created_at
              ? new Date(prev.created_at).getTime()
              : 0;
            const nextCreated = nextSummary.created_at
              ? new Date(nextSummary.created_at).getTime()
              : 0;

            if (nextSummary.id === prev.id || nextCreated >= prevCreated) {
              return nextSummary;
            }

            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [interview.id]);

  useEffect(() => {
    if (!analysisState?.trigger_run_id) return;
    if (!triggerAuth?.runId) return;
    if (analysisState.trigger_run_id === triggerAuth.runId) return;

    setTriggerAuth(null);
    setTokenErrorRunId(null);
  }, [analysisState?.trigger_run_id, triggerAuth?.runId]);

  useEffect(() => {
    const runId = analysisState?.trigger_run_id ?? null;
    const status = analysisState?.status;

    if (!runId || !status) {
      setTriggerAuth(null);
      setTokenErrorRunId(null);
      return;
    }

    if (TERMINAL_ANALYSIS_STATUSES.has(status)) {
      setTriggerAuth(null);
      setTokenErrorRunId(null);
      return;
    }

    if (triggerAuth?.runId === runId) {
      return;
    }

    if (tokenErrorRunId === runId) {
      return;
    }

    let isCancelled = false;

    const fetchToken = async () => {
      try {
        const response = await fetch("/api/trigger-run-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ runId }),
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch Trigger.dev token (${response.status})`,
          );
        }

        const data = (await response.json()) as { token?: string };

        if (!isCancelled && data?.token) {
          setTriggerAuth({ runId, token: data.token });
          setTokenErrorRunId(null);
        }
      } catch (error) {
        consola.warn("Failed to fetch Trigger.dev access token", error);
        if (!isCancelled) {
          setTriggerAuth(null);
          setTokenErrorRunId(runId);
        }
      }
    };

    fetchToken();

    return () => {
      isCancelled = true;
    };
  }, [
    analysisState?.trigger_run_id,
    analysisState?.status,
    triggerAuth?.runId,
    tokenErrorRunId,
  ]);

  const badgeStylesForPriority = (
    priority: "high" | "medium" | "low",
  ): {
    variant: "default" | "secondary" | "destructive" | "outline";
    color?:
      | "blue"
      | "green"
      | "red"
      | "purple"
      | "yellow"
      | "orange"
      | "indigo";
  } => {
    switch (priority) {
      case "high":
        return { variant: "destructive", color: "red" };
      case "medium":
        return { variant: "secondary", color: "orange" };
      default:
        return { variant: "outline", color: "green" };
    }
  };

  useEffect(() => {
    if (!progressInfo.isComplete) {
      refreshTriggeredRef.current = false;
      return;
    }

    if (!refreshTriggeredRef.current) {
      refreshTriggeredRef.current = true;
      revalidator.revalidate();
    }
  }, [progressInfo.isComplete, revalidator]);

  // Fallback polling: periodically revalidate while processing to catch completion
  // when realtime subscriptions (Supabase / Trigger.dev) fail to deliver updates
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      if (revalidator.state === "idle") {
        revalidator.revalidate();
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [isProcessing, revalidator]);

  const _handleCustomLensUpdate = (
    lensId: string,
    field: "summary" | "notes",
    value: string,
  ) => {
    setCustomLensOverrides((prev) => ({
      ...prev,
      [lensId]: {
        ...(prev[lensId] ?? {}),
        [field]: value,
      },
    }));

    if (!interview?.id) return;

    try {
      lensFetcher.submit(
        {
          interviewId: interview.id,
          projectId,
          accountId,
          lensId,
          field,
          value,
        },
        { method: "post", action: "/api/update-lens" },
      );
    } catch (error) {
      consola.error("Failed to update custom lens", error);
    }
  };

  const _handleSlotUpdate = (
    slotId: string,
    field: "summary" | "textValue",
    value: string,
  ) => {
    try {
      // Convert textValue to text_value for database column name
      const dbField = field === "textValue" ? "text_value" : field;

      slotFetcher.submit(
        {
          slotId,
          field: dbField,
          value,
        },
        { method: "post", action: "/api/update-slot" },
      );
    } catch (error) {
      consola.error("Failed to update slot", error);
    }
  };

  const _activeLensUpdateId =
    lensFetcher.state !== "idle" && lensFetcher.formData
      ? (lensFetcher.formData.get("lensId")?.toString() ?? null)
      : null;

  if (is_missing_interview_data) {
    return <div>Error: Missing interview data</div>;
  }

  if (is_note_type) {
    return <NoteViewer interview={interview} projectId={projectId} />;
  }

  if (is_document_type) {
    return <DocumentViewer interview={interview} />;
  }

  return (
    <>
      <div className="relative mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Loading Overlay */}
        {showBlockingOverlay && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium text-sm">{overlayLabel}</p>
            </div>
          </div>
        )}

        {/* Lightweight header (full width) */}
        <InterviewDetailHeader
          interview={interview}
          accountId={contextAccountId ?? accountId}
          projectId={projectId}
          evidenceCount={evidence.length}
          insightCount={insights?.length ?? 0}
          creatorName={creatorName}
          currentStatus={currentStatus}
          isProcessing={isProcessing}
          isRealtimeLive={isRealtimeLive}
          hasError={hasError}
          routes={routes}
          linkedOpportunity={linkedOpportunity}
          shareProjectPath={shareProjectPath}
          onFieldUpdate={submitInterviewFieldUpdate}
          onOpenParticipantsDialog={() => setParticipantsDialogOpen(true)}
          onDelete={() => setDeleteDialogOpen(true)}
        />

        {/* 2-column layout: Insights (left ~58%) + Sources (right ~42%) */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Left column: Analysis Workspace + Tasks */}
          <div className="space-y-6">
            <AnalysisWorkspace
              activeTab={activeTab}
              onTabChange={(tab) => {
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("tab", tab);
                    return next;
                  },
                  { replace: true },
                );
              }}
              aiKeyTakeaways={aiKeyTakeaways}
              conversationUpdatedLabel={conversationUpdatedLabel}
              onSourceClick={handleSourceClick}
              recommendations={conversationAnalysis?.recommendations ?? []}
              interviewId={interview.id}
              lensTemplates={lensTemplates}
              lensAnalyses={lensAnalyses}
              evidenceMap={evidenceMap}
              selectedLensKey={selectedLensKey}
              onLensChange={(key) => {
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("tab", "lenses");
                    next.set("lens", key);
                    return next;
                  },
                  { replace: true },
                );
              }}
              notesValue={(interview.observations_and_notes as string) ?? ""}
              onNotesUpdate={(value) =>
                submitInterviewFieldUpdate("observations_and_notes", value)
              }
            />

            <InterviewTasks tasks={linkedTasks} routes={routes} />
          </div>

          {/* Right column: Sources (sticky) */}
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2 lg:[scrollbar-gutter:stable]">
            <InterviewSourcePanel
              interview={interview}
              evidence={evidence}
              accountId={accountId}
              projectId={projectId}
              onSpeakerClick={() => setParticipantsDialogOpen(true)}
              activeSource={searchParams.get("source") || "media"}
              onSourceChange={(source) => {
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("source", source);
                    return next;
                  },
                  { replace: true },
                );
              }}
            />
          </div>
        </div>
      </div>

      {/* Participants Management Dialog */}
      <Dialog
        open={participantsDialogOpen}
        onOpenChange={setParticipantsDialogOpen}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Participants</DialogTitle>
          </DialogHeader>
          <p className="mb-4 text-muted-foreground text-sm">
            Link speakers from the transcript to people in your project. This
            helps track insights across conversations.
          </p>
          <ManagePeopleAssociations
            interviewId={interview.id}
            participants={participants.map((p) => ({
              id: String(p.id),
              role: p.role,
              transcript_key: p.transcript_key,
              display_name: p.display_name,
              people: p.people
                ? {
                    id: (p.people as any).id,
                    name: (p.people as any).name,
                    person_type: (p.people as any).person_type,
                  }
                : null,
            }))}
            availablePeople={peopleOptions.map((p) => ({
              id: p.id,
              name: p.name,
              person_type: (p as any).person_type,
            }))}
            transcriptSpeakers={transcriptSpeakers}
            onUpdate={handleParticipantsUpdated}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete interview</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the interview and associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFetcher.state !== "idle"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteFetcher.state !== "idle"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteFetcher.submit(
                  { interviewId: interview.id, projectId },
                  { method: "post", action: "/api/interviews/delete" },
                );
              }}
            >
              {deleteFetcher.state !== "idle" ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EvidenceVerificationDrawer
        open={verifyDrawerOpen}
        onOpenChange={setVerifyDrawerOpen}
        selectedEvidence={selectedEvidence}
        allEvidence={evidence
          .filter((e) => e.id && typeof e.id === "string")
          .map((e) => ({
            id: e.id,
            verbatim: e.verbatim ?? null,
            gist: e.gist ?? null,
            topic: e.topic ?? null,
            support: e.support ?? null,
            confidence: e.confidence ?? null,
            anchors: e.anchors,
            thumbnail_url:
              (e as { thumbnail_url?: string | null }).thumbnail_url ?? null,
            speakerNames: getEvidenceSpeakerNames(e),
          }))}
        interview={interview}
        evidenceDetailRoute={routes.evidence.detail}
        onEvidenceSelect={setSelectedEvidenceId}
      />
    </>
  );
}
