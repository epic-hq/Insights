/**
 * CapturedPane - Collapsible panel showing captured and uncaptured fields
 *
 * Redesigned per unified-onboarding-ui-spec.md (lines 379-417):
 * - Shows BOTH captured AND uncaptured fields (not hidden when empty)
 * - Uncaptured fields show "Ask about this" buttons
 * - Tabs for Company vs Project data separation
 * - Collapsed state shows progress summary with expand button
 * - Expanded state shows full field details in sidebar/bottom sheet
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  Pencil,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Field definition for captured/uncaptured display
 */
export interface CapturedField {
  key: string;
  label: string;
  value: string | string[] | null;
  required?: boolean;
  /** Which category this field belongs to */
  category?: "company" | "project";
  /** Description shown for uncaptured fields */
  description?: string;
  /** Source text showing where this was captured from */
  sourceText?: string;
}

interface CapturedPaneProps {
  fields: CapturedField[];
  className?: string;
  /** Callback when user clicks "Ask about this" for an uncaptured field */
  onAskAboutField?: (fieldKey: string) => void;
  /** Callback when user wants to edit a captured field */
  onEditField?: (fieldKey: string) => void;
  /** Whether to show company/project tabs (default: true if both categories present) */
  showTabs?: boolean;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Display variant: "floating" (fixed bottom-right) or "sidebar" (static card, always expanded) */
  variant?: "floating" | "sidebar";
}

function hasValue(value: string | string[] | null): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

