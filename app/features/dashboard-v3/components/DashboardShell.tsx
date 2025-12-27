/**
 * DashboardShell - State-aware layout wrapper for dashboard
 *
 * Determines dashboard state (empty/processing/active) and renders
 * the appropriate dashboard variant. Controls sidebar visibility.
 */

import { Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import type { LensSummary } from "~/features/dashboard/components/LensResultsGrid";
import { ProcessingBadge } from "~/features/dashboard/components/ProcessingBadge";
import type { Task } from "~/features/tasks/types";
import { cn } from "~/lib/utils";
import type { Insight } from "~/types";
import { ActiveDashboard } from "./ActiveDashboard";
import { OnboardingDashboard } from "./OnboardingDashboard";
import type { ProjectContext } from "./sections/ContextPanel";

export type DashboardState = "empty" | "processing" | "active";

export interface DashboardShellProps {
  /** Project name */
  projectName: string;
  /** Base path for project routes */
  projectPath: string;
  /** Total conversation count */
  conversationCount: number;
  /** Number of items currently processing */
  processingCount: number;
  /** Number of active lenses */
  activeLensCount: number;
  /** Whether goals have been set up */
  hasGoals: boolean;
  /** Whether lenses have been configured */
  hasLenses: boolean;
  /** Whether company context has been set up */
  hasCompanyContext: boolean;
  /** Project research goal text */
  researchGoal?: string;
  /** Full project context for setup progress */
  projectContext?: ProjectContext;
  /** Array of tasks */
  tasks: Task[];
  /** Array of insights */
  insights: Insight[];
  /** Array of lens summaries */
  lenses: LensSummary[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Determines the dashboard state based on data availability
 */
function getDashboardState(
  conversationCount: number,
  processingCount: number,
  _hasGoals: boolean,
): DashboardState {
  // Empty: No conversations and no processing
  if (conversationCount === 0 && processingCount === 0) {
    return "empty";
  }

  // Processing: Has items being processed
  if (processingCount > 0) {
    return "processing";
  }

  // Active: Has data
  return "active";
}

/**
 * Determines if sidebar should be shown based on state
 */
export function shouldShowSidebar(
  state: DashboardState,
  hasGoals: boolean,
): boolean {
  // Empty state without goals: Hide sidebar for cleaner onboarding
  if (state === "empty" && !hasGoals) {
    return false;
  }

  // All other states: Show sidebar
  return true;
}

export function DashboardShell({
  projectName,
  projectPath,
  conversationCount,
  processingCount,
  activeLensCount,
  hasGoals,
  hasLenses,
  hasCompanyContext,
  researchGoal,
  projectContext,
  tasks,
  insights,
  lenses,
  className,
}: DashboardShellProps) {
  const state = getDashboardState(conversationCount, processingCount, hasGoals);

  return (
    <div className={cn("py-6", className)}>
      {/* Empty State: Onboarding Dashboard */}
      {state === "empty" && (
        <OnboardingDashboard
          projectName={projectName}
          projectPath={projectPath}
          hasGoals={hasGoals}
          hasLenses={hasLenses}
          hasCompanyContext={hasCompanyContext}
          hasConversations={conversationCount > 0}
          hasAppliedLenses={lenses.some((l) => l.conversationCount > 0)}
        />
      )}

      {/* Processing State: Show compact badge + dashboard */}
      {state === "processing" && (
        <div className="space-y-6">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-semibold text-2xl text-foreground">
                {projectName}
              </h1>
              <Link
                to={`${projectPath}/settings`}
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Edit project settings"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </div>
            <ProcessingBadge processingCount={processingCount} />
          </header>

          {/* Show dashboard (partial if no data yet) */}
          {conversationCount > 0 ? (
            <ActiveDashboard
              projectName={projectName}
              projectPath={projectPath}
              tasks={tasks}
              insights={insights}
              lenses={lenses}
              researchGoal={researchGoal}
              projectContext={projectContext}
              conversationCount={conversationCount}
              activeLensCount={activeLensCount}
              hideHeader
            />
          ) : (
            <OnboardingDashboard
              projectName={projectName}
              projectPath={projectPath}
              hasGoals={hasGoals}
              hasLenses={hasLenses}
              hasCompanyContext={hasCompanyContext}
              hasConversations={false}
              hasAppliedLenses={false}
              hideHeader
            />
          )}
        </div>
      )}

      {/* Active State: Full Dashboard */}
      {state === "active" && (
        <ActiveDashboard
          projectName={projectName}
          projectPath={projectPath}
          tasks={tasks}
          insights={insights}
          lenses={lenses}
          researchGoal={researchGoal}
          projectContext={projectContext}
          conversationCount={conversationCount}
          activeLensCount={activeLensCount}
        />
      )}
    </div>
  );
}

export default DashboardShell;
