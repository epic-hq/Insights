import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";

const CAPABILITIES = [
  {
    name: "surveys & interviews",
    description:
      "Create surveys/ask links, manage interview prompts, import transcripts and video recordings.",
  },
  {
    name: "evidence & themes",
    description:
      "Search quotes, themes, pain matrices, and conversation lenses across all your interviews.",
  },
  {
    name: "people & orgs",
    description:
      "Look up, update, and import people, personas, and organizations.",
  },
  {
    name: "documents",
    description:
      "Create and manage project documents (positioning, competitive analysis, meeting notes).",
  },
  {
    name: "tasks & pipeline",
    description: "Create tasks, manage opportunities, and track follow-ups.",
  },
  {
    name: "web research",
    description:
      "Fetch URLs, run web research, and import video content when internal data isn't enough.",
  },
];

export const capabilityLookupTool = createTool({
  id: "capability-lookup",
  description:
    "Return a concise list of this agent's capabilities. Use when the user asks 'what can you do' or when clarifying scope. Present the returned summary directly — do NOT add extra sections, templates, or coaching language.",
  inputSchema: z.object({
    query: z
      .string()
      .nullish()
      .describe("Optional filter string to narrow the capability list."),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async (input) => {
    const { query } = input;
    const normalized = query?.toLowerCase().trim();
    const filtered = CAPABILITIES.filter((cap) =>
      !normalized
        ? true
        : cap.name.toLowerCase().includes(normalized) ||
          cap.description.toLowerCase().includes(normalized),
    );

    consola.debug("capability-lookup", {
      query,
      resultCount: filtered.length,
    });

    const lines = filtered.map(
      (cap) => `- **${cap.name}**: ${cap.description}`,
    );
    return {
      summary: `I can help with:\n${lines.join("\n")}\n\nJust ask — I'll use the right tools automatically.`,
    };
  },
});
