import { describe, expect, it } from "vitest";
import { coalesceSpeakerTranscripts } from "./batchEvidence";

describe("coalesceSpeakerTranscripts", () => {
	it("merges adjacent utterances from the same speaker into a fuller thought", () => {
		const result = coalesceSpeakerTranscripts([
			{ speaker: "A", start: 0, end: 1000, text: "I wrote down some quotes." },
			{
				speaker: "A",
				start: 1000,
				end: 2800,
				text: "I'm going to make a post about them because there were so many good nuggets.",
			},
		]);

		expect(result).toEqual([
			{
				speaker: "A",
				start: 0,
				end: 2800,
				text: "I wrote down some quotes. I'm going to make a post about them because there were so many good nuggets.",
			},
		]);
	});

	it("merges likely diarization splits when a thought continues across speaker labels", () => {
		const result = coalesceSpeakerTranscripts([
			{
				speaker: "C",
				start: 80720,
				end: 82600,
				text: "No, we only teach women how to",
			},
			{
				speaker: "B",
				start: 82600,
				end: 84720,
				text: "have honest conversations with mechanics.",
			},
		]);

		expect(result).toEqual([
			{
				speaker: "C",
				start: 80720,
				end: 84720,
				text: "No, we only teach women how to have honest conversations with mechanics.",
			},
		]);
	});

	it("keeps normal turn-taking separate", () => {
		const result = coalesceSpeakerTranscripts([
			{
				speaker: "A",
				start: 0,
				end: 2000,
				text: "What would success look like for you?",
			},
			{
				speaker: "B",
				start: 2200,
				end: 6200,
				text: "I want to feel confident that I can find anything I need within seconds.",
			},
		]);

		expect(result).toHaveLength(2);
		expect(result[0].text).toBe("What would success look like for you?");
		expect(result[1].text).toBe("I want to feel confident that I can find anything I need within seconds.");
	});
});
