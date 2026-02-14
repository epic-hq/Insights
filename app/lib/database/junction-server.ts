/**
 * Server-side junction table utilities
 * Integrates junction table helpers with server-side Supabase client
 */

import { getServerClient } from "~/lib/supabase/client.server";
import { createJunctionTableManager, type JunctionTableManager } from "./junction-helpers";

/**
 * Get junction table manager for server-side operations
 */
export async function getJunctionManager(request: Request): Promise<JunctionTableManager> {
	const supabase = getServerClient(request);
	return createJunctionTableManager(supabase);
}

/**
 * Helper to get account ID from request
 */
export async function getAccountId(request: Request): Promise<string> {
	const supabase = getServerClient(request);
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("User not authenticated");
	}

	// Extract account ID from JWT claims
	const jwt = await supabase.auth.getSession();
	const accountId = jwt.data.session?.user?.app_metadata?.claims?.sub;

	if (!accountId) {
		throw new Error("Account ID not found in user claims");
	}

	return accountId;
}

/**
 * Server-side junction table operations with authentication
 */
export class ServerJunctionManager {
	private junctionManager: JunctionTableManager;
	private accountId: string;

	constructor(junctionManager: JunctionTableManager, accountId: string) {
		this.junctionManager = junctionManager;
		this.accountId = accountId;
	}

	/**
	 * Sync insight tags with automatic account ID
	 */
	async syncInsightTags(insightId: string, tags: string[]) {
		return this.junctionManager.insightTags.syncTags({
			insightId,
			tags,
			accountId: this.accountId,
		});
	}

	/**
	 * Sync interview tags with automatic account ID
	 */
	async syncInterviewTags(interviewId: string, tags: string[]) {
		return this.junctionManager.interviewTags.syncTags({
			interviewId,
			tags,
			accountId: this.accountId,
		});
	}

	/**
	 * Sync opportunity insights
	 */
	async syncOpportunityInsights(opportunityId: string, insightIds: string[], weights?: Record<string, number>) {
		return this.junctionManager.opportunityInsights.syncInsights({
			opportunityId,
			insightIds,
			weights,
		});
	}

	/**
	 * Auto-link insight to personas based on interview participants
	 */
	async autoLinkInsightToPersonas(insightId: string) {
		return this.junctionManager.personaInsights.autoLinkInsightToPersonas(insightId);
	}

	/**
	 * Update project-people stats
	 */
	async updateProjectPeopleStats(projectId: string, personId: string, role?: string) {
		return this.junctionManager.projectPeople.updateStats({
			projectId,
			personId,
			role,
		});
	}

	/**
	 * Migrate all array-based data for this account
	 */
	async migrateArrayData() {
		return this.junctionManager.migrateArrayData(this.accountId);
	}
}

/**
 * Factory function to create authenticated server junction manager
 */
export async function createServerJunctionManager(request: Request): Promise<ServerJunctionManager> {
	const junctionManager = await getJunctionManager(request);
	const accountId = await getAccountId(request);
	return new ServerJunctionManager(junctionManager, accountId);
}

/**
 * Route helper functions for common junction table operations
 */
export const junctionRouteHelpers = {
	/**
	 * Process insight creation/update with tags
	 */
	async processInsightWithTags(request: Request, insightId: string, tags: string[]) {
		const manager = await createServerJunctionManager(request);

		// Sync tags
		await manager.syncInsightTags(insightId, tags);

		// Auto-link to personas
		await manager.autoLinkInsightToPersonas(insightId);

		return { success: true };
	},

	/**
	 * Process opportunity creation/update with insights
	 */
	async processOpportunityWithInsights(
		request: Request,
		opportunityId: string,
		insightIds: string[],
		weights?: Record<string, number>
	) {
		const manager = await createServerJunctionManager(request);

		// Sync insights
		await manager.syncOpportunityInsights(opportunityId, insightIds, weights);

		return { success: true };
	},

	/**
	 * Process interview creation with people and tags
	 */
	async processInterviewWithMetadata(
		request: Request,
		interviewId: string,
		projectId: string,
		peopleIds: string[],
		tags: string[] = []
	) {
		const manager = await createServerJunctionManager(request);

		// Sync interview tags
		if (tags.length > 0) {
			await manager.syncInterviewTags(interviewId, tags);
		}

		// Update project-people stats for all participants
		for (const personId of peopleIds) {
			await manager.updateProjectPeopleStats(projectId, personId);
		}

		return { success: true };
	},
};
