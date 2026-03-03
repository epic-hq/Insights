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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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

  // Build criteria summary line
  const criteriaParts: string[] = [];
  if (initialCriteria.target_roles.length > 0)
    criteriaParts.push(initialCriteria.target_roles.join(", "));
  if (initialCriteria.target_orgs.length > 0)
    criteriaParts.push(initialCriteria.target_orgs.join(", "));
  if (initialCriteria.target_company_sizes.length > 0)
    criteriaParts.push(initialCriteria.target_company_sizes.join(", "));
  if (initialCriteria.target_facets.length > 0)
    criteriaParts.push(
      initialCriteria.target_facets.map((f) => f.label).join(", "),
    );

  // Distribution bar segments
  const highCount = distribution?.HIGH || 0;
  const medCount = distribution?.MEDIUM || 0;
  const lowCount = distribution?.LOW || 0;
  const noneCount = noMatchCount > 0 ? noMatchCount : 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base">
                Ideal Customer Profile
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button onClick={handleScoreICP} disabled={isScoring} size="sm">
                {isScoring ? "Scoring..." : "Score All"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Distribution Bar */}
          {totalScored > 0 && (
            <div className="space-y-1.5">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {highCount > 0 && (
                  <div
                    className="bg-green-500 dark:bg-green-400"
                    style={{ width: `${(highCount / totalScored) * 100}%` }}
                  />
                )}
                {medCount > 0 && (
                  <div
                    className="bg-yellow-400 dark:bg-yellow-500"
                    style={{ width: `${(medCount / totalScored) * 100}%` }}
                  />
                )}
                {lowCount > 0 && (
                  <div
                    className="bg-orange-400 dark:bg-orange-500"
                    style={{ width: `${(lowCount / totalScored) * 100}%` }}
                  />
                )}
                {noneCount > 0 && (
                  <div
                    className="bg-muted-foreground/20"
                    style={{ width: `${(noneCount / totalScored) * 100}%` }}
                  />
                )}
                {indeterminateCount > 0 && (
                  <div
                    className="bg-purple-300 dark:bg-purple-600"
                    style={{
                      width: `${(indeterminateCount / totalScored) * 100}%`,
                    }}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {highCount}
                  </span>{" "}
                  High
                </span>
                <span className="text-border">·</span>
                <span>
                  <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                    {medCount}
                  </span>{" "}
                  Medium
                </span>
                <span className="text-border">·</span>
                <span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {lowCount}
                  </span>{" "}
                  Low
                </span>
                {noneCount > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span>
                      <span className="font-semibold">{noneCount}</span> None
                    </span>
                  </>
                )}
                {indeterminateCount > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {indeterminateCount}
                      </span>{" "}
                      No data
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Criteria summary line */}
          {criteriaParts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Targeting:</span>{" "}
              {criteriaParts.join(" · ")}
            </p>
          )}

          {/* Compact data quality warning */}
          {hasDataQualityIssues && (
            <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {missingTitle > 0 && (
                  <>
                    {missingTitle}/{dataQuality.totalPeople} missing title
                  </>
                )}
                {missingTitle > 0 && missingCompany > 0 && " · "}
                {missingCompany > 0 && (
                  <>
                    {missingCompany}/{dataQuality.totalPeople} missing company
                  </>
                )}
              </span>
              <Button
                variant="link"
                size="sm"
                onClick={handleEnrichPeople}
                disabled={isEnriching}
                className="h-auto p-0 text-xs text-yellow-700 underline dark:text-yellow-400"
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  "Enrich"
                )}
              </Button>
            </div>
          )}

          {/* People table — primary content */}
          {scoredPeople.length > 0 && (
            <ICPScoredPeopleTable
              people={scoredPeople}
              projectPath={projectPath}
              onEditPerson={handleEditPerson}
            />
          )}

          {/* Empty states — inline text */}
          {totalScored === 0 && hasCriteria && (
            <p className="py-6 text-center text-muted-foreground text-xs">
              No scores yet. Click "Score All" to run ICP matching.
            </p>
          )}

          {!hasCriteria && (
            <p className="py-6 text-center text-muted-foreground text-xs">
              No criteria defined yet — click "Edit" to get started.
            </p>
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
