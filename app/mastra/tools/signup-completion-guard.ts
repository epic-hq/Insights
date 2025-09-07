import { createTool } from "@mastra/core/tools"
import { z } from "zod"

const InputSchema = z.object({
  problem: z.string().optional(),
  need_to_learn: z.string().optional(),
  challenges: z.string().optional(),
  content_types: z.string().optional(),
})

const OutputSchema = z.object({
  completed: z.boolean(),
  missing: z.array(z.string()),
  next_question_key: z
    .enum(["problem", "need_to_learn", "challenges", "content_types"]) 
    .nullable(),
  next_question: z.string().nullable(),
})

export const signupCompletionGuardTool = createTool({
  id: "signup-completion-guard",
  description:
    "Checks if core signup fields are filled and returns the next question if not.",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: async ({ context }) => {
    const { problem, need_to_learn, challenges, content_types } = context

    const missing: string[] = []
    if (!problem || problem.trim() === "") missing.push("problem")
    if (!need_to_learn || need_to_learn.trim() === "") missing.push("need_to_learn")
    if (!challenges || challenges.trim() === "") missing.push("challenges")
    if (!content_types || content_types.trim() === "") missing.push("content_types")

    const questions: Record<string, string> = {
      problem: "What business objective are you trying to achieve?",
      need_to_learn:
        "What do you need to learn to help you achieve that goal?",
      challenges:
        "What are the challenges in getting those answers?",
      content_types:
        "What content types do you want to analyze (interview recordings, transcripts, notes, docs, etc.)?",
    }

    if (missing.length === 0) {
      return {
        completed: true,
        missing,
        next_question_key: null,
        next_question: null,
      }
    }

    const nextKey = missing[0] as keyof typeof questions
    return {
      completed: false,
      missing,
      next_question_key: nextKey,
      next_question: questions[nextKey],
    }
  },
})

