import { createContext } from "react-router"
import type { GetAccount, Project, UUID } from "~/types"
// import type { GetProject } from "~/types"

export type CurrentProjectContext = {
	accountId: UUID
	projectId: UUID | null
	account: GetAccount
	project: Project
}

export const currentProjectContext = createContext<CurrentProjectContext>(undefined)
