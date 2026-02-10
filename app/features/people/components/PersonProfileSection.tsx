/**
 * PersonProfileSection - Compact profile view with demographics, attribute lenses, and organizations
 *
 * Replaces the old PersonProfileTab with a read-only compact mode that can toggle into
 * inline editing for demographics. Attribute lenses show as collapsible one-liners with
 * AI summaries, expanding to reveal full facet details. Organizations appear as a compact
 * inline list with links and primary badges.
 */

import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  BarChart3,
  Box,
  Boxes,
  Building2,
  ChevronRight,
  Heart,
  Image,
  Layers,
  Pencil,
  PersonStanding,
  Plus,
  Sparkles,
  Target,
  User2,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { LinkOrganizationDialog } from "~/components/dialogs/LinkOrganizationDialog";
import { InlineEditableField } from "~/components/InlineEditableField";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  COMPANY_SIZE_RANGES,
  getOptionLabel,
  INDUSTRIES,
  JOB_FUNCTIONS,
  SENIORITY_LEVELS,
} from "~/lib/constants/options";
import { cn } from "~/lib/utils";
import { PersonContactSection } from "./PersonContactSection";
import { PersonFacetLenses } from "./PersonFacetLenses";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** Facet entry within a lens group */
interface FacetEntry {
  facet_account_id: number;
  label: string;
  source: string | null;
  confidence: number | null;
  kind_slug: string;
}

/** Facet lens group with AI summary */
interface FacetGroupLens {
  kind_slug: string;
  label: string;
  summary?: string | null;
  facets: FacetEntry[];
}

/** Available facet for adding to a person */
interface AvailableFacet {
  id: number;
  label: string;
  slug: string;
}

/** Linked organization relationship */
interface LinkedOrganization {
  id: number | string;
  is_primary?: boolean;
  job_title?: string | null;
  organization?: {
    id: string;
    name: string | null;
  } | null;
}

interface PersonProfileSectionProps {
  /** Core person data for demographics and editing */
  person: {
    id: string;
    job_function: string | null;
    seniority_level: string | null;
    industry: string | null;
    primary_email: string | null;
    primary_phone: string | null;
    linkedin_url: string | null;
    contact_info: Record<string, string> | null;
  };
  /** Primary org for fallback industry and company size */
  primaryOrg: {
    id: string;
    industry: string | null;
    size_range: string | null;
  } | null;
  /** Attribute lens groups (Pain, Goals, Workflow, etc.) */
  facetLensGroups: FacetGroupLens[];
  /** Available facets keyed by kind slug for adding signals */
  availableFacetsByKind: Record<string, AvailableFacet[]>;
  /** Whether AI summaries are currently regenerating */
  isGenerating?: boolean;
  /** Person scale data (e.g. ICP match scores) */
  personScale?: Array<{
    kind_slug: string;
    score: number;
    band: string | null;
    confidence: number | null;
  }> | null;
  /** Sorted linked organizations for display */
  sortedLinkedOrganizations: LinkedOrganization[];
  /** Route helpers for navigation */
  routes: {
    organizations: { detail: (id: string) => string };
  };
  /** All available organizations for the link dialog */
  availableOrganizations?: Array<{
    id: string;
    name: string;
    headquarters_location?: string | null;
  }>;
}

// ────────────────────────────────────────────────────────────────────────────
// Icon map for lens kinds (mirrors PersonFacetLenses.tsx)
// ────────────────────────────────────────────────────────────────────────────

const KIND_ICON_MAP: Record<
  string,
  { icon: LucideIcon; color: string; bg: string }
