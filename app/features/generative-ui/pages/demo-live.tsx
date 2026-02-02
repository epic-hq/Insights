/**
 * Live Generative UI Demo
 *
 * Demonstrates:
 * 1. Agent conversation that triggers component selection (tool call)
 * 2. Streaming structured data into components (useObject)
 */

import { useChat } from "@ai-sdk/react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { SimpleBANT, type SimpleBANTData } from "../components/SimpleBANT";

// Schema for streaming BANT data
const bantSchema = z.object({
  budget: z
    .object({
      score: z.number(),
      note: z.string().optional(),
    })
    .optional(),
  authority: z
    .object({
      score: z.number(),
      note: z.string().optional(),
    })
    .optional(),
  need: z
    .object({
      score: z.number(),
      note: z.string().optional(),
    })
    .optional(),
  timeline: z
    .object({
      score: z.number(),
      note: z.string().optional(),
    })
    .optional(),
  overall: z.number().optional(),
});

// Types for tool results
interface LensRecommendation {
  intent: string;
  lens: string;
  reasoning: string;
  componentType: string;
  renderUI: boolean;
}

// Extract tool results from message parts
function extractToolResult(message: UpsightMessage): LensRecommendation | null {
  if (!message.parts) return null;

  for (const part of message.parts) {
    const anyPart = part as {
      type: string;
      state?: string;
      output?: LensRecommendation;
    };

    if (
      anyPart.type === "tool-recommendLensComponent" &&
      anyPart.state === "output-available" &&
      anyPart.output?.renderUI
    ) {
      return anyPart.output;
    }
  }
  return null;
}

export default function LiveGenerativeUIDemo() {
  const [input, setInput] = useState("");
  const [streamingData, setStreamingData] = useState(false);

  // Chat for component selection
  const { messages, sendMessage, status } = useChat<UpsightMessage>({
    transport: new DefaultChatTransport({
      api: "/api/demo/gen-ui-chat",
    }),
  });

  // Streaming object for BANT data
  const {
    object: bantData,
    submit: streamBant,
    isLoading: isStreamingBant,
  } = useObject({
    api: "/api/demo/stream-bant",
    schema: bantSchema,
  });

  const isBusy = status === "streaming" || status === "submitted";

  // Extract component recommendation
  const componentToRender = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const result = extractToolResult(messages[i]);
      if (result) return result;
    }
    return null;
  }, [messages]);

  // Auto-stream BANT data when component is selected
  useEffect(() => {
    if (
      componentToRender?.componentType === "BANTScorecard" &&
      !streamingData &&
      !bantData
    ) {
      setStreamingData(true);
      // Get conversation context for BANT analysis
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
  }, [componentToRender, streamingData, bantData, messages, streamBant]);

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
          Chat triggers component selection, then data streams in.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Conversation</CardTitle>
            <CardDescription>
              Say &quot;I want to qualify deals&quot; to see the BANT component
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="mb-4 min-h-[300px] max-h-[400px] space-y-3 overflow-y-auto">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                  <Bot className="mb-2 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium text-sm">
                    What do you want to learn?
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
                ? `${componentToRender.componentType} - ${isStreamingBant ? "Streaming data..." : "Ready"}`
                : "Waiting for conversation..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {!componentToRender && (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                <div className="mb-2 h-12 w-12 rounded-full bg-muted/50" />
                <p className="font-medium text-sm">No component yet</p>
                <p className="mt-1 text-muted-foreground text-xs">
                  Try: &quot;I want to qualify deals&quot;
                </p>
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
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-muted-foreground text-xs">
        Status: {status} | Messages: {messages.length}
        {componentToRender &&
          ` | Component: ${componentToRender.componentType}`}
        {isStreamingBant && " | Streaming BANT data..."}
      </div>
    </div>
  );
}
