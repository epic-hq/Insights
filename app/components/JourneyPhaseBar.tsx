/**
 * JourneyPhaseBar - Unified wayfinding for the onboarding journey
 *
 * Shows users exactly where they are: Plan → Collect → Learn
 * Plan phase has sub-steps: Context → Questions
 * Used consistently across setup, questions, and dashboard pages.
 */

import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Lightbulb,
  MessageSquareText,
  Settings,
  Target,
} from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export type JourneyPhase = "plan" | "collect" | "learn";
export type PlanSubStep = "context" | "questions";

interface JourneyPhaseBarProps {
  /** Current phase in the journey */
  currentPhase: JourneyPhase;
  /** Base path for navigation (e.g., /a/accountId/projectId) */
  basePath: string;
  /** Whether plan phase is complete (context + questions done) */
  planComplete?: boolean;
  /** Whether collect phase is complete */
  collectComplete?: boolean;
  /** Current sub-step within Plan phase */
  planSubStep?: PlanSubStep;
  /** Whether context sub-step is complete */
  contextComplete?: boolean;
  /** Whether questions sub-step is complete */
  questionsComplete?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const PHASES = [
  {
    key: "plan" as const,
    label: "Plan",
    icon: Target,
    path: "/setup",
  },
  {
    key: "collect" as const,
    label: "Collect",
    icon: MessageSquareText,
    path: "/interviews/upload",
  },
  {
    key: "learn" as const,
    label: "Learn",
    icon: Lightbulb,
    path: "/insights",
  },
];

function getPhaseStatus(
  phaseKey: JourneyPhase,
  currentPhase: JourneyPhase,
  planComplete: boolean,
  collectComplete: boolean,
): "complete" | "current" | "upcoming" {
  const phaseOrder = { plan: 0, collect: 1, learn: 2 };
  const currentIndex = phaseOrder[currentPhase];
  const phaseIndex = phaseOrder[phaseKey];

  // Mark as complete based on explicit flags or position
  if (phaseKey === "plan" && planComplete) return "complete";
  if (phaseKey === "collect" && collectComplete) return "complete";
  if (phaseKey === currentPhase) return "current";
  if (phaseIndex < currentIndex) return "complete";
  return "upcoming";
}

interface PhaseIndicatorProps {
  phase: (typeof PHASES)[number];
  status: "complete" | "current" | "upcoming";
  basePath: string;
}

function PhaseIndicator({ phase, status, basePath }: PhaseIndicatorProps) {
  const PhaseIcon = phase.icon;

  const content = (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors",
          status === "complete" &&
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          status === "current" && "bg-primary text-primary-foreground",
          status === "upcoming" && "bg-muted text-muted-foreground",
        )}
      >
        {status === "complete" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <PhaseIcon className="h-3.5 w-3.5" />
        )}
      </div>
      <span
        className={cn(
          "font-medium text-sm",
          status === "current" && "text-foreground",
          status === "complete" && "text-green-700 dark:text-green-400",
          status === "upcoming" && "text-muted-foreground",
        )}
      >
        {phase.label}
      </span>
    </div>
  );

  // Make completed and upcoming phases clickable
  if (status !== "current") {
    return (
      <Link
        to={`${basePath}${phase.path}`}
        className="transition-opacity hover:opacity-80"
      >
        {content}
      </Link>
    );
  }

  return content;
}

const PLAN_SUB_STEPS = [
  {
    key: "context" as const,
    label: "Context",
    icon: Settings,
    path: "/setup",
  },
  {
    key: "questions" as const,
    label: "Questions",
    icon: FileText,
    path: "/questions",
  },
];

function getSubStepStatus(
  subStepKey: PlanSubStep,
  currentSubStep: PlanSubStep | undefined,
  contextComplete: boolean,
  questionsComplete: boolean,
): "complete" | "current" | "upcoming" {
  if (subStepKey === "context" && contextComplete) return "complete";
  if (subStepKey === "questions" && questionsComplete) return "complete";
  if (subStepKey === currentSubStep) return "current";
  if (subStepKey === "context" && currentSubStep === "questions")
    return "complete";
  return "upcoming";
}

export function JourneyPhaseBar({
  currentPhase,
  basePath,
  planComplete = false,
  collectComplete = false,
  planSubStep,
  contextComplete = false,
  questionsComplete = false,
  className,
}: JourneyPhaseBarProps) {
  // Show sub-steps when in Plan phase
  const showPlanSubSteps = currentPhase === "plan" && !planComplete;

  return (
    <div className={cn("flex flex-col items-center gap-2 py-3", className)}>
      {/* Main phase bar */}
      <div className="flex items-center justify-center gap-3">
        {PHASES.map((phase, index) => {
          const status = getPhaseStatus(
            phase.key,
            currentPhase,
            planComplete,
            collectComplete,
          );

          return (
            <div key={phase.key} className="flex items-center gap-3">
              {index > 0 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
              )}
              <PhaseIndicator
                phase={phase}
                status={status}
                basePath={basePath}
              />
            </div>
          );
        })}
      </div>

      {/* Plan sub-steps (shown when in Plan phase) */}
      {showPlanSubSteps && (
        <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5">
          {PLAN_SUB_STEPS.map((subStep, index) => {
            const status = getSubStepStatus(
              subStep.key,
              planSubStep,
              contextComplete,
              questionsComplete,
            );
            const SubStepIcon = subStep.icon;

            const subStepContent = (
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs transition-colors",
                    status === "complete" &&
                      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                    status === "current" &&
                      "bg-primary text-primary-foreground",
                    status === "upcoming" &&
                      "bg-background text-muted-foreground",
                  )}
                >
                  {status === "complete" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <SubStepIcon className="h-3 w-3" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs",
                    status === "current" && "font-medium text-foreground",
                    status === "complete" &&
                      "font-medium text-green-700 dark:text-green-400",
                    status === "upcoming" && "text-muted-foreground",
                  )}
                >
                  {subStep.label}
                </span>
              </div>
            );

            return (
              <div key={subStep.key} className="flex items-center gap-2">
                {index > 0 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                )}
                {status !== "current" ? (
                  <Link
                    to={`${basePath}${subStep.path}`}
                    className="transition-opacity hover:opacity-80"
                  >
                    {subStepContent}
                  </Link>
                ) : (
                  subStepContent
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
