/**
 * TypeformQuestion - Single question display with Typeform-style UX
 *
 * Shows one question at a time with:
 * - Smooth slide animations between questions
 * - Forward/back navigation with keyboard support
 * - AI-powered contextual suggestions via ContextualSuggestions component
 * - Speech-to-text for textarea inputs
 * - Progress indicator (X/Y format)
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { TextareaWithSTT } from "~/components/ui/textarea-with-stt";
import ContextualSuggestions from "~/features/onboarding/components/ContextualSuggestions";
import { cn } from "~/lib/utils";

export type FieldType = "text" | "textarea" | "tags" | "select" | "url";

export type SuggestionType =
  | "decision_questions"
  | "assumptions"
  | "unknowns"
  | "organizations"
  | "roles";

export interface TypeformQuestionProps {
  /** The question to display */
  question: string;
  /** Optional description/helper text */
  description?: string;
  /** Input field type */
  fieldType: FieldType;
  /** Current value */
  value: string | string[];
  /** Value change handler */
  onChange: (value: string | string[]) => void;
  /** Navigate to next question */
  onNext: () => void;
  /** Navigate to previous question */
  onBack?: () => void;
  /** Skip this question */
  onSkip?: () => void;
  /** Current step number (1-indexed) */
  stepNumber: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether this question is required */
  required?: boolean;
  /** Enable speech-to-text button */
  showSTT?: boolean;
  /** Suggestion type for ContextualSuggestions */
  suggestionType?: SuggestionType;
  /** Research goal for generating suggestions */
  researchGoal?: string;
  /** Animation direction: 1 = forward, -1 = back */
  direction?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Options for select type */
  options?: { label: string; value: string }[];
  /** Whether URL research is in progress */
  isResearching?: boolean;
  /** Callback to trigger URL research */
  onResearch?: () => void;
  /** Custom className */
  className?: string;
}

// Animation variants for slide transitions
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

