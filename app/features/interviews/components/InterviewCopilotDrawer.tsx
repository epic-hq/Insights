/**
 * Drawer component for the interview AI copilot chat interface.
 * Uses Mastra chat transport to provide interview-specific AI assistance.
 */
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { BotMessageSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import type { UpsightMessage } from "~/mastra/message-types";

export function InterviewCopilotDrawer({
  open,
  onOpenChange,
  accountId,
  projectId,
  interviewId,
  interviewTitle,
  systemContext,
  initialPrompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  projectId: string;
  interviewId: string;
  interviewTitle: string;
  systemContext: string;
  initialPrompt: string;
}) {
  const [input, setInput] = useState("");
  const [initialMessageSent, setInitialMessageSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const routes = useProjectRoutesFromIds(accountId, projectId);
  const { messages, sendMessage, status } = useChat<UpsightMessage>({
    transport: new DefaultChatTransport({
      api: routes.api.chat.interview(interviewId),
      body: { system: systemContext },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const visibleMessages = useMemo(
    () => (messages ?? []).slice(-20),
    [messages],
  );

  useEffect(() => {
    if (open && !initialMessageSent && visibleMessages.length === 0) {
      sendMessage({ text: initialPrompt });
      setInitialMessageSent(true);
    }
  }, [
    open,
    initialMessageSent,
    visibleMessages.length,
    sendMessage,
    initialPrompt,
  ]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const isBusy = status === "streaming" || status === "submitted";
  const isError = status === "error";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-border border-b bg-muted/40 p-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <BotMessageSquare className="h-4 w-4 text-primary" />
            UpSight Assistant
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex-1 p-3">
            {visibleMessages.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Gathering the latest takeaways from this interview…
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                {visibleMessages.map((message, index) => {
                  const key = message.id || `${message.role}-${index}`;
                  const isUser = message.role === "user";
                  const textParts =
                    message.parts?.map((part) => {
                      if (part.type === "text") return part.text;
                      if (part.type === "tool-call") {
                        return `Calling tool: ${part.toolName ?? "unknown"}`;
                      }
                      if (part.type === "tool-result") {
                        return `Tool result: ${part.toolName ?? "unknown"}`;
                      }
                      return "";
                    }) ?? [];
                  const messageText = textParts
                    .filter(Boolean)
                    .join("\n")
                    .trim();
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex",
                        isUser ? "justify-end" : "justify-start",
                      )}
                    >
                      <div className="max-w-[90%]">
                        <div className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                          {isUser ? "You" : "Assistant"}
                        </div>
                        <div
                          className={cn(
                            "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm",
                            isUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-foreground ring-1 ring-border/60",
                          )}
                        >
                          {messageText ? (
                            isUser ? (
                              <span className="whitespace-pre-wrap">
                                {messageText}
                              </span>
                            ) : (
                              <Streamdown className="prose prose-sm max-w-none text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                {messageText}
                              </Streamdown>
                            )
                          ) : !isUser ? (
                            <span className="text-muted-foreground italic">
                              Thinking...
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              (No text response)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="Ask about evidence, themes, or next steps"
              rows={3}
              disabled={isBusy}
            />
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-muted-foreground text-xs"
                aria-live="polite"
              >
                {isError
                  ? "Something went wrong. Try again."
                  : isBusy
                    ? "Thinking…"
                    : "Keep questions short and specific."}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || isBusy}
              >
                Send
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
