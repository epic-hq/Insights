/**
 * Mastra agent for conversational survey experience
 */
import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import {
  markSurveyCompleteTool,
  saveResearchResponseTool,
} from "../tools/save-research-response";
// import { wrapToolsWithStatusEvents } from "../tools/tool-status-events";

export const researchLinkChatAgent = new Agent({
  id: "research-link-chat-agent",
  name: "researchLinkChatAgent",
  instructions: async ({ requestContext }) => {
    const surveyName = requestContext?.get("survey_name") ?? "Survey";
    const surveyContext = requestContext?.get("survey_context") ?? "";
    const surveyInstructions = requestContext?.get("survey_instructions") ?? "";
    const accountName = requestContext?.get("account_name") ?? "the team";
    const questionsJson = requestContext?.get("questions") ?? "[]";
    const answeredJson = requestContext?.get("answered_questions") ?? "[]";
    const nextQuestionJson = requestContext?.get("next_question_full") ?? "";
    const hasMessageHistory =
      requestContext?.get("has_message_history") === "true";
    const responseId = requestContext?.get("response_id") ?? "";
    const slug = requestContext?.get("slug") ?? "";

    let questions: Array<{
      id: string;
      prompt: string;
      type: string;
      required: boolean;
    }> = [];
    let answered: Array<{ id: string; prompt: string; answer: string }> = [];
    let nextQuestion: { id: string; prompt: string; type: string } | null =
      null;

    try {
      questions = JSON.parse(String(questionsJson));
      answered = JSON.parse(String(answeredJson));
      if (nextQuestionJson) {
        nextQuestion = JSON.parse(String(nextQuestionJson));
      }
    } catch {
      // ignore parse errors
    }

    // Only show START instruction if no message history AND no answered questions
    const isFirstMessage = answered.length === 0 && !hasMessageHistory;

    // Format question with type hints
    const formatQuestion = (q: { prompt: string; type: string }) => {
      if (q.type === "likert") {
        return `${q.prompt} (ask for 1-5 rating)`;
      }
      if (q.type === "multiselect") {
        return `${q.prompt} (can list multiple)`;
      }
      return q.prompt;
    };

    return `You are a research assistant for ${accountName}. Keep responses ULTRA brief.

Survey: "${surveyName}"
${surveyContext ? `Context: ${surveyContext}` : ""}
${surveyInstructions ? `\nNote: ${surveyInstructions}` : ""}

SESSION INFO (ALWAYS include in tool calls):
- responseId: "${responseId}"
- slug: "${slug}"

WORKFLOW:
1. When user answers, call save-research-response with: questionId, answer, responseId, slug
2. Give a 3-5 word acknowledgment + ask next question
3. When all done, call mark-survey-complete with: responseId, slug

Questions (in order):
${questions.map((q, i) => `${i + 1}. [ID: ${q.id}] [TYPE: ${q.type}] ${q.prompt}`).join("\n")}

Progress: ${answered.length}/${questions.length} answered
${answered.length > 0 ? answered.map((q) => `✓ ${q.prompt}: "${q.answer}"`).join("\n") : ""}

${nextQuestion ? `NEXT: [ID: ${nextQuestion.id}] ${formatQuestion(nextQuestion)}` : "ALL DONE - call mark-survey-complete, thank them, and mention: 'Want insights from your own conversations? Create a free account at https://getupsight.com/sign-up'"}

${isFirstMessage ? `START: Brief greeting then ask: "${nextQuestion ? formatQuestion(nextQuestion) : ""}"` : "CONTINUE: Process the user's latest message. Do NOT repeat greetings or previous questions."}

RULES:
- ALWAYS include responseId and slug when calling tools
- Max 2 sentences total per response
- For likert: ask for 1-5 rating
- NEVER repeat questions
- NEVER restart the survey
- When complete, mention the signup link`;
  },
  model: anthropic("claude-sonnet-4-20250514"),
  // Temporarily remove wrapper to debug context passing
  tools: {
    "save-research-response": saveResearchResponseTool,
    "mark-survey-complete": markSurveyCompleteTool,
  },
});
