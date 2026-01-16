import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ResearchLink, ResearchLinkResponse } from "~/types";

/**
 * Project research context for generating recommendations.
 * Contains aggregated project state for determining what actions to suggest.
 */
export interface ProjectResearchContext {
  projectId: string;
  accountId: string;

  // Project setup state
  hasGoals: boolean;
  projectSections: Array<{
    kind: string;
    content_md: string | null;
  }>;

  // Research progress
  interviewCount: number;
  surveyCount: number;
  surveyResponseCount: number;

  // Themes and evidence
  themes: Array<{
    id: string;
    name: string;
    jtbd: string | null;
    pain: string | null;
    desired_outcome: string | null;
    motivation: string | null;
    evidence_count: number;
  }>;

  // Existing questions (to avoid duplication)
  interviewPrompts: Array<{
    id: string;
    text: string;
    category: string | null;
  }>;

  // Previous surveys
  previousSurveys: Array<{
    id: string;
    name: string;
    response_count: number;
    created_at: string;
  }>;

  // Account context
  accountContext: {
    company_description: string | null;
    customer_problem: string | null;
    offerings: string | null;
    target_roles: string | null;
  } | null;
}

/**
 * Fetch comprehensive project research context for generating recommendations.
 * Used by the recommendation workflow to assess project state.
 */
