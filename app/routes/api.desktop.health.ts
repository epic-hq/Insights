import type { LoaderFunctionArgs } from "react-router";

/**
 * GET /api/desktop/health
 * Simple health check endpoint for desktop app connectivity verification.
 */
export async function loader(_args: LoaderFunctionArgs) {
	return Response.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		version: "1.0.0",
	});
}
