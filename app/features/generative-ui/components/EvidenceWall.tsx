/**
 * EvidenceWall - Raw customer voice widget for chat
 *
 * Displays clustered verbatim quotes grouped by type (pain, goal, observation).
 * Prioritizes the customer's actual words over sanitized summaries. Each cluster
 * shows a handful of quotes with speaker attribution and links to source material.
 */

import { ChevronDown, ExternalLink, MessageCircle, Quote } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface EvidenceWallData {
	projectId: string;
	headline?: string;
	clusters: Array<{
		label: string;
		type: "pain" | "goal" | "observation";
		items: Array<{
			id: string;
			verbatim: string;
			speakerName: string | null;
			speakerTitle: string | null;
			interviewTitle: string | null;
			detailUrl?: string;
		}>;
		totalCount: number;
	}>;
	totalEvidence: number;
	uniqueSources: number;
	viewAllUrl?: string;
}

interface EvidenceWallProps {
	data: EvidenceWallData;
	isStreaming?: boolean;
}

const CLUSTER_TYPE_STYLES = {
	pain: {
		accent: "bg-rose-500",
		badge: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
		border: "border-l-rose-400 dark:border-l-rose-500",
	},
	goal: {
		accent: "bg-blue-500",
		badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
		border: "border-l-blue-400 dark:border-l-blue-500",
	},
	observation: {
		accent: "bg-slate-400 dark:bg-slate-500",
		badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
		border: "border-l-slate-300 dark:border-l-slate-500",
	},
} as const;

const INITIAL_VISIBLE = 3;

function ClusterSection({ cluster }: { cluster: EvidenceWallData["clusters"][number] }) {
	const [expanded, setExpanded] = useState(false);
	const style = CLUSTER_TYPE_STYLES[cluster.type];
	const visibleItems = expanded ? cluster.items : cluster.items.slice(0, INITIAL_VISIBLE);
	const hiddenCount = cluster.items.length - INITIAL_VISIBLE;
	const remainingTotal = cluster.totalCount - cluster.items.length;

	return (
		<div className="space-y-2.5">
			{/* Cluster header */}
			<div className="flex items-center gap-2.5">
				<div className={cn("h-2.5 w-2.5 rounded-full", style.accent)} />
				<span className="font-medium text-sm">{cluster.label}</span>
				<span className={cn("rounded-full px-2 py-0.5 font-medium text-[11px]", style.badge)}>
					{cluster.totalCount} mention{cluster.totalCount !== 1 ? "s" : ""}
				</span>
			</div>

			{/* Quotes */}
			<div className="space-y-2 pl-5">
				{visibleItems.map((item) => (
					<div key={item.id} className={cn("rounded-r-lg border-l-2 bg-muted/30 py-2.5 pr-3 pl-3.5", style.border)}>
						<p className="text-sm leading-relaxed">
							<Quote className="-translate-y-px mr-1 inline-block h-3 w-3 text-muted-foreground/50" />
							{item.verbatim}
						</p>
						<div className="mt-1.5 flex items-center justify-between">
							<span className="text-muted-foreground text-xs">
								{item.speakerName && <span className="font-medium text-foreground">{item.speakerName}</span>}
								{item.speakerTitle && (
									<span>
										{item.speakerName ? ", " : ""}
										{item.speakerTitle}
									</span>
								)}
								{item.interviewTitle && (
									<span className="before:mx-1.5 before:text-muted-foreground/40 before:content-['\u00b7']">
										{item.interviewTitle}
									</span>
								)}
							</span>
							{item.detailUrl && (
								<Link
									to={item.detailUrl}
									className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
								>
									View source
									<ExternalLink className="h-3 w-3" />
								</Link>
							)}
						</div>
					</div>
				))}

				{/* Expand / collapse */}
				{hiddenCount > 0 && !expanded && (
					<button
						type="button"
						onClick={() => setExpanded(true)}
						className="flex items-center gap-1 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						<ChevronDown className="h-3.5 w-3.5" />+{hiddenCount} more quote
						{hiddenCount !== 1 ? "s" : ""}
					</button>
				)}
				{expanded && hiddenCount > 0 && (
					<button
						type="button"
						onClick={() => setExpanded(false)}
						className="font-medium text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						Show fewer
					</button>
				)}
				{remainingTotal > 0 && (
					<p className="text-muted-foreground text-xs italic">+{remainingTotal} more in full evidence view</p>
				)}
			</div>
		</div>
	);
}

export function EvidenceWall({ data, isStreaming }: EvidenceWallProps) {
	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header */}
			<div className="border-b px-5 py-4">
				<div className="flex items-center gap-2.5">
					<MessageCircle className="h-4 w-4 text-muted-foreground" />
					<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Evidence Wall</span>
				</div>
				{data.headline && <p className="mt-2 font-medium text-sm leading-snug">{data.headline}</p>}
				<div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
					<span>
						{data.totalEvidence} evidence point
						{data.totalEvidence !== 1 ? "s" : ""}
					</span>
					<span className="text-muted-foreground/40">/</span>
					<span>
						{data.uniqueSources} source{data.uniqueSources !== 1 ? "s" : ""}
					</span>
				</div>
			</div>

			{/* Clusters */}
			<div className="space-y-5 px-5 py-4">
				{data.clusters.map((cluster, i) => (
					<ClusterSection key={`${cluster.label}-${i}`} cluster={cluster} />
				))}

				{data.clusters.length === 0 && (
					<p className="text-muted-foreground text-sm italic">No evidence clusters to display yet.</p>
				)}
			</div>

			{/* Footer */}
			{data.viewAllUrl && (
				<div className="border-t px-5 py-3">
					<Link
						to={data.viewAllUrl}
						className="inline-flex items-center gap-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						View all evidence
						<ExternalLink className="h-3.5 w-3.5" />
					</Link>
				</div>
			)}
		</div>
	);
}
