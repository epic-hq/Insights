/**
 * Server-side A2UI event emission
 *
 * Emits UI events to the event store via the ingest_ui_event RPC.
 * Used by agent tools and server actions to record state changes.
 */

import { randomUUID } from "node:crypto";
import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export interface EmitUiEventInput {
	accountId: string;
	threadId: string;
	eventType: string;
	path: string;
	value: Record<string, unknown>;
	actor: "user" | "agent" | "system";
	artifactId?: string | null;
	traceId?: string | null;
}

export interface EmitUiEventResult {
	ok: boolean;
	seq?: number;
	error?: string;
}

/**
 * Emit a single UI event to the event store.
 * Returns the assigned sequence number on success.
 */
export async function emitUiEvent(input: EmitUiEventInput): Promise<EmitUiEventResult> {
	const supabase = createSupabaseAdminClient();

	const { data, error } = await (supabase as any).rpc("ingest_ui_event", {
		p_account_id: input.accountId,
		p_thread_id: input.threadId,
		p_client_event_id: randomUUID(),
		p_event_type: input.eventType,
		p_path: input.path,
		p_value: input.value ?? {},
		p_artifact_id: input.artifactId ?? null,
		p_actor: input.actor,
		p_trace_id: input.traceId ?? null,
	});

	if (error) {
		consola.warn("[a2ui] Failed to emit ui_event", {
			error: error.message,
			eventType: input.eventType,
			threadId: input.threadId,
		});
		return { ok: false, error: error.message };
	}

	const result = data as { seq?: number } | null;
	return { ok: true, seq: result?.seq ?? 0 };
}

/**
 * Persist an A2UI artifact (surface snapshot) to the artifacts table.
 */
export async function persistArtifact(input: {
	threadId: string;
	accountId: string;
	artifactType: string;
	a2uiDoc: Record<string, unknown>;
	dataModel: Record<string, unknown>;
	capabilitiesSnapshot: Record<string, unknown>;
	traceId?: string;
}): Promise<{ ok: boolean; artifactId?: string; error?: string }> {
	const supabase = createSupabaseAdminClient();

	// Compute a simple etag from the doc + data
	const etag = simpleHash(JSON.stringify({ doc: input.a2uiDoc, data: input.dataModel }));

	const { data, error } = await (supabase as any)
		.from("artifacts")
		.insert({
			thread_id: input.threadId,
			account_id: input.accountId,
			artifact_type: input.artifactType,
			version: 1,
			parent_id: null,
			status: "active",
			created_by: "agent",
			trace_id: input.traceId ?? null,
			a2ui_doc: input.a2uiDoc,
			data_model: input.dataModel,
			capabilities_snapshot: input.capabilitiesSnapshot,
			etag,
		})
		.select("id")
		.single();

	if (error) {
		consola.error("[a2ui] Failed to persist artifact", error);
		return { ok: false, error: error.message };
	}

	return { ok: true, artifactId: data?.id };
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return Math.abs(hash).toString(36);
}
