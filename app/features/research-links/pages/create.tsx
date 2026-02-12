/**
 * Stepper-based Ask link creation wizard
 * 3 simple steps: Basics → Questions → Review & Share
 * Each step is a separate "page" - only one visible at a time
 *
 * Features voice-first survey creation - just describe what you want to learn
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Lightbulb,
  Loader2,
  MessageSquare,
  Mic,
  Pencil,
  Plus,
  Sparkles,
  Square,
  Users,
  X,
  Zap,
} from "lucide-react";
import { customAlphabet } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
} from "react-router";
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from "react-router-dom";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text";
import { getServerClient } from "~/lib/supabase/client.server";
import { cn } from "~/lib/utils";
import { createRouteDefinitions } from "~/utils/route-definitions";
import type { BranchRule } from "../branching";
import { getProjectResearchContext } from "../db";
import {
  createEmptyQuestion,
  ResearchLinkPayloadSchema,
  type ResearchLinkQuestion,
} from "../schemas";
import { getSurveyRecommendations } from "../utils/recommendation-rules";

export const meta: MetaFunction = () => {
  return [
    { title: "Create Ask Link | Upsight" },
    {
      name: "description",
      content: "Create a shareable link in under a minute",
    },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { accountId, projectId } = params;
  if (!accountId) {
    throw new Response("Account id required", { status: 400 });
  }
  if (!projectId) {
    throw new Response("Project id required", { status: 400 });
  }

  const { client: supabase } = getServerClient(request);

  // Fetch interview prompts and project context in parallel
  const [promptsResult, projectContext] = await Promise.all([
    supabase
      .from("interview_prompts")
      .select("id, text, category")
      .eq("project_id", projectId)
      .eq("is_selected", true)
      .order("selected_order", { ascending: true, nullsFirst: false }),
    getProjectResearchContext({ supabase, projectId }),
  ]);

  // Generate survey recommendations based on project state
  const suggestions = getSurveyRecommendations(projectContext);

  return {
    accountId,
    projectId,
    interviewPrompts: promptsResult.data ?? [],
    suggestions: suggestions.map((rec) => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      reasoning: rec.reasoning,
      actionType: rec.actionType,
      focusTheme: rec.focusTheme,
    })),
    projectState: {
      hasGoals: projectContext.hasGoals,
      themeCount: projectContext.themes.length,
      interviewCount: projectContext.interviewCount,
    },
  };
}

interface ActionError {
  errors: Record<string, string>;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { accountId, projectId } = params;
  if (!accountId) {
    throw new Response("Account id required", { status: 400 });
  }
  if (!projectId) {
    throw new Response("Project id required", { status: 400 });
  }

  const formData = await request.formData();
  const rawPayload = {
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
    instructions: formData.get("instructions") ?? "",
    heroTitle: formData.get("hero_title") ?? "",
    heroSubtitle: "",
    heroCtaLabel: "Continue",
    heroCtaHelper: "",
    calendarUrl: "",
    redirectUrl: "",
    allowChat: false,
    defaultResponseMode: "form",
    isLive: formData.get("is_live") === "true",
    questions: formData.get("questions") ?? "[]",
  };

  const parsed = ResearchLinkPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const issues = parsed.error.issues.reduce<Record<string, string>>(
      (acc, issue) => {
        if (issue.path.length > 0) {
          acc[issue.path[0] as string] = issue.message;
        } else {
          acc._form = issue.message;
        }
        return acc;
      },
      {},
    );
    return Response.json({ errors: issues }, { status: 400 });
  }

  const payload = parsed.data;
  const { client: supabase } = getServerClient(request);
  const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);

  const { data, error } = await supabase
    .from("research_links")
    .insert({
      account_id: accountId,
      project_id: projectId,
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      instructions: payload.instructions,
      hero_title: payload.heroTitle || payload.name,
      hero_subtitle: null,
      hero_cta_label: payload.heroCtaLabel,
      hero_cta_helper: null,
      questions: payload.questions,
      allow_chat: payload.allowChat,
      default_response_mode: payload.defaultResponseMode,
      is_live: payload.isLive,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return Response.json(
        { errors: { slug: "That URL is already in use" } },
        { status: 400 },
      );
    }
    return Response.json({ errors: { _form: error.message } }, { status: 500 });
  }

  if (!data) {
    return Response.json(
      { errors: { _form: "Unable to create Ask link" } },
      { status: 500 },
    );
  }

  return redirect(routes.ask.edit(data.id));
}

type Step = 1 | 2 | 3;

// BASE58 alphabet excludes ambiguous characters: 0, O, I, l
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const generateSlug = customAlphabet(BASE58, 6);

export default function CreateResearchLinkPage() {
  const { accountId, projectId, interviewPrompts, suggestions, projectState } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionError>();
  const navigation = useNavigation();
  const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);
  const isSubmitting = navigation.state === "submitting";

  // Show suggestions step if there are any
  const hasSuggestions = suggestions.length > 0;

  // Wizard state - start at step 0 (suggestions) if available
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  // Generate random slug once on mount - no manual editing needed
  const [slug] = useState(() => generateSlug());
  const [questions, setQuestions] = useState<ResearchLinkQuestion[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [copied, setCopied] = useState(false);

  // Track which creation mode is active to focus the UI
  const [activeInput, setActiveInput] = useState<"voice" | "form" | null>(null);

  // Bulk paste state for step 2
  const [bulkText, setBulkText] = useState("");

  // AI edit state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);

  // LLM generation
  const generateFetcher = useFetcher();
  const isGenerating = generateFetcher.state !== "idle";

  // Voice-first survey generation
  const voiceFetcher = useFetcher();
  const isGeneratingFromVoice = voiceFetcher.state !== "idle";
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [showVoiceInput, setShowVoiceInput] = useState(true);

  // Clarifications state for medium/low confidence guidelines
  type Clarification = {
    guidelineId: string;
    summary: string;
    confidence: string;
    question: string;
  };
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [showClarifications, setShowClarifications] = useState(false);

  // Speech to text hook for voice input
  const handleVoiceTranscription = useCallback(
    (text: string) => {
      setVoiceTranscript(text);
      setActiveInput("voice");
      // Auto-submit to generate survey from voice
      voiceFetcher.submit(
        { transcript: text },
        {
          method: "POST",
          action: `/a/${accountId}/${projectId}/ask/api/generate-from-voice`,
        },
      );
    },
    [voiceFetcher, accountId, projectId],
  );

  const {
    toggleRecording,
    isRecording,
    isTranscribing,
    error: voiceError,
    isSupported: isVoiceSupported,
    intensity,
  } = useSpeechToText({ onTranscription: handleVoiceTranscription });

  // Process voice-generated survey
  useEffect(() => {
    if (voiceFetcher.data && !voiceFetcher.data.error) {
      const data = voiceFetcher.data;
      if (data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (data.instructions) setInstructions(data.instructions);

      let generatedQuestions = data.questions ?? [];

      // Wire AI-generated guidelines into question branching rules
      if (generatedQuestions.length > 0 && data.guidelines?.length > 0) {
        // Clone questions so we can mutate branching
        generatedQuestions = generatedQuestions.map(
          (q: ResearchLinkQuestion) => ({ ...q }),
        );

        for (const g of data.guidelines) {
          const triggerQ = generatedQuestions[g.triggerQuestionIndex];
          if (!triggerQ) continue;

          // Determine operator based on question type
          const isSelect =
            triggerQ.type === "single_select" ||
            triggerQ.type === "multi_select";
          const operator = isSelect ? "equals" : "contains";

          const rule: BranchRule = {
            id:
              g.id ??
              `gl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            conditions: {
              logic: "and" as const,
              conditions: [
                {
                  questionId: triggerQ.id,
                  operator,
                  value: g.triggerValue,
                },
              ],
            },
            action: g.action,
            targetQuestionId: g.targetQuestionId,
            summary: g.summary,
            guidance: g.guidance,
            source: "ai_generated" as const,
            confidence: g.confidence ?? "high",
          };

          if (!triggerQ.branching) {
            triggerQ.branching = { rules: [] };
          }
          triggerQ.branching.rules.push(rule);
        }
      }

      if (generatedQuestions.length > 0) {
        setQuestions(generatedQuestions);
        hasAutoGenerated.current = true; // Prevent auto-generate on step 2
      }
      setShowVoiceInput(false);

      // Handle clarifications if any guidelines need them
      if (data.needsClarification && data.clarifications?.length > 0) {
        setClarifications(data.clarifications);
        setShowClarifications(true);
      } else {
        setClarifications([]);
        setShowClarifications(false);
      }

      // Jump to step 2 with all the generated content
      setStep(2);
    }
  }, [voiceFetcher.data]);

  // Process generated questions
  useEffect(() => {
    if (generateFetcher.data?.questions) {
      const newQuestions: ResearchLinkQuestion[] =
        generateFetcher.data.questions.map((prompt: string) => ({
          ...createEmptyQuestion(),
          prompt,
        }));
      setQuestions((prev) => [...prev, ...newQuestions]);
    }
  }, [generateFetcher.data]);

  // Auto-generate questions when entering step 2 with no questions
  const hasAutoGenerated = useRef(false);
  useEffect(() => {
    if (
      step === 2 &&
      questions.length === 0 &&
      name.trim() &&
      !isGenerating &&
      !hasAutoGenerated.current
    ) {
      hasAutoGenerated.current = true;
      handleGenerate();
    }
  }, [step, questions.length, name, isGenerating]);

  // Validation
  const step1Valid = name.trim().length > 0;
  const step2Valid =
    questions.length > 0 && questions.every((q) => q.prompt.trim().length > 0);

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${routes.ask.public(slug || "your-ask")}`;
  const questionsJson = useMemo(() => JSON.stringify(questions), [questions]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [publicUrl]);

  const handleBulkSubmit = () => {
    const lines = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) =>
        line
          .replace(/^\d+\.\s*/, "")
          .replace(/^\*\s*/, "")
          .replace(/^-\s*/, ""),
      );

    if (lines.length > 0) {
      const newQuestions: ResearchLinkQuestion[] = lines.map((prompt) => ({
        ...createEmptyQuestion(),
        prompt,
      }));
      setQuestions((prev) => [...prev, ...newQuestions]);
      setBulkText("");
    }
  };

  const handleGenerate = (customPrompt?: string) => {
    generateFetcher.submit(
      {
        surveyName: name,
        surveyDescription: description,
        existingQuestions: JSON.stringify(questions.map((q) => q.prompt)),
        customPrompt: customPrompt ?? "",
      },
      {
        method: "POST",
        action: `/a/${accountId}/${projectId}/ask/api/generate-questions`,
      },
    );
    if (customPrompt) {
      setAiPrompt("");
      setAiPopoverOpen(false);
    }
  };

  const handleImportPrompts = () => {
    if (interviewPrompts.length === 0) return;
    const imported: ResearchLinkQuestion[] = interviewPrompts.map((p) => ({
      ...createEmptyQuestion(),
      prompt: p.text,
    }));
    setQuestions((prev) => [...prev, ...imported]);
  };

  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion: (typeof suggestions)[0]) => {
    setName(suggestion.title);
    setDescription(suggestion.description);
    // Move to step 1 with pre-filled data
    setStep(1);
  };

  // Step indicator component
  const StepIndicator = () => (
    <div className="mb-8 flex items-center justify-center gap-2">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full font-semibold text-sm transition-all",
              step === s
                ? "bg-primary text-primary-foreground shadow-lg"
                : step > s
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {step > s ? <Check className="h-5 w-5" /> : s}
          </div>
          {s < 3 && (
            <div
              className={cn(
                "mx-2 h-1 w-12 rounded-full transition-all",
                step > s ? "bg-green-500" : "bg-muted",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12">
      <div className="mx-auto max-w-xl px-4">
        {/* Back link */}
        <Link
          to={routes.ask.index()}
          className="mb-6 inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Ask links
        </Link>

        {/* Step indicator */}
        <StepIndicator />

        {/* Suggestions Section - shown above Step 1 when available */}
        {hasSuggestions && step === 1 && !name && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-violet-200 bg-gradient-to-r from-violet-50/50 to-background shadow-sm dark:border-violet-800 dark:from-violet-950/30">
              <CardContent className="p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-violet-500" />
                  <h2 className="font-semibold text-base">Suggested Surveys</h2>
                </div>
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-all hover:border-violet-300 hover:shadow-md dark:hover:border-violet-700"
                    >
                      <span className="font-medium text-sm">
                        {suggestion.title}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <span className="text-muted-foreground text-xs">
                    Or start from scratch below
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* AI Personalized Surveys CTA */}
        {step === 1 && !name && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <Link to={routes.people.index()}>
              <Card className="group cursor-pointer border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-background shadow-sm transition-all hover:border-emerald-300 hover:shadow-md dark:border-emerald-800 dark:from-emerald-950/30 dark:hover:border-emerald-700">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">
                        AI Personalized Surveys
                      </h3>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 text-[10px] dark:bg-emerald-900/40 dark:text-emerald-400">
                        NEW
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Select people and generate tailored questions based on
                      their profile, ICP score, and conversation history.
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        )}

        {/* STEP 1: Name your Ask */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Voice-first CTA - the primary way to create */}
            {showVoiceInput &&
              isVoiceSupported &&
              !name &&
              activeInput !== "form" && (
                <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 shadow-xl">
                  <CardContent className="p-8">
                    <div className="text-center">
                      <h1 className="mb-2 font-bold text-2xl">
                        Create with your voice
                      </h1>
                      <p className="mx-auto mb-6 max-w-sm text-muted-foreground">
                        Just tell me what you're wanting to learn
                      </p>

                      {/* Recording states */}
                      <div className="flex flex-col items-center gap-4">
                        {isGeneratingFromVoice ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                            <p className="text-muted-foreground text-sm">
                              Creating your survey...
                            </p>
                            {voiceTranscript && (
                              <p className="max-w-sm text-muted-foreground/70 text-xs italic">
                                "{voiceTranscript.slice(0, 100)}
                                {voiceTranscript.length > 100 ? "..." : ""}"
                              </p>
                            )}
                          </div>
                        ) : isTranscribing ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
                              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                            </div>
                            <p className="text-muted-foreground text-sm">
                              Processing your request...
                            </p>
                          </div>
                        ) : isRecording ? (
                          <div className="flex flex-col items-center gap-3">
                            <button
                              type="button"
                              onClick={toggleRecording}
                              className="relative flex h-20 w-20 items-center justify-center"
                            >
                              {/* Pulsing ring animation */}
                              <motion.div
                                className="absolute inset-0 rounded-full bg-red-500/20"
                                animate={{
                                  scale: [1, 1.2 + intensity * 0.3, 1],
                                  opacity: [0.5, 0.2, 0.5],
                                }}
                                transition={{
                                  duration: 1,
                                  repeat: Number.POSITIVE_INFINITY,
                                  ease: "easeInOut",
                                }}
                              />
                              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-red-500 shadow-lg transition-transform hover:scale-105">
                                <Square className="h-6 w-6 text-white" />
                              </div>
                            </button>
                            <p className="font-medium text-red-600 text-sm">
                              Listening... tap to stop
                            </p>
                            <p className="max-w-xs text-muted-foreground/70 text-xs">
                              Describe who you want to learn from and what you
                              want to know
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveInput("voice");
                                toggleRecording();
                              }}
                              className="group relative flex h-20 w-20 items-center justify-center"
                            >
                              {/* Subtle hover ring */}
                              <div className="absolute inset-0 rounded-full bg-primary/10 transition-transform group-hover:scale-110" />
                              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-primary shadow-lg transition-all group-hover:shadow-primary/25 group-hover:shadow-xl">
                                <Mic className="h-8 w-8 text-primary-foreground" />
                              </div>
                            </button>
                            <p className="font-medium text-sm">Tap to speak</p>
                            {voiceError && (
                              <p className="text-destructive text-xs">
                                {voiceError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Divider when voice is shown and not actively engaged */}
            {showVoiceInput &&
              isVoiceSupported &&
              !name &&
              activeInput !== "voice" &&
              activeInput !== "form" && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-gradient-to-b from-background to-muted/30 px-4 text-muted-foreground">
                      or type it out
                    </span>
                  </div>
                </div>
              )}

            {/* Traditional form input — hidden when voice is actively engaged */}
            {activeInput !== "voice" && (
              <Card className="shadow-lg">
                <CardContent className="p-8">
                  {/* Only show header if voice section is hidden */}
                  {(!showVoiceInput || !isVoiceSupported || name) && (
                    <>
                      <h1 className="mb-2 font-bold text-2xl">Name your Ask</h1>
                      <p className="mb-6 text-muted-foreground">
                        What are you trying to learn?
                      </p>
                    </>
                  )}

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="font-medium text-base">
                        Title
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={() => setActiveInput("form")}
                        placeholder="e.g., Pricing Feedback, User Research, Beta Interest"
                        className="h-12 text-lg"
                        autoFocus={!isVoiceSupported}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="font-medium">
                        Description{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What should respondents know about this?"
                        rows={3}
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={!step1Valid}
                      size="lg"
                      className="w-full"
                    >
                      Next: Add Questions
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* STEP 2: Add questions */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <div className="mb-6">
                  <h1 className="mb-2 font-bold text-2xl">Add questions</h1>
                  <p className="text-muted-foreground">
                    What do you want to ask?
                  </p>
                </div>

                {/* Clarification banner when guidelines need review */}
                {showClarifications && clarifications.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mb-6 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-amber-900 dark:text-amber-100">
                          Quick question about your survey flow
                        </h3>
                        <p className="mt-1 text-amber-700 text-sm dark:text-amber-300">
                          I set up some branching logic but want to make sure I
                          got it right:
                        </p>
                        <ul className="mt-3 space-y-2">
                          {clarifications.map((c) => (
                            <li
                              key={c.guidelineId}
                              className="flex items-start gap-2 text-sm"
                            >
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                              <div>
                                <span className="font-medium text-amber-900 dark:text-amber-100">
                                  {c.summary}
                                </span>
                                <span className="ml-1 text-amber-700 dark:text-amber-300">
                                  — {c.question}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-4 flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-amber-300 bg-white text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            onClick={() => setShowClarifications(false)}
                          >
                            Looks good, continue
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-700"
                            onClick={() => {
                              setShowClarifications(false);
                            }}
                          >
                            I'll review the skip logic below
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-6">
                  {/* Primary CTA: Generate with AI when no questions */}
                  {questions.length === 0 ? (
                    <div className="space-y-4">
                      {/* Main action: Generate with AI */}
                      <Button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating || !name}
                        size="lg"
                        className="w-full gap-2"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Sparkles className="h-5 w-5" />
                        )}
                        {isGenerating
                          ? "Generating questions..."
                          : "Generate questions with AI"}
                      </Button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">
                            or write your own
                          </span>
                        </div>
                      </div>

                      {/* Secondary: paste/type */}
                      <Textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder="Type questions here, one per line..."
                        rows={4}
                        className="text-sm"
                      />
                      {bulkText.trim() && (
                        <Button
                          type="button"
                          onClick={handleBulkSubmit}
                          variant="secondary"
                          className="w-full"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add{" "}
                          {
                            bulkText.split("\n").filter((l) => l.trim()).length
                          }{" "}
                          question
                          {bulkText.split("\n").filter((l) => l.trim())
                            .length !== 1
                            ? "s"
                            : ""}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Question list */}
                      <div className="space-y-3">
                        {questions.map((question, index) => (
                          <div key={question.id} className="group space-y-1">
                            <div className="flex gap-2">
                              <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
                                {index + 1}
                              </span>
                              <div className="min-w-0 flex-1 space-y-1">
                                <Textarea
                                  value={question.prompt}
                                  onChange={(e) => {
                                    setQuestions(
                                      questions.map((q) =>
                                        q.id === question.id
                                          ? { ...q, prompt: e.target.value }
                                          : q,
                                      ),
                                    );
                                  }}
                                  placeholder="Enter your question..."
                                  className="min-h-[40px] resize-none py-2"
                                  rows={1}
                                  onInput={(e) => {
                                    const target =
                                      e.target as HTMLTextAreaElement;
                                    target.style.height = "auto";
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                />
                                {/* AI guidance hints */}
                                {question.branching?.rules &&
                                  question.branching.rules.length > 0 && (
                                    <div className="space-y-0.5 pl-1">
                                      {question.branching.rules.map((rule) => (
                                        <div
                                          key={rule.id}
                                          className="flex items-start gap-1.5 text-xs"
                                        >
                                          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" />
                                          <span className="text-muted-foreground">
                                            {rule.summary || rule.guidance}
                                            {rule.summary && rule.guidance && (
                                              <span className="text-violet-500/70">
                                                {" "}
                                                — {rule.guidance}
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setQuestions(
                                    questions.filter(
                                      (q) => q.id !== question.id,
                                    ),
                                  )
                                }
                                className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add more options */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setQuestions([...questions, createEmptyQuestion()])
                          }
                          className="flex-1"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add question
                        </Button>
                        <Popover
                          open={aiPopoverOpen}
                          onOpenChange={setAiPopoverOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={isGenerating}
                              className="gap-2"
                            >
                              {isGenerating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Pencil className="h-4 w-4 text-violet-500" />
                              )}
                              Edit with AI
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-80"
                            align="end"
                            side="top"
                          >
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <h4 className="font-medium text-sm">
                                  Edit with AI
                                </h4>
                                <p className="text-muted-foreground text-xs">
                                  Describe what questions you want to add or
                                  change.
                                </p>
                              </div>
                              <Textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="e.g., Add qualifying questions for a waitlist, Focus on pricing sensitivity, Add a question about their current solution..."
                                rows={3}
                                className="text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleGenerate(aiPrompt)}
                                  disabled={isGenerating || !aiPrompt.trim()}
                                  className="flex-1 gap-2"
                                >
                                  {isGenerating ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3.5 w-3.5" />
                                  )}
                                  Generate
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleGenerate()}
                                  disabled={isGenerating}
                                  className="gap-2"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Auto
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </>
                  )}

                  {/* Navigation */}
                  <div className="flex gap-3 border-t pt-6">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="flex-1"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!step2Valid}
                      size="lg"
                      className="flex-1"
                    >
                      Next: Review
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 3: Review & Create */}
        {step === 3 && (
          <Form method="post">
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="instructions" value={instructions} />
            <input type="hidden" name="hero_title" value={name} />
            <input type="hidden" name="questions" value={questionsJson} />
            <input type="hidden" name="is_live" value={String(isLive)} />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Share & Settings */}
              <Card className="shadow-lg">
                <CardContent className="space-y-6 p-8">
                  <div>
                    <Label className="font-medium text-base">
                      Your shareable link
                    </Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={publicUrl}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyLink}
                        className="shrink-0 gap-2"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Go live immediately</p>
                      <p className="text-muted-foreground text-sm">
                        Make the Ask link live at this URL
                      </p>
                    </div>
                    <Switch checked={isLive} onCheckedChange={setIsLive} />
                  </div>

                  {(actionData?.errors?._form || actionData?.errors?.slug) && (
                    <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
                      {actionData?.errors?._form || actionData?.errors?.slug}
                    </div>
                  )}

                  <div className="flex gap-3 border-t pt-6">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(2)}
                      className="flex-1"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      className="flex-1"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create and Edit Survey
                          <Check className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Form>
        )}
      </div>
    </div>
  );
}
