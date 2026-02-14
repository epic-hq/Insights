import { useEffect, useState } from "react";
import { useCurrentProject } from "~/contexts/current-project-context";
import { createClient } from "~/lib/supabase/client";
import type { Project } from "~/types";
import { getProjectById } from "../features/projects/db";

export function useCurrentProjectData() {
	const { projectId } = useCurrentProject();
	const [project, setProject] = useState<Project | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!projectId) {
			setProject(null);
			setLoading(false);
			setError(null);
			return;
		}

		const fetchProject = async () => {
			setLoading(true);
			setError(null);
			try {
				const supabase = createClient();
				const result = await getProjectById({ supabase, id: projectId });
				if (result.error) {
					setError(result.error.message);
					setProject(null);
				} else {
					setProject(result.data);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch project");
				setProject(null);
			} finally {
				setLoading(false);
			}
		};

		fetchProject();
	}, [projectId]);

	return { project, loading, error };
}
