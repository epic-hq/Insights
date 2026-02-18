/**
 * IntakePathPicker Gen-UI Widget
 *
 * Presents the three primary intake paths (upload, record, survey) as
 * selectable cards inline in chat. Each path shows an icon, description,
 * optional hint, and a count badge if already started. A "Recommended"
 * badge highlights the AI-suggested path.
 */

import type { LucideIcon } from "lucide-react";
import { Mail, Mic, Upload } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface IntakePathPickerData {
	projectId: string;
	accountId: string;
	title?: string;
	prompt?: string;
	paths: Array<{
		id: "upload" | "record" | "survey";
		label: string;
		description: string;
		hint?: string;
		started?: boolean;
		count?: number;
		icon?: string;
		actionUrl?: string;
	}>;
	recommendedPath?: "upload" | "record" | "survey";
}

const ICON_MAP: Record<string, LucideIcon> = {
	upload: Upload,
	record: Mic,
	survey: Mail,
	Upload: Upload,
	Mic: Mic,
	Mail: Mail,
};

function resolveIcon(pathId: string, iconName?: string): LucideIcon {
	if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
	return ICON_MAP[pathId] ?? Upload;
}

export function IntakePathPicker({ data, isStreaming }: { data: IntakePathPickerData; isStreaming?: boolean }) {
	const paths = data.paths ?? [];

	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Prompt */}
			<div className="px-4 pt-4 pb-3">
				{data.title && <h4 className="font-semibold text-sm">{data.title}</h4>}
				<p className="text-muted-foreground text-sm">{data.prompt ?? "How do you want to get signal?"}</p>
			</div>

			{/* Path cards */}
			<div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
				{paths.map((path) => {
					const Icon = resolveIcon(path.id, path.icon);
					const isRecommended = data.recommendedPath === path.id;

					return (
						<div
							key={path.id}
							className={cn(
								"relative flex flex-col rounded-lg border p-4 transition-colors",
								isRecommended
									? "border-primary/40 bg-primary/5 dark:bg-primary/10"
									: "bg-background hover:border-muted-foreground/30"
							)}
						>
							{/* Recommended badge */}
							{isRecommended && (
								<span className="-top-2.5 absolute right-3 rounded-full bg-primary px-2 py-0.5 font-medium text-[10px] text-primary-foreground">
									Recommended
								</span>
							)}

							{/* Icon + count badge */}
							<div className="mb-3 flex items-center gap-2">
								<div
									className={cn(
										"flex h-8 w-8 items-center justify-center rounded-lg",
										isRecommended ? "bg-primary/10 dark:bg-primary/20" : "bg-muted"
									)}
								>
									<Icon className={cn("h-4 w-4", isRecommended ? "text-primary" : "text-muted-foreground")} />
								</div>
								{path.started && typeof path.count === "number" && (
									<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
										{path.count}
									</span>
								)}
							</div>

							{/* Label + description */}
							<p className="font-medium text-sm">{path.label}</p>
							<p className="mt-0.5 flex-1 text-muted-foreground text-xs leading-relaxed">{path.description}</p>

							{/* Hint */}
							{path.hint && <p className="mt-2 text-[11px] text-muted-foreground/70 italic">{path.hint}</p>}

							{/* Action */}
							{path.actionUrl && (
								<Link
									to={path.actionUrl}
									className={cn(
										"mt-3 inline-flex items-center justify-center rounded-md px-3 py-1.5 font-medium text-xs transition-colors",
										isRecommended
											? "bg-primary text-primary-foreground hover:bg-primary/90"
											: "border bg-background text-foreground hover:bg-muted"
									)}
								>
									{path.started ? "Continue" : "Start"}
								</Link>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
