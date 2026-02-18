/**
 * PatternSynthesis - Pattern narrative widget for chat
 *
 * Presents discovered patterns as a synthesis narrative rather than a data table.
 * Each pattern includes its confidence tier, supporting quotes, and source count.
 * Designed to help the user understand what the evidence means, not just what it says.
 */

import { ArrowRight, ExternalLink, Layers, Quote } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface PatternSynthesisData {
	projectId: string;
	headline?: string;
	narrativeSummary?: string;
	patterns: Array<{
		id: string;
		name: string;
		statement: string | null;
		mentionCount: number;
		confidenceTier: "thin" | "emerging" | "strong" | "validated";
		confidenceLabel: string;
		topQuotes?: Array<{
			verbatim: string;
			speakerName: string | null;
		}>;
		uniqueSources?: number;
		detailUrl?: string;
	}>;
	distribution?: { strong: number; emerging: number; thin: number };
	nextAction?: string;
	nextActionUrl?: string;
}

interface PatternSynthesisProps {
	data: PatternSynthesisData;
	isStreaming?: boolean;
}

const CONFIDENCE_STYLES = {
	validated: {
		badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
		dot: "bg-emerald-500",
	},
	strong: {
		badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
		dot: "bg-emerald-500",
	},
	emerging: {
		badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
		dot: "bg-amber-500",
	},
	thin: {
		badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
		dot: "bg-slate-400 dark:bg-slate-500",
	},
} as const;

export function PatternSynthesis({ data, isStreaming }: PatternSynthesisProps) {
	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header */}
			<div className="border-b px-5 py-4">
				<div className="flex items-center gap-2.5">
					<Layers className="h-4 w-4 text-muted-foreground" />
					<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Patterns</span>
				</div>
				{data.headline && <p className="mt-2 font-medium text-sm leading-snug">{data.headline}</p>}
				{data.narrativeSummary && (
					<p className="mt-2 text-muted-foreground text-sm italic leading-relaxed">{data.narrativeSummary}</p>
				)}

				{/* Distribution summary */}
				{data.distribution && (
					<div className="mt-3 flex items-center gap-3 text-muted-foreground text-xs">
						{data.distribution.strong > 0 && (
							<span className="flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-emerald-500" />
								{data.distribution.strong} strong
							</span>
						)}
						{data.distribution.emerging > 0 && (
							<span className="flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-amber-500" />
								{data.distribution.emerging} emerging
							</span>
						)}
						{data.distribution.thin > 0 && (
							<span className="flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
								{data.distribution.thin} thin
							</span>
						)}
					</div>
				)}
			</div>

			{/* Patterns */}
			<div className="divide-y">
				{data.patterns.map((pattern) => {
					const style = CONFIDENCE_STYLES[pattern.confidenceTier];

					return (
						<div key={pattern.id} className="px-5 py-4">
							{/* Pattern header */}
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2.5">
										<h4 className="font-semibold text-sm">{pattern.name}</h4>
										<span className={cn("flex-shrink-0 rounded-full px-2 py-0.5 font-medium text-[11px]", style.badge)}>
											{pattern.confidenceLabel}
										</span>
									</div>
									{pattern.statement && (
										<p className="mt-1 text-muted-foreground text-sm leading-relaxed">{pattern.statement}</p>
									)}
								</div>
								{pattern.detailUrl && (
									<Link
										to={pattern.detailUrl}
										className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
										title="View pattern detail"
									>
										<ExternalLink className="h-3.5 w-3.5" />
									</Link>
								)}
							</div>

							{/* Mention + source counts */}
							<div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
								<span>
									{pattern.mentionCount} mention
									{pattern.mentionCount !== 1 ? "s" : ""}
								</span>
								{pattern.uniqueSources != null && (
									<>
										<span className="text-muted-foreground/40">/</span>
										<span>
											{pattern.uniqueSources} source
											{pattern.uniqueSources !== 1 ? "s" : ""}
										</span>
									</>
								)}
							</div>

							{/* Top quotes */}
							{pattern.topQuotes && pattern.topQuotes.length > 0 && (
								<div className="mt-3 space-y-2 pl-3">
									{pattern.topQuotes.map((quote, i) => (
										<div key={i} className="rounded-r-md border-l-2 border-l-muted-foreground/20 py-1.5 pr-2 pl-3">
											<p className="text-muted-foreground text-xs leading-relaxed">
												<Quote className="-translate-y-px mr-0.5 inline-block h-2.5 w-2.5 text-muted-foreground/40" />
												{quote.verbatim}
											</p>
											{quote.speakerName && (
												<p className="mt-0.5 font-medium text-[11px] text-muted-foreground/70">{quote.speakerName}</p>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}

				{data.patterns.length === 0 && (
					<div className="px-5 py-6">
						<p className="text-muted-foreground text-sm italic">
							No patterns identified yet. More evidence may be needed.
						</p>
					</div>
				)}
			</div>

			{/* Footer CTA */}
			{(data.nextAction || data.nextActionUrl) && (
				<div className="border-t px-5 py-4">
					{data.nextAction && <p className="text-muted-foreground text-sm">{data.nextAction}</p>}
					{data.nextActionUrl && (
						<Link
							to={data.nextActionUrl}
							className="mt-2 inline-flex items-center gap-1.5 font-medium text-foreground text-sm transition-colors hover:text-foreground/80"
						>
							Explore patterns
							<ArrowRight className="h-3.5 w-3.5" />
						</Link>
					)}
				</div>
			)}
		</div>
	);
}
