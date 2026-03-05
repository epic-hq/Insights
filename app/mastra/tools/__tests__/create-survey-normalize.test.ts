import { describe, expect, it } from "vitest";

const NPS_PROMPT_PATTERN =
	/\b(nps|net promoter|how likely are you to recommend|recommend (us|this|startupsd|our)\b|recommend .* (colleague|friend|peer))\b/i;

describe("NPS prompt detection pattern", () => {
	it("detects NPS-style likelihood/recommend prompts", () => {
		expect(NPS_PROMPT_PATTERN.test("How likely are you to recommend StartupSD to a colleague?")).toBe(true);
		expect(NPS_PROMPT_PATTERN.test("NPS: recommend us to a friend")).toBe(true);
	});

	it("does not over-match unrelated prompts", () => {
		expect(NPS_PROMPT_PATTERN.test("What features should we recommend to users?")).toBe(false);
		expect(NPS_PROMPT_PATTERN.test("How satisfied are you overall?")).toBe(false);
	});
});
