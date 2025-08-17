import { Link } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import type { Database } from "~/types"

type PersonaRow = Database["public"]["Tables"]["personas"]["Row"]

interface MiniPersonaCardProps {
	persona: PersonaRow
	className?: string
	showLink?: boolean
}

export default function MiniPersonaCard({ persona, className, showLink = true }: MiniPersonaCardProps) {
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Get persona details with fallbacks
	const name = persona.name || "Untitled Persona"
	const description = persona.description || "No description available"
	const themeColor = persona.color_hex || "#6b7280"
	const percentage = persona.percentage || 0

	// Get initials for avatar
	const initials =
		name
			.split(" ")
			.map((word) => word[0])
			.join("")
			.toUpperCase()
			.slice(0, 2) || "?"

	const content = (
		<Card
			className={cn(
				"group relative cursor-pointer overflow-hidden border transition-all duration-200",
				"hover:-translate-y-1 hover:shadow-md",
				showLink && "hover:bg-gray-50 dark:hover:bg-gray-800",
				className
			)}
			style={{ borderColor: themeColor }}
		>
			{/* Theme color accent bar */}
			<div className="h-1 w-full" style={{ backgroundColor: themeColor }} />

			<CardContent className="p-4">
				<div className="flex items-center gap-3">
					{/* Avatar */}
					<Avatar className="h-10 w-10 flex-shrink-0 border-2" style={{ borderColor: themeColor }}>
						<AvatarFallback className="font-medium text-sm text-white" style={{ backgroundColor: themeColor }}>
							{persona.image_url ? (
								<img src={persona.image_url} alt={name} className="h-full w-full object-cover" />
							) : (
								initials
							)}
						</AvatarFallback>
					</Avatar>

					{/* Content */}
					<div className="min-w-0 flex-1">
						<div className="flex items-center justify-between gap-2">
							<h4 className="truncate font-semibold text-gray-900 text-sm">{name}</h4>
							{percentage > 0 && (
								<Badge
									variant="secondary"
									className="flex-shrink-0 text-xs"
									style={{
										backgroundColor: `${themeColor}20`,
										color: themeColor,
										borderColor: `${themeColor}40`,
									}}
								>
									{percentage}%
								</Badge>
							)}
						</div>
						<p className="mt-1 line-clamp-2 text-gray-600 text-xs">{description}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)

	return showLink ? <Link to={routes.personas.detail(persona.id)}>{content}</Link> : content
}
