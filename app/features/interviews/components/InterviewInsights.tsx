/**
 * InterviewInsights — merged Key Takeaways (structured AI) + AI Takeaways (editable freeform).
 * Shows priority-badged takeaways from conversation analysis with "See source" links,
 * plus an editable AI summary with regenerate capability and user notes.
 */

import consola from "consola";
import { ArrowRight, MoreVertical, Sparkles, User } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Streamdown } from "streamdown";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import InlineEdit from "~/components/ui/inline-edit";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

interface KeyTakeaway {
  priority: "high" | "medium" | "low";
  summary: string;
  evidenceSnippets: string[];
  /** Optional evidence ID to link to */
  evidenceId?: string;
}

interface InterviewInsightsProps {
  interviewId: string;
  accountId: string;
  projectId: string;
  /** Structured takeaways from conversation analysis */
  aiKeyTakeaways: KeyTakeaway[];
  /** When the conversation analysis was last updated (formatted) */
  conversationUpdatedLabel: string | null;
  /** Freeform AI takeaways text (editable) */
  keyTakeaways: string;
  /** User observation notes (editable) */
  observationsAndNotes: string;
  onFieldUpdate: (field: string, value: string) => void;
}

function badgeStylesForPriority(priority: "high" | "medium" | "low"): {
  variant: "default" | "secondary" | "destructive" | "outline";
  color?: "blue" | "green" | "red" | "purple" | "yellow" | "orange" | "indigo";
} {
  switch (priority) {
    case "high":
      return { variant: "destructive", color: "red" };
    case "medium":
      return { variant: "secondary", color: "orange" };
    default:
      return { variant: "outline", color: "green" };
  }
}

// Normalize potentially awkwardly stored text fields (array, JSON string, or plain string)
function normalizeMultilineText(value: unknown): string {
  try {
    if (Array.isArray(value)) {
      const lines = value.filter(
        (v) => typeof v === "string" && v.trim(),
      ) as string[];
      return lines
        .map((line) => {
          const t = (typeof line === "string" ? line : String(line)).trim();
          if (/^([-*+]|\d+\.)\s+/.test(t)) return t;
          return `- ${t}`;
        })
        .join("\n");
    }
    if (typeof value === "string") {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const lines = parsed.filter(
          (v) => typeof v === "string" && v.trim(),
        ) as string[];
        return lines
          .map((line) => {
            const t = (typeof line === "string" ? line : String(line)).trim();
            if (/^([-*+]|\d+\.)\s+/.test(t)) return t;
            return `- ${t}`;
          })
          .join("\n");
      }
      return value;
    }
    return "";
  } catch {
    return typeof value === "string" ? value : "";
  }
}

export function InterviewInsights({
  interviewId,
  accountId,
  projectId,
  aiKeyTakeaways,
  conversationUpdatedLabel,
  keyTakeaways,
  observationsAndNotes,
  onFieldUpdate,
}: InterviewInsightsProps) {
  const fetcher = useFetcher();
  const [regeneratePopoverOpen, setRegeneratePopoverOpen] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState("");

  const normalizedKeyTakeaways = normalizeMultilineText(keyTakeaways);
  const normalizedNotes = normalizeMultilineText(observationsAndNotes);

  return (
    <div className="space-y-4">
      {/* Structured AI Key Takeaways */}
      {aiKeyTakeaways.length > 0 && (
        <div className="space-y-3 rounded-lg border border-muted/60 bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <label className="font-semibold text-foreground text-lg">
                Key Insights
              </label>
            </div>
            {conversationUpdatedLabel && (
              <span className="text-muted-foreground text-xs">
                Updated {conversationUpdatedLabel}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {aiKeyTakeaways.map((takeaway, index) => {
              const borderColor =
                takeaway.priority === "high"
                  ? "border-l-red-500"
                  : takeaway.priority === "medium"
                    ? "border-l-amber-500"
                    : "border-l-blue-500";
              const badgeColor =
                takeaway.priority === "high"
                  ? "bg-red-500/10 text-red-600"
                  : takeaway.priority === "medium"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-blue-500/10 text-blue-600";

              return (
                <div
                  key={`${takeaway.summary}-${index}`}
                  className={cn(
                    "flex gap-3 rounded-r-lg border-l-3 bg-muted/20 p-3",
                    borderColor,
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded px-2 py-0.5 font-semibold text-[11px] uppercase tracking-wide",
                      badgeColor,
                    )}
                  >
                    {takeaway.priority}
                  </span>
                  <div className="flex-1 space-y-2">
                    <Streamdown className="prose prose-sm max-w-none text-foreground leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {takeaway.summary}
                    </Streamdown>
                    {takeaway.evidenceId && (
                      <a
                        href={`#evidence-${takeaway.evidenceId}`}
                        className="inline-flex items-center gap-1 text-primary text-sm transition-colors hover:text-primary/80"
                      >
                        See source
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Takeaways (editable freeform) */}
      <div>
        <label className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold text-foreground text-lg">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Takeaways
          </span>
          <Popover
            open={regeneratePopoverOpen}
            onOpenChange={setRegeneratePopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={fetcher.state !== "idle"}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-4">
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 font-medium text-sm">
                    {normalizedKeyTakeaways ? "Regenerate" : "Generate"}{" "}
                    takeaways
                  </h4>
                  <p className="mb-3 text-muted-foreground text-xs">
                    Optional: add a quick hint.
                  </p>
                </div>
                <Textarea
                  placeholder="e.g., Focus on objections"
                  className="min-h-[80px] text-sm"
                  value={regenerateInstructions}
                  onChange={(event) =>
                    setRegenerateInstructions(event.currentTarget.value)
                  }
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const instructions = regenerateInstructions.trim();
                    const payload: Record<string, string> = {
                      interview_id: interviewId,
                    };
                    if (instructions.length) {
                      payload.custom_instructions = instructions;
                    }
                    fetcher.submit(payload, {
                      method: "post",
                      action: "/api/regenerate-ai-summary",
                    });
                    setRegeneratePopoverOpen(false);
                  }}
                >
                  {normalizedKeyTakeaways ? "Regenerate" : "Generate"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </label>
        <InlineEdit
          textClassName="text-foreground"
          value={normalizedKeyTakeaways}
          multiline
          markdown
          placeholder="No AI takeaways yet. Use Generate in the menu to create one."
          onSubmit={(value) => {
            try {
              onFieldUpdate("key_takeaways", value);
            } catch (error) {
              consola.error("Failed to update key_takeaways:", error);
            }
          }}
        />
      </div>

      {/* User Notes */}
      <div>
        <label className="mb-2 flex items-center gap-2 font-semibold text-foreground text-lg">
          <User className="h-5 w-5" />
          User Notes
        </label>
        <InlineEdit
          textClassName="text-foreground"
          value={normalizedNotes}
          multiline
          markdown
          onSubmit={(value) => {
            try {
              onFieldUpdate("observations_and_notes", value);
            } catch (error) {
              consola.error("Failed to update observations_and_notes:", error);
            }
          }}
        />
      </div>
    </div>
  );
}
