/**
 * OAuth 2.1 business logic for MCP server authentication.
 *
 * Implements the following OAuth 2.1 / MCP-auth flows:
 *  - Authorization Server Metadata (RFC 8414)
 *  - Protected Resource Metadata
 *  - Dynamic Client Registration (RFC 7591)
 *  - Authorization Code Grant with PKCE (RFC 7636)
 *  - Token refresh with rotation
 *
 * All tokens and codes are generated server-side and only their SHA-256
 * hashes are persisted.  Raw values are returned exactly once.
 *
 * Tables used (defined in supabase/schemas/):
 *  - oauth_clients
 *  - oauth_authorization_codes
 *  - project_api_keys  (extended with refresh_token_hash, oauth_client_id)
 */

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";

import {
  generateRawApiKey,
  hashApiKey,
  keyDisplayPrefix,
} from "./api-keys.server";

/**
 * The oauth tables are not yet in the generated database.types.ts.
 * Use a loosely-typed Supabase client for oauth operations only.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTH_CODE_PREFIX = "upac_";
const REFRESH_TOKEN_PREFIX = "uprt_";
const AUTH_CODE_TTL_MINUTES = 10;
const ACCESS_TOKEN_EXPIRES_IN = 3600; // 1 hour in seconds
const REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 3600; // 30 days in seconds

/** Domains whose redirect URIs we accept during dynamic client registration. */
const TRUSTED_REDIRECT_DOMAINS = [
  "claude.ai",
  "claude.com",
  "chatgpt.com",
  "platform.openai.com",
  "localhost",
];

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface RegisterClientInput {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
}

export interface RegisterClientResponse {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
}

