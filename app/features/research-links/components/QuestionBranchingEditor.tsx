/**
 * Simple UI for configuring skip logic on a question
 *
 * Allows users to add rules like:
 * "If answer equals X, skip to question Y"
 * "If answer equals X, end survey"
 */

import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type {
  BranchRule,
  ConditionOperator,
  QuestionBranching,
} from "../branching";
import type { ResearchLinkQuestion } from "../schemas";

interface QuestionBranchingEditorProps {
  question: ResearchLinkQuestion;
  allQuestions: ResearchLinkQuestion[];
  questionIndex: number;
  onChange: (branching: QuestionBranching | null) => void;
}

export function QuestionBranchingEditor({
  question,
  allQuestions,
  questionIndex,
  onChange,
}: QuestionBranchingEditorProps) {
  const [isExpanded, setIsExpanded] = useState(
    Boolean(question.branching?.rules?.length),
  );
  const branching = question.branching;
  const rules = branching?.rules ?? [];

  // Get questions that come after this one (valid skip targets)
  const laterQuestions = allQuestions.filter((_, idx) => idx > questionIndex);

  // Get options if this is a select question
  const hasOptions =
    question.type === "single_select" || question.type === "multi_select";
  const options = question.options ?? [];

  const addRule = () => {
    const newRule: BranchRule = {
      id: `rule-${Date.now()}`,
      conditions: {
        logic: "and",
        conditions: [
          {
            questionId: question.id,
            operator: "equals",
            value: "",
          },
        ],
      },
      action: laterQuestions.length > 0 ? "skip_to" : "end_survey",
      targetQuestionId: laterQuestions[0]?.id,
    };

    onChange({
      rules: [...rules, newRule],
    });
    setIsExpanded(true);
  };

  const updateRule = (ruleIndex: number, updates: Partial<BranchRule>) => {
    const nextRules = rules.map((rule, idx) =>
      idx === ruleIndex ? { ...rule, ...updates } : rule,
    );
    onChange({ rules: nextRules });
  };

  const removeRule = (ruleIndex: number) => {
    const nextRules = rules.filter((_, idx) => idx !== ruleIndex);
    onChange(nextRules.length > 0 ? { rules: nextRules } : null);
  };

  const updateConditionValue = (ruleIndex: number, value: string) => {
    const rule = rules[ruleIndex];
    if (!rule) return;

    updateRule(ruleIndex, {
      conditions: {
        ...rule.conditions,
        conditions: [
          {
            ...rule.conditions.conditions[0],
            value,
          },
        ],
      },
    });
  };

  const updateConditionOperator = (
    ruleIndex: number,
    operator: ConditionOperator,
  ) => {
    const rule = rules[ruleIndex];
    if (!rule) return;

    updateRule(ruleIndex, {
      conditions: {
        ...rule.conditions,
        conditions: [
          {
            ...rule.conditions.conditions[0],
            operator,
          },
        ],
      },
    });
  };

  return (
    <div className="border-t border-border/30 pt-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <GitBranch className="h-3 w-3" />
        <span>Skip Logic</span>
        {rules.length > 0 && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary text-[10px]">
            {rules.length} rule{rules.length > 1 ? "s" : ""}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2 pl-4">
          {rules.map((rule, ruleIndex) => {
            const condition = rule.conditions.conditions[0];
            return (
              <div
                key={rule.id}
                className="flex flex-wrap items-center gap-1.5 rounded bg-muted/30 p-2 text-xs"
              >
                <span className="text-muted-foreground">If answer</span>

                {/* Operator */}
                <Select
                  value={condition?.operator ?? "equals"}
                  onValueChange={(v) =>
                    updateConditionOperator(ruleIndex, v as ConditionOperator)
                  }
                >
                  <SelectTrigger className="h-6 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">equals</SelectItem>
                    <SelectItem value="not_equals">doesn't equal</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="answered">is answered</SelectItem>
                    <SelectItem value="not_answered">
                      is not answered
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Value - show dropdown for select questions, input for text */}
                {condition?.operator !== "answered" &&
                  condition?.operator !== "not_answered" && (
                    <>
                      {hasOptions && options.length > 0 ? (
                        <Select
                          value={(condition?.value as string) ?? ""}
                          onValueChange={(v) =>
                            updateConditionValue(ruleIndex, v)
                          }
                        >
                          <SelectTrigger className="h-6 min-w-[100px] max-w-[180px] text-xs">
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={(condition?.value as string) ?? ""}
                          onChange={(e) =>
                            updateConditionValue(ruleIndex, e.target.value)
                          }
                          placeholder="value"
                          className="h-6 w-24 text-xs"
                        />
                      )}
                    </>
                  )}

                <span className="text-muted-foreground">→</span>

                {/* Action */}
                <Select
                  value={rule.action}
                  onValueChange={(v) =>
                    updateRule(ruleIndex, {
                      action: v as "skip_to" | "end_survey",
                      targetQuestionId:
                        v === "skip_to" ? laterQuestions[0]?.id : undefined,
                    })
                  }
                >
                  <SelectTrigger className="h-6 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip_to">Skip to</SelectItem>
                    <SelectItem value="end_survey">End survey</SelectItem>
                  </SelectContent>
                </Select>

                {/* Target question (for skip_to) */}
                {rule.action === "skip_to" && (
                  <Select
                    value={rule.targetQuestionId ?? ""}
                    onValueChange={(v) =>
                      updateRule(ruleIndex, { targetQuestionId: v })
                    }
                  >
                    <SelectTrigger className="h-6 max-w-[200px] text-xs">
                      <SelectValue placeholder="Select question" />
                    </SelectTrigger>
                    <SelectContent>
                      {laterQuestions.map((q, idx) => (
                        <SelectItem key={q.id} value={q.id}>
                          Q{questionIndex + idx + 2}: {q.prompt.slice(0, 30)}
                          {q.prompt.length > 30 ? "..." : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Remove rule */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-60 hover:text-destructive hover:opacity-100"
                  onClick={() => removeRule(ruleIndex)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-muted-foreground text-xs hover:text-foreground"
            onClick={addRule}
          >
            <Plus className="mr-1 h-3 w-3" /> Add skip rule
          </Button>
        </div>
      )}
    </div>
  );
}
