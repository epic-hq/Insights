/**
 * Project Setup Page — Single Assistant, Context Card Center
 *
 * TypeformQuestion walkthrough + CapturedPane sidebar as primary center view.
 * Uppy (left panel AI assistant) handles conversational setup via the
 * project-status API which routes setup prompts to the setup agent.
 *
 * "Ask Uppy" buttons on empty fields expand the Uppy panel with pre-filled prompts.
 * "Edit" buttons on filled fields either navigate to the form step or inject
 * an edit prompt into Uppy.
 */

// Soft import baml client (works even if new function not generated yet)
import { b } from "baml_client";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Check,
  FolderKanban,
  MessageSquare,
  Pencil,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { useOptionalProjectStatusAgent } from "~/contexts/project-status-agent-context";
import { cn } from "~/lib/utils";
import {
  type CapturedField,
  CapturedPane,
} from "~/features/projects/components/CapturedPane";
import { TypeformQuestion } from "~/features/projects/components/TypeformQuestion";
import {
  ProjectSetupProvider,
  useProjectSections,
} from "~/features/projects/contexts/project-setup-context";
import { getProjectById } from "~/features/projects/db";
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

// Uppy (project status agent) is visible on this page — no hideProjectStatusAgent
export const handle = {};

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
  variant,
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
  variant?: "floating" | "sidebar";
}) {
  const sections = useProjectSections();

  // Build complete field list with values from both account and project contexts
  const capturedFields: CapturedField[] = CAPTURED_FIELD_DEFINITIONS.map(
    (fieldDef) => {
      // Check local form values first - if field exists in localFields, use it
      // (even if empty - this means user researched and result was empty)
      const localField = localFields.find((f) => f.key === fieldDef.key);
      const hasLocalField = localField !== undefined;
      const localValue = localField?.value;

      // Check project sections (for project-level fields)
      const sectionValue = sections[fieldDef.key as keyof typeof sections];

      // Check account data (for company-level fields)
      const accountValue =
        accountData?.[fieldDef.key as keyof typeof accountData];

      // Determine the best value: local > section > account
      // If local field exists (even if empty), use it - don't fall back to stale account data
      let value: string | string[] | null = null;
      if (hasLocalField) {
        // Local field exists - use it even if empty (user may have researched new URL)
        value =
          localValue &&
          (Array.isArray(localValue) ? localValue.length > 0 : localValue)
            ? localValue
            : null;
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
      variant={variant}
    />
  );
}

// Company context questions (for new accounts) - asked FIRST
const COMPANY_QUESTIONS = [
  {
    key: "website_url",
    question: "What's your company website?",
    description:
      "We'll research your company profile and auto-fill as much of your profile as possible.",
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

/**
 * ReviewSummaryCard - Shows all captured fields before navigating away (welcome flow only)
 */
function ReviewSummaryCard({
  companyValues,
  projectValues,
  onEdit,
  onConfirm,
  onBack,
}: {
  companyValues: Record<string, string | string[]>;
  projectValues: Record<string, string | string[]>;
  onEdit: (fieldKey: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const companyFields = [
    { key: "website_url", label: "Website" },
    { key: "company_description", label: "Company Description" },
    { key: "industry", label: "Industry" },
    { key: "customer_problem", label: "Customer Problem" },
    { key: "target_orgs", label: "Target Organizations" },
    { key: "target_roles", label: "Target Roles" },
  ];

  const projectFields = [
    { key: "research_goal", label: "Research Goal" },
    { key: "decision_questions", label: "Decision Questions" },
    { key: "unknowns", label: "Unknowns" },
  ];

  const formatFieldValue = (value: string | string[] | undefined) => {
    if (!value) return null;
    if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : null;
    return value.trim() || null;
  };

  const renderFieldGroup = (
    title: string,
    icon: React.ReactNode,
    fields: { key: string; label: string }[],
    values: Record<string, string | string[]>,
  ) => {
    const filledFields = fields.filter((f) => formatFieldValue(values[f.key]));
    if (filledFields.length === 0) return null;

    return (
      <div>
        <div className="mb-3 flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="font-medium text-xs uppercase tracking-wide">
            {title}
          </span>
        </div>
        <div className="space-y-2">
          {filledFields.map((field) => {
            const displayValue = formatFieldValue(values[field.key]);
            return (
              <div
                key={field.key}
                className="group flex items-start justify-between gap-3 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-muted-foreground text-xs">
                    {field.label}
                  </p>
                  <p className="mt-0.5 text-foreground text-sm leading-relaxed">
                    {displayValue}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(field.key)}
                  className="h-7 w-7 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit {field.label}</span>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="font-semibold text-xl">Review your setup</h2>
        </div>
        <p className="mt-2 text-muted-foreground text-sm">
          Here's what we've captured. Edit anything that needs changing, then
          continue.
        </p>
      </div>

      <div className="space-y-6">
        {renderFieldGroup(
          "Company",
          <Building2 className="h-4 w-4" />,
          companyFields,
          companyValues,
        )}
        {renderFieldGroup(
          "Project",
          <FolderKanban className="h-4 w-4" />,
          projectFields,
          projectValues,
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onConfirm} className="gap-2">
          Looks good, continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

export default function ProjectSetupPage() {
  const {
    accountId,
    projectId,
    prefill,
    initialSections,
    hasCompanyContext,
    accountData,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routes = useProjectRoutes(`/a/${accountId}/${projectId}`);
  const companyFetcher = useFetcher();
  const researchFetcher = useFetcher();

  // Connect to Uppy (project status agent) for "Ask Uppy" / "Edit" actions
  const uppyContext = useOptionalProjectStatusAgent();

  // Welcome flow: activated when coming from onboarding walkthrough
  const isWelcomeFlow = searchParams.get("welcome") === "1";

  // Collapse Uppy on mount — form walkthrough is the primary UI
  const hasCollapsedUppy = useRef(false);
  useEffect(() => {
    if (!hasCollapsedUppy.current && uppyContext) {
      uppyContext.setIsExpanded(false);
      hasCollapsedUppy.current = true;
    }
  }, [uppyContext]);

  // Form phase: "company" (if needed) then "project", then optionally "review" during welcome flow
  const [formPhase, setFormPhase] = useState<"company" | "project" | "review">(
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

  // Get current questions based on phase (review phase has no questions)
  const currentQuestions =
    formPhase === "company"
      ? COMPANY_QUESTIONS
      : formPhase === "project"
        ? PROJECT_QUESTIONS
        : [];
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
        const insightCount = [
          result.data?.description,
          result.data?.customer_problem,
          result.data?.industry,
          result.data?.target_orgs?.length ? result.data.target_orgs : null,
          result.data?.target_roles?.length ? result.data.target_roles : null,
        ].filter(Boolean).length;

        setCompanyValues((prev) => ({
          ...prev,
          company_description: result.data?.description || "",
          customer_problem: result.data?.customer_problem || "",
          industry: result.data?.industry || "",
          target_orgs: result.data?.target_orgs || [],
          target_roles: result.data?.target_roles || [],
        }));

        if (insightCount > 0) {
          toast.success(
            `Found ${insightCount} key insights from your website`,
            {
              description: "We've pre-filled your company context.",
            },
          );
        }
      } else if (result.error) {
        toast.error("Couldn't research website", {
          description: result.error,
        });
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
      return;
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
    lastSavedCompanyRef.current = { ...companyValues };
  };

  // Save project sections to database (only if changed)
  const saveProjectSections = async () => {
    if (!hasValuesChanged(formValues, lastSavedProjectRef.current)) {
      return;
    }

    const sections = [
      { kind: "research_goal", data: formValues.research_goal },
      { kind: "research_goal_details", data: formValues.research_goal_details },
      { kind: "decision_questions", data: formValues.decision_questions },
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

    lastSavedProjectRef.current = { ...formValues };
  };

  const handleNext = () => {
    // After form, go to questions step inside project context
    const dest = routes.questions.index();
    const url = dest.includes("?")
      ? `${dest}&onboarding=1`
      : `${dest}?onboarding=1`;
    navigate(url);
  };

  const handleFormNext = () => {
    const getNextStep = (currentStep: number): number => {
      let nextStep = currentStep + 1;
      if (formPhase === "company") {
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

    if (formPhase === "company") {
      saveCompanyContext();
    } else {
      saveProjectSections();
    }

    if (nextStep < currentQuestions.length) {
      setFormDirection(1);
      setFormStep(nextStep);
    } else if (formPhase === "company") {
      setFormPhase("project");
      setFormStep(0);
      setFormDirection(1);
    } else {
      handleNext();
    }
  };

  const handleFormBack = () => {
    if (formPhase === "company") {
      saveCompanyContext();
    } else if (formPhase === "project") {
      saveProjectSections();
    }

    if (formPhase === "review") {
      setFormPhase("project");
      setFormStep(PROJECT_QUESTIONS.length - 1);
      setFormDirection(-1);
    } else if (formStep > 0) {
      setFormDirection(-1);
      setFormStep((s) => s - 1);
    } else if (formPhase === "project") {
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

  // Calculate form step counts
  const companyStepCount = hasCompanyContext ? 0 : COMPANY_QUESTIONS.length;
  const totalSteps = companyStepCount + PROJECT_QUESTIONS.length;
  const currentStepNumber =
    formPhase === "company" ? formStep + 1 : companyStepCount + formStep + 1;
  const isUrlQuestion = currentQuestion?.key === "website_url";

  // Build captured fields from local state for CapturedPane
  const localCapturedFields: CapturedField[] = [
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

  // Field-specific prompts for Uppy
  const FIELD_PROMPTS: Record<string, string> = {
    website_url: "Help me set up my company website so you can learn about us.",
    company_description: "Help me set up my company description.",
    industry: "Help me set up my industry classification.",
    customer_problem: "Help me set up the main problem we solve for customers.",
    offerings: "Help me set up our products or services list.",
    target_orgs:
      "Help me set up which organizations I should target for research.",
    target_roles: "Help me set up which job roles to focus on interviewing.",
    competitors: "Help me set up my list of competitors.",
    research_goal:
      "Help me define my research goal - what do I want to learn from customers?",
    research_goal_details:
      "Help me set up more detail for my research objectives.",
    decision_questions:
      "Help me set up the key business questions this research should answer.",
    unknowns: "Help me set up my list of unknowns to explore in my research.",
  };

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

  // Handler for "Add now" button in CapturedPane — opens Uppy with prompt
  const handleAskAboutField = (fieldKey: string) => {
    const fieldDef = CAPTURED_FIELD_DEFINITIONS.find((f) => f.key === fieldKey);
    if (!fieldDef) return;

    const prompt =
      FIELD_PROMPTS[fieldKey] ||
      `Help me fill in ${fieldDef.label.toLowerCase()}. ${fieldDef.description || ""}`;

    if (uppyContext) {
      uppyContext.insertText(prompt);
      uppyContext.setIsExpanded(true);
    }
  };

  // Handler for "Edit" button in CapturedPane
  const handleEditField = (fieldKey: string) => {
    const fieldDef = CAPTURED_FIELD_DEFINITIONS.find((f) => f.key === fieldKey);
    if (!fieldDef) return;

    // Try to navigate to that form question step
    const companyIndex = COMPANY_QUESTIONS.findIndex((q) => q.key === fieldKey);
    if (companyIndex !== -1) {
      setFormPhase("company");
      setFormStep(companyIndex);
      setFormDirection(1);
      uppyContext?.setIsExpanded(false);
      return;
    }

    const projectIndex = PROJECT_QUESTIONS.findIndex((q) => q.key === fieldKey);
    if (projectIndex !== -1) {
      setFormPhase("project");
      setFormStep(projectIndex);
      setFormDirection(1);
      uppyContext?.setIsExpanded(false);
      return;
    }

    // Field not in form — inject edit prompt into Uppy
    const prompt =
      EDIT_FIELD_PROMPTS[fieldKey] ||
      `I'd like to update ${fieldDef.label.toLowerCase()}.`;

    if (uppyContext) {
      uppyContext.insertText(prompt);
      uppyContext.setIsExpanded(true);
    }
  };

  // Mutual exclusion: form vs chat mode based on Uppy's expanded state
  const isInChatMode = uppyContext?.isExpanded ?? false;

  // Switch to form mode — collapse Uppy
  const switchToFormMode = () => {
    uppyContext?.setIsExpanded(false);
  };

  // Switch to chat mode — expand Uppy
  const switchToChatMode = () => {
    uppyContext?.setIsExpanded(true);
  };

  // Mode toggle rendered below the form / chat content
  const modeToggle = uppyContext ? (
    <div className="flex items-center justify-center pt-6">
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
        <button
          type="button"
          onClick={switchToFormMode}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            !isInChatMode
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Form
        </button>
        <button
          type="button"
          onClick={switchToChatMode}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            isInChatMode
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </button>
      </div>
    </div>
  ) : null;

  // Build form question content
  const formQuestionContent =
    formPhase === "review" ? (
      <ReviewSummaryCard
        companyValues={companyValues}
        projectValues={formValues}
        onEdit={(fieldKey) => handleEditField(fieldKey)}
        onConfirm={handleNext}
        onBack={handleFormBack}
      />
    ) : currentQuestion ? (
      <TypeformQuestion
        key={`${formPhase}-${currentQuestion.key}`}
        question={currentQuestion.question}
        description={currentQuestion.description}
        fieldType={currentQuestion.fieldType}
        value={
          currentValues[currentQuestion.key] ||
          (currentQuestion.fieldType === "tags" ? [] : "")
        }
        onChange={(value) => handleFormChange(currentQuestion.key, value)}
        onNext={handleFormNext}
        onBack={
          formStep > 0 || formPhase === "project" ? handleFormBack : undefined
        }
        onSkip={!currentQuestion.required ? handleFormSkip : undefined}
        stepNumber={currentStepNumber}
        totalSteps={isWelcomeFlow ? totalSteps + 1 : totalSteps}
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
    ) : null;

  return (
    <ProjectSetupProvider
      projectId={projectId}
      initialData={initialSections as Record<string, unknown>}
    >
      <div className="flex min-h-screen flex-col">
        {/* Page header */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <h1 className="font-semibold text-lg">
            {isWelcomeFlow ? "Tell us about your project" : "Project Context"}
          </h1>
        </div>

        {/* Main content: form mode or chat mode */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {isInChatMode ? (
              <motion.div
                key="chat-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="mx-auto max-w-xl p-6"
              >
                <div className="mb-4 text-center">
                  <p className="text-muted-foreground text-sm">
                    Chatting with Uppy — your context card updates as you go.
                  </p>
                  {modeToggle}
                </div>
                <SetupCapturedPane
                  localFields={localCapturedFields}
                  accountData={accountData}
                  onAskAboutField={handleAskAboutField}
                  onEditField={handleEditField}
                  variant="sidebar"
                />
              </motion.div>
            ) : (
              <motion.div
                key="form-mode"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex h-full flex-col gap-6 p-6 lg:flex-row"
              >
                <div className="flex-[3] lg:max-w-2xl">
                  <AnimatePresence mode="wait">
                    {formQuestionContent}
                  </AnimatePresence>
                  {modeToggle}
                </div>
                <div className="flex-[2] lg:max-w-sm">
                  <div className="sticky top-6">
                    <SetupCapturedPane
                      localFields={localCapturedFields}
                      accountData={accountData}
                      onAskAboutField={handleAskAboutField}
                      onEditField={handleEditField}
                      variant="sidebar"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ProjectSetupProvider>
  );
}
