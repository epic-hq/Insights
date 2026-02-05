import consola from "consola";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface ContextualSuggestionsProps {
  suggestionType:
    | "decision_questions"
    | "assumptions"
    | "unknowns"
    | "organizations"
    | "roles"
    | "interview_questions";
  currentInput: string;
  researchGoal: string;
  existingItems: string[];
  onSuggestionClick: (suggestion: string) => void;
  apiPath?: string; // Allow custom API path to be passed in
  shownSuggestions?: string[]; // Track previously shown suggestions
  rejectedItems?: string[]; // Track rejected suggestions to avoid similar ones
  onSuggestionShown?: (suggestions: string[]) => void; // Callback when suggestions are shown
  onSuggestionRejected?: (suggestion: string) => void; // Callback when suggestion is rejected
  isActive?: boolean; // Whether this component should show suggestions
  customInstructions?: string; // Custom instructions for AI generation
  responseCount?: number; // Number of suggestions to generate (default 3)
  questionCategory?: string; // For interview questions: category like "context", "pain", etc.
}

export default function ContextualSuggestions({
  suggestionType,
  currentInput,
  researchGoal,
  existingItems,
  onSuggestionClick,
  apiPath = "/api/contextual-suggestions", // Default fallback for backward compatibility
  shownSuggestions = [],
  rejectedItems = [],
  onSuggestionShown,
  onSuggestionRejected,
  isActive = false,
  customInstructions = "",
  responseCount = 3,
  questionCategory,
}: ContextualSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [consumed, _setConsumed] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const generateSuggestions = async () => {
    if (!researchGoal.trim()) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("researchGoal", researchGoal);
      formData.append("currentInput", currentInput);
      formData.append("suggestionType", suggestionType);
      formData.append("existingItems", JSON.stringify(existingItems));
      formData.append("shownSuggestions", JSON.stringify(shownSuggestions));
      formData.append(
        "rejectedItems",
        JSON.stringify([...rejectedItems, ...rejected]),
      );
      formData.append("projectContext", ""); // Could be expanded later
      formData.append("customInstructions", customInstructions);
      formData.append("responseCount", responseCount.toString());
      if (questionCategory) {
        formData.append("questionCategory", questionCategory);
      }

      const response = await fetch(apiPath, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "API Error Response:",
          response.status,
          response.statusText,
          errorText,
        );
        throw new Error(
          `API Error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();
      // suggestions data received
      const suggestionsArray = Array.isArray(data)
        ? data
        : data.suggestions || [];
      // Filter out suggestions that have already been shown, exist, or were rejected
      const allRejected = [...rejectedItems, ...rejected];
      const filteredSuggestions = suggestionsArray.filter(
        (suggestion) =>
          !shownSuggestions.includes(suggestion) &&
          !existingItems.includes(suggestion) &&
          !allRejected.includes(suggestion),
      );
      const finalSuggestions = filteredSuggestions.slice(0, responseCount);
      setSuggestions(finalSuggestions);
      // Notify parent component about shown suggestions
      if (onSuggestionShown && finalSuggestions.length > 0) {
        onSuggestionShown(finalSuggestions);
      }
      setHasGenerated(true);
    } catch (error) {
      consola.error("Error generating contextual suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate suggestions when component mounts and research goal is available
  useEffect(() => {
    if (!hasGenerated && researchGoal.trim()) {
      // Auto-generate after a short delay to improve UX
      const timer = setTimeout(() => {
        generateSuggestions();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [researchGoal, hasGenerated, generateSuggestions]);

  if (!researchGoal.trim() || !isActive) return null;

  const _suggestionTypeLabels = {
    decision_questions: "Decision questions",
    assumptions: "Assumptions",
    unknowns: "Unknowns",
    organizations: "Organizations",
    roles: "Roles",
    interview_questions: "Interview questions",
  };

  return (
    <div className="space-y-2">
      {isLoading && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-16 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-24 animate-pulse rounded-md bg-gray-200" />
            <div className="h-6 w-32 animate-pulse rounded-md bg-gray-200" />
            <div className="h-6 w-28 animate-pulse rounded-md bg-gray-200" />
          </div>
        </div>
      )}

      {suggestions.length > 0 && !isLoading && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-gray-600 text-xs">
              Suggestions:
              {responseCount !== 3 && ` (${responseCount})`}
            </div>
            <button
              onClick={() => {
                setHasGenerated(false);
                setRejected(new Set()); // Clear rejected items on refresh
                generateSuggestions();
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-gray-500 text-xs transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => {
              const isConsumed = consumed.has(suggestion);
              const isRejected = rejected.has(suggestion);
              return (
                <div key={index} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onSuggestionClick(suggestion);
                    }}
                    disabled={isConsumed || isRejected}
                    className={
                      "cursor-pointer rounded-md border px-2 py-1 text-left font-medium text-sm transition-colors sm:px-2.5" +
                      (isConsumed
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 line-through opacity-50"
                        : isRejected
                          ? "cursor-not-allowed border-red-200 bg-red-50 text-red-400 opacity-50"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100")
                    }
                    title={
                      isConsumed
                        ? "Already added to input"
                        : isRejected
                          ? "Rejected"
                          : "Add to input"
                    }
                  >
                    + {suggestion}
                  </button>
                  {!isConsumed && !isRejected && (
                    <button
                      onClick={() => {
                        setRejected((prev) => new Set(prev).add(suggestion));
                        onSuggestionRejected?.(suggestion);
                      }}
                      className="rounded p-1 text-slate-400 transition-colors hover:text-red-500"
                      title="Reject this suggestion"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && !hasGenerated && (
        <button
          onClick={generateSuggestions}
          className="flex items-center gap-1 rounded px-2 py-1 text-gray-600 text-xs transition-colors hover:bg-gray-100"
        >
          💡 Get suggestions
        </button>
      )}
    </div>
  );
}
