/**
 * Skip logic editor with natural language input
 *
 * Supports two modes:
 * 1. NL input: "If they're a sponsor, skip to budget and probe on ROI"
 * 2. Manual: Traditional dropdowns for operator, value, target
 *
 * AI-generated rules show summary, guidance (for chat agent probing), and source badge.
 */

import { ChevronDown, ChevronRight, GitBranch, Loader2, MessageSquareText, Plus, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import type { BranchRule, ConditionOperator, QuestionBranching } from "../branching";
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
	const [isExpanded, setIsExpanded] = useState(Boolean(question.branching?.rules?.length));
	const [nlInput, setNlInput] = useState("");
	const [isParsing, setIsParsing] = useState(false);
	const [parseError, setParseError] = useState<string | null>(null);
	const [showManualAdd, setShowManualAdd] = useState(false);
	const nlInputRef = useRef<HTMLTextAreaElement>(null);
	const { accountId, projectId } = useParams();

	const branching = question.branching;
	const rules = branching?.rules ?? [];

	// Get questions that come after this one (valid skip targets)
	const laterQuestions = allQuestions.filter((_, idx) => idx > questionIndex);

	// Get options if this is a select question
	const hasOptions = question.type === "single_select" || question.type === "multi_select";
	const options = question.options ?? [];

	// NL rule parsing via AI
	const parseNlRule = useCallback(async () => {
		if (!nlInput.trim() || isParsing) return;
		setIsParsing(true);
		setParseError(null);

		try {
			const apiBase = accountId && projectId ? `/a/${accountId}/${projectId}/ask` : "";
			const response = await fetch(`${apiBase}/api/parse-branch-rule`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					input: nlInput.trim(),
					questionId: question.id,
					questionPrompt: question.prompt,
					questionType: question.type,
					questionOptions: options,
					laterQuestions: laterQuestions.map((q, idx) => ({
						id: q.id,
						prompt: q.prompt,
						index: idx,
					})),
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to parse rule");
			}

			const data = await response.json();
			if (data.rule) {
				onChange({ rules: [...rules, data.rule] });
				setNlInput("");
				setIsExpanded(true);
			}
		} catch {
			setParseError("Couldn't parse that. Try rephrasing or use manual mode.");
		} finally {
			setIsParsing(false);
		}
	}, [nlInput, isParsing, accountId, projectId, question, options, laterQuestions, rules, onChange]);

	const addManualRule = () => {
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
			source: "user_ui",
		};

		onChange({ rules: [...rules, newRule] });
		setIsExpanded(true);
		setShowManualAdd(false);
	};

	const updateRule = (ruleIndex: number, updates: Partial<BranchRule>) => {
		const nextRules = rules.map((rule, idx) => (idx === ruleIndex ? { ...rule, ...updates } : rule));
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

	const updateConditionOperator = (ruleIndex: number, operator: ConditionOperator) => {
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

	// Find target question prompt for display
	const getTargetLabel = (targetId?: string) => {
		if (!targetId) return null;
		const idx = allQuestions.findIndex((q) => q.id === targetId);
		if (idx < 0) return null;
		const q = allQuestions[idx];
		return `Q${idx + 1}: ${q.prompt.slice(0, 35)}${q.prompt.length > 35 ? "…" : ""}`;
	};

	return (
		<div>
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex w-full items-center gap-1.5 text-foreground/80 text-xs hover:text-foreground"
			>
				{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
				<GitBranch className="h-3 w-3" />
				<span>Skip Logic</span>
				{rules.length > 0 && (
					<span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary">
						{rules.length} rule{rules.length > 1 ? "s" : ""}
					</span>
				)}
			</button>

			{isExpanded && (
				<div className="mt-2 space-y-2">
					{/* NL Input — primary way to add rules */}
					<div className="space-y-1.5">
						<div className="relative">
							<Textarea
								ref={nlInputRef}
								value={nlInput}
								onChange={(e) => {
									setNlInput(e.target.value);
									setParseError(null);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										parseNlRule();
									}
								}}
								placeholder='e.g. "If sponsor, skip to budget question and probe on ROI"'
								rows={1}
								disabled={isParsing}
								className="min-h-[2.25rem] resize-none pr-20 text-xs"
							/>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								disabled={!nlInput.trim() || isParsing}
								onClick={parseNlRule}
								className="absolute top-0.5 right-1 h-7 gap-1 text-xs"
							>
								{isParsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
								{isParsing ? "Parsing…" : "Add"}
							</Button>
						</div>
						{parseError && <p className="text-[10px] text-destructive">{parseError}</p>}
					</div>

					{/* Existing rules */}
					{rules.map((rule, ruleIndex) => {
						const condition = rule.conditions.conditions[0];
						const isAiGenerated = rule.source === "ai_generated";
						const hasSummary = Boolean(rule.summary);
						const hasGuidance = Boolean(rule.guidance);

						return (
							<div key={rule.id} className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-2">
								{/* Summary line (for AI rules) or structured display */}
								{hasSummary ? (
									<div className="flex items-start gap-1.5">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-1.5">
												{isAiGenerated && (
													<span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 font-medium text-[10px] text-violet-400">
														<Sparkles className="h-2.5 w-2.5" />
														AI
													</span>
												)}
												<span className="text-xs">{rule.summary}</span>
											</div>
											{/* Guidance for chat agent */}
											{hasGuidance && (
												<div className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
													<MessageSquareText className="mt-0.5 h-3 w-3 shrink-0 text-blue-400/60" />
													<span className="italic">Chat probe: {rule.guidance}</span>
												</div>
											)}
										</div>
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
								) : (
									/* Manual rule — structured dropdowns */
									<div className="flex flex-wrap items-center gap-1.5 text-xs">
										<span className="text-muted-foreground">If answer</span>

										<Select
											value={condition?.operator ?? "equals"}
											onValueChange={(v) => updateConditionOperator(ruleIndex, v as ConditionOperator)}
										>
											<SelectTrigger className="h-6 w-24 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="equals">equals</SelectItem>
												<SelectItem value="not_equals">doesn't equal</SelectItem>
												<SelectItem value="contains">contains</SelectItem>
												<SelectItem value="answered">is answered</SelectItem>
												<SelectItem value="not_answered">is not answered</SelectItem>
											</SelectContent>
										</Select>

										{condition?.operator !== "answered" && condition?.operator !== "not_answered" && (
											<>
												{hasOptions && options.length > 0 ? (
													<Select
														value={(condition?.value as string) ?? ""}
														onValueChange={(v) => updateConditionValue(ruleIndex, v)}
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
														onChange={(e) => updateConditionValue(ruleIndex, e.target.value)}
														placeholder="value"
														className="h-6 w-24 text-xs"
													/>
												)}
											</>
										)}

										<span className="text-muted-foreground">→</span>

										<Select
											value={rule.action}
											onValueChange={(v) =>
												updateRule(ruleIndex, {
													action: v as "skip_to" | "end_survey",
													targetQuestionId: v === "skip_to" ? laterQuestions[0]?.id : undefined,
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

										{rule.action === "skip_to" && (
											<Select
												value={rule.targetQuestionId ?? ""}
												onValueChange={(v) => updateRule(ruleIndex, { targetQuestionId: v })}
											>
												<SelectTrigger className="h-6 max-w-[200px] text-xs">
													<SelectValue placeholder="Select question" />
												</SelectTrigger>
												<SelectContent>
													{laterQuestions.map((q, idx) => (
														<SelectItem key={q.id} value={q.id}>
															Q{questionIndex + idx + 2}: {q.prompt.slice(0, 30)}
															{q.prompt.length > 30 ? "…" : ""}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}

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
								)}

								{/* Compact action/target display for AI rules */}
								{hasSummary && (
									<div className="flex flex-wrap items-center gap-1 pl-0.5 text-[11px] text-muted-foreground">
										<span className="rounded bg-muted/50 px-1.5 py-0.5">
											{condition?.operator} "{condition?.value}"
										</span>
										<span>→</span>
										<span className="rounded bg-muted/50 px-1.5 py-0.5">
											{rule.action === "end_survey"
												? "End survey"
												: (getTargetLabel(rule.targetQuestionId) ?? "skip to…")}
										</span>
									</div>
								)}
							</div>
						);
					})}

					{/* Manual add fallback */}
					{showManualAdd ? null : (
						<button
							type="button"
							onClick={() => {
								setShowManualAdd(true);
								addManualRule();
							}}
							className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
						>
							<Plus className="h-3 w-3" /> Add manual rule
						</button>
					)}
				</div>
			)}
		</div>
	);
}
