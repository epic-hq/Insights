/**
 * ICP Match Section - Editable ICP criteria and scoring for people
 *
 * Shows current ICP criteria, allows editing, and triggers re-scoring.
 * Displays distribution of ICP match scores.
 */

import { Pencil, Target } from "lucide-react";
import { useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
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
};

export function ICPMatchSection({
  accountId,
  projectId,
  initialCriteria,
  distribution,
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
    const fetcher = useFetcher();

    // Save to project_sections (project-level overrides)
    try {
      const res = await fetch("/api/icp-criteria", {
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
        toast.success("ICP criteria updated");
        setIsEditing(false);
        revalidator.revalidate();
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
      const res = await fetch("/api/score-icp-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, force: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("ICP scoring started", {
          description: "People will be scored against your ICP criteria",
        });
        // Revalidate after a delay to show updated scores
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

  const hasDistribution =
    distribution &&
    distribution.HIGH +
      distribution.MEDIUM +
      distribution.LOW +
      distribution.NONE >
      0;

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
              <p className="mb-1.5 font-medium text-xs text-foreground/60">
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
              <p className="mb-1.5 font-medium text-xs text-foreground/60">
                Target Organizations
              </p>
              <div className="flex flex-wrap gap-1">
                {initialCriteria.target_orgs.length > 0 ? (
                  initialCriteria.target_orgs.slice(0, 2).map((org) => (
                    <Badge key={org} variant="secondary" className="text-xs">
                      {org.length > 30 ? `${org.slice(0, 30)}...` : org}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    (not set)
                  </span>
                )}
                {initialCriteria.target_orgs.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{initialCriteria.target_orgs.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-xs text-foreground/60">
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

          {/* Distribution */}
          {hasDistribution && (
            <div className="border-t pt-4">
              <p className="mb-2 font-medium text-xs text-foreground/60">
                Match Distribution
              </p>
              <div className="flex gap-3">
                {distribution!.HIGH > 0 && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-green-600 text-lg dark:text-green-400">
                      {distribution!.HIGH}
                    </span>
                    <span className="text-muted-foreground text-xs">High</span>
                  </div>
                )}
                {distribution!.MEDIUM > 0 && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-yellow-600 text-lg dark:text-yellow-400">
                      {distribution!.MEDIUM}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Medium
                    </span>
                  </div>
                )}
                {distribution!.LOW > 0 && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-orange-600 text-lg dark:text-orange-400">
                      {distribution!.LOW}
                    </span>
                    <span className="text-muted-foreground text-xs">Low</span>
                  </div>
                )}
                {distribution!.NONE > 0 && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-muted-foreground text-lg">
                      {distribution!.NONE}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      No match
                    </span>
                  </div>
                )}
              </div>
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
