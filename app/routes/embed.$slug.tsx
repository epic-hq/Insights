/**
 * Embeddable form widget route
 *
 * Serves a lightweight, customizable version of the research link form
 * designed to be embedded on external websites via iframe or script.
 *
 * Supports multiple layout modes:
 * - inline-email: Minimal email capture (waitlist style)
 * - inline-full: Full form with video and questions
 * - email-first: Email capture that reveals more after submission
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Play,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Logo } from "~/components/branding";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { hasFeature, PLANS, type PlanId } from "~/config/plans";
import {
  type ResearchLinkQuestion,
  ResearchLinkQuestionSchema,
} from "~/features/research-links/schemas";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { cn } from "~/lib/utils";
import { createR2PresignedUrl } from "~/utils/r2.server";

const emailSchema = z.string().email();

// Layout options for the embed
type EmbedLayout =
  | "inline-email"
  | "inline-full"
  | "email-first"
  | "compact"
  | "video-first";
type EmbedTheme = "dark" | "light" | "transparent" | "auto";

// Embed configuration from URL params
interface EmbedConfig {
  layout: EmbedLayout;
  theme: EmbedTheme;
  accentColor: string;
  borderRadius: number;
  showBranding: boolean;
  buttonText: string;
  placeholder: string;
  successMessage: string;
  videoThumbnail: boolean;
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Embed" }];
  }
  return [
    { title: data.list.hero_title || data.list.name || "Embed" },
    { name: "robots", content: "noindex" },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Missing slug", { status: 400 });
  }

  const url = new URL(request.url);

  // Parse embed configuration from URL params
  const config: EmbedConfig = {
    layout: (url.searchParams.get("layout") as EmbedLayout) || "inline-email",
    theme: (url.searchParams.get("theme") as EmbedTheme) || "transparent",
    accentColor: url.searchParams.get("accent") || "#ffffff",
    borderRadius: Number.parseInt(url.searchParams.get("radius") || "12", 10),
    showBranding: url.searchParams.get("branding") !== "false",
    buttonText: url.searchParams.get("buttonText") || "",
    placeholder: url.searchParams.get("placeholder") || "you@company.com",
    successMessage: url.searchParams.get("success") || "Thanks for signing up!",
    videoThumbnail: url.searchParams.get("videoThumbnail") !== "false",
  };

  const supabase = createSupabaseAdminClient();
  const { data: list, error } = await supabase
    .from("research_links")
    .select(
      "id, name, slug, description, hero_title, hero_subtitle, instructions, hero_cta_label, hero_cta_helper, redirect_url, calendar_url, questions, allow_chat, allow_voice, allow_video, walkthrough_video_url, default_response_mode, is_live, account_id, identity_mode, identity_field",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Response(error.message, { status: 500 });
  }
  if (!list || !list.is_live) {
    throw new Response("Form not found", { status: 404 });
  }

  const questionsResult = ResearchLinkQuestionSchema.array().safeParse(
    list.questions,
  );

  // Generate signed URL for walkthrough video if it exists
  let walkthroughSignedUrl: string | null = null;
  if (list.walkthrough_video_url) {
    const key = list.walkthrough_video_url;
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

  // Get plan from billing_subscriptions (single source of truth)
  // Free tier always shows branding regardless of config
  let planId: PlanId = "free";
  const { data: subscription } = await supabase
    .schema("accounts")
    .from("billing_subscriptions")
    .select("plan_name, status")
    .eq("account_id", list.account_id)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscription?.plan_name) {
    // Map plan_name to PlanId (handle variations like "Pro", "pro", "PRO")
    const normalizedPlan = subscription.plan_name.toLowerCase() as PlanId;
    if (normalizedPlan in PLANS) {
      planId = normalizedPlan;
    }
  }

  // Enforce branding for accounts without white_label feature
  const canRemoveBranding = hasFeature(planId, "white_label");
  const finalConfig: EmbedConfig = {
    ...config,
    // Override showBranding: if they don't have white_label, always show branding
    showBranding: canRemoveBranding ? config.showBranding : true,
  };

  return {
    slug,
    list,
    questions: questionsResult.success ? questionsResult.data : [],
    walkthroughSignedUrl,
    config: finalConfig,
    canRemoveBranding,
  };
}

type IdentityMode = "anonymous" | "identified";
type IdentityField = "email" | "phone";

type LoaderData = {
  slug: string;
  canRemoveBranding: boolean;
  list: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    hero_title: string | null;
    hero_subtitle: string | null;
    instructions: string | null;
    hero_cta_label: string | null;
    hero_cta_helper: string | null;
    redirect_url: string | null;
    calendar_url: string | null;
    questions: unknown;
    allow_chat: boolean;
    allow_voice: boolean;
    allow_video: boolean;
    walkthrough_video_url: string | null;
    default_response_mode: "form" | "chat" | "voice" | null;
    is_live: boolean;
    account_id: string;
    identity_mode: IdentityMode;
    identity_field: IdentityField;
  };
  questions: Array<ResearchLinkQuestion>;
  walkthroughSignedUrl: string | null;
  config: EmbedConfig;
};

type Stage = "initial" | "form" | "complete";

type StartSignupResult = {
  responseId: string;
  responses: Record<string, unknown>;
  completed: boolean;
  personId: string | null;
};

async function startSignup(
  slug: string,
  payload: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    responseId?: string | null;
  },
): Promise<StartSignupResult> {
  const response = await fetch(`/api/research-links/${slug}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to start");
  }
  return (await response.json()) as StartSignupResult;
}

export default function EmbedPage() {
  const { slug, list, walkthroughSignedUrl, config, questions } =
    useLoaderData() as LoaderData;
  const emailId = useId();
  const [searchParams] = useSearchParams();

  const [stage, setStage] = useState<Stage>("initial");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [responseId, setResponseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [needsName, setNeedsName] = useState(false);

  const isEmailValid = emailSchema.safeParse(email).success;
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidthClass = "mx-auto w-full max-w-2xl";

  // Communicate height to parent window for iframe resizing
  useEffect(() => {
    const sendHeight = () => {
      if (typeof window === "undefined" || window.parent === window) return;
      const height =
        containerRef.current?.scrollHeight || document.body.scrollHeight;
      window.parent.postMessage({ type: "upsight:resize", height }, "*");
    };

    // Send initial height
    sendHeight();

    // Observe for changes
    const resizeObserver = new ResizeObserver(sendHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also send on window resize
    window.addEventListener("resize", sendHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", sendHeight);
    };
  }, [stage]);

  // Notify parent when loaded
  useEffect(() => {
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "upsight:loaded", slug }, "*");
    }
  }, [slug]);

  // Set transparent body background for transparent theme
  useEffect(() => {
    if (config.theme === "transparent" && typeof document !== "undefined") {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    }
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.style.background = "";
        document.body.style.background = "";
      }
    };
  }, [config.theme]);

  // Determine button text based on config and list settings
  const buttonText = config.buttonText || list.hero_cta_label || "Get Started";

  // Theme classes
  const themeClasses = useMemo(() => {
    if (config.theme === "light") {
      return {
        bg: "bg-white",
        text: "text-gray-900",
        textMuted: "text-gray-500",
        border: "border-gray-200",
        input:
          "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400",
        button: "bg-gray-900 text-white hover:bg-gray-800",
        card: "bg-gray-50",
      };
    }
    if (config.theme === "transparent") {
      // Transparent background - blends with parent page
      return {
        bg: "bg-transparent",
        text: "text-gray-900 dark:text-white",
        textMuted: "text-gray-600 dark:text-gray-400",
        border: "border-gray-300 dark:border-gray-600",
        input:
          "bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400",
        button:
          "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90",
        card: "bg-transparent",
      };
    }
    // Dark theme (default)
    return {
      bg: "bg-slate-900",
      text: "text-white",
      textMuted: "text-white/60",
      border: "border-white/10",
      input: "bg-black/40 border-white/10 text-white placeholder:text-white/40",
      button: "bg-white text-black hover:bg-white/90",
      card: "bg-white/5",
    };
  }, [config.theme]);

  // CSS custom properties for accent color
  const customStyles = useMemo(
    () => ({
      "--accent-color": config.accentColor,
      "--border-radius": `${config.borderRadius}px`,
    }),
    [config.accentColor, config.borderRadius],
  ) as React.CSSProperties;

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
      });
      setResponseId(result.responseId);

      // If no person linked, we need to collect name info (for full layouts)
      if (
        !result.personId &&
        config.layout !== "inline-email" &&
        config.layout !== "compact"
      ) {
        setNeedsName(true);
        setStage("form");
        return;
      }

      // For email-only layouts, check if there are questions to continue to
      if (config.layout === "inline-email" || config.layout === "compact") {
        // Post message to parent window for integrations
        if (typeof window !== "undefined" && window.parent !== window) {
          window.parent.postMessage(
            {
              type: "upsight:signup",
              email: email.trim(),
              responseId: result.responseId,
            },
            "*",
          );
        }

        // If there are questions, redirect parent page to full survey
        console.log("[UpSight Embed] questions:", questions?.length, questions);
        if (questions && questions.length > 0) {
          const baseUrl =
            typeof window !== "undefined" ? window.location.origin : "";
          const fullSurveyUrl = `${baseUrl}/ask/${slug}?email=${encodeURIComponent(email.trim())}&responseId=${result.responseId}`;
          console.log(
            "[UpSight Embed] Redirecting to questions:",
            fullSurveyUrl,
          );
          if (typeof window !== "undefined") {
            // Navigate the parent/top window, not the iframe
            const targetWindow = window.top || window.parent || window;
            targetWindow.location.href = fullSurveyUrl;
          }
          return;
        }

        // No questions - go straight to complete
        console.log("[UpSight Embed] No questions, showing complete");
        setStage("complete");
        return;
      }

      // For full layouts, go to form stage or complete
      if (result.completed) {
        setStage("complete");
      } else {
        setStage("form");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("Enter your first name to continue");
      return;
    }
    if (!responseId) {
      setError("Something went wrong. Please refresh and try again.");
      return;
    }

    try {
      setIsSaving(true);
      const result = await startSignup(slug, {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        responseId,
      });
      setResponseId(result.responseId);
      setNeedsName(false);

      // Redirect to full survey page (navigate parent window, not iframe)
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      const fullSurveyUrl = `${baseUrl}/ask/${slug}?email=${encodeURIComponent(email)}&responseId=${result.responseId}`;
      if (typeof window !== "undefined") {
        const targetWindow = window.top || window.parent || window;
        targetWindow.location.href = fullSurveyUrl;
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong",
      );
    } finally {
      setIsSaving(false);
    }
  }

  // Render inline email layout (waitlist style)
  function renderInlineEmail() {
    return (
      <div
        ref={containerRef}
        className={cn("p-4", themeClasses.bg, containerWidthClass)}
        style={customStyles}
      >
        <AnimatePresence mode="wait">
          {stage === "initial" && (
            <motion.form
              key="email-form"
              onSubmit={handleEmailSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Optional video thumbnail */}
              {walkthroughSignedUrl && config.videoThumbnail && !showVideo && (
                <button
                  type="button"
                  onClick={() => setShowVideo(true)}
                  className={cn(
                    "relative w-full overflow-hidden rounded-lg",
                    themeClasses.border,
                    "border",
                  )}
                  style={{ borderRadius: "var(--border-radius)" }}
                >
                  <div className="aspect-video bg-black/20">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                        <Play className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Video player */}
              {walkthroughSignedUrl && showVideo && (
                <div
                  className="relative overflow-hidden rounded-lg"
                  style={{ borderRadius: "var(--border-radius)" }}
                >
                  <video
                    src={walkthroughSignedUrl}
                    className="aspect-video w-full bg-black"
                    controls
                    autoPlay
                  />
                  <button
                    type="button"
                    onClick={() => setShowVideo(false)}
                    className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Title and description */}
              {list.hero_title && (
                <h2 className={cn("font-semibold text-lg", themeClasses.text)}>
                  {list.hero_title}
                </h2>
              )}
              {list.hero_subtitle && (
                <p className={cn("text-sm", themeClasses.textMuted)}>
                  {list.hero_subtitle}
                </p>
              )}

              {/* Email input row */}
              <div className="flex gap-2">
                <Input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={config.placeholder}
                  className={cn("flex-1", themeClasses.input)}
                  style={{ borderRadius: "var(--border-radius)" }}
                  required
                />
                <Button
                  type="submit"
                  disabled={isSaving || !isEmailValid}
                  className={cn(themeClasses.button, "shrink-0")}
                  style={{ borderRadius: "var(--border-radius)" }}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    buttonText
                  )}
                </Button>
              </div>

              {/* Helper text */}
              {list.hero_cta_helper && (
                <p
                  className={cn("text-center text-xs", themeClasses.textMuted)}
                >
                  {list.hero_cta_helper}
                </p>
              )}

              {/* Error message */}
              {error && (
                <p className="text-center text-red-500 text-xs">{error}</p>
              )}
            </motion.form>
          )}

          {stage === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-4 text-center"
            >
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className={cn("font-medium", themeClasses.text)}>
                {config.successMessage}
              </p>
              {list.redirect_url && (
                <a
                  href={list.redirect_url}
                  className={cn("text-sm underline", themeClasses.textMuted)}
                >
                  Continue
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Branding */}
        {config.showBranding && (
          <div className="mt-3 flex justify-center">
            <a
              href="https://getupsight.com"
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex items-center gap-1.5 text-[10px]",
                themeClasses.textMuted,
                "hover:opacity-80",
              )}
            >
              <Logo size={3} />
              Powered by UpSight
            </a>
          </div>
        )}
      </div>
    );
  }

  // Render compact layout (minimal, single line)
  function renderCompact() {
    return (
      <div
        ref={containerRef}
        className={cn("p-3", themeClasses.bg, containerWidthClass)}
        style={customStyles}
      >
        <AnimatePresence mode="wait">
          {stage === "initial" && (
            <motion.form
              key="compact-form"
              onSubmit={handleEmailSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Input
                id={emailId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={config.placeholder}
                className={cn("h-9 flex-1", themeClasses.input)}
                style={{ borderRadius: "var(--border-radius)" }}
                required
              />
              <Button
                type="submit"
                disabled={isSaving || !isEmailValid}
                size="sm"
                className={cn(themeClasses.button, "h-9")}
                style={{ borderRadius: "var(--border-radius)" }}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </motion.form>
          )}

          {stage === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 py-1"
            >
              <Check className="h-4 w-4 text-emerald-400" />
              <span className={cn("text-sm", themeClasses.text)}>
                {config.successMessage}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Render email-first layout (reveals more after email submission)
  function renderEmailFirst() {
    return (
      <div
        ref={containerRef}
        className={cn("p-4", themeClasses.bg, containerWidthClass)}
        style={customStyles}
      >
        <AnimatePresence mode="wait">
          {stage === "initial" && (
            <motion.form
              key="email-form"
              onSubmit={handleEmailSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Title and description */}
              {list.hero_title && (
                <h2 className={cn("font-semibold text-lg", themeClasses.text)}>
                  {list.hero_title}
                </h2>
              )}
              {list.hero_subtitle && (
                <p className={cn("text-sm", themeClasses.textMuted)}>
                  {list.hero_subtitle}
                </p>
              )}

              {/* Email input */}
              <div className="space-y-2">
                <Label htmlFor={emailId} className={themeClasses.textMuted}>
                  Email
                </Label>
                <Input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={config.placeholder}
                  className={themeClasses.input}
                  style={{ borderRadius: "var(--border-radius)" }}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isSaving || !isEmailValid}
                className={cn("w-full", themeClasses.button)}
                style={{ borderRadius: "var(--border-radius)" }}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {buttonText}
              </Button>

              {list.hero_cta_helper && (
                <p
                  className={cn("text-center text-xs", themeClasses.textMuted)}
                >
                  {list.hero_cta_helper}
                </p>
              )}

              {error && (
                <p className="text-center text-red-500 text-xs">{error}</p>
              )}
            </motion.form>
          )}

          {stage === "form" && needsName && (
            <motion.form
              key="name-form"
              onSubmit={handleNameSubmit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Video reveal */}
              {walkthroughSignedUrl && (
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ borderRadius: "var(--border-radius)" }}
                >
                  <video
                    src={walkthroughSignedUrl}
                    className="aspect-video w-full bg-black"
                    controls
                    autoPlay
                  />
                </div>
              )}

              <p className={cn("text-sm", themeClasses.textMuted)}>
                One more step! Enter your name to continue.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={themeClasses.textMuted}>First Name *</Label>
                  <Input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className={themeClasses.input}
                    style={{ borderRadius: "var(--border-radius)" }}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={themeClasses.textMuted}>Last Name</Label>
                  <Input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className={themeClasses.input}
                    style={{ borderRadius: "var(--border-radius)" }}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSaving || !firstName.trim()}
                className={cn("w-full", themeClasses.button)}
                style={{ borderRadius: "var(--border-radius)" }}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Continue to Questions
              </Button>

              {error && (
                <p className="text-center text-red-500 text-xs">{error}</p>
              )}
            </motion.form>
          )}

          {stage === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <p className={cn("font-medium text-lg", themeClasses.text)}>
                {config.successMessage}
              </p>
              {list.redirect_url && (
                <a
                  href={list.redirect_url}
                  className={cn("text-sm underline", themeClasses.textMuted)}
                >
                  Continue
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {config.showBranding && (
          <div className="mt-4 flex justify-center">
            <a
              href="https://getupsight.com"
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex items-center gap-1.5 text-[10px]",
                themeClasses.textMuted,
                "hover:opacity-80",
              )}
            >
              <Logo size={3} />
              Powered by UpSight
            </a>
          </div>
        )}
      </div>
    );
  }

  // Render full inline layout
  function renderInlineFull() {
    return (
      <div
        ref={containerRef}
        className={cn("p-4", themeClasses.bg, containerWidthClass)}
        style={customStyles}
      >
        <AnimatePresence mode="wait">
          {stage === "initial" && (
            <motion.form
              key="full-form"
              onSubmit={handleEmailSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Video */}
              {walkthroughSignedUrl && (
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ borderRadius: "var(--border-radius)" }}
                >
                  <video
                    src={walkthroughSignedUrl}
                    className="aspect-video w-full bg-black"
                    controls
                  />
                </div>
              )}

              {/* Title and description */}
              {list.hero_title && (
                <h2 className={cn("font-semibold text-lg", themeClasses.text)}>
                  {list.hero_title}
                </h2>
              )}
              {list.hero_subtitle && (
                <p className={cn("text-sm", themeClasses.textMuted)}>
                  {list.hero_subtitle}
                </p>
              )}

              {/* Email input */}
              <div className="space-y-2">
                <Label htmlFor={emailId} className={themeClasses.textMuted}>
                  Your Email
                </Label>
                <Input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={config.placeholder}
                  className={themeClasses.input}
                  style={{ borderRadius: "var(--border-radius)" }}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isSaving || !isEmailValid}
                className={cn("w-full", themeClasses.button)}
                style={{ borderRadius: "var(--border-radius)" }}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {buttonText}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              {list.hero_cta_helper && (
                <p
                  className={cn("text-center text-xs", themeClasses.textMuted)}
                >
                  {list.hero_cta_helper}
                </p>
              )}

              {error && (
                <p className="text-center text-red-500 text-xs">{error}</p>
              )}
            </motion.form>
          )}

          {stage === "form" && needsName && (
            <motion.form
              key="name-form"
              onSubmit={handleNameSubmit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className={cn("text-sm", themeClasses.textMuted)}>
                Enter your name to continue to the survey.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={themeClasses.textMuted}>First Name *</Label>
                  <Input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className={themeClasses.input}
                    style={{ borderRadius: "var(--border-radius)" }}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={themeClasses.textMuted}>Last Name</Label>
                  <Input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className={themeClasses.input}
                    style={{ borderRadius: "var(--border-radius)" }}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSaving || !firstName.trim()}
                className={cn("w-full", themeClasses.button)}
                style={{ borderRadius: "var(--border-radius)" }}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Continue
              </Button>

              {error && (
                <p className="text-center text-red-500 text-xs">{error}</p>
              )}
            </motion.form>
          )}

          {stage === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <p className={cn("font-medium text-lg", themeClasses.text)}>
                {config.successMessage}
              </p>
              {list.redirect_url && (
                <a
                  href={list.redirect_url}
                  className={cn("text-sm underline", themeClasses.textMuted)}
                >
                  Continue
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {config.showBranding && (
          <div className="mt-4 flex justify-center">
            <a
              href="https://getupsight.com"
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex items-center gap-1.5 text-[10px]",
                themeClasses.textMuted,
                "hover:opacity-80",
              )}
            >
              <Logo size={3} />
              Powered by UpSight
            </a>
          </div>
        )}
      </div>
    );
  }

  // Render video-first layout (video prominent, email below - best conversion)
  function renderVideoFirst() {
    return (
      <div
        ref={containerRef}
        className={cn("p-4", themeClasses.bg, containerWidthClass)}
        style={customStyles}
      >
        <AnimatePresence mode="wait">
          {stage === "initial" && (
            <motion.div
              key="video-first"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Video - prominent position with autoplay */}
              {walkthroughSignedUrl && (
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ borderRadius: "var(--border-radius)" }}
                >
                  <video
                    src={walkthroughSignedUrl}
                    className="aspect-video w-full bg-black"
                    controls
                    autoPlay
                    muted
                    playsInline
                  />
                </div>
              )}

              {/* Title below video */}
              {list.hero_title && (
                <h2 className={cn("font-semibold text-lg", themeClasses.text)}>
                  {list.hero_title}
                </h2>
              )}
              {list.hero_subtitle && (
                <p className={cn("text-sm", themeClasses.textMuted)}>
                  {list.hero_subtitle}
                </p>
              )}

              {/* Email capture form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    id={emailId}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={config.placeholder}
                    className={cn("flex-1", themeClasses.input)}
                    style={{ borderRadius: "var(--border-radius)" }}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={isSaving || !isEmailValid}
                    className={cn(themeClasses.button, "shrink-0")}
                    style={{ borderRadius: "var(--border-radius)" }}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      buttonText
                    )}
                  </Button>
                </div>
                {list.hero_cta_helper && (
                  <p
                    className={cn(
                      "text-center text-xs",
                      themeClasses.textMuted,
                    )}
                  >
                    {list.hero_cta_helper}
                  </p>
                )}
                {error && (
                  <p className="text-center text-red-500 text-xs">{error}</p>
                )}
              </form>
            </motion.div>
          )}

          {stage === "form" && needsName && (
            <motion.form
              key="name-form"
              onSubmit={handleNameSubmit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className={cn("text-sm", themeClasses.textMuted)}>
                One more step! Enter your name to continue.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={themeClasses.textMuted}>First Name *</Label>
                  <Input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className={themeClasses.input}
                    style={{ borderRadius: "var(--border-radius)" }}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={themeClasses.textMuted}>Last Name</Label>
                  <Input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className={themeClasses.input}
                    style={{ borderRadius: "var(--border-radius)" }}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSaving || !firstName.trim()}
                className={cn("w-full", themeClasses.button)}
                style={{ borderRadius: "var(--border-radius)" }}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Continue
              </Button>

              {error && (
                <p className="text-center text-red-500 text-xs">{error}</p>
              )}
            </motion.form>
          )}

          {stage === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <p className={cn("font-medium text-lg", themeClasses.text)}>
                {config.successMessage}
              </p>
              {list.redirect_url && (
                <a
                  href={list.redirect_url}
                  className={cn("text-sm underline", themeClasses.textMuted)}
                >
                  Continue
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {config.showBranding && (
          <div className="mt-4 flex justify-center">
            <a
              href="https://getupsight.com"
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex items-center gap-1.5 text-[10px]",
                themeClasses.textMuted,
                "hover:opacity-80",
              )}
            >
              <Logo size={3} />
              Powered by UpSight
            </a>
          </div>
        )}
      </div>
    );
  }

  // Choose layout renderer
  switch (config.layout) {
    case "compact":
      return renderCompact();
    case "email-first":
      return renderEmailFirst();
    case "inline-full":
      return renderInlineFull();
    case "video-first":
      return renderVideoFirst();
    case "inline-email":
    default:
      return renderInlineEmail();
  }
}
