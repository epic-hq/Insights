import { formatDistance } from "date-fns"
import { motion } from "framer-motion"
import { Calendar, Loader2, MoreVertical, RefreshCw, Trash2 } from "lucide-react"
import { useState } from "react"
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
import { MediaTypeIcon } from "~/components/ui/MediaTypeIcon"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"

interface NoteCardProps {
	note: {
		id: string
		title: string
		content_md?: string
		created_at: string
		note_type: string
		media_type?: string | null
		source_type?: string | null
		tags?: string[]
		status?: string | null
		conversation_analysis?: {
			indexed_at?: string
			evidence_count?: number
		} | null
	}
	className?: string
}

export default function NoteCard({ note, className }: NoteCardProps) {
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

	// Truncate content for preview
	const contentPreview = note.content_md
		? note.content_md.slice(0, 120) + (note.content_md.length > 120 ? "..." : "")
		: ""

	const handleReprocess = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		reprocessFetcher.submit({ interviewId: note.id }, { method: "post", action: "/api/index-note" })
	}

	const handleDelete = () => {
		deleteFetcher.submit({ interviewId: note.id, projectId }, { method: "post", action: "/api/interviews/delete" })
	}

	return (
		<>
			<Link to={routes.interviews.detail(note.id)}>
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
						{/* Header: Title + Type */}
						<div className="mb-2 flex items-start justify-between gap-3">
							<h3 className="line-clamp-2 font-semibold text-foreground text-lg dark:text-foreground">{note.title}</h3>
							<MediaTypeIcon
								mediaType={note.media_type}
								sourceType={note.source_type}
								showLabel={true}
								iconClassName="h-3.5 w-3.5"
								labelClassName="text-xs text-muted-foreground"
							/>
						</div>

						{/* Content Preview */}
						{contentPreview && (
							<p className="mb-3 line-clamp-2 text-gray-600 text-sm dark:text-gray-400">{contentPreview}</p>
						)}

						{/* Tags */}
						{note.tags && note.tags.length > 0 && (
							<div className="mb-3 flex flex-wrap gap-1.5">
								{note.tags.slice(0, 3).map((tag, idx) => (
									<Badge
										key={idx}
										variant="outline"
										className="border-gray-300 text-gray-700 text-xs dark:border-gray-600 dark:text-gray-300"
									>
										{tag}
									</Badge>
								))}
							</div>
						)}

						{/* Footer: Status + Date */}
						<div className="flex items-center justify-end gap-3 text-muted-foreground">
							{/* Status indicator */}
							{(note.status === "processing" || isReprocessing) && (
								<div className="flex items-center gap-1">
									<Loader2 className="h-3 w-3 animate-spin text-amber-500" />
									<span className="text-amber-600 text-xs">Processing</span>
								</div>
							)}
							{/* Date */}
							<div className="flex items-center gap-1.5">
								<Calendar className="h-3.5 w-3.5" />
								<span className="text-xs">
									{formatDistance(new Date(note.created_at), new Date(), {
										addSuffix: true,
									})}
								</span>
							</div>
						</div>
					</div>

					{/* Subtle Hover Effect */}
					<motion.div
						className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-amber-50/50 to-orange-50/50 opacity-0 dark:from-amber-900/20 dark:to-orange-900/20"
						animate={{ opacity: isHovered ? 1 : 0 }}
						transition={{ duration: 0.3 }}
					/>
				</motion.div>
			</Link>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete note</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{note.title}" and all associated data. This action cannot be undone.
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
