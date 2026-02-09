import { useChat } from "@ai-sdk/react";
import { convertMessages } from "@mastra/core/agent";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import consola from "consola";
import {
  AlertTriangle,
  ArrowUpRight,
  BotMessageSquare,
  Briefcase,
  Edit2,
  Loader2,
  MoreVertical,
  RefreshCw,
  Sparkles,
  Trash2,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ActionFunctionArgs,
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRevalidator,
} from "react-router";
import { Streamdown } from "streamdown";
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
import { BackButton } from "~/components/ui/back-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import InlineEdit from "~/components/ui/inline-edit";
import { MediaPlayer } from "~/components/ui/MediaPlayer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { useCurrentProject } from "~/contexts/current-project-context";
import { PlayByPlayTimeline } from "~/features/evidence/components/ChronologicalEvidenceList";
import {
  getInterviewById,
  getInterviewInsights,
  getInterviewParticipants,
} from "~/features/interviews/db";
import { LensAccordion } from "~/features/lenses/components/LensAccordion";
import { loadInterviewSalesLens } from "~/features/lenses/lib/interviewLens.server";
import {
  type LensAnalysisWithTemplate,
  type LensTemplate,
  loadLensAnalyses,
  loadLensTemplates,
} from "~/features/lenses/lib/loadLensAnalyses.server";
import type { InterviewLensView } from "~/features/lenses/types";
import { syncTitleToJobTitleFacet } from "~/features/people/syncTitleToFacet.server";
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu";
import { useInterviewProgress } from "~/hooks/useInterviewProgress";
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag";
import {
  useProjectRoutes,
  useProjectRoutesFromIds,
} from "~/hooks/useProjectRoutes";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { getSupabaseClient } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";
import { memory } from "~/mastra/memory";
import type { UpsightMessage } from "~/mastra/message-types";
import { userContext } from "~/server/user-context";
import { createR2PresignedUrl, getR2KeyFromPublicUrl } from "~/utils/r2.server";
import { DocumentViewer } from "../components/DocumentViewer";
import { InterviewQuestionsAccordion } from "../components/InterviewQuestionsAccordion";
import { LazyTranscriptResults } from "../components/LazyTranscriptResults";
import { ManagePeopleAssociations } from "../components/ManagePeopleAssociations";
import { InterviewInsights } from "../components/InterviewInsights";
import { InterviewRecommendations } from "../components/InterviewRecommendations";
import { InterviewScorecard } from "../components/InterviewScorecard";
import { InterviewSourcePanel } from "../components/InterviewSourcePanel";
import { NoteViewer } from "../components/NoteViewer";

// Helper to parse full name into first and last
function parseFullName(fullName: string): {
  firstname: string;
  lastname: string | null;
} {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstname: "", lastname: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstname: parts[0], lastname: null };
  }
  return {
    firstname: parts[0],
    lastname: parts.slice(1).join(" "),
  };
}

// Normalize potentially awkwardly stored text fields (array, JSON string, or plain string)
function normalizeMultilineText(value: unknown): string {
  try {
    if (Array.isArray(value)) {
      const lines = value.filter(
        (v) => typeof v === "string" && v.trim(),
      ) as string[];
      return lines
        .map((line) => {
          const t = (typeof line === "string" ? line : String(line)).trim();
          if (/^([-*+]|\d+\.)\s+/.test(t)) return t;
          return `- ${t}`;
        })
        .join("\n");
    }
    if (typeof value === "string") {
      // Try to parse stringified JSON arrays: "[\"a\",\"b\"]"
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const lines = parsed.filter(
          (v) => typeof v === "string" && v.trim(),
        ) as string[];
        return lines
          .map((line) => {
            const t = (typeof line === "string" ? line : String(line)).trim();
            if (/^([-*+]|\d+\.)\s+/.test(t)) return t;
            return `- ${t}`;
          })
          .join("\n");
      }
      return value;
    }
    return "";
  } catch {
    // If JSON.parse fails, treat it as plain text
    return typeof value === "string" ? value : "";
  }
}

// Derive media format (audio/video) from file_extension and source_type
// This is different from media_type which is a semantic category (interview, voice_memo, etc.)
const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "flac",
  "wma",
  "webm",
];
const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "m4v"];

function deriveMediaFormat(
  fileExtension: string | null | undefined,
  sourceType: string | null | undefined,
  mediaType: string | null | undefined,
): "audio" | "video" | null {
  // 1. Check file extension first (most reliable)
  if (fileExtension) {
    const ext = fileExtension.toLowerCase().replace(/^\./, "");
    if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
    if (VIDEO_EXTENSIONS.includes(ext)) return "video";
    // webm can be audio or video, check source_type
    if (ext === "webm") {
      if (sourceType === "audio_upload" || sourceType === "audio_url")
        return "audio";
      if (sourceType === "video_upload" || sourceType === "video_url")
        return "video";
      // Default webm to video (more common)
      return "video";
    }
  }

  // 2. Check source_type
  if (sourceType) {
    if (sourceType.includes("audio")) return "audio";
    if (sourceType.includes("video")) return "video";
    // Recall recordings are typically video
    if (sourceType === "recall") return "video";
    // Desktop realtime recordings are mp4 captures in current pipeline
    if (sourceType === "realtime_recording") return "video";
  }

  // 3. Check semantic media_type for hints
  if (mediaType === "voice_memo") return "audio";

  // 4. Default to video (shows larger player, user can resize)
  return null;
}

type AnalysisJobSummary = {
  id: string; // interviewId
  status: Database["public"]["Enums"]["job_status"] | null;
  status_detail: string | null;
  progress: number | null;
  trigger_run_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const ACTIVE_ANALYSIS_STATUSES = new Set<
  Database["public"]["Enums"]["job_status"]
>(["pending", "in_progress", "retry"]);
const TERMINAL_ANALYSIS_STATUSES = new Set<
  Database["public"]["Enums"]["job_status"]
>(["done", "error"]);

function extractAnalysisFromInterview(
  interview: Database["public"]["Tables"]["interviews"]["Row"],
): AnalysisJobSummary | null {
  const conversationAnalysis = interview.conversation_analysis as any;
  if (!conversationAnalysis) return null;

  return {
    id: interview.id,
    status: conversationAnalysis.status || null,
    status_detail: conversationAnalysis.status_detail || null,
    progress: conversationAnalysis.progress || null,
    trigger_run_id: conversationAnalysis.trigger_run_id || null,
    created_at: interview.created_at,
    updated_at: interview.updated_at,
  };
}

type ConversationAnalysisForDisplay = {
  summary: string | null;
  keyTakeaways: Array<{
    priority: "high" | "medium" | "low";
    summary: string;
    evidenceSnippets: string[];
  }>;
  openQuestions: string[];
  recommendations: Array<{
    focusArea: string;
    action: string;
    rationale: string;
  }>;
  status: "pending" | "processing" | "completed" | "failed";
  updatedAt: string | null;
  customLenses: Record<string, { summary?: string; notes?: string }>;
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: `${data?.interview?.title || "Interview"} | Insights` },
    { name: "description", content: "Interview details and transcript" },
  ];
};

