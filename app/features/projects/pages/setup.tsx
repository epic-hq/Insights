/**
 * Unified Project Setup Page - Voice-First Design
 *
 * Combines voice, chat, and form modes for setting up project context.
 * Entry point shows ChatGPT-like input with mode options.
 * All modes share state via ProjectSetupProvider and sync in real-time.
 *
 * Modes:
 * - Entry: SetupModeSelector with voice/chat/form options
 * - Voice: VoiceOrb with CapturedPanel (LiveKit integration)
 * - Chat: ProjectSetupChat with AI conversation
 * - Form: TypeformQuestion one-question-at-a-time flow
 */

// Soft import baml client (works even if new function not generated yet)
import { b } from "baml_client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useOutletContext,
  useRevalidator,
} from "react-router";
import type { AppLayoutOutletContext } from "~/components/layout/AppLayout";
// NOTE: ProjectGoalsScreenRedesigned (accordion form) intentionally hidden
// Keeping code until Typeform version is proven, per user decision 2025-01-05
// import ProjectGoalsScreenRedesigned from "~/features/onboarding/components/ProjectGoalsScreenRedesigned";
import {
  type CapturedField,
  CapturedPane,
} from "~/features/projects/components/CapturedPane";
import { ProjectSetupChat } from "~/features/projects/components/ProjectSetupChat";
import { SetupModeSelector } from "~/features/projects/components/SetupModeSelector";
import {
  type SetupMode,
  SetupModeToggle,
} from "~/features/projects/components/SetupModeToggle";
import { SetupVoiceChat } from "~/features/projects/components/SetupVoiceChat";
import { TypeformQuestion } from "~/features/projects/components/TypeformQuestion";
import {
  ProjectSetupProvider,
  useProjectSections,
} from "~/features/projects/contexts/project-setup-context";
import { getProjectById } from "~/features/projects/db";
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { userContext } from "~/server/user-context";

type TemplatePrefill = {
  template_key: string;
  customer_problem: string;
  target_orgs: string[];
  target_roles: string[];
  offerings: string;
  competitors: string[];
  research_goal: string;
  research_goal_details: string;
  decision_questions: string[];
  assumptions: string[];
  unknowns: string[];
  custom_instructions: string;
};

type SignupData = {
  goal?: unknown;
  challenges?: unknown;
  custom_instructions?: string;
} & Record<string, unknown>;

