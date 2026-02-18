/**
 * IntakeHealth - Confidence gate widget for chat
 *
 * Displays the current state of research intake: how much evidence exists,
 * where gaps remain, and whether the data is sufficient to make decisions.
 * Designed to feel like a coach giving honest, direct feedback rather than
 * a passive dashboard readout.
 */

import { AlertCircle, ArrowRight, Calendar, FileText, MessageSquare, Mic, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface IntakeHealthData {
	projectId: string;
	confidenceTier: "early_signal" | "growing_confidence" | "decision_ready";
	confidenceLabel: string;
	summary: string;
	coverage?: Array<{
		label: string;
		count: number;
		target?: number;
		sources?: { interviews: number; surveys: number; documents: number };
	}>;
	sourceMix: { interviews: number; surveys: number; documents: number };
	totalEvidence: number;
	daysSinceLastIntake?: number;
	gaps?: string[];
	gateStatus: "insufficient" | "marginal" | "sufficient";
	nextAction: string;
	nextActionUrl?: string;
}

interface IntakeHealthProps {
	data: IntakeHealthData;
	isStreaming?: boolean;
}

const TIER_STYLES = {
	early_signal: {
		badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
		bar: "bg-rose-500",
		icon: "text-rose-500",
	},
	growing_confidence: {
		badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
		bar: "bg-amber-500",
		icon: "text-amber-500",
	},
	decision_ready: {
		badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
		bar: "bg-emerald-500",
		icon: "text-emerald-500",
	},
} as const;

const GATE_CTA_STYLES = {
	insufficient: "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600",
	marginal: "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600",
	sufficient: "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600",
} as const;

function coverageLevel(count: number, target?: number): string {
	if (!target) return count > 0 ? "Some data" : "No data";
	const ratio = count / target;
	if (ratio >= 0.8) return "Strong";
	if (ratio >= 0.4) return "Needs more";
	return "Thin";
}

function coverageLevelColor(count: number, target?: number): string {
	if (!target) {
		return count > 0 ? "text-muted-foreground" : "text-rose-500 dark:text-rose-400";
	}
	const ratio = count / target;
	if (ratio >= 0.8) return "text-emerald-600 dark:text-emerald-400";
	if (ratio >= 0.4) return "text-amber-600 dark:text-amber-400";
	return "text-rose-500 dark:text-rose-400";
}

function SourceIcon({ type }: { type: "interviews" | "surveys" | "documents" }) {
	const icons = {
		interviews: Mic,
		surveys: MessageSquare,
		documents: FileText,
	};
	const Icon = icons[type];
	return <Icon className="h-3.5 w-3.5" />;
}

export function IntakeHealth({ data, isStreaming }: IntakeHealthProps) {
	const tier = TIER_STYLES[data.confidenceTier];
	const totalSources = data.sourceMix.interviews + data.sourceMix.surveys + data.sourceMix.documents;

	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header */}
			<div className="border-b px-5 py-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<ShieldCheck className={cn("h-4 w-4", tier.icon)} />
						<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Intake Health</span>
					</div>
					<span className={cn("rounded-full px-2.5 py-0.5 font-medium text-xs", tier.badge)}>
						{data.confidenceLabel}
					</span>
				</div>

				{/* Editorial summary */}
				<p className="mt-3 text-muted-foreground text-sm italic leading-relaxed">{data.summary}</p>
			</div>

			<div className="space-y-5 px-5 py-4">
				{/* Coverage bars */}
				{data.coverage && data.coverage.length > 0 && (
					<div className="space-y-3">
						<h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">Coverage</h4>
						<div className="space-y-2.5">
							{data.coverage.map((segment) => {
								const ratio = segment.target
									? Math.min(segment.count / segment.target, 1)
									: segment.count > 0
										? 0.3
										: 0;
								const level = coverageLevel(segment.count, segment.target);
								const levelColor = coverageLevelColor(segment.count, segment.target);

								return (
									<div key={segment.label}>
										<div className="mb-1 flex items-center justify-between">
											<span className="text-sm">{segment.label}</span>
											<div className="flex items-center gap-2">
												<span className="text-muted-foreground text-xs tabular-nums">
													{segment.count}
													{segment.target != null && `/${segment.target}`}
												</span>
												<span className={cn("font-medium text-xs", levelColor)}>{level}</span>
											</div>
										</div>
										<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
											<div
												className={cn("h-full rounded-full transition-all duration-500", tier.bar)}
												style={{ width: `${ratio * 100}%` }}
											/>
										</div>
										{/* Per-segment source breakdown */}
										{segment.sources && (
											<div className="mt-1 flex gap-3">
												{(["interviews", "surveys", "documents"] as const).map(
													(type) =>
														(segment.sources?.[type] ?? 0) > 0 && (
															<span key={type} className="flex items-center gap-1 text-[11px] text-muted-foreground">
																<SourceIcon type={type} />
																{segment.sources?.[type]}
															</span>
														)
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* Sources + Evidence row */}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
					{totalSources > 0 && (
						<span className="flex items-center gap-1.5">
							<Mic className="h-3.5 w-3.5" />
							{data.sourceMix.interviews} interview
							{data.sourceMix.interviews !== 1 ? "s" : ""}
						</span>
					)}
					{data.sourceMix.surveys > 0 && (
						<span className="flex items-center gap-1.5">
							<MessageSquare className="h-3.5 w-3.5" />
							{data.sourceMix.surveys} survey
							{data.sourceMix.surveys !== 1 ? "s" : ""}
						</span>
					)}
					{data.sourceMix.documents > 0 && (
						<span className="flex items-center gap-1.5">
							<FileText className="h-3.5 w-3.5" />
							{data.sourceMix.documents} document
							{data.sourceMix.documents !== 1 ? "s" : ""}
						</span>
					)}
					<span className="font-medium text-foreground">
						{data.totalEvidence} evidence point
						{data.totalEvidence !== 1 ? "s" : ""}
					</span>
					{data.daysSinceLastIntake != null && (
						<span className="flex items-center gap-1">
							<Calendar className="h-3.5 w-3.5" />
							{data.daysSinceLastIntake === 0 ? "Updated today" : `${data.daysSinceLastIntake}d since last intake`}
						</span>
					)}
				</div>

				{/* Gaps */}
				{data.gaps && data.gaps.length > 0 && (
					<div className="space-y-2">
						<h4 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							<AlertCircle className="h-3.5 w-3.5" />
							Gaps to close
						</h4>
						<ul className="space-y-1.5">
							{data.gaps.map((gap, i) => (
								<li key={i} className="flex items-start gap-2 text-sm leading-snug">
									<span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/40" />
									<span className="text-muted-foreground">{gap}</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>

			{/* CTA */}
			<div className="border-t px-5 py-4">
				{data.nextActionUrl ? (
					<Link
						to={data.nextActionUrl}
						className={cn(
							"inline-flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-colors",
							GATE_CTA_STYLES[data.gateStatus]
						)}
					>
						{data.nextAction}
						<ArrowRight className="h-3.5 w-3.5" />
					</Link>
				) : (
					<p className="text-muted-foreground text-sm">{data.nextAction}</p>
				)}
			</div>
		</div>
	);
}
