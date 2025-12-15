/**
 * EvidenceModal - Modal for viewing evidence details without navigating away
 *
 * Used in conversation lenses to show evidence clips inline
 */

import { useCallback, useEffect, useState } from "react"
import { useFetcher } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { SimpleMediaPlayer } from "~/components/ui/SimpleMediaPlayer"
import { cn } from "~/lib/utils"
import { generateMediaUrl, getAnchorStartSeconds, type MediaAnchor } from "~/utils/media-url.client"

type EvidenceModalProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	evidenceId: string
	/** Optional timestamp in seconds to start playback */
	startTime?: number
	/** Project path for API calls */
	projectPath: string
}

type EvidenceData = {
	id: string
	verbatim: string | null
	gist: string | null
	chunk: string | null
	topic: string | null
	support: string | null
	confidence: number | null
	journey_stage: string | null
	method: string | null
	anchors: MediaAnchor[] | null
	interview: {
		id: string
		title: string | null
		media_url: string | null
		thumbnail_url: string | null
	} | null
	people: Array<{
		id: string
		name: string | null
		role: string | null
	}>
	facets: Array<{
		kind_slug: string
		label: string
	}>
}

export function EvidenceModal({ open, onOpenChange, evidenceId, startTime, projectPath }: EvidenceModalProps) {
	const fetcher = useFetcher<{ evidence: EvidenceData }>()
	const [mediaUrl, setMediaUrl] = useState<string | null>(null)
	const [isLoadingMedia, setIsLoadingMedia] = useState(false)

	// Memoize the load function to avoid dependency issues
	const loadEvidence = useCallback(() => {
		fetcher.load(`${projectPath}/api/evidence/${evidenceId}`)
	}, [projectPath, evidenceId])

	// Fetch evidence data when modal opens
	useEffect(() => {
		if (open && evidenceId) {
			loadEvidence()
		}
	}, [open, evidenceId, loadEvidence])

	const evidence = fetcher.data?.evidence
	const isLoading = fetcher.state === "loading"

	// Load media URL when evidence is available
	useEffect(() => {
		if (!evidence?.interview?.media_url && !evidence?.anchors?.length) {
			setMediaUrl(null)
			return
		}

		let cancelled = false
		setIsLoadingMedia(true)

		async function loadMediaUrl() {
			const anchors = evidence?.anchors as MediaAnchor[] | null
			const fallbackUrl = evidence?.interview?.media_url ?? null

			// Create an anchor with the start time if provided
			const anchor: MediaAnchor =
				anchors?.[0] ??
				({
					start_ms: (startTime ?? 0) * 1000,
					start_seconds: startTime ?? 0,
				} as MediaAnchor)

			const url = await generateMediaUrl(anchor, fallbackUrl)
			if (!cancelled) {
				setMediaUrl(url)
				setIsLoadingMedia(false)
			}
		}

		loadMediaUrl()

		return () => {
			cancelled = true
		}
	}, [evidence, startTime])

	const effectiveStartTime =
		startTime ?? (evidence?.anchors?.[0] ? getAnchorStartSeconds(evidence.anchors[0] as MediaAnchor) : 0)
	const isValidUrl = mediaUrl && mediaUrl !== "Unknown" && !mediaUrl.includes("undefined")

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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					</div>
				) : evidence ? (
					<div className="flex flex-col">
						{/* Header */}
						<DialogHeader className="border-b px-6 py-4">
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1">
									<DialogTitle className="text-lg leading-tight">
										{evidence.gist ?? evidence.verbatim ?? "Evidence"}
									</DialogTitle>
									{evidence.interview?.title && (
										<p className="mt-1 text-muted-foreground text-sm">From: {evidence.interview.title}</p>
									)}
								</div>
							</div>
						</DialogHeader>

						{/* Media Player */}
						{(isLoadingMedia || isValidUrl) && (
							<div className="border-b bg-black/5 p-4 dark:bg-white/5">
								{isLoadingMedia ? (
									<div className="flex items-center justify-center py-8 text-muted-foreground">Loading media...</div>
								) : isValidUrl ? (
									<SimpleMediaPlayer
										mediaUrl={mediaUrl}
										startTime={effectiveStartTime}
										title={evidence.gist ?? undefined}
										thumbnailUrl={evidence.interview?.thumbnail_url ?? undefined}
									/>
								) : null}
							</div>
						)}

						{/* Quote/Verbatim */}
						{evidence.chunk && (
							<div className="px-6 py-4">
								<blockquote
									className="border-l-4 py-2 pl-4 text-foreground/80 italic"
									style={{ borderLeftColor: getStageColor(evidence.journey_stage) }}
								>
									"{evidence.chunk}"
								</blockquote>
							</div>
						)}

						{/* Metadata */}
						<div className="space-y-3 border-t px-6 py-4">
							{/* People */}
							{evidence.people?.length > 0 && (
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-muted-foreground text-sm">Speaker:</span>
									{evidence.people.map((person) => (
										<Badge key={person.id} variant="secondary" className="text-xs">
											{person.name ?? "Unknown"}
											{person.role && ` (${person.role})`}
										</Badge>
									))}
								</div>
							)}

							{/* Facets */}
							{evidence.facets?.length > 0 && (
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-muted-foreground text-sm">Key aspects:</span>
									{evidence.facets.map((facet) => (
										<Badge key={`${facet.kind_slug}-${facet.label}`} variant="outline" className="text-xs">
											{facet.label}
										</Badge>
									))}
								</div>
							)}

							{/* Journey Stage & Method */}
							<div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
								{evidence.journey_stage && (
									<span className="flex items-center gap-1">
										Stage:{" "}
										<Badge variant="outline" className="text-xs">
											{evidence.journey_stage}
										</Badge>
									</span>
								)}
								{evidence.method && (
									<span className="flex items-center gap-1">
										Method:{" "}
										<Badge variant="outline" className="text-xs">
											{evidence.method}
										</Badge>
									</span>
								)}
								{evidence.support && (
									<span className="flex items-center gap-1">
										Support:{" "}
										<Badge
											variant="outline"
											className={cn(
												"text-xs",
												evidence.support.toLowerCase() === "supports" && "border-emerald-500 text-emerald-600",
												evidence.support.toLowerCase() === "refutes" && "border-red-500 text-red-600"
											)}
										>
											{evidence.support}
										</Badge>
									</span>
								)}
							</div>
						</div>
					</div>
				) : (
					<div className="flex items-center justify-center py-12 text-muted-foreground">Evidence not found</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
