/**
 * Stream BANT data using AI SDK streamObject
 *
 * Streams structured BANT qualification data that populates the component
 */

import { streamObject } from "ai";
import { z } from "zod";
import type { ActionFunctionArgs } from "react-router";
import { openai } from "~/lib/billing/instrumented-openai.server";

const bantSchema = z.object({
  budget: z
    .object({
      score: z.number().min(0).max(100).describe("Budget qualification score"),
      note: z.string().optional().describe("Brief note about budget status"),
    })
    .optional(),
  authority: z
    .object({
      score: z
        .number()
        .min(0)
        .max(100)
        .describe("Authority qualification score"),
      note: z.string().optional().describe("Who is the decision maker"),
    })
    .optional(),
  need: z
    .object({
      score: z
        .number()
        .min(0)
        .max(100)
        .describe("Need/pain qualification score"),
      note: z.string().optional().describe("What is their pain point"),
    })
    .optional(),
  timeline: z
    .object({
      score: z
        .number()
        .min(0)
        .max(100)
        .describe("Timeline qualification score"),
      note: z.string().optional().describe("When do they need a solution"),
    })
    .optional(),
  overall: z
    .number()
    .min(0)
    .max(100)
    .describe("Overall BANT qualification score"),
});

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { context } = await request.json();

  const result = streamObject({
    model: openai("gpt-4o"),
    schema: bantSchema,
    prompt: `You are analyzing a sales conversation for BANT qualification.

Context from the conversation:
${context || "User wants to qualify enterprise deals. They mentioned budget discussions and meeting with a VP."}

Generate realistic BANT qualification scores (0-100) with brief notes:
- Budget: Do they have budget allocated?
- Authority: Are we talking to the decision maker?
- Need: How urgent is their pain?
- Timeline: When do they need a solution?

Be realistic - not everything should be 100. Calculate overall as weighted average.`,
  });

  return result.toTextStreamResponse();
}
