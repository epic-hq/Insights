/**
 * OnboardingWalkthrough - New user onboarding modal
 *
 * Multi-step walkthrough that collects:
 * 1. Job function/role (4-column compact grid)
 * 2. Use cases — multi-select (what brings you to UpSight)
 * 3. Company size
 *
 * Modal is scrollable so continue buttons are always reachable.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  ClipboardList,
  Code,
  Handshake,
  HeartHandshake,
  Megaphone,
  Microscope,
  PenTool,
  Rocket,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useFetcher, useNavigate, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { ConfettiCelebration } from "~/components/ui/confetti";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import {
  JOB_FUNCTIONS as DB_JOB_FUNCTIONS,
  TARGET_COMPANY_SIZE_CATEGORIES,
} from "~/lib/constants/options";
import { cn } from "~/lib/utils";

/** Animation variants for staggered children */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
};

export interface OnboardingData {
  jobFunction: string;
  primaryUseCase: string;
  companySize: string;
  completed: boolean;
}

interface OnboardingWalkthroughProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (data: OnboardingData) => void;
  initialData?: Partial<OnboardingData>;
}

// Icons for job functions
const JOB_FUNCTION_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  engineering: Code,
  product: Target,
  design: PenTool,
  marketing: Megaphone,
  sales: Handshake,
  "customer-success": HeartHandshake,
  operations: Building2,
  finance: BarChart3,
  hr: Users,
  legal: ClipboardList,
  data: BarChart3,
  research: Microscope,
  executive: Briefcase,
};

const JOB_FUNCTIONS = DB_JOB_FUNCTIONS.map((job) => ({
  value: job.value,
  label: job.label,
  icon: JOB_FUNCTION_ICONS[job.value] || Briefcase,
}));

const USE_CASES = [
  {
    value: "surveys",
    label: "Surveys & Feedback",
    icon: ClipboardList,
  },
  {
    value: "customer_discovery",
    label: "Customer Discovery",
    icon: Search,
  },
  {
    value: "sales_intelligence",
    label: "Sales Intelligence",
    icon: TrendingUp,
  },
  {
    value: "user_research",
    label: "User Research",
    icon: Microscope,
  },
  {
    value: "customer_success",
    label: "Customer Success",
    icon: HeartHandshake,
  },
  {
    value: "competitive_intel",
    label: "Competitive Intelligence",
    icon: Target,
  },
];

const COMPANY_SIZES = TARGET_COMPANY_SIZE_CATEGORIES.map((cat) => ({
  value: cat.value,
  label: cat.label,
  description: cat.description,
}));

interface StepProps {
  data: Partial<OnboardingData>;
  onChange: (field: keyof OnboardingData, value: string) => void;
}

function JobFunctionStep({ data, onChange }: StepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-4"
    >
      <div className="text-center">
        <h3 className="font-semibold text-lg tracking-tight">
          What's your role?
        </h3>
      </div>

      <RadioGroup
        value={data.jobFunction || ""}
        onValueChange={(value) => onChange("jobFunction", value)}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="contents"
        >
          {JOB_FUNCTIONS.map((job) => {
            const Icon = job.icon;
            const isSelected = data.jobFunction === job.value;
            return (
              <motion.div key={job.value} variants={itemVariants}>
                <Label
                  htmlFor={`job-${job.value}`}
                  className={cn(
                    "group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 text-center transition-all duration-200",
                    "hover:border-primary/50 hover:bg-primary/5",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border",
                  )}
                >
                  <RadioGroupItem
                    value={job.value}
                    id={`job-${job.value}`}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      "font-medium text-xs leading-tight transition-colors",
                      isSelected && "text-primary",
                    )}
                  >
                    {job.label}
                  </span>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 25,
                      }}
                      className="-top-1 -right-1 absolute"
                    >
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </div>
                    </motion.div>
                  )}
                </Label>
              </motion.div>
            );
          })}
        </motion.div>
      </RadioGroup>
    </motion.div>
  );
}

function UseCaseStep({ data, onChange }: StepProps) {
  // Parse comma-separated string into Set for multi-select
  const selected = new Set(
    (data.primaryUseCase || "").split(",").filter(Boolean),
  );

  const toggleUseCase = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange("primaryUseCase", Array.from(next).join(","));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-4"
    >
      <div className="text-center">
        <h3 className="font-semibold text-lg tracking-tight">
          What brings you to UpSight?
        </h3>
        <p className="text-muted-foreground text-xs">Select all that apply</p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-2"
      >
        {USE_CASES.map((useCase) => {
          const isSelected = selected.has(useCase.value);
          const Icon = useCase.icon;
          return (
            <motion.button
              key={useCase.value}
              type="button"
              variants={itemVariants}
              onClick={() => toggleUseCase(useCase.value)}
              className={cn(
                "group relative flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 text-left transition-all duration-200",
                "hover:border-primary/50 hover:bg-primary/5",
                isSelected ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={cn(
                  "font-medium text-sm transition-colors",
                  isSelected && "text-primary",
                )}
              >
                {useCase.label}
              </span>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 25,
                  }}
                  className="-top-1 -right-1 absolute"
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </div>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

function CompanySizeStep({ data, onChange }: StepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-4"
    >
      <div className="text-center">
        <h3 className="font-semibold text-lg tracking-tight">
          How big is your company?
        </h3>
      </div>

      <RadioGroup
        value={data.companySize || ""}
        onValueChange={(value) => onChange("companySize", value)}
        className="grid grid-cols-2 gap-3"
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="contents"
        >
          {COMPANY_SIZES.map((size) => {
            const isSelected = data.companySize === size.value;
            return (
              <motion.div key={size.value} variants={itemVariants}>
                <Label
                  htmlFor={`size-${size.value}`}
                  className={cn(
                    "group relative flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 p-4 text-center transition-all duration-200",
                    "hover:border-primary/50 hover:bg-primary/5",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border",
                  )}
                >
                  <RadioGroupItem
                    value={size.value}
                    id={`size-${size.value}`}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "font-semibold text-sm transition-colors",
                      isSelected && "text-primary",
                    )}
                  >
                    {size.label}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {size.description}
                  </span>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 25,
                      }}
                      className="-top-1 -right-1 absolute"
                    >
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </div>
                    </motion.div>
                  )}
                </Label>
              </motion.div>
            );
          })}
        </motion.div>
      </RadioGroup>
    </motion.div>
  );
}

