import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ResearchLink, ResearchLinkResponse } from "~/types";

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
