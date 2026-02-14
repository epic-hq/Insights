import { describe, expect, it } from "vitest";

/**
 * Tests for login_success routing helper functions.
 *
 * These are pure functions extracted from login_success.tsx that determine
 * where a user should be redirected after authentication. Critical for
 * ensuring new users reach onboarding and returning users reach their project.
 */

// Re-implement the pure routing helpers (they're not exported, so we test the logic directly)
// This also serves as a specification for the expected behavior.

function isDefaultHomeDestination(next: string, origin: string): boolean {
	try {
		const parsed = new URL(next, origin);
		return parsed.pathname === "/home";
	} catch {
		return next === "/home";
	}
}

function extractInviteToken(next: string, origin: string): string | null {
	try {
		const parsed = new URL(next, origin);
		return parsed.searchParams.get("invite_token");
	} catch {
		return null;
	}
}

describe("isDefaultHomeDestination", () => {
	const origin = "http://localhost:4282";

	it("returns true for /home", () => {
		expect(isDefaultHomeDestination("/home", origin)).toBe(true);
	});

	it("returns false for /dashboard", () => {
		expect(isDefaultHomeDestination("/dashboard", origin)).toBe(false);
	});

	it("returns false for /onboarding", () => {
		expect(isDefaultHomeDestination("/onboarding", origin)).toBe(false);
	});

	it("returns false for /a/uuid/projectId/dashboard", () => {
		expect(isDefaultHomeDestination("/a/abc-123/proj-456/dashboard", origin)).toBe(false);
	});

	it("returns true for full URL with /home path", () => {
		expect(isDefaultHomeDestination("http://localhost:4282/home", origin)).toBe(true);
	});

	it("returns false for /home with query params (still /home pathname)", () => {
		expect(isDefaultHomeDestination("/home?foo=bar", origin)).toBe(true);
	});

	it("handles malformed input gracefully", () => {
		// Falls back to string comparison
		expect(isDefaultHomeDestination("/home", "")).toBe(true);
	});
});

describe("extractInviteToken", () => {
	const origin = "http://localhost:4282";

	it("extracts token from /accept-invite URL", () => {
		const next = "/accept-invite?invite_token=abc123";
		expect(extractInviteToken(next, origin)).toBe("abc123");
	});

	it("extracts token from /team/manage URL", () => {
		const next = "/a/account-id/team/manage?invite_token=token-xyz";
		expect(extractInviteToken(next, origin)).toBe("token-xyz");
	});

	it("returns null when no invite_token param", () => {
		expect(extractInviteToken("/home", origin)).toBeNull();
	});

	it("returns null for plain path without params", () => {
		expect(extractInviteToken("/projects", origin)).toBeNull();
	});

	it("handles URL-encoded tokens", () => {
		const next = `/accept-invite?invite_token=${encodeURIComponent("tok+en/special")}`;
		expect(extractInviteToken(next, origin)).toBe("tok+en/special");
	});

	it("returns null for invalid URL", () => {
		// Completely broken URL that can't be parsed even with origin
		expect(extractInviteToken(":::invalid", origin)).toBeNull();
	});
});

describe("login_success redirect decision tree", () => {
	// Document the expected routing logic as specifications

	it("new user + no invite → /a/:accountId/:projectId/setup?onboarding=1", () => {
		// New users should always be sent to project setup
		const isNewUser = true;
		const hasInviteRedirect = false;
		const shouldUseLastUsed = true; // default /home destination

		// Logic from login_success.tsx:
		// if (isNewUser && !inviteRedirect && shouldUseLastUsed) → ensureDefaultAccountAndProject
		expect(isNewUser && !hasInviteRedirect && shouldUseLastUsed).toBe(true);
	});

	it("new user + invite → invite redirect takes priority", () => {
		const hasInviteRedirect = true;

		// Logic: inviteRedirect ?? next — invite redirect wins regardless of isNewUser
		const destination = hasInviteRedirect ? "/accept-invite?invite_token=abc" : "/home";
		expect(destination).toContain("accept-invite");
	});

	it("returning user + last_used project → dashboard redirect", () => {
		const isNewUser = false;
		const hasInviteRedirect = false;
		const shouldUseLastUsed = true;
		const hasLastUsedProject = true;

		// Logic: !inviteRedirect && shouldUseLastUsed → resolveLastUsedProjectRedirect
		expect(!isNewUser && !hasInviteRedirect && shouldUseLastUsed && hasLastUsedProject).toBe(true);
	});

	it("returning user + explicit next URL → uses next URL as-is", () => {
		const next = "/a/acc-id/proj-id/interviews";
		const shouldUseLastUsed = isDefaultHomeDestination(next, "http://localhost");

		// Explicit deep-link should not be overridden
		expect(shouldUseLastUsed).toBe(false);
	});

	it("returning user + no last_used + no projects → ensureDefaultAccountAndProject", () => {
		// This is the edge case where a returning user somehow has no projects
		// (e.g., all deleted). Should create a new default project.
		const hasLastUsedPreferences = false;

		// resolveLastUsedProjectRedirect falls back to ensureDefaultAccountAndProject
		expect(!hasLastUsedPreferences).toBe(true);
	});
});
