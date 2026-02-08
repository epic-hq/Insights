/**
 * Hook for fetching and caching user profiles
 * Used to display user names in annotations, comments, and other places
 */

import { useCallback, useState } from "react";

export interface UserProfile {
	id: string;
	name: string;
	avatar_url: string | null;
}

interface UseUserProfilesReturn {
	profiles: Record<string, UserProfile>;
	fetchProfiles: (userIds: string[]) => Promise<void>;
	getProfile: (userId: string) => UserProfile | null;
	isLoading: boolean;
}

/**
 * Hook to fetch and cache user profiles
 * Automatically deduplicates requests and caches results
 */
export function useUserProfiles(): UseUserProfilesReturn {
	const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
	const [isLoading, setIsLoading] = useState(false);

	const fetchProfiles = useCallback(
		async (userIds: string[]) => {
			// Filter out already cached profiles
			const uncachedIds = userIds.filter((id) => id && !profiles[id]);
			if (uncachedIds.length === 0) return;

			setIsLoading(true);

			try {
				// Fetch all uncached profiles in parallel
				const results = await Promise.all(
					uncachedIds.map((userId) =>
						fetch(`/api/user-profile?userId=${userId}`)
							.then((res) => (res.ok ? res.json() : null))
							.then((data) => (data && !data.error ? { userId, ...data } : null))
							.catch(() => null)
					)
				);

				// Update profiles cache
				const newProfiles: Record<string, UserProfile> = {};
				for (const result of results) {
					if (result?.userId) {
						newProfiles[result.userId] = {
							id: result.id,
							name: result.name,
							avatar_url: result.avatar_url,
						};
					}
				}

				if (Object.keys(newProfiles).length > 0) {
					setProfiles((prev) => ({ ...prev, ...newProfiles }));
				}
			} finally {
				setIsLoading(false);
			}
		},
		[profiles]
	);

	const getProfile = useCallback(
		(userId: string): UserProfile | null => {
			return profiles[userId] || null;
		},
		[profiles]
	);

	return { profiles, fetchProfiles, getProfile, isLoading };
}
