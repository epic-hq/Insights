/**
 * Layer 2: Stakeholder Card — per-person card with avatar, theme pills, quote.
 * Name links to person detail page. Theme pills show evidence count + shared indicator.
 * Supports highlight effect (amber ring glow) when targeted from landscape dot click.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import type { StakeholderSummary } from "~/features/insights/types";

const MAX_VISIBLE_THEMES = 5;

interface StakeholderCardProps {
  stakeholder: StakeholderSummary;
  highlightId: string | null;
}

export function StakeholderCard({
  stakeholder,
  highlightId,
}: StakeholderCardProps) {
  const { projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const { person, themes, representative_quote } = stakeholder;

  // Highlight + scroll when targeted
  useEffect(() => {
    if (highlightId === person.id && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setIsHighlighted(true);
      const timeout = setTimeout(() => setIsHighlighted(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [highlightId, person.id]);

  const visibleThemes = themes.slice(0, MAX_VISIBLE_THEMES);
  const overflowCount = themes.length - MAX_VISIBLE_THEMES;

  return (
    <Card
      ref={cardRef}
      data-person-id={person.id}
      className={cn(
        "p-4 transition-all duration-300",
        isHighlighted && "ring-2 ring-amber-400",
      )}
    >
      {/* Header: avatar + name + title + follow up button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <Avatar className="h-8 w-8 shrink-0">
            {person.image_url && (
              <AvatarImage src={person.image_url} alt={person.name} />
            )}
            <AvatarFallback className="text-xs font-semibold text-foreground">
              {person.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link
              to={routes.people.detail(person.id)}
              className="font-semibold text-sm text-foreground hover:underline"
            >
              {person.name}
            </Link>
            {person.title && (
              <p className="text-xs text-muted-foreground truncate">
                {person.title}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs shrink-0"
          disabled
        >
          Follow Up
        </Button>
      </div>

      {/* Representative quote */}
      {representative_quote && (
        <p className="mt-3 text-sm text-foreground/90 italic font-medium leading-relaxed line-clamp-3">
          &ldquo;{representative_quote}&rdquo;
        </p>
      )}

      {/* Theme pills */}
      {themes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleThemes.map((theme) => (
            <Link key={theme.id} to={routes.insights.detail(theme.id)}>
              <Badge
                variant="secondary"
                className="text-[11px] font-normal gap-1 hover:bg-muted-foreground/20 transition-colors cursor-pointer"
              >
                {theme.name}
                <span className="text-muted-foreground">
                  ({theme.evidence_count})
                </span>
                {theme.is_shared && (
                  <span title="Shared across people" className="ml-0.5">
                    &#x1F517;
                  </span>
                )}
              </Badge>
            </Link>
          ))}
          {overflowCount > 0 && (
            <Badge
              variant="outline"
              className="text-[11px] font-normal text-muted-foreground"
            >
              +{overflowCount} more
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
