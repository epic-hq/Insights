import { createContext } from "react-router"
import type { GetAccount, UUID } from "~/types"

export type CurrentAccountContext = {
	current_account_id: UUID
	account: GetAccount
}

export const currentAccountContext = createContext<CurrentAccountContext>(undefined)
