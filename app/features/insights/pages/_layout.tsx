import consola from "consola";
import {
  LayoutGrid,
  Loader2,
  MoreVertical,
  RefreshCw,
  Rows,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import {
  Outlet,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { toast } from "sonner";
import { PageContainer } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useCurrentProject } from "~/contexts/current-project-context";
import { InsightsExplainerCard } from "~/features/themes/components/InsightsExplainerCard";
import { InsightsSettingsModal } from "~/features/themes/components/InsightsSettingsModal";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { currentProjectContext } from "~/server/current-project-context";
import { userContext } from "~/server/user-context";

export async function loader({ context, params }: LoaderFunctionArgs) {
  const { supabase } = context.get(userContext);
  const ctx_project = context.get(currentProjectContext);
  // Use context projectId, fallback to URL params (same pattern as table.tsx)
  const projectId = ctx_project.projectId || params.projectId || "";

  if (!projectId || !supabase) {
    consola.warn("[InsightsLayout] Missing projectId or supabase:", {
      projectId: !!projectId,
      supabase: !!supabase,
    });
    return { insightCount: 0, evidenceCount: 0 };
  }

  // Get counts for the header and explainer card
  const [themesResult, evidenceResult, interviewsResult, projectResult] =
    await Promise.all([
      supabase
        .from("themes")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("evidence")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .or("is_question.is.null,is_question.eq.false"),
      supabase
        .from("interviews")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "ready"),
      supabase
        .from("projects")
        .select("project_settings")
        .eq("id", projectId)
        .single(),
    ]);

  consola.log("[InsightsLayout] Count query results:", {
    projectId,
    themesCount: themesResult.count,
    themesError: themesResult.error?.message,
    evidenceCount: evidenceResult.count,
    evidenceError: evidenceResult.error?.message,
  });

  // Extract analysis settings and consolidation state from project_settings
  const projectSettings = projectResult.data?.project_settings as {
    analysis?: {
      theme_dedup_threshold?: number;
      evidence_link_threshold?: number;
    };
    insights_consolidated_at?: string;
  } | null;

  return {
    insightCount: themesResult.count ?? 0,
    evidenceCount: evidenceResult.count ?? 0,
    interviewCount: interviewsResult.count ?? 0,
    analysisSettings: projectSettings?.analysis,
    hasConsolidated: Boolean(projectSettings?.insights_consolidated_at),
  };
}

