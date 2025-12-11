import { Archive, EyeOff, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { type Mention, MentionInput, renderTextWithMentions } from "~/components/ui/mention-input"
import { useCurrentProject } from "~/contexts/current-project-context"
import type { EntityType } from "~/features/annotations/db"
import { useEntityAnnotations } from "~/features/annotations/hooks"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { useUserProfiles } from "~/hooks/useUserProfiles"
import { cn } from "~/lib/utils"
import type { MentionableUser } from "~/routes/api/mentionable-users"
import type { Annotation, AnnotationComment, UserFlag } from "~/types"
import { formatRelativeDate } from "~/utils/relative-date"

interface EntityInteractionPanelProps {
	entityType: EntityType
	entityId: string
	className?: string
}

export function EntityInteractionPanel({ entityType, entityId, className }: EntityInteractionPanelProps) {
	const [showComments, setShowComments] = useState(false)
	const [hasAutoExpanded, setHasAutoExpanded] = useState(false)
	const [newComment, setNewComment] = useState("")
	const [currentMentions, setCurrentMentions] = useState<Mention[]>([])
	const [isSubmittingComment, setIsSubmittingComment] = useState(false)
	const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([])
	const { profiles: userProfiles, fetchProfiles } = useUserProfiles()

	// Get project context for fetching mentionable users
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)

	const {
		annotations,
		voteCounts,
		userVote,
		userFlags,
		submitAnnotation,
		submitVote,
		submitFlag,
		isLoading,
		refetchAnnotations,
	} = useEntityAnnotations({
		entityType,
		entityId,
	})

	// Fetch mentionable users when component mounts (need them ready for @ mentions)
	useEffect(() => {
		if (accountId && projectId && mentionableUsers.length === 0) {
			fetch(`/a/${accountId}/${projectId}/api/mentionable-users`)
				.then((res) => {
					if (!res.ok) {
						console.error("[MentionableUsers] API returned error:", res.status)
						return null
					}
					return res.json()
				})
				.then((data) => {
					if (data?.users) {
						setMentionableUsers(data.users)
					}
				})
				.catch((err) => console.error("[MentionableUsers] Fetch error:", err))
		}
	}, [accountId, projectId, mentionableUsers.length])

	// Fetch user profiles for all unique user IDs in comments
	useEffect(() => {
		const uniqueUserIds = (annotations || [])
			.filter((a: Annotation) => a.annotation_type === "comment" && a.created_by_user_id && !a.created_by_ai)
			.map((a: Annotation) => a.created_by_user_id)
			.filter((id): id is string => Boolean(id))

		if (uniqueUserIds.length > 0) {
			fetchProfiles(uniqueUserIds)
		}
	}, [annotations, fetchProfiles])

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
		// Include mentions in content_jsonb if any
		const contentJsonb = currentMentions.length > 0 ? { mentions: currentMentions } : undefined
		submitAnnotation(newComment, contentJsonb)
		setNewComment("")
		setCurrentMentions([])
		await refetchAnnotations()
		setIsSubmittingComment(false)
	}

	const handleMentionsChange = useCallback((mentions: Mention[]) => {
		setCurrentMentions(mentions)
	}, [])

	const handleArchive = () => {
		submitFlag({
			flag_type: "archived",
			flag_value: !userFlags?.some((f: UserFlag) => f.flag_type === "archived" && !!f.flag_value),
		})
	}

	const handleHide = () => {
		submitFlag({
			flag_type: "hidden",
			flag_value: !userFlags?.some((f: UserFlag) => f.flag_type === "hidden" && !!f.flag_value),
		})
	}

	const upvotes = voteCounts?.upvotes || 0
	const downvotes = voteCounts?.downvotes || 0
	const comments: AnnotationComment[] =
		(annotations?.filter(
			(a: Annotation): a is AnnotationComment => a.annotation_type === "comment"
		) as AnnotationComment[]) || []
	const isArchived = userFlags?.some((f: UserFlag) => f.flag_type === "archived" && !!f.flag_value) || false
	const isHidden = userFlags?.some((f: UserFlag) => f.flag_type === "hidden" && !!f.flag_value) || false

	// Auto-show comments if there are existing comments on initial load
	useEffect(() => {
		if (!hasAutoExpanded && comments.length > 0) {
			setShowComments(true)
			setHasAutoExpanded(true)
		}
	}, [comments.length, hasAutoExpanded])

	return (
		<div
			className={cn(
				"w-full max-w-4xl rounded-md border bg-background p-4 shadow-sm",
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
				<div className="w-full space-y-3 border-t pt-4">
					<h4 className="font-medium text-foreground text-sm">Notes</h4>
					{comments.length > 0 ? (
						<div className="max-h-64 space-y-2 overflow-y-auto pr-1">
							{comments.map((comment) => (
								<div key={comment.id} className="rounded-md bg-background p-3">
									<div className="mb-1 flex items-start justify-between">
										<span className="flex items-center gap-2 font-medium text-foreground/60 text-xs">
											{comment.created_by_ai ? (
												<span>🤖 AI Assistant</span>
											) : comment.created_by_user_id && userProfiles[comment.created_by_user_id] ? (
												<>
													{userProfiles[comment.created_by_user_id].avatar_url && (
														<img
															src={userProfiles[comment.created_by_user_id].avatar_url || undefined}
															alt={userProfiles[comment.created_by_user_id].name}
															className="mr-1 inline-block h-5 w-5 rounded-full"
														/>
													)}
													{userProfiles[comment.created_by_user_id].name}
												</>
											) : (
												<span>User</span>
											)}
										</span>
										<span className="text-foreground/60 text-xs">
											{formatRelativeDate(comment.created_at as string)}
										</span>
									</div>
									<p className="text-foreground/60 text-sm">
										{renderTextWithMentions(
											comment.content || "",
											(comment.content_jsonb as { mentions?: Mention[] })?.mentions
										)}
									</p>
								</div>
							))}
						</div>
					) : null}
					<div className="flex gap-2">
						<MentionInput
							value={newComment}
							onChange={setNewComment}
							onMentionsChange={handleMentionsChange}
							mentionableUsers={mentionableUsers}
							placeholder={
								comments.length > 0 ? "Add a note... Type @ to mention" : "Be the first to comment. Type @ to mention"
							}
							className="flex-1"
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
