/**
 * Public survey page with both form and AI chat modes
 */
import { useChat } from "@ai-sdk/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Mic,
  PencilLine,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  VoiceButton,
  type VoiceButtonState,
} from "~/components/ui/voice-button";
import {
  type ResearchLinkQuestion,
  ResearchLinkQuestionSchema,
} from "~/features/research-links/schemas";
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { cn } from "~/lib/utils";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Survey" }];
  }
  return [
    { title: data.list.hero_title || data.list.name || "Survey" },
    {
      name: "description",
      content: data.list.hero_subtitle || data.list.description || "",
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Missing slug", { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { data: list, error } = await supabase
    .from("research_links")
    .select(
      "id, name, slug, description, hero_title, hero_subtitle, hero_cta_label, hero_cta_helper, redirect_url, calendar_url, questions, allow_chat, default_response_mode, is_live, account_id",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Response(error.message, { status: 500 });
  }
  if (!list || !list.is_live) {
    throw new Response("Survey not found", { status: 404 });
  }

  let accountName: string | null = null;
  if (list.account_id) {
    const { data: account } = await supabase
      .schema("accounts")
      .from("accounts")
      .select("name")
      .eq("id", list.account_id)
      .maybeSingle();
    accountName = account?.name ?? null;
  }

  const questionsResult = ResearchLinkQuestionSchema.array().safeParse(
    list.questions,
  );
  return {
    slug,
    list,
    questions: questionsResult.success ? questionsResult.data : [],
    accountName,
  };
}

type LoaderData =
  Awaited<ReturnType<typeof loader>> extends Response
    ? never
    : Awaited<ReturnType<typeof loader>>;

type Stage = "email" | "survey" | "complete";
type Mode = "form" | "chat";
type ResponseValue = string | string[] | boolean | null;
type ResponseRecord = Record<string, ResponseValue>;

async function startSignup(
  slug: string,
  payload: { email: string; responseId?: string | null; responseMode?: Mode },
) {
  const response = await fetch(`/api/research-links/${slug}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to start survey");
  }
  return (await response.json()) as {
    responseId: string;
    responses: ResponseRecord;
    completed: boolean;
  };
}

async function saveProgress(
  slug: string,
  payload: {
    responseId: string;
    responses: ResponseRecord;
    completed?: boolean;
  },
) {
  const response = await fetch(`/api/research-links/${slug}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to save responses");
  }
  return (await response.json()) as { ok: boolean };
}

export default function ResearchLinkPage() {
  const { slug, list, questions, accountName } = useLoaderData() as LoaderData;
  const storageKey = `research-link:${slug}`;
  const [stage, setStage] = useState<Stage>("email");
  const [mode, setMode] = useState<Mode>(
    list.allow_chat ? (list.default_response_mode ?? "form") : "form",
  );
  const [email, setEmail] = useState("");
  const [responseId, setResponseId] = useState<string | null>(null);
  const [responses, setResponses] = useState<ResponseRecord>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<ResponseValue>("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const resolvedMode = list.allow_chat ? mode : "form";

  // Chat mode state
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState("");
  const {
    messages,
    handleSubmit: handleChatSubmit,
    isLoading: isChatLoading,
    append,
  } = useChat({
    api: `/api/research-links/${slug}/chat`,
    body: {
      responseId,
      currentResponses: responses,
    },
    onFinish: async (message) => {
      // After AI responds, try to extract and save any answers from the conversation
      await extractAndSaveAnswers(message.content);
    },
  });

  // Voice input for chat
  const handleChatVoiceTranscription = useCallback((text: string) => {
    setChatInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  }, []);

  const {
    isRecording: isChatVoiceRecording,
    isTranscribing: isChatTranscribing,
    error: chatVoiceError,
    toggleRecording: toggleChatRecording,
    isSupported: isVoiceSupported,
  } = useSpeechToText({ onTranscription: handleChatVoiceTranscription });

  // Voice input for form mode
  const handleFormVoiceTranscription = useCallback((text: string) => {
    setCurrentAnswer((prev) => {
      const current = typeof prev === "string" ? prev : "";
      return current.trim() ? `${current.trim()} ${text}` : text;
    });
  }, []);

  const {
    isRecording: isFormVoiceRecording,
    isTranscribing: isFormTranscribing,
    error: formVoiceError,
    toggleRecording: toggleFormRecording,
  } = useSpeechToText({ onTranscription: handleFormVoiceTranscription });

  // Chat voice button state
  const chatVoiceButtonState: VoiceButtonState = chatVoiceError
    ? "error"
    : isChatTranscribing
      ? "processing"
      : isChatVoiceRecording
        ? "recording"
        : "idle";

  // Form voice button state
  const formVoiceButtonState: VoiceButtonState = formVoiceError
    ? "error"
    : isFormTranscribing
      ? "processing"
      : isFormVoiceRecording
        ? "recording"
        : "idle";

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Extract answers from chat conversation and save them
  const extractAndSaveAnswers = useCallback(
    async (aiResponse: string) => {
      // This is a simple extraction - in production you might want the AI to return structured data
      // For now, we'll just save the conversation and let the backend handle extraction later
      if (!responseId) return;

      // Check if all questions have been asked (AI will mention completion)
      const isComplete =
        aiResponse.toLowerCase().includes("thank you") &&
        aiResponse.toLowerCase().includes("responses");

      if (isComplete) {
        // Mark as complete
        await saveProgress(slug, {
          responseId,
          responses,
          completed: true,
        });
        setStage("complete");
      }
    },
    [responseId, responses, slug],
  );

  // Start chat with initial AI message when entering chat mode
  const hasStartedChat = useRef(false);
  useEffect(() => {
    if (
      stage === "survey" &&
      resolvedMode === "chat" &&
      messages.length === 0 &&
      responseId &&
      !hasStartedChat.current &&
      typeof append === "function"
    ) {
      hasStartedChat.current = true;
      // Trigger initial AI message using append
      append({
        role: "user",
        content: "Hi, I'm ready to share my feedback.",
      });
    }
  }, [stage, resolvedMode, messages.length, responseId, append]);

  useEffect(() => {
    if (!list.allow_chat && mode === "chat") {
      setMode("form");
    }
  }, [list.allow_chat, mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setInitializing(false);
        return;
      }
      const parsed = JSON.parse(stored) as {
        email?: string;
        responseId?: string;
      };
      if (parsed.email && parsed.responseId) {
        void startSignup(slug, {
          email: parsed.email,
          responseId: parsed.responseId,
          responseMode: resolvedMode,
        })
          .then((result) => {
            setEmail(parsed.email as string);
            setResponseId(result.responseId);
            setResponses(result.responses || {});
            const initialIndex = findNextQuestionIndex(
              result.responses || {},
              questions,
            );
            if (initialIndex >= questions.length) {
              setStage("complete");
            } else {
              setStage("survey");
              setCurrentIndex(initialIndex);
              const existingValue =
                result.responses?.[questions[initialIndex]?.id];
              setCurrentAnswer(existingValue ?? "");
            }
          })
          .catch(() => {
            window.localStorage.removeItem(storageKey);
          })
          .finally(() => {
            setInitializing(false);
          });
      } else {
        window.localStorage.removeItem(storageKey);
        setInitializing(false);
      }
    } catch {
      setInitializing(false);
    }
  }, [questions, slug, storageKey]);

  useEffect(() => {
    if (stage === "survey" && resolvedMode === "form") {
      const value = responses[questions[currentIndex]?.id];
      setCurrentAnswer(value ?? "");
    }
  }, [stage, currentIndex, questions, responses, resolvedMode]);

  const currentQuestion = useMemo(
    () => questions[currentIndex],
    [currentIndex, questions],
  );

  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
      const val = responses[q.id];
      return val !== undefined && val !== null && val !== "";
    }).length;
  }, [questions, responses]);

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Enter an email to continue");
      return;
    }
    try {
      setIsSaving(true);
      const result = await startSignup(slug, {
        email: email.trim(),
        responseId,
        responseMode: resolvedMode,
      });
      setResponseId(result.responseId);
      setResponses(result.responses || {});
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ email: email.trim(), responseId: result.responseId }),
      );
      const initialIndex = findNextQuestionIndex(
        result.responses || {},
        questions,
      );
      if (initialIndex >= questions.length) {
        setStage("complete");
      } else {
        setCurrentIndex(initialIndex);
        setStage("survey");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAnswerSubmit(value: ResponseValue) {
    if (!responseId) {
      setError("Something went wrong. Refresh and try again.");
      return;
    }
    const normalizedValue = normalizeResponseValue(value);
    if (currentQuestion?.required && !hasResponseValue(normalizedValue)) {
      setError("This question is required");
      return;
    }
    setError(null);
    const nextResponses: ResponseRecord = {
      ...responses,
      [currentQuestion?.id ?? ""]: normalizedValue,
    };
    setIsSaving(true);
    try {
      const nextIndex = currentIndex + 1;
      const isComplete = nextIndex >= questions.length;
      await saveProgress(slug, {
        responseId,
        responses: nextResponses,
        completed: isComplete,
      });
      setResponses(nextResponses);
      if (isComplete) {
        setStage("complete");
        if (list.redirect_url) {
          setTimeout(() => {
            window.location.href = list.redirect_url as string;
          }, 3000);
        }
      } else {
        setCurrentIndex(nextIndex);
        setCurrentAnswer(nextResponses[questions[nextIndex]?.id] ?? "");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to save your answer",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleBack() {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      setCurrentAnswer(responses[questions[prevIndex]?.id] ?? "");
    }
  }

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-8 md:py-16">
      <div className="mx-auto max-w-2xl px-4">
        <Card className="overflow-hidden border-white/10 bg-black/30 backdrop-blur">
          <CardHeader className="space-y-2 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                {accountName && (
                  <p className="text-white/50 text-xs">
                    {accountName} wants to hear from you
                  </p>
                )}
                <h1 className="font-semibold text-white text-xl">
                  {list.hero_title || list.name || "Share your feedback"}
                </h1>
              </div>
              {/* Mode selector - compact */}
              {stage !== "complete" && (
                <div className="flex shrink-0 gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setMode("form")}
                    className={cn(
                      "rounded-md px-2 py-1 transition",
                      resolvedMode === "form"
                        ? "bg-white/20 text-white"
                        : "text-white/40 hover:text-white/60",
                    )}
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                  </button>
                  {list.allow_chat && (
                    <button
                      type="button"
                      onClick={() => setMode("chat")}
                      className={cn(
                        "rounded-md px-2 py-1 transition",
                        resolvedMode === "chat"
                          ? "bg-white/20 text-white"
                          : "text-white/40 hover:text-white/60",
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {list.calendar_url && (
                    <a
                      href={list.calendar_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md px-2 py-1 text-white/40 transition hover:text-white/60"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 bg-black/40 p-4 text-white md:p-6">
            {error && (
              <Alert
                variant="destructive"
                className="border-red-500/60 bg-red-500/10 text-red-100"
              >
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Email stage */}
            {stage === "email" && (
              <motion.form
                onSubmit={handleEmailSubmit}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/90">
                    Your Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="border-white/10 bg-black/40 text-white placeholder:text-white/40"
                    required
                  />
                  <p className="text-white/50 text-xs">
                    {list.hero_cta_helper ||
                      "We'll only contact you about this study"}
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={isSaving}
                  size="sm"
                  className="bg-white text-black hover:bg-white/90"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Continue"
                  )}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </motion.form>
            )}

            {/* Survey stage - Form mode */}
            {stage === "survey" &&
              resolvedMode === "form" &&
              currentQuestion && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Progress dots */}
                    <div className="flex items-center justify-center gap-1.5">
                      {questions.map((_, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "h-2 w-2 rounded-full transition-all duration-300",
                            idx < currentIndex
                              ? "bg-emerald-400"
                              : idx === currentIndex
                                ? "bg-emerald-400 ring-2 ring-emerald-400/30"
                                : "bg-white/20",
                          )}
                        />
                      ))}
                    </div>

                    <div className="rounded-xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-5">
                      <h2 className="mb-4 font-medium text-white">
                        {currentQuestion.prompt}
                        {!currentQuestion.required && (
                          <span className="ml-2 font-normal text-white/40 text-xs">
                            optional
                          </span>
                        )}
                      </h2>
                      <div className="max-w-md space-y-4">
                        {renderQuestionInput({
                          question: currentQuestion,
                          value: currentAnswer,
                          onChange: setCurrentAnswer,
                          voiceSupported: isVoiceSupported,
                          voiceButtonState: formVoiceButtonState,
                          toggleRecording: toggleFormRecording,
                        })}
                        <div className="flex items-center justify-between pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleBack}
                            disabled={currentIndex === 0}
                            className="-ml-2 text-white/50 hover:bg-white/10 hover:text-white"
                          >
                            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                            Back
                          </Button>
                          <div className="flex gap-2">
                            {!currentQuestion.required && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleAnswerSubmit(null)}
                                disabled={isSaving}
                                className="text-white/50 hover:bg-white/10 hover:text-white"
                              >
                                Skip
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                void handleAnswerSubmit(currentAnswer)
                              }
                              disabled={isSaving}
                              className="bg-white text-black hover:bg-white/90"
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : currentIndex === questions.length - 1 ? (
                                "Submit"
                              ) : (
                                "Next"
                              )}
                              <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

            {/* Survey stage - Chat mode */}
            {stage === "survey" && resolvedMode === "chat" && (
              <div className="space-y-4">
                {/* Chat messages */}
                <div
                  ref={chatContainerRef}
                  className="h-[400px] space-y-3 overflow-y-auto pr-2"
                >
                  {messages
                    .filter(
                      (m, i) =>
                        !(
                          i === 0 &&
                          m.content === "Hi, I'm ready to share my feedback."
                        ),
                    )
                    .map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                            message.role === "user"
                              ? "rounded-br-md bg-white text-black"
                              : "rounded-bl-md bg-white/10 text-white/90",
                          )}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      !chatInput.trim() ||
                      isChatLoading ||
                      typeof append !== "function"
                    )
                      return;
                    append({ role: "user", content: chatInput.trim() });
                    setChatInput("");
                  }}
                  className="flex items-end gap-2"
                >
                  <div className="relative flex-1">
                    <Textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (
                            chatInput.trim() &&
                            !isChatLoading &&
                            typeof append === "function"
                          ) {
                            append({
                              role: "user",
                              content: chatInput.trim(),
                            });
                            setChatInput("");
                          }
                        }
                      }}
                      placeholder="Type your response..."
                      rows={2}
                      className="resize-none border-white/10 bg-black/40 pr-12 text-white placeholder:text-white/40"
                      disabled={isChatLoading}
                    />
                    {isVoiceSupported && (
                      <div className="-translate-y-1/2 absolute top-1/2 right-2">
                        <VoiceButton
                          size="icon"
                          variant="ghost"
                          state={chatVoiceButtonState}
                          onPress={toggleChatRecording}
                          icon={<Mic className="h-4 w-4" />}
                          className="h-8 w-8 text-white/50 hover:bg-white/10 hover:text-white"
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="h-10 w-10 shrink-0 bg-white text-black hover:bg-white/90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}

            {/* Complete stage */}
            {stage === "complete" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/10 p-8 text-center"
              >
                <CheckCircle2 className="h-12 w-12 text-emerald-300" />
                <div className="space-y-2">
                  <h2 className="font-semibold text-xl">Thanks for sharing!</h2>
                  <p className="text-sm text-white/70">
                    Your responses have been saved.
                  </p>
                </div>
                {list.redirect_url && (
                  <p className="text-white/40 text-xs">Redirecting...</p>
                )}
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Powered by badge */}
        <div className="mt-6 flex justify-center">
          <a
            href="https://getUpSight.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white/40 text-xs transition hover:text-white/60"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Powered by UpSight
          </a>
        </div>
      </div>
    </div>
  );
}