function fallbackPrefill(
  templateKey: string,
  projectName: string,
  signup: SignupData,
): TemplatePrefill {
  const goalFromSignup = (signup?.goal || "").toString().trim();
  const challenges = (signup?.challenges || "").toString().trim();
  const _inferredGoal =
    goalFromSignup || `Understand customer needs for ${projectName}`;

  const pre: TemplatePrefill = {
    template_key: templateKey,
    customer_problem: "",
    target_orgs: [],
    target_roles: [],
    offerings: "",
    competitors: [],
    research_goal: goalFromSignup || "",
    research_goal_details: challenges || "",
    decision_questions: [],
    assumptions: [],
    unknowns: [],
    custom_instructions: "",
  };

  return pre;
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const accountId = ctx.account_id;
  const projectId = params.projectId;

  if (!projectId) {
    throw new Response("Project ID required", { status: 400 });
  }

  // Verify project exists and user has access
  const projectResult = await getProjectById({
    supabase: ctx.supabase,
    id: projectId,
  });

  if (!projectResult.data) {
    throw new Response("Project not found", { status: 404 });
  }

  // Fetch account company context for context panel
  let accountData: {
    website_url?: string | null;
    company_description?: string | null;
    industry?: string | null;
    customer_problem?: string | null;
    offerings?: string | string[] | null;
    target_orgs?: string[] | null;
    target_roles?: string[] | null;
    competitors?: string[] | null;
  } | null = null;
  let hasCompanyContext = false;

  if (ctx.supabase) {
    const { data } = await ctx.supabase
      .schema("accounts")
      .from("accounts")
      .select(
        "website_url, company_description, industry, customer_problem, offerings, target_orgs, target_roles, competitors",
      )
      .eq("id", accountId)
      .single();

    accountData = data;
    hasCompanyContext = Boolean(
      data?.company_description ||
      data?.customer_problem ||
      (Array.isArray(data?.offerings) && data.offerings.length > 0),
    );
  }

  // Default template: Understand Customer Needs
  const template_key = "understand_customer_needs";
  const signup: SignupData = { ...(ctx.user_settings?.signup_data || {}) };

  // Allow optional prefill instructions via query param for quick re-runs
  try {
    const url = new URL(request.url);
    const extra = url.searchParams.get("prefillInstructions");
    if (extra && extra.trim().length > 0) {
      signup.custom_instructions = String(extra);
    }
  } catch {}

  let prefill: TemplatePrefill = fallbackPrefill(
    template_key,
    projectResult.data.name || "Project",
    signup,
  );
  try {
    // Try BAML-based prefill if available
    // @ts-expect-error - function may not exist until baml generate runs
    if (b?.FillProjectTemplate) {
      const filled = await b.FillProjectTemplate({
        inputs: {
          template_key,
          signup_data: JSON.stringify(signup || {}),
          project_name: projectResult.data.name || "Project",
        },
      });
      // Basic normalization/guards
      prefill = {
        template_key: filled.template_key || template_key,
        customer_problem: filled.customer_problem || prefill.customer_problem,
        target_orgs: (filled.target_orgs || []).slice(0, 3),
        target_roles: (filled.target_roles || []).slice(0, 8),
        offerings: filled.offerings || prefill.offerings,
        competitors: (filled.competitors || []).slice(0, 8),
        research_goal: filled.research_goal || prefill.research_goal,
        research_goal_details:
          filled.research_goal_details || prefill.research_goal_details,
        decision_questions: (
          filled.decision_questions || prefill.decision_questions
        ).slice(0, 6),
        assumptions: (filled.assumptions || prefill.assumptions).slice(0, 8),
        unknowns: (filled.unknowns || prefill.unknowns).slice(0, 8),
        custom_instructions:
          filled.custom_instructions || prefill.custom_instructions,
      };
    }
  } catch (_e) {
    // Ignore and use fallback
  }

  // Fetch existing project sections for initial state
  const initialSections: Record<string, unknown> = {};
  if (ctx.supabase) {
    const { data: sections } = await ctx.supabase
      .from("project_sections")
      .select("kind, content_md, meta")
      .eq("project_id", projectId);

    // Transform sections into initial data for the store
    if (sections) {
      for (const section of sections) {
        const meta = section.meta as Record<string, unknown> | null;
        // Extract value from meta or content_md
        const value = meta?.[section.kind] ?? section.content_md ?? "";
        initialSections[section.kind] = value;
      }
    }
  }

  // Get ui_preferences for mode persistence
  const uiPreferences =
    (ctx.user_settings?.ui_preferences as Record<string, unknown>) || {};

  return {
    project: projectResult.data,
    accountId,
    projectId,
    template_key,
    prefill,
    initialSections,
    hasCompanyContext,
    accountData,
    uiPreferences,
  };
}

// Hide the project status agent sidebar on this page (we have our own chat)
export const handle = {
  hideProjectStatusAgent: true,
};

/**
 * Field definitions for the CapturedPane
 * Organized by category per unified-onboarding-ui-spec.md (lines 27-43)
 */
const CAPTURED_FIELD_DEFINITIONS: CapturedField[] = [
  // Company-level fields (stored in accounts.accounts)
  {
    key: "website_url",
    label: "Website",
    value: null,
    category: "company",
    description: "Company website for auto-research",
  },
  {
    key: "company_description",
    label: "Company Description",
    value: null,
    category: "company",
    description: "What does your company do?",
  },
  {
    key: "industry",
    label: "Industry",
    value: null,
    category: "company",
  },
  {
    key: "customer_problem",
    label: "Customer Problem",
    value: null,
    category: "company",
    description: "What pain point do you solve?",
  },
  {
    key: "offerings",
    label: "Products/Services",
    value: null,
    category: "company",
    description: "What products or services do you offer?",
  },
  {
    key: "target_orgs",
    label: "Target Organizations",
    value: null,
    category: "company",
    description: "Industries or company types you serve",
  },
  {
    key: "target_roles",
    label: "Target Roles",
    value: null,
    category: "company",
    description: "Job titles of your buyers or users",
  },
  {
    key: "competitors",
    label: "Competitors",
    value: null,
    category: "company",
  },
  // Project-level fields (stored in project_sections)
  {
    key: "research_goal",
    label: "Research Goal",
    value: null,
    category: "project",
    description: "What are you trying to learn?",
    required: true,
  },
  // Assumptions removed - found to be less actionable than Unknowns
  // {
  //   key: "assumptions",
  //   label: "Assumptions",
  //   value: null,
  //   category: "project",
  //   description: "Hypotheses you want to test",
  // },
  {
    key: "unknowns",
    label: "Unknowns",
    value: null,
    category: "project",
    description: "Questions you need answered",
  },
];

/**
 * SetupCapturedPane - Wrapper that gets data from context and account
 * Must be rendered inside ProjectSetupProvider
 */
