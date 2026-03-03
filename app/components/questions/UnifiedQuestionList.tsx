/**
 * UnifiedQuestionList — renders a list of question rows with time estimation bar.
 * Wraps UnifiedQuestionRow with add-question, copy-to-clipboard, and total time display.
 * Used by both survey and interview guide editors.
 */
import { ClipboardCopy, Loader2, Plus, Sparkles, X } from "lucide-react";
import { type ReactNode, useState } from "react";
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
  /** Whether coaching has been run at least once (to toggle nudge vs re-coach) */
  hasBeenCoached?: boolean;
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
  hasBeenCoached = false,
  footer,
  className,
}: UnifiedQuestionListProps) {
  const totalSeconds = questionTypes ? estimateTotalSeconds(questionTypes) : 0;
  const isLong = totalSeconds > SURVEY_LENGTH_WARN_SECONDS;
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const showNudge = !nudgeDismissed && !hasBeenCoached && count >= 5 && onCoach;

  return (
    <div className={cn("space-y-1", className)}>
      {/* Coach nudge banner — shown above questions when 5+ and not yet coached */}
      {showNudge && (
        <div className="mb-2 rounded-lg border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-blue-500/10 px-3 py-2.5 dark:from-violet-500/15 dark:to-blue-500/15 dark:border-violet-500/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-violet-500 animate-pulse" />
              <span className="text-sm text-violet-700 dark:text-violet-300">
                You have {count} questions
              </span>
              {showTimeBar && questionTypes && (
                <span
                  className={cn(
                    "text-xs",
                    isLong
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-violet-500/70 dark:text-violet-400/70",
                  )}
                >
                  · {formatEstimate(totalSeconds)}
                  {isLong && " · consider trimming"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-7 bg-violet-600 px-3 text-xs text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
                onClick={onCoach}
                disabled={isCoaching}
              >
                {isCoaching ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isCoaching ? "Coaching..." : "Coach my questions"}
              </Button>
              <button
                type="button"
                onClick={() => setNudgeDismissed(true)}
                className="rounded p-0.5 text-violet-400 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coach button + time estimate — shown after coaching or when nudge dismissed */}
      {!showNudge &&
        count > 0 &&
        (onCoach || (showTimeBar && questionTypes)) && (
          <div className="mb-2 flex items-center justify-between">
            {showTimeBar && questionTypes ? (
              <span
                className={cn(
                  "text-xs",
                  isLong
                    ? "font-semibold text-amber-500"
                    : "text-muted-foreground",
                )}
              >
                {formatEstimate(totalSeconds)}
                {isLong && " · consider trimming"}
              </span>
            ) : (
              <span />
            )}
            {onCoach && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-blue-500/10 text-violet-700 hover:from-violet-500/20 hover:to-blue-500/20 dark:from-violet-500/15 dark:to-blue-500/15 dark:text-violet-300 dark:border-violet-500/30"
                onClick={onCoach}
                disabled={isCoaching}
              >
                {isCoaching ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-violet-500" />
                )}
                {isCoaching
                  ? "Coaching..."
                  : hasBeenCoached
                    ? "Re-coach"
                    : "Coach my questions"}
              </Button>
            )}
          </div>
        )}

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

      {footer}
    </div>
  );
}