function findNextQuestionIndex(
  responses: ResponseRecord,
  questions: ResearchLinkQuestion[],
) {
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const value = responses?.[question.id];
    if (!hasResponseValue(value)) {
      return index;
    }
  }
  return questions.length;
}

function hasResponseValue(value: ResponseValue) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  return false;
}

function normalizeResponseValue(value: ResponseValue): ResponseValue {
  if (Array.isArray(value))
    return value.filter(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    );
  if (typeof value === "string") return value.trim();
  return value ?? null;
}

function renderQuestionInput({
  question,
  value,
  onChange,
  voiceSupported,
  voiceButtonState,
  toggleRecording,
}: {
  question: ResearchLinkQuestion;
  value: ResponseValue;
  onChange: (value: ResponseValue) => void;
  voiceSupported?: boolean;
  voiceButtonState?: VoiceButtonState;
  toggleRecording?: () => void;
}) {
  const resolved = resolveQuestionInput(question);

  if (resolved.kind === "select") {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={(next) => onChange(next)}
      >
        <SelectTrigger className="border-white/10 bg-black/30 text-white">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {resolved.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (resolved.kind === "multi") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {resolved.options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label
              key={option}
              className="flex items-center gap-2 text-sm text-white/80"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => {
                  const nextChecked = Boolean(next);
                  onChange(
                    nextChecked
                      ? [...selected, option]
                      : selected.filter((entry) => entry !== option),
                  );
                }}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (resolved.kind === "textarea") {
    return (
      <div className="relative">
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Share your thoughts..."
          rows={4}
          className="border-white/10 bg-black/30 pr-12 text-white placeholder:text-white/40"
        />
        {voiceSupported && toggleRecording && voiceButtonState && (
          <div className="absolute top-2 right-2">
            <VoiceButton
              size="icon"
              variant="ghost"
              state={voiceButtonState}
              onPress={toggleRecording}
              icon={<Mic className="h-4 w-4" />}
              className="h-8 w-8 text-white/50 hover:bg-white/10 hover:text-white"
            />
          </div>
        )}
      </div>
    );
  }

  // Text input with voice button for text-based inputs (not email/tel)
  const showVoice =
    voiceSupported &&
    toggleRecording &&
    voiceButtonState &&
    resolved.inputType === "text";

  return (
    <div className="relative">
      <Input
        type={resolved.inputType}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type your response..."
        className={cn(
          "border-white/10 bg-black/30 text-white placeholder:text-white/40",
          showVoice && "pr-12",
        )}
      />
      {showVoice && (
        <div className="-translate-y-1/2 absolute top-1/2 right-2">
          <VoiceButton
            size="icon"
            variant="ghost"
            state={voiceButtonState}
            onPress={toggleRecording}
            icon={<Mic className="h-4 w-4" />}
            className="h-8 w-8 text-white/50 hover:bg-white/10 hover:text-white"
          />
        </div>
      )}
    </div>
  );
}

function resolveQuestionInput(question: ResearchLinkQuestion) {
  if (question.type === "single_select" && question.options?.length) {
    return { kind: "select" as const, options: question.options };
  }
  if (question.type === "multi_select" && question.options?.length) {
    return { kind: "multi" as const, options: question.options };
  }
  if (question.type === "long_text") {
    return { kind: "textarea" as const };
  }
  if (question.type === "short_text") {
    return { kind: "input" as const, inputType: "text" as const };
  }

  const prompt = question.prompt.toLowerCase();
  if (question.options?.length) {
    return { kind: "select" as const, options: question.options };
  }
  if (/email/.test(prompt)) {
    return { kind: "input" as const, inputType: "email" as const };
  }
  if (/phone|mobile|text me/.test(prompt)) {
    return { kind: "input" as const, inputType: "tel" as const };
  }
  return { kind: "textarea" as const };
}
