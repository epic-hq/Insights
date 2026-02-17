/**
 * "By Stakeholder" lens: person-centric view of the Insights page.
 * 4-layer structure:
 *   Layer 1: Stakeholder Landscape (role clusters with avatar dots)
 *   Layer 2: Stakeholder Perspectives (cards grouped by role)
 *   Layer 3: Intersections (Common Ground, Divergences, Blind Spots)
 *   Layer 4: Suggested Next Steps
 */
import { Users, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router-dom";
import { Separator } from "~/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { getInsights, getStakeholderSummaries } from "~/features/insights/db";
import type {
  StakeholderSummary,
  CommonGround,
  WeakSignal,
  SuggestedAction,
  ThemeWithSignal,
} from "~/features/insights/types";
import { currentProjectContext } from "~/server/current-project-context";
import { userContext } from "~/server/user-context";
import { ActionsPanel } from "~/features/insights/components/ActionsPanel";
import { IntersectionsPanel } from "~/features/insights/components/IntersectionsPanel";
import { LensToggle } from "~/features/insights/components/LensToggle";
import { StakeholderCard } from "~/features/insights/components/StakeholderCard";
import { StakeholderLandscape } from "~/features/insights/components/StakeholderLandscape";

export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;
  const ctxProject = context.get(currentProjectContext);
  const projectId = ctxProject.projectId || params.projectId || "";
  const accountId = ctxProject.accountId || params.accountId || "";

  if (!projectId || !accountId || !supabase) {
    throw new Response("Missing project context", { status: 400 });
  }

  // Fetch stakeholder data + themes for weak signal detection
  const [stakeholderData, insightsResult] = await Promise.all([
    getStakeholderSummaries({ supabase, projectId }),
    getInsights({ supabase, accountId, projectId }),
  ]);

  return {
    stakeholders: stakeholderData.stakeholders,
    commonGround: stakeholderData.commonGround,
    sharedConcern: stakeholderData.sharedConcern,
    themes: insightsResult.data ?? [],
  };
}

