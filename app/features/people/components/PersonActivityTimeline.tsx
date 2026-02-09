/**
 * PersonActivityTimeline - Unified chronological activity stream for a person
 *
 * Replaces the tabbed PersonEvidenceTab with a single timeline view that shows
 * all interactions (interviews, surveys, notes, chats, assets) in one stream.
 * Includes inline filter pills for quick narrowing and progressive disclosure
 * for long lists. Imported survey/research data appears in a collapsible
 * section at the bottom.
 */

import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileIcon,
  FolderOpen,
  MessageCircle,
  StickyNote,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Source type filter values */
type SourceFilter =
  | "all"
  | "interviews"
  | "notes"
  | "surveys"
  | "chats"
  | "assets";

interface InterviewLink {
  id: string | number;
  interviews: {
    id: string;
    title: string | null;
    source_type: string | null;
    media_type: string | null;
    created_at: string | null;
  } | null;
}

interface RelatedAsset {
  id: string;
  title: string;
  asset_type: string;
  created_at: string;
  description: string | null;
  relationship_type: string | null;
}

interface SurveyResponse {
  interviewId: string;
  interviewTitle: string;
  responses: Array<{
    id: string;
    question: string;
    answer: string;
    createdAt: string;
  }>;
}

interface ResearchLinkResponse {
  id: string;
  email: string;
  responses: Record<string, unknown> | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  research_links: {
    id: string;
    name: string;
    slug: string;
    questions: Array<{
      id: string;
      prompt: string;
      type: string;
      options?: string[];
      likertScale?: number;
      likertLabels?: { low: string; high: string };
    }> | null;
  } | null;
}

