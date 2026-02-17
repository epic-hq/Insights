/**
 * Layer 3: Intersections, Divergences & Blind Spots.
 * Common Ground: horizontal bar chart with roles inline on bar + breadth fraction.
 * Divergences: placeholder for Phase C (AI-detected conflicting positions).
 * Blind Spots: expected concerns with low signal, "Add to Survey" / "Not Relevant" CTAs.
 */
import { AlertTriangle, Link2, X, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { CommonGround, WeakSignal } from "~/features/insights/types";

interface IntersectionsPanelProps {
  commonGround: CommonGround[];
  weakSignals: WeakSignal[];
}

export function IntersectionsPanel({
  commonGround,
  weakSignals,
}: IntersectionsPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleSignals = weakSignals.filter(
    (ws) => !dismissedIds.has(ws.theme.id),
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Link2 className="h-4 w-4 text-blue-500" />
          Intersections, Divergences & Blind Spots
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Common Ground ── */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Common Ground — themes shared across functions
          </p>
          {commonGround.length > 0 ? (
            <div className="space-y-3">
              {commonGround.slice(0, 5).map((cg) => {
                const pct = Math.round((cg.role_count / cg.total_roles) * 100);
                return (
                  <div key={cg.theme.id} className="flex items-center gap-3">
                    {/* Theme name */}
                    <span className="w-40 shrink-0 truncate text-xs font-medium text-foreground">
                      {cg.theme.name}
                    </span>
                    {/* Bar with roles inline */}
                    <div className="relative flex-1 h-5 rounded bg-muted overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded bg-blue-500/80 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                      <span className="relative z-10 flex h-full items-center px-2 text-[10px] font-medium text-foreground/80">
                        {cg.roles.join(" \u00B7 ")}
                      </span>
                    </div>
                    {/* Breadth fraction */}
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {cg.role_count}/{cg.total_roles}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No themes shared across multiple roles yet.
            </p>
          )}
        </div>

        {/* ── Divergences ── */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Zap className="mr-1 inline h-3 w-3" />
            Divergences — conflicting positions on the same topic
          </p>
          <p className="text-xs text-muted-foreground italic">
            Coming in Phase C — AI-detected conflicting positions across
            stakeholders will surface here.
          </p>
        </div>

        {/* ── Blind Spots ── */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            Blind Spots — expected concerns with no signal
          </p>
          {visibleSignals.length > 0 ? (
            <div className="divide-y divide-border">
              {visibleSignals.map((ws) => (
                <div
                  key={ws.theme.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">
                      {ws.theme.name || "Untitled"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {ws.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled
                    >
                      Add to Survey
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() =>
                        setDismissedIds((prev) =>
                          new Set(prev).add(ws.theme.id),
                        )
                      }
                    >
                      <X className="mr-1 h-3 w-3" />
                      Not Relevant
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No blind spots detected — all themes have adequate coverage.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
