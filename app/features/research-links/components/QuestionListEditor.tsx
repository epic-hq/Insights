/**
 * Streamlined question list editor with Airtable-style layout.
 * Shows a clean list of questions (number + prompt + indicators).
 * Clicking a question opens a side drawer with all editing controls.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	BarChart3,
	ChevronDown as ChevronDownIcon,
	GitBranch,
	Image,
	Loader2,
	Paperclip,
	Plus,
	Sparkles,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRevalidator } from "react-router";
import { toast } from "sonner";
import { QuestionHoverResults } from "~/components/questions/QuestionHoverResults";
import { UnifiedQuestionList } from "~/components/questions/UnifiedQuestionList";
import { QuestionTypeBadge, UnifiedQuestionRow } from "~/components/questions/UnifiedQuestionRow";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type { ResearchLinkQuestion } from "../schemas";
import { createEmptyQuestion } from "../schemas";
import { getMediaType, isR2Key } from "../utils";
import { QuestionBranchingEditor } from "./QuestionBranchingEditor";
import { QuestionMediaEditor } from "./QuestionMediaEditor";

/** Format questions as clean text for clipboard */
function formatQuestionsForClipboard(questions: ResearchLinkQuestion[]): string {
	const lines: string[] = [];
	for (const [i, q] of questions.entries()) {
		if (q.hidden) continue;
		const num = i + 1;
		const typeLabel = questionTypeLabel(q.type);
		let line = `${num}. ${q.prompt || "(Untitled)"}`;
		if (q.type !== "auto") line += `  [${typeLabel}]`;
		if (q.required) line += "  *Required";
		lines.push(line);

		// Show options for select questions
		if ((q.type === "single_select" || q.type === "multi_select") && q.options?.length) {
			for (const opt of q.options) {
				lines.push(`   - ${opt}`);
			}
			if (q.allowOther) lines.push("   - Other (write-in)");
		}

		// Show likert scale
		if (q.type === "likert") {
			const scale = q.likertScale ?? 5;
			const low = q.likertLabels?.low ?? "1";
			const high = q.likertLabels?.high ?? String(scale);
			lines.push(`   Scale 1–${scale}: ${low} → ${high}`);
		}
	}
	return lines.join("\n");
}

/**
 * Tiny media thumbnail for the question list row.
 * Fetches a signed URL for R2 keys; shows an image preview for images,
 * or a type-appropriate icon for video/audio.
 */
function QuestionMediaThumbnail({ url }: { url: string }) {
	const [src, setSrc] = useState<string | null>(isR2Key(url) ? null : url);
	const type = getMediaType(url);

	useEffect(() => {
		if (!isR2Key(url)) {
			setSrc(url);
			return;
		}
		fetch(`/api/upload-image?key=${encodeURIComponent(url)}`)
			.then((r) => r.json())
			.then((d) => setSrc(d.url ?? null))
			.catch(() => setSrc(null));
	}, [url]);

	if (type === "image" && src) {
		return <img src={src} alt="" className="h-7 w-7 shrink-0 rounded border border-border/50 object-cover" />;
	}

	// For video/audio/unknown, show a colored icon
	return <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-500" />;
}

/**
 * Options input that manages local state and only parses on blur.
 * This allows users to type commas and spaces naturally.
 */
function OptionsInput({
	options,
	onChange,
}: {
	options: string[] | null;
	onChange: (options: string[] | null) => void;
}) {
	const serializedOptions = useMemo(() => (options ?? []).join(", "), [options]);
	const [localValue, setLocalValue] = useState(() => serializedOptions);
	const [isEditing, setIsEditing] = useState(false);

	// Sync from parent when options change externally
	useEffect(() => {
		if (!isEditing) {
			setLocalValue(serializedOptions);
		}
	}, [serializedOptions, isEditing]);

	const parseAndSync = () => {
		const parsed = localValue
			.split(",")
			.map((o) => o.trim())
			.filter(Boolean);
		onChange(parsed.length > 0 ? parsed : null);
	};

	// Show one option per line for readability
	const lineCount = Math.max(3, localValue.split(",").filter(Boolean).length + 1);

	return (
		<Textarea
			value={localValue}
			onChange={(e) => setLocalValue(e.target.value)}
			onFocus={() => setIsEditing(true)}
			onBlur={() => {
				setIsEditing(false);
				parseAndSync();
			}}
			placeholder="Options (comma separated)"
			className="text-xs"
			rows={lineCount}
		/>
	);
}

/** Human-readable question type label */
function questionTypeLabel(type: string): string {
	const labels: Record<string, string> = {
		auto: "Auto",
		short_text: "Short text",
		long_text: "Long text",
		single_select: "Select one",
		multi_select: "Select many",
		likert: "Likert scale",
		image_select: "Image select",
	};
	return labels[type] ?? type;
}

/**
 * Response Insights section for the question edit drawer.
 * Shows AI analysis results, key findings, and staleness info.
 */
