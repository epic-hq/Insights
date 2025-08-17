import { Archive, EyeOff, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react"
import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Textarea } from "~/components/ui/textarea"
import type { EntityFlag, EntityType } from "~/features/annotations/db"
import { useEntityAnnotations } from "~/features/annotations/hooks"
import { cn } from "~/lib/utils"

interface EntityInteractionPanelProps {
	entityType: EntityType
	entityId: string
	className?: string
}

export function EntityInteractionPanel({ entityType, entityId, className }: EntityInteractionPanelProps) {
	const [showComments, setShowComments] = useState(false)
	const [newComment, setNewComment] = useState("")
	const [isSubmittingComment, setIsSubmittingComment] = useState(false)

	const { annotations, voteCounts, userVote, userFlags, submitAnnotation, submitVote, submitFlag, isLoading } =
		useEntityAnnotations({
			entityType,
			entityId,
		})

	const toggleComments = () => setShowComments((prev) => !prev)

	const handleVote = (voteType: "upvote" | "downvote") => {
		const voteValue = voteType === "upvote" ? 1 : -1
		if (userVote?.vote_value === voteValue) {
			submitVote({ _action: "remove" })
		} else {
			submitVote({ vote_value: voteValue })
		}
	}

	const handleAddComment = () => {
		if (!newComment.trim()) return
		setIsSubmittingComment(true)
		submitAnnotation(newComment)
		setNewComment("")
		setIsSubmittingComment(false)
	}

	const handleArchive = () => {
		submitFlag({
			flag_type: "archived",
			flag_value: !userFlags?.some((f: EntityFlag) => f.flag_type === "archived" && f.flag_value),
		})
	}

	const handleHide = () => {
		submitFlag({
			flag_type: "hidden",
			flag_value: !userFlags?.some((f: EntityFlag) => f.flag_type === "hidden" && f.flag_value),
		})
	}

	const upvotes = voteCounts?.upvotes || 0
	const downvotes = voteCounts?.downvotes || 0
	const comments = annotations?.filter((a: any) => a.annotation_type === "comment") || []
	const isArchived = userFlags?.some((f: any) => f.flag_type === "archived" && f.flag_value) || false
	const isHidden = userFlags?.some((f: any) => f.flag_type === "hidden" && f.flag_value) || false

	return (
		<div
			className={cn(
				"rounded-md border bg-white p-4 shadow-sm",
				isArchived && "border-orange-200 opacity-60",
				isHidden && "opacity-30",
				className
			)}
		>
			<div className="mb-2 flex items-center gap-2">
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
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
							<span className="sr-only">More</span>
							<EyeOff className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={handleArchive}>
							<Archive className="mr-2 h-4 w-4" />
							{isArchived ? "Unarchive" : "Archive"}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleHide}>
							<EyeOff className="mr-2 h-4 w-4" />
							{isHidden ? "Show" : "Hide"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
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
			{showComments && (
				<div className="space-y-3 border-t pt-4">
					<h4 className="font-medium text-gray-700 text-sm">Comments</h4>
					{comments.length > 0 ? (
						<div className="max-h-40 space-y-2 overflow-y-auto">
							{comments.map((comment: any) => (
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
		</div>
	)
}
