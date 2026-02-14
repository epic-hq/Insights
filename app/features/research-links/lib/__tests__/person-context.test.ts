/**
 * Tests for person context fetching logic.
 * Tests the pure utility functions (seniority/role extraction)
 * and the fetch functions with mocked Supabase.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// We need to test the private functions, so we'll import the module
// and test via the exported fetchPersonContext which calls them internally.
// For the pure extraction logic, we re-implement the patterns to test them.

// ============================================================================
// Seniority extraction tests (mirrors logic in person-context.server.ts)
// ============================================================================

const SENIORITY_PATTERNS: Array<{ pattern: RegExp; level: string }> = [
	{ pattern: /\b(ceo|cto|cfo|coo|cmo|cpo|cro)\b/i, level: "C-Level" },
	{ pattern: /\bchief\b/i, level: "C-Level" },
	{ pattern: /\b(svp|senior vice president)\b/i, level: "SVP" },
	{ pattern: /\b(vp|vice president)\b/i, level: "VP" },
	{ pattern: /\bdirector\b/i, level: "Director" },
	{ pattern: /\b(senior|sr\.?|staff|principal|lead)\b/i, level: "Senior" },
	{ pattern: /\b(manager|head of)\b/i, level: "Manager" },
	{ pattern: /\bjunior|jr\.?\b/i, level: "Junior" },
];

function extractSeniority(title: string | null): string | null {
	if (!title) return null;
	for (const { pattern, level } of SENIORITY_PATTERNS) {
		if (pattern.test(title)) return level;
	}
	return "IC";
}

const ROLE_PATTERNS: Array<{ pattern: RegExp; role: string }> = [
	{
		pattern: /\b(engineer(?:ing)?|developer|software|sre|devops|platform)\b/i,
		role: "Engineering",
	},
	{ pattern: /\b(product|pm)\b/i, role: "Product" },
	{ pattern: /\b(design(?:er)?|ux|ui)\b/i, role: "Design" },
	{
		pattern: /\b(market(?:ing)?|growth|demand gen|content)\b/i,
		role: "Marketing",
	},
	{
		pattern: /\b(sales|account exec(?:utive)?|ae|sdr|bdr)\b/i,
		role: "Sales",
	},
	{ pattern: /\b(success|support|cx)\b/i, role: "Customer Success" },
	{ pattern: /\b(research|insight|analyst)\b/i, role: "Research" },
	{ pattern: /\b(ops|operations)\b/i, role: "Operations" },
	{ pattern: /\b(data|analytics|ml|ai)\b/i, role: "Data" },
];

function extractRole(title: string | null): string | null {
	if (!title) return null;
	for (const { pattern, role } of ROLE_PATTERNS) {
		if (pattern.test(title)) return role;
	}
	return null;
}

describe("extractSeniority", () => {
	it("returns null for null title", () => {
		expect(extractSeniority(null)).toBeNull();
	});

	it("detects C-Level titles", () => {
		expect(extractSeniority("CEO")).toBe("C-Level");
		expect(extractSeniority("Chief Technology Officer")).toBe("C-Level");
		expect(extractSeniority("CTO at Acme Corp")).toBe("C-Level");
		expect(extractSeniority("Co-founder & CFO")).toBe("C-Level");
	});

	it("detects VP titles", () => {
		expect(extractSeniority("VP of Engineering")).toBe("VP");
		expect(extractSeniority("Vice President, Product")).toBe("VP");
	});

	it("detects SVP titles", () => {
		expect(extractSeniority("SVP of Sales")).toBe("SVP");
		expect(extractSeniority("Senior Vice President")).toBe("SVP");
	});

	it("detects Director titles", () => {
		expect(extractSeniority("Director of Engineering")).toBe("Director");
		expect(extractSeniority("Engineering Director")).toBe("Director");
	});

	it("detects Senior titles", () => {
		expect(extractSeniority("Senior Software Engineer")).toBe("Senior");
		expect(extractSeniority("Sr. Developer")).toBe("Senior");
		expect(extractSeniority("Staff Engineer")).toBe("Senior");
		expect(extractSeniority("Principal Architect")).toBe("Senior");
		expect(extractSeniority("Lead Designer")).toBe("Senior");
	});

	it("detects Manager titles", () => {
		expect(extractSeniority("Engineering Manager")).toBe("Manager");
		expect(extractSeniority("Head of Product")).toBe("Manager");
	});

	it("detects Junior titles", () => {
		expect(extractSeniority("Junior Developer")).toBe("Junior");
		expect(extractSeniority("Jr. Engineer")).toBe("Junior");
	});

	it("returns IC for unrecognized titles", () => {
		expect(extractSeniority("Software Engineer")).toBe("IC");
		expect(extractSeniority("Designer")).toBe("IC");
		expect(extractSeniority("Analyst")).toBe("IC");
	});
});

describe("extractRole", () => {
	it("returns null for null title", () => {
		expect(extractRole(null)).toBeNull();
	});

	it("detects Engineering roles", () => {
		expect(extractRole("Software Engineer")).toBe("Engineering");
		expect(extractRole("Senior Developer")).toBe("Engineering");
		expect(extractRole("Platform Engineer")).toBe("Engineering");
		expect(extractRole("SRE Lead")).toBe("Engineering");
		expect(extractRole("DevOps Manager")).toBe("Engineering");
	});

	it("detects Product roles", () => {
		expect(extractRole("Product Manager")).toBe("Product");
		expect(extractRole("Senior PM")).toBe("Product");
	});

	it("detects Design roles", () => {
		expect(extractRole("UX Designer")).toBe("Design");
		expect(extractRole("UI/UX Lead")).toBe("Design");
	});

	it("detects Marketing roles", () => {
		expect(extractRole("Marketing Manager")).toBe("Marketing");
		expect(extractRole("Growth Lead")).toBe("Marketing");
		expect(extractRole("Content Strategist")).toBe("Marketing");
	});

	it("detects Sales roles", () => {
		expect(extractRole("Account Executive")).toBe("Sales");
		expect(extractRole("SDR")).toBe("Sales");
		expect(extractRole("Sales Director")).toBe("Sales");
	});

	it("detects Customer Success roles", () => {
		expect(extractRole("Customer Success Manager")).toBe("Customer Success");
		expect(extractRole("Support Lead")).toBe("Customer Success");
	});

	it("detects Data roles", () => {
		expect(extractRole("Data Scientist")).toBe("Data");
		expect(extractRole("ML Researcher")).toBe("Data");
		expect(extractRole("Analytics Lead")).toBe("Data");
	});

	it("returns null for unrecognized roles", () => {
		expect(extractRole("CEO")).toBeNull();
		expect(extractRole("Founder")).toBeNull();
	});
});

// ============================================================================
// fetchPersonContext tests (with mocked Supabase)
// ============================================================================

// Mock Supabase with chainable query builder
function createMockSupabase(overrides: Record<string, unknown> = {}) {
	const defaultPerson = {
		id: "person-1",
		firstname: "Jane",
		lastname: "Smith",
		title: "VP of Engineering",
		primary_email: "jane@acme.com",
	};

	const defaultOrg = {
		organization: { name: "Acme Corp" },
	};

	const defaultIcp = { score: 0.85 };

	const defaultFacets = [
		{ kind_slug: "pain", value: "Slow onboarding process" },
		{ kind_slug: "pain", value: "No visibility into usage" },
		{ kind_slug: "goal", value: "Reduce churn by 20%" },
		{ kind_slug: "tool", value: "Salesforce" },
	];

	const defaultThemes = [{ theme_name: "Onboarding friction" }, { theme_name: "Customer retention" }];

	const chainable = (data: unknown, error: unknown = null) => ({
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		in: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		single: vi.fn(() => Promise.resolve({ data, error })),
		maybeSingle: vi.fn(() => Promise.resolve({ data, error })),
	});

	return {
		from: vi.fn((table: string) => {
			if (table === "people") return chainable("person" in overrides ? overrides.person : defaultPerson);
			if (table === "person_organization") return chainable("org" in overrides ? overrides.org : defaultOrg);
			if (table === "person_scale") return chainable("icp" in overrides ? overrides.icp : defaultIcp);
			if (table === "person_facet") {
				const data = "facets" in overrides ? overrides.facets : defaultFacets;
				return {
					select: vi.fn().mockReturnThis(),
					eq: vi.fn(() => Promise.resolve({ data, error: null })),
				};
			}
			if (table === "evidence_people") return chainable("lastEvidence" in overrides ? overrides.lastEvidence : null);
			return chainable(null);
		}),
		rpc: vi.fn(() =>
			Promise.resolve({
				data: "themes" in overrides ? overrides.themes : defaultThemes,
				error: null,
			})
		),
	};
}

// Mock the Supabase module
vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: vi.fn(),
	createSupabaseAdminClient: vi.fn(),
}));

describe("fetchPersonContext", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns complete context for a rich profile", async () => {
		const mockSb = createMockSupabase();

		const { fetchPersonContext } = await import("~/features/research-links/lib/person-context.server");

		const ctx = await fetchPersonContext(mockSb as never, "person-1", "project-1");

		expect(ctx.name).toBe("Jane Smith");
		expect(ctx.title).toBe("VP of Engineering");
		expect(ctx.company).toBe("Acme Corp");
		expect(ctx.role).toBe("Engineering");
		expect(ctx.seniority_level).toBe("VP");
		expect(ctx.icp_band).toBe("Strong");
		expect(ctx.icp_score).toBe(0.85);
		expect(ctx.facets.pains).toHaveLength(2);
		expect(ctx.facets.goals).toHaveLength(1);
		expect(ctx.facets.tools).toHaveLength(1);
		expect(ctx.conversation_themes).toEqual(["Onboarding friction", "Customer retention"]);
		expect(ctx.sparse_mode).toBe(false);
		expect(ctx.missing_fields).not.toContain("title");
		expect(ctx.missing_fields).not.toContain("company");
	});

	it("detects sparse mode when missing many fields", async () => {
		const mockSb = createMockSupabase({
			person: {
				id: "person-2",
				firstname: "Bob",
				lastname: null,
				title: null,
				primary_email: "bob@example.com",
			},
			org: null,
			icp: null,
			facets: [],
			themes: [],
		});

		const { fetchPersonContext } = await import("~/features/research-links/lib/person-context.server");

		const ctx = await fetchPersonContext(mockSb as never, "person-2", "project-1");

		expect(ctx.name).toBe("Bob");
		expect(ctx.title).toBeNull();
		expect(ctx.company).toBeNull();
		expect(ctx.sparse_mode).toBe(true);
		expect(ctx.missing_fields).toContain("title");
		expect(ctx.missing_fields).toContain("company");
		expect(ctx.missing_fields).toContain("pains");
		expect(ctx.missing_fields).toContain("goals");
		expect(ctx.missing_fields).toContain("workflows");
		expect(ctx.icp_band).toBe("Weak");
	});

	it("computes correct ICP bands", async () => {
		const { fetchPersonContext } = await import("~/features/research-links/lib/person-context.server");

		// Strong: >= 0.7
		const strong = await fetchPersonContext(createMockSupabase({ icp: { score: 0.75 } }) as never, "p", "proj");
		expect(strong.icp_band).toBe("Strong");

		// Moderate: >= 0.5
		const moderate = await fetchPersonContext(createMockSupabase({ icp: { score: 0.55 } }) as never, "p", "proj");
		expect(moderate.icp_band).toBe("Moderate");

		// Weak: < 0.5
		const weak = await fetchPersonContext(createMockSupabase({ icp: { score: 0.3 } }) as never, "p", "proj");
		expect(weak.icp_band).toBe("Weak");
	});

	it("throws when person not found", async () => {
		const mockSb = createMockSupabase({ person: null });

		const { fetchPersonContext } = await import("~/features/research-links/lib/person-context.server");

		await expect(fetchPersonContext(mockSb as never, "nonexistent", "project-1")).rejects.toThrow(
			"Person nonexistent not found"
		);
	});
});
