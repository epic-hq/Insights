/**
 * ICP Match Section - Editable ICP criteria and scoring for people
 *
 * Shows current ICP criteria, allows editing, and triggers re-scoring.
 * Displays distribution of ICP match scores with matched people names.
 * Shows data quality warnings when people records are missing fields.
 */

import { AlertTriangle, Pencil, Target } from "lucide-react";
import { useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

type ScoredPerson = {
  name: string;
  title: string | null;
  company: string | null;
  band: string | null;
  score: number | null;
  confidence: number | null;
};

type ICPMatchSectionProps = {
  accountId: string;
  projectId: string;
  initialCriteria: {
    target_orgs: string[];
    target_roles: string[];
    target_company_sizes: string[];
  };
  distribution?: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    NONE: number;
  };
  scoredPeople: ScoredPerson[];
  dataQuality: {
    totalPeople: number;
    withTitle: number;
    withCompany: number;
  };
};

function BandBadge({
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
  initialCriteria,
  distribution,
  scoredPeople,
  dataQuality,
}: ICPMatchSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const revalidator = useRevalidator();

  // Local state for editing
  const [roles, setRoles] = useState(initialCriteria.target_roles.join(", "));
  const [orgs, setOrgs] = useState(initialCriteria.target_orgs.join(", "));
  const [sizes, setSizes] = useState(
    initialCriteria.target_company_sizes.join(", "),
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

  const totalScored = scoredPeople.length;
  const indeterminateCount = scoredPeople.filter(
    (p) => p.confidence === 0,
  ).length;
  const noMatchCount = (distribution?.NONE || 0) - indeterminateCount;
  const hasCriteria =
    initialCriteria.target_roles.length > 0 ||
    initialCriteria.target_orgs.length > 0 ||
    initialCriteria.target_company_sizes.length > 0;

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
                <CardTitle className="text-base">ICP Match Scoring</CardTitle>
                <CardDescription className="text-xs">
                  Score contacts against your Ideal Customer Profile
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1.5 font-medium text-foreground/60 text-xs">
                Target Roles
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
              <p className="mb-1.5 font-medium text-foreground/60 text-xs">
                Target Organizations
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
              <p className="mb-1.5 font-medium text-foreground/60 text-xs">
                Target Company Sizes
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
          </div>

          {/* Data Quality Warning */}
          {hasDataQualityIssues && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50/50 p-3 dark:border-yellow-800/50 dark:bg-yellow-950/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div className="text-xs">
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
                  Add titles and companies to people records for better ICP
                  matching.
                </p>
              </div>
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

          {/* Matched People Detail */}
          {scoredPeople.length > 0 && (
            <div className="border-t pt-4">
              <p className="mb-2 font-medium text-foreground/60 text-xs">
                People Scores
              </p>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {scoredPeople.map((person, i) => (
                  <div
                    key={`${person.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{person.name}</span>
                      {(person.title || person.company) && (
                        <span className="ml-1.5 text-foreground/50">
                          {[person.title, person.company]
                            .filter(Boolean)
                            .join(" @ ")}
                        </span>
                      )}
                      {!person.title && !person.company && (
                        <span className="ml-1.5 italic text-foreground/30">
                          no title/company
                        </span>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {person.confidence != null && person.confidence > 0 && (
                        <span className="text-[10px] text-foreground/30">
                          {Math.round(person.confidence * 100)}% conf
                        </span>
                      )}
                      <span className="tabular-nums text-foreground/50">
                        {person.score != null && person.confidence !== 0
                          ? `${Math.round(person.score * 100)}%`
                          : "—"}
                      </span>
                      <BandBadge
                        band={person.band}
                        confidence={person.confidence}
                      />
                    </div>
                  </div>
                ))}
              </div>
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
                No ICP criteria defined. Click "Edit Criteria" to set your
                target roles, organizations, and company sizes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit ICP Criteria</DialogTitle>
            <DialogDescription>
              Define your Ideal Customer Profile. Separate multiple values with
              commas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="roles">Target Roles</Label>
              <Input
                id="roles"
                placeholder="e.g., Founder, Marketing Director, Sales Manager"
                value={roles}
                onChange={(e) => setRoles(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Job titles or roles you want to reach
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgs">Target Organizations</Label>
              <Input
                id="orgs"
                placeholder="e.g., B2B SaaS, E-commerce, Healthcare"
                value={orgs}
                onChange={(e) => setOrgs(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Industries, verticals, or organization types
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizes">Target Company Sizes</Label>
              <Input
                id="sizes"
                placeholder="e.g., Startup, SMB, Enterprise"
                value={sizes}
                onChange={(e) => setSizes(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Company size ranges you're targeting
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCriteria}>Save & Re-score</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
