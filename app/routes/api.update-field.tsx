import type { ActionFunction } from "react-router"

import { db } from "~/utils/supabase.server"

interface Payload {
	table: string
	id: string
	field: string
	value: string
}

export const action: ActionFunction = async ({ request }) => {
	try {
		const payload = (await request.json()) as Payload
		const { table, id, field, value } = payload

		if (!table || !id || !field) {
			return { error: "Missing parameters" }
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const updateObj: Record<string, string> = { [field]: value }

		const { error } = await db.from(table).update(updateObj).eq("id", id)

		if (error) {
			return { error: error.message }
		}

		return { success: true }
	} catch (err) {
		return { error: (err as Error).message }
	}
}
