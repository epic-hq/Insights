import { motion } from "framer-motion"
import { Clock, Minus, Play, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { SimpleMediaPlayer } from "~/components/ui/SimpleMediaPlayer"
import { MiniPersonCard } from "~/features/people/components/EnhancedPersonCard"
import { cn } from "~/lib/utils"
import type { Evidence } from "~/types"
import { generateMediaUrl, getAnchorStartSeconds, type MediaAnchor } from "~/utils/media-url.client"

type EvidenceFacetChip = {
	kind_slug: string
	label: string
	facet_account_id: number
}

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
> & { context_summary?: string | null }) & { facets?: EvidenceFacetChip[] }

interface EvidenceCardProps {
	evidence: EvidenceSnippet
	variant?: "mini" | "expanded"
	people?: EvidencePerson[]
	interview?: EvidenceInterview | null
	showInterviewLink?: boolean
	projectPath?: string
	className?: string
}

type EvidencePerson = {
	id: string
	name: string | null
	role: string | null
	personas: Array<{ id: string; name: string }>
}

type EvidenceInterview = {
	id: string
	title?: string | null
	media_url?: string | null
	duration_sec?: number | null
}

type EvidenceAnchor = {
	type?: string
	start?: string | number | null
	end?: string | number | null
	title?: string | null
	speaker?: string | null
	target?: string | { url?: string | null } | null
}

