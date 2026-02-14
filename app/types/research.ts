export type ResearchMode = "exploratory" | "validation" | "user_testing";

export function fromManagerResearchMode(mode: ResearchMode | "followup"): ResearchMode {
	return mode === "followup" ? "user_testing" : mode;
}

export function toManagerResearchMode(mode?: string | null): (ResearchMode | "followup") | undefined {
	if (!mode) return undefined;
	switch (mode) {
		case "exploratory":
		case "validation":
		case "user_testing":
			return mode;
		case "followup":
			// Legacy value stored before renaming
			return "followup";
		default:
			return undefined;
	}
}
