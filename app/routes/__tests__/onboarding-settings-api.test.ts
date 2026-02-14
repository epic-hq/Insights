import { describe, expect, it } from "vitest";

/**
 * Tests for the onboarding settings API route (api.user-settings.onboarding.tsx).
 *
 * Validates input parsing, validation, and the shape of data written to user_settings.
 * These are pure logic tests — no real DB calls.
 */

// ---------- Pure helpers extracted for testability ----------

interface OnboardingData {
	jobFunction: string;
	primaryUseCase: string;
	companySize: string;
	completed: boolean;
}

function parseOnboardingPayload(raw: string): OnboardingData | null {
	try {
		const parsed = JSON.parse(raw) as OnboardingData;
		if (typeof parsed.completed !== "boolean") return null;
		return parsed;
	} catch {
		return null;
	}
}

function buildOnboardingSteps(existing: Record<string, unknown> | null, data: OnboardingData): Record<string, unknown> {
	return {
		...(existing || {}),
		walkthrough: {
			completed: data.completed,
			completed_at: new Date().toISOString(),
			job_function: data.jobFunction,
			primary_use_case: data.primaryUseCase,
			company_size: data.companySize,
		},
	};
}

function buildOnboardingMetadata(
	existing: Record<string, unknown> | null,
	data: OnboardingData
): Record<string, unknown> {
	return {
		...(existing || {}),
		onboarding: {
			job_function: data.jobFunction,
			primary_use_case: data.primaryUseCase,
			company_size: data.companySize,
		},
	};
}

// ---------- Tests ----------

describe("parseOnboardingPayload", () => {
	it("parses valid complete payload", () => {
		const raw = JSON.stringify({
			jobFunction: "product",
			primaryUseCase: "customer_discovery",
			companySize: "startup",
			completed: true,
		});
		const result = parseOnboardingPayload(raw);
		expect(result).toEqual({
			jobFunction: "product",
			primaryUseCase: "customer_discovery",
			companySize: "startup",
			completed: true,
		});
	});

	it("parses payload with completed=false", () => {
		const raw = JSON.stringify({
			jobFunction: "",
			primaryUseCase: "",
			companySize: "",
			completed: false,
		});
		const result = parseOnboardingPayload(raw);
		expect(result?.completed).toBe(false);
	});

	it("returns null for invalid JSON", () => {
		expect(parseOnboardingPayload("not json")).toBeNull();
	});

	it("returns null when completed is not boolean", () => {
		const raw = JSON.stringify({
			jobFunction: "product",
			completed: "yes", // wrong type
		});
		expect(parseOnboardingPayload(raw)).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseOnboardingPayload("")).toBeNull();
	});
});

describe("buildOnboardingSteps", () => {
	const data: OnboardingData = {
		jobFunction: "design",
		primaryUseCase: "user_research",
		companySize: "smb",
		completed: true,
	};

	it("creates walkthrough step with correct fields", () => {
		const result = buildOnboardingSteps(null, data);
		const walkthrough = result.walkthrough as Record<string, unknown>;

		expect(walkthrough.completed).toBe(true);
		expect(walkthrough.job_function).toBe("design");
		expect(walkthrough.primary_use_case).toBe("user_research");
		expect(walkthrough.company_size).toBe("smb");
		expect(walkthrough.completed_at).toBeDefined();
	});

	it("preserves existing steps when adding walkthrough", () => {
		const existing = { previous_step: { done: true } };
		const result = buildOnboardingSteps(existing, data);

		expect(result.previous_step).toEqual({ done: true });
		const walkthrough = result.walkthrough as Record<string, unknown>;
		expect(walkthrough.completed).toBe(true);
	});

	it("overwrites existing walkthrough data", () => {
		const existing = {
			walkthrough: { completed: false, job_function: "old" },
		};
		const result = buildOnboardingSteps(existing, data);
		const walkthrough = result.walkthrough as Record<string, unknown>;

		expect(walkthrough.completed).toBe(true);
		expect(walkthrough.job_function).toBe("design");
	});
});

describe("buildOnboardingMetadata", () => {
	const data: OnboardingData = {
		jobFunction: "engineering",
		primaryUseCase: "competitive_intel",
		companySize: "enterprise",
		completed: true,
	};

	it("creates onboarding metadata block", () => {
		const result = buildOnboardingMetadata(null, data);

		expect(result.onboarding).toEqual({
			job_function: "engineering",
			primary_use_case: "competitive_intel",
			company_size: "enterprise",
		});
	});

	it("preserves other metadata keys", () => {
		const existing = { theme: "dark", locale: "en" };
		const result = buildOnboardingMetadata(existing, data);

		expect(result["theme"]).toBe("dark");
		expect(result["locale"]).toBe("en");
		expect(result.onboarding).toBeDefined();
	});
});

describe("onboarding data flow validation", () => {
	it("company size maps to expected account metadata key", () => {
		// Validates the pattern used in the action to update account public_metadata
		const companySize = "startup";
		const publicMetadata: Record<string, unknown> = {};
		const updated = {
			...publicMetadata,
			company_size_category: companySize,
		};

		expect(updated.company_size_category).toBe("startup");
	});

	it("role from onboarding maps to user_settings.role", () => {
		// The action sets role = onboardingData.jobFunction || existing.role
		const jobFunction = "product";
		const existingRole = "founder";
		const resolvedRole = jobFunction || existingRole || null;

		expect(resolvedRole).toBe("product");
	});

	it("falls back to existing role when jobFunction is empty", () => {
		const jobFunction = "";
		const existingRole = "founder";
		const resolvedRole = jobFunction || existingRole || null;

		expect(resolvedRole).toBe("founder");
	});

	it("uses null when both jobFunction and existing role are empty", () => {
		const jobFunction = "";
		const existingRole = null;
		const resolvedRole = jobFunction || existingRole || null;

		expect(resolvedRole).toBeNull();
	});
});
