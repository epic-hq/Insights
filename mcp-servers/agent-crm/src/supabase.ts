/**
 * Supabase client for the AgentCRM MCP server.
 * Reads connection details from environment variables.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export interface AgentCrmConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  defaultAccountId?: string;
  defaultProjectId?: string;
}

export function getConfig(): AgentCrmConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return {
    supabaseUrl,
    supabaseServiceKey,
    defaultAccountId: process.env.AGENTCRM_ACCOUNT_ID,
    defaultProjectId: process.env.AGENTCRM_PROJECT_ID,
  };
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    const config = getConfig();
    client = createClient(config.supabaseUrl, config.supabaseServiceKey);
  }
  return client;
}

/** Resolve account/project IDs from args or env defaults */
export function resolveContext(args: Record<string, unknown>): {
  accountId: string;
  projectId: string;
} {
  const config = getConfig();
  const accountId =
    (args.account_id as string) || config.defaultAccountId;
  const projectId =
    (args.project_id as string) || config.defaultProjectId;

  if (!accountId) {
    throw new Error(
      "account_id is required. Provide it as a tool argument or set AGENTCRM_ACCOUNT_ID env var."
    );
  }
  if (!projectId) {
    throw new Error(
      "project_id is required. Provide it as a tool argument or set AGENTCRM_PROJECT_ID env var."
    );
  }

  return { accountId, projectId };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(value: string, fieldName: string): string {
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid UUID for ${fieldName}: "${value}"`);
  }
  return value;
}
