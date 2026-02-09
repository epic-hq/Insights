import { Building2, User, VenetianMask } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";

interface PersonaPeopleSubnavProps {
	className?: string;
}

export function PersonaPeopleSubnav({ className }: PersonaPeopleSubnavProps) {
	const location = useLocation();
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath || "");

	const isPersonasActive = location.pathname.includes("/personas");
	const isPeopleActive = location.pathname.includes("/people");
	const isOrganizationsActive = location.pathname.includes("/organizations");

	return (
		<div className={cn("border-b bg-background", className)}>
			<div className="mx-auto max-w-6xl px-3 sm:px-6">
				<nav
					className="flex min-w-max items-center gap-4 overflow-x-auto sm:gap-8"
					aria-label="Personas and People navigation"
				>
					<Link
						to={routes.people.index()}
						className={cn(
							"flex shrink-0 items-center space-x-2 border-b-2 px-1 py-3 font-medium text-xs transition-colors hover:text-foreground sm:py-4 sm:text-sm",
							isPeopleActive
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-gray-300"
						)}
					>
						<User className="h-4 w-4" />
						<span>People</span>
					</Link>
					<Link
						to={routes.organizations.index()}
						className={cn(
							"flex shrink-0 items-center space-x-2 border-b-2 px-1 py-3 font-medium text-xs transition-colors hover:text-foreground sm:py-4 sm:text-sm",
							isOrganizationsActive
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-gray-300"
						)}
					>
						<Building2 className="h-4 w-4" />
						<span>Organizations</span>
					</Link>
					<Link
						to={routes.personas.index()}
						className={cn(
							"flex shrink-0 items-center space-x-2 border-b-2 px-1 py-3 font-medium text-xs transition-colors hover:text-foreground sm:py-4 sm:text-sm",
							isPersonasActive
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-gray-300"
						)}
					>
						<VenetianMask className="h-4 w-4" />
						<span>Personas</span>
					</Link>
				</nav>
			</div>
		</div>
	);
}
