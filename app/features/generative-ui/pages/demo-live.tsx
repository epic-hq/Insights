/**
 * Live Generative UI Demo with Real Agent
 *
 * Shows actual back-and-forth conversation where the agent:
 * 1. Asks clarifying questions
 * 2. Understands user intent through conversation
 * 3. Dynamically renders components based on what it learns
 */

import { useChat } from "@ai-sdk/react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Send, User } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { BANTScorecard } from "../components/BANTScorecard";

export default function LiveGenerativeUIDemo() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: "/api/demo/gen-ui-chat",
      onError: (error) => {
        console.error("Chat error:", error);
      },
      onResponse: (response) => {
        console.log("Chat response:", response);
      },
    });

  console.log("Demo state:", { messages, input, isLoading, error });

  const [renderedComponent, setRenderedComponent] = useState<{
    type: string;
    data: Record<string, unknown>;
  } | null>(null);

  // Check tool calls in messages for component rendering
  // When agent calls recommendLensComponent, we render the appropriate component
  const lastMessage = messages[messages.length - 1];
  if (
    lastMessage?.role === "assistant" &&
    Array.isArray(
      (lastMessage as { toolInvocations?: unknown[] }).toolInvocations,
    )
  ) {
    const toolInvocations = (
      lastMessage as {
        toolInvocations: {
          toolName?: string;
          result?: { componentType?: string; lens?: string };
        }[];
      }
    ).toolInvocations;
    const componentTool = toolInvocations.find(
      (t) => t.toolName === "recommend-lens-component",
    );
    if (componentTool?.result?.componentType && !renderedComponent) {
      // Render component based on tool result
      setRenderedComponent({
        type: componentTool.result.componentType,
        data: componentTool.result,
      });
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="font-bold text-4xl">Live Demo: Conversational Agent</h1>
        <p className="text-lg">
          Have a real conversation with the agent. It will ask clarifying
          questions, understand your goal, and dynamically choose what to show
          you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Panel */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>
              Start by saying what you want to learn about your customers
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {/* Messages */}
            <div className="mb-4 flex-1 space-y-4 overflow-y-auto">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <Bot className="mb-3 h-12 w-12 text-muted-foreground" />
                  <p className="font-medium">
                    Hi! What do you want to learn about your customers?
                  </p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Try: "I need to qualify some deals" or "I want to understand
                    user needs"
                  </p>
                </div>
              )}

              <AnimatePresence mode="popLayout">
                {messages.map((message, index) => (
                  <motion.div
                    key={`${message.id}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <p className="text-sm">{message.content}</p>

                      {/* Show tool calls */}
                      {message.role === "assistant" &&
                        Array.isArray(
                          (
                            message as {
                              toolInvocations?: {
                                toolName?: string;
                                state?: string;
                                result?: { reasoning?: string };
                              }[];
                            }
                          ).toolInvocations,
                        ) &&
                        (
                          message as {
                            toolInvocations: {
                              toolName?: string;
                              state?: string;
                              result?: { reasoning?: string };
                            }[];
                          }
                        ).toolInvocations.map((tool, toolIndex) => (
                          <div
                            key={`${index}-${toolIndex}`}
                            className="mt-2 rounded border border-primary/20 bg-primary/5 p-2 text-xs"
                          >
                            <p className="font-medium">
                              🔧{" "}
                              {tool.toolName === "recommend-lens-component"
                                ? "Recommending component..."
                                : tool.toolName}
                            </p>
                            {tool.state === "result" &&
                              tool.result?.reasoning && (
                                <p className="mt-1 opacity-70">
                                  {tool.result.reasoning}
                                </p>
                              )}
                          </div>
                        ))}
                    </div>
                    {message.role === "user" && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                        <User className="h-5 w-5 text-primary-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Component Panel */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Agent-Chosen Component</CardTitle>
            <CardDescription>
              Once the agent understands your goal, it will render the
              appropriate component here
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {!renderedComponent && (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <div className="mb-3 h-16 w-16 rounded-full bg-muted/50" />
                <p className="font-medium">No component yet</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  The agent will choose what to show based on your conversation
                </p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {renderedComponent && (
                <motion.div
                  key={renderedComponent.type}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Render component based on type */}
                  {renderedComponent.type === "BANTScorecard" && (
                    <BANTScorecard
                      budget={{
                        score: 0,
                        evidence: [],
                        status: "empty",
                      }}
                      authority={{
                        score: 0,
                        evidence: [],
                        status: "empty",
                      }}
                      need={{
                        score: 0,
                        evidence: [],
                        status: "empty",
                      }}
                      timeline={{
                        score: 0,
                        evidence: [],
                        status: "empty",
                      }}
                      overallScore={0}
                      isStreaming={false}
                    />
                  )}

                  {renderedComponent.type === "GenericLens" && (
                    <div className="rounded-lg border p-6">
                      <h3 className="mb-2 font-semibold">
                        {renderedComponent.data.lens} Framework
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        Component for {renderedComponent.data.lens} would render
                        here
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* Status Footer */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">Status:</span>{" "}
              {isLoading
                ? "Agent is thinking..."
                : renderedComponent
                  ? `Showing ${renderedComponent.type}`
                  : "Waiting for conversation"}
            </div>
            <div className="opacity-70">
              {messages.length} messages exchanged
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
