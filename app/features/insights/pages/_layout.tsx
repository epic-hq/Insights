import consola from "consola";
import { Loader2, MoreVertical, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useFetcher, useLoaderData, useRevalidator } from "react-router-dom";
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
import { useCurrentProject } from "~/contexts/current-project-context";
import { ConsolidateProgressBar } from "~/features/insights/components/ConsolidateProgressBar";
import { InsightsExplainerCard } from "~/features/insights/components/InsightsExplainerCard";
import { InsightsSettingsModal } from "~/features/insights/components/InsightsSettingsModal";
import { useConsolidateProgress } from "~/features/insights/hooks/useConsolidateProgress";
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
	const [themesResult, evidenceResult, interviewsResult, projectResult] = await Promise.all([
		supabase.from("themes").select("id", { count: "exact", head: true }).eq("project_id", projectId),
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
		supabase.from("projects").select("project_settings").eq("id", projectId).single(),
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
	const { insightCount, evidenceCount, interviewCount, analysisSettings, hasConsolidated } =
		useLoaderData<typeof loader>();
	const revalidator = useRevalidator();
	const { projectPath, projectId, accountId } = useCurrentProject();
	const consolidateFetcher = useFetcher();
	const enrichFetcher = useFetcher();
	const deleteFetcher = useFetcher();

	// Track refresh all flow: consolidate → delete → enrich
	const [refreshStep, setRefreshStep] = useState<"idle" | "consolidate" | "delete" | "enrich">("idle");

	// Real-time consolidation progress tracking
	const [consolidateRunId, setConsolidateRunId] = useState<string | null>(null);
	const [consolidateToken, setConsolidateToken] = useState<string | null>(null);

	// Continue Refresh All flow after consolidation completes
	const continueRefreshFlow = useCallback(() => {
		revalidator.revalidate();
		if (refreshStep === "consolidate") {
			setRefreshStep("delete");
			deleteFetcher.submit({ project_id: projectId! }, { method: "POST", action: "/api/delete-empty-themes" });
		}
	}, [revalidator, refreshStep, projectId, deleteFetcher]);

	// Handle consolidation complete - revalidate page data and continue Refresh flow
	const handleConsolidateComplete = useCallback(() => {
		continueRefreshFlow();
	}, [continueRefreshFlow]);

	// Subscribe to consolidation progress
	const { progressInfo: consolidateProgress } = useConsolidateProgress({
		runId: consolidateRunId,
		accessToken: consolidateToken,
		onComplete: handleConsolidateComplete,
	});

	// Derived state
	const isConsolidatingTask =
		consolidateRunId !== null && !consolidateProgress.isComplete && !consolidateProgress.hasError;
	const isConsolidating = consolidateFetcher.state !== "idle" || isConsolidatingTask;
	const isEnriching = enrichFetcher.state !== "idle";
	const isDeleting = deleteFetcher.state !== "idle";
	const isRefreshing = refreshStep !== "idle";
	const isAnyLoading = isConsolidating || isEnriching || isDeleting;

	// Handle consolidation API response from Actions menu (returns runId)
	useEffect(() => {
		if (consolidateFetcher.data && consolidateFetcher.state === "idle") {
			const data = consolidateFetcher.data as {
				ok?: boolean;
				runId?: string;
				error?: string;
			};
			if (data.ok && data.runId) {
				fetch("/api/trigger-run-token", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ runId: data.runId }),
				})
					.then((res) => res.json())
					.then(({ token }) => {
						if (token) {
							setConsolidateRunId(data.runId!);
							setConsolidateToken(token);
						} else {
							setTimeout(() => continueRefreshFlow(), 5000);
						}
					})
					.catch(() => {
						setTimeout(() => continueRefreshFlow(), 5000);
					});
			} else if (data.error) {
				toast.error(data.error);
				setRefreshStep("idle");
			}
		}
	}, [consolidateFetcher.data, consolidateFetcher.state, continueRefreshFlow]);

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
				if (refreshStep === "delete") {
					setRefreshStep("enrich");
					enrichFetcher.submit(
						{
							project_id: projectId!,
							account_id: accountId!,
							max_themes: "50",
						},
						{ method: "POST", action: "/api/enrich-themes" }
					);
				}
			} else if (data.error) {
				toast.error(data.error);
				setRefreshStep("idle");
			}
		}
	}, [deleteFetcher.data, deleteFetcher.state, refreshStep, projectId, accountId]);

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
		const threshold = analysisSettings?.theme_dedup_threshold ?? 0.85;
		consolidateFetcher.submit(
			{
				project_id: projectId,
				account_id: accountId,
				similarity_threshold: threshold.toString(),
			},
			{ method: "POST", action: "/api/consolidate-themes" }
		);
	};

	const handleEnrichThemes = () => {
		if (!projectId || !accountId) return;
		enrichFetcher.submit(
			{ project_id: projectId, account_id: accountId, max_themes: "50" },
			{ method: "POST", action: "/api/enrich-themes" }
		);
	};

	const handleDeleteEmptyThemes = () => {
		if (!projectId) return;
		if (!confirm("Delete all themes with 0 linked evidence? This cannot be undone.")) return;
		deleteFetcher.submit({ project_id: projectId }, { method: "POST", action: "/api/delete-empty-themes" });
	};

	const handleRefreshAll = () => {
		if (!projectId || !accountId) return;
		setRefreshStep("consolidate");
		const threshold = analysisSettings?.theme_dedup_threshold ?? 0.85;
		consolidateFetcher.submit(
			{
				project_id: projectId,
				account_id: accountId,
				similarity_threshold: threshold.toString(),
			},
			{ method: "POST", action: "/api/consolidate-themes" }
		);
	};

	const handleDismissProgress = useCallback(() => {
		setConsolidateRunId(null);
		setConsolidateToken(null);
	}, []);

	return (
		<PageContainer className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1.5">
					<div className="flex items-center gap-3">
						<h1 className="font-semibold text-3xl text-foreground">Insights</h1>
						{/* <Badge variant="secondary" className="text-sm">
              {insightCount} themes
            </Badge>
            <Badge variant="outline" className="text-muted-foreground text-sm">
              {evidenceCount} evidence
            </Badge> */}
					</div>
				</div>
				<div className="flex items-center gap-3">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" disabled={isAnyLoading || !projectId} className="gap-2">
								{isAnyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
								Actions
								{isRefreshing && (
									<span className="text-muted-foreground text-xs">
										({refreshStep === "consolidate" ? "1/3" : refreshStep === "delete" ? "2/3" : "3/3"})
									</span>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuItem onClick={handleRefreshAll} disabled={isAnyLoading} className="gap-2">
								<RefreshCw className="h-4 w-4" />
								<div className="flex flex-col">
									<span>Refresh All</span>
									<span className="text-muted-foreground text-xs">Consolidate → Clean → Enrich</span>
								</div>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={handleConsolidateThemes} disabled={isConsolidating} className="gap-2">
								<Sparkles className="h-4 w-4" />
								<div className="flex flex-col">
									<span>Consolidate Themes</span>
									<span className="text-muted-foreground text-xs">Merge similar themes</span>
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleDeleteEmptyThemes} disabled={isDeleting} className="gap-2">
								<Trash2 className="h-4 w-4" />
								<div className="flex flex-col">
									<span>Delete Empty</span>
									<span className="text-muted-foreground text-xs">Remove themes with 0 evidence</span>
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleEnrichThemes} disabled={isEnriching} className="gap-2">
								<Wand2 className="h-4 w-4" />
								<div className="flex flex-col">
									<span>Enrich Themes</span>
									<span className="text-muted-foreground text-xs">Add pain points, JTBD, categories</span>
								</div>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{/* Settings Modal */}
					{projectId && accountId && (
						<InsightsSettingsModal projectId={projectId} accountId={accountId} currentSettings={analysisSettings} />
					)}
				</div>
			</div>

			{/* Real-time consolidation progress */}
			{consolidateRunId && <ConsolidateProgressBar progress={consolidateProgress} onDismiss={handleDismissProgress} />}

			{/* Explainer Card - Shows guidance based on insights state */}
			{projectId && accountId && (
				<InsightsExplainerCard
					interviewCount={interviewCount ?? 0}
					themeCount={insightCount}
					evidenceCount={evidenceCount}
					projectId={projectId}
					accountId={accountId}
					hasConsolidated={hasConsolidated}
					similarityThreshold={analysisSettings?.theme_dedup_threshold ?? 0.85}
				/>
			)}

			{/* Outlet content */}
			<Outlet />
		</PageContainer>
	);
}