function formatValue(value: string | string[] | null): string {
  if (!hasValue(value)) return "";
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (value.length <= 3) return value.join(", ");
    return `${value.slice(0, 3).join(", ")} +${value.length - 3} more`;
  }
  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 80)}...` : value;
  }
  return "";
}

/**
 * Tag display for array values
 */
function TagList({
  values,
  maxVisible = 3,
}: {
  values: string[];
  maxVisible?: number;
}) {
  const visible = values.slice(0, maxVisible);
  const remaining = values.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-medium text-foreground text-xs"
        >
          {tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-muted-foreground text-xs">+{remaining} more</span>
      )}
    </div>
  );
}

/**
 * Single captured field card
 */
function CapturedFieldCard({
  field,
  onEdit,
}: {
  field: CapturedField;
  onEdit?: () => void;
}) {
  const isArray = Array.isArray(field.value);

  return (
    <div className="group rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 transition-colors hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950/30 dark:hover:border-emerald-700">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground text-sm">
              {field.label}
            </p>
            <div className="mt-1.5">
              {isArray &&
              Array.isArray(field.value) &&
              field.value.length > 0 ? (
                <TagList values={field.value} />
              ) : (
                <p className="text-foreground/90 text-sm leading-relaxed">
                  {formatValue(field.value)}
                </p>
              )}
            </div>
            {field.sourceText && (
              <p className="mt-2 text-muted-foreground/70 text-xs italic">
                From: "{field.sourceText}"
              </p>
            )}
          </div>
        </div>
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit {field.label}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Single uncaptured field prompt - muted appearance to emphasize captured fields
 */
function UncapturedFieldCard({
  field,
  onAsk,
}: {
  field: CapturedField;
  onAsk?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/40 border-dashed bg-muted/20 p-3 opacity-70 transition-opacity hover:opacity-100">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/40 bg-background">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-muted-foreground text-sm">
            {field.label}
          </p>
          {field.description && (
            <p className="mt-0.5 text-muted-foreground/70 text-xs">
              {field.description}
            </p>
          )}
          {onAsk && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAsk}
              className="mt-2 h-7 gap-1.5 px-2 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Add now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Progress dots for collapsed state
 */
function ProgressDots({ fields }: { fields: CapturedField[] }) {
  return (
    <div className="flex items-center gap-1">
      {fields.slice(0, 8).map((field) => (
        <div
          key={field.key}
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            hasValue(field.value) ? "bg-emerald-500" : "bg-muted-foreground/30",
          )}
          title={`${field.label}: ${hasValue(field.value) ? "Captured" : "Not captured"}`}
        />
      ))}
      {fields.length > 8 && (
        <span className="ml-1 text-muted-foreground text-xs">
          +{fields.length - 8}
        </span>
      )}
    </div>
  );
}

export function CapturedPane({
  fields,
  className,
  onAskAboutField,
  onEditField,
  showTabs,
  defaultExpanded = false,
  variant = "floating",
}: CapturedPaneProps) {
  const isSidebar = variant === "sidebar";
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<"company" | "project">("company");

  // Separate fields by category
  const companyFields = fields.filter((f) => f.category === "company");
  const projectFields = fields.filter((f) => f.category === "project");
  const uncategorizedFields = fields.filter((f) => !f.category);

  // Determine if we should show tabs
  const hasBothCategories =
    companyFields.length > 0 && projectFields.length > 0;
  const shouldShowTabs = showTabs ?? hasBothCategories;

  // Get fields to display based on active tab
  const displayFields = shouldShowTabs
    ? activeTab === "company"
      ? companyFields
      : projectFields
    : [...companyFields, ...projectFields, ...uncategorizedFields];

  const capturedFields = displayFields.filter((f) => hasValue(f.value));
  const uncapturedFields = displayFields.filter((f) => !hasValue(f.value));

  // Overall counts
  const totalCaptured = fields.filter((f) => hasValue(f.value)).length;
  const totalFields = fields.length;
  const progressPercent =
    totalFields > 0 ? Math.round((totalCaptured / totalFields) * 100) : 0;

  // Shared content for both variants
  const renderContent = () => (
    <>
      {/* Tabs (if showing both categories) */}
      {shouldShowTabs && (
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setActiveTab("company")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-4 py-2 font-medium text-sm transition-colors",
              activeTab === "company"
                ? "border-primary border-b-2 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            Company
            <span className="text-xs opacity-60">
              ({companyFields.filter((f) => hasValue(f.value)).length}/
              {companyFields.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("project")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-4 py-2 font-medium text-sm transition-colors",
              activeTab === "project"
                ? "border-primary border-b-2 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Project
            <span className="text-xs opacity-60">
              ({projectFields.filter((f) => hasValue(f.value)).length}/
              {projectFields.length})
            </span>
          </button>
        </div>
      )}

      {/* Content */}
      <div className={cn("overflow-y-auto p-4", !isSidebar && "max-h-[60vh]")}>
        {/* Captured Section */}
        {capturedFields.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Captured
            </h3>
            <div className="space-y-2">
              {capturedFields.map((field) => (
                <CapturedFieldCard
                  key={field.key}
                  field={field}
                  onEdit={
                    onEditField ? () => onEditField(field.key) : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Uncaptured Section */}
        {uncapturedFields.length > 0 && (
          <div>
            <h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Not Yet Captured
            </h3>
            <div className="space-y-2">
              {uncapturedFields.map((field) => (
                <UncapturedFieldCard
                  key={field.key}
                  field={field}
                  onAsk={
                    onAskAboutField
                      ? () => onAskAboutField(field.key)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* All captured state */}
        {capturedFields.length === displayFields.length &&
          displayFields.length > 0 && (
            <div className="rounded-lg bg-emerald-50 p-4 text-center dark:bg-emerald-950/30">
              <Check className="mx-auto mb-2 h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium text-emerald-700 text-sm dark:text-emerald-300">
                {shouldShowTabs
                  ? `All ${activeTab} fields captured`
                  : "All fields captured"}
              </p>
            </div>
          )}

        {/* Empty state */}
        {displayFields.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No fields configured
          </div>
        )}
      </div>
    </>
  );

  // Sidebar variant: static card, always expanded, with progress bar
  if (isSidebar) {
    return (
      <div
        className={cn("overflow-hidden rounded-xl border bg-card", className)}
      >
        {/* Header with progress bar */}
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">
              Context
            </span>
            <span className="text-muted-foreground text-xs">
              {totalCaptured}/{totalFields} fields
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        {renderContent()}
      </div>
    );
  }

  // Floating variant: original behavior with collapse/expand
  return (
    <div className={cn("fixed right-6 bottom-6 z-50", className)}>
      <AnimatePresence mode="wait">
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-80 overflow-hidden rounded-xl border bg-card/95 shadow-xl backdrop-blur-sm sm:w-96"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">
                  Context
                </span>
                <span className="text-muted-foreground text-xs">
                  {totalCaptured}/{totalFields} fields
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
                className="h-7 w-7 p-0"
                aria-expanded={expanded}
                aria-label="Hide context panel"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
            {renderContent()}
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            type="button"
            onClick={() => setExpanded(true)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg transition-all",
              "bg-card/95 backdrop-blur-sm hover:shadow-xl",
              totalCaptured === totalFields &&
                totalFields > 0 &&
                "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50",
            )}
            aria-expanded={expanded}
            aria-label={`Context: ${totalCaptured} of ${totalFields} fields captured. Click to expand.`}
          >
            <span className="font-medium text-sm">Context</span>
            <span className="text-muted-foreground text-xs">
              {totalCaptured}/{totalFields}
            </span>
            <ProgressDots fields={fields} />
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
