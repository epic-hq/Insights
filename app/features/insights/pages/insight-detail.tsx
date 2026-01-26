import consola from "consola";
import React from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { BackButton } from "~/components/ui/back-button";
import { getInsightById } from "~/features/insights/db";
import { getUsersWithThemes } from "~/features/themes/services/segmentThemeQueries.server";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { userContext } from "~/server/user-context";
import { InsightCardV3Page } from "../components/InsightCardV3Page";
import type { Route } from "./+types/insight-detail";

/** Evidence shape for insight detail page with theme link metadata */
export type InsightEvidence = {
  id: string;
  gist: string | null;
  verbatim: string | null;
  chunk: string | null;
  context_summary: string | null;
  anchors: Array<{
    type: string;
    target: string;
    start?: number;
    end?: number;
    start_ms?: number;
    start_seconds?: number;
    media_key?: string;
  }> | null;
  pains: string[] | null;
  gains: string[] | null;
  thinks: string[] | null;
  feels: string[] | null;
  interview_id: string | null;
  interview: {
    id: string;
    title: string | null;
    thumbnail_url: string | null;
    media_url: string | null;
  } | null;
  /** Attribution line - person name, org, or interview title */
  attribution: string;
  /** Organization name if available */
  organization: string | null;
  /** Why this evidence supports the theme (from theme_evidence) */
  rationale: string | null;
  /** Confidence score 0-1 (from theme_evidence) */
  confidence: number | null;
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: `${data?.insight?.name || "Insight"} | Insights` },
    { name: "description", content: "Insight details" },
  ];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  if (!supabase) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Both from URL params - consistent, explicit, RESTful
  const accountId = params.accountId;
  const projectId = params.projectId;
  const projectPath = `/a/${accountId}/${projectId}`;
  const { insightId } = params;

  if (!accountId || !projectId || !insightId) {
    throw new Response("Account ID, Project ID, and Insight ID are required", {
      status: 400,
    });
  }

  try {
    const insight = await getInsightById({
      supabase,
      accountId,
      projectId,
      id: insightId,
    });

    if (!insight) {
      throw new Response("Insight not found", { status: 404 });
    }

    // Fetch evidence linked to this insight (theme) with theme_evidence metadata
    const { data: themeEvidence, error: themeEvidenceError } = await supabase
      .from("theme_evidence")
      .select("evidence_id, rationale, confidence")
      .eq("theme_id", insightId)
      .eq("project_id", projectId)
      .order("confidence", { ascending: false, nullsFirst: false });

    consola.log(
      `[insight-detail] theme_evidence query for theme ${insightId}:`,
      {
        count: themeEvidence?.length ?? 0,
        error: themeEvidenceError,
        evidenceCount: (insight as any).evidence_count,
      },
    );

    // Build a map of evidence_id -> theme_evidence metadata
    const themeEvidenceMap = new Map<
      string,
      { rationale: string | null; confidence: number | null }
    >();
    for (const te of themeEvidence ?? []) {
      if (te.evidence_id) {
        themeEvidenceMap.set(te.evidence_id, {
          rationale: te.rationale,
          confidence: te.confidence,
        });
      }
    }

    const evidenceIds =
      themeEvidence?.map((te) => te.evidence_id).filter(Boolean) ?? [];
    consola.log("[insight-detail] evidenceIds to fetch:", evidenceIds.length);

    let evidence: InsightEvidence[] = [];
    if (evidenceIds.length > 0) {
      // Fetch evidence with full details including interview media for playback
      const { data: evidenceData, error: evidenceError } = await supabase
        .from("evidence")
        .select(
          `
					id,
					gist,
					verbatim,
					chunk,
					context_summary,
					anchors,
					pains,
					gains,
					thinks,
					feels,
					interview_id,
					interview:interview_id (
						id,
						title,
						thumbnail_url,
						media_url
					)
				`,
        )
        .in("id", evidenceIds);

      consola.log("[insight-detail] evidence query result:", {
        fetched: evidenceData?.length ?? 0,
        error: evidenceError?.message,
        sampleId: evidenceIds[0],
      });

      // Fetch people linked directly to evidence (evidence_people table)
      const { data: evidencePeople } = await supabase
        .from("evidence_people")
        .select(
          `
					evidence_id,
					people:person_id (
						id,
						name
					)
				`,
        )
        .eq("project_id", projectId)
        .in("evidence_id", evidenceIds);

      // Build a map of evidence_id -> first person from evidence_people
      const personByEvidence = new Map<
        string,
        { name: string | null; org_name: string | null }
      >();
      for (const ep of (evidencePeople ?? []) as any[]) {
        if (
          ep.evidence_id &&
          ep.people &&
          !personByEvidence.has(ep.evidence_id)
        ) {
          personByEvidence.set(ep.evidence_id, {
            name: ep.people.name,
            org_name: null, // Skip org for now - fix schema later
          });
        }
      }

      // Also get interview_people for interviews as another fallback
      const interviewIds = [
        ...new Set(
          (evidenceData ?? []).map((e: any) => e.interview_id).filter(Boolean),
        ),
      ];
      const personByInterview = new Map<
        string,
        { name: string | null; org_name: string | null }
      >();

      if (interviewIds.length > 0) {
        const { data: interviewPeople } = await supabase
          .from("interview_people")
          .select(
            `
						interview_id,
						people:person_id (
							name
						)
					`,
          )
          .in("interview_id", interviewIds);

        for (const ip of (interviewPeople ?? []) as any[]) {
          if (
            ip.interview_id &&
            ip.people &&
            !personByInterview.has(ip.interview_id)
          ) {
            personByInterview.set(ip.interview_id, {
              name: ip.people.name,
              org_name: null, // Skip org for now
            });
          }
        }
      }

      // Build attribution and organization with fallbacks
      evidence = (evidenceData ?? []).map((ev: any) => {
        let attribution = "";
        let organization: string | null = null;

        // Try 1: Person linked directly to evidence
        const evPerson = personByEvidence.get(ev.id);
        if (evPerson?.name) {
          attribution = evPerson.org_name
            ? `${evPerson.name}, ${evPerson.org_name}`
            : evPerson.name;
          organization = evPerson.org_name;
        }
        // Try 2: interview_people
        else if (ev.interview_id) {
          const intPersonFromJoin = personByInterview.get(ev.interview_id);
          if (intPersonFromJoin?.name) {
            attribution = intPersonFromJoin.org_name
              ? `${intPersonFromJoin.name}, ${intPersonFromJoin.org_name}`
              : intPersonFromJoin.name;
            organization = intPersonFromJoin.org_name;
          }
        }
        // Fallback: interview title
        if (!attribution && ev.interview?.title) {
          attribution = ev.interview.title;
        }

        // Get theme_evidence metadata for this evidence
        const themeLink = themeEvidenceMap.get(ev.id);

        return {
          id: ev.id,
          gist: ev.gist,
          verbatim: ev.verbatim,
          chunk: ev.chunk,
          context_summary: ev.context_summary,
          anchors: ev.anchors,
          pains: ev.pains,
          gains: ev.gains,
          thinks: ev.thinks,
          feels: ev.feels,
          interview_id: ev.interview_id,
          interview: ev.interview
            ? {
                id: ev.interview.id,
                title: ev.interview.title,
                thumbnail_url: ev.interview.thumbnail_url,
                media_url: ev.interview.media_url,
              }
            : null,
          attribution: attribution || "Interview",
          organization,
          rationale: themeLink?.rationale ?? null,
          confidence: themeLink?.confidence ?? null,
        };
      }) as InsightEvidence[];
    }

    consola.log("[insight-detail] returning evidence:", evidence.length);

    // Get people affected by this insight (theme) from evidence_facet
    const peopleFromFacets = await getUsersWithThemes({
      supabase,
      projectId,
      themeIds: [insightId],
      limit: 50,
    });

    // Also collect people from evidence_people and interview_people
    // These may not be in evidence_facet but are still associated with the evidence
    const allPersonIds = new Set<string>();
    const personDataMap = new Map<
      string,
      {
        name: string | null;
        email: string | null;
        facet_count: number;
        is_team_member: boolean;
      }
    >();

    // Add people from facets query (is_team_member will be set later)
    for (const p of peopleFromFacets) {
      allPersonIds.add(p.person_id);
      personDataMap.set(p.person_id, {
        name: p.person_name,
        email: p.email,
        facet_count: p.facet_count,
        is_team_member: false, // Will be updated below
      });
    }

    // Add people from evidence_people (already queried above)
    if (evidenceIds.length > 0) {
      const { data: epWithIds } = await supabase
        .from("evidence_people")
        .select("person_id, people:person_id(id, name, primary_email)")
        .eq("project_id", projectId)
        .in("evidence_id", evidenceIds);

      for (const ep of (epWithIds ?? []) as any[]) {
        if (ep.person_id && ep.people && !allPersonIds.has(ep.person_id)) {
          allPersonIds.add(ep.person_id);
          personDataMap.set(ep.person_id, {
            name: ep.people.name,
            email: ep.people.primary_email,
            facet_count: 1,
            is_team_member: false, // Will be updated below
          });
        }
      }

      // Add people from interview_people
      const interviewIdsForPeople = [
        ...new Set(
          evidence
            .map((e) => e.interview_id)
            .filter((id): id is string => id !== null),
        ),
      ];
      if (interviewIdsForPeople.length > 0) {
        const { data: ipWithIds } = await supabase
          .from("interview_people")
          .select("person_id, people:person_id(id, name, primary_email)")
          .in("interview_id", interviewIdsForPeople);

        for (const ip of (ipWithIds ?? []) as any[]) {
          if (ip.person_id && ip.people && !allPersonIds.has(ip.person_id)) {
            allPersonIds.add(ip.person_id);
            personDataMap.set(ip.person_id, {
              name: ip.people.name,
              email: ip.people.primary_email,
              facet_count: 1,
              is_team_member: false, // Will be updated below
            });
          }
        }
      }
    }

    // Query people table to check which are team members (have user_id)
    if (allPersonIds.size > 0) {
      const { data: peopleWithUserId } = await supabase
        .from("people")
        .select("id, user_id")
        .in("id", Array.from(allPersonIds))
        .not("user_id", "is", null);

      for (const p of peopleWithUserId ?? []) {
        const existing = personDataMap.get(p.id);
        if (existing) {
          existing.is_team_member = true;
        }
      }
    }

    // Build unified peopleAffected list
    const peopleAffected = Array.from(personDataMap.entries())
      .map(([personId, data]) => ({
        person_id: personId,
        person_name: data.name,
        email: data.email,
        facet_count: data.facet_count,
        is_team_member: data.is_team_member,
      }))
      .sort((a, b) => b.facet_count - a.facet_count)
      .slice(0, 20);

    // Track insight_viewed event for PLG instrumentation
    try {
      const posthogServer = getPostHogServerClient();
      if (posthogServer) {
        const userId = ctx.claims.sub;
        posthogServer.capture({
          distinctId: userId,
          event: "insight_viewed",
          properties: {
            insight_id: insightId,
            project_id: projectId,
            account_id: accountId,
            evidence_count: evidence.length,
            people_affected_count: peopleAffected.length,
            $groups: { account: accountId },
          },
        });
      }
    } catch (trackingError) {
      consola.warn("[INSIGHT_VIEWED] PostHog tracking failed:", trackingError);
    }

    return {
      insight,
      evidence,
      projectPath,
      accountId,
      projectId,
      peopleAffected,
    };
  } catch (error) {
    consola.error("Error loading insight:", error);
    if (error instanceof Response) {
      throw error;
    }
    throw new Response("Failed to load insight", { status: 500 });
  }
}

type ErrorBoundaryState = {
  error: unknown | null;
};

class InsightContentBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(_error: unknown) {
    // Optionally send to server or analytics here
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: "red" }}>
          An error occurred: {String(this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <div style={{ color: "red" }}>An error occurred: {String(error)}</div>;
}

export default function InsightDetail() {
  const { insight, evidence, projectPath, accountId, peopleAffected } =
    useLoaderData<typeof loader>();

  if (!insight) {
    return <div>Insight not found</div>;
  }
  return (
    <PageContainer size="lg" padded={false} className="max-w-4xl space-y-6">
      <BackButton />
      <InsightContentBoundary>
        <InsightCardV3Page
          insight={insight}
          evidence={evidence}
          projectPath={projectPath}
          accountId={accountId}
          peopleAffected={peopleAffected}
        />
      </InsightContentBoundary>
    </PageContainer>
  );
}
