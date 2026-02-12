/**
 * Survey Quick View Carousel
 *
 * Modal carousel for reviewing AI-generated personalized survey questions.
 * Shows one person's survey at a time with approve/skip/edit actions.
 * Keyboard nav: Arrow keys to navigate, Space to approve+advance.
 */

import { Check, ChevronLeft, ChevronRight, Pencil, SkipForward, Sparkles, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

interface SurveyQuestion {
	id: string;
	prompt: string;
	type: string;
	rationale?: string;
	uses_attributes?: string[];
	evidence_type?: string;
	order?: number;
}

export interface PersonalizedSurveyItem {
	id: string;
	personId: string;
	personName: string;
	personTitle?: string | null;
	personEmail?: string | null;
	surveyGoal: string;
	status: string;
	questions: SurveyQuestion[];
	generationMetadata?: {
		person_context?: {
			icp_band?: string;
			sparse_mode?: boolean;
		};
		generated_at?: string;
	};
}

interface SurveyQuickViewProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	surveys: PersonalizedSurveyItem[];
	onApprove: (surveyId: string) => void;
	onSkip: (surveyId: string) => void;
	onEditQuestion: (surveyId: string, questionId: string, newText: string) => void;
}

export function SurveyQuickView({
	open,
	onOpenChange,
	surveys,
	onApprove,
	onSkip,
	onEditQuestion,
}: SurveyQuickViewProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
	const [editText, setEditText] = useState("");

	const currentSurvey = surveys[currentIndex];
	const total = surveys.length;

	const goNext = useCallback(() => {
		setCurrentIndex((prev) => Math.min(prev + 1, total - 1));
		setEditingQuestionId(null);
	}, [total]);

	const goPrev = useCallback(() => {
		setCurrentIndex((prev) => Math.max(prev - 1, 0));
		setEditingQuestionId(null);
	}, []);

	const handleApprove = useCallback(() => {
		if (!currentSurvey) return;
		onApprove(currentSurvey.id);
		if (currentIndex < total - 1) {
			goNext();
		}
	}, [currentSurvey, currentIndex, total, onApprove, goNext]);

	const handleSkip = useCallback(() => {
		if (!currentSurvey) return;
		onSkip(currentSurvey.id);
		if (currentIndex < total - 1) {
			goNext();
		}
	}, [currentSurvey, currentIndex, total, onSkip, goNext]);

	const startEditing = useCallback((questionId: string, currentText: string) => {
		setEditingQuestionId(questionId);
		setEditText(currentText);
	}, []);

	const saveEdit = useCallback(() => {
		if (!currentSurvey || !editingQuestionId) return;
		onEditQuestion(currentSurvey.id, editingQuestionId, editText);
		setEditingQuestionId(null);
	}, [currentSurvey, editingQuestionId, editText, onEditQuestion]);

	// Keyboard navigation
	useEffect(() => {
		if (!open) return;

		const handler = (e: KeyboardEvent) => {
			// Don't capture keys when editing
			if (editingQuestionId) return;

			switch (e.key) {
				case "ArrowLeft":
					e.preventDefault();
					goPrev();
					break;
				case "ArrowRight":
					e.preventDefault();
					goNext();
					break;
				case " ":
					e.preventDefault();
					handleApprove();
					break;
				case "s":
					e.preventDefault();
					handleSkip();
					break;
				case "Escape":
					onOpenChange(false);
					break;
			}
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, editingQuestionId, goPrev, goNext, handleApprove, handleSkip, onOpenChange]);

	// Reset index when surveys change
	useEffect(() => {
		setCurrentIndex(0);
		setEditingQuestionId(null);
	}, [surveys.length]);

	if (!currentSurvey) return null;

	const initials = currentSurvey.personName
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	const goalColors: Record<string, string> = {
		validate: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
		discover: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
		deep_dive: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
		pricing: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<div className="flex items-center justify-between">
						<DialogTitle className="flex items-center gap-2">
							<Sparkles className="h-5 w-5 text-purple-500" />
							Survey Quick View
						</DialogTitle>
						<span className="text-muted-foreground text-sm">
							{currentIndex + 1} / {total}
						</span>
					</div>
					{/* Progress bar */}
					<div className="mt-2 h-1.5 w-full rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all duration-300"
							style={{
								width: `${((currentIndex + 1) / total) * 100}%`,
							}}
						/>
					</div>
				</DialogHeader>

				{/* Person header */}
				<div className="flex items-center gap-3 border-b py-3">
					<Avatar className="h-10 w-10">
						<AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium">{currentSurvey.personName}</p>
						{currentSurvey.personTitle && (
							<p className="truncate text-muted-foreground text-sm">{currentSurvey.personTitle}</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Badge variant="secondary" className={cn("text-xs", goalColors[currentSurvey.surveyGoal] || "")}>
							{currentSurvey.surveyGoal}
						</Badge>
						{currentSurvey.generationMetadata?.person_context?.icp_band && (
							<Badge variant="outline" className="text-xs">
								{currentSurvey.generationMetadata.person_context.icp_band} ICP
							</Badge>
						)}
						{currentSurvey.generationMetadata?.person_context?.sparse_mode && (
							<Badge variant="outline" className="border-amber-300 text-amber-600 text-xs">
								Sparse Data
							</Badge>
						)}
					</div>
				</div>

				{/* Questions */}
				<div className="space-y-3 py-2">
					{currentSurvey.questions
						.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
						.map((question, idx) => (
							<Card key={question.id} className="border-muted">
								<CardHeader className="px-4 py-2">
									<div className="flex items-start justify-between gap-2">
										<span className="font-medium text-muted-foreground text-xs">Q{idx + 1}</span>
										<div className="flex items-center gap-1">
											{question.evidence_type && (
												<Badge variant="outline" className="h-5 text-[10px]">
													{question.evidence_type}
												</Badge>
											)}
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6"
												onClick={() => startEditing(question.id, question.prompt)}
											>
												<Pencil className="h-3 w-3" />
											</Button>
										</div>
									</div>
								</CardHeader>
								<CardContent className="px-4 pt-0 pb-3">
									{editingQuestionId === question.id ? (
										<div className="space-y-2">
											<Textarea
												value={editText}
												onChange={(e) => setEditText(e.target.value)}
												className="min-h-[60px] text-sm"
												autoFocus
											/>
											<div className="flex gap-2">
												<Button size="sm" onClick={saveEdit}>
													Save
												</Button>
												<Button size="sm" variant="ghost" onClick={() => setEditingQuestionId(null)}>
													Cancel
												</Button>
											</div>
										</div>
									) : (
										<>
											<p className="text-sm">{question.prompt}</p>
											{question.rationale && (
												<p className="mt-1 text-muted-foreground text-xs italic">{question.rationale}</p>
											)}
										</>
									)}
								</CardContent>
							</Card>
						))}
				</div>

				{/* Navigation and actions */}
				<div className="flex items-center justify-between border-t pt-3">
					<div className="flex gap-2">
						<Button variant="outline" size="icon" onClick={goPrev} disabled={currentIndex === 0}>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button variant="outline" size="icon" onClick={goNext} disabled={currentIndex >= total - 1}>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex gap-2">
						<Button variant="ghost" size="sm" onClick={handleSkip}>
							<SkipForward className="mr-1 h-4 w-4" />
							Skip
							<kbd className="ml-1 rounded border px-1 text-[10px] text-muted-foreground">S</kbd>
						</Button>
						<Button size="sm" onClick={handleApprove}>
							<Check className="mr-1 h-4 w-4" />
							Approve
							<kbd className="ml-1 rounded border bg-primary-foreground/10 px-1 text-[10px]">Space</kbd>
						</Button>
					</div>
				</div>

				{/* Keyboard hints */}
				<p className="text-center text-[11px] text-muted-foreground">
					Arrow keys to navigate, Space to approve, S to skip, Esc to close
				</p>
			</DialogContent>
		</Dialog>
	);
}
