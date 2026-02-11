import { motion } from "framer-motion";
import {
	AlignLeft,
	BarChart3,
	Box,
	Boxes,
	Brain,
	CheckCircle2,
	ClipboardList,
	Clock,
	FileText,
	Heart,
	Image,
	Layers,
	Mic,
	PersonStanding,
	Play,
	Sparkles,
	Target,
	Users,
	Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "~/components/ui/badge";
import { getEmotionClasses } from "~/components/ui/emotion-badge";
import { SimpleMediaPlayer } from "~/components/ui/SimpleMediaPlayer";
import { MiniPersonCard } from "~/features/people/components/EnhancedPersonCard";
import { cn } from "~/lib/utils";
import type { Evidence } from "~/types";
import { generateMediaUrl, getAnchorStartSeconds, type MediaAnchor } from "~/utils/media-url.client";

type EvidenceFacetChip = {
	kind_slug: string;
	label: string;
	facet_account_id: number;
};

type EvidenceSnippet = (Pick<
	Evidence,
	| "id"
	| "verbatim"
	| "gist"
	| "chunk"
	| "topic"
	| "support"
	| "confidence"
	| "created_at"
	| "journey_stage"
	| "method"
	| "anchors"
	| "interview_id"
	| "source_type"
	| "thumbnail_url"
> & { context_summary?: string | null; similarity?: number }) & {
	facets?: EvidenceFacetChip[];
};

interface EvidenceCardProps {
	evidence: EvidenceSnippet;
	variant?: "mini" | "expanded";
	people?: EvidencePerson[];
	interview?: EvidenceInterview | null;
	showInterviewLink?: boolean;
	projectPath?: string;
	className?: string;
	/** When true, suppresses internal <Link> elements (use when card is inside a wrapping <Link>) */
	disableLinks?: boolean;
}

type EvidencePerson = {
	id: string;
	name: string | null;
	role: string | null;
	personas: Array<{ id: string; name: string }>;
};

type EvidenceInterview = {
	id: string;
	title?: string | null;
	media_url?: string | null;
	duration_sec?: number | null;
	thumbnail_url?: string | null;
};

// Standardized facet kind styling (matches PersonFacetLenses.tsx)
const KIND_CONFIG = {
	emotion: {
		icon: Sparkles,
		textColor: "text-purple-200",
		bgColor: "bg-purple-950/50",
		borderColor: "border-purple-800",
	},
	pain: {
		icon: Heart,
		textColor: "text-rose-200",
		bgColor: "bg-rose-950/50",
		borderColor: "border-rose-800",
	},
	goal: {
		icon: Target,
		textColor: "text-emerald-200",
		bgColor: "bg-emerald-950/50",
		borderColor: "border-emerald-800",
	},
	gain: {
		icon: Target,
		textColor: "text-emerald-200",
		bgColor: "bg-emerald-950/50",
		borderColor: "border-emerald-800",
	},
	workflow: {
		icon: Layers,
		textColor: "text-amber-200",
		bgColor: "bg-amber-950/50",
		borderColor: "border-amber-800",
	},
	task: {
		icon: BarChart3,
		textColor: "text-blue-200",
		bgColor: "bg-blue-950/50",
		borderColor: "border-blue-800",
	},
	demographic: {
		icon: Users,
		textColor: "text-slate-200",
		bgColor: "bg-slate-950/50",
		borderColor: "border-slate-800",
	},
	preference: {
		icon: AlignLeft,
		textColor: "text-indigo-200",
		bgColor: "bg-indigo-950/50",
		borderColor: "border-indigo-800",
	},
	artifact: {
		icon: Box,
		textColor: "text-purple-200",
		bgColor: "bg-purple-950/50",
		borderColor: "border-purple-800",
	},
	tool: {
		icon: Wrench,
		textColor: "text-cyan-200",
		bgColor: "bg-cyan-950/50",
		borderColor: "border-cyan-800",
	},
	behavior: {
		icon: PersonStanding,
		textColor: "text-orange-200",
		bgColor: "bg-orange-950/50",
		borderColor: "border-orange-800",
	},
	context: {
		icon: Image,
		textColor: "text-teal-200",
		bgColor: "bg-teal-950/50",
		borderColor: "border-teal-800",
	},
	job_function: {
		icon: Boxes,
		textColor: "text-violet-200",
		bgColor: "bg-violet-950/50",
		borderColor: "border-violet-800",
	},
} as const;

type KindSlug = keyof typeof KIND_CONFIG;

function getFacetConfig(kindSlug: string) {
	const slug = kindSlug?.toLowerCase() as KindSlug;
	return (
		KIND_CONFIG[slug] ?? {
			icon: Sparkles,
			textColor: "text-gray-200",
			bgColor: "bg-gray-950/50",
			borderColor: "border-gray-800",
		}
	);
}

// Removed - use MediaAnchor from media-url.client instead

function EvidenceCard({
	evidence,
	variant = "expanded",
	people = [],
	interview,
	showInterviewLink = false,
	projectPath,
	className = "",
	disableLinks = false,
}: EvidenceCardProps) {
	const [isHovered, setIsHovered] = useState(false);

	const interviewId = evidence.interview_id ?? interview?.id ?? null;
	const interviewUrl = projectPath && interviewId ? `${projectPath}/interviews/${interviewId}` : null;

	const anchors = Array.isArray(evidence.anchors) ? (evidence.anchors as MediaAnchor[]) : [];
	const fallbackMediaUrl = interview?.media_url ?? null;

	const getStageColor = (stage?: string | null) => {
		if (!stage) return "#3b82f6";
		switch (stage.toLowerCase()) {
			case "awareness":
				return "#f59e0b";
			case "consideration":
				return "#8b5cf6";
			case "decision":
				return "#10b981";
			case "onboarding":
				return "#06b6d4";
			case "retention":
				return "#6366f1";
			default:
				return "#3b82f6";
		}
	};

	const themeColor = getStageColor(evidence.journey_stage);
	const gist = evidence.gist ?? evidence.verbatim;
	const chunk = evidence.chunk ?? evidence.verbatim;

	const primarySpeaker = useMemo(() => {
		if (!people?.length) return null;
		return people.find((p) => p.role?.toLowerCase() === "speaker") ?? people[0];
	}, [people]);

	const _speakerLabel = primarySpeaker
		? `${primarySpeaker.name ?? "Unknown"}${primarySpeaker.role ? ` (${primarySpeaker.role})` : ""}`
		: null;

	const personaBadges = primarySpeaker?.personas ?? [];
	const _supportLevel = getSupportConfidenceLevel(evidence.support);
	const _supportLabel = formatSupportLabel(evidence.support);
	const createdLabel = evidence.created_at ? new Date(evidence.created_at).toLocaleDateString() : null;

	// Filter for media anchors - any anchor with timing or media_key
	const mediaAnchors = anchors.filter((a) => {
		if (!a || typeof a !== "object") return false;
		// Has timing data (start_ms or start_seconds)
		const hasTiming = a.start_ms !== undefined || a.start_seconds !== undefined;
		// Has media reference
		const hasMedia = a.media_key !== undefined || (typeof a.target === "string" && a.target.startsWith("http"));
		return hasTiming || hasMedia;
	});

	// If no media anchors but interview has media, create a fallback anchor
	const effectiveMediaAnchors =
		mediaAnchors.length > 0
			? mediaAnchors
			: fallbackMediaUrl
				? [{ type: "media", start_ms: 0, start_seconds: 0 } as MediaAnchor]
				: [];

	const hasMediaReplay = effectiveMediaAnchors.length > 0;

	return (
		<motion.div
			className={cn(
				"relative flex flex-col overflow-hidden rounded-xl border bg-background transition-all hover:shadow-md",
				className
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			whileHover={{ y: -2, scale: 1.01 }}
			transition={{ duration: 0.25 }}
		>
			{/* Accent bar */}
			<div className="absolute top-0 left-0 h-full w-1" style={{ backgroundColor: themeColor }} />

			{/* Content */}
			<div className={cn("flex flex-col", variant === "mini" ? "space-y-2 p-3" : "space-y-3 p-4")}>
				{/* Gist - Headline */}
				<h3
					className={cn(
						"font-semibold text-foreground leading-snug",
						variant === "mini" ? "line-clamp-2 text-sm" : "line-clamp-3 text-base"
					)}
				>
					{gist}
				</h3>

				{/* Verbatim - Quote (only if exists) */}
				{evidence.verbatim && evidence.verbatim.trim() && (
					<blockquote
						className={cn("text-muted-foreground text-sm italic", variant === "mini" ? "line-clamp-2" : "line-clamp-3")}
					>
						"{evidence.verbatim}"
					</blockquote>
				)}

				{/* Divider & Badges - only if we have any badges to show */}
				{(evidence.facets?.length || evidence.method || evidence.confidence || evidence.similarity) && (
					<>
						<div className="border-border border-t" />

						{/* Metadata Badges */}
						<div className="flex flex-wrap gap-2 text-xs">
							{/* Facet Badges - using standardized colors from KIND_CONFIG */}
							{evidence.facets
								?.map((facet, i) => {
									const config = getFacetConfig(facet.kind_slug || "");
									const Icon = config.icon;

									return (
										<Badge
											key={`${facet.facet_account_id}-${i}`}
											className={cn("gap-1", config.bgColor, config.textColor, config.borderColor)}
										>
											<Icon className="h-3 w-3" />
											{facet.label}
										</Badge>
									);
								})
								.slice(0, 4)}

							{/* Show count of hidden facets */}
							{(evidence.facets?.length ?? 0) > 4 && (
								<Badge variant="outline">+{evidence.facets!.length - 4} more</Badge>
							)}

							{/* Method Badge */}
							{evidence.method && (
								<Badge variant="outline" className="gap-1">
									{evidence.method === "interview" ? (
										<Mic className="h-3 w-3" />
									) : evidence.method === "survey" ? (
										<ClipboardList className="h-3 w-3" />
									) : (
										<FileText className="h-3 w-3" />
									)}
									{evidence.method.charAt(0).toUpperCase() + evidence.method.slice(1)}
								</Badge>
							)}

							{/* Confidence Badge */}
							{evidence.confidence === "high" && (
								<Badge variant="outline" className="gap-1 border-green-700 bg-green-950/30 text-green-300">
									<CheckCircle2 className="h-3 w-3" />
									High
								</Badge>
							)}

							{/* Similarity Score - for semantic matches */}
							{evidence.similarity && evidence.similarity > 0 && (
								<Badge className="gap-1 border-amber-800 bg-amber-950/50 text-amber-200">
									<Brain className="h-3 w-3" />
									{Math.round(evidence.similarity * 100)}% match
								</Badge>
							)}
						</div>
					</>
				)}
			</div>

			{/* Media anchor - only show the first valid one */}
			{hasMediaReplay && effectiveMediaAnchors.length > 0 && (
				<MediaAnchorPlayer
					anchor={effectiveMediaAnchors[0] as MediaAnchor}
					fallbackMediaUrl={fallbackMediaUrl}
					variant={variant}
					evidenceId={evidence.id}
					projectPath={projectPath}
					thumbnailUrl={evidence.thumbnail_url ?? interview?.thumbnail_url}
					disableLinks={disableLinks}
				/>
			)}

			{/* Footer link */}
			{showInterviewLink && interviewUrl && !disableLinks && (
				<div className="flex justify-end border-t px-4 py-2 text-primary text-xs hover:underline">
					<Link to={interviewUrl}>{interview?.title ?? "View interview →"}</Link>
				</div>
			)}

			{/* Hover gradient */}
			<motion.div
				className="pointer-events-none absolute inset-0 rounded-xl opacity-0"
				style={{
					background: `linear-gradient(135deg, ${themeColor}10 0%, ${themeColor}05 100%)`,
				}}
				animate={{ opacity: isHovered ? 1 : 0 }}
				transition={{ duration: 0.3 }}
			/>
		</motion.div>
	);
}

export default EvidenceCard;

// ────────────────────────────
// Helpers
// ────────────────────────────

function getSupportConfidenceLevel(s?: string | null) {
	const n = s?.toLowerCase();
	if (n === "supports") return "high";
	if (n === "neutral") return "medium";
	return "low";
}

function formatSupportLabel(s?: string | null) {
	if (!s) return "Unknown";
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function secondsToTimestamp(seconds: number) {
	const total = Math.max(0, Math.floor(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return h > 0
		? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
		: `${m}:${s.toString().padStart(2, "0")}`;
}

// Component to handle media anchor playback with fresh signed URLs
function MediaAnchorPlayer({
	anchor,
	fallbackMediaUrl,
	variant,
	evidenceId,
	projectPath,
	thumbnailUrl,
	disableLinks = false,
}: {
	anchor: MediaAnchor;
	fallbackMediaUrl?: string | null;
	variant?: "mini" | "expanded";
	evidenceId?: string;
	projectPath?: string;
	thumbnailUrl?: string | null;
	disableLinks?: boolean;
}) {
	const [mediaUrl, setMediaUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		async function loadMediaUrl() {
			setIsLoading(true);
			const url = await generateMediaUrl(anchor, fallbackMediaUrl);
			if (!cancelled) {
				setMediaUrl(url);
				setIsLoading(false);
			}
		}

		loadMediaUrl();

		return () => {
			cancelled = true;
		};
	}, [anchor, fallbackMediaUrl]);

	const seconds = getAnchorStartSeconds(anchor);
	const displayTitle = anchor?.chapter_title;
	const isValidUrl = mediaUrl && mediaUrl !== "Unknown" && !mediaUrl.includes("undefined");

	return (
		<div className="mt-2 px-4">
			{variant === "expanded" ? (
				// Expanded: show full player
				<div className="rounded-md border p-2">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Clock className="h-3.5 w-3.5" />
						<span>{secondsToTimestamp(seconds)}</span>
					</div>
					{isLoading ? (
						<div className="mt-2 text-muted-foreground text-sm">Loading media...</div>
					) : isValidUrl ? (
						<SimpleMediaPlayer
							mediaUrl={mediaUrl}
							startTime={seconds}
							title={displayTitle}
							thumbnailUrl={thumbnailUrl}
						/>
					) : (
						<div className="mt-2 text-muted-foreground text-sm">Media unavailable</div>
					)}
				</div>
			) : (
				// Mini: show compact thumbnail with timestamp
				<div className="flex items-center gap-2 text-muted-foreground text-xs">
					<Clock className="h-3 w-3" />
					<span>{secondsToTimestamp(seconds)}</span>
					{isValidUrl && thumbnailUrl && (
						<div className="ml-auto">
							<div className="relative h-12 w-16 overflow-hidden rounded border">
								<img src={thumbnailUrl} alt="Media thumbnail" className="h-full w-full object-cover" />
								<div className="absolute inset-0 flex items-center justify-center bg-black/30">
									<Play className="h-4 w-4 text-white" />
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
