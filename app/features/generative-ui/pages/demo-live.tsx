/**
 * Live Generative UI Demo
 *
 * Demonstrates bidirectional agent-UI communication:
 * 1. Agent calls tools to show/modify components
 * 2. UI changes are synced back to agent context
 * 3. Agent can respond to commands like "delete prompt 3"
 */

import { useChat } from "@ai-sdk/react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Response as AiResponse } from "~/components/ai-elements/response";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type { UpsightMessage } from "~/mastra/message-types";
import {
  InterviewPrompts,
  type InterviewPrompt,
  type InterviewPromptsData,
} from "../components/InterviewPrompts";
import { SimpleBANT, type SimpleBANTData } from "../components/SimpleBANT";

// Schemas
const bantSchema = z.object({
  budget: z
    .object({ score: z.number(), note: z.string().optional() })
    .optional(),
  authority: z
    .object({ score: z.number(), note: z.string().optional() })
    .optional(),
  need: z.object({ score: z.number(), note: z.string().optional() }).optional(),
  timeline: z
    .object({ score: z.number(), note: z.string().optional() })
    .optional(),
  overall: z.number().optional(),
});

const promptsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  prompts: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        status: z.enum(["planned", "answered", "skipped"]),
        isMustHave: z.boolean().optional(),
        category: z.string().optional(),
      }),
    )
    .optional(),
});

// Tool result types
interface ToolResult {
  reasoning?: string;
  componentType: string;
  renderUI: boolean;
  topic?: string;
  instruction?: {
    action: string;
    target?: string;
    newPosition?: number;
    promptText?: string;
    isMustHave?: boolean;
  };
}

// Extract tool results from message parts
function extractToolResults(messages: UpsightMessage[]): ToolResult[] {
  const results: ToolResult[] = [];
  for (const message of messages) {
    if (!message.parts) continue;
    for (const part of message.parts) {
      const anyPart = part as {
        type: string;
        state?: string;
        output?: ToolResult;
      };
      if (
        (anyPart.type === "tool-recommendLensComponent" ||
          anyPart.type === "tool-showInterviewPrompts" ||
          anyPart.type === "tool-modifyPrompts") &&
        anyPart.state === "output-available" &&
        anyPart.output?.renderUI
      ) {
        results.push(anyPart.output);
      }
    }
  }
  return results;
}

