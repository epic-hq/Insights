import { User, Users } from "lucide-react"
import { Link, useLocation } from "react-router"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"

interface PersonaPeopleSubnavProps {
	className?: string
}

export function PersonaPeopleSubnav({ className }: PersonaPeopleSubnavProps) {
	const location = useLocation()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const isPersonasActive = location.pathname.includes("/personas")
	const isPeopleActive = location.pathname.includes("/people")

	return (
		<div className={cn("border-b bg-background", className)}>
			<div className="mx-auto max-w-6xl px-6">
				<nav className="flex space-x-8" aria-label="Personas and People navigation">
					<Link
						to={routes.personas.index()}
						className={cn(
							"flex items-center space-x-2 border-b-2 px-1 py-4 font-medium text-sm transition-colors hover:text-foreground",
							isPersonasActive
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-gray-300"
						)}
					>
						<Users className="h-4 w-4" />
						<span>Personas</span>
					</Link>
					<Link
						to={routes.people.index()}
						className={cn(
							"flex items-center space-x-2 border-b-2 px-1 py-4 font-medium text-sm transition-colors hover:text-foreground",
							isPeopleActive
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-gray-300"
						)}
					>
						<User className="h-4 w-4" />
						<span>People</span>
					</Link>
				</nav>
			</div>
		</div>
	)
}
