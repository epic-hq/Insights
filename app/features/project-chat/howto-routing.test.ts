import { describe, expect, it } from "vitest";
import { detectHowtoPromptMode } from "./howto-routing";

describe("howto-routing", () => {
	it("detects UX how-to prompts", () => {
		const result = detectHowtoPromptMode("How do I improve usability test quality?");
		expect(result.isHowto).toBe(true);
		expect(result.responseMode).toBe("ux_research_mode");
	});

	it("detects GTM how-to prompts", () => {
		const result = detectHowtoPromptMode("Best way to improve launch messaging and pipeline?");
		expect(result.isHowto).toBe(true);
		expect(result.responseMode).toBe("gtm_mode");
	});

	it("ignores non-howto prompts", () => {
		const result = detectHowtoPromptMode("show me top themes");
		expect(result.isHowto).toBe(false);
		expect(result.responseMode).toBe("ux_research_mode");
	});
});