export function TypeformQuestion({
  question,
  description,
  fieldType,
  value,
  onChange,
  onNext,
  onBack,
  onSkip,
  stepNumber,
  totalSteps,
  required = false,
  showSTT = false,
  suggestionType,
  researchGoal = "",
  direction = 1,
  placeholder,
  options = [],
  isResearching = false,
  onResearch,
  className,
}: TypeformQuestionProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const formId = useId();
  const params = useParams();

  // Build API path for suggestions
  const apiPath =
    params.accountId && params.projectId
      ? `/a/${params.accountId}/${params.projectId}/api/contextual-suggestions`
      : "/api/contextual-suggestions";

  // Track shown suggestions to avoid duplicates
  const [shownSuggestions, setShownSuggestions] = useState<string[]>([]);

  // Local state for tags input (controlled separately from main value)
  const [tagInput, setTagInput] = useState("");

  // Calculate if user can proceed
  const canProceed =
    !required ||
    (Array.isArray(value)
      ? value.length > 0
      : Boolean(value?.toString().trim()));

  // Has the user entered any value?
  const hasValue = Array.isArray(value)
    ? value.length > 0
    : Boolean(value?.toString().trim());

  // Focus input when question changes
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, [stepNumber]);

  // Reset shown suggestions and tag input when question changes
  useEffect(() => {
    setShownSuggestions([]);
    setTagInput("");
  }, [stepNumber]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (fieldType === "textarea" && !e.metaKey && !e.ctrlKey) {
          return;
        }
        e.preventDefault();
        if (!e.shiftKey && canProceed) {
          onNext();
        }
      }
      if (e.key === "Escape" && onSkip && !required) {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fieldType, onNext, onSkip, required, canProceed]);

  // Handle suggestion click from ContextualSuggestions
  const handleSuggestionClick = (suggestion: string) => {
    if (fieldType === "tags" && Array.isArray(value)) {
      if (!value.includes(suggestion)) {
        onChange([...value, suggestion]);
      }
    } else if (typeof value === "string") {
      // For text/textarea, set value directly
      onChange(suggestion);
    }
  };

  // Remove tag
  const removeTag = (tag: string) => {
    if (Array.isArray(value)) {
      onChange(value.filter((v) => v !== tag));
    }
  };

  // Get existing items for suggestions (to avoid duplicates)
  const existingItems = Array.isArray(value) ? value : [];

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={stepNumber}
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "flex w-full flex-col items-center px-4 pt-8 md:pt-16",
          className,
        )}
      >
        <div className="w-full max-w-xl space-y-10">
          {/* Question Header - removed confusing number circle */}
          <div className="space-y-4 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="font-semibold text-2xl text-foreground tracking-tight sm:text-3xl"
            >
              {question}
              {required && (
                <span className="ml-1 text-destructive/70 text-lg">*</span>
              )}
            </motion.h2>
            {description && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mx-auto max-w-md text-base text-muted-foreground leading-relaxed"
              >
                {description}
              </motion.p>
            )}
          </div>

          {/* Input Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-4"
          >
            {/* Tags Display */}
            {fieldType === "tags" &&
              Array.isArray(value) &&
              value.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {value.map((tag) => (
                    <motion.span
                      key={tag}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                      >
                        <span className="sr-only">Remove {tag}</span>×
                      </button>
                    </motion.span>
                  ))}
                </div>
              )}

            {/* Input Field */}
            <div className="relative">
              {fieldType === "textarea" ? (
                <TextareaWithSTT
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  id={formId}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => onChange(e.target.value)}
                  onTranscription={(transcript) => {
                    // Append transcript to existing value
                    const current = typeof value === "string" ? value : "";
                    const newValue = current
                      ? `${current} ${transcript}`
                      : transcript;
                    onChange(newValue);
                  }}
                  showSTT={showSTT}
                  placeholder={placeholder || "Type your answer..."}
                  rows={4}
                  className={cn(
                    "w-full resize-none rounded-xl border-2 border-border bg-background px-4 py-3 text-foreground text-lg transition-all",
                    "placeholder:text-muted-foreground/60",
                    "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                  )}
                />
              ) : fieldType === "select" ? (
                <div className="relative">
                  <select
                    ref={inputRef as React.RefObject<HTMLSelectElement> as any}
                    id={formId}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn(
                      "w-full appearance-none rounded-xl border-2 border-border bg-background px-4 py-3 pr-10 text-foreground text-lg transition-all",
                      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                    )}
                  >
                    <option value="">Select an option...</option>
                    {options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 h-5 w-5 text-muted-foreground" />
                </div>
              ) : fieldType === "url" ? (
                <div className="flex gap-2">
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="url"
                    id={formId}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder || "https://yourcompany.com"}
                    className={cn(
                      "flex-1 rounded-xl border-2 border-border bg-background px-4 py-3 text-foreground text-lg transition-all",
                      "placeholder:text-muted-foreground/60",
                      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                    )}
                  />
                  {onResearch && (
                    <Button
                      type="button"
                      onClick={onResearch}
                      disabled={
                        isResearching ||
                        !value?.toString().trim() ||
                        !value?.toString().includes(".")
                      }
                      className="gap-2 whitespace-nowrap"
                    >
                      {isResearching ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="hidden sm:inline">
                            Researching...
                          </span>
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          <span className="hidden sm:inline">Auto-fill</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  id={formId}
                  value={
                    fieldType === "tags"
                      ? tagInput
                      : typeof value === "string"
                        ? value
                        : ""
                  }
                  onChange={(e) => {
                    if (fieldType === "tags") {
                      setTagInput(e.target.value);
                      return;
                    }
                    onChange(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (fieldType === "tags" && e.key === "Enter") {
                      e.preventDefault();
                      const input = tagInput.trim();
                      if (
                        input &&
                        Array.isArray(value) &&
                        !value.includes(input)
                      ) {
                        onChange([...value, input]);
                        setTagInput("");
                      }
                    }
                  }}
                  placeholder={
                    fieldType === "tags"
                      ? placeholder || "Type and press Enter..."
                      : placeholder || "Type your answer..."
                  }
                  className={cn(
                    "w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-foreground text-lg transition-all",
                    "placeholder:text-muted-foreground/60",
                    "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                    showSTT && "pr-14",
                  )}
                />
              )}
            </div>

            {/* Contextual Suggestions - uses existing working component */}
            {suggestionType && (
              <ContextualSuggestions
                suggestionType={suggestionType}
                currentInput=""
                researchGoal={researchGoal}
                existingItems={existingItems}
                apiPath={apiPath}
                shownSuggestions={shownSuggestions}
                isActive={true}
                onSuggestionClick={handleSuggestionClick}
                onSuggestionShown={(suggestions) =>
                  setShownSuggestions((prev) => [...prev, ...suggestions])
                }
              />
            )}
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex items-center justify-between pt-4"
          >
            {/* Back Button */}
            <div>
              {onBack && stepNumber > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onBack}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>

            {/* Single Primary Action - Smart labeling based on context */}
            <Button
              type="button"
              onClick={hasValue ? onNext : onSkip || onNext}
              disabled={required && !hasValue}
              className={cn(
                "gap-2 transition-all",
                // Subtle styling when no value entered for optional question
                !required &&
                  !hasValue &&
                  "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {stepNumber === totalSteps ? (
                <>
                  <Check className="h-4 w-4" />
                  {hasValue ? "Done" : "Finish"}
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </motion.div>

          {/* Progress Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="flex flex-col items-center gap-2 pt-8"
          >
            <span className="text-muted-foreground text-sm">
              {stepNumber} of {totalSteps}
            </span>
            <div className="flex h-1 w-24 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(stepNumber / totalSteps) * 100}%` }}
                transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
                className="h-full rounded-full bg-primary"
              />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
