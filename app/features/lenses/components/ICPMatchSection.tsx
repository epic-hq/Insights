/**
 * ICP Match Section - Editable ICP criteria and scoring for people
 *
 * Shows current ICP criteria, allows editing, and triggers re-scoring.
 * Displays a sortable data table of ICP scored people with inline editing.
 * Shows data quality warnings when people records are missing fields.
 */

import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { ICPScoredPerson } from "./AnalysisByPersonTab";
import { EditPersonDataSheet } from "./EditPersonDataSheet";
import { ICPScoredPeopleTable } from "./ICPScoredPeopleTable";

type AvailableFacet = {
  id: number;
  label: string;
  slug: string;
  kindSlug: string;
  kindLabel: string;
  personCount: number;
};

type SelectedFacet = {
  facet_account_id: number;
  label: string;
};

type ICPMatchSectionProps = {
  accountId: string;
  projectId: string;
  projectPath: string;
  initialCriteria: {
    target_orgs: string[];
    target_roles: string[];
    target_company_sizes: string[];
    target_facets: SelectedFacet[];
  };
  distribution?: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    NONE: number;
  };
  scoredPeople: ICPScoredPerson[];
  organizations: { id: string; name: string }[];
  dataQuality: {
    totalPeople: number;
    withTitle: number;
    withCompany: number;
  };
  availableFacets: AvailableFacet[];
};

