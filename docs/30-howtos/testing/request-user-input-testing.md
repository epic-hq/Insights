# Testing: requestUserInput (Chat-Inline Interactive Inputs)

## Overview

The `requestUserInput` tool lets agents ask users to pick from options directly inside a chat message bubble (radio buttons or checkboxes). This is different from `displayComponent` which renders on the A2UI canvas above chat.

## Test Page

Navigate to: `/a/:accountId/:projectId/test/gen-ui`

Scroll below the A2UI Component Gallery to the **InlineUserInput (requestUserInput)** section. Three test variants are rendered:

| Variant | What it tests |
|---------|--------------|
| **Single select (radio)** | Click one option, confirm, verify toast + disable state |
| **Multiple select (checkbox)** | Select 2+ options, confirm count badge, verify submission |
| **Already answered** | Pre-filled disabled state with "Enterprise Buyer" highlighted |

## Manual Test Checklist

### 1. Single Select (Radio)

- [ ] Options render with CircleDot icons
- [ ] Clicking an option highlights it (blue border, primary bg)
- [ ] Clicking a different option deselects the previous one
- [ ] "Confirm" button stays disabled until an option is selected
- [ ] After clicking Confirm: options disable, selected option shows checkmark
- [ ] Toast appears: "Selected: {label}"
- [ ] Event log at bottom shows `[Single] selected=["persona-X"]`

### 2. Multiple Select (Checkbox)

- [ ] Options render with Square/SquareCheck icons
- [ ] Multiple options can be selected simultaneously
- [ ] Button shows "Confirm (N)" with count
- [ ] After confirm: all selected options highlighted, rest grayed out
- [ ] Toast shows comma-separated labels
- [ ] Event log shows `[Multi] selected=["theme-1","theme-3"]`

### 3. Free Text

- [ ] "Type a custom response" link appears below options
- [ ] Clicking it shows text input, hides option selection
- [ ] "Back to options" returns to option buttons
- [ ] Submit button says "Send" in free-text mode
- [ ] Enter key submits in text input
- [ ] Event log shows `freeText=...`

### 4. Already Answered State

- [ ] All options are disabled (no hover/click)
- [ ] "Enterprise Buyer" has primary border + checkmark icon
- [ ] Other options are grayed out at 60% opacity
- [ ] No submit button visible
- [ ] No free-text link visible

### 5. Chat Integration (requires agent interaction)

To test the full flow with the agent:

1. Open the project chat (Ask Uppy)
2. Trigger a workflow where the agent calls `requestUserInput` (e.g., ask "help me choose which persona to focus on" if the agent is configured to use it)
3. Verify:
   - [ ] InlineUserInput renders below the assistant's text message
   - [ ] Selecting + confirming sends a `[UserInput]` message in the chat
   - [ ] Toast confirms the selection
   - [ ] Agent receives the response and continues the workflow
   - [ ] Re-rendering the chat (scroll away/back) keeps the answered state

## Data Flow

```
Agent → requestUserInput({ prompt, options, selectionMode })
  ↓ tool result: { userInput: { __userInput: true, ... } }
Chat stream → tool-invocation part with result
  ↓
extractUserInputPayloads() detects __userInput marker
  ↓
<InlineUserInput> renders inline in assistant bubble
  ↓
User clicks option(s) + Confirm
  ↓
sendMessage("[UserInput] prompt: '...', selected: ['opt-1']")
  ↓
Agent receives as next user message, continues workflow
```

## Files

| File | Role |
|------|------|
| `app/mastra/tools/request-user-input.ts` | Mastra tool definition |
| `app/components/chat/InlineUserInput.tsx` | React component |
| `app/components/chat/ProjectStatusAgentChat.tsx` | Chat integration (extractUserInputPayloads, rendering, submit handler) |
| `app/mastra/message-types.ts` | UpsightMessage type includes the tool |
| `app/routes/test.gen-ui.tsx` | Standalone test gallery |

## Registered Agents

The tool is available in:
- `project-status-agent` (main agent + kebab alias)
- `research-agent`
- `chief-of-staff-agent`
- `project-setup-agent`
