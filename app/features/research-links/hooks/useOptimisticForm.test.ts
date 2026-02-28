/**
 * Tests for useOptimisticForm pure functions:
 * - extractFormFields: converts loader data to typed form fields
 * - serializeToFormData: converts typed fields to action-compatible payload
 * - Round-trip: extractFormFields → serializeToFormData produces valid action payload
 */

import { describe, expect, it } from "vitest";
import type { ResearchLinkQuestion } from "../schemas";
import { ResearchLinkPayloadSchema } from "../schemas";
import {
  extractFormFields,
  serializeToFormData,
  type SurveyFormFields,
} from "./useOptimisticForm";

// ============================================================================
// Fixtures
// ============================================================================

function makeQuestion(
  overrides: Partial<ResearchLinkQuestion> = {},
): ResearchLinkQuestion {
  return {
    id: overrides.id ?? "q1",
    prompt: overrides.prompt ?? "Test question",
    required: false,
    type: "auto",
    placeholder: null,
    helperText: null,
    options: null,
    likertScale: null,
    likertLabels: null,
    imageOptions: null,
    videoUrl: null,
    ...overrides,
  };
}

/** Simulates a loader `list` object as returned from Supabase. */
function makeLoaderList(overrides: Record<string, unknown> = {}) {
  return {
    id: "list-1",
    name: "My Survey",
    slug: "my-survey",
    hero_title: "Welcome",
    hero_subtitle: "Please share your thoughts",
    instructions: "Answer honestly",
    hero_cta_label: "Start",
    hero_cta_helper: "Takes 2 min",
    calendar_url: "https://cal.com/test",
    redirect_url: "https://example.com/thanks",
    allow_chat: true,
    allow_voice: false,
    allow_video: false,
    default_response_mode: "form",
    is_live: true,
    ai_autonomy: "strict",
    identity_mode: "identified",
    identity_field: "email",
    ...overrides,
  };
}

function makeFields(
  overrides: Partial<SurveyFormFields> = {},
): SurveyFormFields {
  return {
    name: "My Survey",
    slug: "my-survey",
    heroTitle: "Welcome",
    heroSubtitle: "Please share",
    instructions: "Answer honestly",
    heroCtaLabel: "Start",
    heroCtaHelper: "Takes 2 min",
    calendarUrl: "",
    redirectUrl: "",
    allowChat: true,
    allowVoice: false,
    allowVideo: false,
    defaultResponseMode: "form",
    isLive: true,
    aiAutonomy: "strict",
    identityType: "email",
    questions: [makeQuestion()],
    ...overrides,
  };
}

// ============================================================================
// extractFormFields
// ============================================================================

