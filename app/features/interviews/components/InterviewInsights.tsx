/**
 * InterviewInsights — merged Key Takeaways (structured AI) + AI Takeaways (editable freeform).
 * Shows priority-badged takeaways from conversation analysis, plus an editable
 * AI summary with regenerate capability and user notes.
 */
import { MoreVertical, Sparkles, User } from "lucide-react";
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
import consola from "consola";

interface KeyTakeaway {
  priority: "high" | "medium" | "low";
  summary: string;
  evidenceSnippets: string[];
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
        <div className="space-y-3 rounded-lg border border-muted/60 bg-muted/40 p-4">
          <div className="flex items-center justify-between gap-4">
            <label className="font-semibold text-foreground text-lg">
              Key Takeaways
            </label>
            {conversationUpdatedLabel && (
              <span className="text-muted-foreground text-xs">
                Updated {conversationUpdatedLabel}
              </span>
            )}
          </div>
          <ul className="space-y-3">
            {aiKeyTakeaways.map((takeaway, index) => {
              const styles = badgeStylesForPriority(takeaway.priority);
              return (
                <li key={`${takeaway.summary}-${index}`} className="flex gap-3">
                  <Badge
                    variant={styles.variant}
                    color={styles.color}
                    className="mt-0.5 uppercase"
                  >
                    {takeaway.priority}
                  </Badge>
                  <div className="space-y-1">
                    <Streamdown className="prose prose-sm max-w-none text-foreground leading-snug [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {takeaway.summary}
                    </Streamdown>
                    {takeaway.evidenceSnippets.length > 0 && (
                      <p className="text-muted-foreground text-sm">
                        &ldquo;{takeaway.evidenceSnippets[0]}&rdquo;
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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
