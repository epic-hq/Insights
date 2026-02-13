/**
 * WowStepGuide - Renders 3 steps for the chosen wow path.
 * Detects completion via sidebar counts, shows confetti, auto-advances.
 */

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, PartyPopper, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { ConfettiCelebration } from "~/components/ui/confetti";
import type { RouteDefinitions } from "~/utils/route-definitions";
import { cn } from "~/lib/utils";
import type { WowPath, WowSettings, WowStepConfig } from "../journey-config";
import { WOW_PATHS } from "../journey-config";

interface WowStepGuideProps {
  wowPath: WowPath;
  wowSettings: WowSettings;
  counts: Record<string, number | undefined>;
  routes: RouteDefinitions;
  onSkipToJourney: () => void;
}

export function WowStepGuide({
  wowPath,
  wowSettings,
  counts,
  routes,
  onSkipToJourney,
}: WowStepGuideProps) {
  const pathConfig = WOW_PATHS[wowPath];
  const completedSteps = wowSettings.wow_steps_completed ?? [];
  const fetcher = useFetcher();
  const [showConfetti, setShowConfetti] = useState(false);
  const [showBigCelebration, setShowBigCelebration] = useState(false);
  const prevCompletedRef = useRef<Set<number>>(new Set(completedSteps));

  // Compute live completion status for each step
  const stepStatuses = pathConfig.steps.map((step) => {
    return (counts[step.completionKey] ?? 0) > 0;
  });

  // Detect newly completed steps and fire confetti
  useEffect(() => {
    const prevCompleted = prevCompletedRef.current;
    const newlyCompleted: number[] = [];

    stepStatuses.forEach((isComplete, index) => {
      if (
        isComplete &&
        !prevCompleted.has(index) &&
        !completedSteps.includes(index)
      ) {
        newlyCompleted.push(index);
      }
    });

    if (newlyCompleted.length > 0) {
      // Persist the newly completed steps
      const allCompleted = [...new Set([...completedSteps, ...newlyCompleted])];
      fetcher.submit(
        {
          _action: "advance_wow_step",
          wow_steps_completed: JSON.stringify(allCompleted),
        },
        { method: "POST" },
      );

      // Check if all steps are now done
      const allDone = pathConfig.steps.every(
        (_, i) => stepStatuses[i] || allCompleted.includes(i),
      );

      if (allDone) {
        setShowBigCelebration(true);
      } else {
        setShowConfetti(true);
      }

      prevCompletedRef.current = new Set(allCompleted);
    }
  }, [stepStatuses, completedSteps, pathConfig.steps, fetcher]);

  // Auto-dismiss confetti after 3 seconds
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  // Polling: refetch counts every 10s when there's an incomplete step
  // that might complete async (upload processing, survey response, etc.)
  const hasIncompleteStep = stepStatuses.some((done) => !done);
  useEffect(() => {
    if (!hasIncompleteStep) return;
    // The parent page re-renders with fresh counts from useSidebarCounts
    // which already refetches on mount. We just need a lightweight poll.
    const interval = setInterval(() => {
      // Trigger a no-op form submission to revalidate loader data
      // This causes React Router to re-run the loader
      window.dispatchEvent(new Event("focus"));
    }, 10000);
    return () => clearInterval(interval);
  }, [hasIncompleteStep]);

  // Find the first incomplete step (active step)
  const activeStepIndex = stepStatuses.findIndex((done) => !done);

  const accentClasses =
    wowPath === "discover"
      ? {
          ring: "ring-blue-500/20",
          activeBorder: "border-blue-500",
          activeBg: "bg-blue-50 dark:bg-blue-950/30",
          badge:
            "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
        }
      : {
          ring: "ring-amber-500/20",
          activeBorder: "border-amber-500",
          activeBg: "bg-amber-50 dark:bg-amber-950/30",
          badge:
            "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
        };

  if (showBigCelebration) {
    return (
      <div className="relative flex min-h-full w-full items-center justify-center bg-background px-4 py-12">
        <ConfettiCelebration particleCount={100} />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.2,
            }}
            className="mx-auto mb-6"
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary to-primary/70 shadow-lg shadow-primary/25">
              <PartyPopper className="h-10 w-10 text-primary-foreground" />
            </div>
          </motion.div>
          <h2 className="font-bold text-2xl tracking-tight">You're ready!</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            You've seen what UpSight can do. Now explore the full journey.
          </p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6"
          >
            <Button size="lg" onClick={onSkipToJourney} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Go to full journey
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full w-full items-center justify-center bg-background px-4 py-12">
      {showConfetti && <ConfettiCelebration />}

      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <span
            className={cn(
              "mb-2 inline-block rounded-full px-3 py-1 font-medium text-xs",
              accentClasses.badge,
            )}
          >
            {pathConfig.label} path
          </span>
          <h1 className="font-bold text-2xl tracking-tight">3 steps to wow</h1>
        </motion.div>

        {/* Steps */}
        <div className="space-y-3">
          <AnimatePresence mode="sync">
            {pathConfig.steps.map((step, index) => {
              const isComplete =
                stepStatuses[index] || completedSteps.includes(index);
              const isActive = index === activeStepIndex;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <StepCard
                    step={step}
                    index={index}
                    isComplete={isComplete}
                    isActive={isActive}
                    routes={routes}
                    accentClasses={accentClasses}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Skip link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <button
            type="button"
            onClick={onSkipToJourney}
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            Skip to full journey
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
  isComplete,
  isActive,
  routes,
  accentClasses,
}: {
  step: WowStepConfig;
  index: number;
  isComplete: boolean;
  isActive: boolean;
  routes: RouteDefinitions;
  accentClasses: {
    ring: string;
    activeBorder: string;
    activeBg: string;
    badge: string;
  };
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4 transition-all duration-300",
        isComplete &&
          "border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20",
        isActive &&
          cn(
            accentClasses.activeBorder,
            accentClasses.activeBg,
            "ring-2",
            accentClasses.ring,
          ),
        !isComplete && !isActive && "border-border bg-muted/20 opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Step number / check */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold text-sm transition-all",
            isComplete && "bg-green-500 text-white",
            isActive && "bg-primary text-primary-foreground",
            !isComplete && !isActive && "bg-muted text-muted-foreground",
          )}
        >
          {isComplete ? (
            <Check className="h-4 w-4" strokeWidth={3} />
          ) : (
            index + 1
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "font-semibold text-sm",
              isComplete && "text-green-700 dark:text-green-400",
            )}
          >
            {step.title}
          </h3>
          <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
            {step.description}
          </p>

          {/* CTA — only for active step */}
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-3"
            >
              <Button asChild size="sm" className="gap-1.5">
                <Link to={step.getRoute(routes)}>
                  {step.cta}
                  {step.timeHint && (
                    <span className="text-primary-foreground/60">
                      ({step.timeHint})
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