interface PersonActivityTimelineProps {
  /** All interview/source links from interview_people */
  allInterviewLinks: InterviewLink[];
  /** Assets linked via junction table */
  relatedAssets: RelatedAsset[];
  /** Grouped survey Q&A responses from evidence_facet */
  surveyResponses: SurveyResponse[];
  /** Research link responses from ask links */
  researchLinkResponses: ResearchLinkResponse[];
  /** Route helpers */
  routes: {
    interviews: { detail: (id: string) => string };
    assets: { detail: (id: string) => string };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** How many items to show before "Show more" */
const INITIAL_VISIBLE_COUNT = 5;

/** Unified timeline item for the list */
interface TimelineItem {
  id: string;
  title: string;
  category: Exclude<SourceFilter, "all">;
  date: Date | null;
  linkTo: string;
  subtitle?: string;
}

/** Normalize a source to its filter category */
function getSourceCategory(
  sourceType: string | null,
  mediaType: string | null,
): Exclude<SourceFilter, "all" | "assets"> {
  if (sourceType === "note" || mediaType === "voice_memo") return "notes";
  if (sourceType === "survey_response") return "surveys";
  if (sourceType === "public_chat") return "chats";
  return "interviews";
}

/** Get the Lucide icon component for a source category */
function getSourceIcon(category: Exclude<SourceFilter, "all">) {
  switch (category) {
    case "interviews":
      return Video;
    case "notes":
      return StickyNote;
    case "surveys":
      return ClipboardList;
    case "chats":
      return MessageCircle;
    case "assets":
      return FileIcon;
  }
}

/** Human-readable label for a source category */
function getSourceLabel(category: Exclude<SourceFilter, "all">) {
  switch (category) {
    case "interviews":
      return "Interview";
    case "notes":
      return "Note";
    case "surveys":
      return "Survey";
    case "chats":
      return "Chat";
    case "assets":
      return "Asset";
  }
}

/** Format a research-link answer for display */
function formatResearchAnswer(
  answer: unknown,
  question: { type: string; likertScale?: number },
): string {
  if (typeof answer === "string") return answer;
  if (Array.isArray(answer)) return answer.join(", ");
  if (typeof answer === "number") {
    return question.type === "likert"
      ? `${answer}/${question.likertScale || 5}`
      : String(answer);
  }
  return JSON.stringify(answer);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PersonActivityTimeline({
  allInterviewLinks,
  relatedAssets,
  surveyResponses,
  researchLinkResponses,
  routes,
}: PersonActivityTimelineProps) {
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const [importedDataOpen, setImportedDataOpen] = useState(false);

  // ---- Build unified item list (most recent first) ----

  const allItems = useMemo(() => {
    const items: TimelineItem[] = [];

    for (const link of allInterviewLinks) {
      if (!link.interviews?.id) continue;
      const interview = link.interviews;
      const category = getSourceCategory(
        interview.source_type,
        interview.media_type,
      );

      items.push({
        id: String(link.id),
        title:
          interview.title ||
          `${getSourceLabel(category)} ${interview.id.slice(0, 8)}`,
        category,
        date: interview.created_at ? new Date(interview.created_at) : null,
        linkTo: routes.interviews.detail(interview.id),
      });
    }

    for (const asset of relatedAssets) {
      items.push({
        id: `asset-${asset.id}`,
        title: asset.title,
        category: "assets",
        date: new Date(asset.created_at),
        linkTo: routes.assets.detail(asset.id),
        subtitle: asset.asset_type,
      });
    }

    // Sort most recent first
    items.sort((a, b) => {
      const dateA = a.date?.getTime() ?? 0;
      const dateB = b.date?.getTime() ?? 0;
      return dateB - dateA;
    });

    return items;
  }, [allInterviewLinks, relatedAssets, routes]);

  // ---- Counts per category ----

  const counts = useMemo(() => {
    const result: Record<SourceFilter, number> = {
      all: allItems.length,
      interviews: 0,
      notes: 0,
      surveys: 0,
      chats: 0,
      assets: 0,
    };
    for (const item of allItems) {
      result[item.category]++;
    }
    return result;
  }, [allItems]);

  // ---- Filtered list ----

  const filteredItems = useMemo(() => {
    if (filter === "all") return allItems;
    return allItems.filter((item) => item.category === filter);
  }, [allItems, filter]);

  // ---- Progressive disclosure ----

  const visibleItems = expanded
    ? filteredItems
    : filteredItems.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenCount = filteredItems.length - INITIAL_VISIBLE_COUNT;
  const showMoreButton = !expanded && hiddenCount > 0;

  // ---- Imported data flags ----

  const hasImportedData =
    surveyResponses.length > 0 || researchLinkResponses.length > 0;

  // ---- Categories that actually have items (for filter pills) ----

  const availableCategories = useMemo(() => {
    const categories: Exclude<SourceFilter, "all">[] = [
      "interviews",
      "notes",
      "surveys",
      "chats",
      "assets",
    ];
    return categories.filter((cat) => counts[cat] > 0);
  }, [counts]);

  // ---- Empty state ----

  if (allItems.length === 0 && !hasImportedData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <h3 className="mb-1 font-medium text-base text-foreground">
          No activity yet
        </h3>
        <p className="max-w-sm text-muted-foreground text-sm">
          Link conversations, notes, or assets to this person to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-base">Activity</h2>
      </div>

      {/* Filter pills */}
      {allItems.length > 0 && (
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => {
            if (value) {
              setFilter(value as SourceFilter);
              setExpanded(false);
            }
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all" className="gap-1.5 px-3">
            All
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {counts.all}
            </Badge>
          </ToggleGroupItem>
          {availableCategories.map((cat) => {
            const Icon = getSourceIcon(cat);
            return (
              <ToggleGroupItem key={cat} value={cat} className="gap-1.5 px-3">
                <Icon className="h-3.5 w-3.5" />
                {getSourceLabel(cat)}s
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {counts[cat]}
                </Badge>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      )}

      {/* Timeline items */}
      {visibleItems.length > 0 && (
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const Icon = getSourceIcon(item.category);
            return (
              <Link
                key={item.id}
                to={item.linkTo}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">
                      {item.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] uppercase tracking-wide"
                    >
                      {getSourceLabel(item.category)}
                    </Badge>
                  </div>
                  {item.subtitle && (
                    <p className="mt-0.5 text-muted-foreground text-sm capitalize">
                      {item.subtitle}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-muted-foreground text-sm">
                  {item.date?.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty filter state */}
      {filteredItems.length === 0 && allItems.length > 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No {filter === "all" ? "activity" : `${filter}`} found.
          </p>
        </div>
      )}

      {/* Show more / Show less */}
      {showMoreButton && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full cursor-pointer rounded-lg border border-dashed p-3 text-center text-muted-foreground text-sm transition-colors hover:border-muted-foreground hover:text-foreground"
        >
          Show {hiddenCount} more
        </button>
      )}
      {expanded && filteredItems.length > INITIAL_VISIBLE_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full cursor-pointer rounded-lg border border-dashed p-3 text-center text-muted-foreground text-sm transition-colors hover:border-muted-foreground hover:text-foreground"
        >
          Show less
        </button>
      )}

      {/* Imported Data (collapsible) */}
      {hasImportedData && (
        <Collapsible open={importedDataOpen} onOpenChange={setImportedDataOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/60">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 font-medium text-sm">Imported Data</span>
            <Badge variant="secondary" className="mr-2 h-5 px-1.5 text-xs">
              {surveyResponses.length + researchLinkResponses.length}
            </Badge>
            {importedDataOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3 space-y-3">
            {/* Survey Q&A responses */}
            {surveyResponses.map((survey) => (
              <Card key={survey.interviewId}>
                <CardHeader className="pb-2">
                  <Link
                    to={routes.interviews.detail(survey.interviewId)}
                    className="font-medium text-sm transition-colors hover:text-primary"
                  >
                    {survey.interviewTitle}
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {survey.responses.map((response) => (
                    <div key={response.id} className="space-y-1">
                      <p className="text-muted-foreground text-sm">
                        {response.question}
                      </p>
                      <p className="text-foreground text-sm">
                        {response.answer}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}

            {/* Research link responses */}
            {researchLinkResponses.map((response) => {
              const responsesData = response.responses;
              const questions = response.research_links?.questions ?? [];
              const answeredQuestions = questions.filter(
                (q) =>
                  responsesData?.[q.id] !== undefined &&
                  responsesData?.[q.id] !== null &&
                  responsesData?.[q.id] !== "",
              );

              return (
                <Card key={response.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        {response.research_links?.name || "Ask Link"}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={response.completed ? "default" : "secondary"}
                        >
                          {response.completed ? "Completed" : "In Progress"}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {new Date(response.created_at).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {answeredQuestions.length > 0 ? (
                      answeredQuestions.map((question) => {
                        const answer = responsesData?.[question.id];
                        return (
                          <div key={question.id} className="space-y-1">
                            <p className="text-muted-foreground text-sm">
                              {question.prompt}
                            </p>
                            <p className="text-foreground text-sm">
                              {formatResearchAnswer(answer, question)}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No responses recorded
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
