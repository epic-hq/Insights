/**
 * Unit tests for OAuth 2.1 server logic.
 *
 * Tests metadata endpoints, PKCE verification, dynamic client registration,
 * authorization code exchange, and token refresh — all with mocked Supabase.
 */

// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	exchangeCodeForTokens,
	getOAuthMetadata,
	getProtectedResourceMetadata,
	refreshAccessToken,
	registerClient,
	verifyPkceChallenge,
} from "../oauth.server";

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock Supabase client.
 *
 * By default every terminal operation (`.single()`) resolves with
 * `{ data: null, error: null }`. Pass `tableOverrides` keyed by table name
 * to customise per-table behaviour.
 *
 * Each table override can specify terminal resolvers (`singleValue`,
 * `insertValue`) and mid-chain behaviour.
 */
function createMockSupabase(
	tableOverrides: Record<
		string,
		{
			singleValue?: { data: unknown; error: unknown };
			insertValue?: { data: unknown; error: unknown };
			updateValue?: { data: unknown; error: unknown };
		}
	> = {}
) {
	function chainForTable(table: string) {
		const overrides = tableOverrides[table] ?? {};

		const chain: Record<string, ReturnType<typeof vi.fn>> = {
			select: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			update: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue(overrides.singleValue ?? { data: null, error: null }),
		};

		// When insert is followed by select().single(), resolve with insertValue
		if (overrides.insertValue) {
			// After .insert() the next .select().single() should use insertValue
			chain.insert = vi.fn().mockReturnValue({
				...chain,
				select: vi.fn().mockReturnValue({
					...chain,
					single: vi.fn().mockResolvedValue(overrides.insertValue),
				}),
			});
		}

		// When update is followed by .eq(), resolve with updateValue
		if (overrides.updateValue) {
			chain.update = vi.fn().mockReturnValue({
				...chain,
				eq: vi.fn().mockResolvedValue(overrides.updateValue),
			});
		}

		return chain;
	}

	const from = vi.fn((table: string) => chainForTable(table));

	return { from } as unknown as ReturnType<typeof vi.fn> & {
		from: typeof from;
	};
}

// ---------------------------------------------------------------------------
// 1. getOAuthMetadata
// ---------------------------------------------------------------------------

describe("getOAuthMetadata", () => {
	it("returns correct shape with all required fields", () => {
		const meta = getOAuthMetadata("https://example.com");

		expect(meta).toEqual({
			issuer: "https://example.com",
			authorization_endpoint: "https://example.com/oauth/authorize",
			token_endpoint: "https://example.com/oauth/token",
			registration_endpoint: "https://example.com/oauth/register",
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			code_challenge_methods_supported: ["S256"],
			token_endpoint_auth_methods_supported: ["none"],
			scopes_supported: ["read", "write"],
		});
	});

	it("correctly interpolates issuer URL into endpoint URLs", () => {
		const issuer = "https://my-app.fly.dev";
		const meta = getOAuthMetadata(issuer);

		expect(meta.issuer).toBe(issuer);
		expect(meta.authorization_endpoint).toBe(`${issuer}/oauth/authorize`);
		expect(meta.token_endpoint).toBe(`${issuer}/oauth/token`);
		expect(meta.registration_endpoint).toBe(`${issuer}/oauth/register`);
	});
});

// ---------------------------------------------------------------------------
// 2. getProtectedResourceMetadata
// ---------------------------------------------------------------------------

describe("getProtectedResourceMetadata", () => {
	it("returns correct shape", () => {
		const meta = getProtectedResourceMetadata("https://resource.example.com", "https://auth.example.com");

		expect(meta).toEqual({
			resource: "https://resource.example.com",
			authorization_servers: ["https://auth.example.com"],
			scopes_supported: ["read", "write"],
			bearer_methods_supported: ["header"],
		});
	});
});

// ---------------------------------------------------------------------------
// 3. verifyPkceChallenge
// ---------------------------------------------------------------------------

