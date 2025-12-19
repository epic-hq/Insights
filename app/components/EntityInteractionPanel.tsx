import { Mic } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { type Mention, MentionInput, renderTextWithMentions } from "~/components/ui/mention-input"
import { VoiceButton, type VoiceButtonState } from "~/components/ui/voice-button"
import { useCurrentProject } from "~/contexts/current-project-context"
import type { EntityType } from "~/features/annotations/db"
import { useEntityAnnotations } from "~/features/annotations/hooks"
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text"
import { useUserProfiles } from "~/hooks/useUserProfiles"
import { cn } from "~/lib/utils"
import type { MentionableUser } from "~/routes/api/mentionable-users"
import type { Annotation, AnnotationComment, UserFlag } from "~/types"
import { formatRelativeDate } from "~/utils/relative-date"

interface EntityInteractionPanelProps {
	entityType: EntityType
	entityId: string
	className?: string
	/** Optional callback for parent components to render counts outside this panel */
	onCommentCountChange?: (count: number) => void
}

export function EntityInteractionPanel({
	entityType,
	entityId,
	className,
	onCommentCountChange,
}: EntityInteractionPanelProps) {
	const [newComment, setNewComment] = useState("")
	const [currentMentions, setCurrentMentions] = useState<Mention[]>([])
	const [isSubmittingComment, setIsSubmittingComment] = useState(false)
	const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([])
	const { profiles: userProfiles, fetchProfiles } = useUserProfiles()

	// Get project context for fetching mentionable users
	const { accountId, projectId } = useCurrentProject()

	const { annotations, userFlags, submitAnnotation, refetchAnnotations } = useEntityAnnotations({
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

	const comments: AnnotationComment[] =
		(annotations?.filter(
			(a: Annotation): a is AnnotationComment => a.annotation_type === "comment"
		) as AnnotationComment[]) || []
	const isArchived = userFlags?.some((f: UserFlag) => f.flag_type === "archived" && !!f.flag_value) || false
	const isHidden = userFlags?.some((f: UserFlag) => f.flag_type === "hidden" && !!f.flag_value) || false

	useEffect(() => {
		onCommentCountChange?.(comments.length)
	}, [comments.length, onCommentCountChange])

	const {
		startRecording,
		stopRecording,
		isRecording,
		isTranscribing,
		error: transcription_error,
		isSupported,
	} = useSpeechToText({
		onTranscription: (text) => {
			setNewComment((prev) => {
				const next = prev.trim().length > 0 ? `${prev.trim()} ${text}` : text
				return next
			})
		},
	})

	const voice_button_state: VoiceButtonState = useMemo(() => {
		if (!isSupported) return "idle"
		if (transcription_error) return "error"
		if (isTranscribing) return "processing"
		if (isRecording) return "recording"
		return "idle"
	}, [isRecording, isSupported, isTranscribing, transcription_error])

	const handleVoicePress = useCallback(() => {
		if (!isSupported) return
		if (isRecording) {
			stopRecording()
			return
		}
		startRecording()
	}, [isRecording, isSupported, startRecording, stopRecording])

	return (
		<div
			className={cn(
				"w-full max-w-4xl rounded-md border bg-background p-4 shadow-sm",
				isArchived && "border-orange-200 opacity-60",
				isHidden && "opacity-30",
				className
			)}
		>
			{isArchived || isHidden ? (
				<div className="mb-2 flex items-center gap-2">
					{isArchived ? (
						<Badge variant="outline" className="text-orange-600">
							Archived
						</Badge>
					) : null}
					{isHidden ? (
						<Badge variant="outline" className="text-gray-500">
							Hidden
						</Badge>
					) : null}
				</div>
			) : null}

			<div className="w-full space-y-3">
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
												{userProfiles[comment.created_by_user_id].avatar_url ? (
													<img
														src={userProfiles[comment.created_by_user_id].avatar_url || undefined}
														alt={userProfiles[comment.created_by_user_id].name}
														className="mr-1 inline-block h-5 w-5 rounded-full"
													/>
												) : null}
												{userProfiles[comment.created_by_user_id].name}
											</>
										) : (
											<span>User</span>
										)}
									</span>
									<span className="text-foreground/60 text-xs">{formatRelativeDate(comment.created_at as string)}</span>
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
							comments.length > 0 ? "Add a comment... Type @ to mention" : "Be the first to comment. Type @ to mention"
						}
						className="flex-1"
						disabled={isSubmittingComment}
					/>
					<VoiceButton
						size="icon"
						variant="outline"
						onPress={handleVoicePress}
						disabled={!isSupported || isSubmittingComment}
						state={voice_button_state}
						icon={<Mic className="h-4 w-4" />}
						aria-label="Transcribe voice"
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

				{transcription_error ? <div className="text-destructive text-xs">{transcription_error}</div> : null}
			</div>
		</div>
	)
}
