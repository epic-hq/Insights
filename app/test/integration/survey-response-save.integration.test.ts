/**
 * Integration tests for survey response save endpoint.
 * Tests the full flow against the real Supabase instance.
 *
 * Run: dotenvx run -- vitest run app/test/integration/survey-response-save.integration.test.ts
 *
 * Covers:
 * - Anonymous survey completion (the null email bug fix)
 * - Identified survey completion with person creation
 * - Evidence extraction for text questions
 * - Structural question type filtering (likert, single_select skipped)
 */

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Create admin client directly from env vars (not from testDb which points to local)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Run with: dotenvx run -- vitest run ...",
  );
}

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Mock supabase client factory to return our admin client
vi.mock("~/lib/supabase/client.server", () => ({
  createSupabaseAdminClient: () => adminDb,
}));

vi.mock("consola", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// Test data IDs — unique per run to avoid collisions
const RESEARCH_LINK_ID = crypto.randomUUID();
const RESEARCH_LINK_SLUG = `test-survey-${Date.now()}`;
const ANON_RESPONSE_ID = crypto.randomUUID();
const IDENTIFIED_RESPONSE_ID = crypto.randomUUID();
const TEST_EMAIL = `survey-test-${Date.now()}@example.com`;

// We need a real account_id and project_id. Look one up from the DB.
let TEST_ACCOUNT_ID: string;
let TEST_PROJECT_ID: string;

async function findTestProject() {
  const { data } = await adminDb
    .from("projects")
    .select("id, account_id")
    .limit(1)
    .single();
  if (!data)
    throw new Error("No projects found in DB — cannot run integration tests");
  TEST_ACCOUNT_ID = data.account_id;
  TEST_PROJECT_ID = data.id;
}

async function seedSurveyData() {
  const { error: linkError } = await adminDb.from("research_links").insert({
    id: RESEARCH_LINK_ID,
    account_id: TEST_ACCOUNT_ID,
    project_id: TEST_PROJECT_ID,
    name: "Pizza Preferences Survey (test)",
    slug: RESEARCH_LINK_SLUG,
    is_live: true,
    identity_mode: "anonymous",
    questions: [
      {
        id: "q-text",
        prompt: "What is your favorite pizza topping and why?",
        type: "auto",
      },
      {
        id: "q-select",
        prompt: "How often do you eat pizza?",
        type: "single_select",
        options: ["Daily", "Weekly", "Monthly"],
      },
      {
        id: "q-likert",
        prompt: "Rate your pizza satisfaction",
        type: "likert",
        likertScale: 5,
      },
      {
        id: "q-longtext",
        prompt: "Describe your ideal pizza experience",
        type: "long_text",
      },
    ],
  });
  if (linkError)
    throw new Error(`Failed to seed research link: ${linkError.message}`);

  const { error: anonError } = await adminDb
    .from("research_link_responses")
    .insert({
      id: ANON_RESPONSE_ID,
      research_link_id: RESEARCH_LINK_ID,
      email: null,
      phone: null,
      responses: {},
      completed: false,
    });
  if (anonError)
    throw new Error(`Failed to seed anonymous response: ${anonError.message}`);

  const { error: identError } = await adminDb
    .from("research_link_responses")
    .insert({
      id: IDENTIFIED_RESPONSE_ID,
      research_link_id: RESEARCH_LINK_ID,
      email: TEST_EMAIL,
      responses: {},
      completed: false,
    });
  if (identError)
    throw new Error(
      `Failed to seed identified response: ${identError.message}`,
    );
}

async function cleanupSurveyData() {
  // Clean up in dependency order
  await adminDb
    .from("evidence_people")
    .delete()
    .eq("account_id", TEST_ACCOUNT_ID)
    .in(
      "evidence_id",
      (
        await adminDb
          .from("evidence")
          .select("id")
          .eq("research_link_response_id", ANON_RESPONSE_ID)
      ).data?.map((e) => e.id) ?? [],
    );
  await adminDb
    .from("evidence_people")
    .delete()
    .eq("account_id", TEST_ACCOUNT_ID)
    .in(
      "evidence_id",
      (
        await adminDb
          .from("evidence")
          .select("id")
          .eq("research_link_response_id", IDENTIFIED_RESPONSE_ID)
      ).data?.map((e) => e.id) ?? [],
    );
  await adminDb
    .from("evidence")
    .delete()
    .eq("research_link_response_id", ANON_RESPONSE_ID);
  await adminDb
    .from("evidence")
    .delete()
    .eq("research_link_response_id", IDENTIFIED_RESPONSE_ID);
  await adminDb
    .from("research_link_responses")
    .delete()
    .eq("research_link_id", RESEARCH_LINK_ID);
  await adminDb.from("research_links").delete().eq("id", RESEARCH_LINK_ID);
  await adminDb.from("people").delete().eq("primary_email", TEST_EMAIL);
}

describe("Survey Response Save Integration", () => {
  beforeAll(async () => {
    await findTestProject();
    await seedSurveyData();
  }, 15000);

  afterAll(async () => {
    await cleanupSurveyData();
  }, 15000);

  describe("anonymous survey completion (regression: null email bug)", () => {
    it("should complete without crashing when email is null", async () => {
      const { action } = await import("~/routes/api.research-links.$slug.save");

      const request = new Request(
        `http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseId: ANON_RESPONSE_ID,
            responses: {
              "q-text":
                "Pepperoni because it has the perfect balance of spice and flavor",
              "q-select": "Weekly",
              "q-likert": "4",
              "q-longtext":
                "A wood-fired oven, fresh mozzarella, and a cold drink on a summer evening",
            },
            completed: true,
          }),
        },
      );

      const response = await action({
        request,
        params: { slug: RESEARCH_LINK_SLUG },
        context: {},
      } as never);
      expect(response).toBeDefined();
      expect((response as { ok: boolean }).ok).toBe(true);
    });

    it("should mark the response as completed in DB", async () => {
      const { data } = await adminDb
        .from("research_link_responses")
        .select("completed, responses")
        .eq("id", ANON_RESPONSE_ID)
        .single();

      expect(data?.completed).toBe(true);
      expect(data?.responses).toBeTruthy();
    });

    it("should NOT create a person record for anonymous response", async () => {
      const { data } = await adminDb
        .from("research_link_responses")
        .select("person_id")
        .eq("id", ANON_RESPONSE_ID)
        .single();

      expect(data?.person_id).toBeNull();
    });

    it("should create evidence only for text questions (not likert/single_select)", async () => {
      const { data: evidence } = await adminDb
        .from("evidence")
        .select("id, verbatim, method")
        .eq("research_link_response_id", ANON_RESPONSE_ID);

      expect(evidence).toBeTruthy();
      expect(evidence!.length).toBe(2);

      const verbatims = evidence!.map((e) => e.verbatim);
      expect(verbatims.some((v) => v?.includes("favorite pizza topping"))).toBe(
        true,
      );
      expect(verbatims.some((v) => v?.includes("ideal pizza experience"))).toBe(
        true,
      );
      expect(evidence!.every((e) => e.method === "survey")).toBe(true);
    });
  });

  describe("identified survey completion", () => {
    it("should complete and create/find person for identified response", async () => {
      const { action } = await import("~/routes/api.research-links.$slug.save");

      const request = new Request(
        `http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseId: IDENTIFIED_RESPONSE_ID,
            responses: {
              "q-text": "Margherita is the classic that never disappoints",
              "q-select": "Monthly",
              "q-likert": "5",
              "q-longtext": "Simple ingredients, perfectly cooked",
            },
            completed: true,
          }),
        },
      );

      const response = await action({
        request,
        params: { slug: RESEARCH_LINK_SLUG },
        context: {},
      } as never);
      expect(response).toBeDefined();
      expect((response as { ok: boolean }).ok).toBe(true);
    });

    it("should create a person record from email", async () => {
      const { data: resp } = await adminDb
        .from("research_link_responses")
        .select("person_id")
        .eq("id", IDENTIFIED_RESPONSE_ID)
        .single();

      expect(resp?.person_id).toBeTruthy();

      const { data: person } = await adminDb
        .from("people")
        .select("primary_email, person_type")
        .eq("id", resp!.person_id!)
        .single();

      expect(person?.primary_email).toBe(TEST_EMAIL);
      expect(person?.person_type).toBe("respondent");
    });

    it("should create evidence linked to person", async () => {
      const { data: evidence } = await adminDb
        .from("evidence")
        .select("id, research_link_response_id")
        .eq("research_link_response_id", IDENTIFIED_RESPONSE_ID);

      expect(evidence).toBeTruthy();
      expect(evidence!.length).toBe(2);

      for (const ev of evidence!) {
        const { data: links } = await adminDb
          .from("evidence_people")
          .select("person_id, role")
          .eq("evidence_id", ev.id);

        expect(links).toBeTruthy();
        expect(links!.length).toBe(1);
        expect(links![0].role).toBe("respondent");
      }
    });
  });

  describe("validation", () => {
    it("should return 400 for missing responseId", async () => {
      const { action } = await import("~/routes/api.research-links.$slug.save");
      const request = new Request(
        `http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses: {} }),
        },
      );
      const response = await action({
        request,
        params: { slug: RESEARCH_LINK_SLUG },
        context: {},
      } as never);
      expect((response as Response).status).toBe(400);
    });

    it("should return 404 for nonexistent slug", async () => {
      const { action } = await import("~/routes/api.research-links.$slug.save");
      const request = new Request(
        "http://localhost/api/research-links/nonexistent-slug/save",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseId: crypto.randomUUID(),
            responses: {},
          }),
        },
      );
      const response = await action({
        request,
        params: { slug: "nonexistent-slug" },
        context: {},
      } as never);
      expect((response as Response).status).toBe(404);
    });

    it("should return 404 for nonexistent responseId", async () => {
      const { action } = await import("~/routes/api.research-links.$slug.save");
      const request = new Request(
        `http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseId: crypto.randomUUID(),
            responses: {},
          }),
        },
      );
      const response = await action({
        request,
        params: { slug: RESEARCH_LINK_SLUG },
        context: {},
      } as never);
      expect((response as Response).status).toBe(404);
    });
  });
});
