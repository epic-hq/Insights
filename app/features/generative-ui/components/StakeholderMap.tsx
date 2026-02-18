/**
 * StakeholderMap - Inline chat widget showing people connected to insights.
 *
 * Renders a list of stakeholders with their titles, organizations, ICP bands,
 * linked themes (as pills with evidence counts), and a representative quote.
 * Designed to feel like people connected to research, not a contact directory.
 */

import { ChevronRight, Quote, Users } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface StakeholderMapData {
	projectId: string;
	headline?: string;
	summary?: string;
	stakeholders: Array<{
		personId: string;
		name: string;
		title: string | null;
		orgName: string | null;
		linkedThemes: Array<{ name: string; evidenceCount: number }>;
		topQuote: string | null;
		icpBand: string | null;
		detailUrl?: string;
	}>;
	totalPeople: number;
	viewAllUrl?: string;
}

interface StakeholderMapProps {
	data: StakeholderMapData;
	isStreaming?: boolean;
}

const ICP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
	high: {
		bg: "bg-emerald-50 dark:bg-emerald-950/50",
		text: "text-emerald-700 dark:text-emerald-400",
		border: "border-emerald-200 dark:border-emerald-800",
	},
	strong: {
		bg: "bg-emerald-50 dark:bg-emerald-950/50",
		text: "text-emerald-700 dark:text-emerald-400",
		border: "border-emerald-200 dark:border-emerald-800",
	},
	medium: {
		bg: "bg-amber-50 dark:bg-amber-950/50",
		text: "text-amber-700 dark:text-amber-400",
		border: "border-amber-200 dark:border-amber-800",
	},
	moderate: {
		bg: "bg-amber-50 dark:bg-amber-950/50",
		text: "text-amber-700 dark:text-amber-400",
		border: "border-amber-200 dark:border-amber-800",
	},
	low: {
		bg: "bg-muted",
		text: "text-muted-foreground",
		border: "border-border",
	},
	weak: {
		bg: "bg-muted",
		text: "text-muted-foreground",
		border: "border-border",
	},
};

function IcpPill({ band }: { band: string }) {
	const key = band.toLowerCase();
	const style = ICP_STYLES[key] ?? {
		bg: "bg-muted",
		text: "text-muted-foreground",
		border: "border-border",
	};

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wider",
				style.bg,
				style.text,
				style.border
			)}
		>
			{band}
		</span>
	);
}

function ThemePill({ name, count }: { name: string; count: number }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
			<span className="max-w-[120px] truncate">{name}</span>
			<span className="font-medium text-foreground">{count}</span>
		</span>
	);
}

export function StakeholderMap({ data, isStreaming }: StakeholderMapProps) {
	const stakeholders = data.stakeholders ?? [];
	const remaining = data.totalPeople - stakeholders.length;

	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header */}
			<div className="px-4 pt-4 pb-3">
				<div className="flex items-center gap-2">
					<Users className="h-4 w-4 shrink-0 text-muted-foreground" />
					<h3 className="font-semibold text-sm">{data.headline ?? "Stakeholders"}</h3>
					<span className="ml-auto shrink-0 text-muted-foreground text-xs">
						{data.totalPeople} {data.totalPeople === 1 ? "person" : "people"}
					</span>
				</div>
				{data.summary && <p className="mt-1.5 text-muted-foreground text-xs leading-relaxed">{data.summary}</p>}
			</div>

			{/* Stakeholder list */}
			{stakeholders.length > 0 && (
				<div className="mx-4 mb-3 divide-y divide-border rounded-md border">
					{stakeholders.map((person) => (
						<div key={person.personId} className="px-3 py-3">
							{/* Name row */}
							<div className="flex items-start gap-2">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-foreground text-sm">{person.name}</span>
										{person.icpBand && <IcpPill band={person.icpBand} />}
									</div>
									{(person.title || person.orgName) && (
										<p className="mt-0.5 text-muted-foreground text-xs">
											{[person.title, person.orgName].filter(Boolean).join(" @ ")}
										</p>
									)}
								</div>
								{person.detailUrl && (
									<Link
										to={person.detailUrl}
										className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										View profile
										<ChevronRight className="h-3 w-3" />
									</Link>
								)}
							</div>

							{/* Themes */}
							{person.linkedThemes.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-1">
									{person.linkedThemes.map((theme) => (
										<ThemePill key={theme.name} name={theme.name} count={theme.evidenceCount} />
									))}
								</div>
							)}

							{/* Quote */}
							{person.topQuote && (
								<blockquote className="mt-2 flex gap-1.5 border-muted-foreground/20 border-l-2 pl-2.5">
									<Quote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
									<p className="line-clamp-2 text-muted-foreground text-xs italic leading-relaxed">{person.topQuote}</p>
								</blockquote>
							)}
						</div>
					))}
				</div>
			)}

			{/* Empty state */}
			{stakeholders.length === 0 && !isStreaming && (
				<div className="mx-4 mb-3 rounded-md border border-dashed px-4 py-6 text-center">
					<Users className="mx-auto h-5 w-5 text-muted-foreground/50" />
					<p className="mt-1.5 text-muted-foreground text-sm">No stakeholders identified yet.</p>
				</div>
			)}

			{/* Footer */}
			{(remaining > 0 || data.viewAllUrl) && (
				<div className="border-t bg-muted/30 px-4 py-2.5">
					{remaining > 0 && !data.viewAllUrl && (
						<p className="text-muted-foreground text-xs">
							+{remaining} more {remaining === 1 ? "person" : "people"}
						</p>
					)}
					{data.viewAllUrl && (
						<Link
							to={data.viewAllUrl}
							className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							View all {data.totalPeople} people
							<ChevronRight className="h-3.5 w-3.5" />
						</Link>
					)}
				</div>
			)}
		</div>
	);
}
