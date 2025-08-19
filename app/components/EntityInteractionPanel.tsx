import { Archive, EyeOff, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react"
import { useState, useEffect } from "react"
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
	const [userProfiles, setUserProfiles] = useState<{ [userId: string]: { name: string; avatar_url: string | null } }>({})

	const { annotations, voteCounts, userVote, userFlags, submitAnnotation, submitVote, submitFlag, isLoading, refetchAnnotations } =
		useEntityAnnotations({
			entityType,
			entityId,
		})

	// Fetch user profiles for all unique user IDs in comments
	useEffect(() => {
		const uniqueUserIds = Array.from(
			new Set(
				(annotations || [])
					.filter((a: any) => a.annotation_type === "comment" && a.created_by_user_id && !a.created_by_ai)
					.map((a: any) => a.created_by_user_id)
			)
		).filter((id) => id && !userProfiles[id])

		if (uniqueUserIds.length === 0) return

		Promise.all(
			uniqueUserIds.map((userId) =>
				fetch(`/api/user-profile?userId=${userId}`)
					.then((res) => res.ok ? res.json() : null)
					.then((data) => (data && !data.error ? { userId, ...data } : null))
			)
		).then((results) => {
			const newProfiles: { [userId: string]: { name: string; avatar_url: string | null } } = {}
			for (const result of results) {
				if (result && result.userId) {
					newProfiles[result.userId] = { name: result.name, avatar_url: result.avatar_url }
				}
			}
			if (Object.keys(newProfiles).length > 0) {
				setUserProfiles((prev) => ({ ...prev, ...newProfiles }))
			}
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [annotations])

	const toggleComments = () => setShowComments((prev) => !prev)

	const handleVote = (voteType: "upvote" | "downvote") => {
		const voteValue = voteType === "upvote" ? 1 : -1
		if (userVote?.vote_value === voteValue) {
			submitVote({ _action: "remove" })
		} else {
			submitVote({ vote_value: voteValue })
		}
	}

	const handleAddComment = async () => {
		if (!newComment.trim()) return
		setIsSubmittingComment(true)
		submitAnnotation(newComment)
		setNewComment("")
		await refetchAnnotations()
		setIsSubmittingComment(false)
	}

	const handleArchive = () => {
		submitFlag({
			flag_type: "archived",
			flag_value: !userFlags?.some((f: { flag_type: string; flag_value: any }) => f.flag_type === "archived" && f.flag_value),
		})
	}

	const handleHide = () => {
		submitFlag({
			flag_type: "hidden",
			flag_value: !userFlags?.some((f: { flag_type: string; flag_value: any }) => f.flag_type === "hidden" && f.flag_value),
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
				"w-full w-max-lg rounded-md border bg-white p-4 shadow-sm",
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
				<div className="max-w-[600px] w-full space-y-3 border-t pt-4">
					<h4 className="font-medium text-gray-700 text-sm">Notes</h4>
					{comments.length > 0 ? (
						<div className="max-h-40 space-y-2 overflow-y-auto">
							{comments.map((comment: any) => (
								<div key={comment.id} className="rounded-md bg-gray-50 p-3">
									<div className="mb-1 flex items-start justify-between">
										<span className="font-medium text-gray-700 text-xs flex items-center gap-2">
											{comment.created_by_ai ? (
												<>
													<span>🤖 AI Assistant</span>
												</>
											) : comment.created_by_user_id && userProfiles[comment.created_by_user_id] ? (
												<>
													{userProfiles[comment.created_by_user_id].avatar_url && (
														<img
															src={userProfiles[comment.created_by_user_id].avatar_url || undefined}
															alt={userProfiles[comment.created_by_user_id].name}
															className="inline-block h-5 w-5 rounded-full mr-1"
														/>
													)}
													{userProfiles[comment.created_by_user_id].name}
												</>
											) : (
												<span>User</span>
											)}
										</span>
										<span className="text-gray-500 text-xs">{new Date(comment.created_at).toLocaleDateString()}</span>
									</div>
									<p className="text-gray-600 text-sm">{comment.content}</p>
								</div>
							))}
						</div>
					) : (null )}
					<div className="flex gap-2">
						<Textarea
							placeholder={comments.length > 0 ? "Add a note..." : "Be the first to comment."}
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
