import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";

interface Capability {
  name: string;
  description: string;
  /** Relative path appended to /a/{accountId}/{projectId}/ */
  link?: string;
}

const CAPABILITIES: Capability[] = [
  {
    name: "Surveys & Interviews",
    description:
      "Create surveys/ask links, manage interview prompts, import transcripts and video recordings.",
    link: "ask",
  },
  {
    name: "Evidence & Themes",
    description:
      "Search quotes, themes, pain matrices, and conversation lenses across all your interviews.",
    link: "insights",
  },
  {
    name: "People & Orgs",
    description:
      "Look up, update, and import people, personas, and organizations.",
    link: "people",
  },
  {
    name: "Documents",
    description:
      "Create and manage project documents (positioning, competitive analysis, meeting notes).",
    link: "documents",
  },
  {
    name: "Tasks & Pipeline",
    description: "Create tasks, manage opportunities, and track follow-ups.",
    link: "tasks",
  },
  {
    name: "Web Research",
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
  execute: async (input, context?) => {
    const { query } = input;
    const normalized = query?.toLowerCase().trim();
    const filtered = CAPABILITIES.filter((cap) =>
      !normalized
        ? true
        : cap.name.toLowerCase().includes(normalized) ||
          cap.description.toLowerCase().includes(normalized),
    );

    const accountId = context?.requestContext?.get?.("account_id") as
      | string
      | undefined;
    const projectId = context?.requestContext?.get?.("project_id") as
      | string
      | undefined;
    const base = accountId && projectId ? `/a/${accountId}/${projectId}` : "";

    consola.debug("capability-lookup", {
      query,
      resultCount: filtered.length,
    });

    const lines = filtered.map((cap) => {
      const link = cap.link && base ? ` → [Open](${base}/${cap.link})` : "";
      return `- **${cap.name}**: ${cap.description}${link}`;
    });
    return {
      summary: `I can help with:\n${lines.join("\n")}\n\nJust ask — I'll use the right tools automatically.`,
    };
  },
});
