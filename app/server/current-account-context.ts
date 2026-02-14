import { createContext } from "react-router";
import type { GetAccount, UUID } from "~/types";

export type CurrentAccountContext = {
	current_account_id: UUID | null;
	account: GetAccount | null;
};

export const currentAccountContext = createContext<CurrentAccountContext>({
	current_account_id: null,
	account: null,
});
