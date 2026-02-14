import { Settings2 } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import type { Project } from "~/types";

type ProjectEditButtonProps = {
	project?: Pick<Project, "id">;
	projectId?: string | null;
};

export const ProjectEditButton = ({ project, projectId: projectIdProp }: ProjectEditButtonProps) => {
	const { projectId: contextProjectId, projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath || "");
	const projectId = project?.id ?? projectIdProp ?? contextProjectId;

	if (!projectId) {
		return null;
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Link
						to={routes.projects.edit(projectId)}
						onClickCapture={(e) => e.stopPropagation()}
						className="z-20 border border-gray-200"
						aria-label="Edit project"
						title="Edit project"
					>
						<Button variant="ghost" className="rounded-md">
							<Settings2 className="h-4 w-4" /> Edit
						</Button>
					</Link>
				</TooltipTrigger>
				<TooltipContent side="left">Edit</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};
