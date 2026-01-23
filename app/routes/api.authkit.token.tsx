/**
 * AuthKit Token Generation Endpoint
 *
 * POST /api/authkit/token
 * Generates a Pica AuthKit token for the specified user.
 *
 * The user ID is passed via x-user-id header from the frontend.
 * This is called by Pica's useAuthKit hook.
 */

import { AuthKitToken } from "@picahq/authkit-token"
import consola from "consola"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"

const PICA_SECRET_KEY = process.env.PICA_SECRET_KEY || process.env.PICA_API_KEY

// CORS headers - Pica's AuthKit may call from their domain
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, x-user-id, x-account-id",
}

function jsonWithCors(data: unknown, init?: ResponseInit) {
	return Response.json(data, {
		...init,
		headers: {
			...corsHeaders,
			...init?.headers,
		},
	})
}

async function generateToken(userId: string) {
	if (!PICA_SECRET_KEY) {
		consola.error("[authkit] PICA_SECRET_KEY not configured")
		return jsonWithCors({ error: "AuthKit not configured" }, { status: 503 })
	}

	try {
		const authKitToken = new AuthKitToken(PICA_SECRET_KEY)
		const token = await authKitToken.create({
			identity: userId,
			identityType: "user",
		})

		consola.info("[authkit] Token generated for user", { userId })
		return jsonWithCors(token)
	} catch (error) {
		consola.error("[authkit] Failed to generate token:", error)
		return jsonWithCors({ error: "Failed to generate token" }, { status: 500 })
	}
}

// Handle POST requests
export async function action({ request }: ActionFunctionArgs) {
	// Handle CORS preflight
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders })
	}

	// Get user ID from header (as per Pica docs)
	const userId = request.headers.get("x-user-id")

	if (!userId) {
		consola.warn("[authkit] Missing x-user-id header")
		return jsonWithCors({ error: "User ID required" }, { status: 400 })
	}

	return generateToken(userId)
}

// Handle GET requests (some AuthKit versions use GET)
export async function loader({ request }: LoaderFunctionArgs) {
	// Handle CORS preflight
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders })
	}

	// Get user ID from header
	const userId = request.headers.get("x-user-id")

	if (!userId) {
		consola.warn("[authkit] Missing x-user-id header")
		return jsonWithCors({ error: "User ID required" }, { status: 400 })
	}

	return generateToken(userId)
}
