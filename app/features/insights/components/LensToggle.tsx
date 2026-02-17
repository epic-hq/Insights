/**
 * Toggle between "By Theme" and "By Stakeholder" lenses.
 * Both buttons are active links navigating to their respective routes.
 */
import { Tags, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";

interface LensToggleProps {
  activeLens: "themes" | "stakeholders";
}

export function LensToggle({ activeLens }: LensToggleProps) {
  const { projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath);

  return (
    <ToggleGroup
      type="single"
      value={activeLens}
      size="sm"
      className="shrink-0"
    >
      <ToggleGroupItem
        value="themes"
        aria-label="By Theme"
        className="gap-2"
        asChild
      >
        <Link to={routes.insights.themes()}>
          <Tags className="h-4 w-4" />
          By Theme
        </Link>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="stakeholders"
        aria-label="By Stakeholder"
        className="gap-2"
        asChild
      >
        <Link to={routes.insights.stakeholders()}>
          <Users className="h-4 w-4" />
          By Stakeholder
        </Link>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