export interface OAuthClient {
  id: string;
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface OAuthError {
  error: string;
  error_description?: string;
}

// ---------------------------------------------------------------------------
// Metadata endpoints
// ---------------------------------------------------------------------------

/**
 * Build the JSON body for `/.well-known/oauth-authorization-server`.
 * See RFC 8414.
 */
export function getOAuthMetadata(issuerUrl: string) {
  return {
    issuer: issuerUrl,
    authorization_endpoint: `${issuerUrl}/oauth/authorize`,
    token_endpoint: `${issuerUrl}/oauth/token`,
    registration_endpoint: `${issuerUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read", "write"],
  };
}

/**
 * Build the JSON body for `/.well-known/oauth-protected-resource`.
 */
export function getProtectedResourceMetadata(
  resourceUrl: string,
  authServerUrl: string,
) {
  return {
    resource: resourceUrl,
    authorization_servers: [authServerUrl],
    scopes_supported: ["read", "write"],
    bearer_methods_supported: ["header"],
  };
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/**
 * Verify an S256 PKCE code challenge.
 *
 * Computes `base64url(sha256(codeVerifier))` and compares to the stored
 * `codeChallenge` value.
 */
export function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string,
): boolean {
  const hash = createHash("sha256").update(codeVerifier).digest();
  const computed = hash.toString("base64url");
  return computed === codeChallenge;
}

// ---------------------------------------------------------------------------
// Dynamic Client Registration (RFC 7591)
// ---------------------------------------------------------------------------

/**
 * Register a new OAuth client.
 *
 * Validates that every `redirect_uri` belongs to a trusted domain, generates
 * a unique `client_id`, and persists the client record.
 */
export async function registerClient(
  supabase: AnySupabaseClient,
  input: RegisterClientInput,
): Promise<RegisterClientResponse> {
  // Validate redirect URIs
  if (!input.redirect_uris || input.redirect_uris.length === 0) {
    throw new Error(
      "redirect_uris is required and must contain at least one URI",
    );
  }

  for (const uri of input.redirect_uris) {
    if (!isRedirectUriTrusted(uri)) {
      throw new Error(
        `Untrusted redirect_uri domain: ${uri}. ` +
          `Allowed domains: ${TRUSTED_REDIRECT_DOMAINS.join(", ")}`,
      );
    }
  }

  const clientId = `oauc_${randomBytes(16).toString("hex")}`;
  const grantTypes = input.grant_types ?? ["authorization_code"];
  const responseTypes = input.response_types ?? ["code"];
  const authMethod = input.token_endpoint_auth_method ?? "none";
  const clientName = input.client_name ?? null;

  const { data, error } = await supabase
    .from("oauth_clients")
    .insert({
      client_id: clientId,
      client_name: clientName,
      redirect_uris: input.redirect_uris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: authMethod,
    })
    .select()
    .single();

  if (error || !data) {
    consola.error("[oauth] Failed to register client", error);
    throw new Error(
      `Failed to register client: ${error?.message ?? "unknown"}`,
    );
  }

  return {
    client_id: clientId,
    client_name: clientName,
    redirect_uris: input.redirect_uris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: authMethod,
  };
}

// ---------------------------------------------------------------------------
// Client validation
// ---------------------------------------------------------------------------

/** Look up an OAuth client by its public `client_id`. Returns `null` if not found. */
export async function validateClient(
  supabase: AnySupabaseClient,
  clientId: string,
): Promise<OAuthClient | null> {
  const { data, error } = await supabase
    .from("oauth_clients")
    .select(
      "id, client_id, client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method, created_at",
    )
    .eq("client_id", clientId)
    .single();

  if (error || !data) {
    consola.warn("[oauth] Client lookup failed", {
      clientId,
      error: error?.message,
    });
    return null;
  }

  return data as OAuthClient;
}

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

/**
 * Create and persist an authorization code for the PKCE flow.
 *
 * The code is hashed before storage; only the raw code is returned (show-once).
 */
export async function createAuthorizationCode(
  supabase: AnySupabaseClient,
  params: {
    clientId: string;
    userId: string;
    accountId: string;
    projectId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scopes?: string[];
  },
): Promise<string> {
  const code = `${AUTH_CODE_PREFIX}${randomBytes(32).toString("hex")}`;
  const codeHash = hashApiKey(code);

  const expiresAt = new Date(
    Date.now() + AUTH_CODE_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.from("oauth_authorization_codes").insert({
    code_hash: codeHash,
    client_id: params.clientId,
    user_id: params.userId,
    account_id: params.accountId,
    project_id: params.projectId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    scopes: params.scopes ?? ["read"],
    expires_at: expiresAt,
  });

  if (error) {
    consola.error("[oauth] Failed to create authorization code", error);
    throw new Error(`Failed to create authorization code: ${error.message}`);
  }

  return code;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchange an authorization code for an access token and refresh token.
 *
 * Validates the code, performs PKCE verification, marks the code as used,
 * then issues a new token pair.
 */
export async function exchangeCodeForTokens(
  supabase: AnySupabaseClient,
  params: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
  },
): Promise<TokenResponse> {
  const codeHash = hashApiKey(params.code);

  // Look up the unused authorization code
  const { data: codeRecord, error: lookupError } = await supabase
    .from("oauth_authorization_codes")
    .select("*")
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .single();

  if (lookupError || !codeRecord) {
    consola.warn("[oauth] Authorization code lookup failed", {
      error: lookupError?.message,
    });
    throw new Error("Invalid or already-used authorization code");
  }

  // Validate expiration
  if (new Date(codeRecord.expires_at) < new Date()) {
    consola.warn("[oauth] Authorization code expired", {
      codeId: codeRecord.id,
    });
    throw new Error("Authorization code has expired");
  }

  // Validate client_id
  if (codeRecord.client_id !== params.clientId) {
    consola.warn("[oauth] Client ID mismatch on code exchange");
    throw new Error("client_id does not match the authorization code");
  }

  // Validate redirect_uri
  if (codeRecord.redirect_uri !== params.redirectUri) {
    consola.warn("[oauth] Redirect URI mismatch on code exchange");
    throw new Error("redirect_uri does not match the authorization code");
  }

  // PKCE verification
  if (!verifyPkceChallenge(params.codeVerifier, codeRecord.code_challenge)) {
    consola.warn("[oauth] PKCE verification failed");
    throw new Error("PKCE code_verifier does not match code_challenge");
  }

  // Mark code as used
  const { error: markError } = await supabase
    .from("oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", codeRecord.id);

  if (markError) {
    consola.error(
      "[oauth] Failed to mark authorization code as used",
      markError,
    );
    throw new Error("Failed to consume authorization code");
  }

  // Issue tokens
  const scopes = (codeRecord.scopes as string[]) ?? ["read"];
  return issueTokenPair(supabase, {
    accountId: codeRecord.account_id,
    projectId: codeRecord.project_id,
    userId: codeRecord.user_id,
    clientId: params.clientId,
    scopes,
  });
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

/**
 * Refresh an access token by presenting a valid refresh token.
 *
 * Rotates both the access and refresh tokens: the old key is revoked and
 * a new pair is issued.
 */
export async function refreshAccessToken(
  supabase: AnySupabaseClient,
  params: {
    refreshToken: string;
    clientId: string;
  },
): Promise<TokenResponse> {
  const refreshHash = hashApiKey(params.refreshToken);

  // Look up existing key by refresh_token_hash
  const { data: existingKey, error: lookupError } = await supabase
    .from("project_api_keys")
    .select("*")
    .eq("refresh_token_hash", refreshHash)
    .is("revoked_at", null)
    .single();

  if (lookupError || !existingKey) {
    consola.warn("[oauth] Refresh token lookup failed", {
      error: lookupError?.message,
    });
    throw new Error("Invalid or revoked refresh token");
  }

  // Note: we do NOT check expires_at here. The access token's expires_at
  // is a short-lived TTL (1 hour) that controls when the client must refresh.
  // The refresh token itself remains valid as long as the row isn't revoked.
  // Revocation (via project settings or token rotation) is the expiry mechanism.

  // Validate client_id
  if (existingKey.oauth_client_id !== params.clientId) {
    consola.warn("[oauth] Client ID mismatch on token refresh");
    throw new Error("client_id does not match the token");
  }

  // Revoke old key
  const { error: revokeError } = await supabase
    .from("project_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", existingKey.id);

  if (revokeError) {
    consola.error(
      "[oauth] Failed to revoke old key during refresh",
      revokeError,
    );
    throw new Error("Failed to rotate tokens");
  }

  // Issue new token pair
  const scopes = (existingKey.scopes as string[]) ?? ["read"];
  return issueTokenPair(supabase, {
    accountId: existingKey.account_id,
    projectId: existingKey.project_id,
    userId: existingKey.created_by,
    clientId: params.clientId,
    scopes,
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Issue a new access-token + refresh-token pair and persist in `project_api_keys`.
 *
 * This is the shared implementation used by both `exchangeCodeForTokens` and
 * `refreshAccessToken`.
 */
async function issueTokenPair(
  supabase: AnySupabaseClient,
  params: {
    accountId: string;
    projectId: string;
    userId: string;
    clientId: string;
    scopes: string[];
  },
): Promise<TokenResponse> {
  const rawAccessToken = generateRawApiKey();
  const accessTokenHash = hashApiKey(rawAccessToken);
  const accessTokenPrefix = keyDisplayPrefix(rawAccessToken);

  const rawRefreshToken = `${REFRESH_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  const refreshTokenHash = hashApiKey(rawRefreshToken);

  const expiresAt = new Date(
    Date.now() + ACCESS_TOKEN_EXPIRES_IN * 1000,
  ).toISOString();

  const { error } = await supabase.from("project_api_keys").insert({
    account_id: params.accountId,
    project_id: params.projectId,
    name: `OAuth token (${params.clientId})`,
    key_prefix: accessTokenPrefix,
    key_hash: accessTokenHash,
    scopes: params.scopes,
    created_by: params.userId,
    expires_at: expiresAt,
    refresh_token_hash: refreshTokenHash,
    oauth_client_id: params.clientId,
  });

  if (error) {
    consola.error("[oauth] Failed to create token pair", error);
    throw new Error(`Failed to issue tokens: ${error.message}`);
  }

  return {
    access_token: rawAccessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_EXPIRES_IN,
    refresh_token: rawRefreshToken,
    scope: params.scopes.join(" "),
  };
}

/**
 * Check whether a redirect URI's hostname belongs to a trusted domain.
 *
 * Accepts exact matches and subdomains (e.g. `foo.claude.ai` is trusted).
 * `localhost` is matched by hostname only (any port allowed).
 */
function isRedirectUriTrusted(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    const hostname = parsed.hostname;

    return TRUSTED_REDIRECT_DOMAINS.some((domain) => {
      if (domain === "localhost") {
        return hostname === "localhost" || hostname === "127.0.0.1";
      }
      return hostname === domain || hostname.endsWith(`.${domain}`);
    });
  } catch {
    return false;
  }
}
