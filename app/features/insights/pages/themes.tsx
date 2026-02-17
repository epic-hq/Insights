/**
 * "By Theme" lens: story-driven page for the Insights page.
 * 4-layer structure with clear visual separation:
 *   Layer 1: Signal Summary card (top 3 themes as rows)
 *   Layer 2: All Themes grid (2-col cards with signal badges)
 *   Layer 3: Blind Spots & Weak Signals
 *   Layer 4: Suggested Next Steps
 */
import { ChevronDown, LayoutGrid, Rows, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import {
  useFetcher,
  useLoaderData,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Separator } from "~/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  getInsights,
  getTrendingData,
  getTopVoicesForThemes,
} from "~/features/insights/db";
import type {
  ThemeWithSignal,
  WeakSignal,
  SuggestedAction,
} from "~/features/insights/types";
import { currentProjectContext } from "~/server/current-project-context";
import { userContext } from "~/server/user-context";
import { ActionsPanel } from "~/features/insights/components/ActionsPanel";
import { GapsPanel } from "~/features/insights/components/GapsPanel";
import { LensToggle } from "~/features/insights/components/LensToggle";
import { SignalSummary } from "~/features/insights/components/SignalSummary";
import { ThemeCard } from "~/features/insights/components/ThemeCard";

const DEFAULT_LIMIT = 12;

export async function loader({ context, params, request }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  const url = new URL(request.url);
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const rawLimit = Number(
    url.searchParams.get("limit") ?? String(DEFAULT_LIMIT),
  );
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, 50)
      : DEFAULT_LIMIT;

  const ctxProject = context.get(currentProjectContext);
  const projectId = ctxProject.projectId || params.projectId || "";
  const accountId = ctxProject.accountId || params.accountId || "";

  if (!projectId || !accountId || !supabase) {
    throw new Response("Missing project context", { status: 400 });
  }

  // Fetch insights + trending + total people in parallel
  const [insightsResult, trendingMap, totalPeopleResult] = await Promise.all([
    getInsights({ supabase, accountId, projectId, offset, limit: limit + 1 }),
    getTrendingData({ supabase, projectId }),
    supabase
      .from("people")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("user_id", null),
  ]);

  if (insightsResult.error)
    throw new Response("Failed to load insights", { status: 500 });

  const allInsights = insightsResult.data || [];
  const insights = allInsights.slice(0, limit);
  const hasMore = allInsights.length > limit;
  const nextOffset = offset + insights.length;
  const totalPeople = totalPeopleResult.count ?? 0;

  const insightIds = insights.map((i) => i.id).filter(Boolean);

  // Fetch top voices
  const voicesMap = await getTopVoicesForThemes({
    supabase,
    projectId,
    themeIds: insightIds,
  });

  // Compute signal strength and assign levels
  const themesWithSignal = insights.map((insight) => {
    const evidenceCount =
      (insight as { evidence_count?: number }).evidence_count ?? 0;
    const personCount =
      (insight as { person_count?: number }).person_count ?? 0;
    const signalStrength = evidenceCount * personCount;
    const trending = trendingMap.get(insight.id);
    const topVoices = voicesMap.get(insight.id) ?? [];

    return {
      ...insight,
      evidence_count: evidenceCount,
      person_count: personCount,
      signal_strength: signalStrength,
      signal_level: "medium" as "high" | "medium" | "low",
      trend: trending?.trend ?? ("stable" as const),
      breadth: { covered: personCount, total: totalPeople },
      top_voices: topVoices,
    };
  });

  // Sort by signal_strength and assign levels (top 33% = high, middle = medium, bottom = low)
  const sorted = [...themesWithSignal].sort(
    (a, b) => b.signal_strength - a.signal_strength,
  );
  const total = sorted.length;
  const highThreshold = Math.ceil(total / 3);
  const mediumThreshold = Math.ceil((total * 2) / 3);

  for (let i = 0; i < sorted.length; i++) {
    if (i < highThreshold) sorted[i].signal_level = "high";
    else if (i < mediumThreshold) sorted[i].signal_level = "medium";
    else sorted[i].signal_level = "low";
  }

  return {
    themes: sorted,
    totalPeople,
    paging: { offset, limit, hasMore, nextOffset },
  };
}

