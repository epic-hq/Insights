/**
 * API route for managing project API keys (create, list, revoke).
 * Mounted at: /a/:accountId/:projectId/api/api-keys
 *
 * Actions (POST):
 *   intent=create  — Generate a new API key (returns raw key once)
 *   intent=revoke  — Soft-revoke an existing key by ID
 *
 * Loader (GET):
 *   Returns list of active (non-revoked) keys for the project.
 */

import consola from "consola";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { z } from "zod";
import { createApiKey, listApiKeys, revokeApiKey } from "~/lib/api-keys.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateSchema = z.object({
	intent: z.literal("create"),
	name: z.string().min(1, "Name is required").max(100),
	scopes: z.string().optional(),
});

const RevokeSchema = z.object({
	intent: z.literal("revoke"),
	keyId: z.string().uuid("Invalid key ID"),
});

// ---------------------------------------------------------------------------
// Loader — list keys
// ---------------------------------------------------------------------------

export async function loader({ params }: LoaderFunctionArgs) {
	const { projectId } = params;
	if (!projectId) {
		return Response.json({ error: "Missing projectId" }, { status: 400 });
	}

	const supabase = createSupabaseAdminClient();
	const keys = await listApiKeys(supabase, projectId);

	return { keys };
}

// ---------------------------------------------------------------------------
// Action — create / revoke
// ---------------------------------------------------------------------------

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const { accountId, projectId } = params;
	if (!accountId || !projectId) {
		return Response.json({ error: "Missing params" }, { status: 400 });
	}

	const body = await request.json();
	const intent = body.intent;

	const supabase = createSupabaseAdminClient();

	// --- CREATE ---
	if (intent === "create") {
		const parsed = CreateSchema.safeParse(body);

		if (!parsed.success) {
			consola.error("[api-keys] create validation failed:", parsed.error.issues);
			return Response.json(
				{
					ok: false,
					error: parsed.error.issues[0]?.message ?? "Validation failed",
				},
				{ status: 400 }
			);
		}

		const scopes = parsed.data.scopes ? parsed.data.scopes.split(",").map((s) => s.trim()) : ["read"];

		const { rawKey, record } = await createApiKey(supabase, {
			accountId,
			projectId,
			name: parsed.data.name,
			scopes,
		});

		return Response.json({ ok: true, rawKey, record });
	}

	// --- REVOKE ---
	if (intent === "revoke") {
		const parsed = RevokeSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json(
				{
					ok: false,
					error: parsed.error.issues[0]?.message ?? "Validation failed",
				},
				{ status: 400 }
			);
		}

		await revokeApiKey(supabase, parsed.data.keyId, projectId);
		return Response.json({ ok: true });
	}

	return Response.json({ error: "Unknown intent" }, { status: 400 });
}
