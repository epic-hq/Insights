/**
 * Aggregated Sales BANT Lens View
 *
 * Project-wide aggregation of Sales BANT analyses showing:
 * - BANT field values across interviews
 * - Stakeholders, objections, next steps
 * - Hygiene gaps and recommendations
 * - Drill-down to source interviews
 */

import type { LucideIcon, LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Crosshair,
  Crown,
  Filter,
  ListPlus,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  type ActionFunctionArgs,
  Link,
  type LoaderFunctionArgs,
  useFetcher,
  useLoaderData,
} from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { createTask } from "~/features/tasks/db";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import { userContext } from "~/server/user-context";
import {
  type AggregatedFieldValue,
  type AggregatedObjection,
  type AggregatedSalesBant,
  type AggregatedStakeholder,
  aggregateSalesBant,
  type InterviewWithLensAnalysis,
} from "../services/aggregateSalesBant.server";

// ============================================================================
// Loader
// ============================================================================

export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  if (!supabase) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const projectId = params.projectId as string;
  const projectPath = `/a/${params.accountId}/${params.projectId}`;

  if (!projectId) {
    throw new Response("Project ID required", { status: 400 });
  }

  const aggregatedData = await aggregateSalesBant({ supabase, projectId });

  return { aggregatedData, projectPath };
}

// ============================================================================
// Action - Create Task from Recommendation
// ============================================================================

export async function action({ context, params, request }: ActionFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;
  const userId = ctx.claims?.sub;

  if (!supabase || !userId) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const accountId = params.accountId as string;
  const projectId = params.projectId as string;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create-task") {
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const sourceInterview = formData.get("sourceInterview") as string;
    const sourceOrg = formData.get("sourceOrg") as string;
    const priority = formData.get("priority") as string;

    // Build description with source info
    const fullDescription = [
      description,
      "",
      `Source: ${sourceInterview}${sourceOrg ? ` (${sourceOrg})` : ""}`,
      "",
      "Created from AI recommendation in Sales BANT analysis.",
    ].join("\n");

    const task = await createTask({
      supabase,
      accountId,
      projectId,
      userId,
      data: {
        title,
        description: fullDescription,
        cluster: "Core product – intelligence",
        priority: priority === "high" ? 1 : priority === "medium" ? 2 : 3,
        tags: ["from-recommendation", "sales-bant"],
      },
    });

    return { success: true, taskId: task.id };
  }

  return { success: false };
}

// ============================================================================
// Main Component
// ============================================================================

