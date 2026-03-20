#!/usr/bin/env node
/**
 * AgentCRM Integration Tests
 *
 * Runs CRUD operations against a live Supabase instance and measures timing.
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENTCRM_ACCOUNT_ID, AGENTCRM_PROJECT_ID
 *
 * Usage:
 *   npx tsx src/test-integration.ts
 *   # or after build:
 *   node dist/test-integration.js
 */

import { getSupabase, getConfig, resolveContext } from "./supabase.js";
import { handlePeopleTool } from "./tools/people.js";
import { handleOrganizationTool } from "./tools/organizations.js";
import { handleOpportunityTool } from "./tools/opportunities.js";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

interface TestResult {
  name: string;
  passed: boolean;
  duration_ms: number;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function test(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  const start = performance.now();
  try {
    await fn();
    const duration = Math.round(performance.now() - start);
    results.push({ name, passed: true, duration_ms: duration });
    console.log(`  ✓ ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    results.push({
      name,
      passed: false,
      duration_ms: duration,
      error: message,
    });
    console.log(`  ✗ ${name} (${duration}ms) — ${message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertDefined<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`Expected defined value: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Shared state for tests (created resources get cleaned up)
// ---------------------------------------------------------------------------

let createdPersonId: string | null = null;
let createdOrgId: string | null = null;
let createdOppId: string | null = null;

const TEST_PREFIX = `__agentcrm_test_${Date.now()}`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runTests(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   AgentCRM MCP Server Integration Tests  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Check env
  try {
    const config = getConfig();
    console.log(`Supabase URL: ${config.supabaseUrl}`);
    console.log(`Account ID:   ${config.defaultAccountId || "(not set)"}`);
    console.log(`Project ID:   ${config.defaultProjectId || "(not set)"}`);
    console.log("");
  } catch (e) {
    console.error(
      "Missing environment variables. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENTCRM_ACCOUNT_ID, AGENTCRM_PROJECT_ID"
    );
    process.exit(1);
  }

  // ── Organizations ────────────────────────────────────────────
  console.log("Organizations:");

  await test("create_organization", async () => {
    const result = (await handleOrganizationTool("create_organization", {
      name: `${TEST_PREFIX}_Acme Corp`,
      description: "Test organization for integration tests",
      industry: "Technology",
      size_range: "51-200",
      website_url: "https://acme-test.example.com",
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    const org = result.organization as Record<string, unknown>;
    assertDefined(org, "should return organization");
    assertDefined(org.id, "should have id");
    assert(
      (org.name as string).includes("Acme Corp"),
      "should have correct name"
    );
    createdOrgId = org.id as string;
  });

  await test("list_organizations", async () => {
    const result = (await handleOrganizationTool("list_organizations", {
      search: TEST_PREFIX,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    assert(
      (result.total as number) >= 1,
      "should find at least the created org"
    );
  });

  await test("get_organization", async () => {
    assertDefined(createdOrgId, "need created org");
    const result = (await handleOrganizationTool("get_organization", {
      organization_id: createdOrgId,
      include_contacts: true,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    const org = result.organization as Record<string, unknown>;
    assert(
      (org.industry as string) === "Technology",
      "should have correct industry"
    );
  });

  await test("update_organization", async () => {
    assertDefined(createdOrgId, "need created org");
    const result = (await handleOrganizationTool("update_organization", {
      organization_id: createdOrgId,
      size_range: "201-1000",
      headquarters_location: "San Francisco, CA",
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    const fields = result.updated_fields as string[];
    assert(fields.includes("size_range"), "should update size_range");
    assert(
      fields.includes("headquarters_location"),
      "should update headquarters_location"
    );
  });

  // ── People ──────────────────────────────────────────────────
  console.log("\nPeople:");

  await test("create_person", async () => {
    const result = (await handlePeopleTool("create_person", {
      name: `${TEST_PREFIX} Jane Doe`,
      title: "VP Engineering",
      role: "Engineering Lead",
      company: `${TEST_PREFIX}_Acme Corp`,
      primary_email: `jane-${Date.now()}@example.com`,
      segment: "enterprise",
      lifecycle_stage: "prospect",
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    const person = result.person as Record<string, unknown>;
    assertDefined(person, "should return person");
    assertDefined(person.id, "should have id");
    createdPersonId = person.id as string;
  });

  await test("list_people", async () => {
    const result = (await handlePeopleTool("list_people", {
      search: TEST_PREFIX,
      limit: 10,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    assert(
      (result.total as number) >= 1,
      "should find at least the created person"
    );
  });

  await test("get_person", async () => {
    assertDefined(createdPersonId, "need created person");
    const result = (await handlePeopleTool("get_person", {
      person_id: createdPersonId,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    const person = result.person as Record<string, unknown>;
    assert(
      (person.title as string) === "VP Engineering",
      "should have correct title"
    );
    assert(
      person.organization !== null,
      "should have linked organization"
    );
  });

  await test("update_person", async () => {
    assertDefined(createdPersonId, "need created person");
    const result = (await handlePeopleTool("update_person", {
      person_id: createdPersonId,
      title: "SVP Engineering",
      location: "Austin, TX",
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    const fields = result.updated_fields as string[];
    assert(fields.includes("title"), "should update title");
    assert(fields.includes("location"), "should update location");
  });

  await test("search_people", async () => {
    const result = (await handlePeopleTool("search_people", {
      query: "Jane",
      limit: 5,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    assert(
      (result.total as number) >= 1,
      "should find at least one match"
    );
  });

  // ── Opportunities ───────────────────────────────────────────
  console.log("\nOpportunities:");

  await test("create_opportunity", async () => {
    const result = (await handleOpportunityTool("create_opportunity", {
      title: `${TEST_PREFIX} Enterprise Deal`,
      description: "Test opportunity for integration tests",
      stage: "Discovery",
      amount: 50000,
      close_date: "2026-06-30",
      confidence: 0.6,
      organization_id: createdOrgId,
      primary_contact_id: createdPersonId,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    const opp = result.opportunity as Record<string, unknown>;
    assertDefined(opp, "should return opportunity");
    assertDefined(opp.id, "should have id");
    createdOppId = opp.id as string;
  });

  await test("list_opportunities", async () => {
    const result = (await handleOpportunityTool("list_opportunities", {
      search: TEST_PREFIX,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    assert(
      (result.total as number) >= 1,
      "should find at least the created opportunity"
    );
  });

  await test("get_opportunity", async () => {
    assertDefined(createdOppId, "need created opportunity");
    const result = (await handleOpportunityTool("get_opportunity", {
      opportunity_id: createdOppId,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    const opp = result.opportunity as Record<string, unknown>;
    assert(
      (opp.stage as string) === "Discovery",
      "should have correct stage"
    );
    assert(result.organization !== null, "should have linked org");
    assert(result.primary_contact !== null, "should have linked contact");
  });

  await test("update_opportunity", async () => {
    assertDefined(createdOppId, "need created opportunity");
    const result = (await handleOpportunityTool("update_opportunity", {
      opportunity_id: createdOppId,
      stage: "Proposal",
      amount: 75000,
      confidence: 0.8,
      next_step: "Send SOW",
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    const fields = result.updated_fields as string[];
    assert(fields.includes("stage"), "should update stage");
    assert(fields.includes("amount"), "should update amount");
  });

  // ── Delete operations (dry run first, then actual) ──────────
  console.log("\nCleanup (delete operations):");

  await test("delete_opportunity (dry_run)", async () => {
    assertDefined(createdOppId, "need created opportunity");
    const result = (await handleOpportunityTool("delete_opportunity", {
      opportunity_id: createdOppId,
      confirm_title: `${TEST_PREFIX} Enterprise Deal`,
      dry_run: true,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    assert(result.dry_run === true, "should be dry run");
  });

  await test("delete_opportunity", async () => {
    assertDefined(createdOppId, "need created opportunity");
    const result = (await handleOpportunityTool("delete_opportunity", {
      opportunity_id: createdOppId,
      confirm_title: `${TEST_PREFIX} Enterprise Deal`,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
  });

  await test("delete_person (dry_run)", async () => {
    assertDefined(createdPersonId, "need created person");
    const result = (await handlePeopleTool("delete_person", {
      person_id: createdPersonId,
      confirm_name: `${TEST_PREFIX} Jane Doe`,
      dry_run: true,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    assert(result.dry_run === true, "should be dry run");
  });

  await test("delete_person", async () => {
    assertDefined(createdPersonId, "need created person");
    const result = (await handlePeopleTool("delete_person", {
      person_id: createdPersonId,
      confirm_name: `${TEST_PREFIX} Jane Doe`,
      force: true,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
  });

  await test("delete_organization (dry_run)", async () => {
    assertDefined(createdOrgId, "need created org");
    const result = (await handleOrganizationTool("delete_organization", {
      organization_id: createdOrgId,
      confirm_name: `${TEST_PREFIX}_Acme Corp`,
      dry_run: true,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
    assert(result.dry_run === true, "should be dry run");
  });

  await test("delete_organization", async () => {
    assertDefined(createdOrgId, "need created org");
    const result = (await handleOrganizationTool("delete_organization", {
      organization_id: createdOrgId,
      confirm_name: `${TEST_PREFIX}_Acme Corp`,
    })) as Record<string, unknown>;

    assert(result.success === true, "should succeed");
  });

  // ── Summary ─────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalMs = results.reduce((sum, r) => sum + r.duration_ms, 0);
  const avgMs = Math.round(totalMs / results.length);

  console.log(
    `Results: ${passed} passed, ${failed} failed, ${results.length} total`
  );
  console.log(`Timing:  ${totalMs}ms total, ${avgMs}ms avg per operation`);

  // Timing breakdown by category
  const categories: Record<string, TestResult[]> = {};
  for (const r of results) {
    const cat = r.name.split("_")[0] || "other";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(r);
  }

  console.log("\nTiming by entity:");
  for (const [cat, tests] of Object.entries(categories)) {
    const catTotal = tests.reduce((sum, t) => sum + t.duration_ms, 0);
    const catAvg = Math.round(catTotal / tests.length);
    console.log(
      `  ${cat.padEnd(15)} ${catTotal}ms total, ${catAvg}ms avg (${tests.length} ops)`
    );
  }

  if (failed > 0) {
    console.log("\nFailed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    }
    process.exit(1);
  }

  console.log("\n✓ All tests passed!");
}

// ---------------------------------------------------------------------------
// Cleanup on unexpected exit
// ---------------------------------------------------------------------------

async function cleanup(): Promise<void> {
  console.log("\nCleaning up test data...");
  const supabase = getSupabase();

  try {
    if (createdOppId) {
      await supabase
        .from("opportunities")
        .delete()
        .eq("id", createdOppId);
    }
  } catch { /* ignore */ }

  try {
    if (createdPersonId) {
      for (const table of [
        "interview_people",
        "project_people",
        "people_organizations",
        "people_personas",
      ]) {
        await supabase.from(table).delete().eq("person_id", createdPersonId);
      }
      await supabase.from("people").delete().eq("id", createdPersonId);
    }
  } catch { /* ignore */ }

  try {
    if (createdOrgId) {
      await supabase
        .from("organizations")
        .delete()
        .eq("id", createdOrgId);
    }
  } catch { /* ignore */ }
}

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(130);
});

runTests().catch(async (err) => {
  console.error("Test runner error:", err);
  await cleanup();
  process.exit(1);
});
