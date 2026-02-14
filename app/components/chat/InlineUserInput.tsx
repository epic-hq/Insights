/**
 * InlineUserInput — renders interactive option selection inline inside a chat bubble.
 *
 * Used when the agent calls the requestUserInput tool. Renders radio buttons (single)
 * or checkboxes (multiple) that the user clicks to respond. After submission the
 * component disables itself and highlights the selected option(s).
 */

import {
  Check,
  CircleDot,
  MessageSquare,
  Square,
  SquareCheck,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface UserInputOption {
  id: string;
  label: string;
  description?: string;
}

export interface InlineUserInputProps {
  /** Question or instruction text */
  prompt: string;
  /** Available options */
  options: UserInputOption[];
  /** single = radio, multiple = checkboxes */
  selectionMode: "single" | "multiple";
  /** Show a free-text alternative input */
  allowFreeText?: boolean;
  /** Called when the user submits their selection */
  onSubmit: (selectedIds: string[], freeText?: string) => void;
  /** Whether this input has already been answered */
  answered?: boolean;
  /** Pre-filled answer IDs (shown when answered=true) */
  answeredIds?: string[];
}

export function InlineUserInput({
  prompt,
  options,
  selectionMode,
  allowFreeText = true,
  onSubmit,
  answered = false,
  answeredIds = [],
}: InlineUserInputProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [freeText, setFreeText] = useState("");
  const [showFreeText, setShowFreeText] = useState(false);
  const [submitted, setSubmitted] = useState(answered);

  const effectiveAnswered = submitted || answered;
  const effectiveIds =
    effectiveAnswered && answeredIds.length > 0
      ? new Set(answeredIds)
      : selectedIds;

  const toggleOption = useCallback(
    (id: string) => {
      if (effectiveAnswered) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (selectionMode === "single") {
          // Radio: clear others, set this one
          return new Set([id]);
        }
        // Checkbox: toggle
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      setShowFreeText(false);
    },
    [selectionMode, effectiveAnswered],
  );

  const handleSubmit = useCallback(() => {
    if (effectiveAnswered) return;
    if (showFreeText && freeText.trim()) {
      setSubmitted(true);
      onSubmit([], freeText.trim());
    } else if (selectedIds.size > 0) {
      setSubmitted(true);
      onSubmit(Array.from(selectedIds));
    }
  }, [effectiveAnswered, showFreeText, freeText, selectedIds, onSubmit]);

  const canSubmit = showFreeText
    ? freeText.trim().length > 0
    : selectedIds.size > 0;

  return (
    <div className="mt-2 space-y-2">
      {/* Prompt */}
      <p className="font-medium text-sm">{prompt}</p>

      {/* Options */}
      <div className="space-y-1.5">
        {options.map((option) => {
          const isSelected = effectiveIds.has(option.id);
          const Icon =
            selectionMode === "single"
              ? isSelected
                ? CircleDot
                : CircleDot
              : isSelected
                ? SquareCheck
                : Square;

          return (
            <button
              key={option.id}
              type="button"
              disabled={effectiveAnswered}
              onClick={() => toggleOption(option.id)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-all",
                effectiveAnswered
                  ? isSelected
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/40 bg-muted/30 text-muted-foreground opacity-60"
                  : isSelected
                    ? "border-primary/50 bg-primary/5 text-foreground shadow-sm"
                    : "border-border/60 bg-card/80 text-foreground hover:border-primary/30 hover:bg-primary/5",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 flex-shrink-0",
                  isSelected ? "text-primary" : "text-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1">
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </div>
              {effectiveAnswered && isSelected && (
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Free text toggle */}
      {allowFreeText && !effectiveAnswered && (
        <div className="space-y-1.5">
          {!showFreeText ? (
            <button
              type="button"
              onClick={() => {
                setShowFreeText(true);
                setSelectedIds(new Set());
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Type a custom response
            </button>
          ) : (
            <div className="space-y-1.5">
              <input
                type="text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) handleSubmit();
                }}
                placeholder="Type your response..."
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setShowFreeText(false);
                  setFreeText("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Back to options
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      {!effectiveAnswered && (
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-7 px-3 text-xs"
        >
          {showFreeText
            ? "Send"
            : selectionMode === "single"
              ? "Confirm"
              : `Confirm (${selectedIds.size})`}
        </Button>
      )}
    </div>
  );
}
