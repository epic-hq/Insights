/**
 * UnifiedQuestionRow — shared question row for interview guides and surveys.
 * Renders: grip handle · number · flag dot · text · metadata slots · optional drop-off bar.
 * Context-specific metadata (category tag, type badge, time, etc.) passed via slots.
 */
import { GripVertical } from "lucide-react";
import type { HTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export interface UnifiedQuestionRowProps {
	/** Display index (1-based) */
	index: number;
	/** Question text */
	text: string;
	/** Whether this row is currently selected/active */
	isSelected?: boolean;
	/** Click handler (typically opens drawer) */
	onClick?: MouseEventHandler<HTMLButtonElement | HTMLDivElement>;
	/** Render as non-button container when nested interactive controls are needed */
	as?: "button" | "div";
	/** Drag handle render prop — pass DnD handle props here */
	dragHandleProps?: unknown;
	/** Optional coaching flag color */
	flag?: "green" | "amber" | "red";
	/** Whether to show the row as highlighted (e.g. newly inserted) */
	highlighted?: boolean;
	/** Right-side metadata slots */
	children?: ReactNode;
	/** Optional custom content for the main text area (e.g. inline editor) */
	textSlot?: ReactNode;
	/** Optional className override */
	className?: string;
	/** Optional drop-off completion percentage (0-100) — renders a vertical bar on the right edge */
	dropoff?: { completionPct: number };
}

export function UnifiedQuestionRow({
	index,
	text,
	isSelected,
	onClick,
	as = "button",
	dragHandleProps,
	flag,
	highlighted,
	children,
	textSlot,
	className,
	dropoff,
}: UnifiedQuestionRowProps) {
	const content = (
		<>
			{/* Drag handle */}
			<span
				{...((dragHandleProps ?? {}) as HTMLAttributes<HTMLSpanElement>)}
				className="shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
			>
				<GripVertical className="h-4 w-4" />
			</span>

			{/* Question number */}
			<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted font-semibold text-foreground/60 text-xs tabular-nums">
				{index}
			</span>

			{/* Coaching flag dot */}
			{flag && (
				<span
					className={cn(
						"h-1.5 w-1.5 shrink-0 rounded-full",
						flag === "green" && "bg-green-500",
						flag === "amber" && "bg-amber-500",
						flag === "red" && "bg-red-500"
					)}
				/>
			)}

			{/* Question text / editor slot */}
			{textSlot ? (
				<span className="min-w-0 flex-1">{textSlot}</span>
			) : (
				<span
					className={cn("min-w-0 flex-1 truncate text-sm", text ? "text-foreground" : "text-muted-foreground italic")}
				>
					{text || "Untitled question"}
				</span>
			)}

			{/* Right-side metadata (badges, time, indicators) */}
			{children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}

			{/* Drop-off bar — thin vertical bar on right edge */}
			{dropoff && <DropoffBar completionPct={dropoff.completionPct} />}
		</>
	);

	const classes = cn(
		"group relative flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all",
		isSelected
			? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
			: "border-border/40 bg-background hover:border-border/80 hover:bg-muted/30",
		highlighted && "border-green-500/40 bg-green-500/5",
		className
	);

	if (as === "div") {
		return (
			<div onClick={onClick} className={classes}>
				{content}
			</div>
		);
	}

	return (
		<button type="button" onClick={onClick} className={classes}>
			{content}
		</button>
	);
}

/** Thin vertical completion bar on the right edge of a question row */
function DropoffBar({ completionPct }: { completionPct: number }) {
	const pct = Math.max(0, Math.min(100, completionPct));
	let height: number;
	let colorClass: string;

	if (pct >= 90) {
		height = 28;
		colorClass = "bg-green-500";
	} else if (pct >= 80) {
		height = 24;
		colorClass = "bg-green-500";
	} else if (pct >= 60) {
		height = 18;
		colorClass = "bg-blue-500";
	} else if (pct >= 40) {
		height = 12;
		colorClass = "bg-amber-500";
	} else {
		height = 10;
		colorClass = "bg-red-500";
	}

	return (
		<div className="group/dropoff -translate-y-1/2 absolute top-1/2 right-0">
			<div className={cn("w-1 rounded-l", colorClass)} style={{ height: `${height}px` }} />
			<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 rounded bg-popover px-1 py-0.5 text-[9px] text-foreground/80 opacity-0 shadow-sm transition-opacity group-hover/dropoff:opacity-100">
				{pct}%
			</span>
		</div>
	);
}

/** Reusable badge for question type */
export function QuestionTypeBadge({ type }: { type: string }) {
	const labels: Record<string, string> = {
		auto: "Auto",
		short_text: "Short text",
		long_text: "Long text",
		single_select: "Select one",
		multi_select: "Select many",
		likert: "Likert",
		matrix: "Matrix",
		image_select: "Image select",
	};
	const label = labels[type] ?? type;
	if (type === "auto") return null;
	return (
		<Badge variant="secondary" className="px-1.5 py-0 font-normal text-[10px]">
			{label}
		</Badge>
	);
}

/** Reusable badge for question category (interview guides) */
export function QuestionCategoryBadge({ category }: { category: string }) {
	return (
		<Badge variant="secondary" className="px-1.5 py-0 font-normal text-[10px]">
			{category}
		</Badge>
	);
}

/** Time estimate display */
export function QuestionTimeEstimate({ seconds, warn }: { seconds: number; warn?: boolean }) {
	const label = seconds >= 60 ? `~${Math.round(seconds / 60)}m` : `~${seconds}s`;
	return (
		<span className={cn("font-mono text-[10px] tabular-nums", warn ? "text-amber-500" : "text-muted-foreground")}>
			{label}
		</span>
	);
}
