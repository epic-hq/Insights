import { motion } from "framer-motion"
import { Quote } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { ConfidenceBars, ConfidencePill } from "~/components/Confidence"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"
import type { Evidence } from "~/types"

interface EvidenceCardProps {
	evidence: Evidence
	showInterviewLink?: boolean
	interviewTitle?: string
	projectPath?: string
	className?: string
}

export function EvidenceCard({
	evidence,
	showInterviewLink = false,
	interviewTitle,
	projectPath,
	className = "",
}: EvidenceCardProps) {
	const [isHovered, setIsHovered] = useState(false)
	const interviewUrl =
		projectPath && evidence.interview_id ? `${projectPath}/interviews/${evidence.interview_id}` : null

	// Get theme color based on journey stage or default to blue
	const getStageColor = (stage?: string) => {
		if (!stage) return "#3b82f6" // blue-500
		switch (stage.toLowerCase()) {
			case "awareness":
				return "#f59e0b" // amber-500
			case "consideration":
				return "#8b5cf6" // violet-500
			case "decision":
				return "#10b981" // emerald-500
			case "onboarding":
				return "#06b6d4" // cyan-500
			case "retention":
				return "#6366f1" // indigo-500
			default:
				return "#3b82f6" // blue-500
		}
	}

	const themeColor = getStageColor(evidence.journey_stage)

	return (
		<motion.div
			className={cn(
				"group relative cursor-default overflow-hidden rounded-2xl border border-gray-400 bg-background transition-all duration-300 ease-out hover:shadow-black/5 hover:shadow-lg dark:border-gray-400 dark:bg-gray-900 dark:hover:shadow-white/5",
				className
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			whileHover={{ y: -2, scale: 1.01 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
		>
			{/* Clean Metro-style Layout */}
			<div className="p-4">
				{/* Header Section - Quote Icon and Content */}
				<div className="flex items-start gap-4">
					{/* Quote Icon - More Prominent */}
					<motion.div
						className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
						style={{ backgroundColor: `${themeColor}15` }}
						whileHover={{ scale: 1.05 }}
						transition={{ duration: 0.2 }}
					>
						<Quote className="h-6 w-6" style={{ color: themeColor }} />
					</motion.div>

					{/* Main Content */}
					<div className="flex-1">
						{/* Main verbatim quote - Clean Typography */}
						<motion.blockquote
							className="mb-2 text-base text-gray-900 leading-relaxed dark:text-white"
							style={{ borderLeftColor: themeColor }}
						>
							"{evidence.verbatim}"
						</motion.blockquote>

						{/* Context summary if present */}
						{(evidence as any).context_summary && (
							<p className="mb-3 text-muted-foreground text-sm">
								{(evidence as any).context_summary}
							</p>
						)}

						{/* Journey Stage with Theme Color Accent */}
						{evidence.journey_stage && (
							<div className="mb-3 flex items-center gap-2">
								<motion.div
									className="h-1 w-8 rounded-full transition-all duration-300"
									style={{ backgroundColor: themeColor }}
									animate={{ width: isHovered ? "2.5rem" : "2rem" }}
								/>
								<Badge
									variant="secondary"
									className="rounded-full px-3 py-1 font-medium text-xs"
									style={{
										backgroundColor: `${themeColor}10`,
										color: themeColor,
										borderColor: `${themeColor}20`,
									}}
								>
									{evidence.journey_stage}
								</Badge>
							</div>
						)}

						{/* Tags - Cleaner Layout */}
						{evidence.kind_tags && evidence.kind_tags.length > 0 && (
							<div className="mb-4 flex flex-wrap gap-2">
								{evidence.kind_tags.map((tag, index) => (
									<Badge
										key={index}
										variant="outline"
										className="rounded-full px-3 py-1 font-medium text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
									>
										{tag}
									</Badge>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Footer - Interview Link and Metadata */}
				{showInterviewLink && interviewUrl && (
					<div className="flex items-center justify-between border-gray-100 border-t pt-1 dark:border-gray-800">
						<div className="flex items-center gap-3">
							{/* Method */}
							{evidence.method && (
								<span className="font-medium text-gray-600 text-sm dark:text-gray-400">{evidence.method}</span>
							)}
							<Link to={interviewUrl}>
								<Badge
									variant="outline"
									className="rounded-full px-3 py-1 font-medium text-xs transition-colors hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/20"
								>
									{interviewTitle || "Interview"}
								</Badge>
							</Link>
						</div>

						{/* Right side metadata */}
						<div className="flex items-center gap-3">
							{/* Support/context */}
							{evidence.support && <p className="text-gray-600 text-sm dark:text-gray-400">{evidence.support}</p>}

							{/* Confidence badge */}
							{evidence.confidence && <ConfidencePill value={evidence.confidence} />}

							{/* Subtle Hover Indicator */}
							<motion.div
								className="h-2 w-2 rounded-full transition-all duration-300"
								style={{ backgroundColor: themeColor }}
								animate={{
									scale: isHovered ? 1.5 : 1,
									opacity: isHovered ? 1 : 0.5,
								}}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Subtle Gradient Overlay on Hover */}
			<motion.div
				className="pointer-events-none absolute inset-0 rounded-2xl opacity-0"
				style={{
					background: `linear-gradient(135deg, ${themeColor}05 0%, ${themeColor}02 100%)`,
				}}
				animate={{ opacity: isHovered ? 1 : 0 }}
				transition={{ duration: 0.3 }}
			/>
		</motion.div>
	)
}

export default EvidenceCard
