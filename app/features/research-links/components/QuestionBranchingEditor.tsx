/**
 * Branching editor with natural language input
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
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import type { BranchRule, ConditionOperator, QuestionBranching } from "../branching";
import type { ResearchLinkQuestion } from "../schemas";
import { deriveSurveySections, resolveSectionStartQuestionId } from "../sections";

interface QuestionBranchingEditorProps {
	question: ResearchLinkQuestion;
	allQuestions: ResearchLinkQuestion[];
	questionIndex: number;
	onChange: (branching: QuestionBranching | null) => void;
}

function consolidateRulesByTarget(rules: BranchRule[]): BranchRule[] {
	type MergeGroup = {
		firstIndex: number;
		firstRule: BranchRule;
		values: Set<string>;
	};

	const passthrough = new Map<number, BranchRule>();
	const mergeGroups = new Map<string, MergeGroup>();

	for (const [index, rule] of rules.entries()) {
		const primaryCondition = rule.conditions.conditions[0];
		const canMerge =
			rule.conditions.logic === "and" &&
			rule.conditions.conditions.length === 1 &&
			primaryCondition &&
			(primaryCondition.operator === "equals" || primaryCondition.operator === "selected") &&
			typeof primaryCondition.value === "string";

		if (!canMerge) {
			passthrough.set(index, rule);
			continue;
		}

		const groupKey = `${rule.action}|${rule.targetQuestionId ?? "end"}|${primaryCondition.questionId}|${primaryCondition.operator}`;
		const group = mergeGroups.get(groupKey);
		if (!group) {
			const initialValue = typeof primaryCondition.value === "string" ? primaryCondition.value : "";
			mergeGroups.set(groupKey, {
				firstIndex: index,
				firstRule: rule,
				values: new Set(initialValue ? [initialValue] : []),
			});
		} else {
			if (typeof primaryCondition.value === "string" && primaryCondition.value.trim().length > 0) {
				group.values.add(primaryCondition.value);
			}
		}
	}

	const consolidatedEntries: Array<{ index: number; rule: BranchRule }> = [
		...Array.from(passthrough.entries()).map(([index, rule]) => ({ index, rule })),
		...Array.from(mergeGroups.values()).map((group, mergeIndex) => {
			const firstCondition = group.firstRule.conditions.conditions[0];
			if (!firstCondition) {
				return { index: group.firstIndex, rule: group.firstRule };
			}
			const values = [...group.values];
			const conditions =
				values.length > 1
					? values.map((value) => ({
							questionId: firstCondition.questionId,
							operator: firstCondition.operator,
							value,
						}))
					: [firstCondition];

			const rule: BranchRule = {
				...group.firstRule,
				id: values.length > 1 ? `merged-${Date.now()}-${mergeIndex}` : group.firstRule.id,
				conditions: {
					logic: values.length > 1 ? "or" : "and",
					conditions,
				},
			};

			return { index: group.firstIndex, rule };
		}),
	];

	return consolidatedEntries.sort((a, b) => a.index - b.index).map((entry) => entry.rule);
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
	const defaultNext = branching?.defaultNext;
	const normalizedPreview = rules.length > 1 ? consolidateRulesByTarget(rules) : rules;
	const hasNormalizationOpportunity = JSON.stringify(normalizedPreview) !== JSON.stringify(rules);
	const sections = deriveSurveySections(allQuestions);
	const laterSections = sections.filter((section) => {
		const startIndex = allQuestions.findIndex((q) => q.id === section.startQuestionId);
		return startIndex > questionIndex;
	});

	// Get questions that come after this one (valid skip targets)
	const laterQuestions = allQuestions.filter((_, idx) => idx > questionIndex);
	// Questions up to this point can be used as condition sources
	const conditionSourceQuestions = allQuestions.filter((_, idx) => idx <= questionIndex);

	// Pass current question options to NL parser for better grounding.
	const currentQuestionOptions = question.options ?? [];

	const emitBranching = useCallback(
		(nextRules: BranchRule[], nextDefaultNext = defaultNext) => {
			if (import.meta.env.DEV) {
				console.debug("[QuestionBranchingEditor] branching change", {
					questionId: question.id,
					nextRuleCount: nextRules.length,
					nextDefaultNext: nextDefaultNext ?? null,
				});
			}
			if (nextRules.length === 0 && !nextDefaultNext) {
				onChange(null);
				return;
			}
			onChange({
				rules: nextRules,
				...(nextDefaultNext ? { defaultNext: nextDefaultNext } : {}),
			});
		},
		[defaultNext, onChange, question.id]
	);

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
					questionOptions: currentQuestionOptions,
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
			if (data.error) {
				setParseError(data.error);
				return;
			}
			if (data.rule) {
				emitBranching([...rules, data.rule]);
				setNlInput("");
				setIsExpanded(true);
			}
		} catch {
			setParseError("Couldn't parse that. Try rephrasing or use manual mode.");
		} finally {
			setIsParsing(false);
		}
	}, [
		nlInput,
		isParsing,
		accountId,
		projectId,
		question,
		currentQuestionOptions,
		laterQuestions,
		rules,
		emitBranching,
	]);

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

		emitBranching([...rules, newRule]);
		setIsExpanded(true);
		setShowManualAdd(false);
	};

	const updateRule = (ruleIndex: number, updates: Partial<BranchRule>) => {
		const nextRules = rules.map((rule, idx) => (idx === ruleIndex ? { ...rule, ...updates } : rule));
		emitBranching(nextRules);
	};

	const removeRule = (ruleIndex: number) => {
		const nextRules = rules.filter((_, idx) => idx !== ruleIndex);
		emitBranching(nextRules);
	};

	const consolidateRules = () => {
		const consolidated = consolidateRulesByTarget(rules);
		const didChange = JSON.stringify(consolidated) !== JSON.stringify(rules);
		if (!didChange) {
			toast("No consolidation opportunities found");
			return;
		}
		emitBranching(consolidated);
		toast.success(`Consolidated ${rules.length} rules into ${consolidated.length}`);
	};

	const updateConditionQuestionId = (ruleIndex: number, nextQuestionId: string) => {
		const rule = rules[ruleIndex];
		if (!rule) return;
		const firstCondition = rule.conditions.conditions[0];
		if (!firstCondition) return;

		const updatedFirstCondition = {
			...firstCondition,
			questionId: nextQuestionId,
			value: firstCondition.operator === "answered" || firstCondition.operator === "not_answered" ? undefined : "",
		};

		updateRule(ruleIndex, {
			conditions: {
				...rule.conditions,
				conditions: [updatedFirstCondition, ...rule.conditions.conditions.slice(1)],
			},
		});
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
	const getTargetLabel = (targetQuestionId?: string, targetSectionId?: string) => {
		if (targetSectionId) {
			const section = sections.find((entry) => entry.id === targetSectionId);
			if (section) {
				const startIndex = allQuestions.findIndex((q) => q.id === section.startQuestionId);
				const startLabel = startIndex >= 0 ? `Q${startIndex + 1}` : "Unknown";
				return `${section.title} (${startLabel})`;
			}
		}
		if (!targetQuestionId) return null;
		const idx = allQuestions.findIndex((q) => q.id === targetQuestionId);
		if (idx < 0) return null;
		const q = allQuestions[idx];
		return `Q${idx + 1}: ${q.prompt.slice(0, 35)}${q.prompt.length > 35 ? "…" : ""}`;
	};

	const defaultNextSelectValue = (() => {
		if (!defaultNext) return "__linear__";
		const matchingSection = laterSections.find((section) => section.startQuestionId === defaultNext);
		if (matchingSection) return `section:${matchingSection.id}`;
		return `question:${defaultNext}`;
	})();

	const updateDefaultNext = (value: string) => {
		if (value === "__linear__") {
			emitBranching(rules, undefined);
			return;
		}
		if (value.startsWith("section:")) {
			const sectionId = value.slice("section:".length);
			const targetQuestionId = resolveSectionStartQuestionId(allQuestions, sectionId, question.id);
			emitBranching(rules, targetQuestionId ?? undefined);
			return;
		}
		const targetQuestionId = value.startsWith("question:") ? value.slice("question:".length) : value;
		emitBranching(rules, targetQuestionId);
	};

	return (
		<div data-testid="question-branching-editor">
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex w-full items-center gap-1.5 text-foreground/80 text-xs hover:text-foreground"
				data-testid="question-branching-toggle"
			>
				{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
				<GitBranch className="h-3 w-3" />
				<span>Branching</span>
				{rules.length > 0 && (
					<span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary">
						{rules.length} rule{rules.length > 1 ? "s" : ""}
					</span>
				)}
			</button>

			{isExpanded && (
				<div className="mt-2 space-y-2">
					<div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-2 py-2">
						<div className="flex flex-wrap items-center gap-2 text-[11px]">
							<span className="font-medium text-foreground/90">
								{rules.length > 0 ? "If no rule matches, go to" : "After this question, go to"}
							</span>
							<Select value={defaultNextSelectValue} onValueChange={updateDefaultNext}>
								<SelectTrigger className="h-7 min-w-[210px] text-xs" data-testid="branch-default-next-select">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__linear__">Continue linearly</SelectItem>
									{laterSections.map((section) => {
										const startIndex = allQuestions.findIndex((q) => q.id === section.startQuestionId);
										return (
											<SelectItem key={`default-section-${section.id}`} value={`section:${section.id}`}>
												Section: {section.title} (starts Q{startIndex + 1})
											</SelectItem>
										);
									})}
									{laterQuestions.map((q, idx) => (
										<SelectItem key={`default-question-${q.id}`} value={`question:${q.id}`}>
											Q{questionIndex + idx + 2}: {q.prompt.slice(0, 40)}
											{q.prompt.length > 40 ? "…" : ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<p className="text-[10px] text-muted-foreground">
							Best for common branch exits like “when this path is done, continue to Shared closing.”
						</p>
					</div>

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
								data-testid="branch-nl-input"
							/>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								disabled={!nlInput.trim() || isParsing}
								onClick={parseNlRule}
								className="absolute top-0.5 right-1 h-7 gap-1 text-xs"
								data-testid="branch-nl-add"
							>
								{isParsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
								{isParsing ? "Parsing…" : "Add"}
							</Button>
						</div>
						<p className="text-[10px] text-muted-foreground">
							Plain English works here. Example: If role is founder, go to the founder section.
						</p>
						{parseError && <p className="text-[10px] text-destructive">{parseError}</p>}
						{rules.length > 1 && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 text-xs"
								onClick={consolidateRules}
								disabled={!hasNormalizationOpportunity}
							>
								Normalize rules
							</Button>
						)}
						{rules.length > 1 && hasNormalizationOpportunity && (
							<p className="text-[10px] text-muted-foreground">
								Merge duplicate routes into one compound rule per target.
							</p>
						)}
					</div>

					{/* Existing rules */}
					{rules.map((rule, ruleIndex) => {
						const condition = rule.conditions.conditions[0];
						const isAiGenerated = rule.source === "ai_generated";
						const hasSummary = Boolean(rule.summary);
						const hasGuidance = Boolean(rule.guidance);
						const conditionQuestion = condition
							? (allQuestions.find((q) => q.id === condition.questionId) ?? question)
							: question;
						const conditionQuestionHasOptions =
							conditionQuestion.type === "single_select" || conditionQuestion.type === "multi_select";
						const conditionQuestionOptions = conditionQuestion.options ?? [];

						return (
							<div
								key={rule.id}
								className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-2"
								data-testid={`branch-rule-${ruleIndex}`}
							>
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
											value={condition?.questionId ?? question.id}
											onValueChange={(v) => updateConditionQuestionId(ruleIndex, v)}
										>
											<SelectTrigger
												className="h-6 min-w-[110px] max-w-[220px] text-xs"
												data-testid={`branch-rule-${ruleIndex}-condition-question`}
											>
												<SelectValue placeholder="Source question" />
											</SelectTrigger>
											<SelectContent>
												{conditionSourceQuestions.map((q, idx) => (
													<SelectItem key={q.id} value={q.id}>
														Q{idx + 1}: {q.prompt.slice(0, 30)}
														{q.prompt.length > 30 ? "…" : ""}
													</SelectItem>
												))}
											</SelectContent>
										</Select>

										<Select
											value={condition?.operator ?? "equals"}
											onValueChange={(v) => updateConditionOperator(ruleIndex, v as ConditionOperator)}
										>
											<SelectTrigger className="h-6 w-24 text-xs" data-testid={`branch-rule-${ruleIndex}-operator`}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="equals">equals</SelectItem>
												<SelectItem value="not_equals">doesn't equal</SelectItem>
												<SelectItem value="contains">contains</SelectItem>
												{conditionQuestionHasOptions && (
													<>
														<SelectItem value="selected">includes</SelectItem>
														<SelectItem value="not_selected">excludes</SelectItem>
													</>
												)}
												<SelectItem value="answered">is answered</SelectItem>
												<SelectItem value="not_answered">is not answered</SelectItem>
											</SelectContent>
										</Select>

										{condition?.operator !== "answered" &&
											condition?.operator !== "not_answered" &&
											(conditionQuestionHasOptions && conditionQuestionOptions.length > 0 ? (
												<Select
													value={(condition?.value as string) ?? ""}
													onValueChange={(v) => updateConditionValue(ruleIndex, v)}
												>
													<SelectTrigger
														className="h-6 min-w-[100px] max-w-[180px] text-xs"
														data-testid={`branch-rule-${ruleIndex}-value-select`}
													>
														<SelectValue placeholder="Select value" />
													</SelectTrigger>
													<SelectContent>
														{conditionQuestionOptions.map((opt) => (
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
													data-testid={`branch-rule-${ruleIndex}-value-input`}
												/>
											))}

										<span className="text-muted-foreground">→</span>

										<Select
											value={rule.action}
											onValueChange={(v) =>
												updateRule(ruleIndex, {
													action: v as "skip_to" | "end_survey",
													targetQuestionId: v === "skip_to" ? laterQuestions[0]?.id : undefined,
													targetSectionId: v === "skip_to" ? rule.targetSectionId : undefined,
												})
											}
										>
											<SelectTrigger className="h-6 w-24 text-xs" data-testid={`branch-rule-${ruleIndex}-action`}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="skip_to">Skip to</SelectItem>
												<SelectItem value="end_survey">End survey</SelectItem>
											</SelectContent>
										</Select>

										{rule.action === "skip_to" && (
											<Select
												value={rule.targetSectionId ? `section:${rule.targetSectionId}` : (rule.targetQuestionId ?? "")}
												onValueChange={(v) => {
													if (v.startsWith("section:")) {
														const sectionId = v.slice("section:".length);
														updateRule(ruleIndex, { targetSectionId: sectionId, targetQuestionId: undefined });
														return;
													}
													updateRule(ruleIndex, { targetQuestionId: v, targetSectionId: undefined });
												}}
											>
												<SelectTrigger
													className="h-6 max-w-[200px] text-xs"
													data-testid={`branch-rule-${ruleIndex}-target`}
												>
													<SelectValue placeholder="Select question or section" />
												</SelectTrigger>
												<SelectContent>
													{sections
														.filter((section) => {
															const startIndex = allQuestions.findIndex((q) => q.id === section.startQuestionId);
															return startIndex > questionIndex;
														})
														.map((section) => {
															const startIndex = allQuestions.findIndex((q) => q.id === section.startQuestionId);
															return (
																<SelectItem key={`section-${section.id}`} value={`section:${section.id}`}>
																	Section: {section.title} (starts Q{startIndex + 1})
																</SelectItem>
															);
														})}
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
												: (getTargetLabel(rule.targetQuestionId, rule.targetSectionId) ?? "skip to…")}
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
							data-testid="branch-add-manual-rule"
						>
							<Plus className="h-3 w-3" /> Add manual rule
						</button>
					)}
				</div>
			)}
		</div>
	);
}
