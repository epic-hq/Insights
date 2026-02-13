// app/hooks/useSidebarCounts.ts
import { useEffect, useMemo, useState } from "react";
import { createClient } from "~/lib/supabase/client";

type Counts = {
  // Discovery
  encounters?: number;
  personas?: number;
  themes?: number;
  insights?: number;
  content?: number;

  // Directory
  people?: number;
  organizations?: number;

  // Tasks
  highPriorityTasks?: number;
  surveys?: number;
  surveyResponses?: number;

  // Revenue (future)
  accounts?: number;
  deals?: number;
  contacts?: number;
  opportunities?: number;
};

export function useSidebarCounts(
  accountId?: string,
  projectId?: string,
  _workflowType?: string | null,
) {
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId || !projectId) return;
    let isCancelled = false;

    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        // Execute all count queries in parallel
        const [
          interviewsResult,
          noteInterviewsResult,
          projectAssetsResult,
          personasResult,
          themesResult,
          themeEvidenceThemesResult,
          peopleResult,
          organizationsResult,
          opportunitiesResult,
          highPriorityTasksResult,
          surveysResult,
          surveyResponsesResult,
        ] = await Promise.all([
          // Count interviews
          supabase
            .from("interviews")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId),

          // Count notes (stored as interviews)
          supabase
            .from("interviews")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId)
            .or(
              "source_type.eq.note,interview_type.eq.note,media_type.eq.note",
            ),

          // Count project assets (files)
          supabase
            .from("project_assets")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId),

          // Count personas
          supabase
            .from("personas")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId),

          // Count themes
          supabase
            .from("themes")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId),

          // Count insights (themes that have evidence)
          supabase
            .from("theme_evidence")
            .select("theme_id")
            .eq("project_id", projectId),

          // Count people for this project
          supabase
            .from("people")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId),

          // Count organizations
          supabase
            .from("organizations")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId),

          // Count opportunities
          supabase
            .from("opportunities")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId),

          // Count high priority tasks (priority = 1, active statuses)
          supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("priority", 1)
            .in("status", ["todo", "in_progress", "blocked", "review"]),

          // Count surveys (research links)
          supabase
            .from("research_links")
            .select("*", { count: "exact", head: true })
            .eq("project_id", projectId),

          // Count survey responses (research link responses)
          supabase
            .from("research_link_responses")
            .select("id, research_links!inner(project_id)", {
              count: "exact",
              head: true,
            })
            .eq("research_links.project_id", projectId),
        ]);

        if (!isCancelled) {
          const interview_count = interviewsResult.count || 0;
          const notes_count = noteInterviewsResult.count || 0;
          const conversations_count = Math.max(
            0,
            interview_count - notes_count,
          );
          const files_count = projectAssetsResult.count || 0;
          const content_count = conversations_count + notes_count + files_count;
          const insight_count = new Set(
            (themeEvidenceThemesResult.data ?? [])
              .map((row: { theme_id: string | null }) => row.theme_id)
              .filter(Boolean),
          ).size;

          setCounts({
            encounters: interview_count,
            personas: personasResult.count || 0,
            themes: themesResult.count || 0,
            insights: insight_count,
            content: content_count,
            people: peopleResult.count || 0,
            organizations: organizationsResult.count || 0,
            opportunities: opportunitiesResult.count || 0,
            highPriorityTasks: highPriorityTasksResult.count || 0,
            surveys: surveysResult.count || 0,
            surveyResponses: surveyResponsesResult.count || 0,
          });
        }
      } catch (error) {
        console.error("[useSidebarCounts] Error fetching counts:", error);
        if (!isCancelled) {
          setCounts({});
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [accountId, projectId]);

  // Only surface counts > 0 to reduce noise.
  const visible = useMemo(() => {
    const out: Counts = {};
    for (const k of Object.keys(counts) as (keyof Counts)[]) {
      const v = counts[k];
      if (typeof v === "number" && v > 0) {
        out[k] = v;
      }
    }
    return out;
  }, [counts]);

  return { counts: visible, loading };
}
