import { formatDistance } from "date-fns"
import { motion } from "framer-motion"
import { Calendar, FileText, Tag } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
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
		tags?: string[]
	}
	className?: string
}

export default function NoteCard({ note, className }: NoteCardProps) {
	const [isHovered, setIsHovered] = useState(false)
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Get note type display name
	const getNoteTypeLabel = (type: string) => {
		switch (type) {
			case "observation":
				return "Observation"
			case "insight":
				return "Insight"
			case "followup":
				return "Follow-up"
			default:
				return "Note"
		}
	}

	// Get note type color
	const getNoteTypeColor = (type: string) => {
		switch (type) {
			case "observation":
				return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
			case "insight":
				return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
			case "followup":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
		}
	}

	// Truncate content for preview
	const contentPreview = note.content_md ? note.content_md.slice(0, 120) + (note.content_md.length > 120 ? "..." : "") : ""

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
					{/* Header - Note Type */}
					<div className="mb-3 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<FileText className="h-4 w-4 text-amber-600" />
							<span className="text-foreground/40 text-sm font-medium">Note</span>
						</div>
						<Badge className={cn("font-medium text-xs", getNoteTypeColor(note.note_type))}>
							{getNoteTypeLabel(note.note_type)}
						</Badge>
					</div>

					{/* Note Title - Prominent */}
					<div className="mb-4">
						<h3 className="line-clamp-2 font-semibold text-foreground text-lg dark:text-foreground">
							{note.title}
						</h3>
					</div>

					{/* Content Preview */}
					{contentPreview && (
						<div className="mb-4">
							<p className="line-clamp-2 text-gray-600 text-sm dark:text-gray-400">
								{contentPreview}
							</p>
						</div>
					)}

					{/* Tags */}
					{note.tags && note.tags.length > 0 && (
						<div className="mb-4">
							<div className="flex flex-wrap gap-1.5">
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
						</div>
					)}

					{/* Metadata */}
					<div className="flex items-center gap-3 text-sm">
						<div className="flex items-center gap-1.5">
							<Calendar className="h-3.5 w-3.5 text-gray-500" />
							<span className="text-gray-600 text-xs dark:text-gray-400">
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
