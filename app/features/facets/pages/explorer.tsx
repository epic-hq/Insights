/**
 * Facet Explorer - Browse your account's vocabulary
 *
 * Shows all facets grouped by kind with search.
 * Helps users understand their vocabulary and see relationships.
 */

import {
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Search,
  Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { userContext } from "~/server/user-context";

export async function loader({ context, params }: LoaderFunctionArgs) {
  const { supabase } = context.get(userContext);
  const accountId = params.accountId;
  if (!accountId)
    throw new Response("Missing account context", { status: 400 });

  const { data: facets, error } = await supabase
    .from("facet_account")
    .select(
      `
			id,
			kind_id,
			slug,
			label,
			synonyms,
			is_active,
			facet_kind_global!inner(slug, label),
			evidence_count:evidence_facet(count),
			person_count:person_facet(count)
		`,
    )
    .eq("account_id", accountId)
    .order("label");

  if (error) throw error;

  const byKind = new Map<string, typeof facets>();
  for (const facet of facets ?? []) {
    const kindSlug = facet.facet_kind_global?.slug ?? "unknown";
    if (!byKind.has(kindSlug)) {
      byKind.set(kindSlug, []);
    }
    byKind.get(kindSlug)?.push(facet);
  }

  const grouped = Array.from(byKind.entries()).map(([kindSlug, facets]) => ({
    kindSlug,
    kindLabel: facets[0]?.facet_kind_global?.label ?? kindSlug,
    facets,
    totalCount: facets.length,
  }));

  grouped.sort((a, b) => b.totalCount - a.totalCount);

  return { grouped, accountId };
}

export default function FacetExplorer() {
  const { grouped } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState("");
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());

  const toggleKind = (kindSlug: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kindSlug)) {
        next.delete(kindSlug);
      } else {
        next.add(kindSlug);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!search) return grouped;
    const q = search.toLowerCase();
    return grouped
      .map((group) => ({
        ...group,
        facets: group.facets.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            f.synonyms?.some((s) => s.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.facets.length > 0);
  }, [search, grouped]);

  const effectiveExpanded = useMemo(() => {
    if (search) return new Set(filtered.map((g) => g.kindSlug));
    return expandedKinds;
  }, [search, filtered, expandedKinds]);

  const totalFacets = grouped.reduce((sum, g) => sum + g.totalCount, 0);

  return (
    <div className="mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1 font-bold text-2xl text-foreground">
          Facet Explorer
        </h1>
        <p className="text-muted-foreground text-sm">
          {totalFacets} facets across {grouped.length} categories
        </p>
      </div>

      {/* Explanation */}
      <div className="mb-8 rounded-xl border bg-gradient-to-br from-amber-50 to-amber-50/50 p-6 dark:from-amber-950/20 dark:to-amber-950/10 sm:p-8">
        <div className="flex gap-3">
          <Lightbulb className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
          <div className="space-y-3">
            <h2 className="font-semibold text-foreground text-lg">
              What are facets?
            </h2>
            <p className="text-foreground/80 text-sm leading-relaxed sm:text-base">
              Facets are labels that describe what people say in your
              conversations. When someone says "I need to move faster," the AI
              tags that quote with a <strong>Goal</strong> called "Move Faster."
              Over time, facets build a vocabulary of what your customers care
              about most.
            </p>
            <div className="space-y-2 text-foreground/70 text-sm">
              <div className="flex gap-2">
                <span className="font-bold text-amber-500">1.</span>
                <span>
                  <strong>Search</strong> to find what customers are talking
                  about across all your interviews
                </span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-amber-500">2.</span>
                <span>
                  <strong>Expand a category</strong> to see every facet the AI
                  has discovered, with quote and people counts
                </span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-amber-500">3.</span>
                <span>
                  <strong>Synonyms</strong> show alternative terms that map to
                  the same idea (e.g., "UX" and "User Experience")
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search facets... (e.g., faster, cost, workflow)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Facet Grid - 2 columns on large screens */}
      <div className="mb-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((group) => {
          const isExpanded = effectiveExpanded.has(group.kindSlug);
          const evidenceTotal = group.facets.reduce(
            (sum, f) => sum + (f.evidence_count?.[0]?.count ?? 0),
            0,
          );
          const peopleTotal = group.facets.reduce(
            (sum, f) => sum + (f.person_count?.[0]?.count ?? 0),
            0,
          );

          return (
            <Card
              key={group.kindSlug}
              className="overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              {/* Kind Header */}
              <button
                type="button"
                onClick={() => toggleKind(group.kindSlug)}
                className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Tag className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold text-base text-foreground capitalize">
                    {group.kindLabel}
                  </span>
                  <Badge variant="secondary">{group.facets.length}</Badge>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground text-sm">
                  <span>{evidenceTotal} evidence</span>
                  <span>{peopleTotal} people</span>
                </div>
              </button>

              {/* Facets List */}
              {isExpanded && (
                <div className="border-t bg-muted/20">
                  {group.facets.map((facet) => {
                    const evidenceCount = facet.evidence_count?.[0]?.count ?? 0;
                    const personCount = facet.person_count?.[0]?.count ?? 0;

                    return (
                      <div
                        key={facet.id}
                        className="flex items-center justify-between border-b px-5 py-3 last:border-0 hover:bg-background/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm">
                            {facet.label}
                          </div>
                          {facet.synonyms && facet.synonyms.length > 0 && (
                            <div className="mt-0.5 truncate text-muted-foreground text-xs">
                              Also: {facet.synonyms.join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex shrink-0 items-center gap-4 text-muted-foreground text-xs">
                          <span>{evidenceCount} quotes</span>
                          <span>{personCount} people</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card className="col-span-full rounded-xl p-8 text-center text-muted-foreground">
            No facets found matching &ldquo;{search}&rdquo;
          </Card>
        )}
      </div>
    </div>
  );
}