export default function ThemesPage() {
  const { themes, totalPeople, paging } = useLoaderData<typeof loader>();
  const location = useLocation();
  const loadMoreFetcher = useFetcher<typeof loader>();
  const [searchParams] = useSearchParams();

  const [allThemes, setAllThemes] = useState(themes as ThemeWithSignal[]);
  const [hasMore, setHasMore] = useState(paging.hasMore);
  const [nextOffset, setNextOffset] = useState(paging.nextOffset);
  const [subView, setSubView] = useState<"cards" | "table">("cards");
  const [showAllThemes, setShowAllThemes] = useState(false);

  // Reset state when loader data changes (e.g. revalidation)
  useEffect(() => {
    setAllThemes(themes as ThemeWithSignal[]);
    setHasMore(paging.hasMore);
    setNextOffset(paging.nextOffset);
  }, [themes, paging.hasMore, paging.nextOffset]);

  // Handle load more results
  useEffect(() => {
    if (loadMoreFetcher.state !== "idle") return;
    const data = loadMoreFetcher.data;
    if (!data) return;
    const newThemes = (data.themes || []) as ThemeWithSignal[];
    if (newThemes.length === 0) {
      setHasMore(false);
      return;
    }
    setAllThemes((prev) => {
      const existing = new Set(prev.map((t) => t.id));
      const toAdd = newThemes.filter((t) => !existing.has(t.id));
      return prev.concat(toAdd);
    });
    setHasMore(Boolean(data.paging?.hasMore));
    setNextOffset(
      typeof data.paging?.nextOffset === "number"
        ? data.paging.nextOffset
        : nextOffset,
    );
  }, [loadMoreFetcher.state, loadMoreFetcher.data, nextOffset]);

  const loadMoreHref = useMemo(() => {
    const sp = new URLSearchParams(searchParams);
    sp.set("offset", String(nextOffset));
    sp.set("limit", String(paging.limit));
    return `${location.pathname}?${sp.toString()}`;
  }, [searchParams, nextOffset, paging.limit, location.pathname]);

  // Derive weak signals: bottom-quartile themes by person coverage relative to evidence
  const weakSignals = useMemo<WeakSignal[]>(() => {
    if (allThemes.length < 4) return [];
    // Weak signals = themes where few people carry disproportionate evidence.
    // Use the bottom quartile by signal_level ("low") that still have meaningful evidence.
    return allThemes
      .filter((t) => t.signal_level === "low" && t.evidence_count >= 3)
      .slice(0, 3)
      .map((t) => ({
        theme: t,
        reason: `${t.evidence_count} evidence from ${t.person_count} ${t.person_count === 1 ? "person" : "people"} — low breadth, may need validation`,
      }));
  }, [allThemes]);

  // Derive suggested actions from top themes
  const suggestedActions = useMemo<SuggestedAction[]>(() => {
    const actions: SuggestedAction[] = [];
    const sorted = [...allThemes].sort(
      (a, b) => b.signal_strength - a.signal_strength,
    );

    // Top signal = "Fix"
    if (sorted[0] && sorted[0].signal_level === "high") {
      actions.push({
        title: `Fix: ${sorted[0].name || "Top theme"}`,
        description: `${sorted[0].person_count} people mentioned this with ${sorted[0].evidence_count} evidence points.`,
        confidence: "high",
        cta: "Create Task",
      });
    }

    // Growing signal = "Investigate"
    const growing = sorted.find(
      (t) => t.trend === "growing" && t !== sorted[0],
    );
    if (growing) {
      actions.push({
        title: `Investigate: ${growing.name || "Growing theme"}`,
        description: "Growing signal — this topic is accelerating.",
        confidence: "medium",
        cta: "Run Follow-Up Survey",
      });
    }

    // Weak signal with high evidence
    const weakHigh = weakSignals[0];
    if (weakHigh) {
      actions.push({
        title: `Validate: ${weakHigh.theme.name || "Weak signal"}`,
        description: weakHigh.reason,
        confidence: "low",
        cta: "Send Survey",
      });
    }

    return actions;
  }, [allThemes, weakSignals]);

  return (
    <div className="space-y-6">
      {/* Lens toggle (no sub-view toggle here; it moves next to "All Themes") */}
      <LensToggle activeLens="themes" />

      {allThemes.length > 0 ? (
        <>
          {/* ── Layer 1: Signal Summary — click goes to detail ── */}
          <SignalSummary themes={allThemes} totalPeople={totalPeople} />

          {/* ── Divider ── */}
          <Separator />

          {/* ── Layer 2: All Themes (collapsed by default) ── */}
          <Collapsible open={showAllThemes} onOpenChange={setShowAllThemes}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAllThemes ? "rotate-180" : ""}`}
                  />
                  All Themes ({allThemes.length})
                </button>
              </CollapsibleTrigger>
              {showAllThemes && (
                <ToggleGroup
                  type="single"
                  value={subView}
                  onValueChange={(v) => v && setSubView(v as "cards" | "table")}
                  size="sm"
                  className="shrink-0"
                >
                  <ToggleGroupItem
                    value="cards"
                    aria-label="Cards view"
                    className="gap-1.5"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Cards
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="table"
                    aria-label="Table view"
                    className="gap-1.5"
                  >
                    <Rows className="h-3.5 w-3.5" />
                    Table
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
            <CollapsibleContent className="mt-4">
              {subView === "cards" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {allThemes.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      totalPeople={totalPeople}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Table view coming soon — use the existing Table route for now.
                </p>
              )}

              {/* Load more */}
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => loadMoreFetcher.load(loadMoreHref)}
                    disabled={loadMoreFetcher.state !== "idle"}
                    className="rounded border border-border bg-background px-4 py-2 text-foreground text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadMoreFetcher.state === "loading"
                      ? "Loading..."
                      : "Load more"}
                  </button>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* ── Divider ── */}
          <Separator />

          {/* ── Layer 3: Blind Spots & Weak Signals ── */}
          <GapsPanel weakSignals={weakSignals} />

          {/* ── Divider (only if actions exist) ── */}
          {suggestedActions.length > 0 && <Separator />}

          {/* ── Layer 4: Suggested Next Steps ── */}
          {suggestedActions.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                <Zap className="h-3.5 w-3.5" />
                Suggested Next Steps
              </h2>
              <ActionsPanel actions={suggestedActions} />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground text-lg">No themes yet</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Upload conversations and run analysis to see insights here.
          </p>
        </div>
      )}
    </div>
  );
}
