/**
 * Inline editable field for person details
 * Uses the people-specific update-inline API endpoint
 */
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router-dom";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";

interface PersonInlineEditableFieldProps {
  value: string | null | undefined;
  personId: string;
  field: string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
}

export function PersonInlineEditableField({
  value,
  personId,
  field,
  placeholder = "—",
  className,
  multiline = false,
  rows = 3,
}: PersonInlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const [isSaving, setIsSaving] = useState(false);
  // Track saved value for optimistic display
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath || "");
  const revalidator = useRevalidator();

  // Clear optimistic value when real value catches up
  useEffect(() => {
    if (optimisticValue !== null && value === optimisticValue) {
      setOptimisticValue(null);
    }
    // Also update edit value when prop changes (for external updates)
    if (!isEditing && optimisticValue === null) {
      setEditValue(value ?? "");
    }
  }, [value, optimisticValue, isEditing]);

  // Display value: use optimistic if available, otherwise use prop
  const displayValue = optimisticValue ?? value;

  useEffect(() => {
    if (isEditing) {
      if (multiline) {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [isEditing, multiline]);

  const handleSave = async () => {
    if (editValue === (value ?? "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `${routes.people.index()}/api/update-inline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            personId,
            field,
            value: editValue || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      // Set optimistic value so it displays immediately
      setOptimisticValue(editValue || null);
      setIsEditing(false);
      revalidator.revalidate();
    } catch (error) {
      console.error("Failed to save:", error);
      setEditValue(value ?? "");
      setOptimisticValue(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setEditValue(value ?? "");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="relative">
        {multiline ? (
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            rows={rows}
            disabled={isSaving}
            className={cn("resize-none", className)}
          />
        ) : (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className={className}
          />
        )}
        {isSaving && (
          <Loader2 className="absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        "group flex w-full items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/50",
        !displayValue && "text-muted-foreground",
        className,
      )}
    >
      <span className="flex-1">{displayValue || placeholder}</span>
      <Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </button>
  );
}
