/**
 * Stepper-based Ask link creation wizard
 * 3 simple steps: Basics → Questions → Review & Share
 * Each step is a separate "page" - only one visible at a time
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  X,
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
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { getServerClient } from "~/lib/supabase/client.server";
import { cn } from "~/lib/utils";
import { createRouteDefinitions } from "~/utils/route-definitions";
import { ResearchLinkPreview } from "../components/ResearchLinkPreview";
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
    heroTitle: formData.get("hero_title") ?? "",
    heroSubtitle: formData.get("hero_subtitle") ?? "",
    heroCtaLabel: "Continue",
    heroCtaHelper: "We'll only contact you about this study",
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
      hero_title: payload.heroTitle || payload.name,
      hero_subtitle: payload.heroSubtitle || payload.description,
      hero_cta_label: payload.heroCtaLabel,
      hero_cta_helper: payload.heroCtaHelper,
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
  // Generate random slug once on mount - no manual editing needed
  const [slug] = useState(() => generateSlug());
  const [questions, setQuestions] = useState<ResearchLinkQuestion[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [copied, setCopied] = useState(false);

  // Bulk paste state for step 2
  const [bulkText, setBulkText] = useState("");

  // LLM generation
  const generateFetcher = useFetcher();
  const isGenerating = generateFetcher.state !== "idle";

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

  const handleGenerate = () => {
    generateFetcher.submit(
      {
        surveyName: name,
        surveyDescription: description,
        existingQuestions: JSON.stringify(questions.map((q) => q.prompt)),
      },
      {
        method: "POST",
        action: `/a/${accountId}/${projectId}/ask/api/generate-questions`,
      },
    );
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
                <div className="mb-4 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-violet-500" />
                  <h2 className="font-semibold text-lg">Suggested Surveys</h2>
                </div>
                <p className="mb-4 text-muted-foreground text-sm">
                  Based on your research progress, here are some surveys that
                  could help:
                </p>
                <div className="space-y-3">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="w-full rounded-lg border bg-card p-4 text-left transition-all hover:border-violet-300 hover:shadow-md dark:hover:border-violet-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-base">
                            {suggestion.title}
                          </h3>
                          <p className="mt-1 text-muted-foreground text-sm">
                            {suggestion.description}
                          </p>
                          <p className="mt-2 text-muted-foreground/80 text-xs">
                            {suggestion.reasoning}
                          </p>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <span className="text-muted-foreground text-sm">
                    Or start from scratch below
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 1: Name your Ask */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <h1 className="mb-2 font-bold text-2xl">Name your Ask</h1>
                <p className="mb-6 text-muted-foreground">
                  What are you trying to learn?
                </p>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="font-medium text-base">
                      Title
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Pricing Feedback, User Research, Beta Interest"
                      className="h-12 text-lg"
                      autoFocus
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
                          <div key={question.id} className="group flex gap-2">
                            <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
                              {index + 1}
                            </span>
                            <Input
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
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setQuestions(
                                  questions.filter((q) => q.id !== question.id),
                                )
                              }
                              className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X className="h-4 w-4" />
                            </Button>
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
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className="gap-2"
                        >
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-violet-500" />
                          )}
                          More AI
                        </Button>
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
            <input type="hidden" name="hero_title" value={name} />
            <input type="hidden" name="hero_subtitle" value={description} />
            <input type="hidden" name="questions" value={questionsJson} />
            <input type="hidden" name="is_live" value={String(isLive)} />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Preview */}
              <ResearchLinkPreview
                heroTitle={name}
                heroSubtitle={description}
                heroCtaLabel="Continue"
                heroCtaHelper="We'll only contact you about this study"
                questions={questions}
              />

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
                          Create Ask Link
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
