import { useMemo } from "react";
import { createRouteDefinitions } from "~/utils/route-definitions";

/**
 * Type-safe route builder hook that handles all project-scoped routes
 * Uses shared route definitions to maintain single source of truth
 */
export function useProjectRoutes(projectPath = "") {
	return useMemo(() => {
		return createRouteDefinitions(projectPath);
	}, [projectPath]);
}

/**
 * Hook that creates project routes from accountId and projectId
 * @param accountId - Account ID
 * @param projectId - Project ID
 */
export function useProjectRoutesFromIds(accountId: string, projectId: string) {
	return useMemo(() => {
		const projectPath = accountId && projectId ? `/a/${accountId}/${projectId}` : "";
		return createRouteDefinitions(projectPath);
	}, [accountId, projectId]);
}

/**
 * Type definitions for better IDE support
 */
type RouteBuilder = ReturnType<typeof useProjectRoutes>;
type InterviewRoutes = RouteBuilder["interviews"];
type InsightRoutes = RouteBuilder["insights"];
type PeopleRoutes = RouteBuilder["people"];
type PersonaRoutes = RouteBuilder["personas"];
type OpportunityRoutes = RouteBuilder["opportunities"];
type OrganizationRoutes = RouteBuilder["organizations"];
type ProjectRoutes = RouteBuilder["projects"];
type AuthRoutes = RouteBuilder["auth"];
type ApiRoutes = RouteBuilder["api"];
type SalesBaseRoute = RouteBuilder["salesBase"];
