/**
 * SetupContextPanel - Real-time context display during project setup
 *
 * Shows captured data in real-time as the user progresses through onboarding.
 * Displays three sections: Company, Research, and Interview Questions.
 * Per spec: docs/features/onboarding/onboarding-spec.md
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  FileText,
  Lightbulb,
  type LucideIcon,
  Target,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface CompanyData {
  website_url?: string | null;
  company_description?: string | null;
  customer_problem?: string | null;
  target_orgs?: string[] | null;
  target_roles?: string[] | null;
}

export interface ResearchData {
  research_goal?: string;
  research_goal_details?: string;
  assumptions?: string[];
  unknowns?: string[];
}

export interface QuestionsData {
  decision_questions?: string[];
  interview_questions?: string[];
}

interface SetupContextPanelProps {
  company?: CompanyData;
  research?: ResearchData;
  questions?: QuestionsData;
  onEditCompany?: () => void;
  onEditResearch?: () => void;
  onViewQuestions?: () => void;
  onEditQuestions?: () => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

type SectionStatus = "empty" | "partial" | "complete" | "generated";

function getSectionStatus(
  section: "company" | "research" | "questions",
  data: {
    company?: CompanyData;
    research?: ResearchData;
    questions?: QuestionsData;
  },
): SectionStatus {
  if (section === "company") {
    const c = data.company;
    if (!c) return "empty";
    const hasDescription = Boolean(c.company_description);
    const hasProblem = Boolean(c.customer_problem);
    const hasOrgs = Array.isArray(c.target_orgs) && c.target_orgs.length > 0;
    const filled = [hasDescription, hasProblem, hasOrgs].filter(Boolean).length;
    if (filled === 0) return "empty";
    if (filled >= 2) return "complete";
    return "partial";
  }

  if (section === "research") {
    const r = data.research;
    if (!r) return "empty";
    const hasGoal = Boolean(r.research_goal);
    const hasUnknowns = Array.isArray(r.unknowns) && r.unknowns.length > 0;
    if (!hasGoal && !hasUnknowns) return "empty";
    if (hasGoal && hasUnknowns) return "complete";
    return "partial";
  }

  if (section === "questions") {
    const q = data.questions;
    if (!q) return "empty";
    const count =
      (q.decision_questions?.length || 0) +
      (q.interview_questions?.length || 0);
    if (count === 0) return "empty";
    return "generated";
  }

  return "empty";
}

function StatusBadge({ status }: { status: SectionStatus }) {
  if (status === "complete") {
    return (
      <span className="flex items-center gap-1 text-emerald-600 text-xs dark:text-emerald-400">
        <Check className="h-3 w-3" />
        Complete
      </span>
    );
  }
  if (status === "generated") {
    return (
      <span className="flex items-center gap-1 text-primary text-xs">
        <Zap className="h-3 w-3" />
        Generated
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="text-amber-600 text-xs dark:text-amber-400">
        In progress
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs">Not started</span>;
}

function SectionCard({
  title,
  icon: Icon,
  status,
  children,
  onEdit,
  collapsed = false,
}: {
  title: string;
  icon: LucideIcon;
  status: SectionStatus;
  children: React.ReactNode;
  onEdit?: () => void;
  /** Show collapsed checkbox-only view */
  collapsed?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  // Collapsed checkbox-style view
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex items-center gap-2.5">
          {status === "complete" || status === "generated" ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-3 w-3 text-emerald-600" />
            </div>
          ) : status === "partial" ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
          )}
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{title}</span>
          </div>
        </div>
        {hovered && status !== "empty" && (
          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    );
  }

  return (
    <div
      className="space-y-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {onEdit && hovered && status !== "empty" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              type="button"
              onClick={onEdit}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </div>
      </div>
      <div
        className={cn(
          "rounded-lg border bg-muted/30 p-3 text-sm",
          status === "empty" && "border-dashed",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SetupContextPanel({
  company,
  research,
  questions,
  onEditCompany,
  onEditResearch,
  onViewQuestions,
  onEditQuestions,
  className,
  collapsed = false,
  onToggleCollapsed,
}: SetupContextPanelProps) {
  const companyStatus = getSectionStatus("company", { company });
  const researchStatus = getSectionStatus("research", { research });
  const questionsStatus = getSectionStatus("questions", { questions });

  // Calculate overall progress
  const statusValues = { empty: 0, partial: 0.5, complete: 1, generated: 1 };
  const totalProgress =
    (statusValues[companyStatus] +
      statusValues[researchStatus] +
      statusValues[questionsStatus]) /
    3;
  const progressPercent = Math.round(totalProgress * 100);

  // Get question count - decision_questions from setup, interview_questions if available later
  // Generated research structure creates decision_questions + research_questions + interview_prompts
  const interviewCount = questions?.interview_questions?.length ?? 0;
  const decisionCount = questions?.decision_questions?.length ?? 0;
  const questionCount = interviewCount > 0 ? interviewCount : decisionCount;

  // Use checkbox-style collapsed view by default for company and research
  const useCheckboxStyle = true;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex h-fit w-80 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {/* Header with progress percentage */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex w-full items-center justify-between border-border border-b bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Your Setup</span>
          <span className="text-muted-foreground text-xs">
            {progressPercent}%
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Progress Bar */}
      <div className="h-1 w-full bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Content */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 p-4">
              {/* Company Section - Checkbox style */}
              <SectionCard
                title="Company"
                icon={Building2}
                status={companyStatus}
                onEdit={onEditCompany}
                collapsed={useCheckboxStyle}
              >
                {companyStatus === "empty" ? (
                  <p className="text-muted-foreground">
                    Share your website to auto-fill company info
                  </p>
                ) : (
                  <div className="space-y-1">
                    {company?.company_description && (
                      <p className="line-clamp-2">
                        {company.company_description}
                      </p>
                    )}
                    {company?.customer_problem && (
                      <p className="text-muted-foreground text-xs">
                        Solves: {company.customer_problem}
                      </p>
                    )}
                    {company?.target_orgs && company.target_orgs.length > 0 && (
                      <p className="text-muted-foreground text-xs">
                        For: {company.target_orgs.slice(0, 3).join(", ")}
                        {company.target_orgs.length > 3 &&
                          ` +${company.target_orgs.length - 3}`}
                      </p>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* Research Section - Checkbox style */}
              <SectionCard
                title="Research"
                icon={Target}
                status={researchStatus}
                onEdit={onEditResearch}
                collapsed={useCheckboxStyle}
              >
                {researchStatus === "empty" ? (
                  <p className="text-muted-foreground">
                    What do you want to learn from customers?
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {research?.research_goal && (
                      <div className="flex gap-1.5">
                        <span className="shrink-0 font-medium text-muted-foreground">
                          Goal:
                        </span>
                        <span className="line-clamp-2">
                          {research.research_goal}
                        </span>
                      </div>
                    )}
                    {/* Assumptions hidden - focus on Unknowns which are more actionable */}
                    {research?.unknowns && research.unknowns.length > 0 && (
                      <div className="flex gap-1.5">
                        <span className="shrink-0 font-medium text-muted-foreground">
                          Unknown:
                        </span>
                        <span className="line-clamp-1">
                          {research.unknowns[0]}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* Interview Questions Section - Checkbox style like others */}
              <SectionCard
                title="Questions"
                icon={Lightbulb}
                status={questionsStatus}
                onEdit={onViewQuestions}
                collapsed={useCheckboxStyle}
              >
                {questionsStatus === "empty" ? (
                  <p className="text-muted-foreground">Not started</p>
                ) : (
                  <div className="flex items-center justify-between">
                    <span>
                      {questionCount} question{questionCount !== 1 && "s"} ready
                    </span>
                    <div className="flex gap-2">
                      {onViewQuestions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={onViewQuestions}
                        >
                          View
                        </Button>
                      )}
                      {onEditQuestions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={onEditQuestions}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
