import { formatDistance } from "date-fns"
import { motion } from "framer-motion"
import { Calendar, Loader2 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
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
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Truncate content for preview
	const contentPreview = note.content_md
		? note.content_md.slice(0, 120) + (note.content_md.length > 120 ? "..." : "")
		: ""

	return (
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
						{note.status === "processing" && (
							<div className="flex items-center gap-1">
								<Loader2 className="h-3 w-3 animate-spin text-amber-500" />
								<span className="text-amber-600 text-xs">Processing</span>
							</div>
						)}
						{/* Date */}
						<div className="flex items-center gap-1.5">
							<Calendar className="h-3.5 w-3.5" />
							<span className="text-xs">
								{formatDistance(new Date(note.created_at), new Date(), { addSuffix: true })}
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
	)
}
