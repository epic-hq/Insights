import type { QueryData, SupabaseClient } from "@supabase/supabase-js";
import type { Database, InsightInsert } from "~/types";
import type {
  StakeholderSummary,
  CommonGround,
} from "~/features/insights/types";

// This is our pattern for defining typed queries and returning results.
// in particular, we should create variables that describe the results
export const getInsights = async ({
  supabase,
  accountId,
  projectId,
  offset,
  limit,
}: {
  supabase: SupabaseClient<Database>;
  accountId: string;
  projectId: string;
  offset?: number;
  limit?: number;
}) => {
  const baseQuery = supabase
    .from("themes")
    .select(
      `
			id,
			name,
			statement,
			inclusion_criteria,
			exclusion_criteria,
			synonyms,
			anti_examples,
			category,
			jtbd,
			pain,
			desired_outcome,
			journey_stage,
			emotional_response,
			motivation,
			impact,
			priority,
			updated_at,
			project_id,
			created_at,
			theme_evidence(count)
		`,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  // Optional pagination (PostgREST range is inclusive)
  if (typeof offset === "number" && typeof limit === "number") {
    baseQuery.range(offset, offset + limit - 1);
  }

  const { data, error } = await baseQuery;
  const insightIds = data?.map((i) => i.id) || [];

  // Get interview IDs via theme_evidence junction table
  const { data: evidenceLinks } = insightIds.length
    ? await supabase
        .from("theme_evidence")
        .select("theme_id, evidence_id, evidence:evidence_id(interview_id)")
        .in("theme_id", insightIds)
    : { data: null };

  const interviewIds =
    Array.from(
      new Set(
        (evidenceLinks as any)
          ?.map((link: any) => link.evidence?.interview_id)
          .filter(Boolean) as string[],
      ),
    ) || [];

  const [
    tagsResult,
    personasResult,
    interviewsResult,
    priorityResult,
    votesResult,
  ] = insightIds.length
    ? await Promise.all([
        supabase
          .from("insight_tags")
          .select("insight_id, tags:tag_id(tag, term, definition)")
          .in("insight_id", insightIds),
        supabase
          .from("persona_insights")
          .select("insight_id, personas:persona_id(id, name)")
          .in("insight_id", insightIds),
        interviewIds.length
          ? supabase
              .from("interviews")
              .select("id, title")
              .in("id", interviewIds)
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("insights_with_priority")
          .select("id, priority")
          .in("id", insightIds),
        supabase
          .from("votes")
          .select("entity_id")
          .eq("entity_type", "insight")
          .eq("project_id", projectId)
          .in("entity_id", insightIds),
      ])
    : [null, null, null, null, null];

  const tagsMap = new Map<
    string,
    Array<{
      tag?: string | null;
      term?: string | null;
      definition?: string | null;
    }>
  >();
  tagsResult?.data?.forEach((row) => {
    if (!row.insight_id) return;
    if (!tagsMap.has(row.insight_id)) tagsMap.set(row.insight_id, []);
    if (row.tags) tagsMap.get(row.insight_id)?.push(row.tags);
  });

  const personasMap = new Map<
    string,
    Array<{ id: string; name: string | null }>
  >();
  personasResult?.data?.forEach((row) => {
    if (!row.insight_id || !row.personas) return;
    if (!personasMap.has(row.insight_id)) personasMap.set(row.insight_id, []);
    personasMap.get(row.insight_id)?.push(row.personas);
  });

  const interviewsMap = new Map<string, { id: string; title: string | null }>();
  interviewsResult?.data?.forEach((row) => {
    if (row.id) interviewsMap.set(row.id, row);
  });

  const priorityMap = new Map<string, number>();
  priorityResult?.data?.forEach((row) => {
    priorityMap.set(row.id, row.priority ?? 0);
  });

  const voteCountMap = new Map<string, number>();
  votesResult?.data?.forEach((row) => {
    if (!row.entity_id) return;
    voteCountMap.set(row.entity_id, (voteCountMap.get(row.entity_id) ?? 0) + 1);
  });

  // Build interview map for each theme via evidence links
  const themeInterviewsMap = new Map<string, string[]>();
  const themeEvidenceMap = new Map<string, Set<string>>();
  if (evidenceLinks) {
    (evidenceLinks as any).forEach((link: any) => {
      const themeId = link.theme_id;
      const interviewId = link.evidence?.interview_id;
      const evidenceId = link.evidence_id;
      if (themeId && interviewId) {
        if (!themeInterviewsMap.has(themeId)) {
          themeInterviewsMap.set(themeId, []);
        }
        if (!themeInterviewsMap.get(themeId)?.includes(interviewId)) {
          themeInterviewsMap.get(themeId)?.push(interviewId);
        }
      }
      // Track evidence IDs per theme for person count
      if (themeId && evidenceId) {
        if (!themeEvidenceMap.has(themeId)) {
          themeEvidenceMap.set(themeId, new Set());
        }
        themeEvidenceMap.get(themeId)!.add(evidenceId);
      }
    });
  }

  // Get EXTERNAL person counts per theme (people without user_id = not internal users)
  // Uses all three sources: evidence_facet, evidence_people, interview_people
  const allEvidenceIds = new Set<string>();
  for (const evSet of themeEvidenceMap.values()) {
    for (const evId of evSet) allEvidenceIds.add(evId);
  }

  const themePersonCounts = new Map<string, number>();
  if (allEvidenceIds.size > 0) {
    // Build evidence -> person mapping from ALL sources
    const evidenceToPersons = new Map<string, Set<string>>();

    // Source 1: evidence_facet (primary source)
    const { data: facetPersons } = await supabase
      .from("evidence_facet")
      .select("evidence_id, person_id")
      .eq("project_id", projectId)
      .in("evidence_id", Array.from(allEvidenceIds))
      .not("person_id", "is", null);

    for (const fp of facetPersons ?? []) {
      if (!fp.person_id) continue;
      if (!evidenceToPersons.has(fp.evidence_id)) {
        evidenceToPersons.set(fp.evidence_id, new Set());
      }
      evidenceToPersons.get(fp.evidence_id)!.add(fp.person_id);
    }

    // Source 2: evidence_people (direct link)
    const { data: evidencePeople } = await supabase
      .from("evidence_people")
      .select("evidence_id, person_id")
      .eq("project_id", projectId)
      .in("evidence_id", Array.from(allEvidenceIds));

    for (const ep of evidencePeople ?? []) {
      if (!ep.person_id) continue;
      if (!evidenceToPersons.has(ep.evidence_id)) {
        evidenceToPersons.set(ep.evidence_id, new Set());
      }
      evidenceToPersons.get(ep.evidence_id)!.add(ep.person_id);
    }

    // Source 3: interview_people via evidence -> interview link
    const evidenceInterviewMap = new Map<string, string>();
    (evidenceLinks as any)?.forEach((link: any) => {
      if (link.evidence_id && link.evidence?.interview_id) {
        evidenceInterviewMap.set(link.evidence_id, link.evidence.interview_id);
      }
    });

    const uniqueInterviewIds = [...new Set(evidenceInterviewMap.values())];
    if (uniqueInterviewIds.length > 0) {
      const { data: interviewPeople } = await supabase
        .from("interview_people")
        .select("interview_id, person_id")
        .in("interview_id", uniqueInterviewIds);

      // Build interview -> persons map
      const interviewToPersons = new Map<string, Set<string>>();
      for (const ip of interviewPeople ?? []) {
        if (!ip.person_id) continue;
        if (!interviewToPersons.has(ip.interview_id)) {
          interviewToPersons.set(ip.interview_id, new Set());
        }
        interviewToPersons.get(ip.interview_id)!.add(ip.person_id);
      }

      // Add interview people to evidence -> person mapping
      for (const [evidenceId, interviewId] of evidenceInterviewMap) {
        const persons = interviewToPersons.get(interviewId);
        if (persons) {
          if (!evidenceToPersons.has(evidenceId)) {
            evidenceToPersons.set(evidenceId, new Set());
          }
          for (const p of persons) {
            evidenceToPersons.get(evidenceId)!.add(p);
          }
        }
      }
    }

    // Collect all unique person IDs
    const allPersonIds = new Set<string>();
    for (const personSet of evidenceToPersons.values()) {
      for (const pid of personSet) allPersonIds.add(pid);
    }

    // Query people table to find which ones are EXTERNAL (user_id IS NULL)
    let externalPersonIds = new Set<string>();
    if (allPersonIds.size > 0) {
      const { data: externalPeople } = await supabase
        .from("people")
        .select("id")
        .in("id", Array.from(allPersonIds))
        .is("user_id", null);

      externalPersonIds = new Set((externalPeople ?? []).map((p) => p.id));
    }

    // Calculate person counts per theme (only external people)
    for (const [themeId, evidenceIds] of themeEvidenceMap) {
      const personSet = new Set<string>();
      for (const evId of evidenceIds) {
        const persons = evidenceToPersons.get(evId);
        if (persons) {
          for (const p of persons) {
            if (externalPersonIds.has(p)) {
              personSet.add(p);
            }
          }
        }
      }
      themePersonCounts.set(themeId, personSet.size);
    }
  }

  const transformedData = data?.map((insight: any) => ({
    ...insight,
    // Use priority from themes table directly, fall back to view for backwards compat
    priority: insight.priority ?? priorityMap.get(insight.id) ?? 3,
    vote_count: voteCountMap.get(insight.id) ?? 0,
    evidence_count: Array.isArray(insight.theme_evidence)
      ? (insight.theme_evidence[0]?.count ?? 0)
      : 0,
    person_count: themePersonCounts.get(insight.id) ?? 0,
    persona_insights:
      personasMap.get(insight.id)?.map((person) => ({ personas: person })) ??
      [],
    interviews: (themeInterviewsMap.get(insight.id) || [])
      .map((id) => interviewsMap.get(id))
      .filter(Boolean),
    insight_tags:
      tagsMap.get(insight.id)?.map((tag) => ({
        tag: tag.tag,
        term: tag.term,
        definition: tag.definition,
      })) || [],
    linked_themes: [], // Themes are top-level now, not nested
    // Add backward compatibility field for interview_id
    interview_id: themeInterviewsMap.get(insight.id)?.[0] || null, // Use first interview for backwards compat
  }));
  return { data: transformedData, error };
};

export const getInsightById = async ({
  supabase,
  accountId,
  projectId,
  id,
}: {
  supabase: SupabaseClient<Database>;
  accountId: string;
  projectId: string;
  id: string;
}) => {
  const insightByIdQuery = supabase
    .from("themes")
    .select(
      `
			id,
			name,
			statement,
			inclusion_criteria,
			exclusion_criteria,
			synonyms,
			anti_examples,
			category,
			jtbd,
			pain,
			desired_outcome,
			journey_stage,
			emotional_response,
			motivation,
			priority,
			details,
			evidence,
			impact,
			contradictions,
			novelty,
			opportunity_ideas,
			related_tags,
			confidence,
			updated_at,
			project_id,
			created_at,
			theme_evidence(count)
		`,
    )
    // .eq("account_id", accountId)
    .eq("project_id", projectId)
    .eq("id", id)
    .single();

  type InsightById = QueryData<typeof insightByIdQuery>;

  const { data, error } = await insightByIdQuery;

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Response("Failed to load insight", { status: 500 });
  }

  if (!data) {
    return null;
  }

  const insightData: InsightById = data;

  const [tagsResult, personasResult, priorityResult] = await Promise.all([
    supabase
      .from("insight_tags")
      .select("insight_id, tags:tag_id(tag, term, definition)")
      .eq("insight_id", id),
    supabase
      .from("persona_insights")
      .select("insight_id, personas:persona_id(id, name)")
      .eq("insight_id", id),
    supabase
      .from("insights_with_priority")
      .select("priority")
      .eq("id", id)
      .maybeSingle(),
  ]);

  const priority =
    (insightData as any).priority ?? priorityResult?.data?.priority ?? 3;

  // Fetch people and orgs linked to this theme via evidence
  // 1. Get evidence IDs for this theme
  const { data: themeEvidence } = await supabase
    .from("theme_evidence")
    .select("evidence_id")
    .eq("theme_id", id)
    .eq("project_id", projectId);

  const evidenceIds =
    themeEvidence?.map((te) => te.evidence_id).filter(Boolean) ?? [];

  let peopleData: Array<{
    id: string;
    name: string | null;
    role: string | null;
    organization?: { id: string; name: string | null } | null;
  }> = [];
  const orgCounts: Map<string, { id: string; name: string; count: number }> =
    new Map();

  if (evidenceIds.length > 0) {
    // 2. Get people linked to this evidence
    const { data: evidencePeople } = await supabase
      .from("evidence_people")
      .select(
        "person_id, role, people:person_id!inner(id, name, organization_id, organizations:organization_id(id, name))",
      )
      .eq("project_id", projectId)
      .in("evidence_id", evidenceIds);

    if (evidencePeople) {
      // Deduplicate people (same person may appear in multiple evidence)
      const uniquePeople = new Map<string, any>();
      for (const ep of evidencePeople as any[]) {
        if (ep.people && !uniquePeople.has(ep.people.id)) {
          uniquePeople.set(ep.people.id, {
            id: ep.people.id,
            name: ep.people.name,
            role: ep.role,
            organization: ep.people.organizations
              ? {
                  id: ep.people.organizations.id,
                  name: ep.people.organizations.name,
                }
              : null,
          });

          // Count orgs
          if (ep.people.organizations) {
            const orgId = ep.people.organizations.id;
            const existing = orgCounts.get(orgId);
            if (existing) {
              existing.count++;
            } else {
              orgCounts.set(orgId, {
                id: orgId,
                name: ep.people.organizations.name,
                count: 1,
              });
            }
          }
        }
      }
      peopleData = Array.from(uniquePeople.values());
    }
  }

  return {
    ...insightData,
    priority,
    evidence_count: Array.isArray((insightData as any).theme_evidence)
      ? ((insightData as any).theme_evidence[0]?.count ?? 0)
      : 0,
    persona_insights:
      personasResult?.data?.map((row) => ({ personas: row.personas })) ?? [],
    insight_tags:
      tagsResult?.data?.map((row) => ({
        tag: row.tags?.tag,
        term: row.tags?.term,
        definition: row.tags?.definition,
      })) ?? [],
    people: peopleData,
    organizations: Array.from(orgCounts.values()).sort(
      (a, b) => b.count - a.count,
    ),
  };
};

