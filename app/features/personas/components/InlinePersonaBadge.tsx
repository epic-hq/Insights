import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import type { Database } from "~/types"

type PersonaRow = Database["public"]["Tables"]["personas"]["Row"]

interface InlinePersonaBadgeProps {
	persona: PersonaRow
	className?: string
}

export default function InlinePersonaBadge({ persona, className }: InlinePersonaBadgeProps) {
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const name = persona.name || "Untitled Persona"
	const themeColor = persona.color_hex || "#6b7280"

	return (
		<Link to={routes.personas.detail(persona.id)}>
			<Badge
				variant="outline"
				className={cn("px-1 py-0 text-xs", className)}
				style={{ borderColor: themeColor, color: themeColor }}
			>
				{name}
			</Badge>
		</Link>
	)
}
