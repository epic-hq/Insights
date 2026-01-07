import slugify from "@sindresorhus/slugify";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { getServerClient } from "~/lib/supabase/client.server";
import { createR2PresignedUrl } from "~/utils/r2.server";
import { createRouteDefinitions } from "~/utils/route-definitions";
import { QuestionListEditor } from "../components/QuestionListEditor";
import { ResearchLinkPreview } from "../components/ResearchLinkPreview";
import { WalkthroughRecorder } from "../components/WalkthroughRecorder";
import { getResearchLinkById } from "../db";
import {
  createEmptyQuestion,
  ResearchLinkPayloadSchema,
  type ResearchLinkQuestion,
  ResearchLinkQuestionSchema,
} from "../schemas";

export const meta: MetaFunction = () => {
  return [
    { title: "Edit Ask Link" },
    { name: "description", content: "Customize your Ask link experience." },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { accountId, projectId, listId } = params;
  if (!accountId || !projectId || !listId) {
    throw new Response("Missing route parameters", { status: 400 });
  }
  const { client: supabase } = getServerClient(request);
  const { data, error } = await getResearchLinkById({
    supabase,
    accountId,
    listId,
  });
  if (error) {
    throw new Response(error.message, { status: 500 });
  }
  if (!data) {
    throw new Response("Ask link not found", { status: 404 });
  }
  const questionsResult = ResearchLinkQuestionSchema.array().safeParse(
    data.questions,
  );

  // Generate signed URL for walkthrough video if it exists
  let walkthroughSignedUrl: string | null = null;
  if (data.walkthrough_video_url) {
    const key = data.walkthrough_video_url;
    const ext = key.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "mp4"
        ? "video/mp4"
        : ext === "mov"
          ? "video/quicktime"
          : "video/webm";
    const presigned = createR2PresignedUrl({
      key,
      expiresInSeconds: 3600,
      responseContentType: contentType,
    });
    walkthroughSignedUrl = presigned?.url ?? null;
  }

  return {
    accountId,
    projectId,
    listId,
    list: data,
    questions: questionsResult.success ? questionsResult.data : [],
    walkthroughSignedUrl,
  };
}

interface EditActionData {
  errors?: Record<string, string>;
  values?: {
    name?: string;
    slug?: string;
    description?: string | null;
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    heroCtaLabel?: string | null;
    heroCtaHelper?: string | null;
    calendarUrl?: string | null;
    redirectUrl?: string | null;
    allowChat?: boolean;
    allowVoice?: boolean;
    allowVideo?: boolean;
    defaultResponseMode?: "form" | "chat" | "voice";
    isLive?: boolean;
    questions?: ResearchLinkQuestion[];
  };
  ok?: boolean;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const accountId = params.accountId;
  const listId = params.listId;
  if (!accountId || !listId) {
    throw new Response("Missing route parameters", { status: 400 });
  }

  const formData = await request.formData();
  const rawPayload = {
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
    heroTitle: formData.get("hero_title") ?? "",
    heroSubtitle: formData.get("hero_subtitle") ?? "",
    heroCtaLabel: formData.get("hero_cta_label") ?? "",
    heroCtaHelper: formData.get("hero_cta_helper") ?? "",
    calendarUrl: formData.get("calendar_url") ?? "",
    redirectUrl: formData.get("redirect_url") ?? "",
    allowChat: formData.get("allow_chat"),
    allowVoice: formData.get("allow_voice"),
    allowVideo: formData.get("allow_video"),
    defaultResponseMode: formData.get("default_response_mode"),
    isLive: formData.get("is_live"),
    questions: formData.get("questions") ?? "[]",
  };

  let fallbackQuestions: ResearchLinkQuestion[] = [];
  try {
    const candidate = JSON.parse(String(rawPayload.questions ?? "[]"));
    const validated = ResearchLinkQuestionSchema.array().safeParse(candidate);
    if (validated.success) {
      fallbackQuestions = validated.data;
    }
  } catch {
    fallbackQuestions = [];
  }

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
    return Response.json<EditActionData>(
      {
        errors: issues,
        values: {
          name: String(rawPayload.name || ""),
          slug: String(rawPayload.slug || ""),
          description: String(rawPayload.description || ""),
          heroTitle: String(rawPayload.heroTitle || ""),
          heroSubtitle: String(rawPayload.heroSubtitle || ""),
          heroCtaLabel: String(rawPayload.heroCtaLabel || ""),
          heroCtaHelper: String(rawPayload.heroCtaHelper || ""),
          calendarUrl: String(rawPayload.calendarUrl || ""),
          redirectUrl: String(rawPayload.redirectUrl || ""),
          allowChat:
            rawPayload.allowChat === "true" || rawPayload.allowChat === "on",
          defaultResponseMode:
            rawPayload.defaultResponseMode === "chat" ? "chat" : "form",
          isLive: rawPayload.isLive === "true" || rawPayload.isLive === "on",
          questions: fallbackQuestions,
        },
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const { client: supabase } = getServerClient(request);

  const { data, error } = await supabase
    .from("research_links")
    .update({
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      hero_title: payload.heroTitle,
      hero_subtitle: payload.heroSubtitle,
      hero_cta_label: payload.heroCtaLabel,
      hero_cta_helper: payload.heroCtaHelper,
      calendar_url: payload.calendarUrl,
      redirect_url: payload.redirectUrl,
      questions: payload.questions,
      allow_chat: payload.allowChat,
      allow_voice: payload.allowVoice,
      allow_video: payload.allowVideo,
      default_response_mode: payload.defaultResponseMode,
      is_live: payload.isLive,
    })
    .eq("account_id", accountId)
    .eq("id", listId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return Response.json<EditActionData>(
        {
          errors: { slug: "That slug is already in use" },
          values: { ...payload, questions: payload.questions },
        },
        { status: 400 },
      );
    }
    return Response.json<EditActionData>(
      {
        errors: { _form: error.message },
        values: { ...payload, questions: payload.questions },
      },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json<EditActionData>(
      {
        errors: { _form: "Unable to update research link" },
        values: { ...payload, questions: payload.questions },
      },
      { status: 500 },
    );
  }

  return { ok: true, values: { ...payload, questions: payload.questions } };
}

export default function EditResearchLinkPage() {
  const {
    accountId,
    projectId,
    list,
    questions: initialQuestions,
    walkthroughSignedUrl: initialWalkthroughUrl,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<EditActionData>();
  const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [name, setName] = useState(list.name);
  const [slug, setSlug] = useState(list.slug);
  const [slugEdited, setSlugEdited] = useState(true);
  const [heroTitle, setHeroTitle] = useState(list.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(list.hero_subtitle ?? "");
  const [heroCtaLabel, setHeroCtaLabel] = useState(
    list.hero_cta_label ?? "Continue",
  );
  const [heroCtaHelper, setHeroCtaHelper] = useState(
    list.hero_cta_helper ?? "We’ll only contact you about this study",
  );
  const [calendarUrl, setCalendarUrl] = useState(list.calendar_url ?? "");
  const [redirectUrl, setRedirectUrl] = useState(list.redirect_url ?? "");
  const [allowChat, setAllowChat] = useState(Boolean(list.allow_chat));
  const [allowVoice, setAllowVoice] = useState(Boolean(list.allow_voice));
  const [allowVideo, setAllowVideo] = useState(Boolean(list.allow_video));
  const [defaultResponseMode, setDefaultResponseMode] = useState<
    "form" | "chat" | "voice"
  >((list.default_response_mode as "form" | "chat" | "voice") ?? "form");
  const [isLive, setIsLive] = useState(Boolean(list.is_live));
  const [walkthroughVideoUrl, setWalkthroughVideoUrl] = useState<string | null>(
    initialWalkthroughUrl ?? null,
  );
  const [questions, setQuestions] = useState<ResearchLinkQuestion[]>(() => {
    if (initialQuestions.length > 0) return initialQuestions;
    return [createEmptyQuestion()];
  });

  useEffect(() => {
    if (!slugEdited) {
      const nextSlug = slugify(name || "research-link", { lowercase: true });
      setSlug(nextSlug);
    }
  }, [name, slugEdited]);

  useEffect(() => {
    if (!allowChat && defaultResponseMode === "chat") {
      setDefaultResponseMode("form");
    }
    if (!allowVoice && defaultResponseMode === "voice") {
      setDefaultResponseMode("form");
    }
  }, [allowChat, allowVoice, defaultResponseMode]);

  useEffect(() => {
    if (actionData?.values?.questions) {
      setQuestions(
        actionData.values.questions.length
          ? actionData.values.questions
          : [createEmptyQuestion()],
      );
    }
  }, [actionData?.values?.questions]);

  useEffect(() => {
    if (actionData?.ok && actionData.values) {
      if (typeof actionData.values.name === "string")
        setName(actionData.values.name);
      if (typeof actionData.values.slug === "string")
        setSlug(actionData.values.slug);
      if (typeof actionData.values.heroTitle === "string")
        setHeroTitle(actionData.values.heroTitle);
      if (typeof actionData.values.heroSubtitle === "string")
        setHeroSubtitle(actionData.values.heroSubtitle);
      if (typeof actionData.values.heroCtaLabel === "string")
        setHeroCtaLabel(actionData.values.heroCtaLabel);
      if (typeof actionData.values.heroCtaHelper === "string")
        setHeroCtaHelper(actionData.values.heroCtaHelper);
      if (typeof actionData.values.calendarUrl === "string")
        setCalendarUrl(actionData.values.calendarUrl);
      if (typeof actionData.values.redirectUrl === "string")
        setRedirectUrl(actionData.values.redirectUrl);
      if (typeof actionData.values.allowChat === "boolean")
        setAllowChat(actionData.values.allowChat);
      if (typeof actionData.values.allowVoice === "boolean")
        setAllowVoice(actionData.values.allowVoice);
      if (typeof actionData.values.allowVideo === "boolean")
        setAllowVideo(actionData.values.allowVideo);
      if (typeof actionData.values.defaultResponseMode === "string") {
        const mode = actionData.values.defaultResponseMode;
        setDefaultResponseMode(
          mode === "chat" ? "chat" : mode === "voice" ? "voice" : "form",
        );
      }
      if (typeof actionData.values.isLive === "boolean")
        setIsLive(actionData.values.isLive);
    }
  }, [actionData?.ok, actionData?.values]);

  const questionsJson = useMemo(() => JSON.stringify(questions), [questions]);

  return (
    <PageContainer className="max-w-3xl space-y-4">
      <Form
        method="post"
        className="grid gap-6 lg:grid-cols-[minmax(0,400px),minmax(240px,280px)]"
      >
        <div className="space-y-4">
          {/* Alerts */}
          {actionData?.errors?._form ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to save</AlertTitle>
              <AlertDescription>{actionData.errors._form}</AlertDescription>
            </Alert>
          ) : null}
          {actionData?.ok ? (
            <Alert variant="default">
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>
                Your research link settings were updated.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Basics */}
          <div className="space-y-1.5">
            <h3 className="font-medium text-foreground/80 text-sm">Basics</h3>
            <Card>
              <CardContent className="space-y-3 py-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="name"
                      className="text-muted-foreground text-xs"
                    >
                      Internal name
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      className="h-9"
                    />
                    {actionData?.errors?.name ? (
                      <p className="text-destructive text-xs">
                        {actionData.errors.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="slug"
                      className="text-muted-foreground text-xs"
                    >
                      Public slug
                    </Label>
                    <Input
                      id="slug"
                      name="slug"
                      value={slug}
                      onChange={(event) => {
                        setSlug(event.target.value);
                        setSlugEdited(true);
                      }}
                      required
                      className="h-9"
                    />
                    {actionData?.errors?.slug ? (
                      <p className="text-destructive text-xs">
                        {actionData.errors.slug}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Link:{" "}
                  <span className="font-mono text-foreground/70">
                    {routes.ask.public(slug || "your-slug")}
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Hero Section */}
          <div className="space-y-1.5">
            <h3 className="font-medium text-foreground/80 text-sm">
              Landing Page
            </h3>
            <Card>
              <CardContent className="space-y-3 py-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="hero_title"
                    className="text-muted-foreground text-xs"
                  >
                    Headline
                  </Label>
                  <Input
                    id="hero_title"
                    name="hero_title"
                    value={heroTitle}
                    onChange={(event) => setHeroTitle(event.target.value)}
                    placeholder="Share your thoughts"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="hero_subtitle"
                    className="text-muted-foreground text-xs"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="hero_subtitle"
                    name="hero_subtitle"
                    value={heroSubtitle}
                    onChange={(event) => setHeroSubtitle(event.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="hero_cta_label"
                      className="text-muted-foreground text-xs"
                    >
                      Button text
                    </Label>
                    <Input
                      id="hero_cta_label"
                      name="hero_cta_label"
                      value={heroCtaLabel}
                      onChange={(event) => setHeroCtaLabel(event.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="hero_cta_helper"
                      className="text-muted-foreground text-xs"
                    >
                      Helper text
                    </Label>
                    <Input
                      id="hero_cta_helper"
                      name="hero_cta_helper"
                      value={heroCtaHelper}
                      onChange={(event) => setHeroCtaHelper(event.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Walkthrough Video */}
          <div className="space-y-1.5">
            <h3 className="font-medium text-foreground/80 text-sm">
              Walkthrough Video
            </h3>
            <WalkthroughRecorder
              listId={list.id}
              existingVideoUrl={walkthroughVideoUrl}
              onUploadComplete={(url) => setWalkthroughVideoUrl(url)}
              onDelete={() => setWalkthroughVideoUrl(null)}
            />
          </div>

          {/* Questions */}
          <div className="space-y-1.5">
            <h3 className="font-medium text-foreground/80 text-sm">
              Questions
            </h3>
            <Card>
              <CardContent className="py-3">
                <QuestionListEditor
                  questions={questions}
                  onChange={setQuestions}
                />
                {actionData?.errors?.questions ? (
                  <p className="mt-3 text-destructive text-xs">
                    {actionData.errors.questions}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Options */}
          <div className="space-y-1.5">
            <h3 className="font-medium text-foreground/80 text-sm">Options</h3>
            <Card>
              <CardContent className="space-y-2 py-3">
                <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">Chat mode</p>
                    <p className="truncate text-muted-foreground text-xs">
                      Let respondents talk instead of type
                    </p>
                  </div>
                  <Switch checked={allowChat} onCheckedChange={setAllowChat} />
                  <input
                    type="hidden"
                    name="allow_chat"
                    value={String(allowChat)}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border border-violet-500/30 border-dashed bg-violet-500/5 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">Voice mode</p>
                      <span className="rounded bg-violet-500/20 px-1.5 py-0.5 font-medium text-[10px] text-violet-600">
                        Experimental
                      </span>
                    </div>
                    <p className="truncate text-muted-foreground text-xs">
                      AI voice agent for conversational interviews
                    </p>
                  </div>
                  <Switch
                    checked={allowVoice}
                    onCheckedChange={setAllowVoice}
                  />
                  <input
                    type="hidden"
                    name="allow_voice"
                    value={String(allowVoice)}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">Video responses</p>
                    <p className="truncate text-muted-foreground text-xs">
                      Let respondents record video feedback
                    </p>
                  </div>
                  <Switch
                    checked={allowVideo}
                    onCheckedChange={setAllowVideo}
                  />
                  <input
                    type="hidden"
                    name="allow_video"
                    value={String(allowVideo)}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">Default mode</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant={
                        defaultResponseMode === "form" ? "default" : "ghost"
                      }
                      size="sm"
                      className="h-7 px-2.5"
                      onClick={() => setDefaultResponseMode("form")}
                    >
                      Form
                    </Button>
                    <Button
                      type="button"
                      variant={
                        defaultResponseMode === "chat" ? "default" : "ghost"
                      }
                      size="sm"
                      className="h-7 px-2.5"
                      onClick={() => setDefaultResponseMode("chat")}
                      disabled={!allowChat}
                    >
                      Chat
                    </Button>
                    <Button
                      type="button"
                      variant={
                        defaultResponseMode === "voice" ? "default" : "ghost"
                      }
                      size="sm"
                      className="h-7 px-2.5"
                      onClick={() => setDefaultResponseMode("voice")}
                      disabled={!allowVoice}
                    >
                      Voice
                    </Button>
                  </div>
                  <input
                    type="hidden"
                    name="default_response_mode"
                    value={defaultResponseMode}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">Live</p>
                    <p className="truncate text-muted-foreground text-xs">
                      Accessible via public link
                    </p>
                  </div>
                  <Switch checked={isLive} onCheckedChange={setIsLive} />
                  <input type="hidden" name="is_live" value={String(isLive)} />
                </div>
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="calendar_url"
                      className="text-muted-foreground text-xs"
                    >
                      Calendar link
                    </Label>
                    <Input
                      id="calendar_url"
                      name="calendar_url"
                      value={calendarUrl}
                      onChange={(event) => setCalendarUrl(event.target.value)}
                      placeholder="https://cal.com/..."
                      className="h-9"
                    />
                    {actionData?.errors?.calendarUrl ? (
                      <p className="text-destructive text-xs">
                        {actionData.errors.calendarUrl}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="redirect_url"
                      className="text-muted-foreground text-xs"
                    >
                      Redirect after
                    </Label>
                    <Input
                      id="redirect_url"
                      name="redirect_url"
                      value={redirectUrl}
                      onChange={(event) => setRedirectUrl(event.target.value)}
                      placeholder="https://..."
                      className="h-9"
                    />
                    {actionData?.errors?.redirectUrl ? (
                      <p className="text-destructive text-xs">
                        {actionData.errors.redirectUrl}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <input type="hidden" name="questions" value={questionsJson} />
          <div className="flex items-center justify-end gap-3">
            <Button asChild variant="outline">
              <Link to={routes.ask.index()}>Back to links</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
            <Button asChild variant="secondary">
              <Link to={routes.ask.responses(list.id)}>View responses</Link>
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <ResearchLinkPreview
            heroTitle={heroTitle}
            heroSubtitle={heroSubtitle}
            heroCtaLabel={heroCtaLabel}
            heroCtaHelper={heroCtaHelper}
            questions={questions}
          />
        </motion.div>
      </Form>
    </PageContainer>
  );
}
