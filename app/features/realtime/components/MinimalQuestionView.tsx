import consola from "consola"
import { X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { createClient } from "~/lib/supabase/client"

type MinimalQuestion = {
	id: string
	text: string
	status?: "proposed" | "asked" | "answered" | "skipped" | "rejected"
}

interface MinimalQuestionViewProps {
	projectId: string
}

export function MinimalQuestionView({ projectId }: MinimalQuestionViewProps) {
	const supabase = createClient()
	const [allQuestions, setAllQuestions] = useState<MinimalQuestion[]>([])
	const [rawMeta, setRawMeta] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)

	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Local ordering queue; store ids to manage defers
	const [queue, setQueue] = useState<string[]>([])

	useEffect(() => {
		const load = async () => {
			try {
				setLoading(true)
				const { data, error } = await supabase
					.from("project_sections")
					.select("meta")
					.eq("project_id", projectId)
					.eq("kind", "questions")
					.maybeSingle()
				if (error) throw error
				setRawMeta(data?.meta || {})
				const q = (data?.meta?.questions || []) as any[]
				const normalizedRaw = q.map((x) => ({
					id: x.id,
					text: (x as any).question || x.text || "",
					status: x.status || "proposed",
					selectedOrder: (x as any).selectedOrder ?? null,
					isSelected: (x as any).isSelected ?? false,
				}))
				// Dedupe by id while preserving order
				const seen = new Set<string>()
				const deduped: (MinimalQuestion & { selectedOrder: number | null; isSelected: boolean })[] = []
				for (const item of normalizedRaw) {
					if (!item.id) continue
					if (seen.has(item.id)) continue
					seen.add(item.id)
					deduped.push(item)
				}
				// Build ordered list: prefer selected (by selectedOrder), fallback to remaining in original order
				const selected = deduped
					.filter((q) => q.isSelected || typeof q.selectedOrder === "number")
					.sort((a, b) => (a.selectedOrder ?? 1e9) - (b.selectedOrder ?? 1e9))
				const selectedIds = new Set(selected.map((q) => q.id))
				const remaining = deduped.filter((q) => !selectedIds.has(q.id))
				const ordered = [...selected, ...remaining].map(({ id, text, status }) => ({ id, text, status }))
				setAllQuestions(ordered)
				setQueue(ordered.map((q) => q.id))
			} catch (e) {
				consola.error("MinimalQuestionView load error", e)
			} finally {
				setLoading(false)
			}
		}
		void load()
	}, [projectId, supabase])

	const activeQuestions = useMemo(() => {
		const byId = new Map(allQuestions.map((q) => [q.id, q]))
		const seen = new Set<string>()
		const questionsToShow = [] as string[]

		// Show all questions - answered questions first, then unanswered
		for (const id of queue) {
			if (seen.has(id)) continue
			const q = byId.get(id)
			if (!q) continue
			if (q.status === "answered") {
				seen.add(id)
				questionsToShow.push(id)
			}
		}

		// Then add all unanswered questions (not skipped)
		for (const id of queue) {
			if (seen.has(id)) continue
			const q = byId.get(id)
			if (!q) continue
			if (q.status !== "answered" && q.status !== "skipped") {
				seen.add(id)
				questionsToShow.push(id)
			}
		}

		return questionsToShow.map((id) => byId.get(id)).filter((q): q is MinimalQuestion => q !== undefined)
	}, [allQuestions, queue])

	const persist = useCallback(
		async (next: MinimalQuestion[]) => {
			try {
				setSaving(true)
				const merged = { ...(rawMeta || {}), questions: next }
				await supabase
					.from("project_sections")
					.update({ meta: merged })
					.eq("project_id", projectId)
					.eq("kind", "questions")
			} catch (e) {
				consola.warn("MinimalQuestionView persist error", e)
			} finally {
				setSaving(false)
			}
		},
		[projectId, rawMeta, supabase]
	)

	const markDone = useCallback(
		(id: string) => {
			setAllQuestions((prev) => {
				const next = prev.map((q) => (q.id === id ? { ...q, status: "answered" as const } : q))
				void persist(next)
				return next
			})
		},
		[persist]
	)

	const unmarkDone = useCallback(
		(id: string) => {
			setAllQuestions((prev) => {
				const next = prev.map((q) => (q.id === id ? { ...q, status: "proposed" as const } : q))
				void persist(next)
				return next
			})
		},
		[persist]
	)

	const skip = useCallback(
		(id: string) => {
			setAllQuestions((prev) => {
				const next = prev.map((q) => (q.id === id ? { ...q, status: "skipped" as const } : q))
				void persist(next)
				return next
			})
		},
		[persist]
	)


	// Calculate answered count
	const answeredCount = allQuestions.filter((q) => q.status === "answered").length
	const totalCount = allQuestions.length

	return (
		<Card className="flex h-full flex-col border-0 px-0 md:border-1 md:px-4">
			<CardHeader className="flex-shrink-0 px-2 sm:px-2 md:px-2">
				<CardTitle className="flex items-center justify-between pr-2">
					<span>Prompts</span>
					{saving && <span className="text-muted-foreground text-xs">Saving…</span>}
					{totalCount > 0 && (
						<div className="text-muted-foreground text-sm">
							{answeredCount} of {totalCount}
						</div>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 space-y-3 overflow-y-auto px-2 sm:px-2 md:px-2">
				{loading && <div className="text-muted-foreground text-sm">Loading…</div>}
				{!loading && allQuestions.length === 0 && (
					<div className="text-muted-foreground text-sm">
						No questions available yet.&nbsp;
						<Link to={routes.projects.setup()}> Configure</Link>
					</div>
				)}
				{!loading && allQuestions.length > 0 && activeQuestions.length === 0 && (
					<div className="text-muted-foreground text-sm">All questions completed. Great job!</div>
				)}
				{activeQuestions.map((q, idx) => (
					<div
						key={q.id}
						className="touch-pan-y rounded-md border p-2 md:p-4 "
						style={{
							transform: "translateX(0px)",
							transition: "transform 0.2s ease-out",
						}}
						onTouchStart={(e) => {
							if (q.status === "answered") return // Don't allow swiping on answered questions

							const touch = e.touches[0]
							const startX = touch.clientX
							const element = e.currentTarget as HTMLElement

							const handleTouchMove = (moveEvent: TouchEvent) => {
								const currentTouch = moveEvent.touches[0]
								const deltaX = currentTouch.clientX - startX

								if (deltaX < -50) {
									// Swipe left threshold
									element.style.transform = `translateX(${deltaX}px)`
									element.style.opacity = String(Math.max(0.3, 1 + deltaX / 200))
								}
							}

							const handleTouchEnd = (endEvent: TouchEvent) => {
								const currentTouch = endEvent.changedTouches[0]
								const deltaX = currentTouch.clientX - startX

								if (deltaX < -100) {
									// Skip if swiped far enough
									skip(q.id)
								} else {
									// Reset position
									element.style.transform = "translateX(0px)"
									element.style.opacity = "1"
								}

								document.removeEventListener("touchmove", handleTouchMove)
								document.removeEventListener("touchend", handleTouchEnd)
							}

							document.addEventListener("touchmove", handleTouchMove, { passive: false })
							document.addEventListener("touchend", handleTouchEnd)
						}}
					>
						<div className="space-y-2">
							<div className="flex items-start gap-3">
								<div className="flex items-center gap-2">
									<Checkbox
										checked={q.status === "answered"}
										onCheckedChange={(checked) => {
											if (checked) {
												markDone(q.id)
											} else {
												unmarkDone(q.id)
											}
										}}
										className="h-4 w-4 border-2 border-gray-600 data-[state=checked]:border-primary data-[state=checked]:bg-primary dark:border-gray-300"
									/>
									<span className="font-medium text-muted-foreground text-sm">{idx + 1}</span>
								</div>
								<div className="min-w-0 flex-1">
									<div
										className={`text-sm leading-relaxed ${q.status === "answered" ? "text-muted-foreground line-through" : ""}`}
									>
										{q.text}
									</div>
									{idx === 0 && q.status !== "answered" && (
										<div className="mt-2 text-muted-foreground text-xs">← Swipe left to skip</div>
									)}
								</div>
							</div>
							{q.status !== "answered" && (
								<div className="flex justify-end">
									<Button size="sm" variant="outline" onClick={() => skip(q.id)}>
										<X className="mr-1 h-3 w-3" /> Skip
									</Button>
								</div>
							)}
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	)
}

export default MinimalQuestionView
