import { useChat } from "@ai-sdk/react";
import { convertMessages } from "@mastra/core/agent";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import consola from "consola";
import { Brain, Check, Loader, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { data, useNavigate, useRouteLoaderData } from "react-router";
import { Streamdown } from "streamdown";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import { Message, MessageContent } from "~/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "~/components/ai-elements/prompt-input";
import { Response as AiResponse } from "~/components/ai-elements/response";
import { Task, TaskContent, TaskTrigger } from "~/components/ai-elements/task";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TextShimmer } from "~/components/ui/text-shimmer";
import { AudioRecorder } from "~/features/voice/audio-recorder";
import {
  getAuthenticatedUser,
  getServerClient,
} from "~/lib/supabase/client.server";
import { cn } from "~/lib/utils";
import { memory } from "~/mastra/memory";
import type { UpsightMessage } from "~/mastra/message-types";
import { SignupDataWatcher } from "../components/SignupDataWatcher";
import type { Route } from "./+types/ai-sdk-chat";

export async function loader({ context, request }: LoaderFunctionArgs) {
  const { user } = await getAuthenticatedUser(request);
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { client: supabase } = getServerClient(request);
  // Basic usage with default parameters
  const result = await memory.listThreads({
    filter: { resourceId: `signupAgent-${user.sub}` },
    orderBy: { field: "createdAt", direction: "DESC" },
    page: 0,
    perPage: 100,
  });

  consola.log("Result: ", result);
  let threadId = "";

  if (!(result?.total > 0)) {
    const newThread = await memory.createThread({
      resourceId: `signupAgent-${user.sub}`,
      title: "Signup Chat",
      metadata: {
        user_id: user.sub,
      },
    });
    consola.log("New thread created: ", newThread);
    threadId = newThread.id;
  } else {
    threadId = result.threads[0].id;
  }

  // Get messages in the V2 format (roughly equivalent to AI SDK's UIMessage format)
  const { messages } = await memory.recall({
    threadId: threadId,
    perPage: 50,
  });
  const aiv5Messages = convertMessages(messages).to(
    "AIV5.UI",
  ) as UpsightMessage[];

  // Get existing chat data from user_settings
  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("signup_data")
    .eq("user_id", user.sub)
    .single();

  const existingChatData = userSettings?.signup_data;

  return data({
    messages: aiv5Messages,
    existingChatData,
    user,
    threadId,
  });
}

