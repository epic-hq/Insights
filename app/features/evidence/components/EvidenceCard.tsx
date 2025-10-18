import { motion } from "framer-motion"
import { Clock, Play, Quote } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { ConfidenceBarChart } from "~/components/ui/ConfidenceBarChart"
import { SimpleMediaPlayer } from "~/components/ui/SimpleMediaPlayer"
import { cn } from "~/lib/utils"
import type { Evidence } from "~/types"

type EvidenceSnippet = Pick<
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
	| "kind_tags"
	| "method"
	| "anchors"
	| "interview_id"
> & { context_summary?: string | null }

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

export function EvidenceCard({
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
	const resolvedMediaUrl = interview?.media_url ?? null

	const getStageColor = (stage?: string) => {
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
	const supportLevel = getSupportConfidenceLevel(evidence.support)
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

	const hasMediaReplay = mediaAnchors.length > 0

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
				<h3 className="font-semibold text-base text-foreground leading-5">{gist}</h3>
				<Badge variant="outline" className="text-xs capitalize">
					{supportLabel}
				</Badge>
			</div>

			{/* Subheader */}
			<div className="mt-1 px-4 text-muted-foreground text-xs">
				{evidence.topic && <span>{evidence.topic}</span>}
				{speakerLabel && evidence.topic && <span className="mx-1">•</span>}
				{speakerLabel && <span>{speakerLabel}</span>}
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

			{/* Media anchors */}
			{hasMediaReplay && (
				<div className="mt-3 space-y-2 px-4">
					{mediaAnchors.map((anchor, i) => {
						const seconds = getAnchorSeconds(anchor)
						const mediaUrl = resolveAnchorMediaUrl(anchor, resolvedMediaUrl)
						if (!mediaUrl) return null
						const displayTitle = anchor.title ?? "Replay segment"
						return (
							<div key={i} className="rounded-md border p-2">
								<div className="flex items-center gap-2 text-muted-foreground text-xs">
									<Clock className="h-3.5 w-3.5" />
									<span>{formatAnchorTime(seconds, null)}</span>
								</div>
								{variant === "expanded" ? (
									<SimpleMediaPlayer mediaUrl={mediaUrl} startTime={seconds} title={displayTitle} />
								) : (
									<div className="flex items-center gap-2 text-muted-foreground text-xs">
										<Play className="h-3 w-3" />
										<span>Play clip</span>
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}

			{/* Tags and metadata */}
			<div className="mt-3 flex flex-wrap items-center gap-1 px-4 pb-2 text-muted-foreground text-xs">
				{evidence.kind_tags?.map((tag, i) => (
					<Badge key={i} variant="outline" className="text-xs">
						{tag}
					</Badge>
				))}
				{evidence.method && (
					<Badge variant="outline" className="text-xs">
						{evidence.method}
					</Badge>
				)}
				{evidence.journey_stage && (
					<Badge variant="outline" className="text-xs">
						{evidence.journey_stage}
					</Badge>
				)}
				{personaBadges.map((p) => (
					<Badge key={p.id} variant="outline" className="text-xs">
						{p.name}
					</Badge>
				))}
				{createdLabel && <span className="ml-auto">{createdLabel}</span>}
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

function resolveAnchorMediaUrl(anchor: EvidenceAnchor, fallback?: string | null): string | null {
	if (typeof anchor.target === "string" && anchor.target.startsWith("http")) return anchor.target
	if (anchor.target && typeof anchor.target === "object" && anchor.target.url) return anchor.target.url
	return fallback ?? null
}

function formatAnchorTime(start?: string | number | null, end?: string | number | null) {
	const formattedStart = formatSingleTime(start)
	const formattedEnd = formatSingleTime(end)
	if (formattedStart && formattedEnd) return `${formattedStart} – ${formattedEnd}`
	return formattedStart ?? "Unknown"
}

function formatSingleTime(value?: string | number | null) {
	if (value == null) return null
	const num = typeof value === "number" ? value : Number.parseFloat(String(value))
	if (Number.isFinite(num)) return secondsToTimestamp(num)
	if (typeof value === "string" && value.includes(":")) return value
	return null
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
