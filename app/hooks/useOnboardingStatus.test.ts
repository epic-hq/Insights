import { describe, expect, it } from "vitest";
import { buildOnboardingContext, type OnboardingStatus } from "./useOnboardingStatus";

/**
 * Unit tests for pure functions in onboarding status hook.
 * buildOnboardingContext is the primary testable pure function —
 * it generates AI context strings from onboarding data.
 */

const baseStatus: OnboardingStatus = {
	isLoading: false,
	completed: true,
	jobFunction: "",
	primaryUseCase: "",
	companySize: "",
	shouldShowOnboarding: false,
};

describe("buildOnboardingContext", () => {
	it("returns empty string when onboarding not completed", () => {
		const status: OnboardingStatus = { ...baseStatus, completed: false };
		expect(buildOnboardingContext(status)).toBe("");
	});

	it("returns empty string when completed but no data", () => {
		expect(buildOnboardingContext(baseStatus)).toBe("");
	});

	it("maps known job functions to friendly descriptions", () => {
		const cases: [string, string][] = [
			["product", "product manager"],
			["design", "designer"],
			["engineering", "engineering professional"],
			["research", "researcher"],
			["executive", "executive/leader"],
			["sales", "sales professional"],
			["customer-success", "customer success professional"],
			["marketing", "marketing professional"],
			["data", "data & analytics professional"],
			["hr", "HR/people professional"],
		];

		for (const [input, expected] of cases) {
			const result = buildOnboardingContext({ ...baseStatus, jobFunction: input });
			expect(result).toContain(`User Role: ${expected}`);
		}
	});

	it("falls back to raw jobFunction when not in the map", () => {
		const result = buildOnboardingContext({ ...baseStatus, jobFunction: "cto" });
		expect(result).toContain("User Role: cto");
	});

	it("maps known use cases to friendly descriptions", () => {
		const cases: [string, string][] = [
			["customer_discovery", "customer discovery and validation"],
			["user_research", "user research and synthesis"],
			["sales_intelligence", "sales intelligence and deal tracking"],
			["surveys", "collecting feedback via surveys"],
			["competitive_intel", "competitive intelligence"],
			["customer_success", "customer success and feedback tracking"],
		];

		for (const [input, expected] of cases) {
			const result = buildOnboardingContext({ ...baseStatus, primaryUseCase: input });
			expect(result).toContain(`Primary Goal: ${expected}`);
		}
	});

	it("falls back to raw primaryUseCase when not in the map", () => {
		const result = buildOnboardingContext({ ...baseStatus, primaryUseCase: "custom_thing" });
		expect(result).toContain("Primary Goal: custom_thing");
	});

	it("maps known company sizes correctly", () => {
		const cases: [string, string][] = [
			["startup", "startup (1-50 employees)"],
			["smb", "SMB (51-500 employees)"],
			["mid-market", "mid-market company (501-5,000 employees)"],
			["enterprise", "enterprise (5,000+ employees)"],
		];

		for (const [input, expected] of cases) {
			const result = buildOnboardingContext({ ...baseStatus, companySize: input });
			expect(result).toContain(`Company Size: ${expected}`);
		}
	});

	it("combines all fields when present", () => {
		const status: OnboardingStatus = {
			...baseStatus,
			jobFunction: "product",
			primaryUseCase: "customer_discovery",
			companySize: "startup",
		};
		const result = buildOnboardingContext(status);

		expect(result).toContain("User Profile:");
		expect(result).toContain("User Role: product manager");
		expect(result).toContain("Primary Goal: customer discovery and validation");
		expect(result).toContain("Company Size: startup (1-50 employees)");
	});

	it("omits empty fields from output", () => {
		const result = buildOnboardingContext({
			...baseStatus,
			jobFunction: "design",
			// primaryUseCase and companySize are empty
		});

		expect(result).toContain("User Role: designer");
		expect(result).not.toContain("Primary Goal");
		expect(result).not.toContain("Company Size");
	});
});
