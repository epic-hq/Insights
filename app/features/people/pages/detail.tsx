import consola from "consola";
import { useCallback, useMemo, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
} from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { QuickNoteDialog } from "~/components/notes/QuickNoteDialog";
import { useCurrentProject } from "~/contexts/current-project-context";
import {
  getOrganizations,
  linkPersonToOrganization,
  unlinkPersonFromOrganization,
  updateOrganization,
} from "~/features/organizations/db";
import {
  deletePerson,
  getPersonById,
  updatePerson,
} from "~/features/people/db";
import { generatePersonDescription } from "~/features/people/services/generatePersonDescription.server";
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav";
import {
  useProjectRoutes,
  useProjectRoutesFromIds,
} from "~/hooks/useProjectRoutes";
import { getFacetCatalog } from "~/lib/database/facets.server";
import { userContext } from "~/server/user-context";
import { createProjectRoutes } from "~/utils/routes.server";
import { getImageUrl } from "~/utils/storeImage.server";
import { generatePersonFacetSummaries } from "../services/generatePersonFacetSummaries.server";

// New single-scroll section components
import { PersonActivityTimeline } from "../components/PersonActivityTimeline";
import { PersonDetailNav } from "../components/PersonDetailNav";
import { PersonInsights } from "../components/PersonInsights";
import { PersonProfileSection } from "../components/PersonProfileSection";
import { PersonScorecard } from "../components/PersonScorecard";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: `${data?.person?.name || "Person"} | Insights` },
    { name: "description", content: "Person details and interview history" },
  ];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  // Both from URL params - consistent, explicit, RESTful
  const accountId = params.accountId;
  const projectId = params.projectId;
  const personId = params.personId;

  // consola.info("PersonDetail loader start", { accountId, projectId, personId, params })

  if (!accountId || !projectId || !personId) {
    consola.error("PersonDetail loader missing params", {
      accountId,
      projectId,
      personId,
    });
    throw new Response("Account ID, Project ID, and Person ID are required", {
      status: 400,
    });
  }

  try {
    const [person, catalog, organizations] = await Promise.all([
      getPersonById({
        supabase,
        accountId,
        projectId,
        id: personId,
      }),
      getFacetCatalog({ db: supabase, accountId, projectId }),
      getOrganizations({ supabase, accountId, projectId }),
    ]);

    // Fetch assets linked to this person via junction table
    const { data: linkedAssets } = await supabase
      .from("asset_people")
      .select(
        `
				relationship_type,
				project_assets (
					id, title, asset_type, created_at, description
				)
			`,
      )
      .eq("person_id", personId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch research link responses for this person
    const { data: researchLinkResponses } = await supabase
      .from("research_link_responses")
      .select(
        `
				id,
				email,
				responses,
				completed,
				created_at,
				updated_at,
				research_links (
					id,
					name,
					slug,
					questions
				)
			`,
      )
      .eq("person_id", personId)
      .order("created_at", { ascending: false })
      .limit(50);

    const relatedAssets = (linkedAssets || [])
      .filter((link) => link.project_assets)
      .map((link) => ({
        ...(link.project_assets as {
          id: string;
          title: string;
          asset_type: string;
          created_at: string;
          description: string | null;
        }),
        relationship_type: link.relationship_type,
      }));

    // Fetch survey responses for this person via direct person_id on evidence_facet
    const { data: surveyResponses } = await supabase
      .from("evidence_facet")
      .select(
        `
				id,
				label,
				quote,
				created_at,
				evidence!inner (
					id,
					interview_id,
					interviews!inner (
						id,
						title,
						source_type
					)
				)
			`,
      )
      .eq("kind_slug", "survey_response")
      .eq("project_id", projectId)
      .eq("person_id", personId) // Direct filter - cleaner than going through evidence_people
      .order("created_at", { ascending: false })
      .limit(50);

    // Transform and group survey responses by interview
    const surveyResponsesGrouped = new Map<
      string,
      {
        interviewId: string;
        interviewTitle: string;
        responses: Array<{
          id: string;
          question: string;
          answer: string;
          createdAt: string;
        }>;
      }
    >();
    for (const facet of surveyResponses || []) {
      const evidence = facet.evidence as {
        id: string;
        interview_id: string;
        interviews: { id: string; title: string | null };
      } | null;
      if (!evidence?.interviews) continue;
      const interviewId = evidence.interviews.id;
      const interviewTitle = evidence.interviews.title || "Survey";
      if (!surveyResponsesGrouped.has(interviewId)) {
        surveyResponsesGrouped.set(interviewId, {
          interviewId,
          interviewTitle,
          responses: [],
        });
      }
      surveyResponsesGrouped.get(interviewId)?.responses.push({
        id: facet.id,
        question: facet.label || "",
        answer: facet.quote || "",
        createdAt: facet.created_at || "",
      });
    }
    const surveyResponsesList = Array.from(surveyResponsesGrouped.values());

    // Fetch themes linked to this person via evidence_facet → theme_evidence → themes
    const { data: personFacets } = await supabase
      .from("evidence_facet")
      .select("evidence_id")
      .eq("project_id", projectId)
      .eq("person_id", personId);

    const evidenceIdsForThemes = [
      ...new Set((personFacets || []).map((f) => f.evidence_id)),
    ];

    let personThemes: Array<{
      id: string;
      name: string;
      statement: string | null;
      evidence_count: number;
    }> = [];

    if (evidenceIdsForThemes.length > 0) {
      const { data: themeLinks } = await supabase
        .from("theme_evidence")
        .select(
          `
          theme_id,
          themes!inner (
            id,
            name,
            statement
          )
        `,
        )
        .eq("project_id", projectId)
        .in("evidence_id", evidenceIdsForThemes);

      // Aggregate theme counts
      const themeMap = new Map<
        string,
        { id: string; name: string; statement: string | null; count: number }
      >();
      for (const link of themeLinks || []) {
        const theme = link.themes as {
          id: string;
          name: string;
          statement: string | null;
        };
        if (!theme) continue;
        const existing = themeMap.get(theme.id);
        if (existing) {
          existing.count++;
        } else {
          themeMap.set(theme.id, {
            id: theme.id,
            name: theme.name,
            statement: theme.statement,
            count: 1,
          });
        }
      }
      personThemes = Array.from(themeMap.values())
        .map((t) => ({
          id: t.id,
          name: t.name,
          statement: t.statement,
          evidence_count: t.count,
        }))
        .sort((a, b) => b.evidence_count - a.evidence_count);
    }

    if (!person) {
      consola.warn("PersonDetail loader: person not found", {
        accountId,
        projectId,
        personId,
      });
      throw new Response("Person not found", { status: 404 });
    }
    if (organizations.error) {
      consola.error("PersonDetail loader: organizations fetch error", {
        error: organizations.error,
      });
      throw new Response("Failed to load organizations", { status: 500 });
    }

    // Refresh or reuse facet lens summaries in-line so the accordion always has a headline
    const facetSummaries = await generatePersonFacetSummaries({
      supabase,
      person,
      projectId,
      accountId,
    });

    // Convert R2 key to presigned URL if needed
    let imageUrl = person.image_url;
    if (imageUrl?.startsWith("images/")) {
      imageUrl = getImageUrl(imageUrl) ?? null;
    }

    const personWithFacetSummaries = {
      ...person,
      person_facet_summaries: facetSummaries,
      image_url: imageUrl,
    };

    consola.info("PersonDetail loader success", {
      personId: person.id,
      orgCount: organizations.data?.length ?? 0,
      assetsCount: relatedAssets.length,
      surveyResponsesCount: surveyResponsesList.length,
      themesCount: personThemes.length,
      researchLinkResponsesCount: researchLinkResponses?.length ?? 0,
    });
    return {
      person: personWithFacetSummaries,
      catalog,
      organizations: organizations.data ?? [],
      relatedAssets,
      surveyResponses: surveyResponsesList,
      personThemes,
      researchLinkResponses: researchLinkResponses ?? [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    consola.error("PersonDetail loader error", {
      accountId,
      projectId,
      personId,
      message,
      error,
    });
    throw new Response("Failed to load person", { status: 500 });
  }
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  const accountId = params.accountId;
  const projectId = params.projectId;
  const personId = params.personId;

  if (!accountId || !projectId || !personId) {
    throw new Response("Account ID, Project ID, and Person ID are required", {
      status: 400,
    });
  }

  const routes = createProjectRoutes(accountId, projectId);
  const formData = await request.formData();
  const intent = formData.get("_action");

  if (intent === "refresh-description") {
    try {
      const person = await getPersonById({
        supabase,
        accountId,
        projectId,
        id: personId,
      });
      const [summary] = await Promise.all([
        generatePersonDescription({
          supabase,
          person,
          projectId,
        }),
        generatePersonFacetSummaries({
          supabase,
          person,
          projectId,
          accountId,
          force: true,
        }),
      ]);
      await updatePerson({
        supabase,
        accountId,
        projectId,
        id: personId,
        data: { description: summary },
      });
      // Return success data instead of redirect to allow fetcher to handle revalidation
      return { refresh: { success: true, description: summary } };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to refresh description.";
      return { refresh: { error: message } };
    }
  }

  if (intent === "link-organization") {
    const organizationId = (
      formData.get("organization_id") as string | null
    )?.trim();
    if (!organizationId) {
      return { organization: { error: "Organization is required" } };
    }

    const jobTitle = (formData.get("role") as string | null)?.trim() || null; // form field still named "role"
    const relationshipStatus =
      (formData.get("relationship_status") as string | null)?.trim() || null;
    const notes = (formData.get("notes") as string | null)?.trim() || null;

    const { error } = await linkPersonToOrganization({
      supabase,
      accountId,
      projectId,
      personId,
      organizationId,
      jobTitle,
      relationshipStatus,
      notes,
    });

    if (error) {
      return { organization: { error: "Failed to link organization" } };
    }

    return redirect(routes.people.detail(personId));
  }

  if (intent === "unlink-organization") {
    const organizationId = formData.get("organization_id") as string | null;
    if (!organizationId) {
      return { organization: { error: "Organization is required" } };
    }

    const { error } = await unlinkPersonFromOrganization({
      supabase,
      accountId,
      projectId,
      personId,
      organizationId,
    });

    if (error) {
      return { organization: { error: "Failed to unlink organization" } };
    }

    return redirect(routes.people.detail(personId));
  }

  if (intent === "add-facet-signal") {
    const facetAccountId = formData.get("facet_account_id") as string | null;
    if (!facetAccountId) {
      return { facet: { error: "Facet is required" } };
    }

    const { error } = await supabase.from("person_facet").insert({
      person_id: personId,
      account_id: accountId,
      project_id: projectId,
      facet_account_id: Number.parseInt(facetAccountId, 10),
      source: "manual",
      confidence: 1.0,
      noted_at: new Date().toISOString(),
    });

    if (error) {
      consola.error("Failed to add facet signal:", error);
      return { facet: { error: "Failed to add facet signal" } };
    }

    return redirect(routes.people.detail(personId));
  }

  if (intent === "create-and-add-facet-signal") {
    const kindSlug = (formData.get("kind_slug") as string | null)?.trim();
    const facetLabel = (formData.get("facet_label") as string | null)?.trim();

    if (!kindSlug || !facetLabel) {
      return { facet: { error: "Facet kind and label are required" } };
    }

    // Get the facet kind
    const { data: kind, error: kindError } = await supabase
      .from("facet_kind_global")
      .select("id")
      .eq("slug", kindSlug)
      .single();

    if (kindError || !kind) {
      return { facet: { error: "Invalid facet kind" } };
    }

    // Create slug from label
    const slug = facetLabel
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    // Create or get the facet_account
    const { data: existingFacet } = await supabase
      .from("facet_account")
      .select("id")
      .eq("account_id", accountId)
      .eq("kind_id", kind.id)
      .eq("slug", slug)
      .single();

    let facetAccountId: number;

    if (existingFacet) {
      facetAccountId = existingFacet.id;
    } else {
      const { data: newFacet, error: createError } = await supabase
        .from("facet_account")
        .insert({
          account_id: accountId,
          kind_id: kind.id,
          slug,
          label: facetLabel,
          is_active: true,
        })
        .select("id")
        .single();

      if (createError || !newFacet) {
        consola.error("Failed to create facet:", createError);
        return { facet: { error: "Failed to create facet" } };
      }

      facetAccountId = newFacet.id;
    }

    // Link the facet to the person
    const { error: linkError } = await supabase.from("person_facet").insert({
      person_id: personId,
      account_id: accountId,
      project_id: projectId,
      facet_account_id: facetAccountId,
      source: "manual",
      confidence: 1.0,
      noted_at: new Date().toISOString(),
    });

    if (linkError) {
      consola.error("Failed to link facet to person:", linkError);
      return { facet: { error: "Failed to link facet to person" } };
    }

    return redirect(routes.people.detail(personId));
  }

  if (intent === "remove-facet-signal") {
    const facetAccountId = formData.get("facet_account_id") as string | null;
    if (!facetAccountId) {
      return { facet: { error: "Facet is required" } };
    }

    const { error } = await supabase
      .from("person_facet")
      .delete()
      .eq("person_id", personId)
      .eq("facet_account_id", Number.parseInt(facetAccountId, 10));

    if (error) {
      consola.error("Failed to remove facet signal:", error);
      return { facet: { error: "Failed to remove facet signal" } };
    }

    return redirect(routes.people.detail(personId));
  }

  if (intent === "delete") {
    try {
      await deletePerson({
        supabase,
        id: personId,
        accountId,
        projectId,
      });
      return redirect(routes.people.index());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete person";
      consola.error("Failed to delete person:", error);
      return { delete: { error: message } };
    }
  }

  if (intent === "update-field") {
    const field = formData.get("field") as string;
    const value = formData.get("value") as string;

    // Whitelist of allowed fields to update
    const allowedFields = [
      "title",
      "description",
      "job_function",
      "seniority_level",
      "industry",
      "primary_email",
      "primary_phone",
      "linkedin_url",
    ];

    if (!allowedFields.includes(field)) {
      return { error: `Field ${field} is not editable` };
    }

    await updatePerson({
      supabase,
      accountId,
      projectId,
      id: personId,
      data: { [field]: value || null },
    });

    return { success: true, field };
  }

  if (intent === "update-org-field") {
    const organizationId = formData.get("organizationId") as string;
    const field = formData.get("field") as string;
    const value = formData.get("value") as string;

    const allowedOrgFields = ["size_range"];
    if (!organizationId || !allowedOrgFields.includes(field)) {
      return { error: `Organization field ${field} is not editable` };
    }

    await updateOrganization({
      supabase,
      accountId,
      id: organizationId,
      data: { [field]: value || null },
    });

    return { success: true, field };
  }

  if (intent === "create-and-link-organization") {
    const name = (formData.get("name") as string | null)?.trim();
    if (!name) {
      return { organization: { error: "Organization name is required" } };
    }

    const headquartersLocation =
      (formData.get("headquarters_location") as string | null)?.trim() || null;
    const jobTitle = (formData.get("role") as string | null)?.trim() || null; // form field still named "role"

    // Create the organization
    const { data: newOrg, error: createError } = await supabase
      .from("organizations")
      .insert({
        account_id: accountId,
        project_id: projectId,
        name,
        headquarters_location: headquartersLocation,
      })
      .select()
      .single();

    if (createError || !newOrg) {
      return { organization: { error: "Failed to create organization" } };
    }

    // Link the person to the new organization
    const { error: linkError } = await linkPersonToOrganization({
      supabase,
      accountId,
      projectId,
      personId,
      organizationId: newOrg.id,
      jobTitle,
      relationshipStatus: null,
      notes: null,
    });

    if (linkError) {
      return {
        organization: { error: "Organization created but failed to link" },
      };
    }

    return redirect(routes.people.detail(personId));
  }

  return redirect(routes.people.detail(personId));
}

export default function PersonDetail() {
  const {
    person,
    catalog,
    organizations,
    relatedAssets,
    surveyResponses,
    personThemes,
    researchLinkResponses,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const refreshError = actionData?.refresh?.error;
  const { projectPath } = useCurrentProject();
  const { accountId, projectId } = useParams();
  const navigate = useNavigate();
  const refreshFetcher = useFetcher<typeof action>();
  const routesByIds = useProjectRoutesFromIds(accountId ?? "", projectId ?? "");
  const routesByPath = useProjectRoutes(projectPath || "");
  const routes = accountId && projectId ? routesByIds : routesByPath;

  // ---- Source-type splits for counts ----
  const allInterviewLinks = (person.interview_people || []).filter(
    (ip) => ip.interviews?.id,
  );
  const interviewLinks = allInterviewLinks.filter(
    (ip) =>
      ip.interviews?.source_type !== "note" &&
      ip.interviews?.source_type !== "survey_response" &&
      ip.interviews?.source_type !== "public_chat" &&
      ip.interviews?.media_type !== "voice_memo",
  );
  const noteLinks = allInterviewLinks.filter(
    (ip) =>
      ip.interviews?.source_type === "note" ||
      ip.interviews?.media_type === "voice_memo",
  );
  const surveyLinks = allInterviewLinks.filter(
    (ip) => ip.interviews?.source_type === "survey_response",
  );
  const chatLinks = allInterviewLinks.filter(
    (ip) => ip.interviews?.source_type === "public_chat",
  );

  // ---- Facet data for profile lenses ----
  const facetsById = useMemo(() => {
    const map = new Map<
      number,
      { label: string; alias?: string; kind_slug: string }
    >();
    for (const facet of catalog.facets) {
      map.set(facet.facet_account_id, {
        label: facet.label,
        alias: facet.alias,
        kind_slug: facet.kind_slug,
      });
    }
    return map;
  }, [catalog]);

  const facetSummaryMap = useMemo(() => {
    const map = new Map<
      string,
      { summary: string; generated_at: string | null }
    >();
    for (const row of person.person_facet_summaries ?? []) {
      map.set(row.kind_slug, {
        summary: row.summary,
        generated_at: row.generated_at ?? null,
      });
    }
    return map;
  }, [person.person_facet_summaries]);

  const personFacets = useMemo(() => {
    return (person.person_facet ?? []).map((row) => {
      const meta = facetsById.get(row.facet_account_id);
      const joinedFacet = row.facet as {
        label?: string | null;
        facet_kind_global?: { slug?: string | null } | null;
      } | null;
      const fallbackLabel = joinedFacet?.label ?? null;
      const fallbackKindSlug = joinedFacet?.facet_kind_global?.slug ?? "";

      return {
        facet_account_id: row.facet_account_id,
        label:
          meta?.alias ||
          meta?.label ||
          fallbackLabel ||
          `ID:${row.facet_account_id}`,
        kind_slug: meta?.kind_slug || fallbackKindSlug || "",
        source: row.source || null,
        confidence: row.confidence ?? null,
      };
    });
  }, [person.person_facet, facetsById]);

  const facetsGrouped = useMemo(() => {
    const kindLabelMap = new Map(
      catalog.kinds.map((kind) => [kind.slug, kind.label]),
    );
    const groups = new Map<
      string,
      { label: string; facets: typeof personFacets }
    >();
    for (const facet of personFacets) {
      const key = facet.kind_slug || "other";
      const label =
        kindLabelMap.get(facet.kind_slug) ?? (facet.kind_slug || "Other");
      if (!groups.has(key)) {
        groups.set(key, { label, facets: [] });
      }
      groups.get(key)?.facets.push(facet);
    }
    return Array.from(groups.entries()).map(([slug, value]) => ({
      kind_slug: slug,
      ...value,
    }));
  }, [personFacets, catalog.kinds]);

  const facetLensGroups = useMemo(() => {
    return facetsGrouped
      .filter((group) => group.kind_slug !== "survey_response")
      .map((group) => ({
        ...group,
        summary: facetSummaryMap.get(group.kind_slug)?.summary ?? null,
      }));
  }, [facetsGrouped, facetSummaryMap]);

  const availableFacetsByKind = useMemo(() => {
    const grouped: Record<
      string,
      Array<{ id: number; label: string; slug: string }>
    > = {};
    for (const facet of catalog.facets) {
      const kindSlug = facet.kind_slug;
      if (!grouped[kindSlug]) {
        grouped[kindSlug] = [];
      }
      grouped[kindSlug].push({
        id: facet.facet_account_id,
        label: facet.label,
        slug: facet.slug || facet.label.toLowerCase().replace(/\s+/g, "-"),
      });
    }
    return grouped;
  }, [catalog.facets]);

  // ---- Organization data ----
  const linkedOrganizations = useMemo(() => {
    return (person.people_organizations ?? []).filter(
      (link) => link.organization,
    );
  }, [person.people_organizations]);

  const sortedLinkedOrganizations = useMemo(() => {
    return [...linkedOrganizations].sort((a, b) => {
      const nameA = a.organization?.name || "";
      const nameB = b.organization?.name || "";
      return nameA.localeCompare(nameB);
    });
  }, [linkedOrganizations]);

  const primaryOrg = useMemo(() => {
    const primary = linkedOrganizations.find((link) => link.is_primary);
    return (
      primary?.organization ?? linkedOrganizations[0]?.organization ?? null
    );
  }, [linkedOrganizations]);

  // ---- Derived values for new components ----
  const lastContactDate = useMemo(() => {
    const dates = allInterviewLinks
      .map((link) => link.interviews?.created_at)
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d));
    if (dates.length === 0) return null;
    return dates.reduce((latest, d) => (d > latest ? d : latest));
  }, [allInterviewLinks]);

  const icpMatch = useMemo(() => {
    const scales = (person as Record<string, unknown>).person_scale as Array<{
      kind_slug: string;
      score: number;
      band: string | null;
      confidence: number | null;
    }> | null;
    if (!scales?.length) return null;
    const icp = scales.find((s) => s.kind_slug === "icp") ?? scales[0];
    return {
      band: icp.band,
      score: icp.score,
      confidence: icp.confidence,
    };
  }, [person]);

  // ---- Refresh / delete handlers ----
  const isRefreshingDescription =
    refreshFetcher.state === "submitting" || refreshFetcher.state === "loading";
  const fetcherRefreshError = refreshFetcher.data?.refresh?.error;
  const isFacetSummaryPending = facetLensGroups.some((group) => !group.summary);

  const handleRefreshDescription = () => {
    refreshFetcher.submit(
      { _action: "refresh-description" },
      { method: "post" },
    );
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to delete ${person.name || "this person"}? This action cannot be undone.`,
      )
    ) {
      refreshFetcher.submit({ _action: "delete" }, { method: "post" });
    }
  };

  // ---- Quick Note dialog ----
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  const handleSaveNote = useCallback(
    async (note: {
      title: string;
      content: string;
      noteType: string;
      associations: Record<string, unknown>;
      tags: string[];
    }) => {
      if (!projectId) throw new Error("Project ID is required");

      const response = await fetch("/api/notes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: note.title,
          content: note.content,
          noteType: note.noteType,
          associations: {
            ...note.associations,
            people: [person.id],
          },
          tags: note.tags,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save note");
      }
    },
    [projectId, person.id],
  );

  // ---- Render: single-scroll layout with anchor sections ----
  return (
    <div className="relative min-h-screen bg-muted/20">
      <PersonaPeopleSubnav />
      <PersonDetailNav />

      <PageContainer className="space-y-8 pb-16">
        {/* Error banner */}
        {(refreshError || fetcherRefreshError) && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
            {refreshError || fetcherRefreshError}
          </div>
        )}

        {/* Section 1: Scorecard Hero */}
        <section id="scorecard">
          <PersonScorecard
            person={person}
            primaryOrg={primaryOrg}
            icpMatch={icpMatch}
            interviewCount={interviewLinks.length}
            surveyCount={surveyLinks.length}
            noteCount={noteLinks.length}
            chatCount={chatLinks.length}
            lastContactDate={lastContactDate}
            routes={routes}
            onRefreshDescription={handleRefreshDescription}
            onDelete={handleDelete}
            onLogNote={() => setNoteDialogOpen(true)}
            isRefreshing={isRefreshingDescription}
          />
        </section>

        {/* Section 2: Insights & Next Steps */}
        <section id="insights">
          <PersonInsights
            description={person.description}
            themes={personThemes}
            lastContactDate={lastContactDate}
            surveyCount={surveyLinks.length}
            conversationCount={interviewLinks.length}
            icpMatch={icpMatch}
            routes={routes}
            onRefreshDescription={handleRefreshDescription}
            isRefreshing={isRefreshingDescription}
          />
        </section>

        {/* Section 3: Activity Timeline */}
        <section id="activity">
          <PersonActivityTimeline
            allInterviewLinks={allInterviewLinks}
            relatedAssets={relatedAssets}
            surveyResponses={surveyResponses}
            researchLinkResponses={researchLinkResponses}
            routes={routes}
          />
        </section>

        {/* Section 4: Profile, Contact & Attributes */}
        <section id="profile">
          <PersonProfileSection
            person={person}
            primaryOrg={primaryOrg}
            facetLensGroups={facetLensGroups}
            availableFacetsByKind={availableFacetsByKind}
            isGenerating={isRefreshingDescription || isFacetSummaryPending}
            personScale={
              (person as Record<string, unknown>).person_scale as Array<{
                kind_slug: string;
                score: number;
                band: string | null;
                confidence: number | null;
              }> | null
            }
            sortedLinkedOrganizations={sortedLinkedOrganizations}
            routes={routes}
            availableOrganizations={organizations}
          />
        </section>
      </PageContainer>

      <QuickNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        onSave={handleSaveNote}
      />
    </div>
  );
}
