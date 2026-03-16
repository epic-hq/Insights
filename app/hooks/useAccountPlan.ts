/**
 * Hook to access the current user's billing plan tier from the protected layout loader.
 * Returns the best (highest-tier) plan across all accounts the user belongs to.
 */
import { useRouteLoaderData } from "react-router";

export function useAccountPlan(): string {
  const data = useRouteLoaderData("routes/_ProtectedLayout") as
    | Record<string, unknown>
    | undefined;
  return (data?.accountPlanId as string) ?? "free";
}

export function isPaidPlan(planId: string): boolean {
  return planId !== "free";
}
