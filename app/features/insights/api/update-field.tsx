import consola from "consola"
import type { ActionFunction } from "react-router"
import { userContext } from "~/server/user-context"

interface Payload {
	table: string
	id: string
	field: string
	value: string
}

export const action: ActionFunction = async ({ context, request }) => {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = ctx.account_id

	try {
		const payload = (await request.json()) as Payload
		const { table, id, field, value } = payload

		if (!table || !id || !field) {
			return Response.json({ error: "Missing parameters" }, { status: 400 })
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const updateObj: Record<string, string> = { [field]: value }

		consola.log("Updating field:", table, id, field, value)
		const { error } = await supabase
			.from(table as const)
			.update(updateObj)
			.eq("id", id)
			.eq("account_id", accountId) // Account scoping for security

		if (error) {
			return Response.json({ error: error.message }, { status: 500 })
		}

		return Response.json({ success: true })
	} catch (err) {
		return Response.json({ error: (err as Error).message }, { status: 500 })
	}
}
