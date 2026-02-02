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
  instructions: `You demonstrate generative UI by calling tools that render components.

IMMEDIATELY call a tool based on keywords in the user's message:

- "deal" or "sales" or "qualify" or "budget" → CALL recommendLensComponent(intent="sales", lens="bant", reasoning="Sales qualification")
- "product" or "feature" or "roadmap" → CALL recommendLensComponent(intent="product", lens="jtbd", reasoning="Product discovery")
- "research" or "user" or "understand" → CALL recommendLensComponent(intent="research", lens="empathy", reasoning="User research")
- "problem" or "solution" or "validate" → CALL recommendLensComponent(intent="research", lens="problem-solution", reasoning="Problem validation")

If none match, ask ONE short question to clarify, then CALL the tool.

You MUST call recommendLensComponent within your first or second response. This is a demo - always render a component.`,

  model: openai("gpt-4o"),

  tools: {
    recommendLensComponent: recommendLensComponentTool,
    startVoiceRecording: startVoiceRecordingTool,
  },
});
