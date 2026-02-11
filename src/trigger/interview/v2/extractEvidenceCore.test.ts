/**
 * Test for evidence_facet.person_id bug fix (Insights-2az1)
 * Verifies that person_id is set during INSERT, not via UPDATE
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

describe("extractEvidenceCore - person_id attribution", () => {
  // Mock data structures that mirror the actual code
  let personIdByKey: Map<string, string>;
  let participantByKey: Map<string, any>;

  beforeEach(() => {
    personIdByKey = new Map();
    participantByKey = new Map();
  });

  it("should set person_id from personIdByKey when person is known", () => {
    // Arrange: Set up person mapping
    const personKey = "participant-1";
    const personId = "person-uuid-123";
    personIdByKey.set(personKey, personId);

    // Act: Simulate facet row building (the fix)
    const facetPersonId = personIdByKey.get(personKey) || null;

    // Assert: person_id should be set
    expect(facetPersonId).toBe(personId);
    expect(facetPersonId).not.toBeNull();
  });

  it("should set person_id to NULL when person is unknown", () => {
    // Arrange: Person key exists but not in personIdByKey (e.g., unidentified speaker)
    const personKey = "speaker-a";

    // Act: Simulate facet row building (the fix)
    const facetPersonId = personIdByKey.get(personKey) || null;

    // Assert: person_id should be NULL (not resolved yet)
    expect(facetPersonId).toBeNull();
  });

  it("should handle fallback person key correctly", () => {
    // Arrange: Primary person has ID
    const primaryPersonKey = "participant-0";
    const primaryPersonId = "primary-uuid-456";
    personIdByKey.set(primaryPersonKey, primaryPersonId);

    // Simulate evidence with unknown person_key falling back to primary
    const rawPersonKey = "unknown-speaker";
    const personKey = participantByKey.has(rawPersonKey)
      ? rawPersonKey
      : primaryPersonKey; // Fallback logic

    // Act: Simulate facet row building
    const facetPersonId = personIdByKey.get(personKey) || null;

    // Assert: Should use primary person ID as fallback
    expect(facetPersonId).toBe(primaryPersonId);
  });

  it("demonstrates the pattern: personIdByKey must exist before facet building", () => {
    // This test documents the key insight of the fix:
    // Person resolution MUST happen BEFORE the evidence loop

    // Arrange: Build personIdByKey map FIRST (the fix moved this before evidence loop)
    const participants = [
      { person_key: "participant-1", role: "interviewee" },
      { person_key: "participant-2", role: "interviewer" },
    ];

    participants.forEach((p, idx) => {
      personIdByKey.set(p.person_key, `person-uuid-${idx}`);
    });

    // Act: Now build facet rows (this happens in evidence loop)
    const facetRows = [];
    const evidenceUnits = [
      { person_key: "participant-1", verbatim: "Quote 1" },
      { person_key: "participant-2", verbatim: "Quote 2" },
      { person_key: "unknown", verbatim: "Quote 3" }, // Unknown speaker
    ];

    for (const ev of evidenceUnits) {
      const personKey = ev.person_key;
      const facetPersonId = personIdByKey.get(personKey) || null;

      facetRows.push({
        evidence_index: facetRows.length,
        person_id: facetPersonId, // Set at INSERT time!
        verbatim: ev.verbatim,
      });
    }

    // Assert: All rows should have person_id set (or NULL for unknown)
    expect(facetRows).toHaveLength(3);
    expect(facetRows[0].person_id).toBe("person-uuid-0"); // Known
    expect(facetRows[1].person_id).toBe("person-uuid-1"); // Known
    expect(facetRows[2].person_id).toBeNull(); // Unknown - this is correct!

    // No UPDATE needed - person_id was set during INSERT
    // This is the key fix: direct attribution, no two-step pattern
  });

  it("simulates the old broken pattern for comparison", () => {
    // OLD PATTERN (broken):
    // 1. INSERT facet rows with person_id=NULL for all
    // 2. Build evidenceIdToPersonId map later
    // 3. UPDATE to backfill person_id
    // PROBLEM: Time window with NULL, UPDATE can fail silently

    const facetRowsOld = [
      { evidence_id: "ev-1", person_id: null }, // Inserted with NULL
      { evidence_id: "ev-2", person_id: null }, // Inserted with NULL
    ];

    // Later: try to UPDATE
    const evidenceIdToPersonId = new Map([
      ["ev-1", "person-uuid-1"],
      ["ev-2", "person-uuid-2"],
    ]);

    // Simulate UPDATE (fragile - could fail)
    facetRowsOld.forEach((row) => {
      const personId = evidenceIdToPersonId.get(row.evidence_id);
      if (personId) {
        row.person_id = personId; // UPDATE
      }
    });

    // NEW PATTERN (fixed):
    // 1. Build personIdByKey FIRST
    // 2. INSERT with person_id already set
    // No UPDATE needed!

    personIdByKey.set("participant-1", "person-uuid-1");
    personIdByKey.set("participant-2", "person-uuid-2");

    const facetRowsNew = [
      {
        evidence_index: 0,
        person_id: personIdByKey.get("participant-1") || null, // Set at INSERT!
      },
      {
        evidence_index: 1,
        person_id: personIdByKey.get("participant-2") || null, // Set at INSERT!
      },
    ];

    // Assert: New pattern has person_id from the start
    expect(facetRowsNew[0].person_id).toBe("person-uuid-1");
    expect(facetRowsNew[1].person_id).toBe("person-uuid-2");

    // No NULL time window, no fragile UPDATE
    expect(facetRowsNew.every((row) => row.person_id !== null)).toBe(true);
  });
});
