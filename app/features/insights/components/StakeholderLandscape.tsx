/**
 * Layer 1: Stakeholder Landscape — role clusters with avatar dots.
 * Groups people by job_function, shows avatar circles with initials.
 * Click dot → smooth-scroll to matching StakeholderCard with amber glow.
 * Bottom: shared concern callout (theme with broadest role coverage).
 */
import { Link2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { StakeholderSummary } from "~/features/insights/types";

interface StakeholderLandscapeProps {
  roleGroups: Record<string, StakeholderSummary[]>;
  sharedConcern: {
    themeId: string;
    themeName: string;
    roleCount: number;
  } | null;
  onPersonClick: (personId: string) => void;
}

export function StakeholderLandscape({
  roleGroups,
  sharedConcern,
  onPersonClick,
}: StakeholderLandscapeProps) {
  const roles = Object.keys(roleGroups).sort();
  const totalPeople = Object.values(roleGroups).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  if (totalPeople === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Stakeholder Landscape
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {totalPeople} {totalPeople === 1 ? "person" : "people"} across{" "}
            {roles.length} {roles.length === 1 ? "role" : "roles"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <TooltipProvider>
          <div className="grid gap-6 sm:grid-cols-2">
            {roles.map((role) => (
              <div key={role}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {role}
                </p>
                <div className="flex flex-wrap gap-2">
                  {roleGroups[role].map((s) => (
                    <Tooltip key={s.person.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onPersonClick(s.person.id)}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition-all",
                            "bg-muted text-foreground hover:ring-2 hover:ring-amber-400 hover:ring-offset-1",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          )}
                        >
                          {s.person.initials}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        <p className="font-medium">{s.person.name}</p>
                        {s.person.title && (
                          <p className="text-muted-foreground">
                            {s.person.title}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TooltipProvider>

        {/* Shared concern callout */}
        {sharedConcern && (
          <div className="mt-5 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>Shared concern:</strong> &ldquo;{sharedConcern.themeName}
              &rdquo; spans {sharedConcern.roleCount} roles
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
