/**
 * Agent tools for managing interview prompts
 *
 * These tools allow the agent to read and modify the prompts state,
 * enabling bidirectional control between chat and UI.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const promptSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(["planned", "answered", "skipped"]),
  isMustHave: z.boolean().optional(),
  category: z.string().optional(),
});

export type Prompt = z.infer<typeof promptSchema>;

export interface PromptsState {
  title: string;
  prompts: Prompt[];
}

// These will be bound to actual state at runtime
let _getState: () => PromptsState | null = () => null;
let _updateState: (state: PromptsState) => void = () => {};

/** Bind the tools to actual state handlers */
export function bindPromptsState(
  getState: () => PromptsState | null,
  updateState: (state: PromptsState) => void,
) {
  _getState = getState;
  _updateState = updateState;
}

/** Read current prompts state */
export const readPromptsTool = createTool({
  id: "read-prompts",
  description:
    "Read the current interview prompts. Use this to see what prompts exist and their status before making changes.",
  inputSchema: z.object({}),
  execute: async () => {
    const state = _getState();
    if (!state) {
      return { error: "No prompts loaded", prompts: [] };
    }
    return {
      title: state.title,
      promptCount: state.prompts.length,
      prompts: state.prompts.map((p, i) => ({
        index: i + 1,
        id: p.id,
        text: p.text,
        status: p.status,
        isMustHave: p.isMustHave,
      })),
      summary: `${state.prompts.filter((p) => p.status === "answered").length}/${state.prompts.length} completed`,
    };
  },
});

/** Delete a prompt by ID or index */
export const deletePromptTool = createTool({
  id: "delete-prompt",
  description:
    "Delete a prompt from the list. Can use prompt ID (like 'q1') or 1-based index (like 'prompt 3').",
  inputSchema: z.object({
    identifier: z
      .string()
      .describe("Prompt ID (e.g., 'q1') or index (e.g., '3' for third prompt)"),
  }),
  execute: async ({ identifier }) => {
    const state = _getState();
    if (!state) return { error: "No prompts loaded" };

    let indexToDelete = -1;

    // Try as numeric index first (1-based)
    const numIndex = parseInt(identifier, 10);
    if (!isNaN(numIndex) && numIndex >= 1 && numIndex <= state.prompts.length) {
      indexToDelete = numIndex - 1;
    } else {
      // Try as ID
      indexToDelete = state.prompts.findIndex((p) => p.id === identifier);
    }

    if (indexToDelete === -1) {
      return { error: `Prompt '${identifier}' not found` };
    }

    const deleted = state.prompts[indexToDelete];
    const newPrompts = state.prompts.filter((_, i) => i !== indexToDelete);

    _updateState({ ...state, prompts: newPrompts });

    return {
      success: true,
      deleted: { id: deleted.id, text: deleted.text },
      remainingCount: newPrompts.length,
    };
  },
});

/** Mark a prompt as done/answered */
export const markPromptDoneTool = createTool({
  id: "mark-prompt-done",
  description: "Mark a prompt as completed/answered.",
  inputSchema: z.object({
    identifier: z.string().describe("Prompt ID or index"),
  }),
  execute: async ({ identifier }) => {
    const state = _getState();
    if (!state) return { error: "No prompts loaded" };

    const numIndex = parseInt(identifier, 10);
    let targetIndex = -1;

    if (!isNaN(numIndex) && numIndex >= 1 && numIndex <= state.prompts.length) {
      targetIndex = numIndex - 1;
    } else {
      targetIndex = state.prompts.findIndex((p) => p.id === identifier);
    }

    if (targetIndex === -1) {
      return { error: `Prompt '${identifier}' not found` };
    }

    const newPrompts = state.prompts.map((p, i) =>
      i === targetIndex ? { ...p, status: "answered" as const } : p,
    );

    _updateState({ ...state, prompts: newPrompts });

    return {
      success: true,
      marked: state.prompts[targetIndex].text,
      completedCount: newPrompts.filter((p) => p.status === "answered").length,
      totalCount: newPrompts.length,
    };
  },
});

/** Reorder prompts */
export const reorderPromptsTool = createTool({
  id: "reorder-prompts",
  description:
    "Move a prompt to a new position. Positions are 1-based (1 = first, 2 = second, etc.).",
  inputSchema: z.object({
    identifier: z.string().describe("Prompt ID or current index to move"),
    newPosition: z.number().describe("New position (1-based)"),
  }),
  execute: async ({ identifier, newPosition }) => {
    const state = _getState();
    if (!state) return { error: "No prompts loaded" };

    const numIndex = parseInt(identifier, 10);
    let currentIndex = -1;

    if (!isNaN(numIndex) && numIndex >= 1 && numIndex <= state.prompts.length) {
      currentIndex = numIndex - 1;
    } else {
      currentIndex = state.prompts.findIndex((p) => p.id === identifier);
    }

    if (currentIndex === -1) {
      return { error: `Prompt '${identifier}' not found` };
    }

    const targetIndex = Math.max(
      0,
      Math.min(newPosition - 1, state.prompts.length - 1),
    );

    const newPrompts = [...state.prompts];
    const [moved] = newPrompts.splice(currentIndex, 1);
    newPrompts.splice(targetIndex, 0, moved);

    _updateState({ ...state, prompts: newPrompts });

    return {
      success: true,
      moved: moved.text,
      from: currentIndex + 1,
      to: targetIndex + 1,
    };
  },
});

/** Add a new prompt */
export const addPromptTool = createTool({
  id: "add-prompt",
  description: "Add a new interview prompt to the list.",
  inputSchema: z.object({
    text: z.string().describe("The prompt/question text"),
    isMustHave: z
      .boolean()
      .optional()
      .describe("Whether this is a must-have question"),
    category: z
      .string()
      .optional()
      .describe("Category: pain, behavior, motivation, or context"),
  }),
  execute: async ({ text, isMustHave, category }) => {
    const state = _getState();
    if (!state) return { error: "No prompts loaded" };

    const newPrompt: Prompt = {
      id: `q${Date.now()}`,
      text,
      status: "planned",
      isMustHave: isMustHave ?? false,
      category,
    };

    const newPrompts = [...state.prompts, newPrompt];
    _updateState({ ...state, prompts: newPrompts });

    return {
      success: true,
      added: newPrompt,
      totalCount: newPrompts.length,
    };
  },
});

/** Export all prompt tools */
export const promptTools = {
  readPrompts: readPromptsTool,
  deletePrompt: deletePromptTool,
  markPromptDone: markPromptDoneTool,
  reorderPrompts: reorderPromptsTool,
  addPrompt: addPromptTool,
};
