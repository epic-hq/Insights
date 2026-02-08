import { useEffect, useState } from "react";
import { useCurrentProject } from "~/contexts/current-project-context";
import { createClient } from "~/lib/supabase/client";

interface ProjectDataAvailability {
	hasInterviews: boolean;
	hasEvidence: boolean;
	hasAnalysisData: boolean;
	isLoading: boolean;
	error: string | null;
}

export function useProjectDataAvailability(): ProjectDataAvailability {
	const { projectId } = useCurrentProject();
	const [state, setState] = useState<ProjectDataAvailability>({
		hasInterviews: false,
		hasEvidence: false,
		hasAnalysisData: false,
		isLoading: true,
		error: null,
	});

	useEffect(() => {
		if (!projectId) {
			setState({
				hasInterviews: false,
				hasEvidence: false,
				hasAnalysisData: false,
				isLoading: false,
				error: null,
			});
			return;
		}

		const checkDataAvailability = async () => {
			try {
				const supabase = createClient();

				// Check for interviews
				const { data: interviews, error: interviewsError } = await supabase
					.from("interviews")
					.select("id")
					.eq("project_id", projectId)
					.limit(1);

				// Check for evidence
				const { data: evidence, error: evidenceError } = await supabase
					.from("evidence")
					.select("id")
					.eq("project_id", projectId)
					.limit(1);

				const hasInterviews = interviews && interviews.length > 0;
				const hasEvidence = evidence && evidence.length > 0;
				const hasAnalysisData = hasInterviews || hasEvidence;

				setState({
					hasInterviews,
					hasEvidence,
					hasAnalysisData,
					isLoading: false,
					error: interviewsError?.message || evidenceError?.message || null,
				});
			} catch (error) {
				setState({
					hasInterviews: false,
					hasEvidence: false,
					hasAnalysisData: false,
					isLoading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		};

		setState((prev) => ({ ...prev, isLoading: true }));
		checkDataAvailability();
	}, [projectId]);

	return state;
}