function SetupCapturedPane({
  localFields,
  accountData,
  onAskAboutField,
  onEditField,
}: {
  localFields: CapturedField[];
  accountData?: {
    website_url?: string | null;
    company_description?: string | null;
    industry?: string | null;
    customer_problem?: string | null;
    offerings?: string | string[] | null;
    target_orgs?: string[] | null;
    target_roles?: string[] | null;
    competitors?: string[] | null;
  } | null;
  onAskAboutField?: (fieldKey: string) => void;
  onEditField?: (fieldKey: string) => void;
}) {
  const sections = useProjectSections();

  // Build complete field list with values from both account and project contexts
  const capturedFields: CapturedField[] = CAPTURED_FIELD_DEFINITIONS.map(
    (fieldDef) => {
      // Check local form values first
      const localField = localFields.find((f) => f.key === fieldDef.key);
      const localValue = localField?.value;

      // Check project sections (for project-level fields)
      const sectionValue = sections[fieldDef.key as keyof typeof sections];

      // Check account data (for company-level fields)
      const accountValue =
        accountData?.[fieldDef.key as keyof typeof accountData];

      // Determine the best value: local > section > account
      let value: string | string[] | null = null;
      if (
        localValue &&
        (Array.isArray(localValue) ? localValue.length > 0 : localValue)
      ) {
        value = localValue;
      } else if (
        sectionValue &&
        (Array.isArray(sectionValue) ? sectionValue.length > 0 : sectionValue)
      ) {
        value = sectionValue as string | string[] | null;
      } else if (
        accountValue &&
        (Array.isArray(accountValue) ? accountValue.length > 0 : accountValue)
      ) {
        value = accountValue as string | string[] | null;
      }

      return {
        ...fieldDef,
        value,
      };
    },
  );

  return (
    <CapturedPane
      fields={capturedFields}
      onAskAboutField={onAskAboutField}
      onEditField={onEditField}
    />
  );
}

// Company context questions (for new accounts) - asked FIRST
const COMPANY_QUESTIONS = [
  {
    key: "website_url",
    question: "What's your company website?",
    description:
      "We'll auto-fill your company info from your website. Or skip to describe manually.",
    fieldType: "url" as const,
    required: false,
    placeholder: "https://yourcompany.com",
    hasAutoResearch: true,
  },
  {
    key: "company_description",
    question: "What does your company do?",
    description: "A brief description of your business (1-2 sentences).",
    fieldType: "textarea" as const,
    required: false,
    showSTT: true,
    skipIfPrefilled: true, // Skip if auto-filled from URL research
  },
  {
    key: "industry",
    question: "What industry are you in?",
    description: "e.g., Healthcare, SaaS, Financial Services, Retail",
    fieldType: "text" as const,
    required: false,
    skipIfPrefilled: true,
  },
  {
    key: "customer_problem",
    question: "What problem do you solve for customers?",
    description: "The main pain point or challenge you help with.",
    fieldType: "textarea" as const,
    required: false,
    showSTT: true,
    skipIfPrefilled: true,
  },
  {
    key: "target_orgs",
    question: "Who are your target customers?",
    description: "Industries or types of organizations you serve.",
    fieldType: "tags" as const,
    required: false,
    suggestionType: "organizations" as const,
    skipIfPrefilled: true,
  },
  {
    key: "target_roles",
    question: "What roles do you typically sell to or talk with?",
    description: "Job titles of your buyers or users.",
    fieldType: "tags" as const,
    required: false,
    suggestionType: "roles" as const,
    skipIfPrefilled: true,
  },
];

// Project-specific questions (asked AFTER company context)
const PROJECT_QUESTIONS = [
  {
    key: "research_goal",
    question: "What are you trying to learn from this research?",
    description:
      "Be specific about your research goals and what decisions you're trying to make.",
    fieldType: "textarea" as const,
    required: true,
    showSTT: true,
    suggestionType: "decision_questions" as const,
  },
  {
    key: "research_goal_details",
    question: "Any specific details or context to add?",
    description:
      "Help us understand your situation better - challenges, constraints, timeline, etc.",
    fieldType: "textarea" as const,
    required: false,
    showSTT: true,
  },
  {
    key: "decision_questions",
    question: "What business decisions will this research inform?",
    description: "List the key questions you need answered to make decisions.",
    fieldType: "tags" as const,
    required: false,
    suggestionType: "decision_questions" as const,
  },
  {
    key: "unknowns",
    question: "What are the key unknowns you want to explore?",
    description:
      "What don't you know yet that you need to find out from customers?",
    fieldType: "tags" as const,
    required: false,
    suggestionType: "unknowns" as const,
  },
];

// Legacy alias for compatibility
const SETUP_QUESTIONS = PROJECT_QUESTIONS;

