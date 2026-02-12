/**
 * requestUserInput Tool
 *
 * Asks the user to select from a set of options inline in the chat stream.
 * Returns a payload with a __userInput marker that the chat renderer detects
 * and renders as an interactive input (radio buttons or checkboxes).
 *
 * Unlike displayComponent (which renders on the A2UI canvas above chat),
 * this renders inline inside a chat message bubble.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const optionSchema = z.object({
  id: z.string().describe("Unique identifier for this option"),
  label: z.string().describe("Display text for the option"),
  description: z
    .string()
    .optional()
    .describe("Optional helper text shown below the label"),
});

export const requestUserInputTool = createTool({
  id: "request-user-input",
  description:
    "Ask the user to pick from a set of options inline in the chat. Use this when the agent needs user input to continue a workflow — e.g. choosing a persona, confirming a plan, or selecting from discovered options. The user sees radio buttons (single) or checkboxes (multiple) directly in the chat bubble and can click to respond.",
  inputSchema: z.object({
    prompt: z
      .string()
      .describe(
        "The question or instruction shown to the user above the options",
      ),
    options: z
      .array(optionSchema)
      .min(2)
      .max(10)
      .describe("The options the user can choose from (2-10 items)"),
    selectionMode: z
      .enum(["single", "multiple"])
      .default("single")
      .describe(
        "Whether the user picks one option (radio) or multiple (checkboxes)",
      ),
    allowFreeText: z
      .boolean()
      .default(true)
      .describe(
        "Whether to show a free-text input as an alternative to the predefined options",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    userInput: z
      .object({
        __userInput: z.literal(true),
        prompt: z.string(),
        options: z.array(optionSchema),
        selectionMode: z.enum(["single", "multiple"]),
        allowFreeText: z.boolean(),
      })
      .describe(
        "Payload detected by the chat renderer to show inline input UI",
      ),
  }),
  execute: async (input) => {
    const { prompt, options, selectionMode, allowFreeText } = input;

    return {
      success: true,
      message: `Asking user: ${prompt}`,
      userInput: {
        __userInput: true as const,
        prompt,
        options,
        selectionMode,
        allowFreeText,
      },
    };
  },
});
