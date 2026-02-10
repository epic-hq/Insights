/**
 * InterviewChapters — visible card-based timeline for interview evidence
 * Shows evidence grouped by topic with timestamp, title, and description in clean cards.
 * Replaces the older PlayByPlayTimeline with a more visual, scannable design.
 */

import { List } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";
import type { Evidence } from "~/types";

interface InterviewChaptersProps {
	evidence: Evidence[];
	/** Optional callback when a chapter is clicked */
	onChapterClick?: (seconds: number | null) => void;
	className?: string;
}

function extractAnchorSeconds(item: Evidence): number | null {
	const anchors = Array.isArray(item.anchors) ? (item.anchors as Array<Record<string, unknown>>) : [];
	const anchor = anchors.find((a) => a && typeof a === "object");
	if (!anchor) return null;

	const rawStart =
		(anchor.start_ms as number) ??
		(anchor.startMs as number) ??
		(anchor.start_seconds as number) ??
		(anchor.startSeconds as number) ??
		(anchor.start_sec as number) ??
		(anchor.start as number) ??
		(anchor.start_time as number);

	if (typeof rawStart === "number" && Number.isFinite(rawStart)) {
		return rawStart > 500 ? rawStart / 1000 : rawStart;
	}
	return null;
}

function formatTimestamp(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

type Chapter = {
	topic: string;
	time: number | null;
	firstItem: Evidence;
	count: number;
	description: string | null;
};

export function InterviewChapters({ evidence, onChapterClick, className }: InterviewChaptersProps) {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	// Sort evidence chronologically
	const sortedEvidence = [...evidence].sort(
		(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
	);

	// Group by topic to create chapters
	const chapterMap = new Map<string, Chapter>();
	for (const item of sortedEvidence) {
		const topic = (item as any)?.topic;
		if (!topic || typeof topic !== "string" || topic.trim().length === 0) continue;

		const seconds = extractAnchorSeconds(item);
		const existing = chapterMap.get(topic);

		if (!existing) {
			chapterMap.set(topic, {
				topic,
				time: seconds,
				firstItem: item,
				count: 1,
				description: item.gist || null,
			});
		} else {
			existing.count += 1;
			// Use earliest timestamp
			if (
				(seconds !== null && existing.time === null) ||
				(seconds !== null && existing.time !== null && seconds < existing.time)
			) {
				existing.time = seconds;
				existing.firstItem = item;
				existing.description = item.gist || existing.description;
			}
		}
	}

	const chapters = Array.from(chapterMap.values()).sort((a, b) => {
		const aTime = a.time ?? Number.MAX_VALUE;
		const bTime = b.time ?? Number.MAX_VALUE;
		return aTime - bTime;
	});

	const handleChapterClick = (index: number, time: number | null) => {
		setActiveIndex(index);
		onChapterClick?.(time);
	};

	if (chapters.length === 0) {
		return null;
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Section header */}
			<div className="flex items-center gap-2">
				<List className="h-4 w-4 text-muted-foreground" />
				<h3 className="font-semibold text-base text-foreground">Chapters</h3>
			</div>

			{/* Chapter cards */}
			<div className="space-y-1.5">
				{chapters.map((chapter, index) => {
					const isActive = activeIndex === index;
					return (
						<button
							key={`${chapter.topic}-${index}`}
							type="button"
							onClick={() => handleChapterClick(index, chapter.time)}
							className={cn(
								"group w-full rounded-md border px-3 py-2 text-left transition-all",
								isActive
									? "border-primary bg-primary/10"
									: "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
							)}
						>
							{/* Title with inline time */}
							<div className="flex items-baseline justify-between gap-2">
								<div
									className={cn(
										"flex-1 font-semibold text-sm leading-tight",
										isActive ? "text-primary" : "text-foreground group-hover:text-primary"
									)}
								>
									{chapter.topic}
								</div>
								<span className={cn("shrink-0 font-mono text-xs", isActive ? "text-primary" : "text-muted-foreground")}>
									{chapter.time !== null ? formatTimestamp(chapter.time) : "—:—"}
								</span>
							</div>

							{/* Description */}
							{chapter.description && (
								<div className="mt-1 line-clamp-1 text-muted-foreground text-xs">{chapter.description}</div>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