export default function LiveGenerativeUIDemo() {
  const [input, setInput] = useState("");
  const [prompts, setPrompts] = useState<InterviewPrompt[]>([]);
  const [promptsTitle, setPromptsTitle] = useState("Interview Prompts");
  const [streamingBantStarted, setStreamingBantStarted] = useState(false);
  const [streamingPromptsStarted, setStreamingPromptsStarted] = useState(false);
  const processedInstructionsRef = useRef<Set<string>>(new Set());

  // Chat with state context
  const { messages, sendMessage, status } = useChat<UpsightMessage>({
    transport: new DefaultChatTransport({
      api: "/api/demo/gen-ui-chat",
      body: () => ({
        // Include current prompts state so agent is aware
        promptsState:
          prompts.length > 0
            ? {
                count: prompts.length,
                prompts: prompts.map((p, i) => ({
                  index: i + 1,
                  id: p.id,
                  text: p.text.slice(0, 50) + (p.text.length > 50 ? "..." : ""),
                  status: p.status,
                })),
              }
            : null,
      }),
    }),
  });

  // Streaming for BANT
  const {
    object: bantData,
    submit: streamBant,
    isLoading: isStreamingBant,
  } = useObject({
    api: "/api/demo/stream-bant",
    schema: bantSchema,
  });

  // Streaming for prompts
  const {
    object: promptsData,
    submit: streamPrompts,
    isLoading: isStreamingPrompts,
  } = useObject({
    api: "/api/demo/stream-prompts",
    schema: promptsSchema,
  });

  const isBusy = status === "streaming" || status === "submitted";
  const isStreamingAny = isStreamingBant || isStreamingPrompts;

  // Extract all tool results
  const toolResults = useMemo(() => extractToolResults(messages), [messages]);
  const componentToRender = toolResults.find(
    (r) =>
      r.componentType === "BANTScorecard" ||
      r.componentType === "InterviewPrompts",
  );

  // Apply streamed prompts data when it arrives
  useEffect(() => {
    if (promptsData?.prompts && promptsData.prompts.length > 0) {
      setPrompts(promptsData.prompts as InterviewPrompt[]);
      if (promptsData.title) setPromptsTitle(promptsData.title);
    }
  }, [promptsData]);

  // Process agent instructions for modifying prompts
  useEffect(() => {
    for (const result of toolResults) {
      if (result.instruction) {
        const instructionKey = JSON.stringify(result.instruction);
        if (processedInstructionsRef.current.has(instructionKey)) continue;
        processedInstructionsRef.current.add(instructionKey);

        const { action, target, newPosition, promptText, isMustHave } =
          result.instruction;

        setPrompts((prev) => {
          const targetIndex = target
            ? parseInt(target, 10) - 1 >= 0
              ? parseInt(target, 10) - 1
              : prev.findIndex((p) => p.id === target)
            : -1;

          switch (action) {
            case "delete":
              if (targetIndex >= 0 && targetIndex < prev.length) {
                return prev.filter((_, i) => i !== targetIndex);
              }
              return prev;

            case "markDone":
              if (targetIndex >= 0 && targetIndex < prev.length) {
                return prev.map((p, i) =>
                  i === targetIndex ? { ...p, status: "answered" as const } : p,
                );
              }
              return prev;

            case "unmark":
              if (targetIndex >= 0 && targetIndex < prev.length) {
                return prev.map((p, i) =>
                  i === targetIndex ? { ...p, status: "planned" as const } : p,
                );
              }
              return prev;

            case "skip":
              if (targetIndex >= 0 && targetIndex < prev.length) {
                return prev.map((p, i) =>
                  i === targetIndex ? { ...p, status: "skipped" as const } : p,
                );
              }
              return prev;

            case "reorder":
              if (targetIndex >= 0 && newPosition && newPosition >= 1) {
                const newPrompts = [...prev];
                const [moved] = newPrompts.splice(targetIndex, 1);
                newPrompts.splice(
                  Math.min(newPosition - 1, newPrompts.length),
                  0,
                  moved,
                );
                return newPrompts;
              }
              return prev;

            case "add":
              if (promptText) {
                return [
                  ...prev,
                  {
                    id: `q${Date.now()}`,
                    text: promptText,
                    status: "planned" as const,
                    isMustHave: isMustHave ?? false,
                  },
                ];
              }
              return prev;

            default:
              return prev;
          }
        });
      }
    }
  }, [toolResults]);

  // Auto-stream data when component is first selected
  useEffect(() => {
    if (
      componentToRender?.componentType === "BANTScorecard" &&
      !streamingBantStarted
    ) {
      setStreamingBantStarted(true);
      const context = messages
        .map((m) => {
          const text = m.parts
            ?.filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("");
          return `${m.role}: ${text}`;
        })
        .join("\n");
      streamBant({ context });
    }
  }, [componentToRender, streamingBantStarted, messages, streamBant]);

  useEffect(() => {
    if (
      componentToRender?.componentType === "InterviewPrompts" &&
      !streamingPromptsStarted
    ) {
      setStreamingPromptsStarted(true);
      streamPrompts({ topic: componentToRender.topic || "User research" });
    }
  }, [componentToRender, streamingPromptsStarted, streamPrompts]);

  // Handle UI changes to prompts
  const handlePromptsChange = useCallback((newPrompts: InterviewPrompt[]) => {
    setPrompts(newPrompts);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl">Generative UI Demo</h1>
        <p className="text-muted-foreground">
          Bidirectional: agent controls UI, UI changes sync to agent.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Conversation</CardTitle>
            <CardDescription>
              Try: &quot;interview questions&quot; then &quot;delete prompt
              3&quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="mb-4 min-h-[300px] max-h-[400px] space-y-3 overflow-y-auto">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                  <Bot className="mb-2 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium text-sm">What do you want to do?</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    &quot;I need interview questions&quot; or &quot;qualify my
                    deals&quot;
                  </p>
                </div>
              )}

              {messages.map((message, index) => {
                const key = message.id || `${message.role}-${index}`;
                const isUser = message.role === "user";
                const textParts =
                  message.parts
                    ?.filter((part) => part.type === "text")
                    .map((part) => part.text) ?? [];
                const messageText = textParts.filter(Boolean).join("\n").trim();

                if (
                  !isUser &&
                  !messageText &&
                  !(isBusy && index === messages.length - 1)
                ) {
                  return null;
                }

                return (
                  <div
                    key={key}
                    className={cn(
                      "flex gap-2",
                      isUser ? "justify-end" : "justify-start",
                    )}
                  >
                    {!isUser && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2",
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      {messageText ? (
                        isUser ? (
                          <span className="whitespace-pre-wrap text-sm">
                            {messageText}
                          </span>
                        ) : (
                          <AiResponse className="text-sm">
                            {messageText}
                          </AiResponse>
                        )
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-xs">Thinking...</span>
                        </div>
                      )}
                    </div>
                    {isUser && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isBusy}
                rows={2}
                className="min-h-[50px] flex-1 resize-none text-sm"
              />
              <Button
                type="submit"
                disabled={isBusy || !input.trim()}
                size="icon"
                className="h-auto"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Component Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4" />
              Generated Component
            </CardTitle>
            <CardDescription>
              {componentToRender
                ? `${componentToRender.componentType}${isStreamingAny ? " - Streaming..." : ""}`
                : "Waiting for conversation..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {!componentToRender && (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                <div className="mb-2 h-12 w-12 rounded-full bg-muted/50" />
                <p className="font-medium text-sm">No component yet</p>
              </div>
            )}

            {componentToRender?.componentType === "BANTScorecard" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-primary/5 p-3 text-sm">
                  <p className="font-medium">{componentToRender.reasoning}</p>
                </div>
                <SimpleBANT
                  data={(bantData as SimpleBANTData) || {}}
                  isStreaming={isStreamingBant}
                />
              </div>
            )}

            {componentToRender?.componentType === "InterviewPrompts" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-primary/5 p-3 text-sm">
                  <p className="font-medium">{componentToRender.reasoning}</p>
                </div>
                <InterviewPrompts
                  data={{ title: promptsTitle, prompts }}
                  isStreaming={isStreamingPrompts}
                  onPromptsChange={handlePromptsChange}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-muted-foreground text-xs">
        Status: {status} | Messages: {messages.length} | Prompts:{" "}
        {prompts.length}
        {isStreamingAny && " | Streaming..."}
      </div>
    </div>
  );
}
