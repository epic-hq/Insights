const PROJECT_PATH_PATTERN = /^\/a\/([^/]+)\/([^/]+)(?:\/(.*))?$/;

export function buildLastProjectRouteStorageKey(accountId: string, projectId: string): string {
	return `upsight:last-route:${accountId}:${projectId}`;
}

export function parseProjectRoute(
	pathname: string
): { accountId: string; projectId: string; remainder: string } | null {
	const match = pathname.match(PROJECT_PATH_PATTERN);
	if (!match) return null;
	return {
		accountId: match[1],
		projectId: match[2],
		remainder: match[3] ?? "",
	};
}

export function isProjectRootPath(pathname: string): boolean {
	const parsed = parseProjectRoute(pathname);
	if (!parsed) return false;
	return parsed.remainder.length === 0;
}

export function readLastProjectRoute(accountId: string, projectId: string): string | null {
	if (typeof window === "undefined") return null;
	try {
		return localStorage.getItem(buildLastProjectRouteStorageKey(accountId, projectId));
	} catch {
		return null;
	}
}

export function writeLastProjectRoute(path: string): void {
	if (typeof window === "undefined") return;
	const parsed = parseProjectRoute(new URL(path, window.location.origin).pathname);
	if (!parsed) return;
	try {
		localStorage.setItem(buildLastProjectRouteStorageKey(parsed.accountId, parsed.projectId), path);
	} catch {
		// Ignore storage failures (private mode / quota).
	}
}

export function isValidProjectResumePath(path: string, accountId: string, projectId: string): boolean {
	try {
		const parsedUrl = new URL(path, window.location.origin);
		const expectedPrefix = `/a/${accountId}/${projectId}`;
		if (!parsedUrl.pathname.startsWith(expectedPrefix)) return false;
		return parsedUrl.pathname !== expectedPrefix && parsedUrl.pathname !== `${expectedPrefix}/`;
	} catch {
		return false;
	}
}