export async function action({ context, params, request }: ActionFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;
  const accountId = params.accountId;
  const projectId = params.projectId;
  const interviewId = params.interviewId;

  if (!accountId || !projectId || !interviewId) {
    return Response.json(
      { ok: false, error: "Account, project, and interview are required" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  // Support both "intent" (existing forms) and "_action" (LinkPersonDialog)
  const intent = (
    formData.get("intent") || formData.get("_action")
  )?.toString();

  try {
    switch (intent) {
      case "assign-participant": {
        const interviewPersonId = formData.get("interviewPersonId")?.toString();
        if (!interviewPersonId) {
          return Response.json(
            { ok: false, error: "Missing participant identifier" },
            { status: 400 },
          );
        }

        const parsedInterviewPersonId = Number.parseInt(interviewPersonId, 10);
        if (Number.isNaN(parsedInterviewPersonId)) {
          return Response.json(
            { ok: false, error: "Invalid participant identifier" },
            { status: 400 },
          );
        }

        const personId = formData.get("personId")?.toString().trim() || null;
        const role = formData.get("role")?.toString().trim() || null;
        const transcriptKey =
          formData.get("transcriptKey")?.toString().trim() || null;
        const displayName =
          formData.get("displayName")?.toString().trim() || null;

        if (!personId) {
          const { error } = await supabase
            .from("interview_people")
            .delete()
            .eq("id", parsedInterviewPersonId);
          if (error) throw new Error(error.message);
          return Response.json({ ok: true, removed: true });
        }

        // Guard: ensure selected person belongs to this project
        const { data: personRow, error: personErr } = await supabase
          .from("people")
          .select("id, project_id")
          .eq("id", personId)
          .single();
        if (personErr || !personRow) {
          return Response.json(
            { ok: false, error: "Selected person not found" },
            { status: 400 },
          );
        }
        if (personRow.project_id !== projectId) {
          return Response.json(
            {
              ok: false,
              error: "Selected person belongs to a different project",
            },
            { status: 400 },
          );
        }

        const { error } = await supabase
          .from("interview_people")
          .update({
            person_id: personId,
            role,
            transcript_key: transcriptKey,
            display_name: displayName,
          })
          .eq("id", parsedInterviewPersonId);

        if (error) throw new Error(error.message);
        return Response.json({ ok: true });
      }
      case "remove-participant": {
        const interviewPersonId = formData.get("interviewPersonId")?.toString();
        if (!interviewPersonId) {
          return Response.json(
            { ok: false, error: "Missing participant identifier" },
            { status: 400 },
          );
        }
        const { error } = await supabase
          .from("interview_people")
          .delete()
          .eq("id", Number.parseInt(interviewPersonId, 10));
        if (error) throw new Error(error.message);
        return Response.json({ ok: true, removed: true });
      }
      case "add-participant":
      case "link-person": {
        // Handle both existing form (add-participant) and LinkPersonDialog (link-person)
        const createPerson =
          formData.get("create_person")?.toString() === "true";
        let personId = (
          formData.get("personId") || formData.get("person_id")
        )?.toString();
        const role = formData.get("role")?.toString().trim() || null;
        // Support both snake_case (from ManagePeopleAssociations) and camelCase (from LinkPersonDialog)
        const transcriptKey =
          (formData.get("transcript_key") || formData.get("transcriptKey"))
            ?.toString()
            .trim() || null;
        const displayName =
          formData.get("displayName")?.toString().trim() || null;

        // If creating a new person, do that first
        if (createPerson) {
          const personName = formData.get("person_name")?.toString()?.trim();
          const personFirst =
            formData.get("person_firstname")?.toString()?.trim() || null;
          const personLast =
            formData.get("person_lastname")?.toString()?.trim() || null;
          const personCompany =
            formData.get("person_company")?.toString()?.trim() || null;
          const personTitle =
            formData.get("person_title")?.toString()?.trim() || null;
          if (!personName && !personFirst) {
            return Response.json(
              { ok: false, error: "Person name is required when creating" },
              { status: 400 },
            );
          }

          const { firstname, lastname } = personFirst
            ? { firstname: personFirst, lastname: personLast }
            : parseFullName(personName || "");
          const { data: newPerson, error: createError } = await supabase
            .from("people")
            .insert({
              account_id: accountId,
              project_id: projectId,
              firstname,
              lastname,
              company: personCompany,
              title: personTitle,
            })
            .select()
            .single();

          if (createError || !newPerson) {
            consola.error("Failed to create person:", createError);
            return Response.json(
              { ok: false, error: "Failed to create person" },
              { status: 500 },
            );
          }

          // Link person to project
          await supabase.from("project_people").insert({
            project_id: projectId,
            person_id: newPerson.id,
          });

          personId = newPerson.id;
        }

        if (!personId) {
          return Response.json(
            { ok: false, error: "Select a person to add" },
            { status: 400 },
          );
        }

        // Guard: ensure selected person belongs to this project (skip if we just created it)
        if (!createPerson) {
          const { data: personRow, error: personErr } = await supabase
            .from("people")
            .select("id, project_id")
            .eq("id", personId)
            .single();
          if (personErr || !personRow) {
            return Response.json(
              { ok: false, error: "Selected person not found" },
              { status: 400 },
            );
          }
          if (personRow.project_id !== projectId) {
            return Response.json(
              {
                ok: false,
                error: "Selected person belongs to a different project",
              },
              { status: 400 },
            );
          }
        }

        const { error } = await supabase.from("interview_people").insert({
          interview_id: interviewId,
          project_id: projectId,
          person_id: personId,
          role,
          transcript_key: transcriptKey,
          display_name: displayName,
        });
        if (error) throw new Error(error.message);
        return Response.json({ ok: true, created: true, personId });
      }
      case "create-and-link-person": {
        const name = (formData.get("name") as string | null)?.trim();
        if (!name) {
          return Response.json(
            { ok: false, error: "Person name is required" },
            { status: 400 },
          );
        }

        const { firstname, lastname } = parseFullName(name);
        const primaryEmail =
          (formData.get("primary_email") as string | null)?.trim() || null;
        const title = (formData.get("title") as string | null)?.trim() || null;
        const role = (formData.get("role") as string | null)?.trim() || null;

        // Create the person
        const { data: newPerson, error: createError } = await supabase
          .from("people")
          .insert({
            account_id: accountId,
            project_id: projectId,
            firstname,
            lastname,
            primary_email: primaryEmail,
            title,
          })
          .select()
          .single();

        if (createError || !newPerson) {
          consola.error("Failed to create person:", createError);
          return Response.json(
            { ok: false, error: "Failed to create person" },
            { status: 500 },
          );
        }

        // Link person to project
        await supabase.from("project_people").insert({
          project_id: projectId,
          person_id: newPerson.id,
        });

        // If title was provided, sync it to job_function facet
        if (title) {
          await syncTitleToJobTitleFacet({
            supabase,
            personId: newPerson.id,
            accountId,
            title,
          });
        }

        // Link the person to the interview
        const { error: linkError } = await supabase
          .from("interview_people")
          .insert({
            interview_id: interviewId,
            project_id: projectId,
            person_id: newPerson.id,
            role,
            transcript_key: null,
            display_name: null,
          });

        if (linkError) {
          consola.error("Failed to link person to interview:", linkError);
          return Response.json(
            {
              ok: false,
              error: "Person created but failed to link to interview",
            },
            { status: 500 },
          );
        }

        return Response.json({
          ok: true,
          created: true,
          personId: newPerson.id,
        });
      }
      case "link-organization": {
        const organizationId = formData.get("organizationId")?.toString();
        if (!organizationId) {
          return Response.json(
            { ok: false, error: "Missing organizationId" },
            { status: 400 },
          );
        }

        const { error } = await supabase.from("interview_organizations").upsert(
          {
            interview_id: interviewId,
            organization_id: organizationId,
            account_id: accountId,
            project_id: projectId,
          },
          { onConflict: "interview_id,organization_id" },
        );

        if (error) throw new Error(error.message);
        return Response.json({ ok: true });
      }
      case "unlink-organization": {
        const interviewOrganizationId = formData
          .get("interviewOrganizationId")
          ?.toString();
        if (!interviewOrganizationId) {
          return Response.json(
            { ok: false, error: "Missing interviewOrganizationId" },
            { status: 400 },
          );
        }

        const { error } = await supabase
          .from("interview_organizations")
          .delete()
          .eq("id", interviewOrganizationId);
        if (error) throw new Error(error.message);
        return Response.json({ ok: true, removed: true });
      }
      case "create-and-link-organization": {
        const organizationName = formData
          .get("organization_name")
          ?.toString()
          ?.trim();
        if (!organizationName) {
          return Response.json(
            { ok: false, error: "Organization name is required" },
            { status: 400 },
          );
        }

        const { data: organization, error: orgErr } = await supabase
          .from("organizations")
          .insert({
            account_id: accountId,
            project_id: projectId,
            name: organizationName,
          })
          .select("id")
          .single();

        if (orgErr || !organization)
          throw new Error(orgErr?.message || "Failed to create organization");

        const { error: linkErr } = await supabase
          .from("interview_organizations")
          .upsert(
            {
              interview_id: interviewId,
              organization_id: organization.id,
              account_id: accountId,
              project_id: projectId,
            },
            { onConflict: "interview_id,organization_id" },
          );

        if (linkErr) throw new Error(linkErr.message);
        return Response.json({
          ok: true,
          created: true,
          organizationId: organization.id,
        });
      }
      case "link-opportunity": {
        const opportunityId = formData.get("opportunityId")?.toString();
        if (!opportunityId) {
          return Response.json(
            { ok: false, error: "Missing opportunityId" },
            { status: 400 },
          );
        }

        const { error } = await supabase.from("interview_opportunities").upsert(
          {
            interview_id: interviewId,
            opportunity_id: opportunityId,
            account_id: accountId,
            project_id: projectId,
          },
          { onConflict: "interview_id,opportunity_id" },
        );

        if (error) throw new Error(error.message);
        return Response.json({ ok: true });
      }
      case "unlink-opportunity": {
        const interviewOpportunityId = formData
          .get("interviewOpportunityId")
          ?.toString();
        if (!interviewOpportunityId) {
          return Response.json(
            { ok: false, error: "Missing interviewOpportunityId" },
            { status: 400 },
          );
        }

        const { error } = await supabase
          .from("interview_opportunities")
          .delete()
          .eq("id", interviewOpportunityId);
        if (error) throw new Error(error.message);
        return Response.json({ ok: true, removed: true });
      }
      case "create-and-link-opportunity": {
        const opportunityTitle = formData
          .get("opportunity_title")
          ?.toString()
          ?.trim();
        if (!opportunityTitle) {
          return Response.json(
            { ok: false, error: "Opportunity title is required" },
            { status: 400 },
          );
        }

        const { data: opportunity, error: oppErr } = await supabase
          .from("opportunities")
          .insert({
            account_id: accountId,
            project_id: projectId,
            title: opportunityTitle,
          })
          .select("id")
          .single();

        if (oppErr || !opportunity)
          throw new Error(oppErr?.message || "Failed to create opportunity");

        const { error: linkErr } = await supabase
          .from("interview_opportunities")
          .upsert(
            {
              interview_id: interviewId,
              opportunity_id: opportunity.id,
              account_id: accountId,
              project_id: projectId,
            },
            { onConflict: "interview_id,opportunity_id" },
          );

        if (linkErr) throw new Error(linkErr.message);
        return Response.json({
          ok: true,
          created: true,
          opportunityId: opportunity.id,
        });
      }
      default:
        return Response.json(
          { ok: false, error: "Unknown intent" },
          { status: 400 },
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    consola.error("Participant action failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  // Both from URL params - consistent, explicit, RESTful
  const accountId = params.accountId;
  const projectId = params.projectId;
  const interviewId = params.interviewId;

  // consola.info("🔍 Interview Detail Loader Started:", {
  // 	accountId,
  // 	projectId,
  // 	interviewId,
  // 	params,
  // })

  if (!accountId || !projectId || !interviewId) {
    consola.error("❌ Missing required parameters:", {
      accountId,
      projectId,
      interviewId,
    });
    throw new Response(
      "Account ID, Project ID, and Interview ID are required",
      { status: 400 },
    );
  }

  try {
    consola.info("📊 Fetching interview data...");
    // Fetch interview data from database (includes notes now)
    const { data: interviewData, error: interviewError } =
      await getInterviewById({
        supabase,
        accountId,
        projectId,
        id: interviewId,
      });

    if (interviewError) {
      // If interview was deleted (0 rows), redirect to interviews list instead of error
      if (interviewError.code === "PGRST116") {
        consola.info("Interview deleted or not found, redirecting to list");
        throw redirect(`/a/${accountId}/${projectId}/interviews`);
      }
      consola.error("❌ Error fetching interview:", interviewError);
      throw new Response(
        `Error fetching interview: ${interviewError.message}`,
        { status: 500 },
      );
    }

    if (!interviewData) {
      consola.info("Interview not found, redirecting to list");
      throw redirect(`/a/${accountId}/${projectId}/interviews`);
    }

    consola.info("✅ Interview data fetched successfully:", {
      interviewId: interviewData.id,
      title: interviewData.title,
      hasObservations: !!interviewData.observations_and_notes,
      observationsLength: interviewData.observations_and_notes?.length || 0,
      sourceType: interviewData.source_type,
    });

    const conversationAnalysis = (() => {
      const raw = interviewData.conversation_analysis as
        | Record<string, unknown>
        | null
        | undefined;
      if (!raw || typeof raw !== "object") return null;

      const parseStringArray = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];
        return value
          .map((item) => (typeof item === "string" ? item.trim() : null))
          .filter((item): item is string => Boolean(item && item.length > 0));
      };

      const parseKeyTakeaways =
        (): ConversationAnalysisForDisplay["keyTakeaways"] => {
          const value = raw.key_takeaways as unknown;
          if (!Array.isArray(value)) return [];
          return value
            .map((item) => {
              if (!item || typeof item !== "object") return null;
              const entry = item as { [key: string]: unknown };
              const summary =
                typeof entry.summary === "string" ? entry.summary.trim() : "";
              if (!summary) return null;
              const priority =
                entry.priority === "high" ||
                entry.priority === "medium" ||
                entry.priority === "low"
                  ? entry.priority
                  : "medium";
              const evidenceSnippets = parseStringArray(
                entry.evidence_snippets,
              );
              return { priority, summary, evidenceSnippets };
            })
            .filter(
              (
                item,
              ): item is {
                priority: "high" | "medium" | "low";
                summary: string;
                evidenceSnippets: string[];
              } => item !== null,
            );
        };

      const parseRecommendations =
        (): ConversationAnalysisForDisplay["recommendations"] => {
          const value = raw.recommended_next_steps as unknown;
          if (!Array.isArray(value)) return [];
          return value
            .map((item) => {
              if (!item || typeof item !== "object") return null;
              const entry = item as { [key: string]: unknown };
              const focusArea =
                typeof entry.focus_area === "string"
                  ? entry.focus_area.trim()
                  : "";
              const action =
                typeof entry.action === "string" ? entry.action.trim() : "";
              const rationale =
                typeof entry.rationale === "string"
                  ? entry.rationale.trim()
                  : "";
              if (!focusArea && !action && !rationale) return null;
              return { focusArea, action, rationale };
            })
            .filter(
              (
                item,
              ): item is {
                focusArea: string;
                action: string;
                rationale: string;
              } => item !== null,
            );
        };

      const parseCustomLenses =
        (): ConversationAnalysisForDisplay["customLenses"] => {
          const value = raw.custom_lenses as unknown;
          if (!value || typeof value !== "object") return {};
          const entries = Object.entries(
            value as Record<string, unknown>,
          ).reduce(
            (acc, [key, data]) => {
              if (!data || typeof data !== "object") return acc;
              const entry = data as { [field: string]: unknown };
              const summary =
                typeof entry.summary === "string" ? entry.summary : undefined;
              const notes =
                typeof entry.notes === "string" ? entry.notes : undefined;
              acc[key] = {};
              if (summary) acc[key].summary = summary;
              if (notes) acc[key].notes = notes;
              return acc;
            },
            {} as Record<string, { summary?: string; notes?: string }>,
          );
          return entries;
        };

      return {
        summary: typeof raw.overview === "string" ? raw.overview : null,
        keyTakeaways: parseKeyTakeaways(),
        openQuestions: parseStringArray(raw.open_questions),
        recommendations: parseRecommendations(),
        status: "completed" as const,
        updatedAt: interviewData.updated_at,
        customLenses: parseCustomLenses(),
      };
    })();

    // Fetch participant data separately to avoid junction table query issues
    let participants: Array<{
      id: number;
      role: string | null;
      transcript_key: string | null;
      display_name: string | null;
      cross_project?: boolean;
      people?: {
        id?: string;
        name?: string | null;
        segment?: string | null;
        company?: string | null;
        project_id?: string | null;
        people_personas?: Array<{
          personas?: { id?: string; name?: string | null } | null;
        }>;
      };
    }> = [];
    let primaryParticipant: {
      id?: string;
      name?: string | null;
      segment?: string | null;
      project_id?: string | null;
    } | null = null;

    try {
      const { data: participantData } = await getInterviewParticipants({
        supabase,
        projectId,
        interviewId: interviewId,
      });

      participants = (participantData || []).map((row) => {
        const person = row.people as
          | {
              id: string;
              name: string | null;
              segment: string | null;
              project_id: string | null;
              person_type?: string | null;
              people_personas?: Array<{
                personas?: { id?: string; name?: string | null } | null;
              }>;
              [key: string]: unknown;
            }
          | undefined;
        const valid = !!person && person.project_id === projectId;
        const minimal = person
          ? {
              id: person.id,
              name: person.name,
              segment: person.segment,
              company: (person as any).default_organization?.name ?? null,
              project_id: person.project_id,
              person_type: person.person_type ?? null,
              people_personas: Array.isArray(person.people_personas)
                ? person.people_personas.map((pp) => ({
                    personas: pp?.personas
                      ? { id: pp.personas.id, name: pp.personas.name }
                      : null,
                  }))
                : undefined,
            }
          : undefined;
        return {
          id: row.id,
          role: row.role ?? null,
          transcript_key: row.transcript_key ?? null,
          display_name: row.display_name ?? null,
          people: person ? minimal : undefined,
          cross_project: !!person && !valid,
        };
      });
      {
        const found = participants.find((p) => p.people)?.people;
        primaryParticipant = found ?? null;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Response(`Error fetching participants: ${msg}`, {
        status: 500,
      });
    }

    const { data: peopleOptions, error: peopleError } = await supabase
      .from("people")
      .select("id, name, segment, person_type")
      .or(`project_id.eq.${projectId},account_id.eq.${accountId}`)
      .order("name", { ascending: true });

    if (peopleError) {
      consola.warn(
        "Could not load people options for participant assignment:",
        peopleError.message,
      );
    }

    const peopleLookup = new Map<
      string,
      { name: string | null; person_type?: string | null }
    >();
    for (const option of peopleOptions ?? []) {
      if (option?.id) {
        peopleLookup.set(option.id, {
          name: option.name ?? null,
          person_type: option.person_type ?? null,
        });
      }
    }
    for (const participant of participants) {
      const person = participant.people;
      if (person?.id) {
        peopleLookup.set(person.id, {
          name: person.name ?? null,
          person_type: (person as any).person_type ?? null,
        });
      }
    }
    if (primaryParticipant?.id) {
      peopleLookup.set(primaryParticipant.id, {
        name: primaryParticipant.name ?? null,
        person_type: (primaryParticipant as any).person_type ?? null,
      });
    }

    let salesLens: InterviewLensView | null = null;
    let linkedOpportunity: { id: string; title: string } | null = null;
    let lensTemplates: LensTemplate[] = [];
    let lensAnalyses: Record<string, LensAnalysisWithTemplate> = {};

    try {
      if (supabase) {
        // Load legacy sales lens (for backward compatibility)
        salesLens = await loadInterviewSalesLens({
          db: supabase,
          projectId,
          interviewId,
          peopleLookup,
        });

        // Load new generic lens system
        const [templates, analyses] = await Promise.all([
          loadLensTemplates(supabase),
          loadLensAnalyses(supabase, interviewId, accountId),
        ]);
        lensTemplates = templates;
        lensAnalyses = analyses;

        // Check if interview is linked to an opportunity
        const { data: summaryData } = await supabase
          .from("sales_lens_summaries")
          .select("opportunity_id")
          .eq("interview_id", interviewId)
          .eq("project_id", projectId)
          .not("opportunity_id", "is", null)
          .limit(1)
          .single();

        if (summaryData?.opportunity_id) {
          const { data: oppData } = await supabase
            .from("opportunities")
            .select("id, title")
            .eq("id", summaryData.opportunity_id)
            .single();

          if (oppData) {
            linkedOpportunity = oppData;
          }
        }
      }
    } catch (error) {
      consola.warn("Failed to load sales lens for interview", {
        interviewId,
        error,
      });
    }

    // Check transcript availability without loading the actual content
    const { data: transcriptMeta, error: transcriptError } = await supabase
      .from("interviews")
      .select("transcript, transcript_formatted")
      .eq("id", interviewId)
      .eq("project_id", projectId)
      .single();

    if (transcriptError) {
      consola.warn(
        "Could not check transcript availability:",
        transcriptError.message,
      );
    }

    // Debug transcript availability
    consola.info("Transcript availability check:", {
      interviewId,
      hasTranscript: Boolean(transcriptMeta?.transcript),
      hasFormattedTranscript: Boolean(transcriptMeta?.transcript_formatted),
      transcriptLength: transcriptMeta?.transcript?.length || 0,
      transcriptFormattedType: typeof transcriptMeta?.transcript_formatted,
    });

    // Generate a fresh presigned URL for media access if needed
    let freshMediaUrl = interviewData.media_url;
    if (interviewData.media_url) {
      try {
        let r2Key = getR2KeyFromPublicUrl(interviewData.media_url);

        // If getR2KeyFromPublicUrl failed, try to extract key from malformed paths
        // Pattern: /a/{accountId}/{projectId}/interviews/interviews/{projectId}/{filename}
        // or interviews/{projectId}/{filename}
        if (!r2Key && !interviewData.media_url.startsWith("http")) {
          const pathParts = interviewData.media_url.split("/").filter(Boolean);
          // Look for "interviews" in the path and extract everything after it
          const interviewsIndex = pathParts.indexOf("interviews");
          if (interviewsIndex >= 0 && interviewsIndex < pathParts.length - 1) {
            // Check if next part is also "interviews" (doubled path bug)
            const startIndex =
              pathParts[interviewsIndex + 1] === "interviews"
                ? interviewsIndex + 2
                : interviewsIndex + 1;
            r2Key = pathParts.slice(startIndex).join("/");
            // Add interviews prefix if not already there
            if (!r2Key.startsWith("interviews/")) {
              r2Key = `interviews/${r2Key}`;
            }
          }
        }

        if (r2Key) {
          // Generate a fresh presigned URL (valid for 1 hour)
          const presignedResult = createR2PresignedUrl({
            key: r2Key,
            expiresInSeconds: 60 * 60, // 1 hour
          });
          if (presignedResult) {
            freshMediaUrl = presignedResult.url;
          }
        }
      } catch (error) {
        consola.warn(
          "Could not generate fresh presigned URL for media:",
          error,
        );
        // Keep the original URL as fallback
      }
    }

    const interview = {
      ...interviewData,
      media_url: freshMediaUrl, // Use fresh presigned URL
      participants,
      primaryParticipant,
      // Check transcript availability without loading content
      hasTranscript: !!transcriptMeta?.transcript,
      hasFormattedTranscript: !!transcriptMeta?.transcript_formatted,
    };

    // Extract analysis job information from interview.conversation_analysis
    const analysisJob = extractAnalysisFromInterview(interview);

    const { data: insightsData, error } = await getInterviewInsights({
      supabase,
      interviewId: interviewId,
    });

    if (error) {
      const msg = error instanceof Error ? error.message : String(error);
      consola.error("Error fetching insights for interview", {
        interviewId,
        error: msg,
      });
    }

    const insights = insightsData ?? [];

    // Fetch evidence related to this interview with person associations
    const { data: evidence, error: evidenceError } = await supabase
      .from("evidence")
      .select(
        `
				*,
				evidence_people (
					person_id,
					role,
					people (
						id,
						name,
						segment
					)
				)
			`,
      )
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: false });

    if (evidenceError) {
      consola.warn("Could not fetch evidence:", evidenceError.message);
    }

    // Process empathy map data in the loader for better performance
    type EmpathyMapItem = {
      text: string;
      evidenceId: string;
      anchors?: unknown;
      personId?: string;
      personName?: string;
    };
    const empathyMap = {
      says: [] as EmpathyMapItem[],
      does: [] as EmpathyMapItem[],
      thinks: [] as EmpathyMapItem[],
      feels: [] as EmpathyMapItem[],
      pains: [] as EmpathyMapItem[],
      gains: [] as EmpathyMapItem[],
    };

    if (evidence) {
      evidence.forEach((e) => {
        const evidenceId = e.id;
        // Extract person info from evidence_people junction
        const personData =
          Array.isArray(e.evidence_people) && e.evidence_people.length > 0
            ? e.evidence_people[0]
            : null;
        const personId = personData?.people?.id;
        const personName = personData?.people?.name;

        // Process each empathy map category
        if (Array.isArray(e.says)) {
          e.says.forEach((item: string) => {
            if (typeof item === "string" && item.trim()) {
              empathyMap.says.push({
                text: item.trim(),
                evidenceId,
                anchors: e.anchors,
                personId,
                personName,
              });
            }
          });
        }

        if (Array.isArray(e.does)) {
          e.does.forEach((item: string) => {
            if (typeof item === "string" && item.trim()) {
              empathyMap.does.push({
                text: item.trim(),
                evidenceId,
                anchors: e.anchors,
                personId,
                personName,
              });
            }
          });
        }

        if (Array.isArray(e.thinks)) {
          e.thinks.forEach((item: string) => {
            if (typeof item === "string" && item.trim()) {
              empathyMap.thinks.push({
                text: item.trim(),
                evidenceId,
                anchors: e.anchors,
                personId,
                personName,
              });
            }
          });
        }

        if (Array.isArray(e.feels)) {
          e.feels.forEach((item: string) => {
            if (typeof item === "string" && item.trim()) {
              empathyMap.feels.push({
                text: item.trim(),
                evidenceId,
                anchors: e.anchors,
                personId,
                personName,
              });
            }
          });
        }

        if (Array.isArray(e.pains)) {
          e.pains.forEach((item: string) => {
            if (typeof item === "string" && item.trim()) {
              empathyMap.pains.push({
                text: item.trim(),
                evidenceId,
                anchors: e.anchors,
                personId,
                personName,
              });
            }
          });
        }

        if (Array.isArray(e.gains)) {
          e.gains.forEach((item: string) => {
            if (typeof item === "string" && item.trim()) {
              empathyMap.gains.push({
                text: item.trim(),
                evidenceId,
                anchors: e.anchors,
                personId,
                personName,
              });
            }
          });
        }
      });
    }

    // Deduplicate while preserving order and limit results
    const deduplicateAndLimit = (items: EmpathyMapItem[], limit = 8) => {
      const seen = new Set<string>();
      return items
        .filter((item) => {
          if (seen.has(item.text)) return false;
          seen.add(item.text);
          return true;
        })
        .slice(0, limit);
    };

    empathyMap.says = deduplicateAndLimit(empathyMap.says);
    empathyMap.does = deduplicateAndLimit(empathyMap.does);
    empathyMap.thinks = deduplicateAndLimit(empathyMap.thinks);
    empathyMap.feels = deduplicateAndLimit(empathyMap.feels);
    empathyMap.pains = deduplicateAndLimit(empathyMap.pains);
    empathyMap.gains = deduplicateAndLimit(empathyMap.gains);

    // Fetch creator's name from user_settings
    let creatorName = "Unknown";
    if (interviewData.created_by) {
      const { data: creatorData } = await supabase
        .from("user_settings")
        .select("first_name, last_name, email")
        .eq("user_id", interviewData.created_by)
        .single();

      if (creatorData) {
        if (creatorData.first_name || creatorData.last_name) {
          creatorName = [creatorData.first_name, creatorData.last_name]
            .filter(Boolean)
            .join(" ");
        } else if (creatorData.email) {
          creatorName = creatorData.email;
        }
      }
    }

    let assistantMessages: UpsightMessage[] = [];
    const userId = ctx.claims.sub;
    if (userId) {
      const resourceId = `interviewStatusAgent-${userId}-${interviewId}`;
      try {
        const threads = await memory.listThreadsByResourceId({
          resourceId,
          orderBy: { field: "createdAt", direction: "DESC" },
          page: 0,
          perPage: 1,
        });
        const threadId = threads?.threads?.[0]?.id;
        if (threadId) {
          const { messages } = await memory.recall({
            threadId,
            selectBy: { last: 50 },
          });
          assistantMessages = convertMessages(messages).to(
            "AIV5.UI",
          ) as UpsightMessage[];
        }
      } catch (error) {
        consola.warn("Failed to load assistant history", { resourceId, error });
      }
    }

    const loaderResult = {
      accountId,
      projectId,
      interview,
      insights,
      evidence: evidence || [],
      empathyMap,
      peopleOptions: peopleOptions || [],
      creatorName,
      analysisJob,
      assistantMessages,
      conversationAnalysis,
      salesLens,
      linkedOpportunity,
      lensTemplates,
      lensAnalyses,
    };

    consola.info("✅ Loader completed successfully:", {
      accountId,
      projectId,
      interviewId: interview.id,
      insightsCount: insights?.length || 0,
      evidenceCount: evidence?.length || 0,
      assistantMessages: assistantMessages.length,
    });

    // Track interview_detail_viewed event for PLG instrumentation
    try {
      const posthogServer = getPostHogServerClient();
      if (posthogServer) {
        const userId = ctx.claims.sub;
        posthogServer.capture({
          distinctId: userId,
          event: "interview_detail_viewed",
          properties: {
            interview_id: interviewId,
            project_id: projectId,
            account_id: accountId,
            has_transcript: interview.hasTranscript,
            has_analysis: !!conversationAnalysis,
            evidence_count: evidence?.length || 0,
            insights_count: insights?.length || 0,
            $groups: { account: accountId },
          },
        });
      }
    } catch (trackingError) {
      consola.warn(
        "[INTERVIEW_DETAIL] PostHog tracking failed:",
        trackingError,
      );
      // Don't throw - tracking failure shouldn't block user flow
    }

    return loaderResult;
  } catch (error) {
    // Re-throw Response errors directly without wrapping
    if (error instanceof Response) {
      throw error;
    }

    const msg = error instanceof Error ? error.message : String(error);
    consola.error("❌ Loader caught error:", error);
    consola.error("Error details:", {
      message: msg,
      accountId,
      projectId,
      interviewId,
    });
    throw new Response(`Failed to load interview: ${msg}`, { status: 500 });
  }
}

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
    empathyMap,
    peopleOptions,
    creatorName,
    analysisJob,
    assistantMessages,
    conversationAnalysis,
    salesLens,
    linkedOpportunity,
    lensTemplates,
    lensAnalyses,
  } = useLoaderData<typeof loader>();

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
  >(conversationAnalysis?.customLenses ?? {});
  const [_isChatOpen, _setIsChatOpen] = useState(
    () => assistantMessages.length > 0,
  );
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [regeneratePopoverOpen, setRegeneratePopoverOpen] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
            conversation_analysis: interviewState.conversation_analysis,
          }
        : null,
    [
      interviewState?.id,
      interviewState?.status,
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
  const refreshTriggeredRef = useRef(false);
  const fetcherPrevStateRef = useRef(fetcher.state);
  const takeawaysPollTaskIdRef = useRef<string | null>(null);
  const takeawaysPollTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>(
    [],
  );

  const submitInterviewFieldUpdate = (
    field_name: string,
    field_value: string,
  ) => {
    fetcher.submit(
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
      for (const timeout of takeawaysPollTimeoutsRef.current) {
        clearTimeout(timeout);
      }
      takeawaysPollTimeoutsRef.current = [];

      const intervals = [2000, 5000, 8000, 12000, 16000, 22000, 30000];
      for (const delay of intervals) {
        takeawaysPollTimeoutsRef.current.push(
          setTimeout(() => revalidator.revalidate(), delay),
        );
      }
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  useEffect(() => {
    return () => {
      for (const timeout of takeawaysPollTimeoutsRef.current) {
        clearTimeout(timeout);
      }
    };
  }, []);

  useEffect(() => {
    if (deleteFetcher.state !== "idle") return;
    const redirectTo = deleteFetcher.data?.redirectTo;
    if (redirectTo) {
      navigate(redirectTo);
    }
  }, [deleteFetcher.state, deleteFetcher.data, navigate]);

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
  // Derive from transcript_formatted utterances/speaker_transcripts
  const transcriptSpeakers = useMemo(() => {
    const transcriptData = interview.transcript_formatted as
      | {
          utterances?: Array<{ speaker: string }>;
          speaker_transcripts?: Array<{ speaker: string }>;
        }
      | null
      | undefined;

    const utterances =
      (Array.isArray(transcriptData?.utterances) &&
        transcriptData.utterances) ||
      (Array.isArray(transcriptData?.speaker_transcripts) &&
        transcriptData.speaker_transcripts) ||
      [];

    if (!utterances.length) {
      return [];
    }

    // Extract unique speakers from utterances
    const uniqueSpeakers = new Set<string>();
    for (const utterance of utterances) {
      if (utterance.speaker) {
        uniqueSpeakers.add(utterance.speaker);
      }
    }

    // Convert to TranscriptSpeaker format with proper labels
    return Array.from(uniqueSpeakers).map((key) => {
      // Generate a display label based on the speaker key format
      let label = key;
      // participant-0, participant-1 -> Speaker A, B
      if (/^participant-\d+$/i.test(key)) {
        const num = Number.parseInt(key.split("-")[1], 10);
        const letter = String.fromCharCode(65 + num); // 0 -> A, 1 -> B
        label = `Speaker ${letter}`;
      } else if (/^[A-Z]$/i.test(key)) {
        label = `Speaker ${key.toUpperCase()}`;
      } else if (/^speaker[\s_-]?(\d+)$/i.test(key)) {
        const match = key.match(/(\d+)/);
        if (match) {
          const num = Number.parseInt(match[1], 10);
          const letter = String.fromCharCode(64 + num); // 1 -> A, 2 -> B
          label = `Speaker ${letter}`;
        }
      }
      return { key, label };
    });
  }, [interview.transcript_formatted]);
  const aiKeyTakeaways = conversationAnalysis?.keyTakeaways ?? [];
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
  const personalFacetSummary = useMemo(() => {
    if (!participants.length) return "";

    const lines = participants
      .map((participant) => {
        const person =
          (participant.people as {
            name?: string | null;
            segment?: string | null;
            people_personas?: Array<{
              personas?: { name?: string | null } | null;
            }>;
          } | null) || null;
        const personaNames = Array.from(
          new Set(
            (person?.people_personas || [])
              .map((entry) => entry?.personas?.name)
              .filter(
                (name): name is string =>
                  typeof name === "string" && name.trim(),
              ),
          ),
        );

        const facets: string[] = [];
        if (participant.role) facets.push(`Role: ${participant.role}`);
        if (person?.segment) facets.push(`Segment: ${person.segment}`);
        if (personaNames.length > 0)
          facets.push(`Personas: ${personaNames.join(", ")}`);

        const displayName =
          person?.name ||
          participant.display_name ||
          (participant.transcript_key
            ? `Speaker ${participant.transcript_key}`
            : null);

        if (!displayName && facets.length === 0) {
          return null;
        }

        return `- ${(displayName || "Participant").trim()}${facets.length ? ` (${facets.join("; ")})` : ""}`;
      })
      .filter((line): line is string => Boolean(line));

    return lines.slice(0, 8).join("\n");
  }, [participants]);

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

  const uniqueSpeakers = useMemo(() => {
    const speakerMap = new Map<
      string,
      { id: string; name: string; count: number }
    >();

    // Collect all speakers from empathy map items
    const allItems = [
      ...empathyMap.says,
      ...empathyMap.does,
      ...empathyMap.thinks,
      ...empathyMap.feels,
      ...empathyMap.pains,
      ...empathyMap.gains,
    ];

    allItems.forEach((item) => {
      if (item.personId && item.personName) {
        const existing = speakerMap.get(item.personId);
        if (existing) {
          existing.count++;
        } else {
          speakerMap.set(item.personId, {
            id: item.personId,
            name: item.personName,
            count: 1,
          });
        }
      }
    });

    // Sort by count (most evidence first), then by name
    return Array.from(speakerMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [empathyMap]);

  const _personLenses = useMemo(() => {
    return uniqueSpeakers.map((speaker) => {
      const filterByPerson = (items: typeof empathyMap.says) => {
        return items
          .filter((item) => item.personId === speaker.id)
          .map((item) => ({
            text: item.text,
            evidenceId: item.evidenceId,
            anchors: item.anchors,
          }));
      };

      return {
        id: speaker.id,
        name: speaker.name,
        painsAndGoals: {
          pains: filterByPerson(empathyMap.pains),
          gains: filterByPerson(empathyMap.gains),
        },
        empathyMap: {
          says: filterByPerson(empathyMap.says),
          does: filterByPerson(empathyMap.does),
          thinks: filterByPerson(empathyMap.thinks),
          feels: filterByPerson(empathyMap.feels),
        },
      };
    });
  }, [uniqueSpeakers, empathyMap]);

  const _customLensDefaults = useMemo<
    Record<string, { summary?: string; notes?: string; highlights?: string[] }>
  >(() => {
    const firstNonEmpty = (...values: Array<string | null | undefined>) => {
      for (const value of values) {
        if (typeof value === "string" && value.trim().length > 0)
          return value.trim();
      }
      return undefined;
    };

    const highImpactThemes = Array.isArray(interview.high_impact_themes)
      ? (interview.high_impact_themes as string[]).filter(
          (item) => typeof item === "string" && item.trim().length > 0,
        )
      : [];

    const engineeringRecommendation = (
      conversationAnalysis?.recommendations ?? []
    ).find((rec) =>
      /(tech|engineering|product|integration)/i.test(
        `${rec.focusArea} ${rec.action} ${rec.rationale}`,
      ),
    );

    const empathyPains = empathyMap.pains
      .map((item) => item.text)
      .filter((text): text is string => Boolean(text?.trim()));
    const empathyFeels = empathyMap.feels
      .map((item) => item.text)
      .filter((text): text is string => Boolean(text?.trim()));
    const empathyGains = empathyMap.gains
      .map((item) => item.text)
      .filter((text): text is string => Boolean(text?.trim()));

    const openQuestions = (conversationAnalysis?.openQuestions ?? []).filter(
      (item) => item && item.trim().length > 0,
    );
    const nervousTakeaway = conversationAnalysis?.keyTakeaways.find(
      (takeaway) => takeaway.priority === "low",
    );

    return {
      productImpact: {
        summary: firstNonEmpty(
          highImpactThemes[0],
          engineeringRecommendation?.action,
          conversationAnalysis?.keyTakeaways.find(
            (takeaway) => takeaway.priority === "high",
          )?.summary,
        ),
        notes: firstNonEmpty(
          engineeringRecommendation
            ? `${engineeringRecommendation.focusArea}: ${engineeringRecommendation.action}`
            : undefined,
          interview.observations_and_notes ?? undefined,
        ),
        highlights: highImpactThemes.slice(0, 4),
      },
      customerService: {
        summary: firstNonEmpty(
          empathyPains[0],
          empathyGains[0],
          conversationAnalysis?.summary ?? undefined,
        ),
        notes: firstNonEmpty(empathyFeels[0], empathyGains[1]),
        highlights: empathyPains.slice(0, 4),
      },
      pessimistic: {
        summary: firstNonEmpty(
          openQuestions[0],
          interview.open_questions_and_next_steps ?? undefined,
        ),
        notes: firstNonEmpty(openQuestions[1], nervousTakeaway?.summary),
        highlights: openQuestions.slice(0, 4),
      },
    };
  }, [
    conversationAnalysis?.keyTakeaways,
    conversationAnalysis?.openQuestions,
    conversationAnalysis?.recommendations,
    conversationAnalysis?.summary,
    empathyMap.feels,
    empathyMap.gains,
    empathyMap.pains,
    interview.high_impact_themes,
    interview.observations_and_notes,
    interview.open_questions_and_next_steps,
  ]);

  useEffect(() => {
    setCustomLensOverrides(conversationAnalysis?.customLenses ?? {});
  }, [conversationAnalysis?.customLenses]);

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

  // Check if any action is in progress
  const isActionPending =
    navigation.state === "loading" || navigation.state === "submitting";
  const isFetcherBusy =
    fetcher.state !== "idle" || participantFetcher.state !== "idle";
  const showBlockingOverlay = isActionPending || isFetcherBusy;
  const overlayLabel =
    navigation.state === "loading"
      ? "Loading interview..."
      : navigation.state === "submitting" || isFetcherBusy
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

        {/* Scorecard (full width) */}
        <InterviewScorecard
          interview={interview}
          accountId={contextAccountId ?? accountId}
          projectId={projectId}
          evidenceCount={evidence.length}
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
        />

        {/* 2-column layout: Insights (left) + Sources (right) */}
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr]">
          {/* Left column: Insights & Analysis */}
          <div className="space-y-6">
            <InterviewInsights
              interviewId={interview.id}
              accountId={accountId}
              projectId={projectId}
              aiKeyTakeaways={conversationAnalysis?.keyTakeaways ?? []}
              conversationUpdatedLabel={conversationUpdatedLabel}
              keyTakeaways={(interview.key_takeaways as string) ?? ""}
              observationsAndNotes={
                (interview.observations_and_notes as string) ?? ""
              }
              onFieldUpdate={submitInterviewFieldUpdate}
            />

            <InterviewRecommendations
              recommendations={conversationAnalysis?.recommendations ?? []}
              openQuestions={conversationAnalysis?.openQuestions ?? []}
            />

            {/* Conversation Lenses */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground text-lg">
                Conversation Lenses
              </h3>
              {lensTemplates.length > 0 ? (
                <LensAccordion
                  interviewId={interview.id}
                  templates={lensTemplates}
                  analyses={lensAnalyses}
                  editable
                  evidenceMap={evidenceMap}
                  onLensApplied={() => revalidator.revalidate()}
                />
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center dark:bg-muted/10">
                  <p className="text-muted-foreground text-sm">
                    Conversation Lenses not available
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Lenses will appear once analysis is complete
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right column: Sources (sticky) */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <InterviewSourcePanel
              interview={interview}
              evidence={evidence}
              accountId={accountId}
              projectId={projectId}
              onSpeakerClick={() => setParticipantsDialogOpen(true)}
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
            onUpdate={() => {
              revalidator.revalidate();
            }}
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
    </>
  );
}

function _InterviewCopilotDrawer({
  open,
  onOpenChange,
  accountId,
  projectId,
  interviewId,
  interviewTitle,
  systemContext,
  initialPrompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  projectId: string;
  interviewId: string;
  interviewTitle: string;
  systemContext: string;
  initialPrompt: string;
}) {
  const [input, setInput] = useState("");
  const [initialMessageSent, setInitialMessageSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const routes = useProjectRoutesFromIds(accountId, projectId);
  const { messages, sendMessage, status } = useChat<UpsightMessage>({
    transport: new DefaultChatTransport({
      api: routes.api.chat.interview(interviewId),
      body: { system: systemContext },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const visibleMessages = useMemo(
    () => (messages ?? []).slice(-20),
    [messages],
  );

  useEffect(() => {
    if (open && !initialMessageSent && visibleMessages.length === 0) {
      sendMessage({ text: initialPrompt });
      setInitialMessageSent(true);
    }
  }, [
    open,
    initialMessageSent,
    visibleMessages.length,
    sendMessage,
    initialPrompt,
  ]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const isBusy = status === "streaming" || status === "submitted";
  const isError = status === "error";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-border border-b bg-muted/40 p-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <BotMessageSquare className="h-4 w-4 text-primary" />
            UpSight Assistant
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex-1 p-3">
            {visibleMessages.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Gathering the latest takeaways from this interview…
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                {visibleMessages.map((message, index) => {
                  const key = message.id || `${message.role}-${index}`;
                  const isUser = message.role === "user";
                  const textParts =
                    message.parts?.map((part) => {
                      if (part.type === "text") return part.text;
                      if (part.type === "tool-call") {
                        return `Calling tool: ${part.toolName ?? "unknown"}`;
                      }
                      if (part.type === "tool-result") {
                        return `Tool result: ${part.toolName ?? "unknown"}`;
                      }
                      return "";
                    }) ?? [];
                  const messageText = textParts
                    .filter(Boolean)
                    .join("\n")
                    .trim();
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex",
                        isUser ? "justify-end" : "justify-start",
                      )}
                    >
                      <div className="max-w-[90%]">
                        <div className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                          {isUser ? "You" : "Assistant"}
                        </div>
                        <div
                          className={cn(
                            "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm",
                            isUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-foreground ring-1 ring-border/60",
                          )}
                        >
                          {messageText ? (
                            isUser ? (
                              <span className="whitespace-pre-wrap">
                                {messageText}
                              </span>
                            ) : (
                              <Streamdown className="prose prose-sm max-w-none text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                {messageText}
                              </Streamdown>
                            )
                          ) : !isUser ? (
                            <span className="text-muted-foreground italic">
                              Thinking...
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              (No text response)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="Ask about evidence, themes, or next steps"
              rows={3}
              disabled={isBusy}
            />
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-muted-foreground text-xs"
                aria-live="polite"
              >
                {isError
                  ? "Something went wrong. Try again."
                  : isBusy
                    ? "Thinking…"
                    : "Keep questions short and specific."}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || isBusy}
              >
                Send
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
