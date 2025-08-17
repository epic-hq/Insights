/**
 * Server-side route builder utility for use in loaders and actions
 * Uses shared route definitions to maintain single source of truth
 */

import { createRouteDefinitions, type RouteDefinitions } from "./route-definitions"

/**
 * Creates project routes for server-side use (loaders, actions)
 * @param accountId - Account ID
 * @param projectId - Project ID
 * @returns Route definitions object
 */
export function createProjectRoutes(accountId: string, projectId: string): RouteDefinitions {
	const projectPath = `/a/${accountId}/${projectId}`
	return createRouteDefinitions(projectPath)
}

/**
 * Legacy compatibility function - accepts full project path
 * @deprecated Use createProjectRoutes(accountId, projectId) instead
 */
export function createProjectRoutesFromPath(projectPath: string): RouteDefinitions {
	return createRouteDefinitions(projectPath)
}
