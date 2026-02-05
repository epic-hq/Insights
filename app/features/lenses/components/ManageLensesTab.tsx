/**
 * Manage Lenses Tab - Compact lens management as a tab in the Analysis page.
 * Shows all lenses in a dense grid with toggle, summary, and expandable detail.
 */

import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FlaskConical,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Switch } from "~/components/ui/switch";
import { EditLensDialog } from "./EditLensDialog";
import type { LensTemplate } from "../lib/loadLensAnalyses.server";

type ManageLensesTabProps = {
  templates: LensTemplate[];
  enabledLenses: string[];
  accountId: string;
  userId: string | undefined;
  onCreateLens: () => void;
};

function getCategoryIcon(category: string | null) {
  switch (category) {
    case "research":
      return <FlaskConical className="h-4 w-4" />;
    case "sales":
      return <Briefcase className="h-4 w-4" />;
    case "product":
      return <Package className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function getCategoryColor(category: string | null) {
  switch (category) {
    case "research":
      return "text-purple-600 bg-purple-100 dark:bg-purple-950/30 dark:text-purple-300";
    case "sales":
      return "text-blue-600 bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300";
    case "product":
      return "text-green-600 bg-green-100 dark:bg-green-950/30 dark:text-green-300";
    default:
      return "text-foreground/70 bg-muted";
  }
}

function LensTemplateRow({
  template,
  isEnabled,
  isSubmitting,
  pendingToggle,
  isOwner,
  onToggle,
  onEdit,
  onDelete,
  onToggleVisibility,
}: {
  template: LensTemplate;
  isEnabled: boolean;
  isSubmitting: boolean;
  pendingToggle: string | null;
  isOwner: boolean;
  onToggle: (templateKey: string, enabled: boolean) => void;
  onEdit: (template: LensTemplate) => void;
  onDelete: (templateKey: string) => void;
  onToggleVisibility: (templateKey: string, isPublic: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCustom = !template.is_system;
  const sections = template.template_definition?.sections || [];
  const totalFields = sections.reduce(
    (sum, s) => sum + (s.fields?.length || 0),
    0,
  );
  const isPending = isSubmitting && pendingToggle === template.template_key;

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${!isEnabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`rounded-md p-1.5 flex-shrink-0 ${getCategoryColor(template.category)}`}
          >
            {getCategoryIcon(template.category)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {template.template_name}
              </span>
              {isCustom && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Custom
                </Badge>
              )}
              {isCustom && !template.is_public && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Private
                </Badge>
              )}
            </div>
            {template.summary && (
              <p className="text-xs text-foreground/60 truncate mt-0.5">
                {template.summary}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {sections.length > 0 && (
            <span className="text-xs text-foreground/50 hidden sm:inline">
              {sections.length}s &middot; {totalFields}f
            </span>
          )}
          {isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/40" />
          )}
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) =>
              onToggle(template.template_key, checked)
            }
            disabled={isPending}
            aria-label={`${isEnabled ? "Disable" : "Enable"} ${template.template_name}`}
          />
          {isCustom && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner ? (
                  <>
                    <DropdownMenuItem onClick={() => onEdit(template)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        onToggleVisibility(
                          template.template_key,
                          !template.is_public,
                        )
                      }
                    >
                      {template.is_public ? (
                        <>
                          <EyeOff className="mr-2 h-4 w-4" />
                          Make Private
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" />
                          Share with Team
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(template.template_key)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem disabled className="text-foreground/50">
                    Shared by team member
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {sections.length > 0 && (
            <Collapsible open={expanded} onOpenChange={setExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Expandable detail */}
      {sections.length > 0 && expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {sections.map((section) => (
            <div key={section.section_key}>
              <p className="text-xs font-medium">{section.section_name}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {section.fields.map((field) => (
                  <Badge
                    key={field.field_key}
                    variant="outline"
                    className="text-[10px] font-normal py-0"
                  >
                    {field.field_name}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ManageLensesTab({
  templates,
  enabledLenses: initialEnabled,
  accountId,
  userId,
  onCreateLens,
}: ManageLensesTabProps) {
  const fetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const visibilityFetcher = useFetcher();
  const revalidator = useRevalidator();
  const [editingTemplate, setEditingTemplate] = useState<LensTemplate | null>(
    null,
  );

  const pendingToggle = fetcher.formData?.get("toggle_lens") as string | null;
  const isSubmitting = fetcher.state === "submitting";

  const enabledLenses = (() => {
    if (pendingToggle && fetcher.formData) {
      const enabled = fetcher.formData.get("enabled") === "true";
      if (enabled) return [...initialEnabled, pendingToggle];
      return initialEnabled.filter((key) => key !== pendingToggle);
    }
    return initialEnabled;
  })();

  const sortedTemplates = [...templates].sort((a, b) => {
    if (a.is_system !== b.is_system) return a.is_system ? 1 : -1;
    const catOrder = ["sales", "research", "product"];
    const orderA =
      catOrder.indexOf(a.category || "") === -1
        ? catOrder.length
        : catOrder.indexOf(a.category || "");
    const orderB =
      catOrder.indexOf(b.category || "") === -1
        ? catOrder.length
        : catOrder.indexOf(b.category || "");
    if (orderA !== orderB) return orderA - orderB;
    return a.template_name.localeCompare(b.template_name);
  });

  const systemTemplates = sortedTemplates.filter((t) => t.is_system);
  const customTemplates = sortedTemplates.filter((t) => !t.is_system);
  const enabledCount = enabledLenses.filter((key) =>
    templates.some((t) => t.template_key === key),
  ).length;

  const handleToggle = (templateKey: string, enabled: boolean) => {
    const newEnabled = enabled
      ? [...initialEnabled, templateKey]
      : initialEnabled.filter((key) => key !== templateKey);

    fetcher.submit(
      {
        intent: "update_lens_settings",
        enabled_lenses: JSON.stringify(newEnabled),
        apply_to_existing: "false",
        toggle_lens: templateKey,
        enabled: String(enabled),
      },
      { method: "post" },
    );
  };

  const handleDelete = (templateKey: string) => {
    if (!confirm("Delete this custom lens? This cannot be undone.")) return;

    deleteFetcher.submit(
      {
        intent: "delete",
        template_key: templateKey,
        account_id: accountId,
      },
      { method: "POST", action: "/api/lens-templates" },
    );
  };

  const handleToggleVisibility = (templateKey: string, isPublic: boolean) => {
    visibilityFetcher.submit(
      {
        intent: "update",
        template_key: templateKey,
        account_id: accountId,
        is_public: String(isPublic),
      },
      { method: "POST", action: "/api/lens-templates" },
    );
  };

  const handleLensUpdated = () => {
    revalidator.revalidate();
    setEditingTemplate(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm">
          {enabledCount} of {templates.length} lenses enabled
        </p>
        <Button onClick={onCreateLens} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Create Lens
        </Button>
      </div>

      {/* Custom lenses */}
      {customTemplates.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-xs uppercase tracking-wide text-foreground/50">
            Custom ({customTemplates.length})
          </h3>
          <div className="space-y-2">
            {customTemplates.map((template) => (
              <LensTemplateRow
                key={template.template_key}
                template={template}
                isEnabled={enabledLenses.includes(template.template_key)}
                isSubmitting={isSubmitting}
                pendingToggle={pendingToggle}
                isOwner={template.created_by === userId}
                onToggle={handleToggle}
                onEdit={setEditingTemplate}
                onDelete={handleDelete}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </div>
        </div>
      )}

      {/* Built-in lenses */}
      <div className="space-y-2">
        {customTemplates.length > 0 && (
          <h3 className="font-medium text-xs uppercase tracking-wide text-foreground/50">
            Built-in ({systemTemplates.length})
          </h3>
        )}
        <div className="space-y-2">
          {systemTemplates.map((template) => (
            <LensTemplateRow
              key={template.template_key}
              template={template}
              isEnabled={enabledLenses.includes(template.template_key)}
              isSubmitting={isSubmitting}
              pendingToggle={pendingToggle}
              isOwner={false}
              onToggle={handleToggle}
              onEdit={setEditingTemplate}
              onDelete={handleDelete}
              onToggleVisibility={handleToggleVisibility}
            />
          ))}
        </div>
      </div>

      {editingTemplate && (
        <EditLensDialog
          open={!!editingTemplate}
          onOpenChange={(open) => !open && setEditingTemplate(null)}
          template={editingTemplate}
          accountId={accountId}
          onUpdated={handleLensUpdated}
        />
      )}
    </div>
  );
}