function EvidenceCard({
	evidence,
	variant = "expanded",
	people = [],
	interview,
	showInterviewLink = false,
	projectPath,
	className = "",
}: EvidenceCardProps) {
	const [isHovered, setIsHovered] = useState(false)

	const interviewId = evidence.interview_id ?? interview?.id ?? null
	const interviewUrl = projectPath && interviewId ? `${projectPath}/interviews/${interviewId}` : null

	const anchors = Array.isArray(evidence.anchors) ? (evidence.anchors as EvidenceAnchor[]) : []
	const fallbackMediaUrl = interview?.media_url ?? null

	const getStageColor = (stage?: string | null) => {
		if (!stage) return "#3b82f6"
		switch (stage.toLowerCase()) {
			case "awareness":
				return "#f59e0b"
			case "consideration":
				return "#8b5cf6"
			case "decision":
				return "#10b981"
			case "onboarding":
				return "#06b6d4"
			case "retention":
				return "#6366f1"
			default:
				return "#3b82f6"
		}
	}

	const themeColor = getStageColor(evidence.journey_stage)
	const gist = evidence.gist ?? evidence.verbatim
	const chunk = evidence.chunk ?? evidence.verbatim

	const primarySpeaker = useMemo(() => {
		if (!people?.length) return null
		return people.find((p) => p.role?.toLowerCase() === "speaker") ?? people[0]
	}, [people])

	const speakerLabel = primarySpeaker
		? `${primarySpeaker.name ?? "Unknown"}${primarySpeaker.role ? ` (${primarySpeaker.role})` : ""}`
		: null

	const personaBadges = primarySpeaker?.personas ?? []
	const _supportLevel = getSupportConfidenceLevel(evidence.support)
	const supportLabel = formatSupportLabel(evidence.support)
	const createdLabel = evidence.created_at ? new Date(evidence.created_at).toLocaleDateString() : null

	const getAnchorSeconds = (anchor?: EvidenceAnchor | null): number | null => {
		if (!anchor) return null
		const start = anchor.start
		if (typeof start === "number") return start > 500 ? start / 1000 : start
		if (typeof start === "string") {
			if (start.endsWith("ms")) return Number.parseFloat(start) / 1000
			if (start.includes(":")) {
				const [m, s] = start.split(":").map(Number)
				return m * 60 + s
			}
			const n = Number.parseFloat(start)
			return n > 500 ? n / 1000 : n
		}
		return null
	}

	const mediaAnchors = anchors.filter((a) => {
		if (!a || typeof a !== "object") return false
		const type = (a.type ?? "").toLowerCase()
		const isMediaType = ["audio", "video", "av", "media", "clip"].includes(type)
		const hasTime = getAnchorSeconds(a) !== null
		const hasUrl =
			typeof a.target === "string" ? a.target.startsWith("http") : typeof a.target === "object" && a.target?.url
		return isMediaType || hasTime || hasUrl
	})

	// If no media anchors but interview has media, create a fallback anchor
	const effectiveMediaAnchors =
		mediaAnchors.length > 0
			? mediaAnchors
			: fallbackMediaUrl
				? [{ type: "media", start_ms: 0, start_seconds: 0 } as MediaAnchor]
				: []

	const hasMediaReplay = effectiveMediaAnchors.length > 0

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

			{/* Header */}
			<div className="flex items-start justify-between px-4 pt-3">
				<span className="text-muted-foreground italic">Gist</span>
				<h3 className="font-semibold text-base text-foreground leading-5">{gist}</h3>
				<div className="flex items-center gap-1">
					{evidence.support?.toLowerCase() === "supports" && <Plus className="h-4 w-4 text-emerald-600" />}
					{evidence.support?.toLowerCase() === "opposes" && <Minus className="h-4 w-4 text-destructive" />}
				</div>
			</div>

			{/* Subheader - People first, then topic */}
			<div className="mt-1 px-4 text-foreground text-sm">
				{primarySpeaker && (
					<MiniPersonCard
						person={{
							id: primarySpeaker.id,
							name: primarySpeaker.name,
							image_url: null,
							people_personas: primarySpeaker.personas?.map((p) => ({
								persona_id: p.id,
								personas: {
									id: p.id,
									name: p.name,
									color_hex: "#6366f1",
								},
							})),
						}}
					/>
				)}
				{/* {speakerLabel && evidence.topic} */}
				{/* {evidence.topic && <span>{evidence.topic}</span>} */}
			</div>

			{/* Quote */}
			{chunk && (
				<blockquote
					className="mt-3 border-muted border-l-4 pl-4 text-foreground/80 text-sm italic"
					style={{ borderLeftColor: themeColor }}
				>
					“{chunk}”
				</blockquote>
			)}

			{/* Media anchor - only show the first valid one */}
			{hasMediaReplay && effectiveMediaAnchors.length > 0 && (
				<MediaAnchorPlayer
					anchor={effectiveMediaAnchors[0] as MediaAnchor}
					fallbackMediaUrl={fallbackMediaUrl}
					variant={variant}
				/>
			)}

			{/* Tags and metadata */}
			<div className="mt-3 flex flex-wrap items-center gap-1 px-4 pb-2 text-muted-foreground text-xs">
				<span>Facets:</span>
				{(evidence.facets ?? []).map((facet, i) => (
					<Badge key={`${facet.facet_account_id}-${i}`} variant="outline" className="text-xs">
						{facet.label}
					</Badge>
				))}
				{evidence.journey_stage && <span>Journey Stage:</span>}
				{evidence.journey_stage && (
					<Badge variant="outline" className="text-xs">
						{evidence.journey_stage}
					</Badge>
				)}

				{personaBadges?.length ? <span>Personas:</span> : null}
				{personaBadges?.map((p) => (
					<Badge key={p.id} variant="outline" className="text-xs">
						{p.name}
					</Badge>
				))}
				<div className="ml-auto flex items-center gap-1">
					{evidence.method && (
						<span>
							Method:
							<Badge variant="outline" className="text-xs">
								{evidence.method}
							</Badge>
						</span>
					)}
					{createdLabel && <span>{createdLabel}</span>}
				</div>
			</div>

			{/* Footer link */}
			{showInterviewLink && interviewUrl && (
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
	)
}

export default EvidenceCard

// ────────────────────────────
// Helpers
// ────────────────────────────

function getSupportConfidenceLevel(s?: string | null) {
	const n = s?.toLowerCase()
	if (n === "supports") return "high"
	if (n === "neutral") return "medium"
	return "low"
}

function formatSupportLabel(s?: string | null) {
	if (!s) return "Unknown"
	return s.charAt(0).toUpperCase() + s.slice(1)
}

function secondsToTimestamp(seconds: number) {
	const total = Math.max(0, Math.floor(seconds))
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	return h > 0
		? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
		: `${m}:${s.toString().padStart(2, "0")}`
}

// Component to handle media anchor playback with fresh signed URLs
function MediaAnchorPlayer({
	anchor,
	fallbackMediaUrl,
	variant,
}: {
	anchor: MediaAnchor
	fallbackMediaUrl?: string | null
	variant?: "mini" | "expanded"
}) {
	const [mediaUrl, setMediaUrl] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		let cancelled = false

		async function loadMediaUrl() {
			setIsLoading(true)
			const url = await generateMediaUrl(anchor, fallbackMediaUrl)
			if (!cancelled) {
				setMediaUrl(url)
				setIsLoading(false)
			}
		}

		loadMediaUrl()

		return () => {
			cancelled = true
		}
	}, [anchor, fallbackMediaUrl])

	const seconds = getAnchorStartSeconds(anchor)
	const displayTitle = anchor?.chapter_title
	const isValidUrl = mediaUrl && mediaUrl !== "Unknown" && !mediaUrl.includes("undefined")

	return (
		<div className="mt-3 px-4">
			<div className="rounded-md border p-2">
				<div className="flex items-center gap-2 text-muted-foreground text-xs">
					<Clock className="h-3.5 w-3.5" />
					<span>{secondsToTimestamp(seconds)}</span>
				</div>
				{variant === "expanded" ? (
					isLoading ? (
						<div className="mt-2 text-muted-foreground text-sm">Loading media...</div>
					) : isValidUrl ? (
						<SimpleMediaPlayer mediaUrl={mediaUrl} startTime={seconds} title={displayTitle} />
					) : (
						<div className="mt-2 text-muted-foreground text-sm">Media unavailable</div>
					)
				) : (
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Play className="h-3 w-3" />
						<span>{isLoading ? "Loading..." : isValidUrl ? "Play clip" : "Unavailable"}</span>
					</div>
				)}
			</div>
		</div>
	)
}
