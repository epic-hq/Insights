export const HOWTO_REQUIRED_SECTION_HEADERS = [
	"direct answer",
	"do this now",
	"prompt template",
	"quick links",
	"if stuck",
] as const;

export type HowtoRequiredSection = (typeof HOWTO_REQUIRED_SECTION_HEADERS)[number];

export const HOWTO_MARKDOWN_LINK_REGEX = /\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\)/i;

export type HowtoContractEvaluation = {
	isNonEmpty: boolean;
	hasMarkdownLink: boolean;
	missingSections: HowtoRequiredSection[];
	passes: boolean;
};

export function evaluateHowtoResponseContract(text: string): HowtoContractEvaluation {
	const content = text.trim();
	const normalized = content.toLowerCase();
	const missingSections = HOWTO_REQUIRED_SECTION_HEADERS.filter((header) => !normalized.includes(header));
	const hasMarkdownLink = HOWTO_MARKDOWN_LINK_REGEX.test(content);
	const isNonEmpty = content.length > 0;
	return {
		isNonEmpty,
		hasMarkdownLink,
		missingSections,
		passes: isNonEmpty && hasMarkdownLink && missingSections.length === 0,
	};
}

export function buildHowtoQuickLinks(accountId: string, projectId: string): string {
	const projectBase = accountId && projectId ? `/a/${accountId}/${projectId}` : "";
	if (projectBase) {
		return `- [People](${projectBase}/people)\n- [Insights](${projectBase}/insights)\n- [Ask](${projectBase}/ask)`;
	}
	return "- [Docs](/docs)\n- [Help](/help)";
}

export function buildHowtoContractPatchText(existingText: string, accountId: string, projectId: string): string | null {
	const quality = evaluateHowtoResponseContract(existingText);
	if (quality.passes) return null;

	const quickLinksList = buildHowtoQuickLinks(accountId, projectId);
	const patches: string[] = [];

	for (const section of quality.missingSections) {
		if (section === "direct answer") {
			patches.push("**Direct answer**\nUse the smallest clear step that produces evidence before scaling effort.");
			continue;
		}
		if (section === "do this now") {
			patches.push(
				"**Do this now**\n- Define the user + outcome in one sentence.\n- Run one bounded test this week.\n- Capture result + next decision in project notes."
			);
			continue;
		}
		if (section === "prompt template") {
			patches.push(
				"**Prompt template**\n```text\nAct as my coach for {{goal}}. Context: {{context}}. Constraints: {{constraints}}. Give me 3 steps, 1 risk, and 1 metric to track.\n```"
			);
			continue;
		}
		if (section === "quick links") {
			patches.push(`**Quick links**\n${quickLinksList}`);
			continue;
		}
		if (section === "if stuck") {
			patches.push(
				"**If stuck**\nReply with your current blocker, available data, and deadline, and I will tighten the plan."
			);
		}
	}

	if (!quality.hasMarkdownLink && !quality.missingSections.includes("quick links")) {
		patches.push(`**Quick links**\n${quickLinksList}`);
	}

	return patches.length > 0 ? `\n\n${patches.join("\n\n")}` : null;
}

export function buildHowtoFallbackResponse(accountId: string, projectId: string): string {
	const quickLinksList = buildHowtoQuickLinks(accountId, projectId);
	return `**Direct answer**
I can still give you a working starting point even without full context.

**Do this now**
- Define the specific outcome you want in one sentence.
- Choose one experiment you can run in the next 48 hours.
- Decide the metric that will prove progress.

**Prompt template**
\`\`\`text
Help me with {{goal}}. Context: {{context}}. Constraints: {{constraints}}. Return 3 concrete steps, 1 risk, and 1 success metric.
\`\`\`

**Quick links**
${quickLinksList}

**If stuck**
Share your blocker, timeline, and available data and I will give you a tighter playbook.`;
}

export function estimateApproxTokens(text: string): number {
	const chars = text.trim().length;
	if (chars === 0) return 0;
	return Math.ceil(chars / 4);
}
