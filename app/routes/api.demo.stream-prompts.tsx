/**
 * Stream interview prompts using AI SDK streamObject
 */

import { streamObject } from "ai";
import { z } from "zod";
import type { ActionFunctionArgs } from "react-router";
import { openai } from "~/lib/billing/instrumented-openai.server";

const promptSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(["planned", "answered", "skipped"]),
  isMustHave: z.boolean().optional(),
  category: z.string().optional(),
});

const promptsDataSchema = z.object({
  title: z.string().describe("Title for the interview guide"),
  description: z.string().optional().describe("Brief description"),
  prompts: z
    .array(promptSchema)
    .describe("List of interview prompts/questions"),
});

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { context, topic } = await request.json();

  const result = streamObject({
    model: openai("gpt-4o"),
    schema: promptsDataSchema,
    prompt: `Generate interview prompts for user research.

Topic/Context: ${topic || context || "General customer discovery"}

Generate 6-8 interview prompts that would help understand:
- User pain points and frustrations
- Current solutions and workarounds
- Decision-making process
- Success criteria

For each prompt:
- id: unique string like "q1", "q2", etc.
- text: the actual question to ask
- status: always "planned"
- isMustHave: true for 2-3 critical questions
- category: one of "pain", "behavior", "motivation", "context"

Make questions open-ended and conversational.`,
  });

  return result.toTextStreamResponse();
}
