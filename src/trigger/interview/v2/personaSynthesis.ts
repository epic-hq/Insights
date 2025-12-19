/**
 * Persona Synthesis Utilities
 *
 * Types and utilities for processing persona facets derived from evidence.
 * Handles the Phase 2 DerivePersonaFacetsFromEvidence BAML call output
 * and preparation of facet observations for persistence.
 */

import type { PersonFacetObservation } from "~/../baml_client/types";

/**
 * Persona facet as returned by DerivePersonaFacetsFromEvidence.
 */
export interface PersonaFacet {
  person_key: string;
  kind_slug: string;
  value: string;
  confidence?: number;
  frequency?: number;
  reasoning?: string;
  evidence_refs?: number[];
  facet_account_id?: number;
}

/**
 * Output from DerivePersonaFacetsFromEvidence BAML call.
 */
export interface PersonaSynthesisResult {
  persona_facets: PersonaFacet[];
}

/**
 * Input for persisting facet observations for a person.
 */
export interface PersonFacetObservationInput {
  personId: string;
  facets: PersonFacetObservation[];
  scales: PersonScaleObservation[];
}

/**
 * Scale observation (numeric rating) for a person.
 */
export interface PersonScaleObservation {
  kind_slug: string;
  score: number;
  source?: string;
  evidence_unit_index?: number;
}

/**
 * Group persona facets by person_key for efficient lookup.
 * Returns a map of person_key -> array of persona facets.
 */
export function groupPersonaFacetsByPersonKey(
  personaFacets: PersonaFacet[] | undefined,
): Map<string, PersonaFacet[]> {
  const byPersonKey = new Map<string, PersonaFacet[]>();

  if (!personaFacets) return byPersonKey;

  for (const facet of personaFacets) {
    if (!facet.person_key) continue;
    const facets = byPersonKey.get(facet.person_key) ?? [];
    if (!byPersonKey.has(facet.person_key)) {
      byPersonKey.set(facet.person_key, facets);
    }
    facets.push(facet);
  }

  return byPersonKey;
}

/**
 * Convert a persona facet to a PersonFacetObservation for persistence.
 */
export function personaFacetToObservation(
  pf: PersonaFacet,
): PersonFacetObservation {
  const evidenceIndices = Array.isArray(pf.evidence_refs)
    ? pf.evidence_refs
    : [];
  const primaryEvidenceIndex = evidenceIndices[0] ?? undefined;

  const observation: PersonFacetObservation = {
    kind_slug: pf.kind_slug,
    value: pf.value,
    source: "interview",
    evidence_unit_index: primaryEvidenceIndex,
    confidence: typeof pf.confidence === "number" ? pf.confidence : 0.8,
    notes: pf.reasoning ? [pf.reasoning] : undefined,
    facet_account_id: pf.facet_account_id ?? undefined,
  };

  // Add candidate info for new facets not in catalog
  if (!pf.facet_account_id) {
    observation.candidate = {
      kind_slug: pf.kind_slug,
      label: pf.value,
      synonyms: [],
      notes: pf.reasoning
        ? [
            `Frequency: ${pf.frequency ?? 1}, Evidence refs: ${evidenceIndices.join(", ")}`,
          ]
        : undefined,
    };
  }

  return observation;
}

/**
 * Build facet observations from persona synthesis and fallback mentions.
 * Combines Phase 2 synthesized facets with Phase 1 raw mentions for completeness.
 */
export function buildFacetObservations(
  personaFacets: PersonaFacet[],
  fallbackMentions: Array<{
    kindSlug: string;
    label: string;
    facetAccountId: number;
    quote: string | null;
    evidenceIndex: number;
  }>,
): PersonFacetObservation[] {
  const observations: PersonFacetObservation[] = [];
  const existingFacetAccountIds = new Set<number>();
  const existingKindValueKeys = new Set<string>();

  // First, add Phase 2 synthesized facets
  for (const pf of personaFacets) {
    if (!pf.kind_slug || !pf.value) continue;
    const obs = personaFacetToObservation(pf);
    observations.push(obs);

    if (pf.facet_account_id) {
      existingFacetAccountIds.add(pf.facet_account_id);
    }
    existingKindValueKeys.add(
      `${pf.kind_slug.toLowerCase()}|${pf.value.toLowerCase()}`,
    );
  }

  // Then add fallback mentions not already covered
  for (const mention of fallbackMentions) {
    if (existingFacetAccountIds.has(mention.facetAccountId)) continue;
    const key = `${mention.kindSlug.toLowerCase()}|${mention.label.toLowerCase()}`;
    if (existingKindValueKeys.has(key)) continue;

    existingFacetAccountIds.add(mention.facetAccountId);
    existingKindValueKeys.add(key);

    observations.push({
      kind_slug: mention.kindSlug,
      value: mention.label,
      source: "interview",
      evidence_unit_index: mention.evidenceIndex,
      confidence: 0.6, // Lower confidence for raw mentions
      facet_account_id: mention.facetAccountId,
      notes: mention.quote ? [mention.quote] : undefined,
    });
  }

  return observations;
}
