import { formatDistance } from "date-fns";
import { motion } from "framer-motion";
import { Building2, User } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { useCurrentProject } from "~/contexts/current-project-context";
import { BandBadge } from "~/features/lenses/components/ICPMatchSection";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import type { Person } from "~/types";

// Type for person with nested personas from interview participants query
interface PersonWithPersonas {
  id: string;
  name: string | null;
  image_url: string | null;
  people_personas?: Array<{
    persona_id: string;
    personas: {
      id: string;
      name: string;
      color_hex: string;
    };
  }>;
  people_organizations?: Array<{
    organization?: {
      id: string;
      name: string | null;
      website_url: string | null;
    };
    role?: string | null;
  }>;
}

interface EnhancedPersonCardProps {
  person: Person;
  className?: string;
  facets?: PersonFacetSummary[];
  conversationCount?: number;
  evidenceCount?: number;
  icpBand?: string | null;
  icpConfidence?: number | null;
}

interface PersonFacetSummary {
  facet_account_id: number;
  label: string;
  kind_slug: string;
  source: string | null;
  confidence: number | null;
}

export default function EnhancedPersonCard({
  person,
  className,
  facets,
  conversationCount,
  evidenceCount,
  icpBand,
  icpConfidence,
}: EnhancedPersonCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const currentProjectContext = useCurrentProject();
  const routes = useProjectRoutes(currentProjectContext?.projectPath);

  // Persona color or fallback
  const persona = person.people_personas?.[0]?.personas;
  const themeColor = persona?.color_hex || "#6366f1"; // Indigo fallback

  // Name and avatar logic
  const name = person.name || "Unnamed Person";
  const initials =
    name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const topFacets = facets?.slice(0, 3) ?? [];
  const primaryOrganization = person.people_organizations?.[0]?.organization;
  const primaryOrganizationLabel =
    primaryOrganization?.name || primaryOrganization?.website_url || undefined;
  const primaryRole =
    person.people_organizations?.find((link) => link.is_primary)?.role ??
    person.people_organizations?.[0]?.role ??
    null;

  return (
    <Link
      to={routes.people.detail(person.id)}
      tabIndex={0}
      aria-label={`View details for ${name}`}
    >
      <motion.div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-background",
          "transition-all duration-300 ease-out",
          "hover:shadow-black/10 hover:shadow-lg dark:hover:shadow-white/5",
          className,
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ y: -4, scale: 1.02 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Theme color accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: themeColor }} />

        {/* Gradient overlay on hover */}
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{
            background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
          }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        <Card className="border-0 bg-transparent shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-start">
              <motion.div
                className="relative"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <Avatar
                  className="h-16 w-16 border-2"
                  style={{ borderColor: themeColor }}
                >
                  {person.image_url && (
                    <AvatarImage src={person.image_url} alt={name} />
                  )}
                  <AvatarFallback
                    className="font-medium text-lg text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <motion.div
                  className="-bottom-1 -right-1 absolute flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
                  style={{ backgroundColor: themeColor }}
                  animate={{ rotate: isHovered ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <User className="h-3 w-3 text-white" />
                </motion.div>
              </motion.div>
              <div className="flex w-full items-start justify-between">
                <div>
                  <motion.h3
                    className="mb-3 ml-4 font-bold text-foreground text-xl leading-tight"
                    style={{ color: isHovered ? themeColor : undefined }}
                    transition={{ duration: 0.3 }}
                  >
                    {name}
                  </motion.h3>
                  {persona?.name && (
                    <div
                      className="mt-1 ml-4 inline-block rounded-full px-2 py-0.5 font-semibold text-xs"
                      style={{
                        backgroundColor: `${themeColor}22`,
                        color: themeColor,
                      }}
                    >
                      {persona.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {(primaryOrganizationLabel || person.title || primaryRole) && (
              <div className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="line-clamp-1">
                  {[
                    person.title || primaryRole,
                    primaryOrganizationLabel?.replace?.(/^https?:\/\//, ""),
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </span>
              </div>
            )}
            {/* Description, segment, etc. */}
            <p className="mb-3 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
              {person.description || "No description yet."}
            </p>
            {/* Segment data badges */}
            {(person.job_function ||
              person.seniority_level ||
              person.segment ||
              icpBand) && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {icpBand && (
                  <BandBadge band={icpBand} confidence={icpConfidence} />
                )}
                {person.job_function && (
                  <Badge
                    variant="outline"
                    className="px-1.5 py-0.5 text-[10px]"
                  >
                    {person.job_function}
                  </Badge>
                )}
                {person.seniority_level && (
                  <Badge
                    variant="outline"
                    className="px-1.5 py-0.5 text-[10px]"
                  >
                    {person.seniority_level}
                  </Badge>
                )}
                {person.segment && (
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0.5 text-[10px]"
                  >
                    {person.segment}
                  </Badge>
                )}
              </div>
            )}
            {topFacets.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {topFacets.slice(0, 2).map((facet) => (
                  <Badge
                    key={`${person.id}-${facet.facet_account_id}`}
                    variant="secondary"
                    className="max-w-full capitalize"
                  >
                    <span className="line-clamp-1">{facet.label}</span>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
              {typeof conversationCount === "number" && (
                <span className="rounded bg-muted px-2 py-0.5">
                  {conversationCount} conversations
                </span>
              )}
              {typeof evidenceCount === "number" && (
                <span className="rounded bg-muted px-2 py-0.5">
                  {evidenceCount} evidence
                </span>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex w-full justify-end text-muted-foreground/50 text-xs">
              {person.updated_at && (
                <span>
                  Updated{" "}
                  {formatDistance(new Date(person.updated_at), new Date(), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
          </CardFooter>
        </Card>
        {/* Bottom gradient border effect */}
        <motion.div
          className="absolute right-0 bottom-0 left-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${themeColor} 50%, transparent 100%)`,
          }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </Link>
  );
}

// Make a MiniPersonCard that shows the person's name, avatar, persona, & segment
export function MiniPersonCard({ person }: { person: PersonWithPersonas }) {
  const currentProjectContext = useCurrentProject();
  const routes = useProjectRoutes(currentProjectContext?.projectPath);

  const persona = person.people_personas?.[0]?.personas;
  const themeColor = persona?.color_hex || "#6366f1"; // Indigo fallback
  const name = person.name || "Unnamed Person";
  const initials =
    name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";
  // consola.log("MiniPersonCard person: ", person, persona)

  return (
    <div className="flex items-center gap-2">
      <Link to={routes.people.detail(person.id)}>
        <Avatar className="h-8 w-8">
          {person.image_url && (
            <AvatarImage src={person.image_url} alt={person.name} />
          )}
          <AvatarFallback
            className="font-medium text-sm text-white"
            style={{ backgroundColor: themeColor }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex flex-col">
        <Link to={routes.people.detail(person.id)}>
          <h3 className="font-medium text-sm">{person.name}</h3>
        </Link>
        {persona?.name && "id" in persona && persona.id && (
          <Link to={routes.personas.detail(persona.id)}>
            <div className="rounded-sm border p-2 text-foreground text-xs">
              {persona.name}
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
