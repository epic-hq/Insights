/**
 * UnifiedQuestionList — renders a list of question rows with time estimation bar.
 * Wraps UnifiedQuestionRow with add-question, copy-to-clipboard, and total time display.
 * Used by both survey and interview guide editors.
 */
import { ClipboardCopy, Loader2, Plus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  SURVEY_LENGTH_WARN_SECONDS,
  estimateTotalSeconds,
  formatEstimate,
} from "./coaching/time-estimates";

export interface UnifiedQuestionListProps {
  /** Render each question row — receives index */
  children: ReactNode;
  /** Total number of questions (for empty state) */
  count: number;
  /** Question types for time estimation (e.g. ["long_text", "likert"]) */
  questionTypes?: string[];
  /** Show time estimation bar (typically for surveys) */
  showTimeBar?: boolean;
  /** Called when "Add question" is clicked */
  onAdd: () => void;
  /** Called when "Copy" is clicked — pass formatted text */
  onCopy?: () => void;
  /** Called when "Coach" is clicked — triggers AI coaching */
  onCoach?: () => void;
  /** Whether coaching is in progress */
  isCoaching?: boolean;
  /** Optional footer content (e.g. validation errors) */
  footer?: ReactNode;
  /** Optional className */
  className?: string;
}

export function UnifiedQuestionList({
  children,
  count,
  questionTypes,
  showTimeBar = false,
  onAdd,
  onCopy,
  onCoach,
  isCoaching = false,
  footer,
  className,
}: UnifiedQuestionListProps) {
  const totalSeconds = questionTypes ? estimateTotalSeconds(questionTypes) : 0;
  const isLong = totalSeconds > SURVEY_LENGTH_WARN_SECONDS;

  return (
    <div className={cn("space-y-1", className)}>
      {/* Question rows */}
      {children}

      {/* Action bar: Add + Copy */}
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 border-border/60 border-dashed bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
          onClick={onAdd}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add question
        </Button>
        {count > 0 && onCoach && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onCoach}
            disabled={isCoaching}
          >
            {isCoaching ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isCoaching ? "Coaching..." : "Coach"}
          </Button>
        )}
        {count > 0 && onCopy && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onCopy}
          >
            <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" /> Copy
          </Button>
        )}
      </div>

      {/* Time estimation bar */}
      {showTimeBar && count > 0 && questionTypes && (
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Estimated response time</span>
          <span
            className={cn(
              "font-semibold",
              isLong ? "text-amber-500" : "text-muted-foreground",
            )}
          >
            {formatEstimate(totalSeconds)}
            {isLong && " · consider trimming"}
          </span>
        </div>
      )}

      {footer}
    </div>
  );
}
