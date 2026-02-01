/**
 * SetupWizard - Agent-driven onboarding component
 *
 * Demonstrates generative UI concept:
 * - Agent decides which lens to recommend based on user's stated goal
 * - Shows two-pane layout (chat + captured context)
 * - Updates in real-time as user provides information
 */

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";

type LensType =
  | "bant"
  | "jtbd"
  | "empathy"
  | "problem-solution"
  | "research"
  | "support";

interface SetupWizardProps {
  /** Recommended lens based on user's goal */
  recommendedLens?: LensType;
  /** User's stated goal (from conversation) */
  userGoal?: string;
  /** Current step (0-indexed) */
  currentStep?: number;
  /** Callback when user accepts lens recommendation */
  onAcceptLens?: (lens: LensType) => void;
  /** Callback when user wants to change lens */
  onChangeLens?: () => void;
  /** Callback to continue to next step */
  onContinue?: () => void;
}

const LENS_CONFIGS: Record<
  LensType,
  {
    name: string;
    description: string;
    icon: string;
    useCase: string;
    extractionFields: string[];
  }
> = {
  bant: {
    name: "BANT Sales Qualification",
    description: "Track Budget, Authority, Need, and Timeline for each deal",
    icon: "💰",
    useCase: "Sales qualification",
    extractionFields: [
      "Budget range",
      "Decision maker",
      "Pain point",
      "Timeline",
    ],
  },
  jtbd: {
    name: "Jobs-to-be-Done",
    description: "Understand the jobs customers are trying to accomplish",
    icon: "🎯",
    useCase: "Product discovery",
    extractionFields: [
      "Job to be done",
      "Desired outcome",
      "Current solution",
      "Constraints",
    ],
  },
  empathy: {
    name: "Empathy Map",
    description: "Capture what users say, think, do, and feel",
    icon: "❤️",
    useCase: "User research",
    extractionFields: ["Says", "Thinks", "Does", "Feels"],
  },
  "problem-solution": {
    name: "Problem-Solution Fit",
    description: "Assess pain intensity and willingness to pay",
    icon: "🔍",
    useCase: "Product-market fit",
    extractionFields: [
      "Pain intensity",
      "Current workaround",
      "Willingness to pay",
      "Segment",
    ],
  },
  research: {
    name: "Research Framework",
    description: "Structured academic/formal research approach",
    icon: "📚",
    useCase: "Academic research",
    extractionFields: [
      "Research goal",
      "Research questions",
      "Hypotheses",
      "Methodology",
    ],
  },
  support: {
    name: "Customer Support",
    description: "Track issues, frequency, and impact",
    icon: "🎧",
    useCase: "Customer success",
    extractionFields: ["Issue type", "Frequency", "Severity", "Impact"],
  },
};

const WIZARD_STEPS = [
  {
    key: "lens",
    label: "Choose Framework",
    description: "Select how to analyze your research",
  },
  {
    key: "context",
    label: "Add Context",
    description: "Tell us about your company and goals",
  },
  {
    key: "ready",
    label: "Start Collecting",
    description: "Begin interviews or surveys",
  },
];

export function SetupWizard({
  recommendedLens = "bant",
  userGoal = "qualify enterprise deals",
  currentStep = 0,
  onAcceptLens,
  onChangeLens,
  onContinue,
}: SetupWizardProps) {
  const [selectedLens, setSelectedLens] = useState<LensType>(recommendedLens);
  const [showAllLenses, setShowAllLenses] = useState(false);

  const lensConfig = LENS_CONFIGS[selectedLens];

  const handleAccept = () => {
    onAcceptLens?.(selectedLens);
    onContinue?.();
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  index < currentStep
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : index === currentStep
                      ? "border-primary bg-primary text-white"
                      : "border-muted-foreground/30 bg-background text-muted-foreground",
                )}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium",
                  index <= currentStep
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1 transition-colors",
                  index < currentStep
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/30",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {currentStep === 0 && (
          <motion.div
            key="lens-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Sparkles className="h-5 w-5 text-primary" />I recommend{" "}
                      {lensConfig.name}
                    </CardTitle>
                    <CardDescription className="mt-1.5">
                      Based on your goal:{" "}
                      <span className="font-medium italic">"{userGoal}"</span>
                    </CardDescription>
                  </div>
                  <span className="text-4xl">{lensConfig.icon}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Lens Description */}
                <div className="rounded-lg border bg-background/50 p-4">
                  <p className="mb-3 text-muted-foreground text-sm">
                    {lensConfig.description}
                  </p>
                  <div className="space-y-2">
                    <p className="font-medium text-sm">
                      What I'll extract from your conversations:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {lensConfig.extractionFields.map((field) => (
                        <div
                          key={field}
                          className="flex items-center gap-2 text-sm"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span>{field}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllLenses(!showAllLenses)}
                  >
                    {showAllLenses ? "Hide" : "See"} other frameworks
                  </Button>
                  <Button onClick={handleAccept} className="gap-2">
                    Use {lensConfig.name}
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>

                {/* All Lenses Grid */}
                <AnimatePresence>
                  {showAllLenses && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3 pt-4">
                        {(Object.keys(LENS_CONFIGS) as LensType[]).map(
                          (lensKey) => {
                            const lens = LENS_CONFIGS[lensKey];
                            const isSelected = lensKey === selectedLens;
                            return (
                              <button
                                key={lensKey}
                                type="button"
                                onClick={() => setSelectedLens(lensKey)}
                                className={cn(
                                  "rounded-lg border p-3 text-left transition-all hover:border-primary/50",
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-background/50",
                                )}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                      <span className="text-xl">
                                        {lens.icon}
                                      </span>
                                      <span className="font-medium text-sm">
                                        {lens.name}
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                      {lens.useCase}
                                    </p>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {currentStep === 1 && (
          <motion.div
            key="context"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Add Context</CardTitle>
                <CardDescription>
                  Tell us about your company and research goals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  [Context gathering component would go here]
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
