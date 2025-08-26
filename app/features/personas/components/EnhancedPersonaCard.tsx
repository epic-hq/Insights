import { formatDistance } from "date-fns"
import { motion } from "framer-motion"
import { Users } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import type { Database } from "~/types"

type PersonaRow = Database["public"]["Tables"]["personas"]["Row"]

interface EnhancedPersonaCardProps {
	persona: PersonaRow & {
		people_personas?: Array<{ count: number }>
	}
	className?: string
}

export default function EnhancedPersonaCard({ persona, className }: EnhancedPersonaCardProps) {
	const [isHovered, setIsHovered] = useState(false)
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Calculate people count from junction table
	const peopleCount = persona.people_personas?.[0]?.count || 0

	// Get persona details with fallbacks
	const name = persona.name || "Untitled Persona"
	const description = persona.description || "No description available"
	const themeColor = persona.color_hex || "#6b7280"

	// Get initials for avatar
	const initials =
		name
			.replace(/^The /, "") // Remove "The " prefix
			.split(" ")
			.map((word) => word[0])
			.join("")
			.toUpperCase()
			.slice(0, 2) || "?"

	return (
		<Link to={routes.personas.detail(persona.id)}>
			<motion.div
				className={cn(
					"group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
					"transition-all duration-300 ease-out",
					"hover:shadow-black/5 hover:shadow-lg dark:hover:shadow-white/5",
					className
				)}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				whileHover={{ y: -2, scale: 1.01 }}
				transition={{ duration: 0.3, ease: "easeOut" }}
			>
				{/* Clean Metro-style Layout */}
				<div className="p-8">
					{/* Header Section - Avatar and Title Separated */}
					<div className="mb-6 flex items-center justify-between">
						{/* Avatar - Larger and More Prominent */}
						<motion.div className="relative" whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
							<Avatar
								className="h-20 w-20 border-4 border-white shadow-lg dark:border-gray-800"
								style={{ borderColor: `${themeColor}20` }}
							>
								<AvatarFallback className="font-semibold text-2xl text-white" style={{ backgroundColor: themeColor }}>
									{persona.image_url ? (
										<img src={persona.image_url} alt={name} className="h-full w-full object-cover" />
									) : (
										initials
									)}
								</AvatarFallback>
							</Avatar>
						</motion.div>

						{/* People Count Badge */}
						<motion.div
							className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 dark:bg-gray-800"
							whileHover={{ scale: 1.05 }}
						>
							<Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-700 text-sm dark:text-gray-300">{peopleCount}</span>
						</motion.div>
					</div>

					{/* Title Section - Clean Typography */}
					<div className="mb-6">
						<motion.h3
							className="mb-2 font-light text-2xl text-gray-900 leading-tight tracking-tight dark:text-white"
							style={{ color: isHovered ? themeColor : undefined }}
							transition={{ duration: 0.3 }}
						>
							{name}
						</motion.h3>

						{/* Theme Color Accent Line */}
						<motion.div
							className="h-1 w-16 rounded-full transition-all duration-300"
							style={{ backgroundColor: themeColor }}
							animate={{ width: isHovered ? "4rem" : "3rem" }}
						/>
					</div>

					{/* Description - Clean and Readable */}
					<div className="mb-8">
						<p className="line-clamp-4 text-base text-gray-600 leading-relaxed dark:text-gray-400">{description}</p>
					</div>

					{/* Footer - Minimal Metadata */}
					<div className="flex items-center justify-between">
						<div className="text-gray-400 text-xs">
							Updated {formatDistance(new Date(persona.updated_at), new Date(), { addSuffix: true })}
						</div>

						{/* Subtle Hover Indicator */}
						<motion.div
							className="flex h-2 w-2 rounded-full transition-all duration-300"
							style={{ backgroundColor: themeColor }}
							animate={{
								scale: isHovered ? 1.5 : 1,
								opacity: isHovered ? 1 : 0.5,
							}}
						/>
					</div>
				</div>

				{/* Subtle Gradient Overlay on Hover */}
				<motion.div
					className="pointer-events-none absolute inset-0 rounded-2xl opacity-0"
					style={{
						background: `linear-gradient(135deg, ${themeColor}08 0%, ${themeColor}02 100%)`,
					}}
					animate={{ opacity: isHovered ? 1 : 0 }}
					transition={{ duration: 0.3 }}
				/>
			</motion.div>
		</Link>
	)
}
