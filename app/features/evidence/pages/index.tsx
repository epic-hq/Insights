import consola from "consola";
import { Grid3X3, List } from "lucide-react";
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "react-router-dom";
import { BackButton } from "~/components/ui/back-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { userContext } from "~/server/user-context";
import type { Evidence } from "~/types";
import { regenerateEvidenceForProject } from "~/utils/regenerateEvidence.server";
import EvidenceCard from "../components/EvidenceCard";

type EvidenceListPerson = {
  id: string;
  name: string | null;
  role: string | null;
  personas: Array<{ id: string; name: string }>;
};

type EvidenceFacetSummary = {
  kind_slug: string;
  label: string;
  facet_account_id: number;
  person: { id: string; name: string | null } | null;
};

type EvidenceListItem = (Pick<
  Evidence,
  | "id"
  | "verbatim"
  | "gist"
  | "chunk"
  | "topic"
  | "support"
  | "confidence"
  | "created_at"
  | "journey_stage"
  | "method"
  | "anchors"
  | "interview_id"
> & {
  context_summary?: string | null;
  interview?: {
    id: string;
    title: string | null;
    media_url: string | null;
    duration_sec: number | null;
  } | null;
}) & {
  people: EvidenceListPerson[];
  facets: EvidenceFacetSummary[];
};

type EvidenceRow = Omit<EvidenceListItem, "people" | "facets">;

