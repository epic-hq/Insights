/**
 * ResearchPulse - Inline chat widget for weekly research health review.
 *
 * Shows confidence tier with trend direction, key metric deltas, a mini
 * action/task list, new signal summary, and a suggested next step.
 * Designed to feel like a weekly review digest, not a dashboard.
 */

import {
	AlertCircle,
	ArrowRight,
	Check,
	CheckCircle2,
	Circle,
	Loader2,
	Minus,
	Radar,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface ResearchPulseData {
	projectId: string;
	periodLabel: string;
	confidenceTier: "early_signal" | "growing_confidence" | "decision_ready";
	confidenceLabel: string;
	confidenceChange?: "improved" | "stable" | "declined";
	deltas: Array<{
		label: string;
		current: string | number;
		previous?: string | number;
		change?: string;
		direction?: "up" | "down" | "flat";
	}>;
	actions?: Array<{
		id: string;
		action: string;
		owner: string | null;
		status: "not_started" | "in_progress" | "complete" | "blocked";
		dueDate: string | null;
	}>;
	newSignalSummary?: string;
	nextStep: string;
	nextStepUrl?: string;
}

interface ResearchPulseProps {
	data: ResearchPulseData;
	isStreaming?: boolean;
}

const CONFIDENCE_TIERS = {
	early_signal: {
		bg: "bg-amber-50 dark:bg-amber-950/40",
		border: "border-amber-200 dark:border-amber-800",
		text: "text-amber-700 dark:text-amber-400",
		dot: "bg-amber-500",
	},
	growing_confidence: {
		bg: "bg-blue-50 dark:bg-blue-950/40",
		border: "border-blue-200 dark:border-blue-800",
		text: "text-blue-700 dark:text-blue-400",
		dot: "bg-blue-500",
	},
	decision_ready: {
		bg: "bg-emerald-50 dark:bg-emerald-950/40",
		border: "border-emerald-200 dark:border-emerald-800",
		text: "text-emerald-700 dark:text-emerald-400",
		dot: "bg-emerald-500",
	},
} as const;

const CHANGE_ICONS = {
	improved: {
		icon: TrendingUp,
		color: "text-emerald-600 dark:text-emerald-400",
	},
	stable: { icon: Minus, color: "text-muted-foreground" },
	declined: { icon: TrendingDown, color: "text-rose-600 dark:text-rose-400" },
} as const;

const ACTION_STATUS = {
	complete: {
		icon: CheckCircle2,
		color: "text-emerald-500 dark:text-emerald-400",
	},
	in_progress: {
		icon: Loader2,
		color: "text-blue-500 dark:text-blue-400",
		animate: "animate-spin",
	},
	not_started: {
		icon: Circle,
		color: "text-muted-foreground/50",
	},
	blocked: {
		icon: AlertCircle,
		color: "text-red-500 dark:text-red-400",
	},
} as const;

export function ResearchPulse({ data, isStreaming }: ResearchPulseProps) {
	const tier = CONFIDENCE_TIERS[data.confidenceTier];
	const changeConfig = data.confidenceChange ? CHANGE_ICONS[data.confidenceChange] : null;
	const ChangeIcon = changeConfig?.icon;
	const deltas = data.deltas ?? [];
	const actions = data.actions ?? [];

	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header: label + confidence badge */}
			<div className="px-4 pt-4 pb-3">
				<div className="flex items-center gap-2">
					<Radar className="h-4 w-4 shrink-0 text-muted-foreground" />
					<span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
						Research Pulse
					</span>
					<span className="ml-auto text-muted-foreground text-xs">{data.periodLabel}</span>
				</div>

				{/* Confidence badge */}
				<div className="mt-3 flex items-center gap-2">
					<div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1", tier.bg, tier.border)}>
						<span className={cn("h-2 w-2 rounded-full", tier.dot)} />
						<span className={cn("font-semibold text-xs", tier.text)}>{data.confidenceLabel}</span>
					</div>
					{ChangeIcon && (
						<span className={cn("inline-flex items-center gap-0.5 text-xs", changeConfig.color)}>
							<ChangeIcon className="h-3.5 w-3.5" />
							<span className="capitalize">{data.confidenceChange}</span>
						</span>
					)}
				</div>
			</div>

			{/* Deltas grid */}
			{deltas.length > 0 && (
				<div className="mx-4 mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
					{deltas.map((delta) => (
						<div key={delta.label} className="rounded-md border bg-muted/20 px-3 py-2">
							<p className="text-[11px] text-muted-foreground">{delta.label}</p>
							<div className="mt-0.5 flex items-baseline gap-1.5">
								<span className="font-semibold text-foreground text-lg leading-tight">{delta.current}</span>
								{delta.change && (
									<span
										className={cn(
											"font-medium text-xs",
											delta.direction === "up" && "text-emerald-600 dark:text-emerald-400",
											delta.direction === "down" && "text-rose-600 dark:text-rose-400",
											delta.direction === "flat" && "text-muted-foreground"
										)}
									>
										{delta.change}
									</span>
								)}
							</div>
							{delta.previous != null && <p className="text-[10px] text-muted-foreground">prev: {delta.previous}</p>}
						</div>
					))}
				</div>
			)}

			{/* Actions */}
			{actions.length > 0 && (
				<div className="mx-4 mb-3">
					<p className="mb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">Actions</p>
					<div className="space-y-1 divide-y divide-border rounded-md border">
						{actions.map((action) => {
							const statusConfig = ACTION_STATUS[action.status];
							const StatusIcon = statusConfig.icon;
							const isComplete = action.status === "complete";

							return (
								<div key={action.id} className={cn("flex items-start gap-2 px-3 py-2", isComplete && "opacity-60")}>
									<StatusIcon
										className={cn(
											"mt-0.5 h-3.5 w-3.5 shrink-0",
											statusConfig.color,
											"animate" in statusConfig && statusConfig.animate
										)}
									/>
									<div className="min-w-0 flex-1">
										<p className={cn("text-sm leading-snug", isComplete && "text-muted-foreground line-through")}>
											{action.action}
										</p>
										<div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
											{action.owner && <span>{action.owner}</span>}
											{action.owner && action.dueDate && <span className="text-border">|</span>}
											{action.dueDate && <span>Due {action.dueDate}</span>}
										</div>
									</div>
									{isComplete && (
										<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* New signal summary */}
			{data.newSignalSummary && (
				<div className="mx-4 mb-3">
					<p className="text-muted-foreground text-xs italic leading-relaxed">{data.newSignalSummary}</p>
				</div>
			)}

			{/* Footer: next step */}
			<div className="border-t bg-muted/30 px-4 py-2.5">
				<p className="text-muted-foreground text-sm">{data.nextStep}</p>
				{data.nextStepUrl && (
					<Link
						to={data.nextStepUrl}
						className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						Take next step
						<ArrowRight className="h-3.5 w-3.5" />
					</Link>
				)}
			</div>
		</div>
	);
}
