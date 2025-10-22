import { formatDistance } from "date-fns"
import { motion } from "framer-motion"
import { Calendar, Clock, FileText, Users } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
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
		meetingBotStatus?: string | null
		meetingBotStatusDetail?: string | null
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
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Get primary participant data
	const primaryParticipant = interview.interview_people?.[0]
	const participant = primaryParticipant?.people
	const participantName = participant?.name || "Unknown Participant"
	const participantSegment = participant?.segment || "Participant"

	// Interview title (prefer actual title over participant name)
	const interviewTitle = interview.title || `Interview with ${participantName}`

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
				{/* Card Content */}
				<div className="p-5">
					{/* Header - Interview Label */}
				<div className="mb-3 flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<MediaTypeIcon mediaType={interview.media_type} showLabel={true} />
						{/* <span className="text-foreground/40 text-sm font-medium">Interview</span> */}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge className={cn("font-medium text-xs", getStatusColor(interview.status))}>
							{interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
						</Badge>
						{interview.meetingBotStatus ? (
							<Badge variant="outline" className="border-slate-300 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
								Recall bot • {interview.meetingBotStatusDetail ?? interview.meetingBotStatus}
							</Badge>
						) : null}
					</div>
				</div>

					{/* Interview Title - Prominent */}
					<div className="mb-4">
						<h3 className="line-clamp-2 flex items-center gap-2 font-semibold text-foreground text-lg dark:text-foreground">
							<Users className="h-4 w-4" />
							<span>{participantName}</span>
							{participantSegment && participantSegment !== "Participant" && (
								<span className="text-foreground/50">• {participantSegment}</span>
							)}
						</h3>
					</div>

					{/* Participants */}
					<div className="mb-4">
						<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-gray-400">{interviewTitle}</div>
					</div>

					{/* Top Themes */}
					{interview.topThemes && interview.topThemes.length > 0 && (
						<div className="mb-4">
							<div className="flex flex-wrap gap-1.5">
								{interview.topThemes.slice(0, 3).map((theme) => (
									<Badge
										key={theme.id}
										variant="outline"
										className="border-gray-300 text-gray-700 text-xs dark:border-gray-600 dark:text-gray-300"
										style={{ borderColor: theme.color || "#d1d5db" }}
									>
										{theme.name}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Metadata Grid */}
					<div className="grid grid-cols-3 gap-3 text-sm">
						{/* Evidence Count - Most Important */}
						<div className="flex items-center gap-1.5">
							<FileText className="h-3.5 w-3.5 text-purple-600" />
							<span className="font-medium text-purple-600">
								{interview.evidenceCount || interview.insightCount || 0}
							</span>
							<span className="text-gray-500 text-xs">evidence</span>
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
								{formatDistance(new Date(interview.created_at), new Date(), { addSuffix: true })}
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
	)
}
