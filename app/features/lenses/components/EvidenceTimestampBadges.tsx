/**
 * EvidenceTimestampBadges - Reusable component for rendering clickable evidence timestamp badges
 *
 * Displays evidence references as clickable badges that link to the evidence detail page
 * with timestamp query parameters for media playback.
 *
 * Can accept either:
 * 1. Pre-loaded evidence data with timestamps (preferred)
 * 2. Just evidence IDs (will show count without timestamps)
 */

import { Link } from "react-router"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

type EvidenceRef = {
	evidenceId: string
	startMs?: number | null
	transcriptSnippet?: string | null
}

type Props = {
	/** Array of evidence references with optional timestamps */
	evidenceRefs?: EvidenceRef[]
	/** Simple array of evidence IDs (when timestamps not available) */
	evidenceIds?: string[]
	/** Optional class name for the container */
	className?: string
	/** Maximum number of badges to show before truncating */
	maxVisible?: number
}

/**
 * Format milliseconds as MM:SS
 */
function formatTimestamp(ms: number): string {
	const seconds = Math.floor(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60
	return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

export function EvidenceTimestampBadges({ evidenceRefs, evidenceIds, className, maxVisible = 5 }: Props) {
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)

	// Use evidenceRefs if provided, otherwise fall back to evidenceIds
	const refs: EvidenceRef[] = evidenceRefs || (evidenceIds?.map((id) => ({ evidenceId: id })) ?? [])

	if (refs.length === 0) {
		return null
	}

	const visibleRefs = refs.slice(0, maxVisible)
	const hiddenCount = refs.length - maxVisible

	return (
		<div className={className || "mt-2 flex flex-wrap gap-1"}>
			{visibleRefs.map((ref, idx) => {
				const timestamp = Math.floor((ref.startMs ?? 0) / 1000)
				const url = `${routes.evidence.detail(ref.evidenceId)}?t=${timestamp}`

				return (
					<Link
						key={ref.evidenceId || idx}
						to={url}
						className="rounded border bg-background px-2 py-1 font-mono text-xs transition-colors hover:bg-accent/50"
						title={ref.transcriptSnippet || "Jump to timestamp"}
						onClick={(e) => e.stopPropagation()}
					>
						{formatTimestamp(ref.startMs ?? 0)}
					</Link>
				)
			})}
			{hiddenCount > 0 && <span className="px-2 py-1 text-muted-foreground text-xs">+{hiddenCount} more</span>}
		</div>
	)
}

/**
 * Helper function to extract timestamp from evidence anchors array
 * Handles various anchor formats that may exist in the database
 */
export function getTimestampFromAnchors(anchors: unknown): number | null {
	if (!Array.isArray(anchors) || anchors.length === 0) return null
	const firstAnchor = anchors[0] as Record<string, unknown>
	if (!firstAnchor) return null

	// Try start_ms first (milliseconds) - standard format
	if (typeof firstAnchor.start_ms === "number") {
		return firstAnchor.start_ms
	}

	// Try start_seconds and convert to ms
	if (typeof firstAnchor.start_seconds === "number") {
		return firstAnchor.start_seconds * 1000
	}

	// Try legacy start field
	if (typeof firstAnchor.start === "number") {
		// If > 500, assume milliseconds, otherwise seconds
		return firstAnchor.start > 500 ? firstAnchor.start : firstAnchor.start * 1000
	}

	return null
}

/**
 * Convert evidence IDs to EvidenceRef array by looking up timestamps from evidence records
 *
 * @param evidenceIds - Array of evidence UUIDs (can be full UUIDs or 8-char prefixes)
 * @param evidenceMap - Map of evidence ID to evidence record (with anchors, start_ms, etc.)
 */
export function hydrateEvidenceRefs(
	evidenceIds: string[],
	evidenceMap: Map<string, { id: string; anchors?: unknown; start_ms?: number | null; gist?: string | null }>
): EvidenceRef[] {
	return evidenceIds.map((id) => {
		// Try exact match first
		let evidence = evidenceMap.get(id)

		// If not found and id is a prefix (8 chars), find by prefix match
		if (!evidence && id.length === 8) {
			for (const [fullId, e] of evidenceMap.entries()) {
				if (fullId.startsWith(id)) {
					evidence = e
					break
				}
			}
		}

		if (!evidence) {
			return { evidenceId: id }
		}

		// Try to get timestamp from anchors first, then fall back to start_ms
		const startMs = getTimestampFromAnchors(evidence.anchors) ?? evidence.start_ms ?? null

		return {
			evidenceId: evidence.id, // Use full ID for link
			startMs,
			transcriptSnippet: evidence.gist,
		}
	})
}
