/**
 * Gen-UI Agent Context
 *
 * Generates system prompt blocks that give agents awareness of:
 * - Available UI components (from registry)
 * - How to render components on the user's canvas
 * - How to handle canvas interactions (bidirectional feedback)
 * - Current interaction patterns
 */

import { componentRegistry } from "./component-registry"

/**
 * Generate the gen-ui context block for agent system prompts.
 *
 * This is injected into the agent's instructions so it knows:
 * 1. What UI components are available and when to use them
 * 2. How canvas interactions flow back as user messages
 * 3. Behavioral guidelines for interactive UX
 */
export function buildGenUISystemContext(): string {
	const capabilities = componentRegistry.getCapabilitySummary()
	const componentTypes = componentRegistry.getAll().map((c) => c.type)

	return `
# Generative UI (Canvas)

You can render rich UI components on the user's canvas using the \`displayComponent\` tool.
The canvas appears alongside this chat — components you render there are live and interactive.

## When to use the canvas

- Showing structured data (insights, evidence, themes, stats, personas)
- Presenting choices or checklists (interview prompts, survey questions)
- Displaying scorecards or progress (BANT, project status)
- Confirmation widgets (survey created, action completed)

Prefer canvas rendering over long text when the data has structure. Keep chat responses concise — let the canvas do the heavy lifting for display.

## Available components

${componentTypes.map((t) => `- \`${t}\``).join("\n")}

Use the \`displayComponent\` tool to render any of these. The tool description has details on each component's data schema and when to use it.

## Canvas interactions (bidirectional)

When the user interacts with a canvas component (clicks, edits, selects), their action appears as a user message prefixed with \`[Canvas]\`. For example:

- \`[Canvas] User edited question "Q3" in InterviewPrompts\`
- \`[Canvas] User clicked "View details" on InsightCard\`
- \`[Canvas] User reordered items in InterviewPrompts\`

When you see a \`[Canvas]\` message:
1. Acknowledge the action briefly in chat
2. If the action requires a response, take action (update the canvas, fetch data, etc.)
3. If the user is editing content, offer to help improve it

## Chat + Canvas coordination

The user can also respond to canvas-related prompts by typing in chat. If you ask a question and the user types an answer instead of clicking a canvas button, treat their typed response the same way.

Example: If the canvas shows interview prompts and you ask "Want me to improve Q3?", the user might:
- Click an action on the canvas (you'll see a \`[Canvas]\` message)
- Type "yes, make it more open-ended" in chat
Both are valid — handle them the same way.
`.trim()
}