> = {
  pain: {
    icon: Heart,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
  },
  goal: {
    icon: Target,
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  workflow: {
    icon: Layers,
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  task: {
    icon: BarChart3,
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  demographic: {
    icon: Users,
    color: "text-slate-700 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800/40",
  },
  preference: {
    icon: AlignLeft,
    color: "text-indigo-700 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  artifact: {
    icon: Box,
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
  },
  tool: {
    icon: Wrench,
    color: "text-cyan-700 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
  },
  behavior: {
    icon: PersonStanding,
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
  },
  context: {
    icon: Image,
    color: "text-teal-700 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/40",
  },
  job_function: {
    icon: Boxes,
    color: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
  },
};

function getIconConfig(kindSlug: string) {
  return (
    KIND_ICON_MAP[kindSlug] ?? {
      icon: Sparkles,
      color: "text-slate-700 dark:text-slate-400",
      bg: "bg-slate-100 dark:bg-slate-800/40",
    }
  );
}

/** Generate a fallback summary from facet labels when no AI summary exists */
function fallbackSummary(facets: FacetEntry[]): string {
  if (!facets?.length) return "No attributes captured yet.";
  const labels = facets
    .map((f) => f.label)
    .filter(Boolean)
    .slice(0, 3);
  return labels.join(" \u00b7 ") || "No attributes captured yet.";
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

/** Single demographic stat with label + value stacked vertically */
function DemographicStat({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "font-medium text-sm",
          value ? "text-foreground" : "text-muted-foreground/60 italic",
        )}
      >
        {value || "---"}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function PersonProfileSection({
  person,
  primaryOrg,
  facetLensGroups,
  availableFacetsByKind,
  isGenerating = false,
  personScale: _personScale,
  sortedLinkedOrganizations,
  routes,
  availableOrganizations = [],
}: PersonProfileSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [expandedLenses, setExpandedLenses] = useState<Set<string>>(new Set());

  // Derived values
  const jobFunctionLabel = getOptionLabel(JOB_FUNCTIONS, person.job_function);
  const seniorityLabel = getOptionLabel(
    SENIORITY_LEVELS,
    person.seniority_level,
  );
  const industryValue = person.industry || primaryOrg?.industry || null;
  const industryLabel = getOptionLabel(INDUSTRIES, industryValue);
  const companySizeLabel = primaryOrg?.size_range || null;

  const hasDemographics =
    person.job_function ||
    person.seniority_level ||
    industryValue ||
    companySizeLabel;
  const hasLenses = facetLensGroups.length > 0;
  const hasOrganizations = sortedLinkedOrganizations.length > 0;
  const hasAnyContent = hasDemographics || hasLenses || hasOrganizations;

  const toggleLens = (kindSlug: string) => {
    setExpandedLenses((prev) => {
      const next = new Set(prev);
      if (next.has(kindSlug)) {
        next.delete(kindSlug);
      } else {
        next.add(kindSlug);
      }
      return next;
    });
  };

  const toggleAllLenses = () => {
    if (expandedLenses.size === facetLensGroups.length) {
      setExpandedLenses(new Set());
    } else {
      setExpandedLenses(new Set(facetLensGroups.map((g) => g.kind_slug)));
    }
  };

  // Always render sections so users can add data
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      {/* Section title */}
      <div className="mb-5 flex items-center gap-2">
        <User2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground text-sm">Profile</h3>
      </div>

      {/* ── Organizations ───────────────────────────────────────────── */}
      {hasOrganizations ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              Organizations
            </p>
            <LinkOrganizationDialog
              personId={person.id}
              availableOrganizations={availableOrganizations}
              triggerButton={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                >
                  <Building2 className="mr-1 h-3 w-3" />
                  Manage
                </Button>
              }
            />
          </div>

          <div className="space-y-1">
            {sortedLinkedOrganizations.map((link) => {
              const org = link.organization;
              if (!org) return null;

              return (
                <div key={link.id} className="flex items-center gap-2 py-2">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  <Link
                    to={routes.organizations.detail(org.id)}
                    className="font-medium text-foreground text-sm transition-colors hover:text-primary"
                  >
                    {org.name || "Unnamed"}
                  </Link>
                  {link.job_title && (
                    <>
                      <span className="text-muted-foreground/50 text-xs">
                        &middot;
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {link.job_title}
                      </span>
                    </>
                  )}
                  {link.is_primary && (
                    <Badge
                      variant="outline"
                      className="ml-1 px-1.5 py-0 text-[10px] uppercase"
                    >
                      Primary
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              Organizations
            </p>
            <LinkOrganizationDialog
              personId={person.id}
              availableOrganizations={availableOrganizations}
              triggerButton={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Link Organization
                </Button>
              }
            />
          </div>
          <p className="text-muted-foreground/60 text-sm italic">
            No organizations linked yet.
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="my-4 h-px bg-border" />

      {/* ── Contact Info (embedded) ───────────────────────────────── */}
      <PersonContactSection person={person} embedded />

      {/* Divider */}
      <div className="my-4 h-px bg-border" />

      {/* ── Demographics ────────────────────────────────────────────── */}
      {hasDemographics || isEditing ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              Demographics
            </p>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="cursor-pointer text-primary text-xs hover:underline"
            >
              {isEditing ? "Done" : "Edit"}
            </button>
          </div>

          {isEditing ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Job Function
                </label>
                <InlineEditableField
                  value={person.job_function}
                  entityId={person.id}
                  entityIdKey="personId"
                  field="job_function"
                  placeholder="Select function"
                  type="select"
                  options={JOB_FUNCTIONS}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Seniority
                </label>
                <InlineEditableField
                  value={person.seniority_level}
                  entityId={person.id}
                  entityIdKey="personId"
                  field="seniority_level"
                  placeholder="Select level"
                  type="select"
                  options={SENIORITY_LEVELS}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Industry
                </label>
                <InlineEditableField
                  value={person.industry}
                  entityId={person.id}
                  entityIdKey="personId"
                  field="industry"
                  placeholder="Select industry"
                  type="select"
                  options={INDUSTRIES}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Company Size
                </label>
                {primaryOrg ? (
                  <InlineEditableField
                    value={primaryOrg.size_range}
                    entityId={primaryOrg.id}
                    entityIdKey="organizationId"
                    field="size_range"
                    actionName="update-org-field"
                    placeholder="Select size"
                    type="select"
                    options={COMPANY_SIZE_RANGES}
                    className="text-sm"
                  />
                ) : (
                  <p className="text-muted-foreground/60 text-sm italic">---</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DemographicStat label="Function" value={jobFunctionLabel} />
              <DemographicStat label="Seniority" value={seniorityLabel} />
              <DemographicStat label="Industry" value={industryLabel} />
              <DemographicStat label="Company Size" value={companySizeLabel} />
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              Demographics
            </p>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex cursor-pointer items-center gap-1 text-primary text-xs hover:underline"
            >
              <Pencil className="h-3 w-3" />
              Add
            </button>
          </div>
          <p className="pb-2 text-muted-foreground/60 text-sm italic">
            No demographic data. Click &ldquo;Add&rdquo; to set job function,
            seniority, or industry.
          </p>
        </div>
      )}

      {/* Divider */}
      {hasLenses && <div className="my-4 h-px bg-border" />}

      {/* ── Attribute Lenses ────────────────────────────────────────── */}
      {hasLenses && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Attribute Lenses
              </p>
              {isGenerating && (
                <Badge
                  variant="outline"
                  className="animate-pulse text-[10px] uppercase"
                >
                  Refreshing
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={toggleAllLenses}
              className="cursor-pointer text-primary text-xs hover:underline"
            >
              {expandedLenses.size === facetLensGroups.length
                ? "Collapse all"
                : "Expand all"}
            </button>
          </div>

          <div className="space-y-2">
            {facetLensGroups.map((group) => {
              const iconConfig = getIconConfig(group.kind_slug);
              const IconComponent = iconConfig.icon;
              const summaryText =
                group.summary?.trim() || fallbackSummary(group.facets);
              const isOpen = expandedLenses.has(group.kind_slug);

              return (
                <Collapsible
                  key={group.kind_slug}
                  open={isOpen}
                  onOpenChange={() => toggleLens(group.kind_slug)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border border-border/40 p-3",
                        "cursor-pointer text-left transition-colors hover:bg-muted/30",
                        isOpen && "bg-muted/20",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          iconConfig.bg,
                        )}
                      >
                        <IconComponent
                          className={cn("h-3.5 w-3.5", iconConfig.color)}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-foreground text-sm capitalize">
                          {group.label}
                        </span>
                        <p className="mt-0.5 line-clamp-1 text-muted-foreground text-sm">
                          {summaryText}
                        </p>
                      </div>
                      <ChevronRight
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
                          isOpen && "rotate-90",
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="mt-2 ml-10">
                      <PersonFacetLenses
                        groups={[group]}
                        personId={person.id}
                        availableFacetsByKind={availableFacetsByKind}
                        isGenerating={isGenerating}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
