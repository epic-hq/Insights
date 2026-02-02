/**
 * Demo Agent for Generative UI
 *
 * This agent demonstrates conversational UI where components are chosen
 * and controlled through bidirectional communication.
 */

import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "../../lib/billing/instrumented-openai.server";

// Tool: Recommend a lens-specific component based on conversation
const recommendLensComponentTool = createTool({
  id: "recommend-lens-component",
  description:
    "Recommend which lens/component to use for the user's goal. Use for sales/deals → BANT.",
  inputSchema: z.object({
    intent: z
      .enum(["sales", "product", "research", "support"])
      .describe("The detected user intent"),
    reasoning: z.string().describe("Why you chose this"),
    lens: z
      .enum(["bant", "jtbd", "empathy", "problem-solution"])
      .describe("Which lens framework"),
  }),
  execute: async (input) => {
    return {
      intent: input.intent,
      lens: input.lens,
      reasoning: input.reasoning,
      componentType: input.lens === "bant" ? "BANTScorecard" : "GenericLens",
      renderUI: true,
    };
  },
});

// Tool: Show interview prompts component
const showInterviewPromptsTool = createTool({
  id: "show-interview-prompts",
  description:
    "Show an interactive interview prompts checklist. Use for research/interview/questions.",
  inputSchema: z.object({
    topic: z.string().describe("The research topic"),
    reasoning: z.string().describe("Why interview prompts are appropriate"),
  }),
  execute: async (input) => {
    return {
      topic: input.topic,
      reasoning: input.reasoning,
      renderUI: true,
      componentType: "InterviewPrompts",
    };
  },
});

// Tool: Modify prompts (returns instruction for frontend to execute)
const modifyPromptsTool = createTool({
  id: "modify-prompts",
  description: `Modify the interview prompts list. Actions:
- delete: Remove a prompt by index (1-based) or ID
- markDone: Mark a prompt as completed
- reorder: Move a prompt to a new position
- add: Add a new prompt
- skip: Skip/hide a prompt`,
  inputSchema: z.object({
    action: z
      .enum(["delete", "markDone", "reorder", "add", "skip", "unmark"])
      .describe("The action to perform"),
    target: z
      .string()
      .optional()
      .describe("Prompt index (1-based) or ID to act on"),
    newPosition: z
      .number()
      .optional()
      .describe("For reorder: new position (1-based)"),
    promptText: z.string().optional().describe("For add: the new prompt text"),
    isMustHave: z.boolean().optional().describe("For add: is it a must-have?"),
  }),
  execute: async (input) => {
    // Return instruction for frontend to execute
    return {
      componentType: "InterviewPrompts",
      instruction: {
        action: input.action,
        target: input.target,
        newPosition: input.newPosition,
        promptText: input.promptText,
        isMustHave: input.isMustHave,
      },
      renderUI: true,
    };
  },
});

export const demoGenerativeUIAgent = new Agent({
  id: "demo-generative-ui-agent",
  name: "Demo Generative UI Agent",
  instructions: `You demonstrate generative UI by calling tools that render and control components.

## Component Selection (first message)
Based on keywords, call the appropriate tool:
- "deal" / "sales" / "qualify" / "budget" → recommendLensComponent(intent="sales", lens="bant")
- "interview" / "questions" / "prompts" / "research" → showInterviewPrompts(topic="[topic]")

## Prompt Modification (after prompts are shown)
When user asks to modify prompts, use modifyPrompts tool:
- "delete prompt 3" or "remove the first one" → modifyPrompts(action="delete", target="3")
- "mark #2 as done" → modifyPrompts(action="markDone", target="2")
- "move prompt 5 to the top" → modifyPrompts(action="reorder", target="5", newPosition=1)
- "add a question about pricing" → modifyPrompts(action="add", promptText="What is your budget for this?")
- "skip the last prompt" → modifyPrompts(action="skip", target="[last index]")

## State Awareness
The user may share the current state of prompts in their message. Use this to:
- Know which prompts exist and their indices
- Track what's been completed
- Make accurate modifications

Always confirm the action after calling a tool.`,

  model: openai("gpt-4o"),

  tools: {
    recommendLensComponent: recommendLensComponentTool,
    showInterviewPrompts: showInterviewPromptsTool,
    modifyPrompts: modifyPromptsTool,
  },
});