function DrawerInsightsSection({
	aiInsight,
	responseCount,
	newSinceAnalysis,
	listId,
}: {
	aiInsight?: AiQuestionInsight;
	responseCount: number;
	newSinceAnalysis: number;
	listId?: string;
}) {
	const { accountId, projectId } = useParams();
	const revalidator = useRevalidator();
	const [expanded, setExpanded] = useState(true);
	const [analyzing, setAnalyzing] = useState(false);

	const handleReanalyze = async () => {
		if (!listId || !accountId || !projectId) return;
		setAnalyzing(true);
		try {
			const fd = new FormData();
			fd.set("listId", listId);
			fd.set("mode", "detailed");
			const res = await fetch(`/a/${accountId}/${projectId}/ask/api/analyze-responses`, { method: "POST", body: fd });
			if (!res.ok) throw new Error("Analysis failed");
			toast.success("Analysis complete");
			revalidator.revalidate();
		} catch {
			toast.error("Analysis failed — try again");
		} finally {
			setAnalyzing(false);
		}
	};

	const hasAiInsight = Boolean(aiInsight);
	const isStale = newSinceAnalysis > 0;

	return (
		<div className="rounded-lg border border-border/60 bg-muted/20">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center justify-between px-3 py-2"
			>
				<div className="flex items-center gap-1.5">
					<BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="font-medium text-xs">Response Insights</span>
					<span className="text-[10px] text-muted-foreground">
						({responseCount} response{responseCount !== 1 ? "s" : ""})
					</span>
					{isStale && hasAiInsight && (
						<span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
							<AlertTriangle className="h-2.5 w-2.5" />
							{newSinceAnalysis} new
						</span>
					)}
				</div>
				<ChevronDownIcon
					className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
				/>
			</button>

			{expanded && (
				<div className="space-y-3 border-t px-3 py-3">
					{hasAiInsight && aiInsight ? (
						<>
							{/* Summary */}
							<p className="text-foreground/80 text-xs leading-relaxed">{aiInsight.summary}</p>

							{/* Key findings */}
							{aiInsight.key_findings.length > 0 && (
								<div className="space-y-1">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
										Key findings
									</span>
									<ul className="space-y-0.5">
										{aiInsight.key_findings.map((finding: string, i: number) => (
											<li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/70">
												<span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
												{finding}
											</li>
										))}
									</ul>
								</div>
							)}

							{/* Answer distribution bars (for select/likert-type insights) */}
							{aiInsight.answer_distribution && aiInsight.answer_distribution.length > 0 && (
								<div className="space-y-1">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
										Distribution
									</span>
									{aiInsight.answer_distribution.map((item, i) => (
										<div key={i} className="flex items-center gap-2">
											<span className="w-24 truncate text-[10px] text-foreground/70">{item.answer}</span>
											<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
												<div className="h-full rounded-full bg-primary/60" style={{ width: `${item.percentage}%` }} />
											</div>
											<span className="w-8 text-right font-mono text-[9px] text-muted-foreground tabular-nums">
												{item.percentage}%
											</span>
										</div>
									))}
								</div>
							)}

							{/* Notable outliers */}
							{aiInsight.notable_outliers.length > 0 && (
								<div className="space-y-1">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
										Notable outliers
									</span>
									<ul className="space-y-0.5">
										{aiInsight.notable_outliers.map((outlier, i) => (
											<li key={i} className="text-[11px] text-foreground/60 italic">
												{outlier}
											</li>
										))}
									</ul>
								</div>
							)}

							{/* Stale / re-analyze */}
							{isStale && (
								<div className="flex items-center justify-between rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
									<span className="text-[10px] text-amber-700 dark:text-amber-400">
										Analysis from {analysisResponseCount(responseCount, newSinceAnalysis)} responses —{" "}
										{newSinceAnalysis} new since
									</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-6 text-[10px]"
										disabled={analyzing}
										onClick={handleReanalyze}
									>
										{analyzing ? (
											<Loader2 className="mr-1 h-3 w-3 animate-spin" />
										) : (
											<Sparkles className="mr-1 h-3 w-3" />
										)}
										Re-analyze
									</Button>
								</div>
							)}
						</>
					) : (
						<div className="flex flex-col items-center gap-2 py-2">
							<p className="text-center text-[11px] text-muted-foreground">
								{responseCount >= 3
									? "Run AI analysis to get insights for this question"
									: "Collect more responses to unlock AI insights"}
							</p>
							{responseCount >= 3 && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-7 text-xs"
									disabled={analyzing}
									onClick={handleReanalyze}
								>
									{analyzing ? (
										<Loader2 className="mr-1 h-3 w-3 animate-spin" />
									) : (
										<Sparkles className="mr-1 h-3 w-3" />
									)}
									Run AI Analysis
								</Button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/** Helper to compute analysis-time response count */
function analysisResponseCount(total: number, newSince: number): number {
	return total - newSince;
}

/**
 * Side-drawer panel for editing a single question's settings.
 */
function QuestionEditDrawer({
	question,
	questions,
	index,
	listId,
	isOpen,
	onClose,
	updateQuestion,
	removeQuestion,
	moveQuestion,
	aiInsight,
	responseCount,
	newSinceAnalysis,
	coachingFlag,
}: {
	question: ResearchLinkQuestion;
	questions: ResearchLinkQuestion[];
	index: number;
	listId?: string;
	isOpen: boolean;
	onClose: () => void;
	updateQuestion: (id: string, updates: Partial<ResearchLinkQuestion>) => void;
	removeQuestion: (id: string) => void;
	moveQuestion: (id: string, direction: -1 | 1) => void;
	aiInsight?: AiQuestionInsight;
	responseCount?: number;
	newSinceAnalysis?: number;
	coachingFlag?: { issue: string; summary: string; alternatives: string[] };
}) {
	// Image upload state
	const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const pendingUploadRef = useRef<{
		questionId: string;
		optionIndex: number;
	} | null>(null);

	const handleImageUpload = useCallback(
		async (file: File, questionId: string, optionIndex: number) => {
			if (!file.type.startsWith("image/")) return;
			const uploadKey = `${questionId}-${optionIndex}`;
			setUploadingImageKey(uploadKey);
			try {
				const formData = new FormData();
				formData.append("file", file);
				const response = await fetch("/api/upload-image?category=survey-images", { method: "POST", body: formData });
				const result = await response.json();
				if (!response.ok || !result.success) throw new Error(result.error || "Upload failed");
				if (question.imageOptions) {
					const nextOptions = [...question.imageOptions];
					nextOptions[optionIndex] = {
						...nextOptions[optionIndex],
						imageUrl: result.url,
					};
					updateQuestion(questionId, { imageOptions: nextOptions });
				}
			} catch (err) {
				console.error("Image upload failed:", err);
			} finally {
				setUploadingImageKey(null);
			}
		},
		[question, updateQuestion]
	);

	// Get the effective media URL (prefer mediaUrl, fall back to videoUrl)
	const effectiveMediaUrl = question.mediaUrl ?? question.videoUrl ?? null;
	const [promptDraft, setPromptDraft] = useState(question.prompt);
	const [helperTextDraft, setHelperTextDraft] = useState(question.helperText ?? "");
	const [mediaUrlDraft, setMediaUrlDraft] = useState(effectiveMediaUrl ?? "");
	const [isEditingPrompt, setIsEditingPrompt] = useState(false);
	const [isEditingHelperText, setIsEditingHelperText] = useState(false);
	const [isEditingMediaUrl, setIsEditingMediaUrl] = useState(false);

	useEffect(() => {
		if (!isEditingPrompt) {
			setPromptDraft(question.prompt);
		}
	}, [question.prompt, isEditingPrompt]);

	useEffect(() => {
		if (!isEditingHelperText) {
			setHelperTextDraft(question.helperText ?? "");
		}
	}, [question.helperText, isEditingHelperText]);

	useEffect(() => {
		if (!isEditingMediaUrl) {
			setMediaUrlDraft(effectiveMediaUrl ?? "");
		}
	}, [effectiveMediaUrl, isEditingMediaUrl]);

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 font-semibold text-primary text-xs tabular-nums">
							{index + 1}
						</span>
						Question Settings
					</SheetTitle>
					<SheetDescription>Configure type, options, media, and branching logic.</SheetDescription>
				</SheetHeader>

				<div className="space-y-5 px-4 pb-6">
					{/* Response Insights section */}
					{(responseCount ?? 0) > 0 && (
						<DrawerInsightsSection
							aiInsight={aiInsight}
							responseCount={responseCount ?? 0}
							newSinceAnalysis={newSinceAnalysis ?? 0}
							listId={listId}
						/>
					)}

					{/* Coaching flag — shown when AI coaching flagged this question */}
					{coachingFlag && (
						<div
							className={cn(
								"rounded-lg border px-3 py-2.5",
								["leading", "double_barreled", "closed_ended"].includes(coachingFlag.issue)
									? "border-red-500/20 bg-red-500/5"
									: "border-amber-500/20 bg-amber-500/5"
							)}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="space-y-1">
									<span
										className={cn(
											"font-medium text-xs",
											["leading", "double_barreled", "closed_ended"].includes(coachingFlag.issue)
												? "text-red-600 dark:text-red-400"
												: "text-amber-600 dark:text-amber-400"
										)}
									>
										{coachingFlag.issue.replace(/_/g, " ")}
									</span>
									<p className="text-[11px] text-foreground/70">{coachingFlag.summary}</p>
								</div>
							</div>
							{coachingFlag.alternatives.length > 0 && (
								<div className="mt-2 space-y-1">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
										Suggested alternatives
									</span>
									{coachingFlag.alternatives.map((alt: string, i: number) => (
										<button
											key={i}
											type="button"
											className="flex w-full items-center gap-2 rounded border border-border/40 bg-background px-2 py-1.5 text-left text-[11px] text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/5"
											onClick={() => updateQuestion(question.id, { prompt: alt })}
										>
											<Sparkles className="h-3 w-3 shrink-0 text-violet-500" />
											<span className="flex-1">{alt}</span>
											<span className="shrink-0 text-[9px] text-primary">Apply</span>
										</button>
									))}
								</div>
							)}
						</div>
					)}

					{/* Question text */}
					<div className="space-y-1.5">
						<Label className="text-xs">Question text</Label>
						<Textarea
							value={promptDraft}
							placeholder="What would you like to ask?"
							onFocus={() => setIsEditingPrompt(true)}
							onChange={(e) => {
								const next = e.target.value;
								setPromptDraft(next);
								updateQuestion(question.id, { prompt: next });
							}}
							onBlur={() => setIsEditingPrompt(false)}
							onInput={(e) => {
								const target = e.target as HTMLTextAreaElement;
								target.style.height = "auto";
								target.style.height = `${target.scrollHeight}px`;
							}}
							rows={2}
							className="resize-none text-sm"
						/>
					</div>

					{/* Type + Required */}
					<div className="flex items-center gap-3">
						<div className="flex-1 space-y-1.5">
							<Label className="text-xs">Type</Label>
							<Select
								value={question.type}
								onValueChange={(value: ResearchLinkQuestion["type"]) => {
									// Preserve existing field values when switching types so
									// options survive a round-trip (e.g. select one → likert → select one).
									// Only initialize defaults for fields the new type needs if empty.
									const updates: Partial<ResearchLinkQuestion> = {
										type: value,
									};
									if (value === "single_select" || value === "multi_select") {
										updates.options = question.options ?? [];
									} else if (value === "likert") {
										updates.likertScale = question.likertScale ?? 5;
										updates.likertLabels = question.likertLabels ?? {
											low: "Strongly disagree",
											high: "Strongly agree",
										};
									} else if (value === "image_select") {
										updates.imageOptions = question.imageOptions ?? [{ label: "", imageUrl: "" }];
									}
									updateQuestion(question.id, updates);
								}}
							>
								<SelectTrigger className="h-9 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="auto">Auto</SelectItem>
									<SelectItem value="short_text">Short text</SelectItem>
									<SelectItem value="long_text">Long text</SelectItem>
									<SelectItem value="single_select">Select one</SelectItem>
									<SelectItem value="multi_select">Select many</SelectItem>
									<SelectItem value="likert">Likert scale</SelectItem>
									<SelectItem value="image_select">Image select</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Required</Label>
							<div className="flex h-9 items-center">
								<Switch
									checked={question.required}
									onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })}
								/>
							</div>
						</div>
					</div>

					{/* Select options */}
					{(question.type === "single_select" || question.type === "multi_select") && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label className="text-xs">Options</Label>
								<div className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
									<Switch
										checked={Boolean(question.imageOptions?.length)}
										onCheckedChange={(checked) => {
											if (checked) {
												const existingOptions = question.options ?? [];
												updateQuestion(question.id, {
													imageOptions:
														existingOptions.length > 0
															? existingOptions.map((label) => ({
																	label,
																	imageUrl: "",
																}))
															: [{ label: "", imageUrl: "" }],
													options: null,
												});
											} else {
												const existingImageOptions = question.imageOptions ?? [];
												updateQuestion(question.id, {
													options:
														existingImageOptions.length > 0
															? existingImageOptions.map((o) => o.label).filter(Boolean)
															: null,
													imageOptions: null,
												});
											}
										}}
										className="scale-75"
									/>
									<Image className="h-3 w-3" />
									With images
								</div>
							</div>
							{question.imageOptions?.length ? (
								<div className="space-y-2">
									{question.imageOptions.map((option, optionIndex) => {
										const uploadKey = `${question.id}-${optionIndex}`;
										const isUploading = uploadingImageKey === uploadKey;
										return (
											<div key={optionIndex} className="flex items-center gap-2">
												<button
													type="button"
													onClick={() => {
														pendingUploadRef.current = {
															questionId: question.id,
															optionIndex,
														};
														imageInputRef.current?.click();
													}}
													disabled={isUploading}
													className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-border/50 bg-muted/30 transition-colors hover:border-border hover:bg-muted/50"
													title="Click to upload image"
												>
													{isUploading ? (
														<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
													) : option.imageUrl ? (
														<img
															src={option.imageUrl}
															alt={option.label || "Option"}
															className="h-full w-full object-cover"
														/>
													) : (
														<Upload className="h-4 w-4 text-muted-foreground/50" />
													)}
												</button>
												<Input
													value={option.label}
													onChange={(e) => {
														const nextOptions = [...(question.imageOptions ?? [])];
														nextOptions[optionIndex] = {
															...nextOptions[optionIndex],
															label: e.target.value,
														};
														updateQuestion(question.id, {
															imageOptions: nextOptions,
														});
													}}
													placeholder="Label"
													className="h-8 flex-1 text-xs"
												/>
												<Input
													value={option.imageUrl}
													onChange={(e) => {
														const nextOptions = [...(question.imageOptions ?? [])];
														nextOptions[optionIndex] = {
															...nextOptions[optionIndex],
															imageUrl: e.target.value,
														};
														updateQuestion(question.id, {
															imageOptions: nextOptions,
														});
													}}
													placeholder="Image URL or click thumbnail"
													className="h-8 flex-[2] text-xs"
												/>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-7 w-7 shrink-0 opacity-60 hover:text-destructive hover:opacity-100"
													onClick={() => {
														const nextOptions = (question.imageOptions ?? []).filter((_, i) => i !== optionIndex);
														updateQuestion(question.id, {
															imageOptions: nextOptions.length > 0 ? nextOptions : [{ label: "", imageUrl: "" }],
														});
													}}
												>
													<X className="h-3.5 w-3.5" />
												</Button>
											</div>
										);
									})}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 text-muted-foreground text-xs hover:text-foreground"
										onClick={() => {
											const nextOptions = [...(question.imageOptions ?? []), { label: "", imageUrl: "" }];
											updateQuestion(question.id, {
												imageOptions: nextOptions,
											});
										}}
									>
										<Plus className="mr-1 h-3 w-3" /> Add option
									</Button>
								</div>
							) : (
								<OptionsInput
									options={question.options ?? null}
									onChange={(options) => updateQuestion(question.id, { options })}
								/>
							)}

							{/* Allow "Other" write-in toggle */}
							<div className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
								<Switch
									checked={Boolean(question.allowOther)}
									onCheckedChange={(checked) => updateQuestion(question.id, { allowOther: checked })}
									className="scale-75"
								/>
								<div>
									<span className="font-medium text-sm">Allow &quot;Other&quot;</span>
									<span className="block text-muted-foreground text-xs">
										Show a write-in text field for custom responses
									</span>
								</div>
							</div>
						</div>
					)}

					{/* Likert scale config */}
					{question.type === "likert" && (
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Label className="text-xs">Scale</Label>
								<Select
									value={String(question.likertScale ?? 5)}
									onValueChange={(value) =>
										updateQuestion(question.id, {
											likertScale: Number(value),
										})
									}
								>
									<SelectTrigger className="h-8 w-20 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="3">1-3</SelectItem>
										<SelectItem value="5">1-5</SelectItem>
										<SelectItem value="7">1-7</SelectItem>
										<SelectItem value="10">1-10</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex gap-2">
								<Input
									value={question.likertLabels?.low ?? ""}
									onChange={(e) =>
										updateQuestion(question.id, {
											likertLabels: {
												...question.likertLabels,
												low: e.target.value || undefined,
											},
										})
									}
									placeholder="Low label (e.g., Strongly disagree)"
									className="h-8 text-xs"
								/>
								<Input
									value={question.likertLabels?.high ?? ""}
									onChange={(e) =>
										updateQuestion(question.id, {
											likertLabels: {
												...question.likertLabels,
												high: e.target.value || undefined,
											},
										})
									}
									placeholder="High label (e.g., Strongly agree)"
									className="h-8 text-xs"
								/>
							</div>
						</div>
					)}

					{/* Image select config */}
					{question.type === "image_select" && (
						<div className="space-y-2">
							<Label className="text-xs">Image options</Label>
							{(question.imageOptions ?? []).map((option, optionIndex) => {
								const uploadKey = `${question.id}-${optionIndex}`;
								const isUploading = uploadingImageKey === uploadKey;
								return (
									<div key={optionIndex} className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => {
												pendingUploadRef.current = {
													questionId: question.id,
													optionIndex,
												};
												imageInputRef.current?.click();
											}}
											disabled={isUploading}
											className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-border/50 bg-muted/30 transition-colors hover:border-border hover:bg-muted/50"
											title="Click to upload image"
										>
											{isUploading ? (
												<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
											) : option.imageUrl ? (
												<img
													src={option.imageUrl}
													alt={option.label || "Option"}
													className="h-full w-full object-cover"
												/>
											) : (
												<Upload className="h-4 w-4 text-muted-foreground/50" />
											)}
										</button>
										<Input
											value={option.label}
											onChange={(e) => {
												const nextOptions = [...(question.imageOptions ?? [])];
												nextOptions[optionIndex] = {
													...nextOptions[optionIndex],
													label: e.target.value,
												};
												updateQuestion(question.id, {
													imageOptions: nextOptions,
												});
											}}
											placeholder="Label"
											className="h-8 flex-1 text-xs"
										/>
										<Input
											value={option.imageUrl}
											onChange={(e) => {
												const nextOptions = [...(question.imageOptions ?? [])];
												nextOptions[optionIndex] = {
													...nextOptions[optionIndex],
													imageUrl: e.target.value,
												};
												updateQuestion(question.id, {
													imageOptions: nextOptions,
												});
											}}
											placeholder="Image URL or click thumbnail"
											className="h-8 flex-[2] text-xs"
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0 opacity-60 hover:text-destructive hover:opacity-100"
											onClick={() => {
												const nextOptions = (question.imageOptions ?? []).filter((_, i) => i !== optionIndex);
												updateQuestion(question.id, {
													imageOptions: nextOptions.length > 0 ? nextOptions : null,
												});
											}}
										>
											<X className="h-3.5 w-3.5" />
										</Button>
									</div>
								);
							})}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 text-muted-foreground text-xs hover:text-foreground"
								onClick={() => {
									const nextOptions = [...(question.imageOptions ?? []), { label: "", imageUrl: "" }];
									updateQuestion(question.id, { imageOptions: nextOptions });
								}}
							>
								<Plus className="mr-1 h-3 w-3" /> Add image option
							</Button>
						</div>
					)}

					{/* Helper text */}
					<div className="space-y-1.5">
						<Label className="text-xs">Helper text</Label>
						<Input
							value={helperTextDraft}
							onFocus={() => setIsEditingHelperText(true)}
							onChange={(e) => {
								const next = e.target.value;
								setHelperTextDraft(next);
								updateQuestion(question.id, {
									helperText: next || null,
								});
							}}
							onBlur={() => {
								setIsEditingHelperText(false);
								const trimmed = helperTextDraft.trim();
								setHelperTextDraft(trimmed);
								updateQuestion(question.id, {
									helperText: trimmed || null,
								});
							}}
							placeholder="Optional hint shown below the question"
							className="h-8 text-xs"
						/>
					</div>

					{/* Media attachment (generalized from video-only) */}
					<div className="space-y-1.5">
						<Label className="text-xs">Media attachment</Label>
						{listId ? (
							<QuestionMediaEditor
								listId={listId}
								questionId={question.id}
								existingMediaUrl={effectiveMediaUrl}
								onMediaChange={(url) =>
									updateQuestion(question.id, {
										mediaUrl: url,
										videoUrl: url,
									})
								}
							/>
						) : (
							<div className="flex items-center gap-2">
								<Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
								<Input
									value={mediaUrlDraft}
									onFocus={() => setIsEditingMediaUrl(true)}
									onChange={(e) => {
										const next = e.target.value;
										setMediaUrlDraft(next);
										updateQuestion(question.id, {
											mediaUrl: next || null,
											videoUrl: next || null,
										});
									}}
									onBlur={() => {
										setIsEditingMediaUrl(false);
										const trimmed = mediaUrlDraft.trim();
										setMediaUrlDraft(trimmed);
										updateQuestion(question.id, {
											mediaUrl: trimmed || null,
											videoUrl: trimmed || null,
										});
									}}
									placeholder="Media URL (image, video, or audio)"
									className="h-8 text-xs"
								/>
							</div>
						)}
					</div>

					{/* Branching / Skip Logic */}
					<div className="space-y-1.5">
						<QuestionBranchingEditor
							question={question}
							allQuestions={questions}
							questionIndex={index}
							onChange={(branching) => updateQuestion(question.id, { branching })}
						/>
					</div>

					{/* Actions bar */}
					<div className="flex items-center justify-between border-t pt-4">
						<div className="flex items-center gap-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={index === 0}
								onClick={() => moveQuestion(question.id, -1)}
							>
								<ArrowUp className="mr-1 h-3.5 w-3.5" />
								Move up
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={index === questions.length - 1}
								onClick={() => moveQuestion(question.id, 1)}
							>
								<ArrowDown className="mr-1 h-3.5 w-3.5" />
								Move down
							</Button>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={() => {
								removeQuestion(question.id);
								onClose();
							}}
						>
							<Trash2 className="mr-1 h-3.5 w-3.5" />
							Delete
						</Button>
					</div>
				</div>

				{/* Hidden file input for image uploads */}
				<input
					ref={imageInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={(e) => {
						const file = e.target.files?.[0];
						const pending = pendingUploadRef.current;
						if (file && pending) {
							handleImageUpload(file, pending.questionId, pending.optionIndex);
						}
						e.target.value = "";
						pendingUploadRef.current = null;
					}}
				/>
			</SheetContent>
		</Sheet>
	);
}

/** Per-question AI insight from BAML analysis */
interface AiQuestionInsight {
	question: string;
	summary: string;
	answer_distribution?: Array<{
		answer: string;
		count: number;
		percentage: number;
	}>;
	key_findings: string[];
	common_answers?: string[];
	notable_outliers: string[];
}

/** Parsed shape of the saved ai_analysis JSONB */
interface SavedAiAnalysis {
	mode?: string;
	updatedAt?: string;
	result?: {
		executive_summary?: string;
		question_insights?: AiQuestionInsight[];
		top_themes?: Array<{ theme: string; description: string }>;
	};
	responseCountAtAnalysis?: number;
	questionDropoff?: Record<string, { answered: number; total: number; completionPct: number }>;
}

interface QuestionListEditorProps {
	questions: ResearchLinkQuestion[];
	onChange: (next: ResearchLinkQuestion[]) => void;
	/** Required for media recording/upload functionality */
	listId?: string;
	/** Saved AI analysis data from loader */
	aiAnalysis?: SavedAiAnalysis | null;
	/** Current total response count */
	responseCount?: number;
}

export function QuestionListEditor({
	questions,
	onChange,
	listId,
	aiAnalysis,
	responseCount,
}: QuestionListEditorProps) {
	const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
	const [hoveredQuestionId, setHoveredQuestionId] = useState<string | null>(null);
	const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// AI analysis helpers
	const parsedAnalysis = aiAnalysis as SavedAiAnalysis | null | undefined;
	const questionInsights = parsedAnalysis?.result?.question_insights;
	const questionDropoff = parsedAnalysis?.questionDropoff;
	const analysisResponseCount = parsedAnalysis?.responseCountAtAnalysis ?? 0;
	const newSinceAnalysis = (responseCount ?? 0) - analysisResponseCount;

	/** Match a question to its AI insight by text or index */
	const getQuestionInsight = (questionText: string, questionIndex: number) => {
		if (!questionInsights) return undefined;
		if (questionInsights[questionIndex]) return questionInsights[questionIndex];
		return questionInsights.find((qi) => qi.question.toLowerCase().includes(questionText.toLowerCase().slice(0, 40)));
	};

	// Coaching state
	const [isCoaching, setIsCoaching] = useState(false);
	const [coachingFlags, setCoachingFlags] = useState<
		Map<number, { issue: string; summary: string; alternatives: string[] }>
	>(new Map());
	const [coachingNote, setCoachingNote] = useState<string | null>(null);

	/** Delayed hover — prevents flicker during drag and fast mouse sweeps */
	const handleMouseEnter = useCallback((questionId: string) => {
		if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = setTimeout(() => {
			setHoveredQuestionId(questionId);
		}, 300);
	}, []);

	const handleMouseLeave = useCallback(() => {
		if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = null;
		setHoveredQuestionId(null);
	}, []);

	const updateQuestion = useCallback(
		(id: string, updates: Partial<ResearchLinkQuestion>) => {
			onChange(
				questions.map((question) =>
					question.id === id
						? {
								...question,
								...updates,
							}
						: question
				)
			);
		},
		[onChange, questions]
	);

	const removeQuestion = useCallback(
		(id: string) => {
			const remaining = questions
				.filter((question) => question.id !== id)
				.map((question) => {
					if (!question.branching) return question;
					const cleanedRules = question.branching.rules.filter((rule) => {
						if (rule.targetQuestionId === id) return false;
						if (rule.conditions.conditions.some((c) => c.questionId === id)) return false;
						return true;
					});
					const cleanedDefaultNext = question.branching.defaultNext === id ? undefined : question.branching.defaultNext;
					if (cleanedRules.length === 0 && !cleanedDefaultNext) {
						return { ...question, branching: null };
					}
					return {
						...question,
						branching: { rules: cleanedRules, defaultNext: cleanedDefaultNext },
					};
				});
			onChange(remaining);
		},
		[onChange, questions]
	);

	const moveQuestion = useCallback(
		(id: string, direction: -1 | 1) => {
			const index = questions.findIndex((question) => question.id === id);
			if (index < 0) return;
			const newIndex = index + direction;
			if (newIndex < 0 || newIndex >= questions.length) return;
			const reordered = [...questions];
			const [item] = reordered.splice(index, 1);
			reordered.splice(newIndex, 0, item);
			onChange(reordered);
		},
		[onChange, questions]
	);

	const addQuestion = useCallback(() => {
		const newQ = createEmptyQuestion();
		onChange([...questions, newQ]);
		// Auto-open the new question for editing
		setSelectedQuestionId(newQ.id);
	}, [onChange, questions]);

	const selectedIndex = questions.findIndex((q) => q.id === selectedQuestionId);
	const selectedQuestion = selectedIndex >= 0 ? questions[selectedIndex] : null;

	const questionTypes = useMemo(() => questions.map((q) => q.type), [questions]);

	const handleCoach = useCallback(async () => {
		const questionTexts = questions.filter((q) => !q.hidden && q.prompt.trim()).map((q) => q.prompt);
		if (questionTexts.length === 0) {
			toast.error("Add some questions first");
			return;
		}
		setIsCoaching(true);
		setCoachingFlags(new Map());
		setCoachingNote(null);
		try {
			const res = await fetch("/api/coach-questions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					questions: questionTexts,
					context: "General research",
					mode: "survey",
				}),
			});
			if (!res.ok) throw new Error("Coaching failed");
			const result = await res.json();
			const flags = new Map<number, { issue: string; summary: string; alternatives: string[] }>();
			for (const nudge of result.nudges ?? []) {
				flags.set(nudge.questionIndex, {
					issue: nudge.issue,
					summary: nudge.summary,
					alternatives: nudge.alternatives ?? [],
				});
			}
			setCoachingFlags(flags);
			setCoachingNote(result.overallNote ?? result.totalTimeWarning ?? null);
			if (flags.size === 0) {
				toast.success("All questions look good!");
			} else {
				toast(`${flags.size} question${flags.size > 1 ? "s" : ""} flagged`);
			}
		} catch {
			toast.error("Coaching failed — try again");
		} finally {
			setIsCoaching(false);
		}
	}, [questions]);

	const handleCopy = useCallback(() => {
		const text = formatQuestionsForClipboard(questions);
		navigator.clipboard.writeText(text).then(
			() => toast.success("Questions copied to clipboard"),
			() => toast.error("Failed to copy")
		);
	}, [questions]);

	return (
		<UnifiedQuestionList
			count={questions.length}
			questionTypes={questionTypes}
			showTimeBar
			onAdd={addQuestion}
			onCopy={handleCopy}
			onCoach={handleCoach}
			isCoaching={isCoaching}
			hasBeenCoached={coachingFlags.size > 0 || coachingNote !== null}
			footer={
				coachingNote ? (
					<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-700 text-xs dark:text-amber-400">
						{coachingNote}
					</div>
				) : undefined
			}
		>
			{/* Question rows */}
			<AnimatePresence initial={false}>
				{questions.map((question, index) => {
					const hasBranching = Boolean(question.branching?.rules?.length);
					const hasMedia = Boolean(question.mediaUrl ?? question.videoUrl);
					const effectiveMediaUrl = question.mediaUrl ?? question.videoUrl ?? null;
					// Coaching flag for this question (1-based index)
					const coaching = coachingFlags.get(index + 1);
					const flagColor = coaching
						? ["leading", "double_barreled", "closed_ended"].includes(coaching.issue)
							? ("red" as const)
							: ("amber" as const)
						: undefined;
					return (
						<motion.div
							key={question.id}
							layout
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -4 }}
							transition={{ duration: 0.15 }}
							onMouseEnter={() => handleMouseEnter(question.id)}
							onMouseLeave={handleMouseLeave}
						>
							<UnifiedQuestionRow
								index={index + 1}
								text={question.prompt}
								isSelected={selectedQuestionId === question.id}
								onClick={() => setSelectedQuestionId(question.id)}
								flag={flagColor}
								dropoff={
									questionDropoff?.[question.id]
										? {
												completionPct: questionDropoff[question.id].completionPct,
											}
										: undefined
								}
							>
								{question.required && <span className="text-destructive text-xs">*</span>}
								<QuestionTypeBadge type={question.type} />
								{hasBranching && (
									<GitBranch
										className="h-3.5 w-3.5 text-violet-500"
										title={`${question.branching?.rules?.length} branching rule${(question.branching?.rules?.length ?? 0) > 1 ? "s" : ""}`}
									/>
								)}
								{hasMedia && effectiveMediaUrl && <QuestionMediaThumbnail url={effectiveMediaUrl} />}
							</UnifiedQuestionRow>
							{/* Coaching nudge — shown when AI flags an issue */}
							{coaching && (
								<div className="ml-12 flex items-start gap-2 py-1 text-[11px]">
									<span className={flagColor === "red" ? "text-red-500" : "text-amber-500"}>{coaching.summary}</span>
									{coaching.alternatives.length > 0 && (
										<button
											type="button"
											className="text-primary hover:underline"
											onClick={() =>
												updateQuestion(question.id, {
													prompt: coaching.alternatives[0],
												})
											}
										>
											Apply fix
										</button>
									)}
								</div>
							)}
							{/* Branching annotation — shows where this question branches to */}
							{hasBranching && question.branching?.rules && (
								<div className="ml-12 flex flex-wrap items-center gap-x-3 gap-y-0.5 py-0.5 text-[10px] text-violet-500">
									{question.branching.rules.map((rule) => {
										const targetIdx = rule.targetQuestionId
											? questions.findIndex((q) => q.id === rule.targetQuestionId) + 1
											: null;
										const label =
											rule.summary ??
											rule.label ??
											(rule.conditions.conditions[0]
												? `${rule.conditions.conditions[0].operator} "${rule.conditions.conditions[0].value ?? ""}"`
												: "rule");
										const target = rule.action === "end_survey" ? "end" : targetIdx ? `Q${targetIdx}` : "?";
										return (
											<span key={rule.id} className="whitespace-nowrap">
												If {label} → {target}
											</span>
										);
									})}
								</div>
							)}
							{/* Inline hover results — lazy-loaded on hover */}
							{listId && (
								<QuestionHoverResults
									questionId={question.id}
									questionType={question.type}
									listId={listId}
									isVisible={hoveredQuestionId === question.id}
									aiInsight={getQuestionInsight(question.prompt, index)}
								/>
							)}
						</motion.div>
					);
				})}
			</AnimatePresence>

			{/* Side drawer for editing */}
			{selectedQuestion && (
				<QuestionEditDrawer
					key={selectedQuestionId}
					question={selectedQuestion}
					questions={questions}
					index={selectedIndex}
					listId={listId}
					isOpen={selectedQuestionId !== null}
					onClose={() => setSelectedQuestionId(null)}
					updateQuestion={updateQuestion}
					removeQuestion={removeQuestion}
					moveQuestion={moveQuestion}
					aiInsight={getQuestionInsight(selectedQuestion.prompt, selectedIndex)}
					responseCount={responseCount}
					newSinceAnalysis={newSinceAnalysis}
					coachingFlag={coachingFlags.get(selectedIndex + 1)}
				/>
			)}
		</UnifiedQuestionList>
	);
}
