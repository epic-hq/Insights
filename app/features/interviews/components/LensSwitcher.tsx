/**
 * LensSwitcher — dropdown selector that shows one lens at a time,
 * replacing the LensAccordion's stacked vertical layout.
 */
import { CheckCircle2, ChevronDown, Clock, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useMemo } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { GenericLensView } from "~/features/lenses/components/GenericLensView";
import { LensSelector } from "~/features/lenses/components/LensSelector";
import type { LensAnalysisWithTemplate, LensTemplate } from "~/features/lenses/lib/loadLensAnalyses.server";
import { cn } from "~/lib/utils";

type EvidenceRecord = {
	id: string;
	anchors?: unknown;
	start_ms?: number | null;
	gist?: string | null;
};

interface LensSwitcherProps {
	interviewId: string;
	templates: LensTemplate[];
	analyses: Record<string, LensAnalysisWithTemplate>;
	editable?: boolean;
	evidenceMap?: Map<string, EvidenceRecord>;
	onLensApplied?: () => void;
	/** Currently selected lens key from URL state */
	selectedLensKey?: string | null;
	/** Callback when user selects a different lens */
	onLensChange?: (templateKey: string) => void;
}

function analysisHasData(analysis: LensAnalysisWithTemplate | undefined): boolean {
	if (!analysis) return false;
	if (analysis.status !== "completed") return false;

	const data = analysis.analysis_data;
	if (!data) return false;

	const sections = data.sections || [];
	const hasFieldData = sections.some((section: any) => {
		const fields = section.fields || [];
		return fields.some((field: any) => field.value !== null && field.value !== undefined && field.value !== "");
	});

	const hasEntities = (data.entities || []).length > 0;
	const hasRecommendations = (data.recommendations || []).length > 0;
	const hasKeyInsights = (data.key_insights || []).length > 0;
	const hasHygiene = (data.hygiene || []).length > 0;

	return hasFieldData || hasEntities || hasRecommendations || hasKeyInsights || hasHygiene;
}

function getStatusIcon(analysis?: LensAnalysisWithTemplate) {
	if (!analysis) return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
	switch (analysis.status) {
		case "completed":
			return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
		case "processing":
			return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />;
		case "failed":
			return <XCircle className="h-3.5 w-3.5 text-destructive" />;
		default:
			return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
	}
}

function getStatusLabel(analysis?: LensAnalysisWithTemplate) {
	if (!analysis) return "Not run";
	switch (analysis.status) {
		case "completed":
			return "Complete";
		case "processing":
			return "Processing...";
		case "pending":
			return "Pending...";
		case "failed":
			return "Failed";
		default:
			return analysis.status;
	}
}

export function LensSwitcher({
	interviewId,
	templates,
	analyses,
	editable,
	evidenceMap,
	onLensApplied,
	selectedLensKey,
	onLensChange,
}: LensSwitcherProps) {
	const revalidator = useRevalidator();
	const rerunFetcher = useFetcher();

	const sortedTemplates = useMemo(() => [...templates].sort((a, b) => a.display_order - b.display_order), [templates]);

	const completedTemplates = useMemo(
		() => sortedTemplates.filter((t) => analysisHasData(analyses[t.template_key])),
		[sortedTemplates, analyses]
	);

	const pendingTemplates = useMemo(
		() =>
			sortedTemplates.filter((t) => {
				const a = analyses[t.template_key];
				return a && (a.status === "processing" || a.status === "pending");
			}),
		[sortedTemplates, analyses]
	);

	// Determine which lens to show
	const activeLensKey = selectedLensKey ?? completedTemplates[0]?.template_key ?? sortedTemplates[0]?.template_key;

	const activeTemplate = sortedTemplates.find((t) => t.template_key === activeLensKey);
	const activeAnalysis = activeLensKey ? analyses[activeLensKey] : undefined;

	if (templates.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				<Sparkles className="mx-auto mb-3 h-8 w-8 opacity-50" />
				<p className="text-sm">No lens templates available</p>
			</div>
		);
	}

	if (completedTemplates.length === 0 && pendingTemplates.length === 0) {
		return (
			<div className="space-y-4">
				<div className="rounded-lg border border-dashed p-6 text-center">
					<Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-50" />
					<p className="mb-4 text-muted-foreground text-sm">No lens analyses have been run yet</p>
					<LensSelector
						interviewId={interviewId}
						templates={templates}
						analyses={analyses}
						onLensApplied={onLensApplied}
					/>
				</div>
			</div>
		);
	}

	const isRerunning = rerunFetcher.state !== "idle";

	return (
		<div className="space-y-4">
			{/* Lens selector bar */}
			<div className="flex items-center gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="gap-2">
							{activeTemplate && getStatusIcon(activeAnalysis)}
							<span className="font-medium">{activeTemplate?.template_name ?? "Select lens"}</span>
							<ChevronDown className="h-3.5 w-3.5 opacity-60" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-72">
						{sortedTemplates.map((template) => {
							const analysis = analyses[template.template_key];
							const isCompleted = analysisHasData(analysis);
							const isPending = analysis && (analysis.status === "processing" || analysis.status === "pending");
							const isActive = activeLensKey === template.template_key;

							return (
								<DropdownMenuItem
									key={template.template_key}
									onClick={() => onLensChange?.(template.template_key)}
									className={cn(isActive && "bg-accent")}
								>
									<div className="flex w-full items-center gap-2">
										{getStatusIcon(analysis)}
										<span className={cn("flex-1 truncate", !isCompleted && !isPending && "text-muted-foreground")}>
											{template.template_name}
										</span>
										{isPending && <span className="text-[10px] text-muted-foreground">Processing</span>}
										{!isCompleted && !isPending && <span className="text-[10px] text-muted-foreground">Not run</span>}
										{template.category && isCompleted && (
											<Badge variant="outline" className="text-[10px]">
												{template.category}
											</Badge>
										)}
									</div>
								</DropdownMenuItem>
							);
						})}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Re-run current lens */}
				{activeTemplate && activeAnalysis?.status === "completed" && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									disabled={isRerunning}
									onClick={() => {
										rerunFetcher.submit(
											{
												interview_id: interviewId,
												template_key: activeTemplate.template_key,
											},
											{ method: "POST", action: "/api/apply-lens" }
										);
										setTimeout(() => revalidator.revalidate(), 1000);
										onLensApplied?.();
									}}
								>
									<RefreshCw className={cn("h-3.5 w-3.5", isRerunning && "animate-spin")} />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Re-analyze with {activeTemplate.template_name}</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
			</div>

			{/* Active lens content */}
			{activeTemplate && activeAnalysis ? (
				<GenericLensView
					analysis={activeAnalysis}
					template={activeTemplate}
					editable={editable}
					evidenceMap={evidenceMap}
				/>
			) : activeTemplate ? (
				<div className="rounded-lg border border-dashed p-6 text-center">
					<p className="text-muted-foreground text-sm">This lens hasn&apos;t been run yet</p>
					<Button
						variant="outline"
						size="sm"
						className="mt-3"
						onClick={() => {
							rerunFetcher.submit(
								{
									interview_id: interviewId,
									template_key: activeTemplate.template_key,
								},
								{ method: "POST", action: "/api/apply-lens" }
							);
							onLensApplied?.();
						}}
					>
						<Sparkles className="mr-2 h-3.5 w-3.5" />
						Run {activeTemplate.template_name}
					</Button>
				</div>
			) : null}
		</div>
	);
}
