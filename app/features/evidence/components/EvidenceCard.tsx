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
	chapter_title?: string | null
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
	
	const mediaAnchors = anchors.filter((anchor) => {
		if (!anchor || typeof anchor !== "object") return false
		const type = anchor.type?.toLowerCase()
		// Accept media types OR doc types that have time-based start values (not paragraph refs)
		const isMediaType = type === "audio" || type === "video" || type === "av" || type === "media" || type === "clip"
		const isDocWithTime =
			type === "doc" &&
			anchor.start &&
			typeof anchor.start === "string" &&
			(anchor.start.includes(":") || anchor.start.includes("ms") || /^\d+(\.\d+)?$/.test(anchor.start))
		return isMediaType || isDocWithTime
	})
	const resolvedMediaUrl = interview?.media_url ?? null

	const primarySpeaker = useMemo(() => {
		if (!people?.length) return null
		const explicitSpeaker = people.find((person) => person.role?.toLowerCase() === "speaker")
		return explicitSpeaker ?? people[0]
	}, [people])

	const speakerLabel = useMemo(() => {
		if (!primarySpeaker) return null
		const base = primarySpeaker.name ?? "Unknown speaker"
		return primarySpeaker.role ? `${base} (${primarySpeaker.role})` : base
	}, [primarySpeaker])

	const personaBadges = primarySpeaker?.personas ?? []

	const supportLevel = getSupportConfidenceLevel(evidence.support)
	const supportLabel = formatSupportLabel(evidence.support)
	const createdLabel = evidence.created_at ? new Date(evidence.created_at).toLocaleString() : null

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
	const topic = evidence.topic ?? null
	const contextSummary = evidence.context_summary ?? null
	const hasMediaReplay = mediaAnchors.length > 0 && Boolean(resolvedMediaUrl)

	const miniView = (
		<div className="flex max-w-sm items-start gap-3">
			<div
				className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
				style={{ backgroundColor: `${themeColor}22` }}
			>
				<Quote className="h-5 w-5" style={{ color: themeColor }} />
			</div>
			<div className="flex-1 space-y-2">
				{topic && (
					<Badge variant="outline" className="text-xs uppercase tracking-wide">
						{topic}
					</Badge>
				)}
				<p className="font-semibold text-foreground text-sm leading-5">{gist}</p>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
					<div className="flex items-center gap-2">
						<ConfidenceBarChart level={supportLevel} size="sm" />
						<span className="capitalize">{supportLabel}</span>
					</div>
					{speakerLabel && (
						<>
							<span>•</span>
							<span className="truncate">{speakerLabel}</span>
						</>
					)}
				</div>
			</div>
		</div>
	)

	const expandedView = (
		<div className="max-w-xl space-y-4">
			<div className="flex items-start gap-4">
				{/* <div
					className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
					style={{ backgroundColor: `${themeColor}22` }}
				>
					<Quote className="h-5 w-5" style={{ color: themeColor }} />
				</div> */}
				<div className="flex-1 space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="space-y-2">
							{topic && (
								<Badge variant="outline" className="text-xs capitalize tracking-wide">
									{topic}
								</Badge>
							)}
							<h3 className="font-semibold text-foreground text-lg leading-6">{gist}</h3>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs">
							<ConfidenceBarChart level={supportLevel} />
							<Badge variant="secondary" className="text-xs capitalize">
								{supportLabel}
							</Badge>
							{evidence.confidence && (
								<Badge variant="outline" className="text-xs capitalize">
									{`Confidence: ${evidence.confidence}`}
								</Badge>
							)}
						</div>
					</div>
					{chunk && (
						<blockquote
							className="border-muted border-l-4 pl-4 text-foreground/80"
							style={{ borderLeftColor: themeColor }}
						>
							“{chunk}”
						</blockquote>
					)}
					{contextSummary && <p className="text-foreground text-sm">{contextSummary}</p>}
				</div>
			</div>

			{evidence.kind_tags && evidence.kind_tags.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{evidence.kind_tags.map((tag, index) => (
						<Badge key={`${tag}-${index}`} variant="outline" className="rounded-full px-3 py-1 text-xs">
							{tag}
						</Badge>
					))}
				</div>
			)}

			<div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground text-xs">
				{speakerLabel && <span className="truncate">Speaker: {speakerLabel}</span>}
				{personaBadges.length > 0 && (
					<div className="flex flex-wrap items-center gap-1">
						{personaBadges.map((persona) => (
							<Badge key={persona.id} variant="outline" className="bg-emerald-50 text-emerald-800 text-xs">
								{persona.name}
							</Badge>
						))}
					</div>
				)}
				{evidence.method && <span>Method: {evidence.method}</span>}
				{evidence.journey_stage && <span>Journey: {evidence.journey_stage}</span>}
				{createdLabel && <span>Captured {createdLabel}</span>}
			</div>

			{people?.length > 1 && (
				<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
					<span className="font-medium text-foreground">Other participants:</span>
					{people
						.filter((person) => !primarySpeaker || person.id !== primarySpeaker.id)
						.map((person) => (
							<Badge key={person.id} variant="outline" className="text-xs">
								{person.name ?? "Unknown"}
								{person.role ? ` (${person.role})` : ""}
							</Badge>
						))}
				</div>
			)}

			{hasMediaReplay && resolvedMediaUrl && (
				<div className="space-y-3 ">
					<p className="font-semibold text-muted-foreground text-xs uppercase">Media replay</p>
					<div className="space-y-3 rounded-md border-2 border-blue-400">
						{mediaAnchors.map((anchor, index) => {
							const mediaUrl = resolveAnchorMediaUrl(anchor, resolvedMediaUrl)
							if (!mediaUrl) return null
							// Extract filename from URL for better labeling
							const filename = mediaUrl.split("/").pop()?.split("?")[0] || "Recording"
							const displayTitle = anchor.title ?? anchor.chapter_title ?? filename

							return (
								<div key={`anchor-${index}`} className="space-y-2 rounded-lg border border-muted border-dashed p-3">
									<div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
										<span className="font-medium text-foreground">{displayTitle}</span>
										<div className="flex items-center gap-1">
											<Clock className="h-3.5 w-3.5" />
											<span>{formatAnchorTime(anchor.start, anchor.end)}</span>
										</div>
									</div>
									{variant === "expanded" ? (
										<SimpleMediaPlayer mediaUrl={mediaUrl} startTime={anchor.start ?? undefined} title={displayTitle} />
									) : (
										<div className="flex items-center gap-2 text-muted-foreground text-xs">
											<Play className="h-3 w-3" />
											<span>Click to view details and play media</span>
										</div>
									)}
								</div>
							)
						})}
					</div>
				</div>
			)}

			{showInterviewLink && interviewUrl && (
				<div className="flex items-center justify-between border-muted border-t pt-3">
					<div className="text-muted-foreground text-xs">Linked interview</div>
					<Link to={interviewUrl} className="font-medium text-primary text-xs hover:underline">
						{interview?.title ?? "View interview"}
					</Link>
				</div>
			)}
		</div>
	)

	return (
		<motion.div
			className={cn(
				"group relative flex w-max-xl cursor-default overflow-hidden rounded-2xl border border-gray-300 bg-background transition-all duration-300 ease-out hover:shadow-black/5 hover:shadow-lg dark:border-gray-400 dark:bg-gray-900 dark:hover:shadow-white/5",
				className
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			whileHover={{ y: -2, scale: 1.01 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
		>
			<div className="w-max-xl p-4">{variant === "mini" ? miniView : expandedView}</div>
			<motion.div
				className="pointer-events-none absolute inset-0 rounded-2xl opacity-0"
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

function getSupportConfidenceLevel(support?: string | null) {
	const normalized = support?.toLowerCase()
	if (normalized === "supports") return "high"
	if (normalized === "neutral") return "medium"
	return "low"
}

function formatSupportLabel(support?: string | null) {
	if (!support) return "Unknown"
	return support.charAt(0).toUpperCase() + support.slice(1)
}

function resolveAnchorMediaUrl(anchor: EvidenceAnchor, fallback: string) {
	// If target is a string and looks like a URL, use it
	if (
		typeof anchor.target === "string" &&
		(anchor.target.startsWith("http://") || anchor.target.startsWith("https://"))
	) {
		return anchor.target
	}
	// If target is an object with a url property, use that
	if (anchor.target && typeof anchor.target === "object" && anchor.target.url) {
		return anchor.target.url
	}
	// Otherwise use the fallback (interview media_url)
	return fallback
}

function formatAnchorTime(start?: string | number | null, end?: string | number | null) {
	const formattedStart = formatSingleTime(start)
	const formattedEnd = formatSingleTime(end)
	if (formattedStart && formattedEnd) return `${formattedStart} – ${formattedEnd}`
	if (formattedStart) return formattedStart
	return "Unknown"
}

function formatSingleTime(value?: string | number | null) {
	if (value === null || value === undefined) return null
	if (typeof value === "number" && Number.isFinite(value)) {
		return secondsToTimestamp(value)
	}
	if (typeof value === "string") {
		if (value.includes(":")) return value
		const asNumber = Number.parseFloat(value)
		if (!Number.isNaN(asNumber)) {
			return secondsToTimestamp(asNumber)
		}
	}
	return null
}

function secondsToTimestamp(seconds: number) {
	const totalSeconds = Math.max(0, Math.floor(seconds))
	const h = Math.floor(totalSeconds / 3600)
	const m = Math.floor((totalSeconds % 3600) / 60)
	const s = totalSeconds % 60
	if (h > 0) {
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
	}
	return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}
