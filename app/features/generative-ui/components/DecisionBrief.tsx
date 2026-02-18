/**
 * DecisionBrief Gen-UI Widget
 *
 * Displays a structured decision brief card inline in chat. Shows the core
 * decision question, target customer, deadline, success metric, and research
 * questions. Includes a completeness checklist and readiness label to guide
 * the user toward a well-framed research plan.
 */

import { Check, ExternalLink, HelpCircle, Target, X } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface DecisionBriefData {
	projectId: string;
	decisionQuestion: string | null;
	targetCustomer: string | null;
	deadline: string | null;
	successMetric: string | null;
	researchQuestions?: string[];
	completeness: {
		hasDecision: boolean;
		hasTarget: boolean;
		hasDeadline: boolean;
		hasMetric: boolean;
		hasQuestions: boolean;
	};
	readinessLabel: string;
	editUrl?: string;
}

interface CompletenessItem {
	key: keyof DecisionBriefData["completeness"];
	label: string;
}

const COMPLETENESS_ITEMS: CompletenessItem[] = [
	{ key: "hasDecision", label: "Decision" },
	{ key: "hasTarget", label: "Target" },
	{ key: "hasDeadline", label: "Deadline" },
	{ key: "hasMetric", label: "Metric" },
	{ key: "hasQuestions", label: "Questions" },
];

function LabeledRow({ label, value, placeholder }: { label: string; value: string | null; placeholder: string }) {
	return (
		<div className="flex gap-3 text-sm">
			<span className="w-28 shrink-0 text-muted-foreground">{label}</span>
			{value ? (
				<span className="text-foreground">{value}</span>
			) : (
				<span className="text-muted-foreground/60 italic">{placeholder}</span>
			)}
		</div>
	);
}

export function DecisionBrief({ data, isStreaming }: { data: DecisionBriefData; isStreaming?: boolean }) {
	const completeness = data.completeness ?? {};
	const completeCount = Object.values(completeness).filter(Boolean).length;
	const totalCount = COMPLETENESS_ITEMS.length;
	const allComplete = completeCount === totalCount;

	// Determine what the first missing item is for the CTA
	const firstMissing = COMPLETENESS_ITEMS.find((item) => !completeness[item.key]);

	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header */}
			<div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
				<div className="flex items-center gap-2">
					<Target className="h-4 w-4 text-primary" />
					<h4 className="font-semibold text-xs uppercase tracking-wide">Decision Brief</h4>
				</div>
				{data.editUrl && (
					<Link
						to={data.editUrl}
						className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						Edit
						<ExternalLink className="h-3 w-3" />
					</Link>
				)}
			</div>

			<div className="space-y-4 p-4">
				{/* Decision question */}
				<div>
					{data.decisionQuestion ? (
						<p className="text-base italic leading-relaxed">{data.decisionQuestion}</p>
					) : (
						<div className="flex items-center gap-2 rounded-md border border-dashed p-3">
							<HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
							<p className="text-muted-foreground/60 text-sm italic">What decision are you trying to make?</p>
						</div>
					)}
				</div>

				{/* Labeled fields */}
				<div className="space-y-2">
					<LabeledRow label="For:" value={data.targetCustomer} placeholder="Who is the target customer?" />
					<LabeledRow label="Decide by:" value={data.deadline} placeholder="When do you need to decide?" />
					<LabeledRow
						label="Success looks like:"
						value={data.successMetric}
						placeholder="How will you measure success?"
					/>
				</div>

				{/* Research questions */}
				{data.researchQuestions && data.researchQuestions.length > 0 && (
					<div>
						<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Research Questions</p>
						<ol className="space-y-1.5 pl-5">
							{data.researchQuestions.map((q, idx) => (
								<li key={idx} className="list-decimal text-sm leading-snug marker:text-muted-foreground/50">
									{q}
								</li>
							))}
						</ol>
					</div>
				)}
			</div>

			{/* Footer: Completeness + readiness */}
			<div className="border-t bg-muted/30 px-4 py-3">
				{/* Completeness pills */}
				<div className="flex flex-wrap gap-1.5">
					{COMPLETENESS_ITEMS.map((item) => {
						const done = completeness[item.key];
						return (
							<span
								key={item.key}
								className={cn(
									"inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[11px]",
									done
										? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
										: "bg-muted text-muted-foreground"
								)}
							>
								{done ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
								{item.label}
							</span>
						);
					})}
				</div>

				{/* Readiness label */}
				<p className="mt-2 text-muted-foreground text-sm italic">{data.readinessLabel}</p>

				{/* CTA based on what's missing */}
				{!allComplete && firstMissing && (
					<p className="mt-1.5 font-medium text-foreground text-xs">
						Next: Define your {firstMissing.label.toLowerCase()}
					</p>
				)}
			</div>
		</div>
	);
}
