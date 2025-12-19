import consola from "consola"
import { Archive, Edit, EyeOff, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useFetcher } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Textarea } from "~/components/ui/textarea"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import type { InsightView } from "~/types"

type PrefetchedFlags = {
	hidden: boolean
	archived: boolean
	starred: boolean
	priority: boolean
}

type AnnotationRow = {
	id: string
	content: string | null
	created_at: string
	created_by_ai: boolean | null
}

interface InsightCardV2Props {
	insight: InsightView
	detail_href?: string
	comment_count?: number
	prefetched_flags?: PrefetchedFlags
	onEdit?: () => void
	onDelete?: () => void
	className?: string
}

export default function InsightCardV2({
	insight,
	detail_href,
	comment_count,
	prefetched_flags,
	onEdit,
	onDelete,
	className,
}: InsightCardV2Props) {
	const [showComments, setShowComments] = useState(false)
	const [newComment, setNewComment] = useState("")
	const [isSubmittingComment, setIsSubmittingComment] = useState(false)
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)
	const commentsFetcher = useFetcher()
	const flagFetcher = useFetcher()
	const createCommentFetcher = useFetcher()

	const [comments, setComments] = useState<AnnotationRow[]>([])
	const [commentsLoaded, setCommentsLoaded] = useState(false)
	const [flags, setFlags] = useState<PrefetchedFlags>({
		hidden: false,
		archived: false,
		starred: false,
		priority: false,
	})

	useEffect(() => {
		if (!prefetched_flags) return
		setFlags(prefetched_flags)
	}, [prefetched_flags])

	const display_title =
		(insight.name && insight.name.trim().length > 0 ? insight.name.trim() : null) ||
		(insight.title && insight.title.trim().length > 0 ? insight.title.trim() : null) ||
		"Untitled Insight"
	const display_details =
		(insight.details && insight.details.trim().length > 0 ? insight.details.trim() : null) ||
		(insight.content && insight.content.trim().length > 0 ? insight.content.trim() : null) ||
		(insight.statement && insight.statement.trim().length > 0 ? insight.statement.trim() : null) ||
		""
	const display_tags = useMemo(() => {
		if (Array.isArray(insight.tags) && insight.tags.length > 0) return insight.tags.map((t) => t.tag).filter(Boolean)
		const maybe_insight_tags = (insight as unknown as { insight_tags?: unknown }).insight_tags
		if (Array.isArray(maybe_insight_tags)) {
			return maybe_insight_tags
				.map((t) => {
					if (t && typeof t === "object") {
						const rec = t as Record<string, unknown>
						const direct_tag = rec.tag
						if (typeof direct_tag === "string") return direct_tag
						const nested = rec.tags
						if (nested && typeof nested === "object") {
							const nested_tag = (nested as Record<string, unknown>).tag
							if (typeof nested_tag === "string") return nested_tag
						}
					}
					return null
				})
				.filter((v: unknown): v is string => typeof v === "string" && v.length > 0)
		}
		return []
	}, [insight])

	const resolved_comment_count = comment_count ?? comments.length
	const canNavigate = typeof detail_href === "string" && detail_href.length > 0

	useEffect(() => {
		if (!showComments) return
		if (commentsLoaded) return
		if (!projectPath || !insight.id) return

		const searchParams = new URLSearchParams({
			entityType: "insight",
			entityId: insight.id,
			annotationType: "comment",
			includeThreads: "false",
		})
		commentsFetcher.load(`${routes.api.annotations()}?${searchParams}`)
	}, [showComments, commentsLoaded, projectPath, insight.id, commentsFetcher, routes.api, routes.api.annotations])

	useEffect(() => {
		if (commentsFetcher.state !== "idle") return
		const data = commentsFetcher.data as { annotations?: AnnotationRow[]; error?: { message?: string } } | undefined
		if (!data) return
		if (data.error) return
		if (Array.isArray(data.annotations)) {
			setComments(
				data.annotations.map((a) => ({
					id: a.id,
					content: a.content,
					created_at: a.created_at,
					created_by_ai: a.created_by_ai,
				}))
			)
			setCommentsLoaded(true)
		}
	}, [commentsFetcher.state, commentsFetcher.data])

	const toggleComments = () => {
		if (!insight?.id) {
			consola.error("toggleComments: insight.id is undefined", { insight })
			return
		}
		setShowComments((prev) => !prev)
	}

	const handleAddComment = () => {
		if (!insight?.id || !newComment.trim()) {
			consola.error("handleAddComment: missing data", {
				insightId: insight?.id,
				newComment,
			})
			return
		}

		setIsSubmittingComment(true)

		if (projectPath) {
			createCommentFetcher.submit(
				{
					action: "add-comment",
					entityType: "insight",
					entityId: insight.id,
					content: newComment,
				},
				{ method: "POST", action: routes.api.annotations() }
			)
		}

		setComments((prev) =>
			prev.concat({
				id: `optimistic-${Date.now()}`,
				content: newComment,
				created_at: new Date().toISOString(),
				created_by_ai: false,
			})
		)

		setNewComment("")
		setIsSubmittingComment(false)
	}

	const handleArchive = () => {
		if (!insight?.id) {
			consola.error("handleArchive: insight.id is undefined", { insight })
			return
		}

		const next = !flags.archived
		setFlags((prev) => ({ ...prev, archived: next }))
		flagFetcher.submit(
			{
				action: "set-flag",
				entityType: "insight",
				entityId: insight.id,
				flagType: "archived",
				flagValue: String(next),
			},
			{ method: "POST", action: routes.api.entityFlags() }
		)
	}

	const handleHide = () => {
		if (!insight?.id) {
			consola.error("handleHide: insight.id is undefined", { insight })
			return
		}

		const next = !flags.hidden
		setFlags((prev) => ({ ...prev, hidden: next }))
		flagFetcher.submit(
			{
				action: "set-flag",
				entityType: "insight",
				entityId: insight.id,
				flagType: "hidden",
				flagValue: String(next),
			},
			{ method: "POST", action: routes.api.entityFlags() }
		)
	}

	const isArchived = flags.archived
	const isHidden = flags.hidden

	return (
		<Card
			className={cn(
				"bg-card text-card-foreground transition-all duration-200 hover:shadow-md",
				isArchived && "border-orange-200 opacity-60",
				isHidden && "opacity-30",
				className
			)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<div className="mb-2 flex items-center gap-2">
							{canNavigate ? (
								<Link to={detail_href} className="no-underline hover:no-underline">
									<h3 className="font-semibold text-foreground text-lg leading-tight">{display_title}</h3>
								</Link>
							) : (
								<h3 className="font-semibold text-foreground text-lg leading-tight">{display_title}</h3>
							)}
							{isArchived && (
								<Badge variant="outline" className="text-orange-600">
									Archived
								</Badge>
							)}
							{isHidden && (
								<Badge variant="outline" className="text-gray-500">
									Hidden
								</Badge>
							)}
						</div>
						{display_details ? (
							<p className="text-muted-foreground text-sm leading-relaxed">{display_details}</p>
						) : null}
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{onEdit && (
								<DropdownMenuItem onClick={onEdit}>
									<Edit className="mr-2 h-4 w-4" />
									Edit
								</DropdownMenuItem>
							)}
							<DropdownMenuItem onClick={handleArchive}>
								<Archive className="mr-2 h-4 w-4" />
								{isArchived ? "Unarchive" : "Archive"}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleHide}>
								<EyeOff className="mr-2 h-4 w-4" />
								{isHidden ? "Show" : "Hide"}
							</DropdownMenuItem>
							{onDelete && (
								<DropdownMenuItem onClick={onDelete} className="text-red-600">
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{display_tags.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1">
						{display_tags.map((tag) => (
							<Badge key={tag} variant="secondary" className="text-xs">
								{tag}
							</Badge>
						))}
					</div>
				)}
			</CardHeader>

			<CardContent className="pt-0">
				{/* Action buttons */}
				<div className="mb-4 flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={toggleComments}
						className={cn(
							"flex items-center gap-1 hover:bg-blue-50",
							showComments ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
						)}
					>
						<MessageCircle className="h-4 w-4" />
						<span className="font-medium text-sm">{resolved_comment_count}</span>
					</Button>
				</div>

				{/* Comments section */}
				{showComments && (
					<div className="space-y-3 border-t pt-4">
						<h4 className="font-medium text-foreground text-sm">Comments</h4>

						{/* Comments list */}
						{comments.length > 0 ? (
							<div className="max-h-40 space-y-2 overflow-y-auto">
								{comments.map((comment) => (
									<div key={comment.id} className="rounded-md bg-muted p-3">
										<div className="mb-1 flex items-start justify-between">
											<span className="font-medium text-foreground text-xs">
												{comment.created_by_ai ? "AI Assistant" : "User"}
											</span>
											<span className="text-muted-foreground text-xs">
												{new Date(comment.created_at).toLocaleDateString()}
											</span>
										</div>
										<p className="text-muted-foreground text-sm">{comment.content}</p>
									</div>
								))}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">No comments yet.</p>
						)}

						{/* Add comment form */}
						<div className="flex gap-2">
							<Textarea
								placeholder="Add a comment..."
								value={newComment}
								onChange={(e) => setNewComment(e.target.value)}
								className="min-h-[60px] flex-1"
								disabled={isSubmittingComment}
							/>
							<Button
								size="sm"
								onClick={handleAddComment}
								disabled={!newComment.trim() || isSubmittingComment}
								className="self-end"
							>
								{isSubmittingComment ? "..." : "Post"}
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
