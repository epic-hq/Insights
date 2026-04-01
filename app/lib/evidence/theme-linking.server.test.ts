import { describe, expect, it } from "vitest";
import {
	findLocalEvidenceMatchesForTheme,
	limitThemeLinksPerEvidence,
	mergeThemeEvidenceMatches,
} from "./theme-linking.server";

describe("findLocalEvidenceMatchesForTheme", () => {
	it("anchors a theme to the direct supporting quote even with timestamps", () => {
		const matches = findLocalEvidenceMatchesForTheme({
			candidates: [
				{
					id: "ev-1",
					verbatim: "contract renews in March",
					chunk: "Our Looker contract renews in March. I'd want to have something in place by February.",
					gist: "Hard deadline for tool switch",
				},
			],
			themeName: "Urgent Replacement Timeline",
			statement: "The buyer has a hard deadline tied to a contract renewal.",
			evidenceQuote: "contract renews in March (1:20)",
		});

		expect(matches).toHaveLength(1);
		expect(matches[0]).toMatchObject({
			id: "ev-1",
			rationale: "Direct quote match",
		});
		expect(matches[0].confidence).toBeGreaterThan(0.95);
	});

	it("falls back to theme text overlap when there is no direct quote", () => {
		const matches = findLocalEvidenceMatchesForTheme({
			candidates: [
				{
					id: "ev-1",
					gist: "Team wastes time choosing lessons",
					chunk:
						"I have maybe 30 minutes a day to learn and I was spending half of it figuring out which lesson to do next instead of actually coding.",
				},
				{
					id: "ev-2",
					gist: "Wants better dashboard styling",
					chunk: "I wish I could customize the dashboard colors more.",
				},
			],
			themeName: "Time wasted on lesson selection",
			statement: "Users lose valuable learning time deciding what lesson to take next.",
			inclusionCriteria: "Quotes about lesson sequencing, deciding what to do next, or losing time to planning.",
		});

		expect(matches).toHaveLength(1);
		expect(matches[0]).toMatchObject({
			id: "ev-1",
			rationale: "Theme text overlap match",
		});
		expect(matches[0].confidence).toBeGreaterThan(0.6);
	});

	it("does not create false positives from broad stopword overlap", () => {
		const matches = findLocalEvidenceMatchesForTheme({
			candidates: [
				{
					id: "ev-1",
					gist: "Vendor networking after teardown",
					chunk: "Host a vendors-only networking hour after teardown so vendors can collaborate and stay connected.",
				},
			],
			themeName: "Preference for Interactive Workshops",
			statement: "Attendees prefer hands-on, interactive workshops that build practical skills over passive learning.",
			inclusionCriteria:
				"Quotes mentioning workshops, hands-on learning, teaching components, or interactive sessions.",
		});

		expect(matches).toEqual([]);
	});
});

describe("mergeThemeEvidenceMatches", () => {
	it("prefers the strongest local quote match over a weaker semantic match", () => {
		const merged = mergeThemeEvidenceMatches(
			[
				{
					id: "ev-1",
					confidence: 0.98,
					rationale: "Direct quote match",
				},
			],
			[
				{
					id: "ev-1",
					similarity: 0.43,
				},
				{
					id: "ev-2",
					similarity: 0.52,
				},
			]
		);

		expect(merged).toEqual([
			{
				id: "ev-1",
				confidence: 0.98,
				rationale: "Direct quote match",
			},
			{
				id: "ev-2",
				confidence: 0.52,
				rationale: "Semantic match (52%)",
			},
		]);
	});
});

describe("limitThemeLinksPerEvidence", () => {
	it("caps tiny interviews to one dominant theme per evidence row", () => {
		const links = limitThemeLinksPerEvidence(
			[
				{
					themeId: "theme-1",
					evidenceId: "ev-1",
					confidence: 0.77,
					rationale: "Theme text overlap match",
				},
				{
					themeId: "theme-2",
					evidenceId: "ev-1",
					confidence: 0.68,
					rationale: "Theme text overlap match",
				},
				{
					themeId: "theme-3",
					evidenceId: "ev-1",
					confidence: 0.66,
					rationale: "Semantic match (66%)",
				},
			],
			1
		);

		expect(links).toEqual([
			{
				themeId: "theme-1",
				evidenceId: "ev-1",
				confidence: 0.77,
				rationale: "Theme text overlap match",
			},
		]);
	});
});
