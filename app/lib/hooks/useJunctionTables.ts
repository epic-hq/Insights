/**
 * React hooks for junction table operations
 * Provides client-side utilities for managing normalized relationships
 */

import { useCallback, useEffect, useState } from "react";
import { createJunctionTableManager } from "~/lib/database/junction-helpers";
import { getSupabaseClient } from "~/lib/supabase/client";

/**
 * Hook for managing insight tags
 */
export function useInsightTags(insightId: string) {
	const [tags, setTags] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const supabase = getSupabaseClient();
	const junctionManager = createJunctionTableManager(supabase);

	const loadTags = useCallback(async () => {
		if (!insightId) return;

		setLoading(true);
		setError(null);

		try {
			const { data, error } = await junctionManager.insightTags.getTagsForInsight(insightId);
			if (error) throw error;
			setTags(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load tags");
		} finally {
			setLoading(false);
		}
	}, [insightId, junctionManager]);

	const syncTags = useCallback(
		async (newTags: string[], accountId: string) => {
			setError(null);
			try {
				const { error } = await junctionManager.insightTags.syncTags({
					insightId,
					tags: newTags,
					accountId,
				});
				if (error) throw error;
				setTags(newTags);
				return { success: true };
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to sync tags";
				setError(errorMessage);
				return { success: false, error: errorMessage };
			}
		},
		[insightId, junctionManager]
	);

	const addTags = useCallback(
		async (newTags: string[], accountId: string) => {
			setError(null);
			try {
				const { error } = await junctionManager.insightTags.addTags({
					insightId,
					tags: newTags,
					accountId,
				});
				if (error) throw error;
				await loadTags(); // Reload to get updated list
				return { success: true };
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to add tags";
				setError(errorMessage);
				return { success: false, error: errorMessage };
			}
		},
		[insightId, junctionManager, loadTags]
	);

	const removeTags = useCallback(
		async (tagsToRemove: string[]) => {
			setError(null);
			try {
				const { error } = await junctionManager.insightTags.removeTags({
					insightId,
					tags: tagsToRemove,
				});
				if (error) throw error;
				await loadTags(); // Reload to get updated list
				return { success: true };
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to remove tags";
				setError(errorMessage);
				return { success: false, error: errorMessage };
			}
		},
		[insightId, junctionManager, loadTags]
	);

	useEffect(() => {
		loadTags();
	}, [loadTags]);

	return {
		tags,
		loading,
		error,
		syncTags,
		addTags,
		removeTags,
		reload: loadTags,
	};
}

/**
 * Hook for managing opportunity insights
 */
export function useOpportunityInsights(opportunityId: string) {
	const [insights, setInsights] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const supabase = getSupabaseClient();
	const junctionManager = createJunctionTableManager(supabase);

	const loadInsights = useCallback(async () => {
		if (!opportunityId) return;

		setLoading(true);
		setError(null);

		try {
			const { data, error } = await junctionManager.opportunityInsights.getInsightsForOpportunity(opportunityId);
			if (error) throw error;
			setInsights(data || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load insights");
		} finally {
			setLoading(false);
		}
	}, [opportunityId, junctionManager]);

	const syncInsights = useCallback(
		async (insightIds: string[], weights?: Record<string, number>) => {
			setError(null);
			try {
				const { error } = await junctionManager.opportunityInsights.syncInsights({
					opportunityId,
					insightIds,
					weights,
				});
				if (error) throw error;
				await loadInsights(); // Reload to get updated list
				return { success: true };
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to sync insights";
				setError(errorMessage);
				return { success: false, error: errorMessage };
			}
		},
		[opportunityId, junctionManager, loadInsights]
	);

	const addInsights = useCallback(
		async (insightIds: string[], weights?: Record<string, number>) => {
			setError(null);
			try {
				const { error } = await junctionManager.opportunityInsights.addInsights({
					opportunityId,
					insightIds,
					weights,
				});
				if (error) throw error;
				await loadInsights(); // Reload to get updated list
				return { success: true };
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to add insights";
				setError(errorMessage);
				return { success: false, error: errorMessage };
			}
		},
		[opportunityId, junctionManager, loadInsights]
	);

	useEffect(() => {
		loadInsights();
	}, [loadInsights]);

	return {
		insights,
		loading,
		error,
		syncInsights,
		addInsights,
		reload: loadInsights,
	};
}

/**
 * Hook for managing persona insights
 */
export function usePersonaInsights(personaId: string) {
	const [insights, setInsights] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const supabase = getSupabaseClient();
	const junctionManager = createJunctionTableManager(supabase);

	const loadInsights = useCallback(async () => {
		if (!personaId) return;

		setLoading(true);
		setError(null);

		try {
			const { data, error } = await junctionManager.personaInsights.getInsightsForPersona(personaId);
			if (error) throw error;
			setInsights(data || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load insights");
		} finally {
			setLoading(false);
		}
	}, [personaId, junctionManager]);

	const linkInsight = useCallback(
		async (insightId: string, relevanceScore?: number) => {
			setError(null);
			try {
				const { error } = await junctionManager.personaInsights.linkInsightToPersona({
					personaId,
					insightId,
					relevanceScore,
				});
				if (error) throw error;
				await loadInsights(); // Reload to get updated list
				return { success: true };
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to link insight";
				setError(errorMessage);
				return { success: false, error: errorMessage };
			}
		},
		[personaId, junctionManager, loadInsights]
	);

	useEffect(() => {
		loadInsights();
	}, [loadInsights]);

	return {
		insights,
		loading,
		error,
		linkInsight,
		reload: loadInsights,
	};
}

/**
 * Hook for managing project people
 */
export function useProjectPeople(projectId: string) {
	const [people, setPeople] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const supabase = getSupabaseClient();
	const junctionManager = createJunctionTableManager(supabase);

	const loadPeople = useCallback(async () => {
		if (!projectId) return;

		setLoading(true);
		setError(null);

		try {
			const { data, error } = await junctionManager.projectPeople.getPeopleForProject(projectId);
			if (error) throw error;
			setPeople(data || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load people");
		} finally {
			setLoading(false);
		}
	}, [projectId, junctionManager]);

	const updateStats = useCallback(
		async (personId: string, role?: string) => {
			setError(null);
			try {
				const { error } = await junctionManager.projectPeople.updateStats({
					projectId,
					personId,
					role,
				});
				if (error) throw error;
				await loadPeople(); // Reload to get updated stats
				return { success: true };
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to update stats";
				setError(errorMessage);
				return { success: false, error: errorMessage };
			}
		},
		[projectId, junctionManager, loadPeople]
	);

	useEffect(() => {
		loadPeople();
	}, [loadPeople]);

	return {
		people,
		loading,
		error,
		updateStats,
		reload: loadPeople,
	};
}

/**
 * Hook for managing interview tags
 */
export function useInterviewTags(interviewId: string) {
	const [tags, setTags] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const supabase = getSupabaseClient();
	const junctionManager = createJunctionTableManager(supabase);

	const loadTags = useCallback(async () => {
		if (!interviewId) return;

		setLoading(true);
		setError(null);

		try {
			const { data, error } = await junctionManager.interviewTags.getTagsForInterview(interviewId);
			if (error) throw error;
			setTags(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load tags");
		} finally {
			setLoading(false);
		}
	}, [interviewId, junctionManager]);

	const syncTags = useCallback(
		async (newTags: string[], accountId: string) => {
			setError(null);
			try {
				const { error } = await junctionManager.interviewTags.syncTags({
					interviewId,
					tags: newTags,
					accountId,
				});
				if (error) throw error;
				setTags(newTags);
				return { success: true };
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to sync tags";
				setError(errorMessage);
				return { success: false, error: errorMessage };
			}
		},
		[interviewId, junctionManager]
	);

	useEffect(() => {
		loadTags();
	}, [loadTags]);

	return {
		tags,
		loading,
		error,
		syncTags,
		reload: loadTags,
	};
}

/**
 * General purpose hook for junction table operations
 */
export function useJunctionTables() {
	const supabase = getSupabaseClient();
	const junctionManager = createJunctionTableManager(supabase);

	return {
		insightTags: junctionManager.insightTags,
		interviewTags: junctionManager.interviewTags,
		opportunityInsights: junctionManager.opportunityInsights,
		projectPeople: junctionManager.projectPeople,
		personaInsights: junctionManager.personaInsights,

		// Migration utility
		migrateArrayData: (accountId: string) => junctionManager.migrateArrayData(accountId),
	};
}
