import {
  Flame,
  MessageSquare,
  Quote,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useFetcher } from "react-router-dom";
import { EntityInteractionPanel } from "~/components/EntityInteractionPanel";
import { StyledTag } from "~/components/TagDisplay";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmotionBadge } from "~/components/ui/emotion-badge";
import InlineEdit from "~/components/ui/inline-edit";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu";
import {
  PriorityBars,
  priorityConfig,
} from "~/features/tasks/components/PriorityBars";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import type { Insight as BaseInsight } from "~/types";
import type { InsightEvidence } from "../pages/insight-detail";
import { EvidenceGroupedByInterview } from "./EvidenceGroup";
import type { InsightForAction } from "./InsightActions";
import { InsightActions } from "./InsightActions";
import { SemanticEvidenceSection } from "./SemanticEvidenceSection";

/** Person affected by this insight */
export interface PersonAffected {
  person_id: string;
  person_name: string | null;
  email: string | null;
  facet_count: number;
  is_team_member?: boolean;
}

function InsightPrioritySelector({
  priority,
  onSelect,
}: {
  priority: 1 | 2 | 3;
  onSelect: (priority: 1 | 2 | 3) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (p: 1 | 2 | 3) => {
    onSelect(p);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-2 px-2 py-1 hover:bg-muted"
        >
          <PriorityBars priority={priority} size="sm" />
          <span className="text-muted-foreground text-xs">
            {priorityConfig[priority]?.label ?? "Low"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52" align="end">
        <div className="space-y-2">
          <div className="font-medium text-sm">Priority</div>
          <div className="space-y-1">
            {([3, 2, 1] as const).map((p) => (
              <Button
                key={p}
                variant={priority === p ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start"
                onClick={() => handleSelect(p)}
              >
                <PriorityBars priority={p} size="sm" />
                <span className="ml-2">{priorityConfig[p].label}</span>
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type InsightDetail = BaseInsight & {
  priority?: number | null;
  persona_insights?: Array<{
    personas?: { id: string; name: string | null } | null;
  }> | null;
  insight_tags?: Array<{
    tags?: { tag?: string | null } | null;
    tag?: string | null;
    style?: CSSProperties | null;
    frequency?: number | null;
  }> | null;
};

interface InsightCardV3Props {
  insight: InsightDetail;
  evidence?: InsightEvidence[];
  projectPath?: string;
  accountId?: string;
  peopleAffected?: PersonAffected[];
}

export function InsightCardV3Page({
  insight,
  evidence = [],
  projectPath: propProjectPath,
  accountId,
  peopleAffected = [],
}: InsightCardV3Props) {
  const routes = useProjectRoutes(propProjectPath || "");
  const shareableName = insight.name || insight.statement || "Insight";
  const updateFetcher = useFetcher();
  const [commentCount, setCommentCount] = useState(0);
  const [priority, setPriority] = useState<1 | 2 | 3>(
    (insight.priority ?? 3) as 1 | 2 | 3,
  );

  useEffect(() => {
    setPriority((insight.priority ?? 3) as 1 | 2 | 3);
  }, [insight.priority]);

  // Handler to update insight fields via API
  const handleFieldUpdate = useCallback(
    (field: string, value: string) => {
      if (!propProjectPath) return;
      updateFetcher.submit(
        {
          table: "themes",
          id: insight.id,
          field,
          value,
        },
        {
          method: "post",
          action: `${propProjectPath}/insights/api/update-field`,
          encType: "application/json",
        },
      );
    },
    [propProjectPath, insight.id, updateFetcher],
  );

  const insight_for_action: InsightForAction = {
    id: insight.id,
    name: insight.name,
    statement: insight.statement,
    category: insight.category,
    jtbd: insight.jtbd,
    pain: insight.pain,
    desired_outcome: insight.desired_outcome,
    priority,
    persona_insights:
      insight.persona_insights
        ?.map((pi) => (pi?.personas ? { personas: pi.personas } : null))
        .filter((pi): pi is { personas: { id: string; name: string | null } } =>
          Boolean(pi),
        ) ?? undefined,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-0">
      {/* Header Section */}
      <div className="mb-6 space-y-4">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Insight Theme
            </div>
            {propProjectPath && accountId ? (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <InsightActions
                  insight={insight_for_action}
                  projectPath={propProjectPath}
                  showLabel={true}
                />
                <ResourceShareMenu
                  projectPath={propProjectPath}
                  accountId={accountId}
                  resourceId={insight.id}
                  resourceName={shareableName}
                  resourceType="insight"
                />
              </div>
            ) : null}
          </div>
          <Card surface="gradient">
            <CardContent>
              <h1 className="break-words font-bold text-2xl leading-tight tracking-tight sm:text-3xl">
                {insight.name}&nbsp;{" "}
                {propProjectPath ? (
                  <InsightPrioritySelector
                    priority={priority}
                    onSelect={(nextPriority) => {
                      setPriority(nextPriority);
                      handleFieldUpdate("priority", String(nextPriority));
                    }}
                  />
                ) : null}
              </h1>
              {/* Desired Outcome - prominent placement */}
              <div className="mt-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-foreground text-sm">
                  Desired Outcome:
                </span>
                <div className="min-w-0 flex-1">
                  <InlineEdit
                    value={insight.desired_outcome || ""}
                    onSubmit={(value) =>
                      handleFieldUpdate("desired_outcome", value)
                    }
                    placeholder="Click to add desired outcome..."
                    multiline
                    textClassName="text-foreground text-sm leading-relaxed"
                    showEditButton
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 sm:flex-row sm:items-start dark:border-blue-900/30 dark:bg-blue-950/10">
                {insight.statement && (
                  <p className="break-words text-base text-foreground leading-relaxed sm:text-lg">
                    {insight.statement}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {insight.category && (
            <Badge variant="secondary" className="px-3 py-1">
              {insight.category}
            </Badge>
          )}
          {insight.journey_stage && (
            <Badge variant="outline" className="px-3 py-1">
              {insight.journey_stage}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Pain & JTBD - Compact side by side */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900/30 dark:bg-red-950/10">
            <Flame className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 font-medium text-muted-foreground text-xs">
                Pain Point
              </div>
              <InlineEdit
                value={insight.pain || ""}
                onSubmit={(value) => handleFieldUpdate("pain", value)}
                placeholder="Click to add pain point..."
                multiline
                textClassName="text-foreground text-sm leading-relaxed"
                showEditButton
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-900/30 dark:bg-green-950/10">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 font-medium text-muted-foreground text-xs">
                Job To Be Done
              </div>
              <InlineEdit
                value={insight.jtbd || ""}
                onSubmit={(value) => handleFieldUpdate("jtbd", value)}
                placeholder="Click to add job to be done..."
                multiline
                textClassName="text-foreground text-sm leading-relaxed"
                showEditButton
              />
            </div>
          </div>
        </div>

        {/* Motivation */}
        {insight.motivation && (
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground text-sm">
              Motivation
            </h4>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {insight.motivation}
            </p>
          </div>
        )}

        {/* Metadata Card - Emotional Response, Synonyms, Personas, Tags */}
        {(insight.emotional_response ||
          (insight.synonyms && insight.synonyms.length > 0) ||
          (insight.persona_insights && insight.persona_insights.length > 0) ||
          (insight.insight_tags && insight.insight_tags.length > 0)) && (
          <Card>
            <CardContent className="pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Left column: Emotional Response & Personas */}
                <div className="space-y-4">
                  {insight.emotional_response && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground text-sm">
                        Emotional Response
                      </h4>
                      <EmotionBadge
                        emotion_string={insight.emotional_response}
                      />
                    </div>
                  )}
                  {insight.persona_insights &&
                    insight.persona_insights.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground text-sm">
                          Personas
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {insight.persona_insights.map((pi) => {
                            const persona = pi?.personas;
                            if (!persona?.id) return null;
                            return (
                              <Badge
                                key={persona.id}
                                variant="default"
                                className="px-3 py-1"
                              >
                                {persona.name}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>

                {/* Right column: Synonyms & Tags */}
                <div className="space-y-4">
                  {insight.synonyms && insight.synonyms.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-muted-foreground text-sm">
                        Synonyms
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {insight.synonyms.map((synonym) => (
                          <Badge
                            key={synonym}
                            variant="secondary"
                            className="text-xs"
                          >
                            {synonym}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {insight.insight_tags && insight.insight_tags.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground text-sm">
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {insight.insight_tags?.map((tag) => {
                          const tagName = tag?.tags?.tag || tag?.tag || null;
                          if (!tagName) return null;
                          const style =
                            (tag.style as CSSProperties | undefined) ?? {};
                          const frequency =
                            typeof tag.frequency === "number"
                              ? tag.frequency
                              : undefined;
                          return (
                            <StyledTag
                              key={tagName}
                              name={tagName}
                              style={style}
                              frequency={frequency}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* People Affected Section - Above Evidence */}
        {peopleAffected.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" />
                People ({peopleAffected.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {peopleAffected.map((person) => {
                  const initials =
                    (person.person_name || "?")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "?";
                  return (
                    <Link
                      key={person.person_id}
                      to={routes.people.detail(person.person_id)}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium text-sm">
                            {person.person_name || "Unknown"}
                          </p>
                          {person.is_team_member && (
                            <Badge
                              variant="secondary"
                              className="shrink-0 px-1.5 py-0 text-[10px]"
                            >
                              Team
                            </Badge>
                          )}
                        </div>
                        {person.email && (
                          <p className="truncate text-muted-foreground text-xs">
                            {person.email}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-muted-foreground text-xs">
                        {person.facet_count} mention
                        {person.facet_count !== 1 ? "s" : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Evidence Section - Grouped by Interview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Quote className="h-5 w-5" />
              Supporting Evidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EvidenceGroupedByInterview
              evidence={evidence}
              projectPath={propProjectPath || ""}
            />
          </CardContent>
        </Card>

        {/* Semantic Related Evidence Section */}
        <SemanticEvidenceSection
          insightId={insight.id}
          projectPath={propProjectPath || ""}
        />
      </div>

      {/* Comments Section - At the bottom */}
      <Card className="mt-8">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" />
            Comments
            {commentCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {commentCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EntityInteractionPanel
            entityType="insight"
            entityId={insight.id}
            onCommentCountChange={setCommentCount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
