import { randomUUID } from "node:crypto"
import { formatISO } from "date-fns"
import type { ActionFunctionArgs } from "react-router"
import { initMultipart } from "~/utils/r2.server"

function sanitizeFilename(filename: string) {
	return filename.replace(/[^\w.-]+/gu, "_")
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		throw new Response("Method not allowed", { status: 405 })
	}

	const { filename, contentType } = (await request.json()) as {
		filename?: string
		contentType?: string
	}

	if (!filename) {
		return { error: "filename is required" }
	}

	const datePrefix = formatISO(new Date(), { representation: "date" })
	const key = `originals/${datePrefix}/${randomUUID()}_${sanitizeFilename(filename)}`
	const { uploadId } = await initMultipart(key, contentType)
	return { key, uploadId }
}