export const createInsight = async ({
  supabase,
  data,
}: {
  supabase: SupabaseClient<Database>;
  data: InsightInsert & { project_id: string };
}) => {
  return await supabase.from("themes").insert(data).select().single();
};

export const updateInsight = async ({
  supabase,
  id,
  accountId,
  projectId,
  data,
}: {
  supabase: SupabaseClient<Database>;
  id: string;
  accountId: string;
  projectId: string;
  data: Database["public"]["Tables"]["themes"]["Update"];
}) => {
  return await supabase
    .from("themes")
    .update(data)
    .eq("id", id)
    // .eq("account_id", accountId)
    .eq("project_id", projectId)
    .select()
    .single();
};

export const deleteInsight = async ({
  supabase,
  id,
  accountId,
  projectId,
}: {
  supabase: SupabaseClient<Database>;
  id: string;
  accountId: string;
  projectId: string;
}) => {
  return await supabase
    .from("themes")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);
};

/**
 * Get trending data for all themes in a project.
 * Compares evidence added in the last 14 days vs the prior 14 days.
 * Returns a Map of themeId -> { recent14d, prior14d, trend }
 */
export const getTrendingData = async ({
  supabase,
  projectId,
}: {
  supabase: SupabaseClient<Database>;
  projectId: string;
}): Promise<
  Map<
    string,
    {
      recent14d: number;
      prior14d: number;
      trend: "growing" | "stable" | "fading";
    }
  >
