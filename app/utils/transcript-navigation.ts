// Utility functions for navigating transcripts by timecode

interface TranscriptSegment {
	start: number
	end?: number
	text: string
	speaker?: string
}

interface SpeakerTranscript {
	start: number
	end: number
	text: string
	speaker?: string
	confidence?: number
}

/**
 * Parse time string to seconds
 */
export function parseTimeToSeconds(time: string | number | undefined): number {
	if (typeof time === "number") return time
	if (!time) return 0

	// Handle MM:SS format
	if (typeof time === "string" && time.includes(":")) {
		const parts = time.split(":")
		if (parts.length === 2) {
			const minutes = Number.parseInt(parts[0], 10) || 0
			const seconds = Number.parseInt(parts[1], 10) || 0
			return minutes * 60 + seconds
		}
		if (parts.length === 3) {
			const hours = Number.parseInt(parts[0], 10) || 0
			const minutes = Number.parseInt(parts[1], 10) || 0
			const seconds = Number.parseInt(parts[2], 10) || 0
			return hours * 3600 + minutes * 60 + seconds
		}
	}

	// Handle string numbers
	if (typeof time === "string") {
		const parsed = Number.parseFloat(time)
		return Number.isNaN(parsed) ? 0 : parsed
	}

	return 0
}

/**
 * Find transcript segment that contains the given timecode
 */
export function findTranscriptSegmentByTime(
	speakerTranscripts: SpeakerTranscript[] | null | undefined,
	targetTimeSeconds: number,
	contextWindowSeconds = 10
): TranscriptSegment | null {
	if (!speakerTranscripts || !Array.isArray(speakerTranscripts)) {
		return null
	}

	// Find the segment that contains the target time
	const exactMatch = speakerTranscripts.find((segment) => {
		const start = parseTimeToSeconds(segment.start)
		const end = parseTimeToSeconds(segment.end)
		return targetTimeSeconds >= start && targetTimeSeconds <= end
	})

	if (exactMatch) {
		return {
			start: parseTimeToSeconds(exactMatch.start),
			end: parseTimeToSeconds(exactMatch.end),
			text: exactMatch.text,
			speaker: exactMatch.speaker,
		}
	}

	// If no exact match, find the closest segment within context window
	let closestSegment: SpeakerTranscript | null = null
	let closestDistance = Number.POSITIVE_INFINITY

	for (const segment of speakerTranscripts) {
		const segmentStart = parseTimeToSeconds(segment.start)
		const segmentEnd = parseTimeToSeconds(segment.end)

		// Calculate distance to segment
		let distance: number
		if (targetTimeSeconds < segmentStart) {
			distance = segmentStart - targetTimeSeconds
		} else if (targetTimeSeconds > segmentEnd) {
			distance = targetTimeSeconds - segmentEnd
		} else {
			distance = 0 // Inside segment
		}

		if (distance < closestDistance && distance <= contextWindowSeconds) {
			closestDistance = distance
			closestSegment = segment
		}
	}

	if (closestSegment) {
		return {
			start: parseTimeToSeconds(closestSegment.start),
			end: parseTimeToSeconds(closestSegment.end),
			text: closestSegment.text,
			speaker: closestSegment.speaker,
		}
	}

	return null
}

/**
 * Get context around a timecode (segments before and after)
 */
export function getTranscriptContext(
	speakerTranscripts: SpeakerTranscript[] | null | undefined,
	targetTimeSeconds: number,
	contextSegments = 2
): TranscriptSegment[] {
	if (!speakerTranscripts || !Array.isArray(speakerTranscripts)) {
		return []
	}

	// Sort by start time
	const sortedSegments = [...speakerTranscripts].sort(
		(a, b) => parseTimeToSeconds(a.start) - parseTimeToSeconds(b.start)
	)

	// Find the segment index that contains or is closest to target time
	let targetIndex = -1
	let closestDistance = Number.POSITIVE_INFINITY

	for (let i = 0; i < sortedSegments.length; i++) {
		const segment = sortedSegments[i]
		const segmentStart = parseTimeToSeconds(segment.start)
		const segmentEnd = parseTimeToSeconds(segment.end)

		if (targetTimeSeconds >= segmentStart && targetTimeSeconds <= segmentEnd) {
			targetIndex = i
			break
		}

		const distance = Math.min(Math.abs(targetTimeSeconds - segmentStart), Math.abs(targetTimeSeconds - segmentEnd))

		if (distance < closestDistance) {
			closestDistance = distance
			targetIndex = i
		}
	}

	if (targetIndex === -1) return []

	// Get context segments around the target
	const startIndex = Math.max(0, targetIndex - contextSegments)
	const endIndex = Math.min(sortedSegments.length - 1, targetIndex + contextSegments)

	const contextSegments_result: TranscriptSegment[] = []
	for (let i = startIndex; i <= endIndex; i++) {
		const segment = sortedSegments[i]
		contextSegments_result.push({
			start: parseTimeToSeconds(segment.start),
			end: parseTimeToSeconds(segment.end),
			text: segment.text,
			speaker: segment.speaker,
		})
	}

	return contextSegments_result
}

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
export function formatTimecode(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "00:00"

	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	const secs = Math.floor(seconds % 60)

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
	}

	return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
