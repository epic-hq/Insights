import type { CompletedPart } from "@aws-sdk/client-s3"
import type { ActionFunctionArgs } from "react-router"
import { completeMultipart } from "~/utils/r2.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		throw new Response("Method not allowed", { status: 405 })
	}

	const { key, uploadId, parts } = (await request.json()) as {
		key?: string
		uploadId?: string
		parts?: Array<{
			ETag?: string
			PartNumber?: number | string
		}>
	}

	if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
		return { error: "key, uploadId, and parts are required" }
	}

	const normalizedParts: CompletedPart[] = parts
		.map((part) => ({
			ETag: part.ETag,
			PartNumber: typeof part.PartNumber === "number" ? part.PartNumber : Number(part.PartNumber),
		}))
		.filter(
			(part): part is CompletedPart =>
				Boolean(part.ETag) && Number.isInteger(part.PartNumber) && (part.PartNumber ?? 0) > 0
		)

	if (normalizedParts.length === 0) {
		return { error: "parts must include ETag and PartNumber" }
	}

	await completeMultipart(key, uploadId, normalizedParts)
	return { key }
}