export async function action({ context, params, request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") {
    return { ok: false, error: "Unsupported method" };
  }

  const formData = await request.formData();
  if (formData.get("intent") !== "regenerate") {
    return { ok: false };
  }

  const accountId = params.accountId;
  const projectId = params.projectId;
  if (!accountId || !projectId) {
    throw new Response("Missing account or project context", { status: 400 });
  }

  const { supabase } = context.get(userContext);
  if (!supabase)
    throw new Response("Supabase client not available", { status: 500 });

  const result = await regenerateEvidenceForProject({
    supabase,
    accountId,
    projectId,
    userId: undefined,
  });

  return { ok: true, ...result };
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
  const { supabase } = context.get(userContext);
  if (!supabase)
    throw new Response("Supabase client not available", { status: 500 });
  const projectId = params.projectId;
  if (!projectId) throw new Response("Missing projectId", { status: 400 });

  // Check for research question filter
  const url = new URL(request.url);
  const rqId = url.searchParams.get("rq_id");
  const themeId = url.searchParams.get("theme_id");
  const filterInterviewId = url.searchParams.get("interview_id") || undefined;

  // Sort and filter params
  const sortBy = url.searchParams.get("sort_by") || "created_at";
  const sortDir =
    (url.searchParams.get("sort_dir") || "desc").toLowerCase() === "asc"
      ? "asc"
      : "desc";
  const filterSupport = url.searchParams.get("support");
  const filterConfidence = url.searchParams.get("confidence");
  const filterMethod = url.searchParams.get("method");
  const filterPersonId = url.searchParams.get("person_id") || undefined;
  const filterPersonNameParam =
    url.searchParams.get("person_name") || undefined;

  // Starred and upvoted filters
  const filterStarred = url.searchParams.get("starred") === "true";
  const filterUpvoted = url.searchParams.get("upvoted") === "true";
  const minVotes = Number.parseInt(
    url.searchParams.get("min_votes") || "1",
    10,
  );

  // Check for explicit evidence ID filter (e.g., from pain matrix)
  // Support both comma-separated (?ids=a,b,c) and array format (?ids[]=a&ids[]=b)
  const idsParam = url.searchParams.get("ids");
  const idsArray = url.searchParams.getAll("ids[]");
  let evidenceIdFilter: string[] | undefined;

  if (idsParam) {
    // Split by comma and deduplicate
    evidenceIdFilter = [
      ...new Set(
        idsParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    consola.info(
      `[evidence/index] Filtering by ${evidenceIdFilter.length} unique IDs:`,
      evidenceIdFilter,
    );
  } else if (idsArray.length > 0) {
    evidenceIdFilter = [...new Set(idsArray.filter(Boolean))];
    consola.info(
      `[evidence/index] Filtering by ${evidenceIdFilter.length} unique IDs from array format:`,
      evidenceIdFilter,
    );
  }

  // If filtering by person, get evidence IDs from evidence_people first
  if (filterPersonId && !evidenceIdFilter) {
    const { data: personEvidence, error: peErr } = await supabase
      .from("evidence_people")
      .select("evidence_id")
      .eq("project_id", projectId)
      .eq("person_id", filterPersonId);

    if (peErr)
      throw new Error(`Failed to load evidence for person: ${peErr.message}`);
    evidenceIdFilter = personEvidence?.map((pe) => pe.evidence_id) || [];

    if (evidenceIdFilter.length === 0) {
      return {
        evidence: [],
        filteredByPerson: filterPersonId,
        filteredByInterview: filterInterviewId
          ? { id: filterInterviewId, title: null }
          : null,
      };
    }
  }

  // If filtering by research question, get evidence IDs from project_answer_evidence
  if (rqId) {
    const { data: evidenceIds, error: linkError } = await supabase
      .from("project_answer_evidence")
      .select("evidence_id, project_answers!inner(research_question_id)")
      .eq("project_answers.research_question_id", rqId)
      .eq("project_id", projectId);

    if (linkError)
      throw new Error(`Failed to load evidence links: ${linkError.message}`);

    const rqEvidenceIds =
      evidenceIds
        ?.map((link) => link.evidence_id)
        .filter((id): id is string => Boolean(id)) || [];

    // Intersect with person filter if both are present
    if (evidenceIdFilter) {
      evidenceIdFilter = evidenceIdFilter.filter((id) =>
        rqEvidenceIds.includes(id),
      );
    } else {
      evidenceIdFilter = rqEvidenceIds;
    }

    if (evidenceIdFilter.length === 0) {
      return {
        evidence: [],
        filteredByRQ: rqId,
        filteredByPerson: filterPersonId,
        filteredByInterview: filterInterviewId
          ? { id: filterInterviewId, title: null }
          : null,
      };
    }
  }

  // If filtering by theme, get evidence IDs from theme_evidence
  if (themeId) {
    const { data: themeEvidence, error: themeErr } = await supabase
      .from("theme_evidence")
      .select("evidence_id")
      .eq("project_id", projectId)
      .eq("theme_id", themeId);

    if (themeErr)
      throw new Error(`Failed to load evidence for theme: ${themeErr.message}`);

    const themeEvidenceIds =
      themeEvidence
        ?.map((te) => te.evidence_id)
        .filter((id): id is string => Boolean(id)) || [];

    // Intersect with existing filters if present
    if (evidenceIdFilter) {
      evidenceIdFilter = evidenceIdFilter.filter((id) =>
        themeEvidenceIds.includes(id),
      );
    } else {
      evidenceIdFilter = themeEvidenceIds;
    }

    if (evidenceIdFilter.length === 0) {
      return {
        evidence: [],
        filteredByTheme: themeId,
        filteredByRQ: rqId,
        filteredByPerson: filterPersonId,
        filteredByInterview: filterInterviewId
          ? { id: filterInterviewId, title: null }
          : null,
      };
    }
  }

  // If filtering by starred, get evidence IDs from entity_flags
  if (filterStarred) {
    const { data: starredFlags, error: starredErr } = await supabase
      .from("entity_flags")
      .select("entity_id")
      .eq("project_id", projectId)
      .eq("entity_type", "evidence")
      .eq("flag_type", "starred");

    if (starredErr)
      throw new Error(`Failed to load starred evidence: ${starredErr.message}`);

    const starredIds =
      starredFlags
        ?.map((f) => f.entity_id)
        .filter((id): id is string => Boolean(id)) || [];

    // Intersect with existing filters if present
    if (evidenceIdFilter) {
      evidenceIdFilter = evidenceIdFilter.filter((id) =>
        starredIds.includes(id),
      );
    } else {
      evidenceIdFilter = starredIds;
    }

    if (evidenceIdFilter.length === 0) {
      return {
        evidence: [],
        filteredByStarred: true,
        filteredByTheme: themeId,
        filteredByRQ: rqId,
        filteredByPerson: filterPersonId,
        filteredByInterview: filterInterviewId
          ? { id: filterInterviewId, title: null }
          : null,
      };
    }
  }

  // If filtering by upvoted, get evidence IDs with minimum votes
  if (filterUpvoted) {
    const { data: votedEvidence, error: votesErr } = await supabase
      .from("votes")
      .select("entity_id, vote_value")
      .eq("project_id", projectId)
      .eq("entity_type", "evidence")
      .gt("vote_value", 0);

    if (votesErr)
      throw new Error(`Failed to load upvoted evidence: ${votesErr.message}`);

    // Aggregate votes by evidence_id
    const voteCounts = new Map<string, number>();
    for (const vote of votedEvidence || []) {
      if (!vote.entity_id) continue;
      const current = voteCounts.get(vote.entity_id) || 0;
      voteCounts.set(vote.entity_id, current + vote.vote_value);
    }

    // Filter by minimum votes
    const upvotedIds = Array.from(voteCounts.entries())
      .filter(([_, count]) => count >= minVotes)
      .map(([id]) => id);

    // Intersect with existing filters if present
    if (evidenceIdFilter) {
      evidenceIdFilter = evidenceIdFilter.filter((id) =>
        upvotedIds.includes(id),
      );
    } else {
      evidenceIdFilter = upvotedIds;
    }

    if (evidenceIdFilter.length === 0) {
      return {
        evidence: [],
        filteredByUpvoted: true,
        filteredByStarred: filterStarred,
        filteredByTheme: themeId,
        filteredByRQ: rqId,
        filteredByPerson: filterPersonId,
        filteredByInterview: filterInterviewId
          ? { id: filterInterviewId, title: null }
          : null,
      };
    }
  }

  let query = supabase
    .from("evidence")
    .select(
      `
				id,
				verbatim,
				gist,
				chunk,
				topic,
				context_summary,
				support,
				confidence,
				created_at,
				journey_stage,
				method,
				anchors,
				interview_id,
				interview:interview_id (
					id,
					title,
					media_url,
					duration_sec
				)
			`,
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .eq("is_archived", false);

  // Apply evidence ID filter if we have one from person or RQ filtering
  if (evidenceIdFilter) {
    query = query.in("id", evidenceIdFilter);
  }

  // Apply simple filters
  if (filterSupport) query = query.eq("support", filterSupport);
  if (filterConfidence) query = query.eq("confidence", filterConfidence);
  if (filterMethod) query = query.eq("method", filterMethod);
  if (filterInterviewId) query = query.eq("interview_id", filterInterviewId);

  // Sorting
  const sortable = new Set(["created_at", "confidence"]); // extendable
  const sortField = sortable.has(sortBy) ? sortBy : "created_at";
  const { data, error } = await query.order(sortField, {
    ascending: sortDir === "asc",
  });
  if (error) throw new Error(`Failed to load evidence: ${error.message}`);
  const rows = (data ?? []) as EvidenceRow[];

  if (evidenceIdFilter) {
    consola.info(
      `[evidence/index] Query returned ${rows.length} evidence items (filtered from ${evidenceIdFilter.length} IDs)`,
    );
  }

  // Join evidence_people -> people to get person names and roles for each evidence
  const peopleByEvidence = new Map<string, EvidenceListPerson[]>();
  const facetsByEvidence = new Map<string, EvidenceFacetSummary[]>();
  if (rows.length) {
    const evidenceIds = rows.map((e) => e.id);
    const { data: facetRows, error: facetErr } = await supabase
      .from("evidence_facet")
      .select("evidence_id, kind_slug, label, facet_account_id, person_id")
      .eq("project_id", projectId)
      .in("evidence_id", evidenceIds);

    const { data: evp, error: epErr } = await supabase
      .from("evidence_people")
      .select("evidence_id, role, person_id")
      .eq("project_id", projectId)
      .in("evidence_id", evidenceIds);
    if (facetErr) {
      consola.warn(
        `[evidence/index] Failed to load evidence facets: ${facetErr.message}`,
      );
    }
    if (epErr) {
      consola.warn(
        `[evidence/index] Failed to load evidence_people: ${epErr.message}`,
      );
    }

    const facetRowsSafe = (facetRows ?? []) as Array<{
      evidence_id: string;
      kind_slug: string | null;
      label: string | null;
      facet_account_id: number | null;
      person_id: string | null;
    }>;
    const evpRowsSafe = (evp ?? []) as Array<{
      evidence_id: string;
      role: string | null;
      person_id: string | null;
    }>;

    // Get all person IDs to fetch their personas
    const linkedPersonIds = new Set<string>();
    for (const row of facetRowsSafe) {
      if (row.person_id) linkedPersonIds.add(row.person_id);
    }
    for (const row of evpRowsSafe) {
      if (row.person_id) linkedPersonIds.add(row.person_id);
    }

    const personNameById = new Map<string, string | null>();
    if (linkedPersonIds.size > 0) {
      const { data: personRows, error: personErr } = await supabase
        .from("people")
        .select("id, name")
        .eq("project_id", projectId)
        .in("id", Array.from(linkedPersonIds));
      if (personErr) {
        consola.warn(
          `[evidence/index] Failed to load facet/people names: ${personErr.message}`,
        );
      }
      for (const row of (personRows ?? []) as Array<{
        id: string;
        name: string | null;
      }>) {
        personNameById.set(row.id, row.name ?? null);
      }
    }

    for (const row of facetRowsSafe) {
      if (!row.evidence_id || !row.kind_slug || !row.label) continue;
      if (!row.facet_account_id) continue;
      const list = facetsByEvidence.get(row.evidence_id) ?? [];
      list.push({
        kind_slug: row.kind_slug,
        label: row.label,
        facet_account_id: row.facet_account_id,
        person: row.person_id
          ? {
              id: row.person_id,
              name: personNameById.get(row.person_id) ?? null,
            }
          : null,
      });
      facetsByEvidence.set(row.evidence_id, list);
    }

    // Get all person IDs to fetch their personas
    const personIds = new Set<string>();
    for (const row of evpRowsSafe) {
      if (row.person_id) personIds.add(row.person_id);
    }

    // Fetch personas for all people
    const personasByPerson = new Map<
      string,
      Array<{ id: string; name: string }>
    >();
    if (personIds.size > 0) {
      const { data: pp, error: ppErr } = await supabase
        .from("people_personas")
        .select("person_id, personas:persona_id!inner(id, name)")
        .eq("project_id", projectId)
        .in("person_id", Array.from(personIds));
      if (ppErr) {
        consola.warn(
          `[evidence/index] Failed to load people_personas: ${ppErr.message}`,
        );
      }

      for (const row of (pp ?? []) as Array<{
        person_id: string;
        personas: { id: string; name: string } | null;
      }>) {
        if (!row.personas) continue;
        const list = personasByPerson.get(row.person_id) ?? [];
        list.push(row.personas);
        personasByPerson.set(row.person_id, list);
      }
    }

    // Build the final people map with personas
    for (const row of evpRowsSafe) {
      if (!row.person_id) continue;
      const list = peopleByEvidence.get(row.evidence_id) ?? [];
      list.push({
        id: row.person_id,
        name: personNameById.get(row.person_id) ?? null,
        role: row.role ?? null,
        personas: personasByPerson.get(row.person_id) ?? [],
      });
      peopleByEvidence.set(row.evidence_id, list);
    }
  }

  let filteredPersonName = filterPersonNameParam ?? null;
  if (filterPersonId && !filteredPersonName) {
    for (const people of peopleByEvidence.values()) {
      const match = people.find((person) => person.id === filterPersonId);
      if (match) {
        filteredPersonName = match.name ?? null;
        break;
      }
    }
  }

  const filteredRows = filterPersonId
    ? rows.filter((row) => {
        const people = peopleByEvidence.get(row.id) ?? [];
        return people.some((person) => person.id === filterPersonId);
      })
    : rows;

  const enriched: EvidenceListItem[] = filteredRows.map((row) => ({
    ...row,
    people: peopleByEvidence.get(row.id) ?? [],
    facets: facetsByEvidence.get(row.id) ?? [],
  }));

  const filteredInterviewTitle = filterInterviewId
    ? (rows[0]?.interview?.title ?? null)
    : null;

  return {
    evidence: enriched,
    filteredByRQ: rqId,
    filteredByPerson: filterPersonId
      ? { id: filterPersonId, name: filteredPersonName }
      : null,
    filteredByIds: idsParam ? evidenceIdFilter?.length || 0 : null,
    filteredByInterview: filterInterviewId
      ? { id: filterInterviewId, title: filteredInterviewTitle }
      : null,
    filteredByStarred: filterStarred || undefined,
    filteredByUpvoted: filterUpvoted || undefined,
  };
}

export default function EvidenceIndex() {
  const {
    evidence,
    filteredByRQ,
    filteredByPerson,
    filteredByIds,
    filteredByInterview,
    filteredByStarred,
    filteredByUpvoted,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isRegenerating = fetcher.state !== "idle";
  const [viewMode, setViewMode] = useState<"mini" | "expanded">("mini");
  const [searchParams, setSearchParams] = useSearchParams();
  const currentProject = useCurrentProject();
  const _routes = useProjectRoutes(currentProject?.projectPath || "");
  const listClassName =
    viewMode === "expanded"
      ? "space-y-4"
      : "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3";

  // Log when loading with ID filter (client-side debugging)
  useEffect(() => {
    if (filteredByIds) {
      console.log(
        `[Evidence] Client: Showing ${filteredByIds} filtered items, total evidence loaded: ${evidence.length}`,
      );
    }
  }, [filteredByIds, evidence.length]);

  // Controlled select helpers
  const sortBy = searchParams.get("sort_by") || "created_at";
  const sortDir = searchParams.get("sort_dir") || "desc";
  const support = searchParams.get("support") || "";
  const confidence = searchParams.get("confidence") || "";
  const method = searchParams.get("method") || "";
  const [searchQuery, setSearchQuery] = useState("");

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  // Client-side search filtering
  const filteredEvidence = searchQuery
    ? evidence.filter((item) => {
        const query = searchQuery.toLowerCase();
        return (
          item.verbatim?.toLowerCase().includes(query) ||
          item.gist?.toLowerCase().includes(query) ||
          item.topic?.toLowerCase().includes(query) ||
          item.people.some((p) => p.name?.toLowerCase().includes(query))
        );
      })
    : evidence;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Mobile-friendly header */}
      <BackButton />
      <div className="flex items-center gap-3">
        <div className="flex-1 font-semibold text-xl">
          <span className="l">Evidence</span>
          {filteredByRQ && (
            <Badge variant="outline" className="mt-1 w-fit">
              Filtered by Research Question
            </Badge>
          )}
          {filteredByPerson && typeof filteredByPerson === "object" && (
            <span>
              {filteredByPerson.name
                ? ` for: ${filteredByPerson.name}`
                : "Filtered by participant"}
            </span>
          )}
          {filteredByIds && (
            <Badge variant="outline" className="mt-1 ml-2 w-fit">
              Showing {filteredByIds} selected{" "}
              {filteredByIds === 1 ? "item" : "items"}
            </Badge>
          )}
          {filteredByInterview && (
            <Badge variant="outline" className="mt-1 ml-2 w-fit">
              {filteredByInterview.title
                ? `Interview: ${filteredByInterview.title}`
                : "Filtered by interview"}
            </Badge>
          )}
          {filteredByStarred && (
            <Badge variant="outline" className="mt-1 ml-2 w-fit">
              ⭐ Starred
            </Badge>
          )}
          {filteredByUpvoted && (
            <Badge variant="outline" className="mt-1 ml-2 w-fit">
              👍 Upvoted
            </Badge>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search evidence by quote, topic, or person..."
          className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pl-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Modern controls */}
      <div className="space-y-3">
        {/* View mode and regenerate */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) =>
              value && setViewMode(value as "mini" | "expanded")
            }
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="mini" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">Mini</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="expanded"
              className="flex items-center gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Expanded</span>
            </ToggleGroupItem>
          </ToggleGroup>

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="regenerate" />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={isRegenerating}
            >
              {isRegenerating ? "Regenerating…" : "Regenerate Evidence"}
            </Button>
          </fetcher.Form>
        </div>

        {/* Modern filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="font-medium text-muted-foreground text-xs">
              Sort by
            </label>
            <div className="flex gap-1">
              <select
                value={sortBy}
                onChange={(e) => updateParam("sort_by", e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="created_at">Created</option>
                <option value="confidence">Confidence</option>
              </select>
              <select
                value={sortDir}
                onChange={(e) => updateParam("sort_dir", e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="desc">↓</option>
                <option value="asc">↑</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-muted-foreground text-xs">
              Support
            </label>
            <select
              value={support}
              onChange={(e) => updateParam("support", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All</option>
              <option value="supports">Supports</option>
              <option value="neutral">Neutral</option>
              <option value="refutes">Refutes</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-muted-foreground text-xs">
              Confidence
            </label>
            <select
              value={confidence}
              onChange={(e) => updateParam("confidence", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-muted-foreground text-xs">
              Method
            </label>
            <select
              value={method}
              onChange={(e) => updateParam("method", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All</option>
              <option value="interview">Interview</option>
              <option value="secondary">Secondary</option>
            </select>
          </div>

          {/* Toggle filters */}
          <div className="col-span-full flex flex-wrap gap-2">
            <Button
              type="button"
              variant={filteredByStarred ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (filteredByStarred) {
                  next.delete("starred");
                } else {
                  next.set("starred", "true");
                }
                setSearchParams(next);
              }}
              className="h-8"
            >
              ⭐ Starred
            </Button>
            <Button
              type="button"
              variant={filteredByUpvoted ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (filteredByUpvoted) {
                  next.delete("upvoted");
                } else {
                  next.set("upvoted", "true");
                }
                setSearchParams(next);
              }}
              className="h-8"
            >
              👍 Upvoted
            </Button>
          </div>
        </div>
      </div>
      {fetcher.data?.ok && (
        <p className="text-muted-foreground text-xs">
          Refreshed {fetcher.data.processed} interview
          {fetcher.data.processed === 1 ? "" : "s"}
          {fetcher.data.skipped ? `, skipped ${fetcher.data.skipped}` : ""}
          {fetcher.data.errors?.length
            ? ` (${fetcher.data.errors.length} failed)`
            : ""}
        </p>
      )}
      {evidence.length === 0 ? (
        <div className="rounded-lg border border-border border-dashed px-6 py-12 text-center text-muted-foreground text-sm">
          No evidence yet.
        </div>
      ) : filteredEvidence.length === 0 ? (
        <div className="rounded-lg border border-border border-dashed px-6 py-12 text-center text-muted-foreground text-sm">
          No evidence found matching "{searchQuery}". Try a different search
          term.
        </div>
      ) : (
        <div className={listClassName}>
          {filteredEvidence.map((item) => (
            <Link
              key={item.id}
              to={item.id}
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <EvidenceCard
                evidence={item}
                people={item.people}
                interview={item.interview ?? null}
                variant={viewMode}
                className="h-full"
                disableLinks
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
