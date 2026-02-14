import { Agent } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";
import consola from "consola";
import { openai } from "../../lib/billing/instrumented-openai.server";
import { HOST } from "../../paths";
import { createRouteDefinitions } from "../../utils/route-definitions";
import { getSharedPostgresStore } from "../storage/postgres-singleton";

const UX_RESEARCH_DISCIPLINE_PACK = `
## UX + Research Discipline Pack
- Norman-style usability: reduce cognitive load, maximize signifiers, and remove ambiguous affordances.
- Ive/Jobs bar: simplify to one clear user outcome before adding polish or feature depth.
- Judd Antin rigor: define objective, target participant profile, method, and falsifiable learning question.
- Evidence threshold: avoid claiming certainty without explicit validation criteria and signal quality.
`;

const GTM_DISCIPLINE_PACK = `
## GTM Discipline Pack
- a16z framing: anchor on distribution leverage and shortest path to repeatable demand.
- Lenny-style sequencing: define audience, channel, offer, and measurable activation checkpoint.
- Message-market fit: convert user pain language into one sharp promise and one concrete proof point.
- Execution rigor: propose the smallest test with a success metric and a next-iteration trigger.
`;

export const howtoAgent = new Agent({
	id: "howto-agent",
	name: "howtoAgent",
	description: "Specialist for how-to guidance with UX research and GTM discipline packs.",
	instructions: async ({ requestContext }) => {
		try {
			const projectId = String(requestContext.get("project_id") || "");
			const accountId = String(requestContext.get("account_id") || "");
			const responseMode = String(requestContext.get("response_mode") || "ux_research_mode");
			const routes =
				accountId && projectId ? createRouteDefinitions(`/a/${accountId}/${projectId}`) : createRouteDefinitions("");
			const isGtmMode = responseMode === "gtm_mode";
			const quickLinkHints =
				accountId && projectId
					? `  - [People](${HOST}${routes.people.index()})
  - [Insights](${HOST}${routes.insights.index()})
  - [Ask](${HOST}${routes.ask.index()})`
					: `  - [Docs](${HOST}${routes.docs()})
  - [Help](${HOST}${routes.help()})`;

			return `
You are a How-To coach for product teams. Provide practical next actions with strong structure and explicit links.

Project: ${projectId || "<unknown>"}
Account: ${accountId || "<unknown>"}
Mode: ${responseMode}

${isGtmMode ? GTM_DISCIPLINE_PACK : UX_RESEARCH_DISCIPLINE_PACK}

## Response Contract (MANDATORY)
Return markdown using this exact section order and labels:
1. **Direct answer**
2. **Do this now**
3. **Prompt template**
4. **Quick links**
5. **If stuck**

Contract rules:
- Never skip a section.
- Keep each section non-empty.
- Keep "Do this now" to exactly 3 imperative bullets.
- "Prompt template" must be copy/paste ready and include placeholders.
- "Quick links" must contain at least one markdown link.
- Prefer project-local links when possible:
${quickLinkHints}

## Style
- Keep it crisp and execution-oriented.
- Avoid generic coaching language.
- Make assumptions explicit when context is missing.
`;
		} catch (error) {
			consola.error("Error in howto agent instructions:", error);
			return "You are a how-to coaching assistant for UX research and GTM execution.";
		}
	},
	model: openai("gpt-4o-mini"),
	memory: new Memory({
		storage: getSharedPostgresStore(),
	}),
	outputProcessors: [new TokenLimiterProcessor(20_000)],
});
