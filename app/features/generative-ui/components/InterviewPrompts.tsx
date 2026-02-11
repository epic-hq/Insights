/**
 * InterviewPrompts - Editable interview question checklist
 *
 * Features:
 * - Edit mode (default): Add, delete, edit text, reorder questions
 * - Interview mode: Check off questions as asked
 * - Drag to reorder (using framer-motion Reorder)
 * - Must-have indicator
 * - Streaming-friendly (data can populate incrementally)
 */

import { motion, Reorder } from "framer-motion";
import { Check, Eye, EyeOff, GripVertical, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export interface InterviewPrompt {
	id: string;
	text: string;
	status: "planned" | "answered" | "skipped";
	isMustHave?: boolean;
	category?: string;
}

export interface InterviewPromptsData {
	prompts?: InterviewPrompt[];
	title?: string;
	description?: string;
}

interface InterviewPromptsProps {
	data: InterviewPromptsData;
	isStreaming?: boolean;
	/** Edit mode allows add/delete/edit text. Interview mode shows checkboxes to mark as asked. */
	mode?: "edit" | "interview";
	onPromptsChange?: (prompts: InterviewPrompt[]) => void;
	/** A2UI action callback — fired on reorder, edit, delete, add, toggle, mark done, skip */
	onAction?: (actionName: string, payload?: Record<string, unknown>) => void;
}

export function InterviewPrompts({ data, isStreaming, mode = "edit", onPromptsChange, onAction }: InterviewPromptsProps) {
	const [prompts, setPrompts] = useState<InterviewPrompt[]>(data.prompts || []);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editText, setEditText] = useState("");
	const [newQuestionText, setNewQuestionText] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isDraggingRef = useRef(false);
	const latestPromptsRef = useRef(prompts);
	latestPromptsRef.current = prompts;

	// Sync with incoming data from parent (agent instructions or streaming)
	useEffect(() => {
		if (data.prompts) {
			const dataStr = JSON.stringify(data.prompts);
			const currentStr = JSON.stringify(prompts);
			if (dataStr !== currentStr) {
				setPrompts(data.prompts);
			}
		}
	}, [data.prompts]);

	// Focus textarea when editing starts
	useEffect(() => {
		if (editingId && textareaRef.current) {
			textareaRef.current.focus();
			textareaRef.current.select();
		}
	}, [editingId]);

	const updatePrompts = (newPrompts: InterviewPrompt[], actionName: string, actionPayload?: Record<string, unknown>) => {
		setPrompts(newPrompts);
		onPromptsChange?.(newPrompts);
		onAction?.(actionName, { ...actionPayload, promptCount: newPrompts.length });
	};

	const updatePrompt = (id: string, updates: Partial<InterviewPrompt>, actionName: string) => {
		const prompt = prompts.find((p) => p.id === id);
		updatePrompts(
			prompts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
			actionName,
			{ promptId: id, promptText: prompt?.text?.slice(0, 80) }
		);
	};

	// Interview mode actions
	const markDone = (id: string) => updatePrompt(id, { status: "answered" }, "markDone");
	const unmarkDone = (id: string) => updatePrompt(id, { status: "planned" }, "unmarkDone");
	const skip = (id: string) => updatePrompt(id, { status: "skipped" }, "skip");
	const unhide = (id: string) => updatePrompt(id, { status: "planned" }, "unhide");

	// Edit mode actions
	const startEdit = (prompt: InterviewPrompt) => {
		setEditingId(prompt.id);
		setEditText(prompt.text);
	};

	const saveEdit = () => {
		if (editingId && editText.trim()) {
			updatePrompt(editingId, { text: editText.trim() }, "editQuestion");
		}
		setEditingId(null);
		setEditText("");
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditText("");
	};

	const deletePrompt = (id: string) => {
		const prompt = prompts.find((p) => p.id === id);
		updatePrompts(
			prompts.filter((p) => p.id !== id),
			"deleteQuestion",
			{ promptId: id, promptText: prompt?.text?.slice(0, 80) }
		);
	};

	const toggleMustHave = (id: string) => {
		const prompt = prompts.find((p) => p.id === id);
		if (prompt) {
			updatePrompt(id, { isMustHave: !prompt.isMustHave }, "toggleMustHave");
		}
	};

	const addNewQuestion = () => {
		if (!newQuestionText.trim()) return;
		const newPrompt: InterviewPrompt = {
			id: `q-${Date.now()}`,
			text: newQuestionText.trim(),
			status: "planned",
			isMustHave: false,
		};
		updatePrompts(
			[...prompts, newPrompt],
			"addQuestion",
			{ promptText: newQuestionText.trim().slice(0, 80) }
		);
		setNewQuestionText("");
	};

	// During drag: only update local state for visual feedback (no persistence/agent)
	const handleReorder = (reordered: InterviewPrompt[]) => {
		isDraggingRef.current = true;
		setPrompts(reordered);
	};

	// On drop: fire the action once with final order
	const handleDragEnd = () => {
		if (!isDraggingRef.current) return;
		isDraggingRef.current = false;
		const current = latestPromptsRef.current;
		onPromptsChange?.(current);
		onAction?.("reorder", { newOrder: current.map((p) => p.id), promptCount: current.length });
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			saveEdit();
		}
		if (e.key === "Escape") {
			cancelEdit();
		}
	};

	const handleAddKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			addNewQuestion();
		}
	};

	const answeredCount = prompts.filter((p) => p.status === "answered").length;
	const visiblePrompts = prompts.filter((p) => p.status !== "skipped");
	const skippedPrompts = prompts.filter((p) => p.status === "skipped");

	return (
		<Card className={cn(isStreaming && "animate-pulse")}>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center justify-between text-base">
					<span>{data.title || "Interview Prompts"}</span>
					<span className="font-normal text-muted-foreground text-sm">
						{mode === "interview" ? `${answeredCount}/${prompts.length} asked` : `${prompts.length} questions`}
					</span>
				</CardTitle>
				{data.description && <p className="text-muted-foreground text-xs">{data.description}</p>}
			</CardHeader>
			<CardContent className="space-y-2">
				{prompts.length === 0 && (
					<p className="text-muted-foreground text-sm italic">
						{isStreaming ? "Loading prompts..." : "No prompts yet"}
					</p>
				)}

				<Reorder.Group axis="y" values={visiblePrompts} onReorder={handleReorder} className="space-y-2">
					{visiblePrompts.map((prompt, idx) => (
						<Reorder.Item
							key={prompt.id}
							value={prompt}
							className={cn("cursor-grab active:cursor-grabbing", editingId === prompt.id && "cursor-auto")}
							dragListener={editingId !== prompt.id}
							onDragEnd={handleDragEnd}
						>
							<motion.div
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: idx * 0.03 }}
								className={cn(
									"flex items-start gap-2 rounded-lg border bg-card p-2.5",
									prompt.status === "answered" && "bg-muted/50 opacity-70"
								)}
							>
								{/* Drag handle */}
								<div className="mt-0.5 cursor-grab text-muted-foreground/50 hover:text-muted-foreground">
									<GripVertical className="h-4 w-4" />
								</div>

								{/* Interview mode: Checkbox */}
								{mode === "interview" && (
									<Checkbox
										checked={prompt.status === "answered"}
										onCheckedChange={(checked) => {
											if (checked) markDone(prompt.id);
											else unmarkDone(prompt.id);
										}}
										className="mt-0.5"
									/>
								)}

								{/* Content */}
								<div className="min-w-0 flex-1">
									{editingId === prompt.id ? (
										<Textarea
											ref={textareaRef}
											value={editText}
											onChange={(e) => setEditText(e.target.value)}
											onKeyDown={handleKeyDown}
											onBlur={saveEdit}
											className="min-h-[60px] text-sm"
											placeholder="Enter your question..."
										/>
									) : (
										<div
											className={cn("group flex items-start gap-1.5", mode === "edit" && "cursor-text")}
											onClick={() => mode === "edit" && startEdit(prompt)}
										>
											<span
												className={cn(
													"text-sm leading-snug",
													prompt.status === "answered" && "text-muted-foreground line-through",
													mode === "edit" && "-mx-1 rounded px-1 transition-colors hover:bg-muted/50"
												)}
											>
												{prompt.text}
											</span>
											{prompt.isMustHave && <Star className="h-3 w-3 flex-shrink-0 fill-amber-400 text-amber-400" />}
										</div>
									)}
									{prompt.category && !editingId && (
										<span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
											{prompt.category}
										</span>
									)}
								</div>

								{/* Actions */}
								{mode === "edit" && editingId !== prompt.id && (
									<div className="flex items-center gap-1">
										<Button
											size="sm"
											variant="ghost"
											className={cn("h-6 w-6 p-0", prompt.isMustHave && "text-amber-500")}
											onClick={() => toggleMustHave(prompt.id)}
											title={prompt.isMustHave ? "Remove must-have" : "Mark as must-have"}
										>
											<Star className={cn("h-3 w-3", prompt.isMustHave && "fill-current")} />
										</Button>
										<Button
											size="sm"
											variant="ghost"
											className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
											onClick={() => deletePrompt(prompt.id)}
											title="Delete question"
										>
											<Trash2 className="h-3 w-3" />
										</Button>
									</div>
								)}

								{mode === "interview" && (
									<>
										{prompt.status !== "answered" && (
											<Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => skip(prompt.id)}>
												<EyeOff className="h-3 w-3" />
											</Button>
										)}
										{prompt.status === "answered" && <Check className="h-4 w-4 text-emerald-500" />}
									</>
								)}
							</motion.div>
						</Reorder.Item>
					))}
				</Reorder.Group>

				{/* Add new question (edit mode only) */}
				{mode === "edit" && (
					<div className="flex gap-2 pt-2">
						<Textarea
							value={newQuestionText}
							onChange={(e) => setNewQuestionText(e.target.value)}
							onKeyDown={handleAddKeyDown}
							placeholder="Add a new question..."
							className="min-h-[40px] flex-1 text-sm"
						/>
						<Button size="sm" onClick={addNewQuestion} disabled={!newQuestionText.trim()} className="h-auto">
							<Plus className="h-4 w-4" />
						</Button>
					</div>
				)}

				{/* Skipped section (interview mode) */}
				{mode === "interview" && skippedPrompts.length > 0 && (
					<div className="mt-4 border-t pt-3">
						<p className="mb-2 font-medium text-muted-foreground text-xs">Skipped ({skippedPrompts.length})</p>
						<div className="space-y-1">
							{skippedPrompts.map((prompt) => (
								<div
									key={prompt.id}
									className="flex items-center gap-2 rounded border border-dashed p-2 text-muted-foreground text-sm"
								>
									<span className="flex-1 truncate">{prompt.text}</span>
									<Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => unhide(prompt.id)}>
										<Eye className="mr-1 h-3 w-3" /> Show
									</Button>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