> => {
  const now = new Date();
  const fourteenDaysAgo = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const twentyEightDaysAgo = new Date(
    now.getTime() - 28 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Get all theme_evidence links with their created_at dates
  const { data: links } = await supabase
    .from("theme_evidence")
    .select("theme_id, created_at")
    .eq("project_id", projectId)
    .gte("created_at", twentyEightDaysAgo);

  const result = new Map<
    string,
    {
      recent14d: number;
      prior14d: number;
      trend: "growing" | "stable" | "fading";
    }
  >();

  if (!links) return result;

  // Count per theme in each window
  const recentCounts = new Map<string, number>();
  const priorCounts = new Map<string, number>();

  for (const link of links) {
    if (!link.created_at) continue;
    if (link.created_at >= fourteenDaysAgo) {
      recentCounts.set(
        link.theme_id,
        (recentCounts.get(link.theme_id) ?? 0) + 1,
      );
    } else {
      priorCounts.set(link.theme_id, (priorCounts.get(link.theme_id) ?? 0) + 1);
    }
  }

  // Merge all theme IDs
  const allThemeIds = new Set([...recentCounts.keys(), ...priorCounts.keys()]);

  for (const themeId of allThemeIds) {
    const recent = recentCounts.get(themeId) ?? 0;
    const prior = priorCounts.get(themeId) ?? 0;

    let trend: "growing" | "stable" | "fading" = "stable";
    // Only mark as growing/fading when there's a prior window to compare against.
    // If prior === 0, all data landed in the recent window (e.g. bulk upload) — treat as stable.
    if (prior > 0) {
      if (recent > prior * 1.2) trend = "growing";
      else if (recent < prior * 0.8) trend = "fading";
    }

    result.set(themeId, { recent14d: recent, prior14d: prior, trend });
  }

  return result;
};

/**
 * Get top 2 most-cited people per theme.
 * Joins theme_evidence → evidence_people → people (+ organization for title).
 */
export const getTopVoicesForThemes = async ({
  supabase,
  projectId,
  themeIds,
}: {
  supabase: SupabaseClient<Database>;
  projectId: string;
  themeIds: string[];
}): Promise<
  Map<string, Array<{ id: string; name: string; title: string | null }>>
> => {
  const result = new Map<
    string,
    Array<{ id: string; name: string; title: string | null }>
  >();

  if (themeIds.length === 0) return result;

  // Get theme_evidence links
  const { data: themeEvLinks } = await supabase
    .from("theme_evidence")
    .select("theme_id, evidence_id")
    .eq("project_id", projectId)
    .in("theme_id", themeIds);

  if (!themeEvLinks || themeEvLinks.length === 0) return result;

  // Build theme -> evidence IDs
  const themeEvidenceMap = new Map<string, Set<string>>();
  const allEvidenceIds = new Set<string>();
  for (const link of themeEvLinks) {
    if (!themeEvidenceMap.has(link.theme_id)) {
      themeEvidenceMap.set(link.theme_id, new Set());
    }
    themeEvidenceMap.get(link.theme_id)!.add(link.evidence_id);
    allEvidenceIds.add(link.evidence_id);
  }

  // Get evidence -> people links
  const { data: evidencePeople } = await supabase
    .from("evidence_people")
    .select(
      "evidence_id, person_id, people:person_id!inner(id, name, organizations:organization_id(name))",
    )
    .eq("project_id", projectId)
    .in("evidence_id", Array.from(allEvidenceIds));

  if (!evidencePeople) return result;

  // Build evidence -> person info
  const evidenceToPersons = new Map<
    string,
    Map<string, { id: string; name: string; title: string | null }>
  >();
  for (const ep of evidencePeople as Array<{
    evidence_id: string;
    person_id: string;
    people: {
      id: string;
      name: string | null;
      organizations: { name: string | null } | null;
    };
  }>) {
    if (!ep.people) continue;
    if (!evidenceToPersons.has(ep.evidence_id)) {
      evidenceToPersons.set(ep.evidence_id, new Map());
    }
    evidenceToPersons.get(ep.evidence_id)!.set(ep.people.id, {
      id: ep.people.id,
      name: ep.people.name ?? "Unknown",
      title: ep.people.organizations?.name ?? null,
    });
  }

  // Count per theme per person, pick top 2
  for (const [themeId, evidenceIds] of themeEvidenceMap) {
    const personCounts = new Map<
      string,
      {
        info: { id: string; name: string; title: string | null };
        count: number;
      }
    >();

    for (const evId of evidenceIds) {
      const persons = evidenceToPersons.get(evId);
      if (!persons) continue;
      for (const [personId, info] of persons) {
        const existing = personCounts.get(personId);
        if (existing) {
          existing.count++;
        } else {
          personCounts.set(personId, { info, count: 1 });
        }
      }
    }

    // Sort by count desc, take top 2
    const sorted = Array.from(personCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map((p) => p.info);

    result.set(themeId, sorted);
  }

  return result;
};

/**
 * Get stakeholder summaries for the "By Stakeholder" lens.
 * Batch-loads people → themes → evidence counts to avoid N+1.
 * Returns per-person theme arrays + common ground analysis.
 */
export const getStakeholderSummaries = async ({
  supabase,
  projectId,
}: {
  supabase: SupabaseClient<Database>;
  projectId: string;
}): Promise<{
  stakeholders: StakeholderSummary[];
  commonGround: CommonGround[];
  sharedConcern: {
    themeId: string;
    themeName: string;
    roleCount: number;
  } | null;
}> => {
  // 1. Fetch all external people in the project
  const { data: people } = await supabase
    .from("people")
    .select("id, name, firstname, lastname, title, job_function, image_url")
    .eq("project_id", projectId)
    .is("user_id", null)
    .order("name");

  if (!people || people.length === 0) {
    return { stakeholders: [], commonGround: [], sharedConcern: null };
  }

  const personIds = people.map((p) => p.id);
  const personIdSet = new Set(personIds);

  // 2. Get person→evidence links from ALL three sources (matching getInsights pattern)
  // Source 1: evidence_facet (primary — BAML extraction)
  // Source 2: evidence_people (direct link)
  // Source 3: interview_people (via interview)
  const [facetResult, evidencePeopleResult, interviewPeopleResult] =
    await Promise.all([
      supabase
        .from("evidence_facet")
        .select("evidence_id, person_id")
        .eq("project_id", projectId)
        .not("person_id", "is", null),
      supabase
        .from("evidence_people")
        .select("evidence_id, person_id")
        .eq("project_id", projectId),
      supabase
        .from("interview_people")
        .select("interview_id, person_id")
        .in("person_id", personIds),
    ]);

  // Build person → evidence IDs map from all sources
  const personEvidenceMap = new Map<string, Set<string>>();
  const addLink = (personId: string | null, evidenceId: string) => {
    if (!personId || !personIdSet.has(personId)) return;
    if (!personEvidenceMap.has(personId)) {
      personEvidenceMap.set(personId, new Set());
    }
    personEvidenceMap.get(personId)!.add(evidenceId);
  };

  // Source 1: evidence_facet
  for (const row of facetResult.data ?? []) {
    addLink(row.person_id, row.evidence_id);
  }

  // Source 2: evidence_people
  for (const row of evidencePeopleResult.data ?? []) {
    addLink(row.person_id, row.evidence_id);
  }

  // Source 3: interview_people → need to map interview → evidence
  const interviewPersonMap = new Map<string, Set<string>>();
  for (const row of interviewPeopleResult.data ?? []) {
    if (!row.person_id || !personIdSet.has(row.person_id)) continue;
    if (!interviewPersonMap.has(row.interview_id)) {
      interviewPersonMap.set(row.interview_id, new Set());
    }
    interviewPersonMap.get(row.interview_id)!.add(row.person_id);
  }

  // If we have interview_people links, fetch evidence for those interviews
  if (interviewPersonMap.size > 0) {
    const { data: interviewEvidence } = await supabase
      .from("evidence")
      .select("id, interview_id")
      .eq("project_id", projectId)
      .in("interview_id", Array.from(interviewPersonMap.keys()));

    for (const ev of interviewEvidence ?? []) {
      if (!ev.interview_id) continue;
      const persons = interviewPersonMap.get(ev.interview_id);
      if (persons) {
        for (const pid of persons) {
          addLink(pid, ev.id);
        }
      }
    }
  }

  const allEvidenceIds = new Set<string>();
  for (const evSet of personEvidenceMap.values()) {
    for (const evId of evSet) allEvidenceIds.add(evId);
  }

  if (allEvidenceIds.size === 0) {
    // People exist but no evidence linked — return empty stakeholders with person info
    const emptyStakeholders: StakeholderSummary[] = people.map((p) => ({
      person: {
        id: p.id,
        name:
          p.name ||
          [p.firstname, p.lastname].filter(Boolean).join(" ") ||
          "Unknown",
        title: p.title,
        job_function: p.job_function,
        initials: getInitials(p.name, p.firstname, p.lastname),
        image_url: p.image_url,
      },
      themes: [],
      representative_quote: null,
    }));
    return {
      stakeholders: emptyStakeholders,
      commonGround: [],
      sharedConcern: null,
    };
  }

  // 3. Get theme_evidence links for all evidence IDs → theme mapping
  const { data: themeEvidenceLinks } = await supabase
    .from("theme_evidence")
    .select("theme_id, evidence_id")
    .eq("project_id", projectId)
    .in("evidence_id", Array.from(allEvidenceIds));

  // Build evidence → theme IDs map
  const evidenceThemeMap = new Map<string, Set<string>>();
  const allThemeIds = new Set<string>();
  for (const link of themeEvidenceLinks ?? []) {
    if (!evidenceThemeMap.has(link.evidence_id)) {
      evidenceThemeMap.set(link.evidence_id, new Set());
    }
    evidenceThemeMap.get(link.evidence_id)!.add(link.theme_id);
    allThemeIds.add(link.theme_id);
  }

  // 4. Fetch theme names
  const { data: themes } =
    allThemeIds.size > 0
      ? await supabase
          .from("themes")
          .select("id, name, statement")
          .eq("project_id", projectId)
          .in("id", Array.from(allThemeIds))
      : {
          data: [] as Array<{
            id: string;
            name: string | null;
            statement: string | null;
          }>,
        };

  const themeMap = new Map<
    string,
    { id: string; name: string; statement: string | null }
  >();
  for (const t of themes ?? []) {
    themeMap.set(t.id, {
      id: t.id,
      name: t.name || "Untitled",
      statement: t.statement,
    });
  }

  // 5. Compute per-person theme arrays with evidence counts
  // Also track theme → person set for shared detection and common ground
  const themePersonMap = new Map<string, Set<string>>();
  // Track theme → job_function roles for common ground
  const themeRoleMap = new Map<string, Set<string>>();

  const stakeholders: StakeholderSummary[] = [];

  for (const person of people) {
    const evidenceIds = personEvidenceMap.get(person.id);
    if (!evidenceIds || evidenceIds.size === 0) continue;

    // Count evidence per theme for this person
    const themeEvidenceCounts = new Map<string, number>();
    for (const evId of evidenceIds) {
      const themeIds = evidenceThemeMap.get(evId);
      if (!themeIds) continue;
      for (const tid of themeIds) {
        themeEvidenceCounts.set(tid, (themeEvidenceCounts.get(tid) ?? 0) + 1);
      }
    }

    // Track person in theme→person and theme→role maps
    const role = person.job_function || "Other";
    for (const tid of themeEvidenceCounts.keys()) {
      if (!themePersonMap.has(tid)) themePersonMap.set(tid, new Set());
      themePersonMap.get(tid)!.add(person.id);
      if (!themeRoleMap.has(tid)) themeRoleMap.set(tid, new Set());
      themeRoleMap.get(tid)!.add(role);
    }

    const personName =
      person.name ||
      [person.firstname, person.lastname].filter(Boolean).join(" ") ||
      "Unknown";

    // Build theme list sorted by evidence count desc
    const personThemes = Array.from(themeEvidenceCounts.entries())
      .map(([tid, count]) => ({
        id: tid,
        name: themeMap.get(tid)?.name ?? "Untitled",
        evidence_count: count,
        is_shared: false, // will be set after we know all person counts
      }))
      .sort((a, b) => b.evidence_count - a.evidence_count);

    // Pick representative quote from the top theme's statement
    const topThemeId = personThemes[0]?.id;
    const repQuote = topThemeId
      ? (themeMap.get(topThemeId)?.statement ?? null)
      : null;

    stakeholders.push({
      person: {
        id: person.id,
        name: personName,
        title: person.title,
        job_function: person.job_function,
        initials: getInitials(person.name, person.firstname, person.lastname),
        image_url: person.image_url,
      },
      themes: personThemes,
      representative_quote: repQuote,
    });
  }

  // 6. Mark is_shared on theme pills (theme appears for >1 person)
  for (const stakeholder of stakeholders) {
    for (const theme of stakeholder.themes) {
      const personCount = themePersonMap.get(theme.id)?.size ?? 0;
      theme.is_shared = personCount > 1;
    }
  }

  // 7. Compute common ground — themes that span multiple job_function roles
  const allRoles = new Set<string>();
  for (const person of people) {
    allRoles.add(person.job_function || "Other");
  }
  const totalRoles = allRoles.size;

  const commonGround: CommonGround[] = [];
  for (const [tid, roles] of themeRoleMap) {
    if (roles.size > 1) {
      const theme = themeMap.get(tid);
      if (!theme) continue;
      commonGround.push({
        theme: { id: theme.id, name: theme.name },
        role_count: roles.size,
        total_roles: totalRoles,
        roles: Array.from(roles),
      });
    }
  }
  commonGround.sort((a, b) => b.role_count - a.role_count);

  // 8. Shared concern = theme with most role breadth
  const sharedConcern =
    commonGround.length > 0
      ? {
          themeId: commonGround[0].theme.id,
          themeName: commonGround[0].theme.name,
          roleCount: commonGround[0].role_count,
        }
      : null;

  return { stakeholders, commonGround, sharedConcern };
};

/** Helper: compute initials from name parts */
function getInitials(
  name: string | null,
  firstname: string | null,
  lastname: string | null,
): string {
  if (firstname && lastname) {
    return `${firstname[0]}${lastname[0]}`.toUpperCase();
  }
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] ?? "?").toUpperCase();
  }
  return "?";
}