function CompletionStep() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center gap-5 py-6 text-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
          delay: 0.15,
        }}
        className="relative"
      >
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary to-primary/70 shadow-lg shadow-primary/25">
          <Sparkles className="h-10 w-10 text-primary-foreground" />
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="space-y-2"
      >
        <h3 className="font-bold text-xl tracking-tight">You're all set!</h3>
        <p className="mx-auto max-w-[260px] text-muted-foreground text-sm leading-relaxed">
          Your experience is personalized. Let's get started.
        </p>
      </motion.div>
    </motion.div>
  );
}

export function OnboardingWalkthrough({
  open,
  onOpenChange,
  onComplete,
  initialData,
}: OnboardingWalkthroughProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Partial<OnboardingData>>(initialData || {});
  const [showCompletion, setShowCompletion] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const params = useParams();
  const accountId = params.accountId || "";
  const projectId = params.projectId || "";
  const routes = useProjectRoutesFromIds(accountId, projectId);

  const steps = [
    { component: JobFunctionStep, canProceed: Boolean(data.jobFunction) },
    {
      component: UseCaseStep,
      canProceed: Boolean(
        data.primaryUseCase && data.primaryUseCase.length > 0,
      ),
    },
    { component: CompanySizeStep, canProceed: Boolean(data.companySize) },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const isFirstStep = step === 0;

  const handleChange = useCallback(
    (field: keyof OnboardingData, value: string) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleNext = useCallback(() => {
    if (isLastStep) {
      setShowCompletion(true);
      setShowConfetti(true);

      const completeData: OnboardingData = {
        jobFunction: data.jobFunction || "",
        primaryUseCase: data.primaryUseCase || "",
        companySize: data.companySize || "",
        completed: true,
      };

      fetcher.submit(
        { onboardingData: JSON.stringify(completeData) },
        { method: "POST", action: "/api/user-settings/onboarding" },
      );

      onComplete?.(completeData);
    } else {
      setStep((prev) => prev + 1);
    }
  }, [step, isLastStep, data, fetcher, onComplete]);

  const handleBack = useCallback(() => {
    setStep((prev) => Math.max(0, prev - 1));
  }, []);

  const handleContinueToCompany = useCallback(() => {
    onOpenChange(false);
    if (accountId && projectId) {
      navigate(`${routes.projects.setup()}?welcome=1`);
    }
  }, [onOpenChange, navigate, routes, accountId, projectId]);

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  const StepComponent = currentStep?.component;

  return (
    <Dialog
      open={open}
      onOpenChange={showCompletion ? undefined : onOpenChange}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]"
        showCloseButton={!showCompletion}
      >
        {showConfetti && <ConfettiCelebration />}

        <AnimatePresence mode="wait">
          {showCompletion ? (
            <motion.div key="completion">
              <DialogHeader className="sr-only">
                <DialogTitle>Welcome Complete</DialogTitle>
              </DialogHeader>
              <CompletionStep />
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center pb-2"
              >
                <Button
                  onClick={handleContinueToCompany}
                  size="lg"
                  className="gap-2 px-6 shadow-md shadow-primary/20 transition-shadow hover:shadow-lg hover:shadow-primary/25"
                >
                  <Rocket className="h-4 w-4" />
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="steps">
              <DialogHeader className="pb-3">
                <DialogTitle className="text-center text-lg">
                  Welcome to UpSight
                </DialogTitle>
                <DialogDescription className="text-center text-xs">
                  Quick setup to personalize your experience
                </DialogDescription>
              </DialogHeader>

              {/* Progress dots */}
              <div
                className="flex justify-center gap-2 pb-3"
                role="progressbar"
                aria-valuenow={step + 1}
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-label={`Step ${step + 1} of ${steps.length}`}
              >
                {steps.map((_, index) => (
                  <motion.div
                    key={index}
                    className={cn(
                      "h-1.5 rounded-full transition-colors duration-300",
                      index <= step ? "bg-primary" : "bg-muted",
                    )}
                    initial={{ width: 28 }}
                    animate={{ width: index === step ? 40 : 28 }}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>

              {/* Step content */}
              <div className="min-h-[240px]">
                <AnimatePresence mode="wait">
                  <StepComponent
                    key={step}
                    data={data}
                    onChange={handleChange}
                  />
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 border-border/50 border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={isFirstStep}
                  className={cn(
                    "transition-opacity duration-200",
                    isFirstStep && "pointer-events-none opacity-0",
                  )}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!currentStep.canProceed}
                  className={cn(
                    "min-w-[120px] transition-all duration-200",
                    currentStep.canProceed &&
                      "shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25",
                  )}
                >
                  {isLastStep ? (
                    <>
                      Complete
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingWalkthrough;
