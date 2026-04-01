import { describe, expect, it } from "vitest";
import type { ResearchLinkQuestion } from "./schemas";
import { extractCanonicalSurveyAttributes } from "./survey-person-attributes.server";

function makeQuestion(overrides: Partial<ResearchLinkQuestion>): ResearchLinkQuestion {
	return {
		id: "q",
		prompt: "",
		required: false,
		type: "auto",
		placeholder: null,
		helperText: null,
		options: null,
		allowOther: true,
		likertScale: null,
		likertLabels: null,
		imageOptions: null,
		mediaUrl: null,
		videoUrl: null,
		sectionId: null,
		sectionTitle: null,
		taxonomyKey: null,
		personFieldKey: null,
		hidden: false,
		branching: null,
		...overrides,
	};
}

describe("extractCanonicalSurveyAttributes", () => {
	it("uses explicit taxonomy + personField metadata", () => {
		const questions = [
			makeQuestion({
				id: "q_title",
				prompt: "What is your role?",
				taxonomyKey: "job_title",
				personFieldKey: "title",
			}),
		];
		const responses = { q_title: "VP of Product" };
		const result = extractCanonicalSurveyAttributes(questions, responses);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			taxonomyKey: "job_title",
			personFieldKey: "title",
			values: ["VP of Product"],
			explicit: true,
		});
	});

	it("infers taxonomy from prompt when metadata is missing", () => {
		const questions = [
			makeQuestion({
				id: "q_industry",
				prompt: "What industry are you in?",
			}),
		];
		const responses = { q_industry: "FinTech" };
		const result = extractCanonicalSurveyAttributes(questions, responses);
		expect(result).toHaveLength(1);
		expect(result[0]?.taxonomyKey).toBe("industry_vertical");
		expect(result[0]?.values).toEqual(["FinTech"]);
	});

	it("normalizes seniority from years ranges", () => {
		const questions = [
			makeQuestion({
				id: "q_seniority",
				prompt: "How many years of experience do you have?",
			}),
		];
		const responses = { q_seniority: "5+ years" };
		const result = extractCanonicalSurveyAttributes(questions, responses);
		expect(result).toHaveLength(1);
		expect(result[0]?.taxonomyKey).toBe("seniority_level");
		expect(result[0]?.values).toEqual(["Leadership"]);
	});

	it("prefers explicit mapping over inferred mapping for same taxonomy key", () => {
		const questions = [
			makeQuestion({
				id: "q_a",
				prompt: "What industry are you in?",
			}),
			makeQuestion({
				id: "q_b",
				prompt: "What sector do you focus on?",
				taxonomyKey: "industry_vertical",
			}),
		];
		const responses = {
			q_a: "HealthTech",
			q_b: "Biotech / Life Sciences",
		};
		const result = extractCanonicalSurveyAttributes(questions, responses);
		expect(result).toHaveLength(1);
		expect(result[0]?.taxonomyKey).toBe("industry_vertical");
		expect(result[0]?.values).toEqual(["Biotech / Life Sciences"]);
		expect(result[0]?.explicit).toBe(true);
	});
});
