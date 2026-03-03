/**
 * UnifiedQuestionRow — shared question row for interview guides and surveys.
 * Renders: grip handle · number · flag dot · text · metadata slots · optional drop-off bar.
 * Context-specific metadata (category tag, type badge, time, etc.) passed via slots.
 */
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export interface UnifiedQuestionRowProps {
  /** Display index (1-based) */
  index: number;
  /** Question text */
  text: string;
  /** Whether this row is currently selected/active */
  isSelected?: boolean;
  /** Click handler (typically opens drawer) */
  onClick?: () => void;
  /** Drag handle render prop — pass DnD handle props here */
  dragHandleProps?: Record<string, unknown>;
  /** Optional coaching flag color */
  flag?: "green" | "amber" | "red";
  /** Whether to show the row as highlighted (e.g. newly inserted) */
  highlighted?: boolean;
  /** Right-side metadata slots */
  children?: ReactNode;
  /** Optional className override */
  className?: string;
}

export function UnifiedQuestionRow({
  index,
  text,
  isSelected,
  onClick,
  dragHandleProps,
  flag,
  highlighted,
  children,
  className,
}: UnifiedQuestionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all",
        isSelected
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/40 bg-background hover:border-border/80 hover:bg-muted/30",
        highlighted && "border-green-500/40 bg-green-500/5",
        className,
      )}
    >
      {/* Drag handle */}
      <span
        {...(dragHandleProps as React.HTMLAttributes<HTMLSpanElement>)}
        className="shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <GripVertical className="h-4 w-4" />
      </span>

      {/* Question number */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted font-semibold text-foreground/60 text-xs tabular-nums">
        {index}
      </span>

      {/* Coaching flag dot */}
      {flag && (
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            flag === "green" && "bg-green-500",
            flag === "amber" && "bg-amber-500",
            flag === "red" && "bg-red-500",
          )}
        />
      )}

      {/* Question text */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          text ? "text-foreground" : "text-muted-foreground italic",
        )}
      >
        {text || "Untitled question"}
      </span>

      {/* Right-side metadata (badges, time, indicators) */}
      {children && (
        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      )}
    </button>
  );
}

/** Reusable badge for question type */
export function QuestionTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    auto: "Auto",
    short_text: "Short text",
    long_text: "Long text",
    single_select: "Select one",
    multi_select: "Select many",
    likert: "Likert",
    image_select: "Image select",
  };
  const label = labels[type] ?? type;
  if (type === "auto") return null;
  return (
    <Badge variant="secondary" className="px-1.5 py-0 font-normal text-[10px]">
      {label}
    </Badge>
  );
}

/** Reusable badge for question category (interview guides) */
export function QuestionCategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="secondary" className="px-1.5 py-0 font-normal text-[10px]">
      {category}
    </Badge>
  );
}

/** Time estimate display */
export function QuestionTimeEstimate({
  seconds,
  warn,
}: {
  seconds: number;
  warn?: boolean;
}) {
  const label =
    seconds >= 60 ? `~${Math.round(seconds / 60)}m` : `~${seconds}s`;
  return (
    <span
      className={cn(
        "font-mono text-[10px] tabular-nums",
        warn ? "text-amber-500" : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
