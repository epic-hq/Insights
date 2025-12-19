import consola from "consola"
import { ChevronDown, ChevronUp, Eye, Filter, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { createClient } from "~/lib/supabase/client"
import type { Database } from "~/types"

type AnswerStatus = Database["public"]["Tables"]["project_answers"]["Row"]["status"]

type MinimalQuestion = {
	projectAnswerId: string
	questionId: string | null
	text: string
	status: AnswerStatus
	orderIndex: number | null
	isMustHave: boolean
}

interface MinimalQuestionViewProps {
	projectId: string
	interviewId: string
}

function MinimalQuestionView({ projectId, interviewId }: MinimalQuestionViewProps) {
	const supabase = createClient()
	const [allQuestions, setAllQuestions] = useState<MinimalQuestion[]>([])
	const [loading, setLoading] = useState(true)
	const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
	const [mustHavesOnly, setMustHavesOnly] = useState(false)
	const [isCollapsed, setIsCollapsed] = useState(false)

	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	useEffect(() => {
		const load = async () => {
			try {
				setLoading(true)
				const { data, error } = await supabase
					.from("project_answers")
					.select(
						`
						id, 
						question_id, 
						question_text, 
						status, 
						order_index,
						prompt_id,
						interview_prompts(is_must_have)
					`
					)
					.eq("project_id", projectId)
					.eq("interview_id", interviewId)
					.order("order_index", { ascending: true, nullsFirst: true })
					.order("created_at", { ascending: true })

				if (error) throw error

				const mapped: MinimalQuestion[] = (data || []).map((row, idx) => ({
					projectAnswerId: row.id,
					questionId: row.question_id,
					text: row.question_text ?? `Question ${idx + 1}`,
					status: (row.status as AnswerStatus) ?? "planned",
					orderIndex: row.order_index ?? null,
					isMustHave: row.interview_prompts?.is_must_have ?? false,
				}))

				setAllQuestions(mapped)
			} catch (e) {
				consola.error("MinimalQuestionView load error", e)
			} finally {
				setLoading(false)
			}
		}

		void load()
	}, [interviewId, projectId, supabase])

	const updateStatus = useCallback(
		async (projectAnswerId: string, nextStatus: AnswerStatus) => {
			setSavingIds((prev) => new Set(prev).add(projectAnswerId))
			const previous = allQuestions
			setAllQuestions((prev) =>
				prev.map((q) => (q.projectAnswerId === projectAnswerId ? { ...q, status: nextStatus } : q))
			)

			const payload: Database["public"]["Tables"]["project_answers"]["Update"] = { status: nextStatus }
			if (nextStatus === "answered") {
				payload.answered_at = new Date().toISOString()
				payload.skipped_at = null
			} else if (nextStatus === "skipped") {
				payload.skipped_at = new Date().toISOString()
				payload.answered_at = null
			} else {
				payload.answered_at = null
				payload.skipped_at = null
			}

			const { error } = await supabase.from("project_answers").update(payload).eq("id", projectAnswerId)

			if (error) {
				consola.warn("Failed to update project answer status", error.message)
				setAllQuestions(previous)
			}

			setSavingIds((prev) => {
				const next = new Set(prev)
				next.delete(projectAnswerId)
				return next
			})
		},
		[allQuestions, supabase]
	)

	const markDone = useCallback(
		(projectAnswerId: string) => {
			void updateStatus(projectAnswerId, "answered")
		},
		[updateStatus]
	)

	const unmarkDone = useCallback(
		(projectAnswerId: string) => {
			void updateStatus(projectAnswerId, "planned")
		},
		[updateStatus]
	)

	const skip = useCallback(
		(projectAnswerId: string) => {
			void updateStatus(projectAnswerId, "skipped")
		},
		[updateStatus]
	)

	const unhide = useCallback(
		(projectAnswerId: string) => {
			void updateStatus(projectAnswerId, "planned")
		},
		[updateStatus]
	)

	const filteredQuestions = useMemo(() => {
		if (mustHavesOnly) {
			return allQuestions.filter((q) => q.isMustHave)
		}
		return allQuestions
	}, [allQuestions, mustHavesOnly])

	const answeredCount = filteredQuestions.filter((q) => q.status === "answered").length
	const totalCount = filteredQuestions.length
	const mustHaveCount = allQuestions.filter((q) => q.isMustHave).length

	const renderedQuestions = useMemo<JSX.Element[]>(() => {
		return filteredQuestions.map((q, idx) => {
			const isUpdating = savingIds.has(q.projectAnswerId)
			return (
				<div
					key={q.projectAnswerId}
					className={`touch-pan-y rounded-md border p-2 ${q.status === "answered" || q.status === "skipped" ? "opacity-60" : ""}`}
					style={{
						transform: "translateX(0px)",
						transition: "transform 0.2s ease-out",
					}}
				>
					<div className="space-y-1">
						<div className="flex items-start gap-2">
							<div className="flex items-center gap-2 pt-0.5">
								<Checkbox
									checked={q.status === "answered"}
									disabled={isUpdating}
									onCheckedChange={(checked) => {
										if (checked) {
											markDone(q.projectAnswerId)
										} else {
											unmarkDone(q.projectAnswerId)
										}
									}}
									className="h-4 w-4 border-2 border-gray-600 data-[state=checked]:border-primary data-[state=checked]:bg-primary dark:border-gray-300"
								/>
								<div className="flex items-center gap-1">
									<span className="font-medium text-muted-foreground text-sm">{idx + 1}</span>
									{q.isMustHave && <div className="h-2 w-2 rounded-full bg-red-500" title="Must-have question" />}
								</div>
							</div>
							<div className="min-w-0 flex-1">
								<div
									className={`text-sm leading-snug ${
										q.status === "answered"
											? "text-muted-foreground line-through"
											: q.status === "skipped"
												? "text-muted-foreground"
												: ""
									}`}
								>
									{q.text}
								</div>
							</div>
							{q.status === "skipped" && (
								<Button
									size="sm"
									variant="ghost"
									className="ml-2 h-6 px-2 text-xs"
									disabled={isUpdating}
									onClick={() => unhide(q.projectAnswerId)}
								>
									<Eye className="mr-1 h-3 w-3" /> Unhide
								</Button>
							)}
							{q.status !== "answered" && q.status !== "skipped" && (
								<Button
									size="sm"
									variant="ghost"
									className="ml-2 h-6 px-2 text-xs"
									disabled={isUpdating}
									onClick={() => skip(q.projectAnswerId)}
								>
									<X className="mr-1 h-3 w-3" /> Skip
								</Button>
							)}
						</div>
					</div>
				</div>
			)
		})
	}, [filteredQuestions, markDone, savingIds, skip, unhide, unmarkDone])

	return (
		<Card className="flex h-full flex-col border-0 px-0 md:border md:px-4">
			<CardHeader className="flex-shrink-0 px-2 sm:px-2 md:px-2">
				<CardTitle className="flex items-center justify-between gap-2 pr-2">
					<button
						type="button"
						onClick={() => setIsCollapsed(!isCollapsed)}
						className="flex items-center gap-1 hover:text-foreground"
					>
						{isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
						<span>Prompts</span>
					</button>
					<div className="flex items-center gap-2">
						{!isCollapsed && mustHaveCount > 0 && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setMustHavesOnly(!mustHavesOnly)}
											className={mustHavesOnly ? "border-orange-200 bg-orange-50" : ""}
										>
											<Filter className="h-4 w-4" />
											<span className="ml-1 hidden sm:inline">{mustHavesOnly ? "Show All" : "Filter"}</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										{mustHavesOnly ? "Show all questions" : "Show only must-have questions"}
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
						<div className="flex items-center gap-2 text-muted-foreground text-sm">
							{savingIds.size > 0 && <span>Saving…</span>}
							{totalCount > 0 && (
								<span>
									{answeredCount} of {totalCount}
								</span>
							)}
						</div>
					</div>
				</CardTitle>
			</CardHeader>
			{!isCollapsed && (
				<CardContent className="flex-1 space-y-3 overflow-y-auto px-0 md:px-2">
					{loading && <div className="text-muted-foreground text-sm">Loading…</div>}
					{!loading && allQuestions.length === 0 && (
						<div className="text-muted-foreground text-sm">
							No questions available yet. <Link to={routes.projects.setup()}>Configure</Link>
						</div>
					)}
					{!loading && allQuestions.length > 0 && renderedQuestions}
				</CardContent>
			)}
		</Card>
	)
}

export default MinimalQuestionView
