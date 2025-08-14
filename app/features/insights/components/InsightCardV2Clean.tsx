import consola from "consola"
import { Archive, Edit, EyeOff, MessageCircle, MoreHorizontal, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react"
import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Textarea } from "~/components/ui/textarea"
import { useEntityAnnotations } from "~/features/annotations/hooks"
import { cn } from "~/lib/utils"
import type { InsightView } from "~/types"

interface InsightCardV2Props {
	insight: InsightView
	onEdit?: () => void
	onDelete?: () => void
	className?: string
}

export default function InsightCardV2({ insight, onEdit, onDelete, className }: InsightCardV2Props) {
	const [showComments, setShowComments] = useState(false)
	const [newComment, setNewComment] = useState("")
	const [isSubmittingComment, setIsSubmittingComment] = useState(false)

	// Use the new annotations system
	const { annotations, voteCounts, userVote, userFlags, submitAnnotation, submitVote, submitFlag, isLoading } =
		useEntityAnnotations({
			entityType: "insight",
			entityId: insight.id,
		})

	const toggleComments = () => {
		if (!insight?.id) {
			consola.error("toggleComments: insight.id is undefined", { insight })
			return
		}
		setShowComments((prev) => !prev)
	}

	const handleVote = (voteType: "upvote" | "downvote") => {
		if (!insight?.id) {
			consola.error("handleVote: insight.id is undefined", { insight })
			return
		}

		const voteValue = voteType === "upvote" ? 1 : -1

		// If user already voted the same way, remove the vote
		if (userVote?.vote_value === voteValue) {
			submitVote({ _action: "remove" })
		} else {
			// Otherwise, submit the new vote
			submitVote({ vote_value: voteValue })
		}
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

		submitAnnotation({
			annotation_type: "comment",
			content: newComment,
		})

		setNewComment("")
		setIsSubmittingComment(false)
	}

	const handleArchive = () => {
		if (!insight?.id) {
			consola.error("handleArchive: insight.id is undefined", { insight })
			return
		}

		submitFlag({
			flag_type: "archived",
			flag_value: !userFlags?.some((f) => f.flag_type === "archived" && f.flag_value),
		})
	}

	const handleHide = () => {
		if (!insight?.id) {
			consola.error("handleHide: insight.id is undefined", { insight })
			return
		}

		submitFlag({
			flag_type: "hidden",
			flag_value: !userFlags?.some((f) => f.flag_type === "hidden" && f.flag_value),
		})
	}

	// Get current state from annotations system
	const upvotes = voteCounts?.upvotes || 0
	const downvotes = voteCounts?.downvotes || 0
	const comments = annotations?.filter((a) => a.annotation_type === "comment") || []
	const isArchived = userFlags?.some((f) => f.flag_type === "archived" && f.flag_value) || false
	const isHidden = userFlags?.some((f) => f.flag_type === "hidden" && f.flag_value) || false

	return (
		<Card
			className={cn(
				"transition-all duration-200 hover:shadow-md",
				isArchived && "border-orange-200 opacity-60",
				isHidden && "opacity-30",
				className
			)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<div className="mb-2 flex items-center gap-2">
							<h3 className="font-semibold text-lg leading-tight">{insight.title}</h3>
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
						<p className="text-gray-600 text-sm leading-relaxed">{insight.details}</p>
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

				{insight.tags && insight.tags.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1">
						{insight.tags.map((tag, index) => (
							<Badge key={index} variant="secondary" className="text-xs">
								{tag.tag}
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
						onClick={() => handleVote("upvote")}
						className={cn(
							"flex items-center gap-1 hover:bg-green-50",
							userVote?.vote_value === 1 ? "bg-green-50 text-green-700" : "text-green-600 hover:text-green-700"
						)}
						disabled={isLoading}
					>
						<ThumbsUp className="h-4 w-4" />
						<span className="font-medium text-sm">{upvotes}</span>
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleVote("downvote")}
						className={cn(
							"flex items-center gap-1 hover:bg-red-50",
							userVote?.vote_value === -1 ? "bg-red-50 text-red-700" : "text-red-600 hover:text-red-700"
						)}
						disabled={isLoading}
					>
						<ThumbsDown className="h-4 w-4" />
						<span className="font-medium text-sm">{downvotes}</span>
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onClick={toggleComments}
						className={cn(
							"flex items-center gap-1 hover:bg-blue-50",
							showComments ? "bg-blue-50 text-blue-700" : "text-blue-600 hover:text-blue-700"
						)}
					>
						<MessageCircle className="h-4 w-4" />
						<span className="font-medium text-sm">{comments.length}</span>
					</Button>
				</div>

				{/* Comments section */}
				{showComments && (
					<div className="space-y-3 border-t pt-4">
						<h4 className="font-medium text-gray-700 text-sm">Comments</h4>

						{/* Comments list */}
						{comments.length > 0 ? (
							<div className="max-h-40 space-y-2 overflow-y-auto">
								{comments.map((comment) => (
									<div key={comment.id} className="rounded-md bg-gray-50 p-3">
										<div className="mb-1 flex items-start justify-between">
											<span className="font-medium text-gray-700 text-xs">
												{comment.created_by_ai ? "AI Assistant" : "User"}
											</span>
											<span className="text-gray-500 text-xs">{new Date(comment.created_at).toLocaleDateString()}</span>
										</div>
										<p className="text-gray-600 text-sm">{comment.content}</p>
									</div>
								))}
							</div>
						) : (
							<p className="text-gray-500 text-sm">No comments yet.</p>
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