describe("extractFormFields", () => {
  it("maps loader list fields to typed form fields", () => {
    const list = makeLoaderList();
    const questions = [makeQuestion()];
    const result = extractFormFields(list, questions);

    expect(result.name).toBe("My Survey");
    expect(result.slug).toBe("my-survey");
    expect(result.heroTitle).toBe("Welcome");
    expect(result.heroSubtitle).toBe("Please share your thoughts");
    expect(result.instructions).toBe("Answer honestly");
    expect(result.heroCtaLabel).toBe("Start");
    expect(result.heroCtaHelper).toBe("Takes 2 min");
    expect(result.calendarUrl).toBe("https://cal.com/test");
    expect(result.redirectUrl).toBe("https://example.com/thanks");
    expect(result.allowChat).toBe(true);
    expect(result.allowVoice).toBe(false);
    expect(result.allowVideo).toBe(false);
    expect(result.defaultResponseMode).toBe("form");
    expect(result.isLive).toBe(true);
    expect(result.aiAutonomy).toBe("strict");
    expect(result.questions).toHaveLength(1);
  });

  it("maps identity_mode=anonymous to identityType=anonymous", () => {
    const list = makeLoaderList({
      identity_mode: "anonymous",
      identity_field: "email",
    });
    const result = extractFormFields(list, []);
    expect(result.identityType).toBe("anonymous");
  });

  it("maps identity_mode=identified + identity_field=email to identityType=email", () => {
    const list = makeLoaderList({
      identity_mode: "identified",
      identity_field: "email",
    });
    const result = extractFormFields(list, []);
    expect(result.identityType).toBe("email");
  });

  it("maps identity_mode=identified + identity_field=phone to identityType=phone", () => {
    const list = makeLoaderList({
      identity_mode: "identified",
      identity_field: "phone",
    });
    const result = extractFormFields(list, []);
    expect(result.identityType).toBe("phone");
  });

  it("defaults identityType to email when identity_mode is undefined", () => {
    const list = makeLoaderList({
      identity_mode: undefined,
      identity_field: undefined,
    });
    const result = extractFormFields(list, []);
    expect(result.identityType).toBe("email");
  });

  it("handles null/undefined loader fields with defaults", () => {
    const list = makeLoaderList({
      hero_title: null,
      hero_subtitle: null,
      instructions: null,
      hero_cta_label: null,
      hero_cta_helper: null,
      calendar_url: null,
      redirect_url: null,
      allow_chat: null,
      allow_voice: null,
      allow_video: null,
      is_live: null,
      ai_autonomy: null,
    });
    const result = extractFormFields(list, []);

    expect(result.heroTitle).toBe("");
    expect(result.heroSubtitle).toBe("");
    expect(result.instructions).toBe("");
    expect(result.heroCtaLabel).toBe("Continue");
    expect(result.heroCtaHelper).toBe("");
    expect(result.calendarUrl).toBe("");
    expect(result.redirectUrl).toBe("");
    expect(result.allowChat).toBe(false);
    expect(result.allowVoice).toBe(false);
    expect(result.allowVideo).toBe(false);
    expect(result.isLive).toBe(false);
    expect(result.aiAutonomy).toBe("strict");
  });

  it("passes through questions array", () => {
    const questions = [makeQuestion({ id: "q1" }), makeQuestion({ id: "q2" })];
    const result = extractFormFields(makeLoaderList(), questions);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].id).toBe("q1");
    expect(result.questions[1].id).toBe("q2");
  });

  it("returns empty array when no questions provided", () => {
    const result = extractFormFields(makeLoaderList(), []);
    expect(result.questions).toEqual([]);
  });
});

// ============================================================================
// serializeToFormData
// ============================================================================

describe("serializeToFormData", () => {
  it("produces all required keys for the action", () => {
    const fields = makeFields();
    const fd = serializeToFormData(fields);

    expect(fd.name).toBe("My Survey");
    expect(fd.slug).toBe("my-survey");
    expect(fd.hero_title).toBe("Welcome");
    expect(fd.hero_subtitle).toBe("Please share");
    expect(fd.instructions).toBe("Answer honestly");
    expect(fd.hero_cta_label).toBe("Start");
    expect(fd.hero_cta_helper).toBe("Takes 2 min");
    expect(fd.allow_chat).toBe("true");
    expect(fd.allow_voice).toBe("false");
    expect(fd.allow_video).toBe("false");
    expect(fd.default_response_mode).toBe("form");
    expect(fd.is_live).toBe("true");
    expect(fd.ai_autonomy).toBe("strict");
    expect(fd.identity_type).toBe("email");
    expect(fd.description).toBe("");
  });

  it("serializes questions as JSON string", () => {
    const questions = [makeQuestion({ id: "q1" }), makeQuestion({ id: "q2" })];
    const fd = serializeToFormData(makeFields({ questions }));
    const parsed = JSON.parse(fd.questions);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe("q1");
    expect(parsed[1].id).toBe("q2");
  });

  it("stringifies boolean fields", () => {
    const fd = serializeToFormData(
      makeFields({
        allowChat: false,
        allowVoice: true,
        allowVideo: true,
        isLive: false,
      }),
    );
    expect(fd.allow_chat).toBe("false");
    expect(fd.allow_voice).toBe("true");
    expect(fd.allow_video).toBe("true");
    expect(fd.is_live).toBe("false");
  });
});

// ============================================================================
// Round-trip: extractFormFields → serializeToFormData → schema validation
// ============================================================================

