/**
 * Evidence card component for displaying individual evidence turns
 * extracted from real-time transcription. Shows gist as primary headline,
 * with optional details (verbatim quote, facets, empathy signals).
 * Supports compact mode for cleaner end-state display.
 */

import type { EvidenceTurn, FacetMention } from "baml_client";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Lightbulb,
  MessageCircleQuestion,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { formatMs } from "../lib/audio";

interface EvidenceCardProps {
  evidence: EvidenceTurn;
  index: number;
  isNew?: boolean;
  compact?: boolean;
}

const FACET_COLORS: Record<string, string> = {
  goal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pain: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  behavior: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  tool: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  value: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  preference:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  workflow: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  feature:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  emotion: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  context: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  demographic: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  artifact: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
};

export function EvidenceCard({
  evidence,
  index,
  isNew,
  compact,
}: EvidenceCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  const facets = evidence.facet_mentions || [];

  // Check if there are details worth showing
  const hasDetails =
    evidence.verbatim ||
    evidence.why_it_matters ||
    evidence.says?.length ||
    evidence.does?.length ||
    evidence.thinks?.length ||
    evidence.feels?.length ||
    evidence.pains?.length ||
    evidence.gains?.length ||
    facets.length > 0;

  // In compact mode, show minimal card that expands on click
  if (compact && !expanded) {
    return (
      <Card
        className={cn(
          "cursor-pointer border-l-4 transition-all duration-200 hover:bg-muted/50",
          evidence.isQuestion ? "border-l-blue-400" : "border-l-emerald-400",
          isNew && "slide-in-from-right-4 fade-in animate-in duration-500",
        )}
        onClick={() => setExpanded(true)}
      >
        <CardContent className="flex items-center gap-3 p-3">
          {evidence.isQuestion ? (
            <MessageCircleQuestion className="h-4 w-4 shrink-0 text-blue-500" />
          ) : (
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
          )}
          <p className="flex-1 font-medium text-sm">{evidence.gist}</p>
          {evidence.anchors?.start_ms != null && (
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
              <Clock className="h-3 w-3" />
              {formatMs(evidence.anchors.start_ms)}
            </span>
          )}
          {hasDetails && (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </CardContent>
      </Card>
    );
  }

  // Full card view
  const empathySignals: Array<{ label: string; items: string[] }> = [];
  if (evidence.says?.length)
    empathySignals.push({ label: "Says", items: evidence.says });
  if (evidence.does?.length)
    empathySignals.push({ label: "Does", items: evidence.does });
  if (evidence.thinks?.length)
    empathySignals.push({ label: "Thinks", items: evidence.thinks });
  if (evidence.feels?.length)
    empathySignals.push({ label: "Feels", items: evidence.feels });
  if (evidence.pains?.length)
    empathySignals.push({ label: "Pains", items: evidence.pains });
  if (evidence.gains?.length)
    empathySignals.push({ label: "Gains", items: evidence.gains });

  return (
    <Card
      className={cn(
        "border-l-4 transition-all duration-500",
        evidence.isQuestion ? "border-l-blue-400" : "border-l-emerald-400",
        isNew && "slide-in-from-right-4 fade-in animate-in duration-500",
      )}
    >
      <CardContent className="space-y-3 p-4">
        {/* Header: gist + question badge + collapse button */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {evidence.isQuestion ? (
              <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            ) : (
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            )}
            <h4 className="font-semibold text-sm leading-tight">
              {evidence.gist}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            {evidence.anchors?.start_ms != null && (
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
                <Clock className="h-3 w-3" />
                {formatMs(evidence.anchors.start_ms)}
              </span>
            )}
            {compact && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded p-0.5 hover:bg-muted"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Verbatim quote */}
        {evidence.verbatim && (
          <blockquote className="border-muted border-l-2 pl-3 text-muted-foreground text-sm italic">
            &ldquo;{evidence.verbatim}&rdquo;
          </blockquote>
        )}

        {/* Speaker */}
        {evidence.person_key && (
          <p className="text-muted-foreground text-xs">
            Speaker:{" "}
            <span className="font-medium">
              {evidence.speaker_label || evidence.person_key}
            </span>
          </p>
        )}

        {/* Why it matters */}
        {evidence.why_it_matters && (
          <p className="text-muted-foreground text-xs">
            <span className="font-medium">Why it matters:</span>{" "}
            {evidence.why_it_matters}
          </p>
        )}

        {/* Empathy map signals */}
        {empathySignals.length > 0 && (
          <div className="space-y-1">
            {empathySignals.map((signal) => (
              <div key={signal.label} className="flex items-start gap-1.5">
                <span className="w-12 shrink-0 font-medium text-muted-foreground text-xs">
                  {signal.label}:
                </span>
                <span className="text-muted-foreground text-xs">
                  {signal.items.join("; ")}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Facet tags */}
        {facets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {facets.map((facet: FacetMention, i: number) => (
              <Badge
                key={`${facet.kind_slug}-${facet.value}-${i}`}
                variant="secondary"
                className={cn(
                  "px-1.5 py-0 text-xs",
                  FACET_COLORS[facet.kind_slug] || FACET_COLORS.context,
                )}
              >
                {facet.kind_slug}: {facet.value}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
