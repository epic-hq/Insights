import { formatDistanceToNow } from "date-fns";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { InterviewLensFramework, LensSlotValue } from "~/features/lenses/types";
import { cn } from "~/lib/utils";

const hygieneBadgeClasses: Record<string, string> = {
	info: "border-sky-200 bg-sky-50 text-sky-700",
	warning: "border-amber-200 bg-amber-50 text-amber-700",
	critical: "border-rose-200 bg-rose-50 text-rose-700",
};

const confidenceBadgeClasses = [
	{ threshold: 0.7, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
	{ threshold: 0.4, className: "border-amber-200 bg-amber-50 text-amber-700" },
];

type LensSlotTableProps = {
	framework: InterviewLensFramework;
	className?: string;
	showHeader?: boolean;
};

export function LensSlotTable({ framework, className, showHeader = true }: LensSlotTableProps) {
	const lastUpdatedLabel = framework.computedAt
		? formatDistanceToNow(new Date(framework.computedAt), { addSuffix: true })
		: null;

	return (
		<Card className={cn("overflow-hidden border border-border/60 shadow-sm", className)}>
			{showHeader ? (
				<CardHeader className="flex flex-col gap-2 border-b bg-muted/30 py-3">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<CardTitle className="font-semibold text-base">{friendlyFrameworkName(framework.name)}</CardTitle>
							{lastUpdatedLabel ? <p className="text-muted-foreground text-xs">Updated {lastUpdatedLabel}</p> : null}
						</div>
						{framework.hygiene.length > 0 ? (
							<div className="flex flex-wrap items-center gap-2">
								{framework.hygiene.map((item) => (
									<Badge
										key={`${item.code}-${item.slotLabel ?? "framework"}`}
										variant="outline"
										className={cn(
											"font-medium text-xs uppercase tracking-wide",
											hygieneBadgeClasses[item.severity] ?? "border-border text-muted-foreground"
										)}
									>
										{item.code}
										{item.slotLabel ? (
											<span className="ml-1 text-[0.65rem] normal-case">({item.slotLabel})</span>
										) : null}
										{item.message ? <span className="ml-1 text-[0.65rem] normal-case">{item.message}</span> : null}
									</Badge>
								))}
							</div>
						) : null}
					</div>
				</CardHeader>
			) : null}
			<CardContent className="space-y-4 p-0">
				{!showHeader && framework.hygiene.length > 0 ? (
					<div className="flex flex-wrap items-center gap-2 border-border/60 border-b bg-muted/20 px-4 py-3">
						{framework.hygiene.map((item) => (
							<Badge
								key={`${item.code}-${item.slotLabel ?? "framework"}`}
								variant="outline"
								className={cn(
									"font-medium text-xs uppercase tracking-wide",
									hygieneBadgeClasses[item.severity] ?? "border-border text-muted-foreground"
								)}
							>
								{item.code}
								{item.slotLabel ? <span className="ml-1 text-[0.65rem] normal-case">({item.slotLabel})</span> : null}
							</Badge>
						))}
					</div>
				) : null}
				<div className="overflow-x-auto">
					<Table className="min-w-[640px]">
						<TableHeader>
							<TableRow>
								<TableHead className="w-[220px]">Field</TableHead>
								<TableHead>Value</TableHead>
								<TableHead className="w-[160px]">Ownership</TableHead>
								<TableHead className="w-[120px]">Confidence</TableHead>
								<TableHead className="w-[80px] text-center">Evidence</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{framework.slots.map((slot) => (
								<TableRow key={slot.id} className="align-top">
									<TableCell className="py-4">
										<div className="space-y-1">
											<p className="font-medium text-foreground text-sm">{slot.label ?? titleCase(slot.fieldKey)}</p>
											{slot.summary ? (
												<p className="text-muted-foreground text-xs leading-snug">{slot.summary}</p>
											) : null}
											{slot.hygiene.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{slot.hygiene.map((item) => (
														<Badge
															key={`${slot.id}-${item.code}`}
															variant="outline"
															className={cn(
																"text-[0.65rem] uppercase",
																hygieneBadgeClasses[item.severity] ?? "border-border text-muted-foreground"
															)}
														>
															{item.code}
														</Badge>
													))}
												</div>
											) : null}
										</div>
									</TableCell>
									<TableCell className="py-4">
										<LensValue slot={slot} />
									</TableCell>
									<TableCell className="py-4">
										<LensOwnership slot={slot} />
									</TableCell>
									<TableCell className="py-4">
										<LensConfidence slot={slot} />
									</TableCell>
									<TableCell className="py-4 text-center">
										{slot.evidenceCount > 0 ? (
											<Badge variant="outline" className="text-xs">{`${slot.evidenceCount}`}</Badge>
										) : (
											<span className="text-muted-foreground text-xs">—</span>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
				{!showHeader && lastUpdatedLabel ? (
					<div className="border-border/60 border-t px-4 py-3 text-muted-foreground text-xs">
						Updated {lastUpdatedLabel}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function LensValue({ slot }: { slot: LensSlotValue }) {
	const primaryValue = derivePrimaryValue(slot);

	if (!primaryValue) {
		return <span className="text-muted-foreground text-sm">No value captured</span>;
	}

	return (
		<div className="space-y-1">
			<p className="font-medium text-foreground text-sm">{primaryValue}</p>
			{slot.status ? <p className="text-muted-foreground text-xs">Status: {titleCase(slot.status)}</p> : null}
			{slot.dateValue ? <p className="text-muted-foreground text-xs">Target: {slot.dateValue}</p> : null}
			{typeof slot.numericValue === "number" ? (
				<p className="text-muted-foreground text-xs">Numeric: {slot.numericValue}</p>
			) : null}
		</div>
	);
}

function LensOwnership({ slot }: { slot: LensSlotValue }) {
	if (!slot.ownerName && slot.relatedNames.length === 0) {
		return <span className="text-muted-foreground text-xs">Unassigned</span>;
	}

	return (
		<div className="space-y-1 text-xs">
			{slot.ownerName ? <p className="font-medium text-foreground">{slot.ownerName}</p> : null}
			{slot.relatedNames.length > 0 ? (
				<p className="text-muted-foreground">Related: {slot.relatedNames.join(", ")}</p>
			) : null}
		</div>
	);
}

function LensConfidence({ slot }: { slot: LensSlotValue }) {
	if (typeof slot.confidence !== "number") {
		return <span className="text-muted-foreground text-xs">—</span>;
	}

	const percent = Math.round(slot.confidence * 100);
	const badgeStyle =
		confidenceBadgeClasses.find((entry) => slot.confidence >= entry.threshold)?.className ??
		"border-rose-200 bg-rose-50 text-rose-700";

	return (
		<Badge variant="outline" className={cn("font-medium text-xs", badgeStyle)}>
			{percent}% sure
		</Badge>
	);
}

function derivePrimaryValue(slot: LensSlotValue) {
	if (slot.textValue) return slot.textValue;
	if (typeof slot.numericValue === "number") return String(slot.numericValue);
	if (slot.dateValue) return slot.dateValue;
	if (slot.summary) return slot.summary;
	return null;
}

function friendlyFrameworkName(name: InterviewLensFramework["name"]) {
	switch (name) {
		case "BANT_GPCT":
			return "Sales (BANT)";
		case "SPICED":
			return "SPICED";
		case "MEDDIC":
			return "MEDDIC";
		case "MAP":
			return "Mutual Action Plan";
		default:
			return name;
	}
}

function titleCase(value: string) {
	return value
		.split(/[_\s-]+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}
