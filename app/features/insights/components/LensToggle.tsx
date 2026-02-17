/**
 * Toggle between "By Theme" and "By Stakeholder" lenses.
 * Phase A: "By Stakeholder" is disabled with a "Coming soon" tooltip.
 */
import { Tags, Users } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface LensToggleProps {
  activeLens: string;
}

export function LensToggle({ activeLens }: LensToggleProps) {
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={activeLens}
        size="sm"
        className="shrink-0"
      >
        <ToggleGroupItem value="themes" aria-label="By Theme" className="gap-2">
          <Tags className="h-4 w-4" />
          By Theme
        </ToggleGroupItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <ToggleGroupItem
                value="stakeholders"
                aria-label="By Stakeholder"
                className="gap-2"
                disabled
              >
                <Users className="h-4 w-4" />
                By Stakeholder
              </ToggleGroupItem>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}
