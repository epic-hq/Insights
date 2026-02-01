/**
 * Demo Agent for Generative UI
 *
 * This agent demonstrates conversational UI where components are chosen
 * based on back-and-forth conversation with the user.
 */

import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "../../lib/billing/instrumented-openai.server";

// Tool: Recommend a lens-specific component based on conversation
const recommendLensComponentTool = createTool({
  id: "recommend-lens-component",
  description:
    "After understanding user's goal through conversation, recommend which lens/component to use. Only call this when you have enough context about what the user wants to accomplish.",
  inputSchema: z.object({
    intent: z
      .enum(["sales", "product", "research", "support"])
      .describe("The detected user intent"),
    reasoning: z
      .string()
      .describe("Why you chose this lens based on the conversation"),
    lens: z
      .enum(["bant", "jtbd", "empathy", "problem-solution"])
      .describe("Which lens framework to use"),
  }),
  execute: async (input) => {
    // This tool returns metadata that the API route will use to render components
    return {
      intent: input.intent,
      lens: input.lens,
      reasoning: input.reasoning,
      componentType: input.lens === "bant" ? "BANTScorecard" : "GenericLens",
      renderUI: true, // Signal to API route to render component
    };
  },
});

// Tool: Start voice recording session
const startVoiceRecordingTool = createTool({
  id: "start-voice-recording",
  description:
    "Start a voice recording session when user wants to record an interview or conversation",
  inputSchema: z.object({
    lensToUse: z
      .string()
      .describe("Which lens to extract evidence for during recording"),
  }),
  execute: async (input) => {
    return {
      action: "start-recording",
      lens: input.lensToUse,
      renderUI: true,
      componentType: "VoiceRecorder",
    };
  },
});

export const demoGenerativeUIAgent = new Agent({
  id: "demo-generative-ui-agent",
  name: "Demo Generative UI Agent",
  instructions: `You are a conversational research assistant that helps users set up their customer research.

Your goal: Understand what the user wants to learn, then recommend the right framework/lens.

## Conversation Flow

1. **Start with open question**: Ask what they want to learn about their customers
2. **Listen and clarify**: Based on their answer, ask 1-2 clarifying questions to understand:
   - Are they doing sales qualification? → BANT lens
   - Are they doing product discovery? → Jobs-to-be-Done lens
   - Are they researching user problems/needs? → Empathy Map lens
   - Are they validating problem-solution fit? → Problem-Solution lens

3. **Recommend component**: Once you understand their goal, use the recommendLensComponentTool to suggest the right lens

## Example Conversation

User: "I want to qualify some deals"
You: "Got it. Are you qualifying based on budget, decision-makers, and timeline? Or are you looking for something else?"
User: "Yes exactly - need to know if they have budget and who makes decisions"
You: [Call recommendLensComponentTool with intent="sales", lens="bant"]

## Key Rules

- Be conversational and brief (1-2 sentences)
- Ask clarifying questions before jumping to conclusions
- Only recommend a lens when you truly understand their goal
- Don't explain all the options upfront - discover through conversation
- If user mentions recording/interviewing, offer to start voice recording`,

  model: {
    provider: openai,
    name: "gpt-4o",
    toolChoice: "auto",
  },

  tools: {
    recommendLensComponent: recommendLensComponentTool,
    startVoiceRecording: startVoiceRecordingTool,
  },
});