export default function SignupChat({ loaderData }: Route.ComponentProps) {
  const { messages: initialMessages, existingChatData, user } = loaderData;
  const [input, setInput] = useState("");
  const [prompts, _setPrompts] = useState<string[]>(["I'm on home page"]);
  const navigate = useNavigate();

  // Ai SDK chat
  const { messages, sendMessage, status, addToolResult } =
    useChat<UpsightMessage>({
      transport: new DefaultChatTransport({
        api: "/api/chat/signup",
        body: () => ({
          system: prompts ? prompts.join("\n\n") : null,
        }),
      }),
      messages: initialMessages,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

      // run client-side tools that are automatically executed:
      async onToolCall({ toolCall }) {
        // Check if it's a dynamic tool first for proper type narrowing
        if (toolCall.dynamic) {
          return;
        }

        if (toolCall.toolName === "navigateToPage") {
          consola.log("Navigating to page: ", toolCall.input);
          navigate(toolCall?.input?.path);
          // No await - avoids potential deadlocks
          addToolResult({
            tool: "navigateToPage",
            toolCallId: toolCall.toolCallId,
            output: true,
          });
        }
      },
    });

  // Onboarding data
  const [_onboardingData, setOnboardingData] = useState(existingChatData);
  const [chatCompleted, setChatCompleted] = useState(
    Boolean(existingChatData?.completed || false),
  );
  const { clientEnv } = useRouteLoaderData("root");
  const chatRequired = Boolean(clientEnv?.SIGNUP_CHAT_REQUIRED === "true");
  // If signup chat is not required, or it's already completed, send users home immediately.
  useEffect(() => {
    if (!chatRequired) {
      navigate("/home");
    } else if (chatCompleted) {
      navigate("/signup-chat/completed");
    }
  }, [chatCompleted, navigate, chatRequired]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  // Ref for auto-focusing the input
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the input when the assistant finishes responding
  useEffect(() => {
    if (status === "ready" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [status, messages.length]);

  return (
    <div className="relative mx-auto flex size-full h-dvh max-w-6xl flex-col rounded-lg px-2 md:flex-row md:px-4">
      {/* <div className="grid h-dvh grid-cols-1 gap-x-2 px-4 pt-16 pb-4 md:grid-cols-[200px_1fr] md:pt-4 lg:grid-cols-[400px_1fr]"> */}
      <div className="w-full md:w-1/3">
        <SignupDataWatcher
          userId={user?.sub}
          data={existingChatData}
          onDataUpdate={(data) => {
            consola.log("onDataUpdate", data);
            setOnboardingData(data);
          }}
          onCompleted={() => setChatCompleted(true)}
        />
      </div>
      <div className="flex h-full w-full flex-col md:w-2/3">
        <Conversation>
          <ConversationContent>
            {messages?.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message?.parts?.map((part, i) => {
                    switch (part.type) {
                      // @ts-expect-error - this is mastra built in tool
                      case "tool-updateWorkingMemory":
                        return (
                          <Task key={i}>
                            <TaskTrigger
                              title="Update Working Memory"
                              icon={<Brain className="size-4" />}
                            />
                            <TaskContent>
                              {/* @ts-expect-error - this is mastra built in tool */}
                              <Streamdown className="rounded-2xl bg-white p-2">
                                {(part?.input?.memory as string) || ""}
                              </Streamdown>
                            </TaskContent>
                          </Task>
                        );
                      case "tool-displayUserQuestions":
                        switch (part.state) {
                          case "input-streaming":
                            return <Loader />;
                          case "input-available":
                            return (
                              <Card>
                                <CardHeader>
                                  <CardTitle>Research Questions</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {part.input?.questions?.map((question, i) => (
                                    <div key={i}>{question}</div>
                                  ))}
                                </CardContent>
                              </Card>
                            );
                          case "output-available":
                            return (
                              <Card>
                                z
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <Check /> Research Questions
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {part.input?.questions?.map((question, i) => (
                                    <div key={i}>{question}</div>
                                  ))}
                                </CardContent>
                              </Card>
                            );
                        }
                      case "tool-saveUserSettingsData":
                        return (
                          <Task className="rounded-lg border p-4">
                            <TaskTrigger
                              title="Saved details"
                              icon={<Pencil className="size-4" />}
                            />
                            <TaskContent>
                              {/* {part?.output?.message} */}
                              {part?.output?.data?.challenges && (
                                <div>
                                  <span className="font-bold">Challenges:</span>{" "}
                                  {part?.output?.data?.challenges}
                                </div>
                              )}
                              {part?.output?.data?.content_types && (
                                <div>
                                  <span className="font-bold">
                                    Content Types:
                                  </span>{" "}
                                  {part?.output?.data?.content_types}
                                </div>
                              )}
                              {part?.output?.data?.goal && (
                                <div>
                                  <span className="font-bold">Goal:</span>{" "}
                                  {part?.output?.data?.goal}
                                </div>
                              )}
                              {part?.output?.data?.other_feedback && (
                                <div>
                                  <span className="font-bold">
                                    Other Feedback:
                                  </span>{" "}
                                  {part?.output?.data?.other_feedback}
                                </div>
                              )}
                              {part?.output?.data?.completed && (
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">Completed:</span>{" "}
                                  {part?.output?.data?.completed ? (
                                    <Check className="size-4 text-emerald-500" />
                                  ) : (
                                    <X className="size-4" />
                                  )}
                                </div>
                              )}
                              {/* {process.env.NODE_ENV === "development" && JSON.stringify(part?.output?.data)} */}
                            </TaskContent>
                          </Task>
                        );
                      case "tool-saveProjectSectionsData":
                        return (
                          <Task className="rounded-lg border p-4">
                            <TaskTrigger
                              title="Save sections"
                              icon={<Pencil className="size-4" />}
                            />
                            <TaskContent>{part?.output?.message}</TaskContent>
                          </Task>
                        );
                      case "text": // we don't use any reasoning or tool calls in this example
                        return (
                          <AiResponse key={`${message.id}-${i}`}>
                            {part.text}
                          </AiResponse>
                        );
                      default:
                        return null;
                    }
                  })}
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="flex flex-row justify-between gap-2">
          <AudioRecorder
            onAfterTranscription={(transcription) => {
              console.log("transcription", transcription);
              // setInput((prev) => prev?.trim() ? prev + "\n" + transcription : transcription)
              if (transcription.trim()) {
                sendMessage({ text: transcription });
                // setInput("")
              }
            }}
          />
          <span>
            <TextShimmer
              className={cn(
                "mt-1 hidden font-mono text-sm",
                status === "streaming" || (status === "submitted" && "block"),
              )}
              duration={3}
            >
              Thinking...
            </TextShimmer>
            <div
              className={cn(
                "mt-1 hidden font-mono text-destructive text-sm",
                status === "error" && "block",
              )}
            >
              Error
            </div>
          </span>
        </div>
        <PromptInput
          onSubmit={handleSubmit}
          className="relative mx-auto mt-1 mb-6 w-full max-w-2xl"
        >
          <PromptInputTextarea
            ref={inputRef}
            value={input}
            placeholder="Say something..."
            onChange={(e) => setInput(e.currentTarget.value)}
            className="pr-12"
            autoFocus
          />
          <PromptInputSubmit
            status={status === "streaming" ? "streaming" : "ready"}
            disabled={!input.trim()}
            className="absolute right-1 bottom-1"
          />
        </PromptInput>
      </div>
    </div>
  );
}
