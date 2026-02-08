/**
 * EvidenceGroup - Groups evidence by interview/organization
 *
 * Clusters related quotes from the same conversation together,
 * with collapsible sections per interview source.
 * Supports both list and carousel views.
 * Uses the existing EvidenceCard component for consistent media playback.
 */

import { Building2, ChevronDown, ChevronRight, Clock, FileText, Mic, Users, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "~/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { SimpleMediaPlayer } from "~/components/ui/SimpleMediaPlayer";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import type { InsightEvidence } from "../pages/insight-detail";

/** Format milliseconds to MM:SS */
function formatTimecode(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Get start time from evidence anchors */
function getStartTime(ev: InsightEvidence): number | null {
	if (!ev.anchors || ev.anchors.length === 0) return null;
	const anchor = ev.anchors[0];
	return anchor.start_ms ?? (anchor.start_seconds ? anchor.start_seconds * 1000 : null);
}

interface EvidenceGroupProps {
	evidence: InsightEvidence[];
	projectPath: string;
}

interface GroupedEvidence {
	key: string;
	label: string;
	organization: string | null;
	interviewId: string | null;
	thumbnail: string | null;
	mediaUrl: string | null;
	items: InsightEvidence[];
}

/** Detect content type from media URL */
function getContentType(mediaUrl: string | null): "audio" | "video" | "text" {
	if (!mediaUrl) return "text";
	const path = mediaUrl.split("?")[0]?.toLowerCase() || "";
	if (/\.(mp3|wav|m4a|aac|ogg|flac|wma|webm)$/i.test(path)) return "audio";
	if (/\.(mp4|mov|avi|mkv|m4v)$/i.test(path)) return "video";
	return "text";
}

/** Get the earliest start time from an evidence item's anchors */
function getEvidenceStartTime(ev: InsightEvidence): number {
	if (!ev.anchors || ev.anchors.length === 0) return Number.MAX_SAFE_INTEGER;

	let earliest = Number.MAX_SAFE_INTEGER;
	for (const anchor of ev.anchors) {
		// Use start_ms if available, otherwise start_seconds * 1000
		const ms = anchor.start_ms ?? (anchor.start_seconds ?? 0) * 1000;
		if (ms < earliest) earliest = ms;
	}
	return earliest;
}

/** Group evidence by interview, with organization as secondary grouping key */
function groupEvidenceByInterview(evidence: InsightEvidence[]): GroupedEvidence[] {
	const groups = new Map<string, GroupedEvidence>();

	for (const ev of evidence) {
		// Use interview_id as primary key, fallback to a generic "ungrouped" key
		const key = ev.interview_id || "ungrouped";

		if (!groups.has(key)) {
			groups.set(key, {
				key,
				label: ev.interview?.title || ev.attribution || "Interview",
				organization: ev.organization,
				interviewId: ev.interview_id,
				thumbnail: ev.interview?.thumbnail_url || null,
				mediaUrl: ev.interview?.media_url || null,
				items: [],
			});
		}

		groups.get(key)!.items.push(ev);
	}

	// Sort items within each group chronologically by anchor start time
	for (const group of groups.values()) {
		group.items.sort((a, b) => getEvidenceStartTime(a) - getEvidenceStartTime(b));
	}

	// Sort groups by number of evidence items (most first)
	return Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length);
}

/** Get accent color based on journey stage */
function getJourneyStageColor(stage?: string | null): string {
	if (!stage) return "bg-blue-500";
	switch (stage.toLowerCase()) {
		case "awareness":
		case "status_quo":
			return "bg-amber-500";
		case "consideration":
		case "passive_looking":
			return "bg-violet-500";
		case "decision":
		case "active_evaluation":
			return "bg-emerald-500";
		case "onboarding":
		case "deciding":
			return "bg-cyan-500";
		case "retention":
		case "onboarding_using":
			return "bg-indigo-500";
		case "expansion":
			return "bg-rose-500";
		default:
			return "bg-blue-500";
	}
}

/** Truncate text helper */
function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trim()}...`;
}

/** Horizontal chapter card matching evidenceDetail pattern */
function ChapterCard({
	evidence,
	isActive,
	onClick,
}: {
	evidence: InsightEvidence;
	isActive: boolean;
	onClick: () => void;
}) {
	const startTime = getStartTime(evidence);
	const timecode = startTime ? formatTimecode(startTime) : "0:00";
	const gist = evidence.gist || evidence.verbatim || "Evidence";
	const accentColor = getJourneyStageColor(evidence.journey_stage);

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"group relative flex h-20 w-48 shrink-0 flex-col overflow-hidden rounded-lg border bg-background text-left transition-all",
				"hover:border-primary/50 hover:shadow-sm",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				isActive && "border-primary bg-primary/5 ring-1 ring-primary/20"
			)}
		>
			{/* Accent bar */}
			<div className={cn("h-1 w-full", accentColor)} />

			{/* Content */}
			<div className="flex flex-1 flex-col justify-between p-2.5">
				{/* Gist - primary content */}
				<p
					className={cn(
						"line-clamp-2 text-sm leading-tight",
						isActive ? "font-medium text-foreground" : "text-muted-foreground"
					)}
				>
					{truncateText(gist, 50)}
				</p>

				{/* Timestamp - secondary, below text */}
				<div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
					<Clock className="h-3 w-3" />
					<span>{timecode}</span>
				</div>
			</div>

			{/* Selection indicator */}
			{isActive && <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-primary" />}
		</button>
	);
}

/** Thumbnail with signed URL fetching */
function SignedThumbnail({ thumbnailUrl, mediaUrl }: { thumbnailUrl: string | null; mediaUrl: string | null }) {
	const [signedUrl, setSignedUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(!!thumbnailUrl);

	useEffect(() => {
		if (!thumbnailUrl) {
			setIsLoading(false);
			return;
		}

		let cancelled = false;

		async function fetchSignedUrl() {
			try {
				const response = await fetch("/api/media/signed-url", {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ mediaUrl: thumbnailUrl, intent: "playback" }),
				});

				if (response.ok && !cancelled) {
					const data = (await response.json()) as { signedUrl?: string };
					if (data.signedUrl) {
						setSignedUrl(data.signedUrl);
					}
				}
			} catch {
				// Silently fail - will show icon fallback
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		fetchSignedUrl();

		return () => {
			cancelled = true;
		};
	}, [thumbnailUrl]);

	// Show signed thumbnail if available
	if (signedUrl) {
		return <img src={signedUrl} alt="" className="h-full w-full object-cover" />;
	}

	// Show loading placeholder or content type icon
	const contentType = getContentType(mediaUrl);

	return (
		<div className="flex h-full w-full items-center justify-center">
			{isLoading ? (
				<div className="h-4 w-4 animate-pulse rounded bg-muted-foreground/20" />
			) : contentType === "audio" ? (
				<Mic className="h-5 w-5 text-muted-foreground/50" />
			) : contentType === "video" ? (
				<Video className="h-5 w-5 text-muted-foreground/50" />
			) : (
				<FileText className="h-5 w-5 text-muted-foreground/50" />
			)}
		</div>
	);
}

/** Horizontal carousel component for evidence items with media player */
function EvidenceCarousel({
	items,
	onSelectEvidence,
}: {
	items: InsightEvidence[];
	onSelectEvidence?: (evidence: InsightEvidence) => void;
}) {
	const [activeIndex, setActiveIndex] = useState(0);
	const activeEvidence = items[activeIndex];

	const handleSelect = (ev: InsightEvidence, index: number) => {
		setActiveIndex(index);
		onSelectEvidence?.(ev);
	};

	// Get media URL and start time from active evidence
	const mediaUrl = activeEvidence?.interview?.media_url;
	const startTimeMs = getStartTime(activeEvidence);
	// Convert milliseconds to seconds for SimpleMediaPlayer
	const startTimeSeconds = startTimeMs ? startTimeMs / 1000 : 0;

	return (
		<div className="space-y-4">
			{/* Media Player - show when evidence has media */}
			{mediaUrl && (
				<SimpleMediaPlayer
					key={`${activeEvidence.id}-${startTimeSeconds}`}
					mediaUrl={mediaUrl}
					startTime={startTimeSeconds}
					title={activeEvidence.gist || "Evidence"}
					thumbnailUrl={activeEvidence.interview?.thumbnail_url}
					autoPlay={false}
				/>
			)}

			{/* Active evidence quote */}
			{activeEvidence?.verbatim && (
				<blockquote className="border-primary/30 border-l-2 py-1 pl-4 text-muted-foreground text-sm italic">
					"{activeEvidence.verbatim}"
				</blockquote>
			)}

			{/* Horizontal scroll container */}
			<div className="-mx-4 px-4">
				<div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border flex gap-3 overflow-x-auto pb-3">
					{items.map((ev, idx) => (
						<ChapterCard
							key={ev.id}
							evidence={ev}
							isActive={idx === activeIndex}
							onClick={() => handleSelect(ev, idx)}
						/>
					))}
				</div>
			</div>

			{/* Counter */}
			{items.length > 1 && (
				<div className="text-center text-muted-foreground text-xs">
					{activeIndex + 1} of {items.length} moments
				</div>
			)}
		</div>
	);
}

export function EvidenceGroupedByInterview({ evidence, projectPath }: EvidenceGroupProps) {
	const groups = groupEvidenceByInterview(evidence);
	const routes = useProjectRoutes(projectPath);

	// Track which groups are expanded (default: all collapsed)
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

	const toggleGroup = (key: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	if (groups.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center">
				<FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
				<p className="mt-2 text-muted-foreground text-sm">No evidence linked to this insight yet</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Summary header */}
			<div className="flex items-center gap-4 text-muted-foreground text-sm">
				<div className="flex items-center gap-1.5">
					<FileText className="h-4 w-4" />
					<span>{evidence.length} quotes</span>
				</div>
				<div className="flex items-center gap-1.5">
					<Users className="h-4 w-4" />
					<span>{groups.length} interviews</span>
				</div>
			</div>

			{/* Grouped evidence */}
			<div className="space-y-3">
				{groups.map((group) => {
					const isExpanded = expandedGroups.has(group.key);

					return (
						<Collapsible key={group.key} open={isExpanded} onOpenChange={() => toggleGroup(group.key)}>
							{/* Group header */}
							<div className="rounded-lg border bg-card">
								<CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50">
									{/* Thumbnail with signed URL and content type icon fallback */}
									<div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-muted">
										<SignedThumbnail thumbnailUrl={group.thumbnail} mediaUrl={group.mediaUrl} />
									</div>

									{/* Label and org */}
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											{isExpanded ? (
												<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
											) : (
												<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
											)}
											<span className="truncate font-medium">{group.label}</span>
										</div>
										{group.organization && (
											<div className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
												<Building2 className="h-3 w-3" />
												{group.organization}
											</div>
										)}
									</div>

									{/* Count badge */}
									<Badge variant="secondary" className="shrink-0">
										{group.items.length} quote
										{group.items.length !== 1 ? "s" : ""}
									</Badge>
								</CollapsibleTrigger>

								<CollapsibleContent>
									<div className="border-t px-4 py-4">
										{/* Horizontal carousel view for evidence */}
										<EvidenceCarousel items={group.items} />

										{/* Link to full interview */}
										{group.interviewId && (
											<Link
												to={routes.interviews.detail(group.interviewId)}
												className="mt-4 block text-center text-primary text-sm hover:underline"
											>
												View full interview →
											</Link>
										)}
									</div>
								</CollapsibleContent>
							</div>
						</Collapsible>
					);
				})}
			</div>
		</div>
	);
}
