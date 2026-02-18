/**
 * ProgressRail Gen-UI Widget
 *
 * Horizontal progress rail showing research phases (Frame, Collect, Validate,
 * Commit, Measure). Each phase renders as a node connected by lines, with
 * status-driven styling and a compact editorial footer.
 */

import { Check, CircleAlert } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface ProgressRailData {
	phases: Array<{
		id: "frame" | "collect" | "validate" | "commit" | "measure";
		label: string;
		status: "complete" | "active" | "upcoming" | "blocked";
		hint?: string;
	}>;
	activeMoment?: number;
	statusLine: string;
	nextAction?: string;
	nextActionUrl?: string;
}

const STATUS_STYLES = {
	complete: {
		node: "bg-emerald-500 border-emerald-500 dark:bg-emerald-400 dark:border-emerald-400",
		label: "text-foreground font-medium",
		line: "bg-emerald-500 dark:bg-emerald-400",
	},
	active: {
		node: "border-primary bg-primary/10 dark:bg-primary/20",
		label: "text-primary font-semibold",
		line: "bg-border",
	},
	upcoming: {
		node: "border-muted-foreground/30 bg-transparent",
		label: "text-muted-foreground",
		line: "bg-border",
	},
	blocked: {
		node: "border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-950/30",
		label: "text-red-600 dark:text-red-400 font-medium",
		line: "bg-border",
	},
} as const;

function PhaseNode({ status }: { status: "complete" | "active" | "upcoming" | "blocked" }) {
	const styles = STATUS_STYLES[status];

	return (
		<div
			className={cn(
				"relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
				styles.node
			)}
		>
			{status === "complete" && <Check className="h-3.5 w-3.5 text-white dark:text-emerald-950" />}
			{status === "active" && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
			{status === "blocked" && <CircleAlert className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />}
		</div>
	);
}

export function ProgressRail({ data, isStreaming }: { data: ProgressRailData; isStreaming?: boolean }) {
	const phases = data.phases ?? [];

	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			<div className="px-4 pt-4 pb-3">
				{/* Rail */}
				<div className="flex items-center">
					{phases.map((phase, idx) => {
						const styles = STATUS_STYLES[phase.status];
						const isLast = idx === phases.length - 1;

						return (
							<div key={phase.id} className={cn("flex items-center", !isLast && "flex-1")}>
								{/* Node + label column */}
								<div className="flex flex-col items-center gap-1.5">
									<PhaseNode status={phase.status} />
									<span className={cn("whitespace-nowrap text-[11px] leading-none", styles.label)}>{phase.label}</span>
								</div>

								{/* Connector line */}
								{!isLast && (
									<div className="mx-1 mb-5 h-0.5 flex-1">
										<div className={cn("h-full w-full rounded-full", styles.line)} />
									</div>
								)}
							</div>
						);
					})}
				</div>

				{/* Hints for active/blocked phases */}
				{phases.some((p) => p.hint && (p.status === "active" || p.status === "blocked")) && (
					<div className="mt-3 space-y-1">
						{phases
							.filter((p) => p.hint && (p.status === "active" || p.status === "blocked"))
							.map((p) => (
								<p
									key={p.id}
									className={cn(
										"text-xs",
										p.status === "blocked" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
									)}
								>
									{p.hint}
								</p>
							))}
					</div>
				)}
			</div>

			{/* Footer */}
			{(data.statusLine || data.nextAction) && (
				<div className="border-t bg-muted/30 px-4 py-2.5">
					{data.statusLine && <p className="text-muted-foreground text-sm italic">{data.statusLine}</p>}
					{data.nextAction && data.nextActionUrl && (
						<Link
							to={data.nextActionUrl}
							className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90"
						>
							{data.nextAction}
						</Link>
					)}
					{data.nextAction && !data.nextActionUrl && (
						<p className="mt-1 font-medium text-foreground text-xs">{data.nextAction}</p>
					)}
				</div>
			)}
		</div>
	);
}
