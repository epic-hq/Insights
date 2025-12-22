import consola from "consola"
import { formatDistance } from "date-fns"
import { motion } from "framer-motion"
import { Calendar, Clock, FileText, Loader2, MoreVertical, RefreshCw, Trash2, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useFetcher, useNavigate } from "react-router"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import MediaTypeIcon from "~/components/ui/MediaTypeIcon"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import type { Database } from "~/types"

type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]

interface InterviewCardProps {
	interview: InterviewRow & {
		participant: string
		role: string
		persona: string
		created_at: string
		duration: string
		insightCount: number
		evidenceCount?: number
		topThemes?: Array<{
			id: string
			name: string
			color?: string
		}>
		interview_people?: Array<{
			people?: {
				name?: string
				segment?: string
			}
			role?: string
		}>
	}
	className?: string
}

export default function InterviewCard({ interview, className }: InterviewCardProps) {
	const [isHovered, setIsHovered] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const { projectPath, projectId } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const navigate = useNavigate()
	const deleteFetcher = useFetcher<{
		success?: boolean
		redirectTo?: string
		error?: string
	}>()
	const reprocessFetcher = useFetcher()

	const isDeleting = deleteFetcher.state !== "idle"
	const isReprocessing = reprocessFetcher.state !== "idle"

	// Navigate after successful delete
	useEffect(() => {
		if (deleteFetcher.data?.success && deleteFetcher.data?.redirectTo) {
			navigate(deleteFetcher.data.redirectTo)
		}
	}, [deleteFetcher.data, navigate])

	const handleReprocess = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		reprocessFetcher.submit({ interviewId: interview.id }, { method: "post", action: "/api/reprocess-interview" })
	}

	const handleDelete = () => {
		deleteFetcher.submit({ interviewId: interview.id, projectId }, { method: "post", action: "/api/interviews/delete" })
	}

	// Get all participants, sorted to put "participant" role first
	const allParticipants = interview.interview_people || []
	const sortedParticipants = [...allParticipants].sort((a, b) => {
		if (a.role === "participant") return -1
		if (b.role === "participant") return 1
		return 0
	})
	const primaryParticipant = sortedParticipants[0]
	const participant = primaryParticipant?.people
	const participantName = participant?.name || "Unknown Participant"

	const participant_names = Array.from(
		new Set(sortedParticipants.map((p) => p.people?.name?.trim()).filter((name): name is string => Boolean(name)))
	)
	const display_participant_names = participant_names.length > 0 ? participant_names : [participantName]
	const displayed_participant_names = display_participant_names.slice(0, 3)
	const remaining_participant_count = Math.max(0, display_participant_names.length - displayed_participant_names.length)
	const participants_label =
		remaining_participant_count > 0
			? `${displayed_participant_names.join(", ")} +${remaining_participant_count}`
			: displayed_participant_names.join(", ")

	// Interview title (prefer actual title over participant name)
	const interviewTitle = interview.title || `Interview with ${participantName}`

	const audio_extensions = ["mp3", "wav", "m4a", "ogg", "flac", "aac"]
	const image_extensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp"]

	const file_extension = interview.file_extension?.toLowerCase() || ""
	const is_audio_only =
		interview.media_type === "voice_memo" ||
		interview.source_type?.includes("audio") ||
		audio_extensions.includes(file_extension)

	const is_image = image_extensions.includes(file_extension)
	const media_preview_url = interview.thumbnail_url || (is_image ? interview.media_url : null)
	const [signed_media_preview_url, setSignedMediaPreviewUrl] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		setSignedMediaPreviewUrl(null)

		if (!media_preview_url) return

		const url = media_preview_url
		const is_http_url = url.startsWith("http://") || url.startsWith("https://")
		if (is_http_url) {
			setSignedMediaPreviewUrl(url)
			return
		}

		const fetchSignedPreviewUrl = async () => {
			try {
				const response = await fetch("/api/media/signed-url", {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ mediaUrl: url, intent: "playback" }),
				})

				if (!response.ok) {
					const error_text = await response.text().catch(() => "")
					consola.warn("Thumbnail signed URL request failed:", response.status, error_text)
					return
				}

				const data = (await response.json()) as { signedUrl?: string }
				if (!cancelled && data.signedUrl) {
					setSignedMediaPreviewUrl(data.signedUrl)
				}
			} catch (err) {
				consola.warn("Failed to fetch signed thumbnail URL:", err)
			}
		}

		void fetchSignedPreviewUrl()

		return () => {
			cancelled = true
		}
	}, [media_preview_url])

	// Status color mapping
	const getStatusColor = (status: string) => {
		switch (status) {
			case "ready":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
			case "transcribed":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
			case "processing":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
		}
	}

	return (
		<>
			<Link to={routes.interviews.detail(interview.id)}>
				<motion.div
					className={cn(
						"group relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
						"transition-all duration-300 ease-out",
						"hover:shadow-black/5 hover:shadow-lg dark:hover:shadow-white/5",
						className
					)}
					onMouseEnter={() => setIsHovered(true)}
					onMouseLeave={() => setIsHovered(false)}
					whileHover={{ y: -2, scale: 1.01 }}
					transition={{ duration: 0.3, ease: "easeOut" }}
				>
					{/* Action Menu - top right, visible on hover */}
					<div
						className={cn(
							"absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100",
							(isDeleting || isReprocessing) && "opacity-100"
						)}
					>
						<DropdownMenu>
							<DropdownMenuTrigger
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
								}}
								className="rounded-md bg-white/80 p-1.5 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800"
							>
								{isReprocessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleReprocess} disabled={isReprocessing}>
									<RefreshCw className="mr-2 h-4 w-4" />
									{isReprocessing ? "Reprocessing..." : "Reprocess"}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={(e) => {
										e.preventDefault()
										e.stopPropagation()
										setDeleteDialogOpen(true)
									}}
									disabled={isDeleting}
									className="text-destructive focus:text-destructive"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete...
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{/* Card Content */}
					<div className="p-5">
						{media_preview_url ? (
							<div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
								<div className="relative aspect-video w-full">
									{signed_media_preview_url ? (
										<img src={signed_media_preview_url} alt="" className="h-full w-full object-cover" loading="lazy" />
									) : (
										<div className="h-full w-full bg-muted/40" />
									)}
								</div>
							</div>
						) : is_audio_only ? (
							<div className="mb-4 flex h-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
								<MediaTypeIcon
									mediaType={interview.media_type}
									sourceType={interview.source_type}
									showLabel={false}
									iconClassName="h-7 w-7"
								/>
							</div>
						) : null}

						{/* Header - Title on left, Media Type on right */}
						<div className="mb-3 flex items-start justify-between gap-3">
							<h3 className="line-clamp-2 font-semibold text-foreground text-lg leading-tight dark:text-foreground">
								{interviewTitle}
							</h3>
							<div className="flex shrink-0 items-center gap-2">
								<MediaTypeIcon
									mediaType={interview.media_type}
									sourceType={interview.source_type}
									showLabel={false}
									iconClassName="h-4 w-4"
								/>
							</div>
						</div>

						{/* Participant Info */}
						<div className="mb-4 flex items-center gap-2">
							<Users className="h-4 w-4 shrink-0 text-gray-500" />
							<div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
								<span className="text-gray-600 text-sm dark:text-gray-400">{participants_label}</span>
							</div>
							<Badge className={cn("shrink-0 font-medium text-xs", getStatusColor(interview.status))}>
								{interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
							</Badge>
						</div>

						{/* Metadata Grid */}
						<div className="grid grid-cols-3 gap-3 text-sm">
							{/* Evidence Count - Most Important */}
							<div className="flex items-center gap-1.5">
								<FileText className="h-3.5 w-3.5 text-muted-foreground" />
								<span className="font-medium text-muted-foreground">
									{interview.evidenceCount || interview.insightCount || 0}
								</span>
								<span className="text-muted-foreground text-xs">evidence</span>
							</div>

							{/* Duration */}
							<div className="flex items-center gap-1.5">
								<Clock className="h-3.5 w-3.5 text-gray-500" />
								<span className="text-gray-600 dark:text-gray-400">{interview.duration}</span>
							</div>

							{/* Date */}
							<div className="flex items-center gap-1.5">
								<Calendar className="h-3.5 w-3.5 text-gray-500" />
								<span className="text-gray-600 text-xs dark:text-gray-400">
									{formatDistance(new Date(interview.created_at), new Date(), {
										addSuffix: true,
									})}
								</span>
							</div>
						</div>
					</div>

					{/* Subtle Hover Effect */}
					<motion.div
						className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-0 dark:from-blue-900/20 dark:to-purple-900/20"
						animate={{ opacity: isHovered ? 1 : 0 }}
						transition={{ duration: 0.3 }}
					/>
				</motion.div>
			</Link>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete interview</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{interview.title || "this interview"}" and all associated data. This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
