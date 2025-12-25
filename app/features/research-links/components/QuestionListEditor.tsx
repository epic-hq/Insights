import { AnimatePresence, motion } from "framer-motion"
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react"
import { useCallback } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import type { ResearchLinkQuestion } from "../schemas"
import { createEmptyQuestion } from "../schemas"

interface QuestionListEditorProps {
	questions: ResearchLinkQuestion[]
	onChange: (next: ResearchLinkQuestion[]) => void
}

export function QuestionListEditor({ questions, onChange }: QuestionListEditorProps) {
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
			)
		},
		[onChange, questions]
	)

	const removeQuestion = useCallback(
		(id: string) => {
			onChange(questions.filter((question) => question.id !== id))
		},
		[onChange, questions]
	)

	const moveQuestion = useCallback(
		(id: string, direction: -1 | 1) => {
			const index = questions.findIndex((question) => question.id === id)
			if (index < 0) return
			const newIndex = index + direction
			if (newIndex < 0 || newIndex >= questions.length) return
			const reordered = [...questions]
			const [item] = reordered.splice(index, 1)
			reordered.splice(newIndex, 0, item)
			onChange(reordered)
		},
		[onChange, questions]
	)

	const addQuestion = useCallback(() => {
		onChange([...questions, createEmptyQuestion()])
	}, [onChange, questions])

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
									<span className="font-semibold text-foreground/70 tabular-nums">{index + 1}</span>
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
									onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })}
									required
									rows={2}
									className="resize-none text-sm"
								/>
								<div className="flex flex-wrap items-center gap-2">
									<Select
										value={question.type}
										onValueChange={(value: ResearchLinkQuestion["type"]) =>
											updateQuestion(question.id, {
												type: value,
												options:
													value === "single_select" || value === "multi_select" ? (question.options ?? []) : null,
											})
										}
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
										</SelectContent>
									</Select>
									<label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
										<Switch
											checked={question.required}
											onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })}
											className="scale-75"
										/>
										Required
									</label>
								</div>
								{(question.type === "single_select" || question.type === "multi_select") && (
									<Input
										value={(question.options ?? []).join(", ")}
										onChange={(event) => {
											const nextOptions = event.target.value
												.split(",")
												.map((o) => o.trim())
												.filter(Boolean)
											updateQuestion(question.id, {
												options: nextOptions.length > 0 ? nextOptions : null,
											})
										}}
										placeholder="Options (comma separated)"
										className="h-8 text-xs"
									/>
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
		</div>
	)
}
