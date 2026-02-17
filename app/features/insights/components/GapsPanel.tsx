/**
 * Layer 3: Blind Spots & Weak Signals panel.
 * Non-collapsible card matching wireframe layout with warning icons.
 * Shows themes with low person coverage but notable evidence.
 */
import { AlertTriangle, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { WeakSignal } from "~/features/insights/types";

interface GapsPanelProps {
  weakSignals: WeakSignal[];
}

export function GapsPanel({ weakSignals }: GapsPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleSignals = weakSignals.filter(
    (ws) => !dismissedIds.has(ws.theme.id),
  );

  if (visibleSignals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Search className="h-4 w-4 text-yellow-500" />
          Blind Spots & Weak Signals
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                  Investigate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() =>
                    setDismissedIds((prev) => new Set(prev).add(ws.theme.id))
                  }
                >
                  <X className="mr-1 h-3 w-3" />
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
