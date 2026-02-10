import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import type { Annotation, AnnotationMetadata, AnnotationType, EntityType, FlagType, UserFlags, VoteCounts } from "./db";

// -----------------------------------------------------------------------------
// How these hooks work & where to optimize DB calls
// -----------------------------------------------------------------------------
// Flow
// - We rely on project-scoped API routes from `useProjectRoutes(projectPath)` to
//   fetch and mutate annotations, votes, and entity flags.
// - Each hook (`useAnnotations`, `useVoting`, `useEntityFlags`) builds a
//   querystring and calls a single API endpoint (via `useFetcher.load/submit`).
// - Server loaders/actions (see `features/annotations/api/*.tsx`) use the
//   middleware-provided context (account_id, project_id) to perform
//   RLS-protected queries in `features/annotations/db.ts`.
//
// Reducing DB calls (batching opportunities)
// - Voting: the votes API supports batched queries by passing multiple
//   `entityId` values (CSV or repeated params). For list pages, prefer a
//   batched hook that requests all IDs at once instead of one-by-one per card.
// - Flags: similar opportunity if we add a batch endpoint (e.g. return flags
//   for many entities in one call). Today this hook targets one entity.
// - Annotations: for lists where only counts or latest items are needed, expose
//   lightweight endpoints (e.g. only counts) to avoid fetching full threads.
//
// Implementation notes
// - Always use `routes.api.*()` helpers for paths to preserve the
//   `/a/:accountId/p/:projectId` context.
// - Keep effects keyed by stable inputs (entityType, entityId, projectPath).
// - Avoid redundant auth calls in loaders/actions; rely on middleware context.

// =============================================================================
// ANNOTATIONS HOOKS
// =============================================================================
// TODO: Write explanation of how this works and where we can make changes to reduce the number of db calls, potentially batching or changing the query.

function useAnnotations({
	entityType,
	entityId,
	annotationType,
	includeThreads = true,
}: {
	entityType: EntityType;
	entityId: string;
	annotationType?: AnnotationType;
	includeThreads?: boolean;
}) {
	const fetcher = useFetcher();
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath);

	const [annotations, setAnnotations] = useState<Annotation[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	// Fix: Remove routes from deps to prevent infinite loop - routes is a new object every render
	const annotationsEndpoint = useMemo(
		() => (projectPath ? routes.api.annotations() : null),
		[projectPath, routes.api.annotations]
	);

	// Fetch annotations on mount and when parameters change
	useEffect(() => {
		if (!entityId || !annotationsEndpoint) return;

		setIsLoading(true);
		setError(null);

		const searchParams = new URLSearchParams({
			entityType,
			entityId,
			...(annotationType && { annotationType }),
			includeThreads: includeThreads.toString(),
		});

		fetcher.load(`${annotationsEndpoint}?${searchParams}`);
		// Only depend on stable inputs; avoid fetcher/routes object identity churn
	}, [entityType, entityId, annotationType, includeThreads, annotationsEndpoint, fetcher.load]);

	// Handle fetcher state changes
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data) {
			if (fetcher.data.error) {
				setError(fetcher.data.error.message || "Failed to fetch annotations");
				setAnnotations([]);
			} else {
				setAnnotations(fetcher.data.annotations || []);
				setError(null);
			}
			setIsLoading(false);
		} else if (fetcher.state === "loading") {
			setIsLoading(true);
		}
	}, [fetcher.state, fetcher.data]);

	const addComment = (content: string, contentJsonb?: Record<string, unknown>, parentId?: string) => {
		if (!content.trim()) return;

		// Submit to server without optimistic update
		fetcher.submit(
			{
				action: "add-comment",
				entityType,
				entityId,
				content: content.trim(),
				...(contentJsonb && { contentJsonb: JSON.stringify(contentJsonb) }),
				...(parentId && { parentId }),
			},
			{ method: "POST", action: routes.api.annotations() }
		);
	};

	const addAISuggestion = (suggestion: string, context?: AnnotationMetadata) => {
		if (!suggestion.trim()) return;

		fetcher.submit(
			{
				action: "add-ai-suggestion",
				entityType,
				entityId,
				content: suggestion.trim(),
				metadata: JSON.stringify(context || {}),
			},
			{ method: "POST", action: routes.api.annotations() }
		);
	};

	const updateAnnotation = (annotationId: string, updates: Partial<Annotation>) => {
		// Submit to server without optimistic update
		fetcher.submit(
			{
				action: "update-annotation",
				annotationId,
				updates: JSON.stringify(updates),
			},
			{ method: "POST", action: routes.api.annotations() }
		);
	};

	const deleteAnnotation = (annotationId: string) => {
		// Submit to server without optimistic update
		fetcher.submit(
			{
				action: "delete-annotation",
				annotationId,
			},
			{ method: "POST", action: routes.api.annotations() }
		);
	};

	return {
		annotations,
		isLoading,
		error,
		addComment,
		addAISuggestion,
		updateAnnotation,
		deleteAnnotation,
		refetch: () => {
			if (!annotationsEndpoint) return;
			const searchParams = new URLSearchParams({
				entityType,
				entityId,
				...(annotationType && { annotationType }),
				includeThreads: includeThreads.toString(),
			});
			fetcher.load(`${annotationsEndpoint}?${searchParams}`);
		},
	};
}