export async function getProjectResearchContext({
  supabase,
  projectId,
}: {
  supabase: SupabaseClient<Database>;
  projectId: string;
}): Promise<ProjectResearchContext> {
  const [
    projectResult,
    sectionsResult,
    themesResult,
    promptsResult,
    surveysResult,
    interviewCountResult,
  ] = await Promise.all([
    // Get project with account context
    supabase
      .from("projects")
      .select(
        "account_id, accounts(company_description, customer_problem, offerings, target_roles)",
      )
      .eq("id", projectId)
      .single(),

    // Get project sections (goals, target roles, etc.)
    supabase
      .from("project_sections")
      .select("kind, content_md")
      .eq("project_id", projectId)
      .in("kind", [
        "goal",
        "research_goal",
        "research_goal_details",
        "target_roles",
        "target_orgs",
        "customer_problem",
      ]),

    // Get themes with evidence counts
    supabase
      .from("themes")
      .select("id, name, jtbd, pain, desired_outcome, motivation")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),

    // Get selected interview prompts
    supabase
      .from("interview_prompts")
      .select("id, text, category")
      .eq("project_id", projectId)
      .eq("is_selected", true),

    // Get previous surveys with response counts
    supabase
      .from("research_links")
      .select("id, name, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10),

    // Get interview count
    supabase
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  // Get evidence counts for themes
  const themeIds = themesResult.data?.map((t) => t.id) ?? [];
  let evidenceCountMap = new Map<string, number>();

  if (themeIds.length > 0) {
    const { data: evidenceCounts } = await supabase
      .from("evidence")
      .select("theme_id")
      .in("theme_id", themeIds);

    // Count evidence per theme
    for (const e of evidenceCounts ?? []) {
      if (e.theme_id) {
        evidenceCountMap.set(
          e.theme_id,
          (evidenceCountMap.get(e.theme_id) ?? 0) + 1,
        );
      }
    }
  }

  // Get survey response counts
  const surveyIds = surveysResult.data?.map((s) => s.id) ?? [];
  let surveyResponseMap = new Map<string, number>();
  let totalSurveyResponses = 0;

  if (surveyIds.length > 0) {
    const { data: responseCounts } = await supabase.rpc(
      "get_research_link_response_counts",
      {
        link_ids: surveyIds,
      },
    );

    for (const row of responseCounts ?? []) {
      const count = Number(row.response_count) ?? 0;
      surveyResponseMap.set(row.research_link_id, count);
      totalSurveyResponses += count;
    }
  }

  // Determine if project has goals set (check multiple goal-related sections)
  const goalKinds = ["goal", "research_goal", "research_goal_details"];
  const hasGoals =
    sectionsResult.data?.some(
      (s) =>
        goalKinds.includes(s.kind) &&
        s.content_md &&
        s.content_md.trim().length > 0,
    ) ?? false;

  // Build account context from joined data
  const accountData = projectResult.data?.accounts;
  const accountContext = accountData
    ? {
        company_description: (accountData as any).company_description ?? null,
        customer_problem: (accountData as any).customer_problem ?? null,
        offerings: (accountData as any).offerings ?? null,
        target_roles: (accountData as any).target_roles ?? null,
      }
    : null;

  return {
    projectId,
    accountId: projectResult.data?.account_id ?? "",

    hasGoals,
    projectSections: sectionsResult.data ?? [],

    interviewCount: interviewCountResult.count ?? 0,
    surveyCount: surveysResult.data?.length ?? 0,
    surveyResponseCount: totalSurveyResponses,

    themes: (themesResult.data ?? []).map((t) => ({
      ...t,
      evidence_count: evidenceCountMap.get(t.id) ?? 0,
    })),

    interviewPrompts: promptsResult.data ?? [],

    previousSurveys: (surveysResult.data ?? []).map((s) => ({
      ...s,
      response_count: surveyResponseMap.get(s.id) ?? 0,
    })),

    accountContext,
  };
}

interface GetLinksArgs {
  supabase: SupabaseClient<Database>;
  accountId: string;
  projectId?: string;
}

export async function getResearchLinks({
  supabase,
  accountId,
  projectId,
}: GetLinksArgs) {
  let query = supabase
    .from("research_links")
    .select("*")
    .eq("account_id", accountId);

  // Filter by project if provided
  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data: links, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error || !links?.length) {
    return { data: links, error };
  }

  const linkIds = links.map((link) => link.id);
  const { data: counts, error: countError } = await supabase.rpc(
    "get_research_link_response_counts",
    {
      link_ids: linkIds,
    },
  );

  const countByLinkId = new Map<string, number>();
  for (const row of counts ?? []) {
    countByLinkId.set(row.research_link_id, Number(row.response_count) ?? 0);
  }

  const merged = links.map((link) => ({
    ...link,
    research_link_responses: [{ count: countByLinkId.get(link.id) ?? 0 }],
  }));

  return {
    data: merged as Array<
      ResearchLink & { research_link_responses: Array<{ count: number }> }
    >,
    error: error ?? countError ?? null,
  };
}

export async function getResearchLinkById({
  supabase,
  accountId,
  listId,
}: GetLinksArgs & { listId: string }) {
  return supabase
    .from("research_links")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", listId)
    .maybeSingle();
}

export type ResponseWithPerson = ResearchLinkResponse & {
  person: { id: string; name: string | null } | null;
};

export async function getResearchLinkWithResponses({
  supabase,
  accountId,
  listId,
}: GetLinksArgs & { listId: string }) {
  const [listResult, responsesResult] = await Promise.all([
    supabase
      .from("research_links")
      .select("*")
      .eq("account_id", accountId)
      .eq("id", listId)
      .maybeSingle(),
    supabase
      .from("research_link_responses")
      .select("*, person:people(id, name)")
      .eq("research_link_id", listId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    list: listResult.data as ResearchLink | null,
    listError: listResult.error,
    responses: responsesResult.data as ResponseWithPerson[] | null,
    responsesError: responsesResult.error,
  };
}

export async function getResearchLinkBySlug({
  supabase,
  slug,
}: {
  supabase: SupabaseClient<Database>;
  slug: string;
}) {
  return supabase
    .from("research_links")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
}

/**
 * Save/merge a response answer for a research link
 * Used by both form mode and chat mode
 */
export async function saveResearchLinkAnswer({
  supabase,
  responseId,
  questionId,
  answer,
}: {
  supabase: SupabaseClient<Database>;
  responseId: string;
  questionId: string;
  answer: string | string[];
}): Promise<{ success: boolean; error?: string }> {
  // Get existing responses to merge with
  const { data: existing, error: fetchError } = await supabase
    .from("research_link_responses")
    .select("responses")
    .eq("id", responseId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  if (!existing) {
    return { success: false, error: "Response not found" };
  }

  // Merge with existing responses
  const existingResponses =
    (existing.responses as Record<string, unknown>) ?? {};
  const updatedResponses = {
    ...existingResponses,
    [questionId]: answer,
  };

  // Save updated responses
  const { error: updateError } = await supabase
    .from("research_link_responses")
    .update({ responses: updatedResponses })
    .eq("id", responseId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

/**
 * Mark a research link response as complete and trigger evidence extraction
 */
export async function markResearchLinkComplete({
  supabase,
  responseId,
}: {
  supabase: SupabaseClient<Database>;
  responseId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("research_link_responses")
    .update({ completed: true })
    .eq("id", responseId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Trigger background task to extract evidence from text responses
  try {
    const { extractSurveyEvidenceTask } =
      await import("~/../src/trigger/survey/extractSurveyEvidence");
    await extractSurveyEvidenceTask.trigger({ responseId });
  } catch (triggerError) {
    // Log but don't fail - the response is marked complete
    console.error(
      "[markResearchLinkComplete] Failed to trigger evidence extraction:",
      triggerError,
    );
  }

  return { success: true };
}
