import { createContext } from "react-router";
import type { GetAccount, Project, UUID } from "~/types";
// import type { GetProject } from "~/types"

export type CurrentProjectContext = {
	accountId: UUID | null;
	projectId: UUID | null;
	account: GetAccount | null;
	project: Project | null;
};

export const currentProjectContext = createContext<CurrentProjectContext>({
	accountId: null,
	projectId: null,
	account: null,
	project: null,
});
