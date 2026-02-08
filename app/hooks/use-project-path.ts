import { useMemo } from "react";
import { useCurrentProject } from "~/contexts/current-project-context";
import { PATHS } from "~/paths";

/**
 * React hook to generate account/project-aware paths.
 * Usage:
 *   const projectPath = useProjectPath();
 *   const link = projectPath("INSIGHTS", "/123");
 *   // => /a/{accountId}/{projectId}/insights/123
 */
export function useProjectPath() {
	const { accountId, projectId } = useCurrentProject();

	// Pregenerate all base paths for this account/project
	const basePaths = useMemo(() => {
		const result: Record<string, string> = {};
		(Object.keys(PATHS) as (keyof typeof PATHS)[]).forEach((key) => {
			if (typeof PATHS[key] === "string") {
				result[key] = `/a/${accountId}/${projectId}${PATHS[key]}`;
			}
		});
		return result;
	}, [accountId, projectId]);

	/**
	 * Returns the full path for a given feature key and optional subPath.
	 * @param key - keyof typeof PATHS (e.g. "INSIGHTS")
	 * @param subPath - string (e.g. "/123" or "?sort=latest")
	 */
	function projectPath(key: keyof typeof PATHS, subPath = ""): string {
		const base = basePaths[key];
		if (!base) throw new Error(`Unknown path key: ${key}`);
		return `${base}${subPath}`;
	}

	return projectPath;
}
