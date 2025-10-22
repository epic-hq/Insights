import type { SanitizedTranscriptPayload } from "./sanitizeTranscriptData.server"

interface RecallTranscriptWord {
	text?: string | null
	start_timestamp?: {
		absolute?: string | null
		relative?: number | null
	} | null
	end_timestamp?: {
		absolute?: string | null
		relative?: number | null
	} | null
}

interface RecallTranscriptParticipant {
	id?: number | string | null
	name?: string | null
	is_host?: boolean | null
	email?: string | null
	platform?: string | null
	extra_data?: Record<string, unknown> | null
}

interface RecallTranscriptSegment {
	participant?: RecallTranscriptParticipant | null
	words?: RecallTranscriptWord[] | null
	[key: string]: unknown
}

interface NormalizedRecallTranscript extends Partial<SanitizedTranscriptPayload> {
	full_transcript: string
	speaker_transcripts: SanitizedTranscriptPayload["speaker_transcripts"]
	word_count?: number | null
	speaker_count?: number | null
	raw_segments: readonly RecallTranscriptSegment[]
}

const stripWhitespace = (value: string) => value.replace(/\s+/g, " ").trim()

const joinTokens = (tokens: string[]): string => {
	const joined = tokens.join(" ").replace(/\s+([.,!?;:])/g, "$1")
	return stripWhitespace(joined)
}

const coerceRelativeSeconds = (timestamp?: RecallTranscriptWord["start_timestamp"]): number | null => {
	const value = timestamp?.relative
	if (typeof value === "number" && Number.isFinite(value)) return value
	if (typeof value === "string") {
		const numeric = Number.parseFloat(value)
		return Number.isFinite(numeric) ? numeric : null
	}
	return null
}

const buildSpeakerLabel = (participant?: RecallTranscriptParticipant | null, fallbackIndex = 0): string => {
	const name = participant?.name?.trim()
	if (name) return name
	const participantId =
		typeof participant?.id === "number" || typeof participant?.id === "string"
			? String(participant.id)
			: `${fallbackIndex + 1}`
	return `Speaker ${participantId}`
}

export function normalizeRecallTranscript(payload: unknown): NormalizedRecallTranscript {
	const segments = Array.isArray(payload) ? (payload as RecallTranscriptSegment[]) : []

	const speakerTranscripts: SanitizedTranscriptPayload["speaker_transcripts"] = []
	const transcriptParts: string[] = []
	const uniqueSpeakers = new Set<string>()
	let totalWords = 0

	segments.forEach((segment, index) => {
		const words = Array.isArray(segment?.words) ? segment.words : []
		if (words.length === 0) {
			return
		}

		const speaker = buildSpeakerLabel(segment?.participant, index)
		uniqueSpeakers.add(speaker.toLowerCase())

		const tokens = words
			.map((word) => (typeof word?.text === "string" ? word.text.trim() : ""))
			.filter((token) => token.length > 0)

		if (tokens.length === 0) {
			return
		}

		totalWords += tokens.length

		const text = joinTokens(tokens)
		const start = coerceRelativeSeconds(words[0]?.start_timestamp)
		const end = coerceRelativeSeconds(words[words.length - 1]?.end_timestamp)

		speakerTranscripts.push({
			speaker,
			text,
			start,
			end,
			confidence: null,
		})

		transcriptParts.push(`${speaker}: ${text}`)
	})

	return {
		full_transcript: transcriptParts.join("\n\n"),
		speaker_transcripts: speakerTranscripts,
		word_count: totalWords || null,
		speaker_count: uniqueSpeakers.size || null,
		raw_segments: segments,
	}
}
