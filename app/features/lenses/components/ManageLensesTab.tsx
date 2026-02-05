/**
 * Manage Lenses Tab - Full-page lens management as a tab in the Analysis page
 *
 * Shows detailed info about each lens template: summary, sections, fields,
 * category, and enable/disable toggles. Replaces the old modal dialog.
 * Custom lens creation navigates to an inline creation flow (not a modal).
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
      return <FlaskConical className="h-5 w-5" />;
    case "sales":
      return <Briefcase className="h-5 w-5" />;
    case "product":
      return <Package className="h-5 w-5" />;
    default:
      return <Sparkles className="h-5 w-5" />;
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
      return "text-muted-foreground bg-muted";
  }
}

function getCategoryLabel(category: string | null) {
  switch (category) {
    case "research":
      return "Research";
    case "sales":
      return "Sales";
    case "product":
      return "Product";
    default:
      return "General";
  }
}

function LensTemplateCard({
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
  const entities = template.template_definition?.entities || [];
  const isPending = isSubmitting && pendingToggle === template.template_key;

  return (
    <Card className={!isEnabled ? "opacity-60" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`rounded-lg p-2 mt-0.5 flex-shrink-0 ${getCategoryColor(template.category)}`}
            >
              {getCategoryIcon(template.category)}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">
                {template.template_name}
              </CardTitle>
              {template.summary && (
                <CardDescription className="mt-1 line-clamp-2">
                  {template.summary}
                </CardDescription>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge variant="outline" className="text-xs">
                  {getCategoryLabel(template.category)}
                </Badge>
                {isCustom && (
                  <Badge variant="secondary" className="text-xs">
                    Custom
                  </Badge>
                )}
                {isCustom && !template.is_public && (
                  <Badge variant="outline" className="text-xs">
                    <EyeOff className="mr-1 h-3 w-3" />
                    Private
                  </Badge>
                )}
                {template.created_by_name && (
                  <span className="text-muted-foreground text-xs">
                    by {template.created_by_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
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
                    <DropdownMenuItem
                      disabled
                      className="text-muted-foreground"
                    >
                      Shared by team member
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Expandable sections detail */}
      {sections.length > 0 && (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <div className="px-6 pb-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                {sections.length} section{sections.length !== 1 ? "s" : ""}{" "}
                &middot; {totalFields} field{totalFields !== 1 ? "s" : ""}
                {entities.length > 0 && (
                  <>
                    {" "}
                    &middot; {entities.length} entit
                    {entities.length !== 1 ? "ies" : "y"}
                  </>
                )}
              </button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              {sections.map((section) => (
                <div
                  key={section.section_key}
                  className="rounded-lg border bg-muted/20 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {section.section_name}
                      </p>
                      {section.description && (
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {section.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {section.fields.map((field) => (
                      <Badge
                        key={field.field_key}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {field.field_name}
                        <span className="ml-1 text-muted-foreground">
                          ({field.field_type})
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}

              {entities.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Entity Extraction
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {entities.map((entity) => (
                      <Badge
                        key={entity}
                        variant="secondary"
                        className="text-xs"
                      >
                        {entity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {template.nlp_source && (
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="font-medium text-muted-foreground text-xs mb-1">
                    Original description
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    "{template.nlp_source}"
                  </p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
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

  // Sort: custom first, then by category
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
    <div className="space-y-6">
      {/* Header with stats and create button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            {enabledCount} of {templates.length} lenses enabled. Enabled lenses
            automatically analyze new conversations.
          </p>
        </div>
        <Button onClick={onCreateLens} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Custom Lens
        </Button>
      </div>

      {/* Custom lenses section */}
      {customTemplates.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Custom Lenses ({customTemplates.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customTemplates.map((template) => (
              <LensTemplateCard
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

      {/* System lenses section */}
      <div className="space-y-3">
        {customTemplates.length > 0 && (
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Built-in Lenses ({systemTemplates.length})
          </h3>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {systemTemplates.map((template) => (
            <LensTemplateCard
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

      {/* Edit lens dialog — keep as dialog since it's a quick edit */}
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