describe("round-trip: loader → fields → formData → schema", () => {
  it("produces valid action payload from loader data", () => {
    const list = makeLoaderList();
    const questions = [
      makeQuestion({ id: "q1", prompt: "What do you think?" }),
    ];

    const fields = extractFormFields(list, questions);
    const fd = serializeToFormData(fields);

    const result = ResearchLinkPayloadSchema.safeParse({
      name: fd.name,
      slug: fd.slug,
      description: fd.description,
      heroTitle: fd.hero_title,
      heroSubtitle: fd.hero_subtitle,
      instructions: fd.instructions,
      heroCtaLabel: fd.hero_cta_label,
      heroCtaHelper: fd.hero_cta_helper,
      calendarUrl: fd.calendar_url,
      redirectUrl: fd.redirect_url,
      allowChat: fd.allow_chat,
      allowVoice: fd.allow_voice,
      allowVideo: fd.allow_video,
      defaultResponseMode: fd.default_response_mode,
      isLive: fd.is_live,
      questions: fd.questions,
    });

    expect(result.success).toBe(true);
  });

  it("preserves identity type through round-trip for each variant", () => {
    for (const [mode, field, expected] of [
      ["anonymous", "email", "anonymous"],
      ["identified", "email", "email"],
      ["identified", "phone", "phone"],
    ] as const) {
      const list = makeLoaderList({
        identity_mode: mode,
        identity_field: field,
      });
      const fields = extractFormFields(list, [makeQuestion()]);
      expect(fields.identityType).toBe(expected);

      const fd = serializeToFormData(fields);
      expect(fd.identity_type).toBe(expected);
    }
  });

  it("preserves all modality settings through round-trip", () => {
    const list = makeLoaderList({
      allow_chat: true,
      allow_voice: true,
      allow_video: true,
      default_response_mode: "voice",
      ai_autonomy: "adaptive",
    });
    const fields = extractFormFields(list, [makeQuestion()]);
    const fd = serializeToFormData(fields);

    expect(fd.allow_chat).toBe("true");
    expect(fd.allow_voice).toBe("true");
    expect(fd.allow_video).toBe("true");
    expect(fd.default_response_mode).toBe("voice");
    expect(fd.ai_autonomy).toBe("adaptive");
  });
});

// ============================================================================
// Dirty map overlay behavior (unit test of merge logic)
// ============================================================================

describe("dirty map overlay semantics", () => {
  it("dirty fields override loader fields via object spread", () => {
    const loaderFields = makeFields({ name: "Original Name" });
    const dirtyMap: Partial<SurveyFormFields> = { name: "Edited Name" };
    const merged = { ...loaderFields, ...dirtyMap } as SurveyFormFields;

    expect(merged.name).toBe("Edited Name");
    // Non-dirty fields pass through from loader
    expect(merged.slug).toBe("my-survey");
    expect(merged.heroTitle).toBe("Welcome");
  });

  it("empty dirty map yields loader values unchanged", () => {
    const loaderFields = makeFields({ name: "From Loader" });
    const dirtyMap: Partial<SurveyFormFields> = {};
    const merged = { ...loaderFields, ...dirtyMap } as SurveyFormFields;

    expect(merged.name).toBe("From Loader");
  });

  it("multiple dirty fields all override their respective loader values", () => {
    const loaderFields = makeFields();
    const dirtyMap: Partial<SurveyFormFields> = {
      name: "New Name",
      heroTitle: "New Title",
      allowChat: false,
    };
    const merged = { ...loaderFields, ...dirtyMap } as SurveyFormFields;

    expect(merged.name).toBe("New Name");
    expect(merged.heroTitle).toBe("New Title");
    expect(merged.allowChat).toBe(false);
    // Untouched fields remain
    expect(merged.slug).toBe("my-survey");
    expect(merged.isLive).toBe(true);
  });

  it("after clearing dirty map, fresh loader values show through", () => {
    const freshLoaderFields = makeFields({ name: "Updated From Server" });
    const clearedDirtyMap: Partial<SurveyFormFields> = {};
    const merged = {
      ...freshLoaderFields,
      ...clearedDirtyMap,
    } as SurveyFormFields;

    expect(merged.name).toBe("Updated From Server");
  });
});