export default function InsightsLayout() {
  const {
    insightCount,
    evidenceCount,
    interviewCount,
    analysisSettings,
    hasConsolidated,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectPath, projectId, accountId } = useCurrentProject();
  const routes = useProjectRoutes(projectPath || "");
  const consolidateFetcher = useFetcher();
  const enrichFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  // Track refresh all flow: consolidate → delete → enrich
  const [refreshStep, setRefreshStep] = useState<
    "idle" | "consolidate" | "delete" | "enrich"
  >("idle");

  const isConsolidating = consolidateFetcher.state !== "idle";
  const isEnriching = enrichFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";
  const isRefreshing = refreshStep !== "idle";
  const isAnyLoading = isConsolidating || isEnriching || isDeleting;

  // Handle consolidation response
  useEffect(() => {
    if (consolidateFetcher.data && consolidateFetcher.state === "idle") {
      const data = consolidateFetcher.data as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (data.ok) {
        toast.success(
          data.message || "Themes have been consolidated successfully.",
        );
        // If in refresh flow, move to next step
        if (refreshStep === "consolidate") {
          setRefreshStep("delete");
          deleteFetcher.submit(
            { project_id: projectId! },
            { method: "POST", action: "/api/delete-empty-themes" },
          );
        }
      } else if (data.error) {
        toast.error(data.error);
        setRefreshStep("idle");
      }
    }
  }, [
    consolidateFetcher.data,
    consolidateFetcher.state,
    refreshStep,
    projectId,
  ]);

  // Handle delete response
  useEffect(() => {
    if (deleteFetcher.data && deleteFetcher.state === "idle") {
      const data = deleteFetcher.data as {
        ok?: boolean;
        deleted?: number;
        message?: string;
        error?: string;
      };
      if (data.ok) {
        toast.success(data.message || `Deleted ${data.deleted} empty themes`);
        // If in refresh flow, move to next step
        if (refreshStep === "delete") {
          setRefreshStep("enrich");
          enrichFetcher.submit(
            {
              project_id: projectId!,
              account_id: accountId!,
              max_themes: "50",
            },
            { method: "POST", action: "/api/enrich-themes" },
          );
        }
      } else if (data.error) {
        toast.error(data.error);
        setRefreshStep("idle");
      }
    }
  }, [
    deleteFetcher.data,
    deleteFetcher.state,
    refreshStep,
    projectId,
    accountId,
  ]);

  // Handle enrich response
  useEffect(() => {
    if (enrichFetcher.data && enrichFetcher.state === "idle") {
      const data = enrichFetcher.data as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      if (data.success) {
        toast.success(data.message || "Theme enrichment started.");
        // End refresh flow
        if (refreshStep === "enrich") {
          setRefreshStep("idle");
          toast.success("Refresh complete!");
        }
      } else if (data.error) {
        toast.error(data.error);
        setRefreshStep("idle");
      }
    }
  }, [enrichFetcher.data, enrichFetcher.state, refreshStep]);

  const handleConsolidateThemes = () => {
    if (!projectId || !accountId) return;
    consolidateFetcher.submit(
      { project_id: projectId, account_id: accountId },
      { method: "POST", action: "/api/consolidate-themes" },
    );
  };

  const handleEnrichThemes = () => {
    if (!projectId || !accountId) return;
    enrichFetcher.submit(
      { project_id: projectId, account_id: accountId, max_themes: "50" },
      { method: "POST", action: "/api/enrich-themes" },
    );
  };

  const handleDeleteEmptyThemes = () => {
    if (!projectId) return;
    if (
      !confirm(
        "Delete all themes with 0 linked evidence? This cannot be undone.",
      )
    )
      return;
    deleteFetcher.submit(
      { project_id: projectId },
      { method: "POST", action: "/api/delete-empty-themes" },
    );
  };

  // Refresh All: runs consolidate → delete → enrich in sequence
  const handleRefreshAll = () => {
    if (!projectId || !accountId) return;
    setRefreshStep("consolidate");
    toast.info("Starting refresh: consolidating themes...");
    consolidateFetcher.submit(
      { project_id: projectId, account_id: accountId },
      { method: "POST", action: "/api/consolidate-themes" },
    );
  };

  // Determine the active view based on the current URL path
  const getActiveView = () => {
    const path = location.pathname;
    if (path.endsWith("/insights/table")) return "table";
    return "cards"; // Default to cards view (quick)
  };

  // Handle view change by navigating to the appropriate route
  const handleViewChange = (value: string) => {
    switch (value) {
      case "cards":
        navigate(routes.insights.quick());
        break;
      case "table":
        navigate(routes.insights.table());
        break;
      default:
        navigate(routes.insights.quick());
    }
  };

  return (
    <PageContainer className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-3xl text-foreground">Insights</h1>
            <Badge variant="secondary" className="text-sm">
              {insightCount} themes
            </Badge>
            <Badge variant="outline" className="text-muted-foreground text-sm">
              {evidenceCount} evidence
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isAnyLoading || !projectId}
                className="gap-2"
              >
                {isAnyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreVertical className="h-4 w-4" />
                )}
                Actions
                {isRefreshing && (
                  <span className="text-muted-foreground text-xs">
                    (
                    {refreshStep === "consolidate"
                      ? "1/3"
                      : refreshStep === "delete"
                        ? "2/3"
                        : "3/3"}
                    )
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={handleRefreshAll}
                disabled={isAnyLoading}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>Refresh All</span>
                  <span className="text-muted-foreground text-xs">
                    Consolidate → Clean → Enrich
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleConsolidateThemes}
                disabled={isConsolidating}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>Consolidate Themes</span>
                  <span className="text-muted-foreground text-xs">
                    Merge similar themes
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteEmptyThemes}
                disabled={isDeleting}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>Delete Empty</span>
                  <span className="text-muted-foreground text-xs">
                    Remove themes with 0 evidence
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleEnrichThemes}
                disabled={isEnriching}
                className="gap-2"
              >
                <Wand2 className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>Enrich Themes</span>
                  <span className="text-muted-foreground text-xs">
                    Add pain points, JTBD, categories
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Settings Modal */}
          {projectId && accountId && (
            <InsightsSettingsModal
              projectId={projectId}
              accountId={accountId}
              currentSettings={analysisSettings}
            />
          )}
          <ToggleGroup
            type="single"
            value={getActiveView()}
            onValueChange={(next) => next && handleViewChange(next)}
            size="sm"
            className="shrink-0"
          >
            <ToggleGroupItem
              value="cards"
              aria-label="Cards view"
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </ToggleGroupItem>
            <ToggleGroupItem
              value="table"
              aria-label="Table view"
              className="gap-2"
            >
              <Rows className="h-4 w-4" />
              Table
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Explainer Card - Shows guidance based on insights state */}
      {projectId && accountId && (
        <InsightsExplainerCard
          interviewCount={interviewCount}
          themeCount={insightCount}
          evidenceCount={evidenceCount}
          projectId={projectId}
          accountId={accountId}
          hasConsolidated={hasConsolidated}
        />
      )}

      {/* Outlet content */}
      <Outlet />
    </PageContainer>
  );
}
