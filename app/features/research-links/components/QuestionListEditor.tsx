/**
 * Streamlined question list editor with Airtable-style layout.
 * Shows a clean list of questions (number + prompt + indicators).
 * Clicking a question opens a side drawer with all editing controls.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FileText,
  GitBranch,
  GripVertical,
  Image,
  Loader2,
  Paperclip,
  Plus,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type { ResearchLinkQuestion } from "../schemas";
import { createEmptyQuestion } from "../schemas";
import { getMediaType, isR2Key } from "../utils";
import { QuestionBranchingEditor } from "./QuestionBranchingEditor";
import { QuestionMediaEditor } from "./QuestionMediaEditor";

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
    return (
      <img
        src={src}
        alt=""
        className="h-7 w-7 shrink-0 rounded border border-border/50 object-cover"
      />
    );
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
  const [localValue, setLocalValue] = useState(() =>
    (options ?? []).join(", "),
  );

  // Sync from parent when options change externally
  useEffect(() => {
    setLocalValue((options ?? []).join(", "));
  }, [options]);

  const parseAndSync = () => {
    const parsed = localValue
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    onChange(parsed.length > 0 ? parsed : null);
  };

  // Show one option per line for readability
  const lineCount = Math.max(
    3,
    localValue.split(",").filter(Boolean).length + 1,
  );

  return (
    <Textarea
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={parseAndSync}
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
}) {
  // Image upload state
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
    null,
  );
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
        const response = await fetch(
          "/api/upload-image?category=survey-images",
          { method: "POST", body: formData },
        );
        const result = await response.json();
        if (!response.ok || !result.success)
          throw new Error(result.error || "Upload failed");
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
    [question, updateQuestion],
  );

  // Get the effective media URL (prefer mediaUrl, fall back to videoUrl)
  const effectiveMediaUrl = question.mediaUrl ?? question.videoUrl ?? null;

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
          <SheetDescription>
            Configure type, options, media, and branching logic.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {/* Question text */}
          <div className="space-y-1.5">
            <Label className="text-xs">Question text</Label>
            <Textarea
              value={question.prompt}
              placeholder="What would you like to ask?"
              onChange={(e) =>
                updateQuestion(question.id, { prompt: e.target.value })
              }
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
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={question.type}
                onValueChange={(value: ResearchLinkQuestion["type"]) => {
                  const updates: Partial<ResearchLinkQuestion> = {
                    type: value,
                  };
                  if (value === "single_select" || value === "multi_select") {
                    updates.options = question.options ?? [];
                    updates.likertScale = null;
                    updates.likertLabels = null;
                    updates.imageOptions = null;
                  } else if (value === "likert") {
                    updates.likertScale = question.likertScale ?? 5;
                    updates.likertLabels = question.likertLabels ?? {
                      low: "Strongly disagree",
                      high: "Strongly agree",
                    };
                    updates.options = null;
                    updates.imageOptions = null;
                  } else if (value === "image_select") {
                    updates.imageOptions = question.imageOptions ?? [
                      { label: "", imageUrl: "" },
                    ];
                    updates.options = null;
                    updates.likertScale = null;
                    updates.likertLabels = null;
                  } else {
                    updates.options = null;
                    updates.likertScale = null;
                    updates.likertLabels = null;
                    updates.imageOptions = null;
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
                  onCheckedChange={(checked) =>
                    updateQuestion(question.id, { required: checked })
                  }
                />
              </div>
            </div>
          </div>

          {/* Select options */}
          {(question.type === "single_select" ||
            question.type === "multi_select") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Options</Label>
                <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
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
                        const existingImageOptions =
                          question.imageOptions ?? [];
                        updateQuestion(question.id, {
                          options:
                            existingImageOptions.length > 0
                              ? existingImageOptions
                                  .map((o) => o.label)
                                  .filter(Boolean)
                              : null,
                          imageOptions: null,
                        });
                      }
                    }}
                    className="scale-75"
                  />
                  <Image className="h-3 w-3" />
                  With images
                </label>
              </div>
              {question.imageOptions?.length ? (
                <div className="space-y-2">
                  {question.imageOptions.map((option, optionIndex) => {
                    const uploadKey = `${question.id}-${optionIndex}`;
                    const isUploading = uploadingImageKey === uploadKey;
                    return (
                      <div
                        key={optionIndex}
                        className="flex items-center gap-2"
                      >
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
                            const nextOptions = [
                              ...(question.imageOptions ?? []),
                            ];
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
                            const nextOptions = [
                              ...(question.imageOptions ?? []),
                            ];
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
                            const nextOptions = (
                              question.imageOptions ?? []
                            ).filter((_, i) => i !== optionIndex);
                            updateQuestion(question.id, {
                              imageOptions:
                                nextOptions.length > 0
                                  ? nextOptions
                                  : [{ label: "", imageUrl: "" }],
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
                      const nextOptions = [
                        ...(question.imageOptions ?? []),
                        { label: "", imageUrl: "" },
                      ];
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
                  onChange={(options) =>
                    updateQuestion(question.id, { options })
                  }
                />
              )}

              {/* Allow "Other" write-in toggle */}
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
                <Switch
                  checked={Boolean(question.allowOther)}
                  onCheckedChange={(checked) =>
                    updateQuestion(question.id, { allowOther: checked })
                  }
                  className="scale-75"
                />
                <div>
                  <span className="font-medium text-sm">
                    Allow &quot;Other&quot;
                  </span>
                  <p className="text-muted-foreground text-xs">
                    Show a write-in text field for custom responses
                  </p>
                </div>
              </label>
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
                        const nextOptions = (
                          question.imageOptions ?? []
                        ).filter((_, i) => i !== optionIndex);
                        updateQuestion(question.id, {
                          imageOptions:
                            nextOptions.length > 0 ? nextOptions : null,
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
                  const nextOptions = [
                    ...(question.imageOptions ?? []),
                    { label: "", imageUrl: "" },
                  ];
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
              value={question.helperText ?? ""}
              onChange={(e) =>
                updateQuestion(question.id, {
                  helperText: e.target.value || null,
                })
              }
              onBlur={(e) =>
                updateQuestion(question.id, {
                  helperText: e.target.value.trim() || null,
                })
              }
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
                  value={effectiveMediaUrl ?? ""}
                  onChange={(e) =>
                    updateQuestion(question.id, {
                      mediaUrl: e.target.value || null,
                      videoUrl: e.target.value || null,
                    })
                  }
                  onBlur={(e) =>
                    updateQuestion(question.id, {
                      mediaUrl: e.target.value.trim() || null,
                      videoUrl: e.target.value.trim() || null,
                    })
                  }
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
              onChange={(branching) =>
                updateQuestion(question.id, { branching })
              }
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

interface QuestionListEditorProps {
  questions: ResearchLinkQuestion[];
  onChange: (next: ResearchLinkQuestion[]) => void;
  /** Required for media recording/upload functionality */
  listId?: string;
}

export function QuestionListEditor({
  questions,
  onChange,
  listId,
}: QuestionListEditorProps) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null,
  );

  const updateQuestion = useCallback(
    (id: string, updates: Partial<ResearchLinkQuestion>) => {
      onChange(
        questions.map((question) =>
          question.id === id
            ? {
                ...question,
                ...updates,
              }
            : question,
        ),
      );
    },
    [onChange, questions],
  );

  const removeQuestion = useCallback(
    (id: string) => {
      const remaining = questions
        .filter((question) => question.id !== id)
        .map((question) => {
          if (!question.branching) return question;
          const cleanedRules = question.branching.rules.filter((rule) => {
            if (rule.targetQuestionId === id) return false;
            if (rule.conditions.conditions.some((c) => c.questionId === id))
              return false;
            return true;
          });
          const cleanedDefaultNext =
            question.branching.defaultNext === id
              ? undefined
              : question.branching.defaultNext;
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
    [onChange, questions],
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
    [onChange, questions],
  );

  const addQuestion = useCallback(() => {
    const newQ = createEmptyQuestion();
    onChange([...questions, newQ]);
    // Auto-open the new question for editing
    setSelectedQuestionId(newQ.id);
  }, [onChange, questions]);

  const selectedIndex = questions.findIndex((q) => q.id === selectedQuestionId);
  const selectedQuestion = selectedIndex >= 0 ? questions[selectedIndex] : null;

  return (
    <div className="space-y-1">
      {/* Streamlined question list */}
      <AnimatePresence initial={false}>
        {questions.map((question, index) => {
          const hasBranching = Boolean(question.branching?.rules?.length);
          const hasMedia = Boolean(question.mediaUrl ?? question.videoUrl);
          const effectiveMediaUrl =
            question.mediaUrl ?? question.videoUrl ?? null;

          return (
            <motion.div
              key={question.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <button
                type="button"
                onClick={() => setSelectedQuestionId(question.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                  selectedQuestionId === question.id
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/40 bg-background hover:border-border/80 hover:bg-muted/30",
                )}
              >
                {/* Question number */}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted font-semibold text-foreground/60 text-xs tabular-nums">
                  {index + 1}
                </span>

                {/* Question text */}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    question.prompt
                      ? "text-foreground"
                      : "text-muted-foreground italic",
                  )}
                >
                  {question.prompt || "Untitled question"}
                </span>

                {/* Indicator badges */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {question.required && (
                    <span className="text-destructive text-xs">*</span>
                  )}
                  {question.type !== "auto" && (
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 font-normal text-[10px]"
                    >
                      {questionTypeLabel(question.type)}
                    </Badge>
                  )}
                  {hasBranching && (
                    <GitBranch className="h-3.5 w-3.5 text-violet-500" />
                  )}
                  {hasMedia && effectiveMediaUrl && (
                    <QuestionMediaThumbnail url={effectiveMediaUrl} />
                  )}
                  {question.allowOther && (
                    <FileText className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Add question button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 w-full border-border/60 border-dashed bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
        onClick={addQuestion}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add question
      </Button>

      {/* Side drawer for editing */}
      {selectedQuestion && (
        <QuestionEditDrawer
          question={selectedQuestion}
          questions={questions}
          index={selectedIndex}
          listId={listId}
          isOpen={selectedQuestionId !== null}
          onClose={() => setSelectedQuestionId(null)}
          updateQuestion={updateQuestion}
          removeQuestion={removeQuestion}
          moveQuestion={moveQuestion}
        />
      )}
    </div>
  );
}
