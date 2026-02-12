/**
 * Shared person attribution logic for evidence ingestion.
 *
 * TrustCore: All ingestion paths MUST use this module to ensure
 * evidence_facet.person_id and evidence_people stay consistent.
 *
 * CRITICAL: Set person_id at INSERT time, never via UPDATE after the fact.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/types";

export interface PersonAttributionContext {
  /** Map of person_key (from BAML/transcript) to database person_id */
  personIdByKey: Map<string, string>;
  /** Map of speaker_label (e.g., "SPEAKER A") to database person_id */
  speakerLabelToPersonId: Map<string, string>;
  /** Map of person_id back to person_key for reverse lookup */
  keyByPersonId: Map<string, string>;
}

/**
 * Resolve person_id for a given person_key or speaker_label.
 *
 * Returns person_id to be set at INSERT time for evidence_facet rows.
 *
 * @param personKey - BAML person_key or speaker label from transcript
 * @param context - Attribution context with person mappings
 * @param fallbackPersonId - Fallback if no match found (usually primary participant)
 * @returns person_id to use for evidence_facet.person_id, or null if no match
 */
export function resolvePersonIdForEvidence(
  personKey: string | null | undefined,
  context: PersonAttributionContext,
  fallbackPersonId?: string | null,
): string | null {
  if (!personKey) return fallbackPersonId ?? null;

  // Try direct person_key lookup first
  const directMatch = context.personIdByKey.get(personKey);
  if (directMatch) return directMatch;

  // Try speaker_label lookup (e.g., "SPEAKER A" -> person_id)
  const speakerMatch = context.speakerLabelToPersonId.get(
    personKey.toUpperCase(),
  );
  if (speakerMatch) return speakerMatch;

  // Try normalized speaker label (e.g., "A" -> "SPEAKER A")
  const normalizedKey = personKey.toUpperCase().replace(/^SPEAKER\s+/, "");
  if (normalizedKey && normalizedKey !== personKey.toUpperCase()) {
    const normalizedMatch = context.speakerLabelToPersonId.get(
      `SPEAKER ${normalizedKey}`,
    );
    if (normalizedMatch) return normalizedMatch;
  }

  return fallbackPersonId ?? null;
}

/**
 * Build PersonAttributionContext from interview_people records.
 *
 * This context is used by all ingestion paths to resolve person_id
 * consistently at evidence_facet INSERT time.
 *
 * @param db - Supabase client
 * @param interviewId - Interview ID to fetch people for
 * @returns Attribution context with person mappings
 */
export async function buildPersonAttributionContext(
  db: SupabaseClient<Database>,
  interviewId: string,
): Promise<PersonAttributionContext> {
  const { data: interviewPeople } = await db
    .from("interview_people")
    .select("person_id, transcript_key, display_name, role, people(name)")
    .eq("interview_id", interviewId);

  const personIdByKey = new Map<string, string>();
  const speakerLabelToPersonId = new Map<string, string>();
  const keyByPersonId = new Map<string, string>();

  if (!interviewPeople?.length) {
    return { personIdByKey, speakerLabelToPersonId, keyByPersonId };
  }

  for (const link of interviewPeople) {
    const { person_id, transcript_key, display_name, people } = link;

    // Map transcript_key -> person_id
    if (transcript_key) {
      personIdByKey.set(transcript_key, person_id);
      keyByPersonId.set(person_id, transcript_key);

      // Also map uppercase speaker label (e.g., "SPEAKER A")
      const normalized = transcript_key.toUpperCase();
      speakerLabelToPersonId.set(normalized, person_id);

      // Map short form (e.g., "A" from "SPEAKER A")
      const shortForm = normalized.replace(/^SPEAKER\s+/, "");
      if (shortForm && shortForm !== normalized) {
        speakerLabelToPersonId.set(shortForm, person_id);
      }
    }

    // Map display_name -> person_id
    if (display_name) {
      personIdByKey.set(display_name, person_id);
    }

    // Map people.name -> person_id
    if (people?.name) {
      personIdByKey.set(people.name, person_id);
    }
  }

  return { personIdByKey, speakerLabelToPersonId, keyByPersonId };
}

/**
 * Validate parity between evidence_people and evidence_facet.person_id.
 *
 * Logs warnings when mismatches are detected - indicates drift between
 * ingestion paths or UPDATE failures.
 *
 * @param db - Supabase client
 * @param interviewId - Interview ID to validate
 * @param ingestPath - Which ingestion path triggered this (for logging)
 * @returns Object with mismatch count and whether validation passed
 */
export async function validateAttributionParity(
  db: SupabaseClient<Database>,
  interviewId: string,
  ingestPath:
    | "trigger-v2"
    | "desktop-realtime"
    | "desktop-finalize"
    | "legacy-process",
): Promise<{ mismatches: number; passed: boolean }> {
  // Get all evidence for this interview with their person attributions
  const { data: evidenceRows } = await db
    .from("evidence")
    .select("id")
    .eq("interview_id", interviewId);

  if (!evidenceRows?.length) {
    return { mismatches: 0, passed: true };
  }

  const evidenceIds = evidenceRows.map((row) => row.id);

  // Get evidence_people links
  const { data: evidencePeople } = await db
    .from("evidence_people")
    .select("evidence_id, person_id")
    .in("evidence_id", evidenceIds);

  // Get evidence_facet person_ids
  const { data: evidenceFacets } = await db
    .from("evidence_facet")
    .select("evidence_id, person_id")
    .in("evidence_id", evidenceIds)
    .not("person_id", "is", null);

  // Build maps for comparison
  const peopleByEvidence = new Map<string, Set<string>>();
  for (const link of evidencePeople ?? []) {
    const personIds = peopleByEvidence.get(link.evidence_id) ?? new Set();
    personIds.add(link.person_id);
    peopleByEvidence.set(link.evidence_id, personIds);
  }

  const facetsByEvidence = new Map<string, Set<string>>();
  for (const facet of evidenceFacets ?? []) {
    if (!facet.person_id) continue;
    const personIds = facetsByEvidence.get(facet.evidence_id) ?? new Set();
    personIds.add(facet.person_id);
    facetsByEvidence.set(facet.evidence_id, personIds);
  }

  // Check for mismatches
  let mismatches = 0;
  const mismatchDetails: Array<{
    evidenceId: string;
    peoplePids: string[];
    facetPids: string[];
  }> = [];

  for (const evidenceId of evidenceIds) {
    const peoplePids = Array.from(
      peopleByEvidence.get(evidenceId) ?? [],
    ).sort();
    const facetPids = Array.from(facetsByEvidence.get(evidenceId) ?? []).sort();

    // Check if arrays are equal
    const isEqual =
      peoplePids.length === facetPids.length &&
      peoplePids.every((pid, idx) => pid === facetPids[idx]);

    if (!isEqual) {
      mismatches++;
      mismatchDetails.push({ evidenceId, peoplePids, facetPids });
    }
  }

  if (mismatches > 0) {
    consola.warn(
      `[TrustCore] Person attribution parity check FAILED for interview ${interviewId} (path: ${ingestPath})`,
      {
        mismatches,
        totalEvidence: evidenceIds.length,
        sampleMismatches: mismatchDetails.slice(0, 5),
      },
    );
  } else {
    consola.info(
      `[TrustCore] Person attribution parity check PASSED for interview ${interviewId} (path: ${ingestPath})`,
      {
        evidenceCount: evidenceIds.length,
      },
    );
  }

  return { mismatches, passed: mismatches === 0 };
}
