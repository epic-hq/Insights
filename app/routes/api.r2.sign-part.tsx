import type { ActionFunctionArgs } from "react-router"
import { signPart } from "~/utils/r2.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		throw new Response("Method not allowed", { status: 405 })
	}

	const { key, uploadId, partNumber } = (await request.json()) as {
		key?: string
		uploadId?: string
		partNumber?: number | string
	}

	const parsedPart = typeof partNumber === "number" ? partNumber : Number(partNumber)
	if (!key || !uploadId || Number.isNaN(parsedPart) || parsedPart <= 0) {
		return { error: "key, uploadId, and partNumber are required" }
	}

	const { url } = await signPart(key, uploadId, parsedPart)
	return { url }
}