export default function StakeholdersPage() {
  const { stakeholders, commonGround, sharedConcern, themes } =
    useLoaderData<typeof loader>();

  const [groupBy, setGroupBy] = useState<
    "job_function" | "seniority" | "top_theme"
  >("job_function");
  const [highlightPersonId, setHighlightPersonId] = useState<string | null>(
    null,
  );

  // Group stakeholders using selected dimension
  const roleGroups = useMemo(() => {
    const groups: Record<string, StakeholderSummary[]> = {};
    for (const s of stakeholders) {
      const role =
        groupBy === "seniority"
          ? getSeniorityBucket(s.person.title, s.person.job_function)
          : groupBy === "top_theme"
            ? s.themes[0]?.name || "No Strong Theme Yet"
            : normalizeJobFunctionLabel(s.person.job_function);
      if (!groups[role]) groups[role] = [];
      groups[role].push(s);
    }
    return groups;
  }, [stakeholders, groupBy]);

  // Compute weak signals from themes (same criteria as themes page)
  const weakSignals = useMemo<WeakSignal[]>(() => {
    if (!themes || themes.length < 4) return [];
    // Compute signal strength for each theme
    const withSignal = themes.map((t: any) => ({
      ...t,
      signal_strength: (t.evidence_count ?? 0) * (t.person_count ?? 0),
      signal_level: "medium" as const,
      trend: "stable" as const,
      breadth: { covered: t.person_count ?? 0, total: 0 },
      top_voices: [],
    }));
    const sorted = [...withSignal].sort(
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
    return sorted
      .filter((t) => t.signal_level === "low" && (t.evidence_count ?? 0) >= 3)
      .slice(0, 3)
      .map((t) => ({
        theme: t as ThemeWithSignal,
        reason: `${t.evidence_count} evidence from ${t.person_count} ${t.person_count === 1 ? "person" : "people"} — low breadth, may need validation`,
      }));
  }, [themes]);

  // Derive stakeholder-specific suggested actions
  const suggestedActions = useMemo<SuggestedAction[]>(() => {
    const actions: SuggestedAction[] = [];

    // Blind spots — follow up on under-represented themes
    const topBlindSpot = weakSignals[0];
    if (topBlindSpot) {
      actions.push({
        title: `Validate: ${topBlindSpot.theme.name || "Blind spot"}`,
        description: topBlindSpot.reason,
        confidence: "low",
        cta: "Send Survey",
      });
    }

    // Common ground — share stakeholder map
    if (commonGround.length > 0) {
      actions.push({
        title: "Share Stakeholder Map",
        description: `${commonGround.length} themes shared across roles — compile into a stakeholder alignment report.`,
        confidence: "medium",
        cta: "Generate Link",
      });
    }

    // Divergences placeholder
    actions.push({
      title: "Resolve Divergences",
      description:
        "AI-detected conflicting positions will surface here in Phase C.",
      confidence: "low",
      cta: "Coming Soon",
    });

    return actions;
  }, [weakSignals, commonGround]);

  const handlePersonClick = (personId: string) => {
    setHighlightPersonId(personId);
    // Clear after animation completes
    setTimeout(() => setHighlightPersonId(null), 2500);
  };

  const sortedRoles = Object.keys(roleGroups).sort((a, b) => {
    const bySize = roleGroups[b].length - roleGroups[a].length;
    if (bySize !== 0) return bySize;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      <LensToggle activeLens="stakeholders" />

      {stakeholders.length > 0 ? (
        <>
          {/* Layer 1: Stakeholder Landscape */}
          <StakeholderLandscape
            roleGroups={roleGroups}
            sharedConcern={groupBy === "job_function" ? sharedConcern : null}
            onPersonClick={handlePersonClick}
          />

          <Separator />

          {/* Layer 2: Stakeholder Perspectives */}
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Stakeholder Perspectives
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Group by</span>
                <ToggleGroup
                  type="single"
                  value={groupBy}
                  onValueChange={(value) =>
                    value &&
                    setGroupBy(
                      value as "job_function" | "seniority" | "top_theme",
                    )
                  }
                  size="sm"
                >
                  <ToggleGroupItem value="job_function">
                    Function
                  </ToggleGroupItem>
                  <ToggleGroupItem value="seniority">Seniority</ToggleGroupItem>
                  <ToggleGroupItem value="top_theme">Top Concern</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
            <div className="space-y-6">
              {sortedRoles.map((role) => (
                <div key={role}>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {role}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {roleGroups[role].map((s) => (
                      <StakeholderCard
                        key={s.person.id}
                        stakeholder={s}
                        highlightId={highlightPersonId}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Layer 3: Intersections */}
          <IntersectionsPanel
            commonGround={commonGround as CommonGround[]}
            weakSignals={weakSignals}
          />

          {/* Layer 4: Suggested Next Steps */}
          {suggestedActions.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  <Zap className="h-3.5 w-3.5" />
                  Suggested Next Steps
                </h2>
                <ActionsPanel actions={suggestedActions} />
              </div>
            </>
          )}
        </>
      ) : (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground text-lg">No stakeholders yet</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Upload conversations with identified participants to see stakeholder
            perspectives here.
          </p>
        </div>
      )}
    </div>
  );
}

function normalizeJobFunctionLabel(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "Other";
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const normalized = cleaned.toLowerCase();

  const aliasToRole: Record<string, string> = {
    executive: "Executive",
    exec: "Executive",
    "c-suite": "Executive",
    "c suite": "Executive",
    leadership: "Executive",
    "senior leadership": "Executive",
    founder: "Executive",
    "co-founder": "Executive",
    ceo: "Executive",
    cfo: "Executive",
    coo: "Executive",
    cto: "Executive",
    cmo: "Executive",
    cio: "Executive",
  };

  if (aliasToRole[normalized]) return aliasToRole[normalized];

  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getSeniorityBucket(
  title: string | null | undefined,
  jobFunction: string | null | undefined,
): string {
  const source = `${title || ""} ${jobFunction || ""}`.toLowerCase();
  if (!source.trim()) return "Unknown";

  if (
    /\b(ceo|cto|cfo|coo|cio|cmo|chief|founder|co-founder|owner|president|partner|principal|executive)\b/.test(
      source,
    )
  ) {
    return "Executive";
  }
  if (/\b(vp|vice president|head|director|lead)\b/.test(source)) {
    return "Director / VP";
  }
  if (/\b(manager|supervisor)\b/.test(source)) {
    return "Manager";
  }
  return "Individual Contributor";
}
