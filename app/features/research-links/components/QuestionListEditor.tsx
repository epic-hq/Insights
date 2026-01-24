import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Image,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import type { ResearchLinkQuestion } from "../schemas";
import { createEmptyQuestion } from "../schemas";
import { QuestionVideoEditor } from "./QuestionVideoEditor";

interface QuestionListEditorProps {
  questions: ResearchLinkQuestion[];
  onChange: (next: ResearchLinkQuestion[]) => void;
  /** Required for video recording/upload functionality */
  listId?: string;
}

export function QuestionListEditor({
  questions,
  onChange,
  listId,
}: QuestionListEditorProps) {
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
      onChange(questions.filter((question) => question.id !== id));
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
    onChange([...questions, createEmptyQuestion()]);
  }, [onChange, questions]);

  // Image upload state: tracks which option is uploading (questionId-optionIndex)
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
      if (!file.type.startsWith("image/")) {
        return;
      }

      const uploadKey = `${questionId}-${optionIndex}`;
      setUploadingImageKey(uploadKey);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          `/api/upload-image?category=survey-images`,
          {
            method: "POST",
            body: formData,
          },
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Upload failed");
        }

        // Update the question with the new image URL
        const question = questions.find((q) => q.id === questionId);
        if (question?.imageOptions) {
          const nextOptions = [...question.imageOptions];
          nextOptions[optionIndex] = {
            ...nextOptions[optionIndex],
            imageUrl: result.url,
          };
          updateQuestion(questionId, { imageOptions: nextOptions });
        }
      } catch (err) {
        // Silently fail - user can try again
        console.error("Image upload failed:", err);
      } finally {
        setUploadingImageKey(null);
      }
    },
    [questions, updateQuestion],
  );

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {questions.map((question, index) => (
          <motion.div
            key={question.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="group relative rounded-xl border border-border/60 bg-gradient-to-b from-muted/40 to-muted/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_2px_0_rgba(0,0,0,0.03)] ring-1 ring-black/[0.02] transition-all hover:border-border/80 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_4px_0_rgba(0,0,0,0.04)] dark:from-muted/30 dark:to-muted/15 dark:ring-white/[0.02]">
              <div className="flex items-center justify-between border-border/30 border-b px-3 py-2">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <GripVertical
                    className="h-3.5 w-3.5 opacity-50 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                  <span className="font-semibold text-foreground/70 tabular-nums">
                    {index + 1}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-60 hover:opacity-100"
                    disabled={index === 0}
                    onClick={() => moveQuestion(question.id, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-60 hover:opacity-100"
                    disabled={index === questions.length - 1}
                    onClick={() => moveQuestion(question.id, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-60 hover:text-destructive hover:opacity-100"
                    onClick={() => removeQuestion(question.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-3 px-3 py-3">
                <Textarea
                  id={`question-${question.id}`}
                  value={question.prompt}
                  placeholder="What would you like to ask?"
                  onChange={(event) =>
                    updateQuestion(question.id, { prompt: event.target.value })
                  }
                  onInput={(event) => {
                    // Auto-expand to fit content
                    const target = event.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                  required
                  rows={1}
                  className="min-h-[2.5rem] resize-none text-sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={question.type}
                    onValueChange={(value: ResearchLinkQuestion["type"]) => {
                      const updates: Partial<ResearchLinkQuestion> = {
                        type: value,
                      };
                      if (
                        value === "single_select" ||
                        value === "multi_select"
                      ) {
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
                    <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="short_text">Short</SelectItem>
                      <SelectItem value="long_text">Long</SelectItem>
                      <SelectItem value="single_select">Select one</SelectItem>
                      <SelectItem value="multi_select">Select many</SelectItem>
                      <SelectItem value="likert">Likert scale</SelectItem>
                      <SelectItem value="image_select">Image select</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
                    <Switch
                      checked={question.required}
                      onCheckedChange={(checked) =>
                        updateQuestion(question.id, { required: checked })
                      }
                      className="scale-75"
                    />
                    Required
                  </label>
                </div>
                {(question.type === "single_select" ||
                  question.type === "multi_select") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
                        <Switch
                          checked={Boolean(question.imageOptions?.length)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              // Convert text options to image options
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
                              // Convert image options back to text options
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
                        Add images
                      </label>
                    </div>
                    {question.imageOptions?.length ? (
                      // Image options mode
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
                                onChange={(event) => {
                                  const nextOptions = [
                                    ...(question.imageOptions ?? []),
                                  ];
                                  nextOptions[optionIndex] = {
                                    ...nextOptions[optionIndex],
                                    label: event.target.value,
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
                                onChange={(event) => {
                                  const nextOptions = [
                                    ...(question.imageOptions ?? []),
                                  ];
                                  nextOptions[optionIndex] = {
                                    ...nextOptions[optionIndex],
                                    imageUrl: event.target.value,
                                  };
                                  updateQuestion(question.id, {
                                    imageOptions: nextOptions,
                                  });
                                }}
                                placeholder="Image URL or click thumbnail to upload"
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
                      // Text options mode
                      <Input
                        value={(question.options ?? []).join(", ")}
                        onChange={(event) => {
                          const nextOptions = event.target.value
                            .split(",")
                            .map((o) => o.trim())
                            .filter(Boolean);
                          updateQuestion(question.id, {
                            options:
                              nextOptions.length > 0 ? nextOptions : null,
                          });
                        }}
                        placeholder="Options (comma separated)"
                        className="h-8 text-xs"
                      />
                    )}
                  </div>
                )}
                {question.type === "likert" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        Scale:
                      </span>
                      <Select
                        value={String(question.likertScale ?? 5)}
                        onValueChange={(value) =>
                          updateQuestion(question.id, {
                            likertScale: Number(value),
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
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
                        onChange={(event) =>
                          updateQuestion(question.id, {
                            likertLabels: {
                              ...question.likertLabels,
                              low: event.target.value || undefined,
                            },
                          })
                        }
                        placeholder="Low label (e.g., Strongly disagree)"
                        className="h-8 text-xs"
                      />
                      <Input
                        value={question.likertLabels?.high ?? ""}
                        onChange={(event) =>
                          updateQuestion(question.id, {
                            likertLabels: {
                              ...question.likertLabels,
                              high: event.target.value || undefined,
                            },
                          })
                        }
                        placeholder="High label (e.g., Strongly agree)"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
                {question.type === "image_select" && (
                  <div className="space-y-2">
                    <div className="text-muted-foreground text-xs">
                      Image options:
                    </div>
                    {(question.imageOptions ?? []).map(
                      (option, optionIndex) => {
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
                              onChange={(event) => {
                                const nextOptions = [
                                  ...(question.imageOptions ?? []),
                                ];
                                nextOptions[optionIndex] = {
                                  ...nextOptions[optionIndex],
                                  label: event.target.value,
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
                              onChange={(event) => {
                                const nextOptions = [
                                  ...(question.imageOptions ?? []),
                                ];
                                nextOptions[optionIndex] = {
                                  ...nextOptions[optionIndex],
                                  imageUrl: event.target.value,
                                };
                                updateQuestion(question.id, {
                                  imageOptions: nextOptions,
                                });
                              }}
                              placeholder="Image URL or click thumbnail to upload"
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
                      },
                    )}
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
                      <Plus className="mr-1 h-3 w-3" /> Add image option
                    </Button>
                  </div>
                )}
                {/* Helper text / hint shown below question */}
                <Input
                  value={question.helperText ?? ""}
                  onChange={(event) =>
                    updateQuestion(question.id, {
                      helperText: event.target.value || null,
                    })
                  }
                  onBlur={(event) =>
                    updateQuestion(question.id, {
                      helperText: event.target.value.trim() || null,
                    })
                  }
                  placeholder="Helper text (optional hint shown below question)"
                  className="h-8 text-xs placeholder:text-muted-foreground"
                />
                {/* Video prompt - record, upload, or URL */}
                {listId ? (
                  <QuestionVideoEditor
                    listId={listId}
                    questionId={question.id}
                    existingVideoUrl={question.videoUrl}
                    onVideoChange={(videoUrl) =>
                      updateQuestion(question.id, { videoUrl })
                    }
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Input
                      value={question.videoUrl ?? ""}
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          videoUrl: event.target.value || null,
                        })
                      }
                      onBlur={(event) =>
                        updateQuestion(question.id, {
                          videoUrl: event.target.value.trim() || null,
                        })
                      }
                      placeholder="Video URL (optional intro video for this question)"
                      className="h-8 text-xs placeholder:text-muted-foreground"
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-border/60 border-dashed bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
        onClick={addQuestion}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add question
      </Button>
      {/* Hidden file input for image uploads */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const pending = pendingUploadRef.current;
          if (file && pending) {
            handleImageUpload(file, pending.questionId, pending.optionIndex);
          }
          event.target.value = "";
          pendingUploadRef.current = null;
        }}
      />
    </div>
  );
}
