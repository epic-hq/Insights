import consola from "consola";
import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { BackButton } from "~/components/ui/back-button";
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu";
import { userContext } from "~/server/user-context";
import EvidenceCard from "../components/EvidenceCard";

type EvidencePersonRow = {
  role: string | null;
  people: {
    id: string;
    name: string | null;
  };
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value,
  );
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
  const { supabase } = context.get(userContext);
  const { evidenceId, accountId, projectId } = params;

  consola.log("Evidence loader params:", { evidenceId, accountId, projectId });

  if (!evidenceId) throw new Response("Missing evidenceId", { status: 400 });
  if (!isValidUuid(evidenceId)) {
    throw new Response("Invalid evidence identifier", { status: 400 });
  }

  // Build projectPath for nested routes
  const projectPath =
    accountId && projectId ? `/a/${accountId}/${projectId}` : null;

  // Parse simple ?t=seconds parameter (like YouTube)
  const url = new URL(request.url);
  const timeParam = url.searchParams.get("t");

  let anchorOverride = null;
  if (timeParam) {
    const seconds = Number.parseFloat(timeParam);
    if (!Number.isNaN(seconds) && seconds > 0) {
      // Create a simple anchor with the time
      // Use "media" type so EvidenceCard recognizes it as a playable timestamp
      anchorOverride = {
        type: "media",
        start_ms: seconds * 1000, // Store as milliseconds (standard format)
        start_seconds: seconds, // Also provide seconds for compatibility
      };
    }
  }

  // Fetch evidence with interview data (excluding evidence_tag to avoid multiple rows issue)
  // Note: RLS policies handle access control, so we only filter by ID
  const query = supabase
    .from("evidence")
    .select(
      `
			*,
			interview:interview_id(
				id,
				title,
				media_url,
				thumbnail_url,
				transcript,
				transcript_formatted,
				duration_sec
			)
		`,
      { count: "exact" },
    )
    .eq("id", evidenceId);

  const { data: evidenceData, error: evidenceError, count } = await query;

  consola.log("Evidence query result:", {
    evidenceId,
    accountId,
    projectId,
    count,
    isArray: Array.isArray(evidenceData),
    length: Array.isArray(evidenceData) ? evidenceData.length : "not array",
    hasData: !!evidenceData,
    dataType: typeof evidenceData,
    error: evidenceError,
  });

  if (evidenceError) {
    consola.error("Evidence query error:", evidenceError);
    throw new Error(`Failed to load evidence: ${evidenceError.message}`);
  }

  // Supabase .select() without .single() returns an array
  if (
    !evidenceData ||
    !Array.isArray(evidenceData) ||
    evidenceData.length === 0
  ) {
    consola.error("Evidence not found - filters may be too restrictive", {
      evidenceId,
      accountId,
      projectId,
      count,
    });
    throw new Error(`Evidence not found (ID: ${evidenceId})`);
  }

  // Get first row
  const evidence = evidenceData[0];

  // Fetch people separately to avoid duplicate rows
  const { data: peopleData } = await supabase
    .from("evidence_people")
    .select(
      `
			role,
			people:person_id!inner(
				id,
				name
			)
		`,
    )
    .eq("evidence_id", evidenceId);

  const { data: facetData, error: facetError } = await supabase
    .from("evidence_facet")
    .select("kind_slug, label, facet_account_id")
    .eq("evidence_id", evidenceId);

  if (facetError)
    throw new Error(`Failed to load evidence facets: ${facetError.message}`);

  const primaryFacets = (facetData ?? []).map((row) => ({
    kind_slug: row.kind_slug,
    label: row.label,
    facet_account_id: row.facet_account_id ?? 0,
  }));

  const data = {
    ...evidence,
    people: peopleData || [],
  };

  // Transform the data to match EvidenceCard expectations
  const peopleRows = (data.people ?? []) as EvidencePersonRow[];
  const transformedEvidence = {
    ...data,
    // If anchor override is provided, use it instead of stored anchors
    anchors: anchorOverride
      ? [
          anchorOverride,
          ...(Array.isArray(data.anchors) ? (data.anchors as any[]) : []),
        ]
      : data.anchors,
    people: peopleRows.map((row) => ({
      id: row.people.id,
      name: row.people.name,
      role: row.role,
      personas: [], // No personas data needed for now
    })),
    facets: primaryFacets,
  };

  // Related evidence in the same scene/topic
  let relatedEvidence: Array<any> = [];
  const topic = transformedEvidence.topic as string | null;
  const interviewId = transformedEvidence.interview_id as string | null;
  if (topic && interviewId) {
    const { data: related, error: relatedError } = await supabase
      .from("evidence")
      .select(
        "id, verbatim, gist, chunk, topic, support, confidence, created_at, journey_stage, method, anchors, interview_id",
      )
      .eq("interview_id", interviewId)
      .eq("topic", topic)
      .neq("id", evidenceId)
      .order("created_at", { ascending: true })
      .limit(20);
    if (!relatedError && Array.isArray(related)) relatedEvidence = related;

    if (Array.isArray(relatedEvidence) && relatedEvidence.length > 0) {
      const relatedIds = relatedEvidence
        .map((ev: any) => ev.id)
        .filter(Boolean);
      if (relatedIds.length > 0) {
        // Load facets for related evidence
        const { data: relatedFacets, error: relatedFacetError } = await supabase
          .from("evidence_facet")
          .select("evidence_id, kind_slug, label, facet_account_id")
          .in("evidence_id", relatedIds);
        if (relatedFacetError)
          throw new Error(
            `Failed to load related evidence facets: ${relatedFacetError.message}`,
          );

        const facetMap = new Map<
          string,
          Array<{ kind_slug: string; label: string; facet_account_id: number }>
        >();
        for (const row of relatedFacets ?? []) {
          if (!row || typeof row !== "object") continue;
          const evidence_id = (row as any).evidence_id as string | undefined;
          const kind_slug = (row as any).kind_slug as string | undefined;
          const label = (row as any).label as string | undefined;
          const facetAccountId = (row as any).facet_account_id as
            | number
            | null
            | undefined;
          if (!evidence_id || !kind_slug || !label || !facetAccountId) continue;
          const list = facetMap.get(evidence_id) ?? [];
          list.push({ kind_slug, label, facet_account_id: facetAccountId });
          facetMap.set(evidence_id, list);
        }

        // Load people for related evidence
        const { data: relatedPeople, error: relatedPeopleError } =
          await supabase
            .from("evidence_people")
            .select(
              `
						evidence_id,
						role,
						people:person_id!inner(
							id,
							name
						)
					`,
            )
            .in("evidence_id", relatedIds);
        if (relatedPeopleError)
          throw new Error(
            `Failed to load related evidence people: ${relatedPeopleError.message}`,
          );

        const peopleMap = new Map<
          string,
          Array<{
            id: string;
            name: string | null;
            role: string | null;
            personas: any[];
          }>
        >();
        for (const row of relatedPeople ?? []) {
          if (!row || typeof row !== "object") continue;
          const evidence_id = (row as any).evidence_id as string | undefined;
          const role = (row as any).role as string | null;
          const people = (row as any).people as
            | { id: string; name: string | null }
            | undefined;
          if (!evidence_id || !people) continue;
          const list = peopleMap.get(evidence_id) ?? [];
          list.push({ id: people.id, name: people.name, role, personas: [] });
          peopleMap.set(evidence_id, list);
        }

        relatedEvidence = relatedEvidence.map((ev: any) => ({
          ...ev,
          facets: facetMap.get(ev.id) ?? [],
          people: peopleMap.get(ev.id) ?? [],
        }));
      }
    }
  }

  return {
    evidence: transformedEvidence,
    relatedEvidence,
    anchorFromUrl: anchorOverride,
    projectPath,
    accountId: accountId || null,
  };
}