// Captured panel items for voice/chat mode
const CAPTURED_ITEMS = [
  {
    key: "research_goal",
    label: "Research goal",
    status: "pending" as const,
    required: true,
  },
  {
    key: "customer_problem",
    label: "Customer problem",
    status: "pending" as const,
  },
  { key: "target_orgs", label: "Target audience", status: "pending" as const },
  { key: "target_roles", label: "Target roles", status: "pending" as const },
];

export default function ProjectSetupPage() {
  const {
    project,
    accountId,
    projectId,
    template_key,
    prefill,
    initialSections,
    hasCompanyContext,
    accountData,
    uiPreferences,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const routes = useProjectRoutes(`/a/${accountId}/${projectId}`);
  const outletContext = useOutletContext<AppLayoutOutletContext | undefined>();
  const companyFetcher = useFetcher();
  const researchFetcher = useFetcher();
  const preferencesFetcher = useFetcher();

  // Collapse sidebar during setup for cleaner experience
  // Extract the function reference to avoid re-running effect on every render
  const setForceSidebarCollapsed = outletContext?.setForceSidebarCollapsed;
  useEffect(() => {
    setForceSidebarCollapsed?.(true);
    return () => {
      setForceSidebarCollapsed?.(false);
    };
  }, [setForceSidebarCollapsed]);

  // Voice mode feature flag
  const { isEnabled: isVoiceEnabled } = usePostHogFeatureFlag("ffVoice");

  // Mode: default to saved preference or "chat" - skip entry screen per v2 spec
  // The conversation IS the onboarding, with tappable suggested responses
  const savedMode = (uiPreferences?.setupMode as SetupMode) || "chat";
  const [mode, setMode] = useState<SetupMode | null>(savedMode);

  // Save mode preference when it changes
  const handleModeChange = (newMode: SetupMode) => {
    // Save current form data before switching modes
    if (mode === "form") {
      if (formPhase === "company") {
        saveCompanyContext();
      } else {
        saveProjectSections();
      }
    }
    setMode(newMode);
    // Persist to user settings
    preferencesFetcher.submit(
      { key: "setupMode", value: JSON.stringify(newMode) },
      { method: "POST", action: "/api/update-ui-preference" },
    );
  };

  // Form phase: "company" (if needed) then "project"
  const [formPhase, setFormPhase] = useState<"company" | "project">(
    hasCompanyContext ? "project" : "company",
  );
  const [formStep, setFormStep] = useState(0);
  const [formDirection, setFormDirection] = useState(1);
  const [isResearching, setIsResearching] = useState(false);

  // Company context values (for new accounts)
  // Initialize from accountData if available (for editing existing context)
  const [companyValues, setCompanyValues] = useState<
    Record<string, string | string[]>
  >({
    website_url: accountData?.website_url || "",
    company_description: accountData?.company_description || "",
    industry: accountData?.industry || "",
    customer_problem: accountData?.customer_problem || "",
    target_orgs: accountData?.target_orgs || [],
    target_roles: accountData?.target_roles || [],
  });

  // Track last saved values to avoid unnecessary saves
  const lastSavedCompanyRef = useRef<Record<string, string | string[]>>({
    ...{
      website_url: accountData?.website_url || "",
      company_description: accountData?.company_description || "",
      industry: accountData?.industry || "",
      customer_problem: accountData?.customer_problem || "",
      target_orgs: accountData?.target_orgs || [],
      target_roles: accountData?.target_roles || [],
    },
  });

  // Sync companyValues when accountData changes (after revalidation)
  useEffect(() => {
    if (accountData) {
      setCompanyValues((prev) => ({
        ...prev,
        website_url: accountData.website_url || prev.website_url,
        company_description:
          accountData.company_description || prev.company_description,
        industry: accountData.industry || prev.industry,
        customer_problem: accountData.customer_problem || prev.customer_problem,
        target_orgs: accountData.target_orgs || prev.target_orgs,
        target_roles: accountData.target_roles || prev.target_roles,
      }));
    }
  }, [accountData]);

  // Project values
  const [formValues, setFormValues] = useState<
    Record<string, string | string[]>
  >(() => {
    // Initialize from prefill or initialSections
    const initial: Record<string, string | string[]> = {};
    for (const q of SETUP_QUESTIONS) {
      const existing = initialSections[q.key];
      if (existing) {
        initial[q.key] = Array.isArray(existing) ? existing : String(existing);
      } else if (q.fieldType === "tags") {
        initial[q.key] = [];
      } else {
        initial[q.key] = "";
      }
    }
    // Apply prefill values
    if (prefill.research_goal) initial.research_goal = prefill.research_goal;
    if (prefill.customer_problem)
      initial.customer_problem = prefill.customer_problem;
    if (prefill.target_orgs?.length) initial.target_orgs = prefill.target_orgs;
    if (prefill.target_roles?.length)
      initial.target_roles = prefill.target_roles;
    return initial;
  });

  // Track last saved project values
  const lastSavedProjectRef = useRef<Record<string, string | string[]>>(
    Object.fromEntries(
      Object.entries(initialSections || {}).map(([k, v]) => [
        k,
        Array.isArray(v) ? v : String(v || ""),
      ]),
    ),
  );

  // Helper to check if values have changed
  const hasValuesChanged = (
    current: Record<string, string | string[]>,
    saved: Record<string, string | string[]>,
  ): boolean => {
    for (const key of Object.keys(current)) {
      const currentVal = current[key];
      const savedVal = saved[key];
      if (Array.isArray(currentVal) && Array.isArray(savedVal)) {
        if (
          currentVal.length !== savedVal.length ||
          currentVal.some((v, i) => v !== savedVal[i])
        ) {
          return true;
        }
      } else if (currentVal !== savedVal) {
        return true;
      }
    }
    return false;
  };

  // Get current questions based on phase
  const currentQuestions =
    formPhase === "company" ? COMPANY_QUESTIONS : PROJECT_QUESTIONS;
  const currentQuestion = currentQuestions[formStep];
  const currentValues = formPhase === "company" ? companyValues : formValues;

  // Handle URL research results
  useEffect(() => {
    if (researchFetcher.state === "idle" && researchFetcher.data) {
      setIsResearching(false);
      const result = researchFetcher.data as {
        success?: boolean;
        error?: string;
        data?: {
          description?: string;
          customer_problem?: string;
          offerings?: string[];
          target_orgs?: string[];
          target_roles?: string[];
          industry?: string;
        };
      };
      if (result.success && result.data) {
        // Auto-fill company values from research
        setCompanyValues((prev) => ({
          ...prev,
          company_description:
            result.data?.description || prev.company_description,
          customer_problem:
            result.data?.customer_problem || prev.customer_problem,
          industry: result.data?.industry || prev.industry,
          target_orgs: result.data?.target_orgs || prev.target_orgs,
          target_roles: result.data?.target_roles || prev.target_roles,
        }));
      }
    }
  }, [researchFetcher.state, researchFetcher.data]);

  // Research company website
  const handleResearchWebsite = (url: string) => {
    if (!url?.trim()) return;
    setIsResearching(true);
    const formData = new FormData();
    formData.append("intent", "research_website");
    formData.append("website_url", url);
    researchFetcher.submit(formData, {
      method: "POST",
      action: `/a/${accountId}/settings`,
    });
  };

  // Save company context to account (only if changed)
  const saveCompanyContext = () => {
    if (!hasValuesChanged(companyValues, lastSavedCompanyRef.current)) {
      return; // No changes, skip save
    }
    const formData = new FormData();
    formData.append("intent", "update_company_context");
    formData.append(
      "payload",
      JSON.stringify({
        website_url: companyValues.website_url || null,
        company_description: companyValues.company_description || null,
        industry: companyValues.industry || null,
        customer_problem: companyValues.customer_problem || null,
        target_orgs: companyValues.target_orgs || null,
        target_roles: companyValues.target_roles || null,
      }),
    );
    companyFetcher.submit(formData, {
      method: "POST",
      action: `/a/${accountId}/settings`,
    });
    // Update ref after save
    lastSavedCompanyRef.current = { ...companyValues };
  };

  // Save project sections to database (only if changed)
  const saveProjectSections = async () => {
    if (!hasValuesChanged(formValues, lastSavedProjectRef.current)) {
      return; // No changes, skip save
    }

    const sections = [
      { kind: "research_goal", data: formValues.research_goal },
      { kind: "research_goal_details", data: formValues.research_goal_details },
      { kind: "decision_questions", data: formValues.decision_questions },
      // Assumptions removed - focus on Unknowns which are more actionable
      { kind: "unknowns", data: formValues.unknowns },
    ];

    for (const section of sections) {
      if (
        section.data &&
        (Array.isArray(section.data) ? section.data.length > 0 : section.data)
      ) {
        const formData = new FormData();
        formData.append("action", "save-section");
        formData.append("projectId", projectId);
        formData.append("sectionKind", section.kind);
        formData.append("sectionData", JSON.stringify(section.data));

        await fetch("/api/save-project-goals", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      }
    }

    // Update ref after save
    lastSavedProjectRef.current = { ...formValues };
  };

  // Captured panel state - temporarily disabled to simplify UI
  // const capturedPanel = useCapturedPanel(
  //   CAPTURED_ITEMS.map((item) => {
  //     const value = initialSections[item.key];
  //     const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value);
  //     return {
  //       ...item,
  //       status: hasValue ? ("complete" as const) : ("pending" as const),
  //       preview: hasValue
  //         ? Array.isArray(value)
  //           ? value.slice(0, 2).join(", ")
  //           : String(value).slice(0, 50)
  //         : undefined,
  //     };
  //   }),
  // );

  const handleNext = () => {
    // After form, go to questions step inside project context
    const dest = routes.questions.index();
    const url = dest.includes("?")
      ? `${dest}&onboarding=1`
      : `${dest}?onboarding=1`;
    navigate(url);
  };

  const handleSetupComplete = () => {
    // Navigate to dashboard after setup
    navigate(routes.dashboard());
  };

  const handleModeSelect = (selectedMode: SetupMode) => {
    handleModeChange(selectedMode);
  };

  const handleFormNext = () => {
    // Check if we need to skip questions that were pre-filled by URL research
    const getNextStep = (currentStep: number): number => {
      let nextStep = currentStep + 1;
      if (formPhase === "company") {
        // Skip questions that are already filled from URL research
        while (nextStep < COMPANY_QUESTIONS.length) {
          const nextQ = COMPANY_QUESTIONS[nextStep];
          const value = companyValues[nextQ.key];
          const hasValue = Array.isArray(value)
            ? value.length > 0
            : Boolean(value);
          if (nextQ.skipIfPrefilled && hasValue) {
            nextStep++;
          } else {
            break;
          }
        }
      }
      return nextStep;
    };

    const nextStep = getNextStep(formStep);

    // Save data on every Next click to ensure persistence
    if (formPhase === "company") {
      saveCompanyContext();
    } else {
      // Save project sections during project phase
      saveProjectSections();
    }

    if (nextStep < currentQuestions.length) {
      setFormDirection(1);
      setFormStep(nextStep);
    } else if (formPhase === "company") {
      // Company phase done - move to project phase
      setFormPhase("project");
      setFormStep(0);
      setFormDirection(1);
    } else {
      // All questions done - go to questions generation
      handleNext();
    }
  };

  const handleFormBack = () => {
    // Save current data if changed before navigating back
    if (formPhase === "company") {
      saveCompanyContext();
    } else {
      saveProjectSections();
    }

    if (formStep > 0) {
      setFormDirection(-1);
      setFormStep((s) => s - 1);
    } else if (formPhase === "project") {
      // At first project question - go back to company phase if available
      // Even if hasCompanyContext, user might want to review/edit company questions
      setFormPhase("company");
      setFormStep(COMPANY_QUESTIONS.length - 1);
      setFormDirection(-1);
    }
  };

  const handleFormSkip = () => {
    handleFormNext();
  };

  const handleFormChange = (key: string, value: string | string[]) => {
    if (formPhase === "company") {
      setCompanyValues((prev) => ({ ...prev, [key]: value }));
    } else {
      setFormValues((prev) => ({ ...prev, [key]: value }));
    }
  };

  // State to hold initial message for chat
  const [initialChatMessage, setInitialChatMessage] = useState<string | null>(
    null,
  );

  // NOTE: Suggestions are now handled directly by ContextualSuggestions component
  // inside TypeformQuestion, using the suggestionType prop

  // Calculate form mode values
  const companyStepCount = hasCompanyContext ? 0 : COMPANY_QUESTIONS.length;
  const totalSteps = companyStepCount + PROJECT_QUESTIONS.length;
  const currentStepNumber =
    formPhase === "company" ? formStep + 1 : companyStepCount + formStep + 1;
  const isUrlQuestion = currentQuestion?.key === "website_url";

  // Build captured fields from local state for form mode
  // These local values take priority over account/section data in SetupCapturedPane
  const localCapturedFields: CapturedField[] = [
    // Company fields from companyValues state
    {
      key: "website_url",
      label: "Website",
      value: companyValues.website_url as string | null,
    },
    {
      key: "company_description",
      label: "Company Description",
      value: companyValues.company_description as string | null,
    },
    {
      key: "industry",
      label: "Industry",
      value: companyValues.industry as string | null,
    },
    {
      key: "customer_problem",
      label: "Customer Problem",
      value: companyValues.customer_problem as string | null,
    },
    {
      key: "target_orgs",
      label: "Target Orgs",
      value: companyValues.target_orgs as string[] | null,
    },
    {
      key: "target_roles",
      label: "Target Roles",
      value: companyValues.target_roles as string[] | null,
    },
    // Project fields from formValues state
    {
      key: "research_goal",
      label: "Research Goal",
      value: formValues.research_goal as string | null,
      required: true,
    },
    {
      key: "unknowns",
      label: "Unknowns",
      value: formValues.unknowns as string[] | null,
    },
  ];

  // Render mode content with smooth fade transitions
  const renderModeContent = () => {
    // Entry screen - no mode selected
    if (mode === null) {
      return (
        <motion.div
          key="entry"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30"
        >
          <SetupModeSelector
            onStartChat={(message) => {
              setInitialChatMessage(message);
              handleModeChange("chat");
            }}
            onUpload={() => navigate(routes.interviews.upload())}
            onExplore={() => navigate(routes.dashboard())}
            transcribeEnabled={true}
          />
        </motion.div>
      );
    }

    // Form mode - simplified with journey header only
    if (mode === "form") {
      return (
        <motion.div
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex min-h-screen flex-col"
        >
          {/* Page header with inline mode toggle */}
          <div className="flex items-center justify-between border-b px-6 py-3">
            <h1 className="font-semibold text-lg">Project Context</h1>
            <SetupModeToggle
              mode={mode}
              onModeChange={handleModeChange}
              showVoice={isVoiceEnabled}
            />
          </div>

          {/* Main content - full width, no sidebar */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-4 py-6">
              <AnimatePresence mode="wait">
                {currentQuestion && (
                  <TypeformQuestion
                    key={`${formPhase}-${currentQuestion.key}`}
                    question={currentQuestion.question}
                    description={currentQuestion.description}
                    fieldType={currentQuestion.fieldType}
                    value={
                      currentValues[currentQuestion.key] ||
                      (currentQuestion.fieldType === "tags" ? [] : "")
                    }
                    onChange={(value) =>
                      handleFormChange(currentQuestion.key, value)
                    }
                    onNext={handleFormNext}
                    onBack={
                      // Show back button if not on very first question
                      // Either within a phase (formStep > 0) or can go back to company phase
                      formStep > 0 || formPhase === "project"
                        ? handleFormBack
                        : undefined
                    }
                    onSkip={
                      !currentQuestion.required ? handleFormSkip : undefined
                    }
                    stepNumber={currentStepNumber}
                    totalSteps={totalSteps}
                    required={currentQuestion.required}
                    showSTT={currentQuestion.showSTT}
                    direction={formDirection}
                    placeholder={
                      "placeholder" in currentQuestion
                        ? currentQuestion.placeholder
                        : undefined
                    }
                    isResearching={isUrlQuestion && isResearching}
                    onResearch={
                      isUrlQuestion
                        ? () => {
                            const url = currentValues.website_url as string;
                            if (url?.trim()) {
                              handleResearchWebsite(url);
                            }
                          }
                        : undefined
                    }
                    suggestionType={
                      "suggestionType" in currentQuestion
                        ? currentQuestion.suggestionType
                        : undefined
                    }
                    researchGoal={
                      formValues.research_goal?.toString() ||
                      companyValues.company_description?.toString() ||
                      ""
                    }
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      );
    }

    // Chat/Voice mode - simple centered layout, status shown in sidebar
    return (
      <motion.div
        key="chat"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="flex min-h-screen flex-col"
      >
        {/* Page header with inline mode toggle */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <h1 className="font-semibold text-lg">Project Context</h1>
          <SetupModeToggle
            mode={mode}
            onModeChange={handleModeChange}
            showVoice={isVoiceEnabled}
          />
        </div>

        {/* Main content - centered, status in sidebar */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {mode === "voice" ? (
              <SetupVoiceChat
                accountId={accountId}
                projectId={projectId}
                projectName={project?.name || "Project"}
                onSetupComplete={handleSetupComplete}
              />
            ) : (
              <ProjectSetupChat
                accountId={accountId}
                projectId={projectId}
                projectName={project?.name || "Project"}
                onSetupComplete={handleSetupComplete}
                initialMessage={initialChatMessage}
                onDataChanged={() => revalidator.revalidate()}
              />
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Field-specific prompts that trigger helpful AI responses
  const FIELD_PROMPTS: Record<string, string> = {
    // Company fields
    website_url:
      "I'd like to add my company website so you can learn about us.",
    company_description: "Help me describe what my company does.",
    industry: "What industry should I categorize my company in?",
    customer_problem:
      "Help me articulate the main problem we solve for customers.",
    offerings: "Help me list our main products or services.",
    target_orgs:
      "What types of organizations should I be targeting for research?",
    target_roles: "Which job roles or titles should I focus on interviewing?",
    competitors: "Who are my main competitors I should be aware of?",
    // Project fields
    research_goal:
      "Help me define my research goal - what do I want to learn from customers?",
    research_goal_details:
      "Can you help me add more detail to my research objectives?",
    decision_questions:
      "What key business questions should this research help me answer?",
    unknowns:
      "What are the key unknowns or open questions I should explore in my research? Help me identify what I don't know yet.",
  };

  // Edit prompts - for updating existing values
  const EDIT_FIELD_PROMPTS: Record<string, string> = {
    website_url: "I'd like to update my company website.",
    company_description: "I want to update my company description.",
    industry: "I'd like to change my company's industry.",
    customer_problem: "I want to refine the problem statement we solve.",
    offerings: "I'd like to update our products/services list.",
    target_orgs: "I want to change which organizations I'm targeting.",
    target_roles: "I'd like to update the roles I'm targeting for research.",
    competitors: "I want to update my list of competitors.",
    research_goal: "I'd like to refine my research goal.",
    research_goal_details:
      "I want to update the details of my research objectives.",
    decision_questions:
      "I'd like to change the business questions I'm trying to answer.",
    unknowns: "I want to update my list of unknowns to explore.",
  };

  // Handler for "Add now" button in CapturedPane
  const handleAskAboutField = (fieldKey: string) => {
    console.log(
      "[handleAskAboutField] called with:",
      fieldKey,
      "current mode:",
      mode,
    );

    // Get the field definition
    const fieldDef = CAPTURED_FIELD_DEFINITIONS.find((f) => f.key === fieldKey);
    if (!fieldDef) {
      console.log("[handleAskAboutField] field not found:", fieldKey);
      return;
    }

    // Switch to chat mode if not already there
    if (mode !== "chat") {
      console.log("[handleAskAboutField] switching to chat mode");
      handleModeChange("chat");
    }

    // Use field-specific prompt, or fallback to generic
    const prompt =
      FIELD_PROMPTS[fieldKey] ||
      `Help me fill in ${fieldDef.label.toLowerCase()}. ${fieldDef.description || ""}`;
    console.log("[handleAskAboutField] setting initialChatMessage:", prompt);
    setInitialChatMessage(prompt);
  };

  // Handler for "Edit" button in CapturedPane (for captured fields)
  const handleEditField = (fieldKey: string) => {
    console.log(
      "[handleEditField] called with:",
      fieldKey,
      "current mode:",
      mode,
    );

    const fieldDef = CAPTURED_FIELD_DEFINITIONS.find((f) => f.key === fieldKey);
    if (!fieldDef) {
      console.log("[handleEditField] field not found:", fieldKey);
      return;
    }

    // If in form mode, try to navigate to that question instead of switching to chat
    if (mode === "form") {
      // Check if field is in company questions
      const companyIndex = COMPANY_QUESTIONS.findIndex(
        (q) => q.key === fieldKey,
      );
      if (companyIndex !== -1) {
        console.log(
          "[handleEditField] navigating to company question:",
          companyIndex,
        );
        setFormPhase("company");
        setFormStep(companyIndex);
        setFormDirection(1);
        return;
      }

      // Check if field is in project questions
      const projectIndex = PROJECT_QUESTIONS.findIndex(
        (q) => q.key === fieldKey,
      );
      if (projectIndex !== -1) {
        console.log(
          "[handleEditField] navigating to project question:",
          projectIndex,
        );
        setFormPhase("project");
        setFormStep(projectIndex);
        setFormDirection(1);
        return;
      }

      // Field not in form questions - fall through to chat
      console.log("[handleEditField] field not in form, falling back to chat");
    }

    // For chat/voice mode or fields not in form: switch to chat
    if (mode !== "chat") {
      console.log("[handleEditField] switching to chat mode");
      handleModeChange("chat");
    }

    // Use edit-specific prompt
    const prompt =
      EDIT_FIELD_PROMPTS[fieldKey] ||
      `I'd like to update ${fieldDef.label.toLowerCase()}.`;
    console.log("[handleEditField] setting initialChatMessage:", prompt);
    setInitialChatMessage(prompt);
  };

  // Single return with unified AnimatePresence wrapper
  return (
    <ProjectSetupProvider
      projectId={projectId}
      initialData={initialSections as Record<string, unknown>}
    >
      <AnimatePresence mode="wait">{renderModeContent()}</AnimatePresence>
      {/* CapturedPane shows in all modes (form, chat, voice) - floats bottom-right */}
      {mode !== null && (
        <SetupCapturedPane
          localFields={localCapturedFields}
          accountData={accountData}
          onAskAboutField={handleAskAboutField}
          onEditField={handleEditField}
        />
      )}
    </ProjectSetupProvider>
  );
}
