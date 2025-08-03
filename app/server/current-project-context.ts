import { unstable_createContext } from "react-router"
import type { GetAccount, Project, UUID } from "~/types"
// import type { GetProject } from "~/types"

export type CurrentProjectContext = {
	current_account_id: UUID
	current_project_id: UUID | null
	account: GetAccount
	project: Project
}

export const currentProjectContext = unstable_createContext<CurrentProjectContext>(undefined)
