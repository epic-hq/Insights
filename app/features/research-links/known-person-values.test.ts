import { describe, expect, it } from "vitest";
import { getKnownPersonValueForQuestion } from "./known-person-values";
import type { ResearchLinkQuestion } from "./schemas";

function makeQuestion(overrides: Partial<ResearchLinkQuestion> = {}): ResearchLinkQuestion {
	return {
		id: overrides.id ?? "q1",
		prompt: overrides.prompt ?? "Question",
		required: false,
		type: "short_text",
		placeholder: null,
		helperText: null,
		options: null,
		allowOther: true,
		likertScale: null,
		likertLabels: null,
		matrixRows: null,
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

describe("getKnownPersonValueForQuestion", () => {
	it("returns known values for direct person field questions", () => {
		const known = getKnownPersonValueForQuestion(makeQuestion({ personFieldKey: "company" }), { company: "StartupSD" });

		expect(known).toMatchObject({
			attributeKey: "company",
			attributeLabel: "Company",
			responseValue: "StartupSD",
			displayValue: "StartupSD",
		});
	});

	it("maps taxonomy-backed questions to a known saved value", () => {
		const known = getKnownPersonValueForQuestion(
			makeQuestion({ taxonomyKey: "industry_vertical", type: "single_select", options: ["Healthcare", "SaaS"] }),
			{ industry: "Healthcare" }
		);

		expect(known?.attributeKey).toBe("industry");
		expect(known?.responseValue).toBe("Healthcare");
	});

	it("supports multi-select questions with saved array values", () => {
		const known = getKnownPersonValueForQuestion(
			makeQuestion({
				personFieldKey: "persona",
				type: "multi_select",
				options: ["Decision Maker", "Influencer"],
				allowOther: false,
			}),
			{ persona: ["Decision Maker", "Champion"] }
		);

		expect(known?.responseValue).toEqual(["Decision Maker"]);
		expect(known?.displayValue).toBe("Decision Maker");
	});

	it("does not offer saved values for incompatible matrix questions", () => {
		const known = getKnownPersonValueForQuestion(makeQuestion({ personFieldKey: "company_size", type: "matrix" }), {
			company_size: "11-50 employees",
		});

		expect(known).toBeNull();
	});

	it("rejects single-select values that are not allowed options when other is disabled", () => {
		const known = getKnownPersonValueForQuestion(
			makeQuestion({
				personFieldKey: "membership_status",
				type: "single_select",
				options: ["Active", "Expired"],
				allowOther: false,
			}),
			{ membership_status: "Prospect" }
		);

		expect(known).toBeNull();
	});
});
