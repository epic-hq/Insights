import { describe, expect, it } from "vitest"
import { normalizeRecallTranscript } from "./normalizeRecallTranscript.server"

describe("normalizeRecallTranscript", () => {
	it("normalizes participant segments into speaker transcripts", () => {
		const result = normalizeRecallTranscript([
			{
				participant: { id: 1, name: "Alice" },
				words: [
					{
						text: "Hello",
						start_timestamp: { relative: 0 },
						end_timestamp: { relative: 0.5 },
					},
					{
						text: "world!",
						start_timestamp: { relative: 0.6 },
						end_timestamp: { relative: 1.2 },
					},
				],
			},
		])

		expect(result.full_transcript).toBe("Alice: Hello world!")
		expect(result.speaker_transcripts).toHaveLength(1)
		expect(result.speaker_transcripts[0]).toMatchObject({
			speaker: "Alice",
			text: "Hello world!",
			start: 0,
			end: 1.2,
		})
		expect(result.word_count).toBe(2)
		expect(result.speaker_count).toBe(1)
	})

	it("falls back to generic speaker labels when name missing", () => {
		const result = normalizeRecallTranscript([
			{
				participant: { id: 2, name: null },
				words: [
					{ text: "Testing", start_timestamp: { relative: 5 }, end_timestamp: { relative: 6 } },
				],
			},
		])

		expect(result.speaker_transcripts[0].speaker).toBe("Speaker 2")
	})
})