export default function EvidenceDetail() {
  const { evidence, relatedEvidence, projectPath, anchorFromUrl, accountId } =
    useLoaderData<typeof loader>();
  const interview = evidence.interview;
  const evidenceName =
    (evidence as any)?.title ||
    evidence.gist ||
    evidence.chunk ||
    evidence.verbatim ||
    "Evidence";

  // If there's a timestamp anchor from URL, inject it into evidence.anchors
  const evidenceWithAnchor = anchorFromUrl
    ? {
        ...evidence,
        anchors: [
          anchorFromUrl,
          ...(Array.isArray(evidence.anchors) ? evidence.anchors : []),
        ],
      }
    : evidence;

  // Scroll to top when navigating to this page, UNLESS there's a timestamp anchor
  useEffect(() => {
    if (!anchorFromUrl) {
      window.scrollTo(0, 0);
    }
    // If anchorFromUrl exists, let the EvidenceCard handle scrolling to the timestamp
  }, [anchorFromUrl]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Mobile-friendly header */}
      <div className="flex items-center gap-3" />

      {/* Full Evidence Card - Centered with max width */}
      <PageContainer size="sm" padded={false} className="max-w-2xl">
        <div className="mt-4 mb-4 flex items-center justify-between gap-3">
          <BackButton />
          {projectPath && accountId ? (
            <ResourceShareMenu
              projectPath={projectPath}
              accountId={accountId}
              resourceId={evidence.id}
              resourceName={evidenceName}
              resourceType="evidence"
            />
          ) : null}
        </div>
        <div className="flex-1">
          {interview && (
            <p className="py-4 text-foreground text-xl">
              Evidence from interview: {interview.title}
            </p>
          )}
        </div>
        <EvidenceCard
          evidence={evidenceWithAnchor}
          people={evidence.people || []}
          interview={interview}
          variant="expanded"
          showInterviewLink={true}
          projectPath={projectPath || undefined}
        />
      </PageContainer>

      {/* Related evidence in this topic */}
      {Array.isArray(relatedEvidence) && relatedEvidence.length > 0 && (
        <PageContainer size="sm" padded={false} className="max-w-2xl">
          <div className="mt-2 space-y-3">
            <p className="text-foreground text-lg">Related</p>
            <div className="space-y-2">
              {relatedEvidence.map((ev: any) => (
                <EvidenceCard
                  key={ev.id}
                  evidence={ev}
                  people={ev.people || []}
                  interview={interview}
                  variant="mini"
                  projectPath={projectPath || undefined}
                />
              ))}
            </div>
          </div>
        </PageContainer>
      )}
    </div>
  );
}
