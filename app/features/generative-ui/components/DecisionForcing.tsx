/**
 * DecisionForcing - Action-oriented decision widget for chat
 *
 * Presents prioritized actions with effort/impact assessment, supporting evidence,
 * and tradeoff analysis. Functions as a forcing mechanism -- not a passive suggestion
 * list but a direct challenge: here is what you should do and why.
 */

import { ArrowRight, Check, ExternalLink, Flame, Zap } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface DecisionForcingData {
	projectId: string;
	headline?: string;
	decisionContext?: string;
	actions: Array<{
		id: string;
		action: string;
		reasoning: string;
		effort: "low" | "medium" | "high";
		impact: "low" | "medium" | "high";
		tradeoffs?: string[];
		evidenceCount?: number;
		evidenceUrl?: string;
		owner: string | null;
		dueDate: string | null;
		committed?: boolean;
	}>;
	informingPatterns?: Array<{
		name: string;
		confidenceLabel: string;
	}>;
	narrative?: string;
	actionsUrl?: string;
}

interface DecisionForcingProps {
	data: DecisionForcingData;
	isStreaming?: boolean;
}

const EFFORT_STYLES = {
	low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
	medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
	high: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
} as const;

const IMPACT_STYLES = {
	high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
	medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
	low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
} as const;

export function DecisionForcing({ data, isStreaming }: DecisionForcingProps) {
	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header */}
			<div className="border-b px-5 py-4">
				<div className="flex items-center gap-2.5">
					<Zap className="h-4 w-4 text-amber-500" />
					<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
						{data.headline || "What should you do this week?"}
					</span>
				</div>
				{data.decisionContext && (
					<p className="mt-2 text-muted-foreground text-sm leading-relaxed">{data.decisionContext}</p>
				)}

				{/* Informing patterns */}
				{data.informingPatterns && data.informingPatterns.length > 0 && (
					<div className="mt-3 flex flex-wrap items-center gap-1.5">
						<span className="text-[11px] text-muted-foreground/70">Based on:</span>
						{data.informingPatterns.map((pattern, i) => (
							<span key={i} className="rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
								{pattern.name}
								<span className="ml-1 text-muted-foreground/50">({pattern.confidenceLabel})</span>
							</span>
						))}
					</div>
				)}
			</div>

			{/* Actions */}
			<div className="divide-y">
				{data.actions.map((action, index) => (
					<div
						key={action.id}
						className={cn("px-5 py-4", action.committed && "bg-emerald-50/50 dark:bg-emerald-950/20")}
					>
						{/* Action header with number */}
						<div className="flex items-start gap-3">
							<span
								className={cn(
									"flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-semibold text-xs",
									action.committed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
								)}
							>
								{action.committed ? <Check className="h-3.5 w-3.5" /> : index + 1}
							</span>
							<div className="min-w-0 flex-1">
								<h4 className="font-semibold text-sm leading-snug">{action.action}</h4>

								{/* Effort / Impact badges */}
								<div className="mt-1.5 flex items-center gap-2">
									<span
										className={cn("rounded-full px-2 py-0.5 font-medium text-[11px]", EFFORT_STYLES[action.effort])}
									>
										{action.effort} effort
									</span>
									<span
										className={cn("rounded-full px-2 py-0.5 font-medium text-[11px]", IMPACT_STYLES[action.impact])}
									>
										{action.impact} impact
									</span>
									{action.evidenceCount != null && action.evidenceCount > 0 && (
										<>
											{action.evidenceUrl ? (
												<Link
													to={action.evidenceUrl}
													className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
												>
													<Flame className="h-3 w-3" />
													{action.evidenceCount} evidence
													<ExternalLink className="h-2.5 w-2.5" />
												</Link>
											) : (
												<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
													<Flame className="h-3 w-3" />
													{action.evidenceCount} evidence
												</span>
											)}
										</>
									)}
								</div>

								{/* Reasoning */}
								<p className="mt-2 text-muted-foreground text-sm leading-relaxed">{action.reasoning}</p>

								{/* Tradeoffs */}
								{action.tradeoffs && action.tradeoffs.length > 0 && (
									<ul className="mt-2 space-y-0.5">
										{action.tradeoffs.map((tradeoff, i) => (
											<li key={i} className="text-muted-foreground/80 text-xs italic">
												{tradeoff}
											</li>
										))}
									</ul>
								)}

								{/* Owner + Due date */}
								{(action.owner || action.dueDate) && (
									<div className="mt-2.5 flex items-center gap-3">
										{action.owner && (
											<span className="rounded border border-dashed bg-muted/30 px-2.5 py-1 text-muted-foreground text-xs">
												{action.owner}
											</span>
										)}
										{action.dueDate && (
											<span className="rounded border border-dashed bg-muted/30 px-2.5 py-1 text-muted-foreground text-xs">
												{action.dueDate}
											</span>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				))}

				{data.actions.length === 0 && (
					<div className="px-5 py-6">
						<p className="text-muted-foreground text-sm italic">
							No actions identified yet. More analysis may be needed.
						</p>
					</div>
				)}
			</div>

			{/* Footer */}
			{(data.narrative || data.actionsUrl) && (
				<div className="border-t px-5 py-4">
					{data.narrative && <p className="text-muted-foreground text-sm">{data.narrative}</p>}
					{data.actionsUrl && (
						<Link
							to={data.actionsUrl}
							className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm transition-colors hover:bg-foreground/90"
						>
							Save committed actions
							<ArrowRight className="h-3.5 w-3.5" />
						</Link>
					)}
				</div>
			)}
		</div>
	);
}