export function BandBadge({
  band,
  confidence,
}: {
  band: string | null;
  confidence?: number | null;
}) {
  switch (band) {
    case "HIGH":
      return (
        <Badge className="bg-green-100 px-1.5 py-0 text-[10px] text-green-700 dark:bg-green-950/30 dark:text-green-300">
          High
        </Badge>
      );
    case "MEDIUM":
      return (
        <Badge className="bg-yellow-100 px-1.5 py-0 text-[10px] text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300">
          Medium
        </Badge>
      );
    case "LOW":
      return (
        <Badge className="bg-orange-100 px-1.5 py-0 text-[10px] text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
          Low
        </Badge>
      );
    default:
      if (confidence === 0) {
        return (
          <Badge
            variant="outline"
            className="border-purple-200 px-1.5 py-0 text-[10px] text-purple-600 dark:border-purple-800 dark:text-purple-400"
          >
            No data
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          No match
        </Badge>
      );
  }
}

export function ICPMatchSection({
  accountId,
  projectId,
  projectPath,
  initialCriteria,
  distribution,
  scoredPeople,
  organizations,
  dataQuality,
  availableFacets,
}: ICPMatchSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [facetPickerOpen, setFacetPickerOpen] = useState(false);
  const revalidator = useRevalidator();

  // Derive editing person from latest scoredPeople so data stays fresh after revalidation
  const editingPersonIndex = useMemo(
    () =>
      editingPersonId
        ? scoredPeople.findIndex((p) => p.person_id === editingPersonId)
        : -1,
    [editingPersonId, scoredPeople],
  );
  const editingPerson =
    editingPersonIndex >= 0 ? scoredPeople[editingPersonIndex] : null;

  // Local state for editing
  const [roles, setRoles] = useState(initialCriteria.target_roles.join(", "));
  const [orgs, setOrgs] = useState(initialCriteria.target_orgs.join(", "));
  const [sizes, setSizes] = useState(
    initialCriteria.target_company_sizes.join(", "),
  );
  const [selectedFacets, setSelectedFacets] = useState<SelectedFacet[]>(
    initialCriteria.target_facets || [],
  );

  const handleSaveCriteria = async () => {
    try {
      const res = await fetch(`/a/${accountId}/${projectId}/api/icp-criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          projectId,
          target_roles: roles
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
          target_orgs: orgs
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean),
          target_company_sizes: sizes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          target_facets: selectedFacets,
        }),
      });

      if (res.ok) {
        toast.success("ICP criteria saved");
        setIsEditing(false);
        revalidator.revalidate();
        await handleScoreICP();
      } else {
        toast.error("Failed to save criteria");
      }
    } catch (error) {
      console.error("Failed to save ICP criteria:", error);
      toast.error("Failed to save criteria");
    }
  };

  const handleScoreICP = async () => {
    setIsScoring(true);
    try {
      const res = await fetch(
        `/a/${accountId}/${projectId}/api/score-icp-matches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, force: true }),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success("ICP scoring started", {
          description: "People will be scored against your ICP criteria",
        });
        setTimeout(() => revalidator.revalidate(), 3000);
      } else {
        toast.error(data.error || "Failed to start ICP scoring");
      }
    } catch (error) {
      console.error("Failed to trigger ICP scoring:", error);
      toast.error("Failed to start ICP scoring");
    } finally {
      setIsScoring(false);
    }
  };

  const handleEnrichPeople = async () => {
    setIsEnriching(true);
    try {
      const res = await fetch(
        `/a/${accountId}/${projectId}/api/enrich-people`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, rescore: true }),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Enrichment started", {
          description:
            "Researching people with missing data. Scores will auto-update when done.",
        });
        // Poll for completion - revalidate after a delay
        setTimeout(() => revalidator.revalidate(), 8000);
        setTimeout(() => revalidator.revalidate(), 20000);
      } else {
        toast.error(data.error || "Failed to start enrichment");
      }
    } catch (error) {
      console.error("Failed to trigger enrichment:", error);
      toast.error("Failed to start enrichment");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleEditPerson = (person: ICPScoredPerson) => {
    setEditingPersonId(person.person_id);
  };

  const handlePersonSaved = (personId: string) => {
    // Advance to the next person with missing data for a to-do list feel
    const missingDataPeople = scoredPeople.filter(
      (p) => !p.title && p.person_id !== personId,
    );
    if (missingDataPeople.length > 0) {
      setEditingPersonId(missingDataPeople[0].person_id);
    } else {
      setEditingPersonId(null);
    }
  };

  const handleNavigatePerson = (direction: "prev" | "next") => {
    if (editingPersonIndex < 0) return;
    const newIndex =
      direction === "prev" ? editingPersonIndex - 1 : editingPersonIndex + 1;
    if (newIndex >= 0 && newIndex < scoredPeople.length) {
      setEditingPersonId(scoredPeople[newIndex].person_id);
    }
  };

  const totalScored = scoredPeople.length;
  const indeterminateCount = scoredPeople.filter(
    (p) => p.confidence === 0,
  ).length;
  const noMatchCount = (distribution?.NONE || 0) - indeterminateCount;
  const hasCriteria =
    initialCriteria.target_roles.length > 0 ||
    initialCriteria.target_orgs.length > 0 ||
    initialCriteria.target_company_sizes.length > 0 ||
    initialCriteria.target_facets.length > 0;

  // Data quality checks
  const missingTitle = dataQuality.totalPeople - dataQuality.withTitle;
  const missingCompany = dataQuality.totalPeople - dataQuality.withCompany;
  const hasDataQualityIssues =
    dataQuality.totalPeople > 0 &&
    (missingTitle / dataQuality.totalPeople > 0.3 ||
      missingCompany / dataQuality.totalPeople > 0.3);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Ideal Customer Profile
                </CardTitle>
                <CardDescription className="text-xs">
                  AI-powered matching against your criteria
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit Criteria
              </Button>
              <Button onClick={handleScoreICP} disabled={isScoring} size="sm">
                {isScoring ? "Scoring..." : "Score All"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Criteria */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <p className="mb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                Roles
              </p>
              <div className="flex flex-wrap gap-1">
                {initialCriteria.target_roles.length > 0 ? (
                  initialCriteria.target_roles.map((role) => (
                    <Badge key={role} variant="secondary" className="text-xs">
                      {role}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    (not set)
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                Organizations
              </p>
              <div className="flex flex-wrap gap-1">
                {initialCriteria.target_orgs.length > 0 ? (
                  initialCriteria.target_orgs.map((org) => (
                    <Badge key={org} variant="secondary" className="text-xs">
                      {org}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    (not set)
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                Company Sizes
              </p>
              <div className="flex flex-wrap gap-1">
                {initialCriteria.target_company_sizes.length > 0 ? (
                  initialCriteria.target_company_sizes.map((size) => (
                    <Badge key={size} variant="secondary" className="text-xs">
                      {size}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    (not set)
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                Facets
              </p>
              <div className="flex flex-wrap gap-1">
                {initialCriteria.target_facets.length > 0 ? (
                  initialCriteria.target_facets.map((facet) => (
                    <Badge
                      key={facet.facet_account_id}
                      variant="secondary"
                      className="text-xs"
                    >
                      {facet.label}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    (not set)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Data Quality Warning */}
          {hasDataQualityIssues && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50/50 p-3 dark:border-yellow-800/50 dark:bg-yellow-950/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div className="flex-1 text-xs">
                <p className="font-medium text-yellow-800 dark:text-yellow-300">
                  Scoring accuracy limited by missing data
                </p>
                <p className="mt-0.5 text-yellow-700 dark:text-yellow-400">
                  {missingTitle > 0 && (
                    <span>
                      {missingTitle}/{dataQuality.totalPeople} people missing
                      job title.{" "}
                    </span>
                  )}
                  {missingCompany > 0 && (
                    <span>
                      {missingCompany}/{dataQuality.totalPeople} missing
                      company.{" "}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnrichPeople}
                disabled={isEnriching}
                className="shrink-0 border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-950/40"
              >
                {isEnriching ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isEnriching ? "Enriching..." : "Enrich Data"}
              </Button>
            </div>
          )}

          {/* Distribution - always show all buckets */}
          {totalScored > 0 && (
            <div className="border-t pt-4">
              <p className="mb-2 font-medium text-foreground/60 text-xs">
                Match Distribution ({totalScored} scored)
              </p>
              <div className="flex gap-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-green-600 text-lg dark:text-green-400">
                    {distribution?.HIGH || 0}
                  </span>
                  <span className="text-muted-foreground text-xs">High</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-lg text-yellow-600 dark:text-yellow-400">
                    {distribution?.MEDIUM || 0}
                  </span>
                  <span className="text-muted-foreground text-xs">Medium</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-lg text-orange-600 dark:text-orange-400">
                    {distribution?.LOW || 0}
                  </span>
                  <span className="text-muted-foreground text-xs">Low</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-lg text-muted-foreground">
                    {noMatchCount > 0 ? noMatchCount : 0}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    No match
                  </span>
                </div>
                {indeterminateCount > 0 && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-lg text-purple-600 dark:text-purple-400">
                      {indeterminateCount}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      No data
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* People Scores Table */}
          {scoredPeople.length > 0 && (
            <div className="border-t pt-4">
              <p className="mb-2 font-medium text-foreground/60 text-xs">
                People Scores
              </p>
              <ICPScoredPeopleTable
                people={scoredPeople}
                projectPath={projectPath}
                onEditPerson={handleEditPerson}
              />
            </div>
          )}

          {/* No scores yet */}
          {totalScored === 0 && hasCriteria && (
            <div className="border-t pt-4">
              <p className="text-center text-muted-foreground text-xs">
                No scores yet. Click "Score All" to run ICP matching.
              </p>
            </div>
          )}

          {!hasCriteria && (
            <div className="border-t pt-4">
              <p className="text-center text-muted-foreground text-xs">
                No criteria defined. Click "Edit Criteria" to set your roles,
                organizations, company sizes, and facets.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Person Drawer */}
      <EditPersonDataSheet
        person={editingPerson}
        open={!!editingPerson}
        onOpenChange={(open) => !open && setEditingPersonId(null)}
        projectPath={projectPath}
        organizations={organizations}
        onSaved={handlePersonSaved}
        onNavigate={handleNavigatePerson}
        hasPrev={editingPersonIndex > 0}
        hasNext={
          editingPersonIndex >= 0 &&
          editingPersonIndex < scoredPeople.length - 1
        }
      />

      {/* Edit Criteria Dialog — wide two-column layout */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-h-[85vh] max-w-[1200px] sm:max-w-[1200px]">
          <DialogHeader>
            <DialogTitle>Ideal Customer Profile</DialogTitle>
            <DialogDescription>
              AI handles synonyms and variations automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-8 py-4 sm:grid-cols-[1fr_1.2fr]">
            {/* Left column: text criteria */}
            <div className="flex flex-col gap-5">
              <div className="border-b pb-1.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
                Criteria
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="roles" className="text-[13px]">
                  Roles
                </Label>
                <Input
                  id="roles"
                  placeholder="Job titles — e.g. Founder, VP Product"
                  value={roles}
                  onChange={(e) => setRoles(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orgs" className="text-[13px]">
                  Organizations
                </Label>
                <Input
                  id="orgs"
                  placeholder="Industries or verticals — e.g. B2B SaaS"
                  value={orgs}
                  onChange={(e) => setOrgs(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sizes" className="text-[13px]">
                  Company Sizes
                </Label>
                <Input
                  id="sizes"
                  placeholder="Stage or size — e.g. Startup, SMB, Enterprise"
                  value={sizes}
                  onChange={(e) => setSizes(e.target.value)}
                />
              </div>
            </div>

            {/* Right column: facet picker */}
            <div className="flex flex-col gap-4">
              <div className="border-b pb-1.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
                Facets{" "}
                <span className="font-normal text-muted-foreground/60 normal-case tracking-normal">
                  (up to 3)
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {/* Selected facet badges */}
                {selectedFacets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFacets.map((facet) => {
                      const facetInfo = availableFacets.find(
                        (f) => f.id === facet.facet_account_id,
                      );
                      return (
                        <span
                          key={facet.facet_account_id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 py-1 pr-1.5 pl-2.5 font-medium text-[13px]"
                        >
                          {facet.label}
                          {facetInfo && (
                            <span className="rounded border border-border bg-background px-1.5 py-px text-[10px] text-muted-foreground uppercase tracking-wider">
                              {facetInfo.kindLabel}
                            </span>
                          )}
                          <button
                            type="button"
                            className="ml-0.5 flex items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                            onClick={() =>
                              setSelectedFacets((prev) =>
                                prev.filter(
                                  (f) =>
                                    f.facet_account_id !==
                                    facet.facet_account_id,
                                ),
                              )
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Facet combobox trigger */}
                {selectedFacets.length < 3 && availableFacets.length > 0 && (
                  <Popover
                    open={facetPickerOpen}
                    onOpenChange={setFacetPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg border border-border border-dashed px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary hover:border-solid hover:text-foreground"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Search vocabulary...
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
                      align="start"
                      side="bottom"
                      sideOffset={4}
                    >
                      <Command>
                        <CommandInput placeholder="Search facets..." />
                        <CommandList className="max-h-[320px]">
                          <CommandEmpty>No facets found.</CommandEmpty>
                          <CommandGroup>
                            {availableFacets
                              .filter(
                                (f) =>
                                  !selectedFacets.some(
                                    (sf) => sf.facet_account_id === f.id,
                                  ),
                              )
                              .map((facet) => (
                                <CommandItem
                                  key={facet.id}
                                  value={`${facet.label} ${facet.kindLabel} ${facet.kindSlug}`}
                                  onSelect={() => {
                                    setSelectedFacets((prev) => [
                                      ...prev,
                                      {
                                        facet_account_id: facet.id,
                                        label: facet.label,
                                      },
                                    ]);
                                    setFacetPickerOpen(false);
                                  }}
                                  className="flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-[13px]">
                                      {facet.label}
                                    </span>
                                    <span className="rounded border border-border bg-background px-1.5 py-px text-[10px] text-muted-foreground uppercase tracking-wider">
                                      {facet.kindLabel}
                                    </span>
                                  </div>
                                  <span className="ml-2 shrink-0 text-muted-foreground text-xs">
                                    {facet.personCount} people
                                  </span>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Max reached message */}
                {selectedFacets.length >= 3 && (
                  <p className="text-[11px] text-muted-foreground/60 italic">
                    Max 3 selected. Remove one to swap.
                  </p>
                )}

                {/* Empty state when no facets exist */}
                {availableFacets.length === 0 &&
                  selectedFacets.length === 0 && (
                    <p className="text-[13px] text-muted-foreground">
                      No vocabulary facets yet. Facets are discovered from
                      conversations.
                    </p>
                  )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCriteria}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Save & Re-score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
