import type { QueryData, SupabaseClient } from "@supabase/supabase-js";
import type { Database, InsightInsert } from "~/types";

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