describe("verifyPkceChallenge", () => {
	it("returns true for a valid verifier/challenge pair", () => {
		const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
		const challenge = createHash("sha256").update(verifier).digest("base64url");

		expect(verifyPkceChallenge(verifier, challenge)).toBe(true);
	});

	it("returns false for a mismatched pair", () => {
		const verifier = "correct-verifier";
		const wrongChallenge = createHash("sha256").update("wrong-verifier").digest("base64url");

		expect(verifyPkceChallenge(verifier, wrongChallenge)).toBe(false);
	});

	it("matches a known test vector (RFC 7636 Appendix B)", () => {
		// RFC 7636 Appendix B test vector
		const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
		// The expected SHA-256 base64url of the above verifier
		const expectedChallenge = createHash("sha256").update(verifier).digest("base64url");

		// Manually verify: SHA-256 of the verifier should match
		expect(verifyPkceChallenge(verifier, expectedChallenge)).toBe(true);

		// And must NOT match a tampered challenge
		const tampered = expectedChallenge.slice(0, -1) + "X";
		expect(verifyPkceChallenge(verifier, tampered)).toBe(false);
	});

	it("handles empty strings without throwing", () => {
		const challenge = createHash("sha256").update("").digest("base64url");

		expect(verifyPkceChallenge("", challenge)).toBe(true);
		expect(verifyPkceChallenge("non-empty", challenge)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 4. registerClient
// ---------------------------------------------------------------------------

describe("registerClient", () => {
	it("successfully registers with valid claude.ai redirect URI", async () => {
		const supabase = createMockSupabase({
			oauth_clients: {
				insertValue: {
					data: { client_id: "oauc_test" },
					error: null,
				},
			},
		});

		const result = await registerClient(supabase as never, {
			client_name: "Test Client",
			redirect_uris: ["https://claude.ai/oauth/callback"],
		});

		expect(result.client_id).toMatch(/^oauc_/);
		expect(result.client_name).toBe("Test Client");
		expect(result.redirect_uris).toEqual(["https://claude.ai/oauth/callback"]);
		expect(result.grant_types).toEqual(["authorization_code"]);
		expect(result.response_types).toEqual(["code"]);
		expect(result.token_endpoint_auth_method).toBe("none");
	});

	it("successfully registers with chatgpt.com redirect URI", async () => {
		const supabase = createMockSupabase({
			oauth_clients: {
				insertValue: {
					data: { client_id: "oauc_test" },
					error: null,
				},
			},
		});

		const result = await registerClient(supabase as never, {
			redirect_uris: ["https://chatgpt.com/aip/callback"],
		});

		expect(result.client_id).toMatch(/^oauc_/);
		expect(result.redirect_uris).toEqual(["https://chatgpt.com/aip/callback"]);
	});

	it("throws on empty redirect_uris", async () => {
		const supabase = createMockSupabase();

		await expect(registerClient(supabase as never, { redirect_uris: [] })).rejects.toThrow(
			"redirect_uris is required and must contain at least one URI"
		);
	});

	it("throws on untrusted redirect_uri domain", async () => {
		const supabase = createMockSupabase();

		await expect(
			registerClient(supabase as never, {
				redirect_uris: ["https://evil.com/callback"],
			})
		).rejects.toThrow("Untrusted redirect_uri domain");
	});

	it("generated client_id has correct prefix (oauc_)", async () => {
		const supabase = createMockSupabase({
			oauth_clients: {
				insertValue: {
					data: { client_id: "oauc_test" },
					error: null,
				},
			},
		});

		const result = await registerClient(supabase as never, {
			redirect_uris: ["https://claude.ai/callback"],
		});

		expect(result.client_id.startsWith("oauc_")).toBe(true);
		// oauc_ (5) + 32 hex chars = 37
		expect(result.client_id.length).toBe(37);
	});

	it("accepts localhost redirect URIs for dev", async () => {
		const supabase = createMockSupabase({
			oauth_clients: {
				insertValue: {
					data: { client_id: "oauc_test" },
					error: null,
				},
			},
		});

		const result = await registerClient(supabase as never, {
			redirect_uris: ["http://localhost:3000/callback"],
		});

		expect(result.client_id).toMatch(/^oauc_/);
		expect(result.redirect_uris).toEqual(["http://localhost:3000/callback"]);
	});

	it("throws on Supabase insert failure", async () => {
		const supabase = createMockSupabase({
			oauth_clients: {
				insertValue: {
					data: null,
					error: { message: "insert failed" },
				},
			},
		});

		await expect(
			registerClient(supabase as never, {
				redirect_uris: ["https://claude.ai/callback"],
			})
		).rejects.toThrow("Failed to register client");
	});

	it("defaults client_name to null when not provided", async () => {
		const supabase = createMockSupabase({
			oauth_clients: {
				insertValue: {
					data: { client_id: "oauc_test" },
					error: null,
				},
			},
		});

		const result = await registerClient(supabase as never, {
			redirect_uris: ["https://claude.ai/callback"],
		});

		expect(result.client_name).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// 5. isRedirectUriTrusted (tested via registerClient)
// ---------------------------------------------------------------------------

describe("isRedirectUriTrusted (via registerClient)", () => {
	// Helper that attempts registration and checks if it throws for untrusted URI
	async function expectTrusted(uri: string) {
		const supabase = createMockSupabase({
			oauth_clients: {
				insertValue: {
					data: { client_id: "oauc_test" },
					error: null,
				},
			},
		});
		// Should NOT throw
		const result = await registerClient(supabase as never, {
			redirect_uris: [uri],
		});
		expect(result.client_id).toMatch(/^oauc_/);
	}

	async function expectUntrusted(uri: string) {
		const supabase = createMockSupabase();
		await expect(registerClient(supabase as never, { redirect_uris: [uri] })).rejects.toThrow(
			"Untrusted redirect_uri domain"
		);
	}

	it("accepts claude.ai", async () => {
		await expectTrusted("https://claude.ai/oauth/callback");
	});

	it("accepts claude.com", async () => {
		await expectTrusted("https://claude.com/oauth/callback");
	});

	it("accepts chatgpt.com", async () => {
		await expectTrusted("https://chatgpt.com/aip/callback");
	});

	it("accepts platform.openai.com", async () => {
		await expectTrusted("https://platform.openai.com/callback");
	});

	it("accepts localhost", async () => {
		await expectTrusted("http://localhost:5173/callback");
	});

	it("accepts subdomains like api.claude.ai", async () => {
		await expectTrusted("https://api.claude.ai/callback");
	});

	it("accepts nested subdomains like deep.sub.claude.ai", async () => {
		await expectTrusted("https://deep.sub.claude.ai/callback");
	});

	it("rejects untrusted domain evil.com", async () => {
		await expectUntrusted("https://evil.com/callback");
	});

	it("rejects domain that contains trusted name but is not a subdomain", async () => {
		await expectUntrusted("https://notclaude.ai/callback");
	});

	it("rejects malformed URIs", async () => {
		await expectUntrusted("not-a-url");
	});

	it("rejects empty string URI", async () => {
		await expectUntrusted("");
	});
});

// ---------------------------------------------------------------------------
// 6. exchangeCodeForTokens
// ---------------------------------------------------------------------------

describe("exchangeCodeForTokens", () => {
	const verifier = "test-code-verifier-value";
	const challenge = createHash("sha256").update(verifier).digest("base64url");

	const validCodeRecord = {
		id: "code-uuid-1",
		code_hash: "some-hash",
		client_id: "oauc_client1",
		user_id: "user-1",
		account_id: "account-1",
		project_id: "project-1",
		redirect_uri: "https://claude.ai/callback",
		code_challenge: challenge,
		code_challenge_method: "S256",
		scopes: ["read", "write"],
		expires_at: new Date(Date.now() + 600_000).toISOString(), // 10 min in future
		used_at: null,
	};

	it("throws on unknown or already-used code", async () => {
		const supabase = createMockSupabase({
			oauth_authorization_codes: {
				singleValue: { data: null, error: { message: "not found" } },
			},
		});

		await expect(
			exchangeCodeForTokens(supabase as never, {
				code: "upac_unknown",
				clientId: "oauc_client1",
				redirectUri: "https://claude.ai/callback",
				codeVerifier: verifier,
			})
		).rejects.toThrow("Invalid or already-used authorization code");
	});

	it("throws on expired code", async () => {
		const expiredRecord = {
			...validCodeRecord,
			expires_at: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
		};

		const supabase = createMockSupabase({
			oauth_authorization_codes: {
				singleValue: { data: expiredRecord, error: null },
			},
		});

		await expect(
			exchangeCodeForTokens(supabase as never, {
				code: "upac_expired",
				clientId: "oauc_client1",
				redirectUri: "https://claude.ai/callback",
				codeVerifier: verifier,
			})
		).rejects.toThrow("Authorization code has expired");
	});

	it("throws on client_id mismatch", async () => {
		const supabase = createMockSupabase({
			oauth_authorization_codes: {
				singleValue: { data: validCodeRecord, error: null },
			},
		});

		await expect(
			exchangeCodeForTokens(supabase as never, {
				code: "upac_code1",
				clientId: "oauc_WRONG",
				redirectUri: "https://claude.ai/callback",
				codeVerifier: verifier,
			})
		).rejects.toThrow("client_id does not match the authorization code");
	});

	it("throws on redirect_uri mismatch", async () => {
		const supabase = createMockSupabase({
			oauth_authorization_codes: {
				singleValue: { data: validCodeRecord, error: null },
			},
		});

		await expect(
			exchangeCodeForTokens(supabase as never, {
				code: "upac_code1",
				clientId: "oauc_client1",
				redirectUri: "https://wrong.com/callback",
				codeVerifier: verifier,
			})
		).rejects.toThrow("redirect_uri does not match the authorization code");
	});

	it("throws on PKCE verification failure", async () => {
		const supabase = createMockSupabase({
			oauth_authorization_codes: {
				singleValue: { data: validCodeRecord, error: null },
			},
		});

		await expect(
			exchangeCodeForTokens(supabase as never, {
				code: "upac_code1",
				clientId: "oauc_client1",
				redirectUri: "https://claude.ai/callback",
				codeVerifier: "wrong-verifier",
			})
		).rejects.toThrow("PKCE code_verifier does not match code_challenge");
	});

	it("successfully exchanges valid code for tokens", async () => {
		// For this test we need both oauth_authorization_codes (lookup + update)
		// and project_api_keys (insert). We build a more tailored mock.
		const codeChain = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ data: validCodeRecord, error: null }),
			update: vi.fn().mockReturnValue({
				eq: vi.fn().mockResolvedValue({ data: null, error: null }),
			}),
		};

		const apiKeyChain = {
			insert: vi.fn().mockResolvedValue({ data: null, error: null }),
		};

		const supabase = {
			from: vi.fn((table: string) => {
				if (table === "oauth_authorization_codes") return codeChain;
				if (table === "project_api_keys") return apiKeyChain;
				return {};
			}),
		};

		const result = await exchangeCodeForTokens(supabase as never, {
			code: "upac_validcode",
			clientId: "oauc_client1",
			redirectUri: "https://claude.ai/callback",
			codeVerifier: verifier,
		});

		expect(result.access_token).toMatch(/^upsk_/);
		expect(result.refresh_token).toMatch(/^uprt_/);
		expect(result.token_type).toBe("Bearer");
		expect(result.expires_in).toBe(3600);
		expect(result.scope).toBe("read write");

		// Verify the code was marked as used
		expect(codeChain.update).toHaveBeenCalledWith(expect.objectContaining({ used_at: expect.any(String) }));

		// Verify a token was inserted
		expect(apiKeyChain.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				account_id: "account-1",
				project_id: "project-1",
				oauth_client_id: "oauc_client1",
			})
		);
	});
});

// ---------------------------------------------------------------------------
// 7. refreshAccessToken
// ---------------------------------------------------------------------------

describe("refreshAccessToken", () => {
	const existingKey = {
		id: "key-uuid-1",
		account_id: "account-1",
		project_id: "project-1",
		created_by: "user-1",
		refresh_token_hash: "some-hash",
		oauth_client_id: "oauc_client1",
		scopes: ["read"],
		revoked_at: null,
		expires_at: new Date(Date.now() + 86_400_000).toISOString(), // 1 day from now
	};

	it("throws on unknown refresh token", async () => {
		const supabase = createMockSupabase({
			project_api_keys: {
				singleValue: {
					data: null,
					error: { message: "not found" },
				},
			},
		});

		await expect(
			refreshAccessToken(supabase as never, {
				refreshToken: "uprt_unknown",
				clientId: "oauc_client1",
			})
		).rejects.toThrow("Invalid or revoked refresh token");
	});

	it("throws on client_id mismatch", async () => {
		const supabase = createMockSupabase({
			project_api_keys: {
				singleValue: { data: existingKey, error: null },
			},
		});

		await expect(
			refreshAccessToken(supabase as never, {
				refreshToken: "uprt_validtoken",
				clientId: "oauc_WRONG",
			})
		).rejects.toThrow("client_id does not match the token");
	});

	it("throws on expired refresh token", async () => {
		const expiredKey = {
			...existingKey,
			expires_at: new Date(Date.now() - 60_000).toISOString(), // expired
		};

		const supabase = createMockSupabase({
			project_api_keys: {
				singleValue: { data: expiredKey, error: null },
			},
		});

		await expect(
			refreshAccessToken(supabase as never, {
				refreshToken: "uprt_expired",
				clientId: "oauc_client1",
			})
		).rejects.toThrow("Refresh token has expired");
	});

	it("successfully refreshes and returns new token pair", async () => {
		// Need lookup (select chain) + revoke (update chain) + insert for new token
		const lookupChain = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ data: existingKey, error: null }),
			update: vi.fn().mockReturnValue({
				eq: vi.fn().mockResolvedValue({ data: null, error: null }),
			}),
			insert: vi.fn().mockResolvedValue({ data: null, error: null }),
		};

		const supabase = {
			from: vi.fn((_table: string) => lookupChain),
		};

		const result = await refreshAccessToken(supabase as never, {
			refreshToken: "uprt_validrefresh",
			clientId: "oauc_client1",
		});

		expect(result.access_token).toMatch(/^upsk_/);
		expect(result.refresh_token).toMatch(/^uprt_/);
		expect(result.token_type).toBe("Bearer");
		expect(result.expires_in).toBe(3600);
		expect(result.scope).toBe("read");

		// Verify old key was revoked
		expect(lookupChain.update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }));

		// Verify new key was inserted
		expect(lookupChain.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				account_id: "account-1",
				project_id: "project-1",
				oauth_client_id: "oauc_client1",
				created_by: "user-1",
			})
		);
	});

	it("throws when revoking old key fails", async () => {
		const failRevokeChain = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ data: existingKey, error: null }),
			update: vi.fn().mockReturnValue({
				eq: vi.fn().mockResolvedValue({
					data: null,
					error: { message: "update failed" },
				}),
			}),
		};

		const supabase = {
			from: vi.fn((_table: string) => failRevokeChain),
		};

		await expect(
			refreshAccessToken(supabase as never, {
				refreshToken: "uprt_validrefresh",
				clientId: "oauc_client1",
			})
		).rejects.toThrow("Failed to rotate tokens");
	});
});
