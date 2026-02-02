/**
 * InterviewPrompts - Streamable interview question checklist
 *
 * Features:
 * - Checkable prompts (mark as done)
 * - Skip/unhide
 * - Drag to reorder (using native HTML5 DnD)
 * - Must-have indicator
 * - Streaming-friendly (data can populate incrementally)
 */

import { motion, Reorder } from "framer-motion";
import { Check, Eye, EyeOff, GripVertical, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
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
  onPromptsChange?: (prompts: InterviewPrompt[]) => void;
}

export function InterviewPrompts({
  data,
  isStreaming,
  onPromptsChange,
}: InterviewPromptsProps) {
  const [prompts, setPrompts] = useState<InterviewPrompt[]>(data.prompts || []);

  // Sync with incoming data when streaming
  if (data.prompts && data.prompts.length !== prompts.length) {
    setPrompts(data.prompts);
  }

  const updatePrompt = (id: string, updates: Partial<InterviewPrompt>) => {
    const updated = prompts.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    setPrompts(updated);
    onPromptsChange?.(updated);
  };

  const markDone = (id: string) => updatePrompt(id, { status: "answered" });
  const unmarkDone = (id: string) => updatePrompt(id, { status: "planned" });
  const skip = (id: string) => updatePrompt(id, { status: "skipped" });
  const unhide = (id: string) => updatePrompt(id, { status: "planned" });

  const handleReorder = (reordered: InterviewPrompt[]) => {
    setPrompts(reordered);
    onPromptsChange?.(reordered);
  };

  const answeredCount = prompts.filter((p) => p.status === "answered").length;
  const visiblePrompts = prompts.filter((p) => p.status !== "skipped");
  const skippedPrompts = prompts.filter((p) => p.status === "skipped");

  return (
    <Card className={cn(isStreaming && "animate-pulse")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{data.title || "Interview Prompts"}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {answeredCount}/{prompts.length} done
          </span>
        </CardTitle>
        {data.description && (
          <p className="text-xs text-muted-foreground">{data.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {prompts.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            {isStreaming ? "Loading prompts..." : "No prompts yet"}
          </p>
        )}

        <Reorder.Group
          axis="y"
          values={visiblePrompts}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {visiblePrompts.map((prompt, idx) => (
            <Reorder.Item
              key={prompt.id}
              value={prompt}
              className="cursor-grab active:cursor-grabbing"
            >
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "flex items-start gap-2 rounded-lg border bg-card p-2.5",
                  prompt.status === "answered" && "bg-muted/50 opacity-70",
                )}
              >
                {/* Drag handle */}
                <div className="mt-0.5 cursor-grab text-muted-foreground/50 hover:text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>

                {/* Checkbox */}
                <Checkbox
                  checked={prompt.status === "answered"}
                  onCheckedChange={(checked) => {
                    if (checked) markDone(prompt.id);
                    else unmarkDone(prompt.id);
                  }}
                  className="mt-0.5"
                />

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    <span
                      className={cn(
                        "text-sm leading-snug",
                        prompt.status === "answered" &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {prompt.text}
                    </span>
                    {prompt.isMustHave && (
                      <Star className="h-3 w-3 flex-shrink-0 fill-amber-400 text-amber-400" />
                    )}
                  </div>
                  {prompt.category && (
                    <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {prompt.category}
                    </span>
                  )}
                </div>

                {/* Actions */}
                {prompt.status !== "answered" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => skip(prompt.id)}
                  >
                    <EyeOff className="h-3 w-3" />
                  </Button>
                )}
                {prompt.status === "answered" && (
                  <Check className="h-4 w-4 text-emerald-500" />
                )}
              </motion.div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {/* Skipped section */}
        {skippedPrompts.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Skipped ({skippedPrompts.length})
            </p>
            <div className="space-y-1">
              {skippedPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex items-center gap-2 rounded border border-dashed p-2 text-sm text-muted-foreground"
                >
                  <span className="flex-1 truncate">{prompt.text}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => unhide(prompt.id)}
                  >
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
