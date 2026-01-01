/**
 * JourneySidebarGroup - Onboarding journey navigation in sidebar
 *
 * Shows Plan → Collect → Learn phases with sub-steps.
 * Appears during onboarding, disappears when complete.
 *
 * Design principles:
 * - Navigation lives in the sidebar
 * - Progressive disclosure - expands current phase
 * - Disappears when onboarding complete
 */

import {
  CheckCircle2,
  ChevronRight,
  FileText,
  Lightbulb,
  MessageSquareText,
  Settings,
  Target,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";

export type JourneyPhase = "plan" | "collect" | "learn";
export type PlanSubStep = "context" | "prompts";

export interface JourneyProgress {
  contextComplete: boolean;
  promptsComplete: boolean;
  hasConversations: boolean;
  hasInsights: boolean;
}

interface JourneySidebarGroupProps {
  basePath: string;
  currentPhase: JourneyPhase;
  planSubStep?: PlanSubStep;
  progress: JourneyProgress;
}

export function JourneySidebarGroup({
  basePath,
  currentPhase,
  planSubStep,
  progress,
}: JourneySidebarGroupProps) {
  const location = useLocation();
  const { contextComplete, promptsComplete, hasConversations, hasInsights } =
    progress;

  const planComplete = contextComplete && promptsComplete;
  const collectComplete = hasConversations;
  const allComplete = planComplete && collectComplete && hasInsights;

  // Don't render if onboarding is complete
  if (allComplete) return null;

  // Determine phase statuses
  const getPhaseStatus = (
    phase: JourneyPhase,
  ): "complete" | "current" | "upcoming" => {
    if (phase === "plan" && planComplete) return "complete";
    if (phase === "collect" && collectComplete) return "complete";
    if (phase === "learn" && hasInsights) return "complete";
    if (phase === currentPhase) return "current";

    const phaseOrder = { plan: 0, collect: 1, learn: 2 };
    if (phaseOrder[phase] < phaseOrder[currentPhase]) return "complete";
    return "upcoming";
  };

  const getSubStepStatus = (
    subStep: PlanSubStep,
  ): "complete" | "current" | "upcoming" => {
    if (subStep === "context" && contextComplete) return "complete";
    if (subStep === "prompts" && promptsComplete) return "complete";
    if (subStep === planSubStep) return "current";
    if (subStep === "context" && planSubStep === "prompts") return "complete";
    return "upcoming";
  };

  const planStatus = getPhaseStatus("plan");
  const collectStatus = getPhaseStatus("collect");
  const learnStatus = getPhaseStatus("learn");

  const contextStatus = getSubStepStatus("context");
  const promptsStatus = getSubStepStatus("prompts");

  // Check if current path matches
  const isContextActive = location.pathname.endsWith("/setup");
  const isPromptsActive = location.pathname.endsWith("/questions");
  const isCollectActive = location.pathname.includes("/interviews");
  const isLearnActive = location.pathname.includes("/insights");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Getting Started</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Plan Phase - Collapsible with sub-items */}
          <Collapsible
            defaultOpen={currentPhase === "plan"}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className={cn(
                    planStatus === "current" && "text-primary",
                    planStatus === "complete" &&
                      "text-green-600 dark:text-green-400",
                  )}
                >
                  {planStatus === "complete" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                  <span className="font-medium">Plan</span>
                  <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {/* Context sub-step */}
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isContextActive}
                      className={cn(
                        contextStatus === "complete" &&
                          "text-green-600 dark:text-green-400",
                      )}
                    >
                      <Link to={`${basePath}/setup`}>
                        {contextStatus === "complete" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Settings className="h-3 w-3" />
                        )}
                        <span>Context</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>

                  {/* Prompts sub-step */}
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isPromptsActive}
                      className={cn(
                        promptsStatus === "complete" &&
                          "text-green-600 dark:text-green-400",
                      )}
                    >
                      <Link to={`${basePath}/questions`}>
                        {promptsStatus === "complete" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <FileText className="h-3 w-3" />
                        )}
                        <span>Prompts</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          {/* Collect Phase */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isCollectActive}
              disabled={!planComplete}
              className={cn(
                collectStatus === "complete" &&
                  "text-green-600 dark:text-green-400",
                collectStatus === "upcoming" && "text-muted-foreground",
              )}
            >
              <Link to={`${basePath}/interviews/upload`}>
                {collectStatus === "complete" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <MessageSquareText className="h-4 w-4" />
                )}
                <span>Collect</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Learn Phase */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isLearnActive}
              disabled={!collectComplete}
              className={cn(
                learnStatus === "complete" &&
                  "text-green-600 dark:text-green-400",
                learnStatus === "upcoming" && "text-muted-foreground",
              )}
            >
              <Link to={`${basePath}/insights`}>
                {learnStatus === "complete" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Lightbulb className="h-4 w-4" />
                )}
                <span>Learn</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
