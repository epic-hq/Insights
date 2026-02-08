import consola from "consola";
import { createContext, useContext, useMemo, useState } from "react";
import { useParams, useRouteLoaderData } from "react-router";

interface CurrentProjectContextType {
	accountId: string;
	projectId: string;
	accountPath: string;
	projectPath: string;
	lastProjectPath: { accountId: string; projectId: string };
	setLastProjectPath: (path: { accountId: string; projectId: string }) => void;
}

const CurrentProjectContext = createContext<CurrentProjectContextType>({
	accountId: "",
	projectId: "",
	accountPath: "",
	projectPath: "",
	lastProjectPath: { accountId: "", projectId: "" },
	setLastProjectPath: () => {},
});

export const useCurrentProject = () => {
	const context = useContext(CurrentProjectContext);
	if (!context) {
		throw new Error("useCurrentProject must be used within an CurrentProjectContextProvider");
	}
	return context;
};

interface AccountRecord {
	account_id: string;
	name?: string | null;
	personal_account?: boolean | null;
	projects?: Array<{ id: string; account_id: string }> | null;
}

interface ProtectedLayoutData {
	auth: { accountId: string };
	accounts?: AccountRecord[] | string | null;
	user_settings?: { last_used_project_id?: string | null } | null;
}

interface CurrentProjectProviderProps {
	children: React.ReactNode;
}

export function CurrentProjectProvider({ children }: CurrentProjectProviderProps) {
	const params = useParams();
	const [lastProjectPath, setLastProjectPath] = useState<{
		accountId: string;
		projectId: string;
	}>({
		accountId: "",
		projectId: "",
	});
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | undefined;

	// Parse accounts — may be an array or a JSON string
	const accounts = useMemo<AccountRecord[]>(() => {
		if (!protectedData?.accounts) return [];
		if (typeof protectedData.accounts === "string") {
			try {
				const parsed = JSON.parse(protectedData.accounts);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}
		return Array.isArray(protectedData.accounts) ? protectedData.accounts : [];
	}, [protectedData?.accounts]);

	// Get accountId from organizations prop (top account) or fallback to URL params
	const accountId = useMemo(() => {
		if (params.accountId) return params.accountId;
		if (protectedData?.auth?.accountId) return protectedData.auth.accountId;
		// Avoid noisy errors in routes that are not account-scoped
		consola.debug("[CurrentProject] No accountId in params; non-account route");
		return "";
	}, [params.accountId, protectedData?.auth?.accountId]);

	// Resolve projectId with fallback: URL param → last_used_project_id → first available project
	const projectId = useMemo(() => {
		// Priority 1: URL param
		if (params.projectId) return params.projectId;

		// Priority 2: last_used_project_id from user_settings
		const lastUsedProjectId = protectedData?.user_settings?.last_used_project_id;
		if (lastUsedProjectId) {
			// Prefer project within current account
			if (accountId) {
				const currentAcct = accounts.find((a) => a.account_id === accountId);
				if (currentAcct?.projects?.find((p) => p.id === lastUsedProjectId)) {
					return lastUsedProjectId;
				}
			}
			// Accept project from any account
			for (const acct of accounts) {
				if (acct.projects?.find((p) => p.id === lastUsedProjectId)) {
					return lastUsedProjectId;
				}
			}
		}

		// Priority 3: First project from current account or first non-personal account
		const targetAcct =
			accounts.find((a) => a.account_id === accountId) ||
			accounts.find((a) => !a.personal_account && (a.projects?.length ?? 0) > 0);
		return targetAcct?.projects?.[0]?.id || "";
	}, [params.projectId, protectedData?.user_settings, accountId, accounts]);

	const value = {
		accountId,
		projectId,
		accountPath: `/a/${accountId}`,
		projectPath: accountId && projectId ? `/a/${accountId}/${projectId}` : "",
		lastProjectPath,
		setLastProjectPath,
	};

	return <CurrentProjectContext.Provider value={value}>{children}</CurrentProjectContext.Provider>;
}
