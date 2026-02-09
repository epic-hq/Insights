export type HowtoResponseMode = "ux_research_mode" | "gtm_mode";

export type HowtoRoutingResult = {
	isHowto: boolean;
	responseMode: HowtoResponseMode;
	hasGtmSignal: boolean;
	hasUxResearchSignal: boolean;
};

const HOWTO_PREFIX_REGEX = /^(how do i|how can i|where do i|what is the best way to|teach me)\b/;

function hasAny(prompt: string, ...tokens: string[]): boolean {
	return tokens.some((token) => prompt.includes(token));
}

export function detectHowtoPromptMode(promptInput: string): HowtoRoutingResult {
	const prompt = promptInput.trim().toLowerCase();
	const startsWithHowTo = HOWTO_PREFIX_REGEX.test(prompt);
	const asksHowToGuidance =
		startsWithHowTo || hasAny(prompt, "how do i", "where do i", "best way to", "teach me", "walk me through");

	const hasGtmSignal = hasAny(
		prompt,
		"gtm",
		"go to market",
		"go-to-market",
		"positioning",
		"messaging",
		"distribution",
		"acquisition",
		"activation",
		"pipeline",
		"launch",
		"pricing",
		"sales"
	);
	const hasUxResearchSignal = hasAny(
		prompt,
		"ux",
		"user research",
		"usability",
		"interview",
		"discovery",
		"validation",
		"prototype",
		"persona",
		"journey",
		"insight"
	);

	return {
		isHowto: asksHowToGuidance,
		responseMode: hasGtmSignal && !hasUxResearchSignal ? "gtm_mode" : "ux_research_mode",
		hasGtmSignal,
		hasUxResearchSignal,
	};
}