// =============================================================================
// VOTING HOOKS
// =============================================================================

export function useVoting({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
	const loadFetcher = useFetcher();
	const voteFetcher = useFetcher();
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath);

	// Server-confirmed vote counts (updated after each successful load or mutation)
	const [serverCounts, setServerCounts] = useState<VoteCounts>({
		upvotes: 0,
		downvotes: 0,
		total_votes: 0,
		user_vote: 0,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const votesEndpoint = useMemo(() => (projectPath ? routes.api.votes() : null), [projectPath, routes.api.votes]);

	// Fetch vote counts on mount and when entity changes
	useEffect(() => {
		if (!entityId || !votesEndpoint) return;
		setIsLoading(true);
		setError(null);
		const searchParams = new URLSearchParams({ entityType, entityId });
		loadFetcher.load(`${votesEndpoint}?${searchParams}`);
	}, [entityType, entityId, votesEndpoint, loadFetcher.load]);

	// Sync server state from initial load
	useEffect(() => {
		if (loadFetcher.state !== "idle" || !loadFetcher.data) return;
		if (loadFetcher.data.error) {
			setError(loadFetcher.data.error.message || "Failed to fetch votes");
		} else {
			const counts = loadFetcher.data.voteCounts || {
				upvotes: 0,
				downvotes: 0,
				total_votes: 0,
				user_vote: 0,
			};
			setServerCounts(counts);
			setError(null);
		}
		setIsLoading(false);
	}, [loadFetcher.state, loadFetcher.data]);

	// Sync server state from mutation responses
	useEffect(() => {
		if (voteFetcher.state !== "idle" || !voteFetcher.data) return;
		if (voteFetcher.data.error) {
			setError(voteFetcher.data.error.message || "Vote failed");
		} else if (voteFetcher.data.voteCounts) {
			setServerCounts(voteFetcher.data.voteCounts);
			setError(null);
		}
	}, [voteFetcher.state, voteFetcher.data]);

	// Derive optimistic vote counts from in-flight formData (React Router 7 pattern)
	const voteCounts = useMemo(() => {
		const formData = voteFetcher.formData;
		if (!formData) return serverCounts;

		const action = formData.get("action") as string;
		if (action === "upsert-vote") {
			const voteValue = Number.parseInt(formData.get("voteValue") as string, 10) as 1 | -1;
			// If user already has this vote, no change
			if (serverCounts.user_vote === voteValue) return serverCounts;
			return {
				upvotes: serverCounts.upvotes + (voteValue === 1 ? 1 : 0) + (serverCounts.user_vote === 1 ? -1 : 0),
				downvotes: serverCounts.downvotes + (voteValue === -1 ? 1 : 0) + (serverCounts.user_vote === -1 ? -1 : 0),
				total_votes: serverCounts.total_votes + (serverCounts.user_vote === 0 ? 1 : 0),
				user_vote: voteValue,
			};
		}
		if (action === "remove-vote") {
			return {
				upvotes: serverCounts.user_vote === 1 ? serverCounts.upvotes - 1 : serverCounts.upvotes,
				downvotes: serverCounts.user_vote === -1 ? serverCounts.downvotes - 1 : serverCounts.downvotes,
				total_votes: serverCounts.user_vote !== 0 ? serverCounts.total_votes - 1 : serverCounts.total_votes,
				user_vote: 0,
			};
		}
		return serverCounts;
	}, [voteFetcher.formData, serverCounts]);

	const vote = (voteValue: 1 | -1) => {
		voteFetcher.submit(
			{
				action: "upsert-vote",
				entityType,
				entityId,
				voteValue: voteValue.toString(),
			},
			{ method: "POST", action: routes.api.votes() }
		);
	};

	const removeVote = () => {
		voteFetcher.submit({ action: "remove-vote", entityType, entityId }, { method: "POST", action: routes.api.votes() });
	};

	const upvote = () => vote(1);
	const downvote = () => vote(-1);

	return {
		voteCounts,
		isLoading,
		error,
		vote,
		removeVote,
		upvote,
		downvote,
		refetch: () => {
			if (!votesEndpoint) return;
			const searchParams = new URLSearchParams({ entityType, entityId });
			loadFetcher.load(`${votesEndpoint}?${searchParams}`);
		},
	};
}

// =============================================================================
// ENTITY FLAGS HOOKS
// =============================================================================

export function useEntityFlags({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
	const fetcher = useFetcher();
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath);

	const [flags, setFlags] = useState<UserFlags>({
		hidden: false,
		archived: false,
		starred: false,
		priority: false,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	// Fix: Remove routes from deps to prevent infinite loop - routes is a new object every render
	const entityFlagsEndpoint = useMemo(
		() => (projectPath ? routes.api.entityFlags() : null),
		[projectPath, routes.api.entityFlags]
	);

	// Fetch flags on mount and when parameters change
	useEffect(() => {
		if (!entityId || !entityFlagsEndpoint) return;

		setIsLoading(true);
		setError(null);

		const searchParams = new URLSearchParams({
			entityType,
			entityId,
		});

		fetcher.load(`${entityFlagsEndpoint}?${searchParams}`);
		// Only depend on stable inputs; avoid fetcher/routes object identity churn
	}, [entityType, entityId, entityFlagsEndpoint, fetcher.load]);

	// Handle fetcher state changes
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data) {
			if (fetcher.data.error) {
				setError(fetcher.data.error.message || "Failed to fetch flags");
			} else {
				setFlags(
					fetcher.data.flags || {
						hidden: false,
						archived: false,
						starred: false,
						priority: false,
					}
				);
				setError(null);
			}
			setIsLoading(false);
		} else if (fetcher.state === "loading") {
			setIsLoading(true);
		}
	}, [fetcher.state, fetcher.data]);

	const setFlag = (flagType: FlagType, flagValue: boolean, metadata?: AnnotationMetadata) => {
		// Optimistic update
		setFlags((prev) => ({
			...prev,
			[flagType]: flagValue,
		}));

		// Submit to server
		fetcher.submit(
			{
				action: "set-flag",
				entityType,
				entityId,
				flagType,
				flagValue: flagValue.toString(),
				...(metadata && { metadata: JSON.stringify(metadata) }),
			},
			{ method: "POST", action: routes.api.entityFlags() }
		);
	};

	const toggleFlag = (flagType: FlagType, metadata?: AnnotationMetadata) => {
		const currentValue = flags[flagType];
		setFlag(flagType, !currentValue, metadata);
	};

	const hide = () => setFlag("hidden", true);
	const unhide = () => setFlag("hidden", false);
	const archive = () => setFlag("archived", true);
	const unarchive = () => setFlag("archived", false);
	const star = () => setFlag("starred", true);
	const unstar = () => setFlag("starred", false);
	const setPriority = () => setFlag("priority", true);
	const unsetPriority = () => setFlag("priority", false);

	return {
		flags,
		isLoading,
		error,
		setFlag,
		toggleFlag,
		hide,
		unhide,
		archive,
		unarchive,
		star,
		unstar,
		setPriority,
		unsetPriority,
		refetch: () => {
			if (!entityFlagsEndpoint) return;
			const searchParams = new URLSearchParams({
				entityType,
				entityId,
			});
			fetcher.load(`${entityFlagsEndpoint}?${searchParams}`);
		},
	};
}

// =============================================================================
// COMBINED HOOK FOR CONVENIENCE
// =============================================================================

export function useEntityAnnotations({
	entityType,
	entityId,
	includeComments = true,
	includeVoting = true,
	includeFlags = true,
}: {
	entityType: EntityType;
	entityId: string;
	includeComments?: boolean;
	includeVoting?: boolean;
	includeFlags?: boolean;
}) {
	const annotationsHook = useAnnotations({
		entityType,
		entityId,
		annotationType: includeComments ? "comment" : undefined,
	});

	const votingHook = useVoting({
		entityType,
		entityId,
	});

	const flagsHook = useEntityFlags({
		entityType,
		entityId,
	});

	return {
		// Annotations data
		annotations: includeComments ? annotationsHook.annotations : [],
		submitAnnotation: includeComments
			? (content: string, contentJsonb?: Record<string, unknown>) => annotationsHook.addComment(content, contentJsonb)
			: () => {},
		refetchAnnotations: includeComments ? annotationsHook.refetch : () => {},

		// Voting data
		voteCounts: includeVoting
			? {
					upvotes: votingHook.voteCounts.upvotes,
					downvotes: votingHook.voteCounts.downvotes,
				}
			: { upvotes: 0, downvotes: 0 },
		userVote: includeVoting ? { vote_value: votingHook.voteCounts.user_vote } : null,
		submitVote: includeVoting
			? ({ vote_value, _action }: { vote_value?: number; _action?: string }) => {
					if (_action === "remove") {
						votingHook.removeVote();
					} else if (vote_value) {
						votingHook.vote(vote_value as 1 | -1);
					}
				}
			: () => {},

		// Flags data
		userFlags: includeFlags
			? Object.entries(flagsHook.flags)
					.filter(([_, value]) => value)
					.map(([key, value]) => ({ flag_type: key, flag_value: value }))
			: [],
		submitFlag: includeFlags
			? ({ flag_type, flag_value }: { flag_type: string; flag_value: boolean }) =>
					flagsHook.setFlag(flag_type as FlagType, flag_value)
			: () => {},

		// Loading states
		isLoading:
			(includeComments && annotationsHook.isLoading) ||
			(includeVoting && votingHook.isLoading) ||
			(includeFlags && flagsHook.isLoading),
		hasError:
			(includeComments && annotationsHook.error) ||
			(includeVoting && votingHook.error) ||
			(includeFlags && flagsHook.error),
	};
}