// Date range options
const DATE_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default function AggregatedSalesBantPage() {
  const { aggregatedData, projectPath } = useLoaderData<typeof loader>();
  const routes = useProjectRoutes(projectPath);

  const [selectedField, setSelectedField] =
    useState<AggregatedFieldValue | null>(null);
  const [selectedObjection, setSelectedObjection] =
    useState<AggregatedObjection | null>(null);
  const [showAllInterviews, setShowAllInterviews] = useState(false);

  // Filter state
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("30");

  // Filter data based on selections
  const filteredData = useMemo(() => {
    const now = new Date();
    const cutoffDate =
      dateRangeFilter === "all"
        ? null
        : new Date(
            now.getTime() -
              Number.parseInt(dateRangeFilter) * 24 * 60 * 60 * 1000,
          );

    // Filter interviews by date
    const filteredInterviews = aggregatedData.interviews.filter((interview) => {
      if (cutoffDate && interview.processed_at) {
        const processedDate = new Date(interview.processed_at);
        if (processedDate < cutoffDate) {
          return false;
        }
      }
      return true;
    });

    const filteredInterviewIds = new Set(
      filteredInterviews.map((i) => i.interview_id),
    );

    // Filter other data based on filtered interviews
    const filterByInterviews = <
      T extends { interview_id?: string; interviews?: Array<{ id: string }> },
    >(
      items: T[],
    ): T[] => {
      return items.filter((item) => {
        if (item.interview_id) {
          return filteredInterviewIds.has(item.interview_id);
        }
        if (item.interviews) {
          return item.interviews.some((int) =>
            filteredInterviewIds.has(int.id),
          );
        }
        return true;
      });
    };

    return {
      ...aggregatedData,
      interviews: filteredInterviews,
      bant_fields: aggregatedData.bant_fields
        .map((field) => ({
          ...field,
          values: field.values.filter((v) =>
            filteredInterviewIds.has(v.interview_id),
          ),
        }))
        .filter((f) => f.values.length > 0),
      opportunity_fields: aggregatedData.opportunity_fields
        .map((field) => ({
          ...field,
          values: field.values.filter((v) =>
            filteredInterviewIds.has(v.interview_id),
          ),
        }))
        .filter((f) => f.values.length > 0),
      stakeholders: aggregatedData.stakeholders.filter((s) =>
        s.interviews.some((int) => filteredInterviewIds.has(int.id)),
      ),
      objections: aggregatedData.objections.filter((o) =>
        o.interviews.some((int) => filteredInterviewIds.has(int.id)),
      ),
      next_steps: aggregatedData.next_steps.filter((ns) =>
        filteredInterviewIds.has(ns.interview_id),
      ),
      recommendations: aggregatedData.recommendations.filter((r) =>
        filteredInterviewIds.has(r.interview_id),
      ),
      hygiene_gaps: aggregatedData.hygiene_gaps.filter((g) =>
        g.interviews.some((int) => filteredInterviewIds.has(int.id)),
      ),
      summary: {
        ...aggregatedData.summary,
        total_interviews: filteredInterviews.length,
      },
    };
  }, [aggregatedData, dateRangeFilter]);

  // Empty state
  if (aggregatedData.summary.total_interviews === 0) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-semibold text-lg">
              No Sales BANT analyses yet
            </h3>
            <p className="mb-4 max-w-md text-muted-foreground text-sm">
              Run the Sales BANT lens on conversations to see aggregated
              qualification data, stakeholders, and insights across your
              conversations.
            </p>
            <Button asChild>
              <Link to={routes.lenses.library()}>Configure Lenses</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        totalConversations={filteredData.summary.total_interviews}
        avgConfidence={filteredData.summary.avg_confidence}
        lastUpdated={filteredData.summary.last_updated}
      />

      {/* Filters - Date only, right-aligned */}
      <div className="flex justify-end">
        <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
          <SelectTrigger className="h-9 w-[140px] text-sm">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats - clickable to scroll to sections */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Conversations"
          value={filteredData.summary.total_interviews}
          icon={Target}
          href="#conversations"
        />
        <SummaryCard
          title="Stakeholders"
          value={filteredData.stakeholders.length}
          icon={Users}
          href="#stakeholders"
        />
        <SummaryCard
          title="Objections"
          value={filteredData.objections.length}
          icon={AlertTriangle}
          variant={filteredData.objections.length > 0 ? "warning" : "default"}
          href="#objections"
        />
        <SummaryCard
          title="Next Steps"
          value={filteredData.next_steps.length}
          icon={CheckCircle2}
          href="#next-steps"
        />
      </div>

      {/* BANT Fields */}
      {filteredData.bant_fields.length > 0 && (
        <BANTFieldsSection
          fields={filteredData.bant_fields}
          onSelect={setSelectedField}
          projectPath={projectPath}
        />
      )}

      {/* Opportunity Fields */}
      {filteredData.opportunity_fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDollarSign className="h-4 w-4" />
              Opportunity Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredData.opportunity_fields.map((field) => (
                <FieldCard
                  key={field.field_key}
                  field={field}
                  onSelect={setSelectedField}
                  projectPath={projectPath}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stakeholders & Objections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div id="stakeholders">
          <StakeholdersSection
            stakeholders={filteredData.stakeholders}
            projectPath={projectPath}
          />
        </div>
        <div id="objections">
          <ObjectionsSection
            objections={filteredData.objections}
            onSelect={setSelectedObjection}
          />
        </div>
      </div>

      {/* Next Steps */}
      {filteredData.next_steps.length > 0 && (
        <div id="next-steps">
          <NextStepsSection
            nextSteps={filteredData.next_steps}
            projectPath={projectPath}
          />
        </div>
      )}

      {/* Hygiene Gaps - only shows orgs with flagged gaps */}
      <HygieneGapsSection
        gaps={filteredData.hygiene_gaps}
        projectPath={projectPath}
      />

      {/* Recommendations */}
      {filteredData.recommendations.length > 0 && (
        <RecommendationsSection
          recommendations={filteredData.recommendations}
          projectPath={projectPath}
        />
      )}

      {/* Interview List */}
      <div id="conversations">
        <InterviewListSection
          interviews={filteredData.interviews}
          expanded={showAllInterviews}
          onToggle={() => setShowAllInterviews(!showAllInterviews)}
          projectPath={projectPath}
        />
      </div>

      {/* Drawers */}
      {selectedField && (
        <FieldDetailDrawer
          field={selectedField}
          onClose={() => setSelectedField(null)}
          projectPath={projectPath}
        />
      )}
      {selectedObjection && (
        <ObjectionDrawer
          objection={selectedObjection}
          onClose={() => setSelectedObjection(null)}
          projectPath={projectPath}
        />
      )}
    </div>
  );
}

// ============================================================================
// Page Header
// ============================================================================

function PageHeader({
  totalConversations,
  avgConfidence,
  lastUpdated,
}: {
  totalConversations?: number;
  avgConfidence?: number;
  lastUpdated?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-bold text-3xl">Sales BANT Analysis</h1>
        <p className="text-muted-foreground">
          Aggregated qualification data across {totalConversations || 0}{" "}
          conversation
          {totalConversations !== 1 ? "s" : ""}
        </p>
      </div>
      {avgConfidence != null && avgConfidence > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help text-right text-sm">
                <div className="text-muted-foreground">Avg Confidence</div>
                <div className="font-semibold">
                  {(avgConfidence * 100).toFixed(0)}%
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">
                <strong>AI Analysis Confidence</strong>
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Average confidence score from AI analysis across all{" "}
                {totalConversations} analyzed conversations. Higher confidence
                indicates clearer evidence in the transcripts for extracted data
                points.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ============================================================================
// Summary Card
// ============================================================================

function SummaryCard({
  title,
  value,
  icon: Icon,
  variant = "default",
  href,
}: {
  title: string;
  value: number;
  icon: any;
  variant?: "default" | "warning";
  href?: string;
}) {
  const content = (
    <Card
      className={cn(
        href && "cursor-pointer transition-colors hover:bg-muted/50",
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle
          className={cn(
            "flex items-center gap-2 text-base",
            variant === "warning" && "text-amber-600",
          )}
        >
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-bold text-3xl">{value}</div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  return content;
}

// ============================================================================
// BANT Fields Section
// ============================================================================

function BANTFieldsSection({
  fields,
  onSelect,
  projectPath,
}: {
  fields: AggregatedFieldValue[];
  onSelect: (f: AggregatedFieldValue) => void;
  projectPath: string;
}) {
  // Order: Budget, Authority, Need, Timeline
  const orderedKeys = ["budget", "authority", "need", "timeline"];
  const sortedFields = [...fields].sort(
    (a, b) =>
      orderedKeys.indexOf(a.field_key) - orderedKeys.indexOf(b.field_key),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          BANT Qualification
        </CardTitle>
        <CardDescription>
          Budget, Authority, Need, Timeline across conversations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sortedFields.map((field) => (
            <FieldCard
              key={field.field_key}
              field={field}
              onSelect={onSelect}
              projectPath={projectPath}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Field icon mapping
const FIELD_ICONS: Record<string, LucideIcon> = {
  // BANT
  budget: Wallet,
  authority: Crown,
  need: Crosshair,
  timeline: Calendar,
  // Opportunity
  deal_size: TrendingUp,
  competition: Swords,
  success_criteria: Trophy,
  blockers: Ban,
};

/**
 * Parse deal size values to extract numeric amounts
 * Handles formats like: "$50,000", "50K", "$50-100K", "around 50k", "approximately $25,000"
 */
function parseDealSizeValue(value: string): number | null {
  if (!value) return null;

  // Clean the string - remove $ and commas, lowercase
  const cleaned = value.replace(/[$,]/g, "").toLowerCase().trim();

  // Extract multiplier suffix (k = thousands, m = millions)
  const getMultiplier = (text: string): number => {
    if (/million|m\b/i.test(text)) return 1000000;
    if (/thousand|k\b/i.test(text)) return 1000;
    return 1;
  };

  // Try to find ranges first (e.g., "50-100k", "$50,000 to $100,000", "between 10k and 25k")
  const rangePatterns = [
    /(\d+(?:\.\d+)?)\s*(?:k|thousand|m|million)?\s*(?:[-–]|to|and)\s*(\d+(?:\.\d+)?)\s*(k|thousand|m|million)?/i,
    /between\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand|m|million)?\s*(?:and|[-–])\s*\$?\s*(\d+(?:\.\d+)?)\s*(k|thousand|m|million)?/i,
  ];

  for (const pattern of rangePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let low = Number.parseFloat(match[1]);
      let high = Number.parseFloat(match[2]);
      const suffix = match[3] || "";

      // Apply multiplier from suffix or context
      const multiplier = getMultiplier(suffix || cleaned);
      if (low < 1000 && multiplier > 1) low *= multiplier;
      if (high < 1000 && multiplier > 1) high *= multiplier;

      // If low is small and high is big, only multiply low
      if (low < 1000 && high >= 1000) {
        low *= 1000;
      }

      return (low + high) / 2;
    }
  }

  // Try single number patterns (e.g., "50k", "$50,000", "around 25000", "approximately $50k")
  const numberPatterns = [
    /(\d+(?:\.\d+)?)\s*(k|thousand|m|million)/i, // 50k, 1.5m, 50 thousand
    /(\d{4,})/i, // 4+ digit numbers = likely dollars
    /(\d+(?:\.\d+)?)/i, // Any number as last resort
  ];

  for (const pattern of numberPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let num = Number.parseFloat(match[1]);
      const suffix = match[2] || "";

      // Apply multiplier
      const multiplier = getMultiplier(suffix);
      if (multiplier > 1) {
        num *= multiplier;
      } else if (num < 1000 && /k\b/i.test(cleaned)) {
        // Fallback: if "k" appears anywhere and number is small
        num *= 1000;
      }

      // Only return if it seems like a reasonable deal size (>= $100)
      if (num >= 100) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Generate a summary of deal sizes
 * Shows numeric summary if amounts can be parsed, otherwise shows text preview
 */
function summarizeDealSizes(
  values: Array<{ value: string; organization_name: string | null }>,
): string {
  const parsed: number[] = [];
  const orgCount = new Set(
    values.map((v) => v.organization_name).filter(Boolean),
  ).size;

  for (const v of values) {
    const num = parseDealSizeValue(v.value);
    if (num !== null && num > 0) {
      parsed.push(num);
    }
  }

  const formatAmount = (n: number): string => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${Math.round(n / 1000)}K`;
    return `$${Math.round(n)}`;
  };

  // If we have parsed numeric values, show the summary
  if (parsed.length > 0) {
    const min = Math.min(...parsed);
    const max = Math.max(...parsed);
    const avg = parsed.reduce((a, b) => a + b, 0) / parsed.length;

    if (parsed.length === 1) {
      return formatAmount(parsed[0]);
    }

    if (min === max) {
      return `${formatAmount(avg)} (${parsed.length} deals)`;
    }

    return `${formatAmount(min)} – ${formatAmount(max)}, avg ${formatAmount(avg)}`;
  }

  // No numeric values parsed - show a text preview instead
  if (values.length > 0) {
    // Get unique text values (truncated)
    const uniqueValues = [
      ...new Set(values.map((v) => v.value.trim()).filter(Boolean)),
    ];
    if (uniqueValues.length === 1) {
      const text = uniqueValues[0];
      return text.length > 40 ? `${text.slice(0, 40)}...` : text;
    }
    return `${orgCount} org${orgCount !== 1 ? "s" : ""} (see details)`;
  }

  return "Not captured";
}

function FieldCard({
  field,
  onSelect,
  projectPath,
}: {
  field: AggregatedFieldValue;
  onSelect: (f: AggregatedFieldValue) => void;
  projectPath: string;
}) {
  const routes = useProjectRoutes(projectPath);
  const Icon = FIELD_ICONS[field.field_key];
  const valueCount = field.values.length;

  // Get unique organizations with their IDs
  const orgsMap = new Map<string, { id: string | null; name: string }>();
  for (const v of field.values) {
    if (v.organization_name && !orgsMap.has(v.organization_name)) {
      orgsMap.set(v.organization_name, {
        id: v.organization_id,
        name: v.organization_name,
      });
    }
  }
  const orgList = Array.from(orgsMap.values()).slice(0, 3);
  const totalOrgs = orgsMap.size;

  // For deal_size field, show summarized amounts
  const isDealSize = field.field_key === "deal_size";

  // Show coverage text or deal size summary
  const getCoverageText = () => {
    if (valueCount === 0) return "No data captured";

    // For deal_size, show summarized amounts
    if (isDealSize) {
      return summarizeDealSizes(field.values);
    }

    if (totalOrgs === 0)
      return `${valueCount} response${valueCount !== 1 ? "s" : ""}`;
    if (totalOrgs === 1) return `Confirmed for ${orgList[0].name}`;
    return `Confirmed for ${totalOrgs} org${totalOrgs !== 1 ? "s" : ""}`;
  };

  return (
    <button
      onClick={() => onSelect(field)}
      className="relative rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50"
    >
      {totalOrgs > 0 && (
        <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
          {totalOrgs} org{totalOrgs !== 1 ? "s" : ""}
        </Badge>
      )}
      <div className="mb-1 flex items-center gap-2 font-medium text-sm">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {field.field_name}
      </div>
      <div
        className={cn(
          "mb-1 pr-12 text-xs",
          isDealSize
            ? "font-semibold text-foreground"
            : "text-muted-foreground",
        )}
      >
        {getCoverageText()}
      </div>
      {orgList.length > 0 && (
        <div
          className="flex flex-wrap gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {orgList.map((org) =>
            org.id ? (
              <Link key={org.name} to={routes.organizations.detail(org.id)}>
                <Badge
                  variant="outline"
                  className="cursor-pointer text-xs transition-colors hover:bg-muted"
                >
                  <Building2 className="mr-1 h-3 w-3" />
                  {org.name}
                </Badge>
              </Link>
            ) : (
              <Badge key={org.name} variant="outline" className="text-xs">
                <Building2 className="mr-1 h-3 w-3" />
                {org.name}
              </Badge>
            ),
          )}
          {totalOrgs > 3 && (
            <Badge variant="outline" className="text-xs">
              +{totalOrgs - 3} more
            </Badge>
          )}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Stakeholders Section
// ============================================================================

function StakeholdersSection({
  stakeholders,
  projectPath,
}: {
  stakeholders: AggregatedStakeholder[];
  projectPath: string;
}) {
  const routes = useProjectRoutes(projectPath);

  if (stakeholders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Stakeholders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No stakeholders identified yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Stakeholders
        </CardTitle>
        <CardDescription>
          {stakeholders.length} people identified
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stakeholders.slice(0, 8).map((stakeholder, i) => {
            // Get first organization from interviews
            const orgName = stakeholder.interviews.find(
              (int) => int.organization_name,
            )?.organization_name;
            const hasPersonLink = !!stakeholder.person_id;

            const content = (
              <div className="flex w-full flex-row items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{stakeholder.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {stakeholder.role || "Role unknown"}
                    {stakeholder.influence &&
                      ` • ${stakeholder.influence} influence`}
                    {orgName && ` • ${orgName}`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {stakeholder.labels.slice(0, 2).map((label) => (
                    <Badge key={label} variant="outline" className="text-xs">
                      {label.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
                {hasPersonLink && (
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>
            );

            if (hasPersonLink) {
              return (
                <Link key={i} to={routes.people.detail(stakeholder.person_id!)}>
                  {content}
                </Link>
              );
            }

            return (
              <div key={i} className="opacity-75">
                {content}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Objections Section
// ============================================================================

function ObjectionsSection({
  objections,
  onSelect,
}: {
  objections: AggregatedObjection[];
  onSelect: (o: AggregatedObjection) => void;
}) {
  if (objections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <XCircle className="h-4 w-4 text-red-500" />
            Objections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No objections identified yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <XCircle className="h-4 w-4 text-red-500" />
          Objections
        </CardTitle>
        <CardDescription>Concerns raised across conversations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {objections.slice(0, 8).map((objection, i) => {
            const orgName = objection.interviews.find(
              (int) => int.organization_name,
            )?.organization_name;
            return (
              <button
                key={i}
                onClick={() => onSelect(objection)}
                className="relative flex w-full items-start rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"
              >
                <Badge
                  variant="secondary"
                  className="absolute top-2 right-2 text-xs"
                >
                  {objection.count}
                </Badge>
                <div className="flex-1 pr-10">
                  <div className="text-sm">{objection.objection}</div>
                  <div className="text-muted-foreground text-xs">
                    {objection.type}
                    {objection.status && ` • ${objection.status}`}
                    {orgName && ` • ${orgName}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Next Steps Section
// ============================================================================

function NextStepsSection({
  nextSteps,
  projectPath,
}: {
  nextSteps: AggregatedSalesBant["next_steps"];
  projectPath: string;
}) {
  const routes = useProjectRoutes(projectPath);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Next Steps
        </CardTitle>
        <CardDescription>
          {nextSteps.length} action items identified
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {nextSteps.slice(0, 10).map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border bg-card p-3"
            >
              <div className="flex-1">
                <div className="text-sm">{step.description}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                  {step.owner && <span>Owner: {step.owner}</span>}
                  {step.priority && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        step.priority === "high" &&
                          "border-red-200 text-red-600",
                        step.priority === "medium" &&
                          "border-yellow-200 text-yellow-600",
                      )}
                    >
                      {step.priority}
                    </Badge>
                  )}
                  <Link
                    to={routes.interviews.detail(step.interview_id)}
                    className="text-primary hover:underline"
                  >
                    {step.interview_title}
                  </Link>
                  {step.organization_name && (
                    <span className="text-muted-foreground">
                      ({step.organization_name})
                    </span>
                  )}
                </div>
              </div>
              {step.task_id && (
                <Link to={routes.tasks.detail(step.task_id)}>
                  <Badge variant="secondary" className="text-xs">
                    Task
                  </Badge>
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Hygiene Gaps Section - Shows missing information flagged by AI
// ============================================================================

// Map AI hygiene codes to display labels
const GAP_CODE_LABELS: Record<string, { label: string; description: string }> =
  {
    missing_budget: {
      label: "Budget",
      description: "No budget or pricing discussion captured",
    },
    missing_authority: {
      label: "Authority",
      description: "Decision maker not identified",
    },
    missing_need: {
      label: "Need",
      description: "Core pain/need not clearly articulated",
    },
    missing_timeline: {
      label: "Timeline",
      description: "No timeline or urgency mentioned",
    },
    missing_deal_size: {
      label: "Deal Size",
      description: "No deal value or contract size mentioned",
    },
    no_champion: {
      label: "Champion",
      description: "No internal advocate identified",
    },
    unaddressed_objection: {
      label: "Objection",
      description: "Objection raised but not resolved",
    },
  };

function HygieneGapsSection({
  gaps,
  projectPath,
}: {
  gaps: AggregatedSalesBant["hygiene_gaps"];
  projectPath: string;
}) {
  const routes = useProjectRoutes(projectPath);

  // Only show if there are actual gaps
  if (!gaps || gaps.length === 0) {
    return null;
  }

  // Build a map of org -> gap codes that are flagged for that org
  const orgGapMap = new Map<
    string,
    { id: string | null; name: string; gapCodes: Set<string> }
  >();

  for (const gap of gaps) {
    for (const interview of gap.interviews) {
      if (interview.organization_name) {
        const existing = orgGapMap.get(interview.organization_name);
        if (existing) {
          existing.gapCodes.add(gap.code);
          if (!existing.id && interview.organization_id) {
            existing.id = interview.organization_id;
          }
        } else {
          orgGapMap.set(interview.organization_name, {
            id: interview.organization_id,
            name: interview.organization_name,
            gapCodes: new Set([gap.code]),
          });
        }
      }
    }
  }

  // Get unique gap codes that exist in the data
  const activeGapCodes = [...new Set(gaps.map((g) => g.code))].filter(
    (code) => GAP_CODE_LABELS[code],
  );

  // Sort orgs by number of gaps (most gaps first)
  const sortedOrgs = Array.from(orgGapMap.values())
    .filter((org) => org.gapCodes.size > 0)
    .sort((a, b) => b.gapCodes.size - a.gapCodes.size);

  if (sortedOrgs.length === 0 || activeGapCodes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Information Gaps
        </CardTitle>
        <CardDescription>
          Missing information flagged by AI analysis ({sortedOrgs.length} org
          {sortedOrgs.length !== 1 ? "s" : ""} with gaps)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-medium">
                  Organization
                </th>
                {activeGapCodes.map((code) => {
                  const info = GAP_CODE_LABELS[code];
                  return (
                    <th
                      key={code}
                      className="px-2 py-2 text-center font-medium"
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help text-xs">
                              {info?.label || code}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-sm">
                              {info?.description || code}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </th>
                  );
                })}
                <th className="py-2 pl-4 text-right font-medium text-xs">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedOrgs.map((org) => (
                <tr key={org.name} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    {org.id ? (
                      <Link
                        to={routes.organizations.detail(org.id)}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{org.name}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{org.name}</span>
                      </div>
                    )}
                  </td>
                  {activeGapCodes.map((code) => (
                    <td key={code} className="px-2 py-3 text-center">
                      {org.gapCodes.has(code) ? (
                        <XCircle className="mx-auto h-5 w-5 text-red-500" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                  <td className="py-3 pl-4 text-right">
                    <Badge variant="destructive" className="text-xs">
                      {org.gapCodes.size}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Summary by gap type */}
        <div className="mt-4 border-t pt-3">
          <div className="mb-2 text-muted-foreground text-xs">
            Gap frequency:
          </div>
          <div className="flex flex-wrap gap-2">
            {gaps
              .filter((g) => GAP_CODE_LABELS[g.code])
              .sort((a, b) => b.count - a.count)
              .map((gap) => (
                <Badge key={gap.code} variant="outline" className="text-xs">
                  {GAP_CODE_LABELS[gap.code]?.label}: {gap.count}
                </Badge>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Recommendations Section
// ============================================================================

function RecommendationsSection({
  recommendations,
  projectPath,
}: {
  recommendations: AggregatedSalesBant["recommendations"];
  projectPath: string;
}) {
  const routes = useProjectRoutes(projectPath);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Recommendations</CardTitle>
        <CardDescription>
          Suggested actions based on analysis - create tasks to track follow-ups
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recommendations.slice(0, 8).map((rec, i) => (
            <RecommendationCard key={i} rec={rec} routes={routes} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({
  rec,
  routes,
}: {
  rec: AggregatedSalesBant["recommendations"][number];
  routes: ReturnType<typeof useProjectRoutes>;
}) {
  const fetcher = useFetcher();
  const isCreating = fetcher.state !== "idle";
  const wasCreated = fetcher.data?.success === true;

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="flex-1">
        <div className="text-sm">{rec.description}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          <Badge variant="outline" className="text-xs">
            {rec.type}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              rec.priority === "high" && "border-red-200 text-red-600",
            )}
          >
            {rec.priority}
          </Badge>
          <Link
            to={routes.interviews.detail(rec.interview_id)}
            className="text-primary hover:underline"
          >
            {rec.interview_title}
          </Link>
          {rec.organization_name && (
            <span className="text-muted-foreground">
              ({rec.organization_name})
            </span>
          )}
        </div>
      </div>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="create-task" />
        <input
          type="hidden"
          name="title"
          value={rec.description.slice(0, 100)}
        />
        <input type="hidden" name="description" value={rec.description} />
        <input
          type="hidden"
          name="sourceInterview"
          value={rec.interview_title}
        />
        <input
          type="hidden"
          name="sourceOrg"
          value={rec.organization_name || ""}
        />
        <input type="hidden" name="priority" value={rec.priority} />
        {wasCreated && fetcher.data?.taskId ? (
          <Link to={routes.tasks.detail(fetcher.data.taskId)}>
            <Badge variant="secondary" className="gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Task Created
            </Badge>
          </Link>
        ) : (
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            disabled={isCreating}
          >
            <ListPlus className="h-3 w-3" />
            {isCreating ? "Creating..." : "Create Task"}
          </Button>
        )}
      </fetcher.Form>
    </div>
  );
}

// ============================================================================
// Conversation List Section
// ============================================================================

function InterviewListSection({
  interviews,
  expanded,
  onToggle,
  projectPath,
}: {
  interviews: InterviewWithLensAnalysis[];
  expanded: boolean;
  onToggle: () => void;
  projectPath: string;
}) {
  const routes = useProjectRoutes(projectPath);
  const displayedInterviews = expanded ? interviews : interviews.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Analyzed Conversations</CardTitle>
        <CardDescription>
          {interviews.length} conversation{interviews.length !== 1 ? "s" : ""}{" "}
          with Sales BANT analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {displayedInterviews.map((interview) => (
            <Link
              key={interview.interview_id}
              to={routes.interviews.detail(interview.interview_id)}
              className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm">
                  {interview.interview_title}
                </div>
                <div className="text-muted-foreground text-xs">
                  {interview.organization_name && (
                    <span>{interview.organization_name} • </span>
                  )}
                  {interview.interviewee_name && (
                    <span>{interview.interviewee_name} • </span>
                  )}
                  {interview.interview_date &&
                    new Date(interview.interview_date).toLocaleDateString()}
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2">
                {interview.confidence_score != null && (
                  <Badge variant="outline">
                    {(interview.confidence_score * 100).toFixed(0)}%
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
        {interviews.length > 5 && (
          <Button variant="ghost" onClick={onToggle} className="mt-3 w-full">
            {expanded ? (
              <>
                Show Less <ChevronDown className="ml-1 h-4 w-4 rotate-180" />
              </>
            ) : (
              <>
                Show All {interviews.length} Conversations{" "}
                <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Drawers
// ============================================================================

function FieldDetailDrawer({
  field,
  onClose,
  projectPath,
}: {
  field: AggregatedFieldValue;
  onClose: () => void;
  projectPath: string;
}) {
  const routes = useProjectRoutes(projectPath);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="slide-in-from-right h-full w-full max-w-md animate-in bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b p-4">
            <div>
              <h3 className="font-semibold">{field.field_name}</h3>
              <p className="text-muted-foreground text-sm">
                {field.values.length} responses
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {field.values.map((v, i) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <p className="text-sm">{v.value}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <Link
                      to={routes.interviews.detail(v.interview_id)}
                      className="text-primary hover:underline"
                    >
                      {v.interview_title}
                    </Link>
                    {v.organization_name && (
                      <span className="text-muted-foreground">
                        ({v.organization_name})
                      </span>
                    )}
                    <Badge variant="outline" className="ml-auto">
                      {(v.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function ObjectionDrawer({
  objection,
  onClose,
  projectPath,
}: {
  objection: AggregatedObjection;
  onClose: () => void;
  projectPath: string;
}) {
  const routes = useProjectRoutes(projectPath);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="slide-in-from-right h-full w-full max-w-md animate-in bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b p-4">
            <div>
              <h3 className="font-semibold">{objection.objection}</h3>
              <p className="text-muted-foreground text-sm">
                {objection.type}
                {objection.status && ` • ${objection.status}`}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <h4 className="mb-2 font-medium text-sm">Raised in</h4>
            <div className="space-y-2">
              {objection.interviews.map((int) => (
                <Link
                  key={int.id}
                  to={routes.interviews.detail(int.id)}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{int.title}</div>
                    {int.organization_name && (
                      <div className="text-muted-foreground text-xs">
                        {int.organization_name}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
