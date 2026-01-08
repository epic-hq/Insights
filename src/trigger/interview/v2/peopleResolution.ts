/**
 * People Resolution Utilities
 *
 * Functions for normalizing, parsing, and resolving people from
 * interview transcripts. Handles:
 * - Name parsing and normalization
 * - Generic/placeholder person detection
 * - Fallback name generation
 * - Speaker label normalization
 */

import type {
  PersonFacetInput,
  PersonScaleInput,
} from "~/../baml_client/types";

/**
 * Interview metadata needed for people resolution.
 * Subset of the full InterviewMetadata from extractEvidenceCore.
 */
export interface InterviewMetadataForPeople {
  accountId: string;
  userId?: string;
  projectId?: string;
  interviewTitle?: string;
  interviewDate?: string;
  interviewerName?: string;
  participantName?: string;
  segment?: string;
  durationMin?: number;
  fileName?: string;
}

/**
 * Patterns that indicate a generic/placeholder person label.
 * These should not be upserted as real people records.
 */
const GENERIC_PERSON_LABEL_PATTERNS: RegExp[] = [
  /^(participant|person|speaker|customer|interviewee|user|client|respondent|guest|attendee)(?:[\s_-]*(\d+|[a-z]))?$/i,
  /^(interviewer|moderator|facilitator)(?:[\s_-]*(\d+|[a-z]))?$/i,
  /^(participant|speaker)\s*(one|two|three|first|second|third)$/i,
];

/**
 * Check if a label is a generic person placeholder.
 * Generic labels like "Participant 1" or "Speaker A" should not
 * create real people records.
 */
export function isGenericPersonLabel(
  label: string | null | undefined,
): boolean {
  if (!label) return false;
  const normalized = label.trim().toLowerCase();
  if (!normalized.length) return false;
  return GENERIC_PERSON_LABEL_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

/**
 * Parse a full name into firstname and lastname.
 * Returns { firstname, lastname } with lastname being null for single-word names.
 */
export function parseFullName(fullName: string): {
  firstname: string;
  lastname: string | null;
} {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstname: "", lastname: null };

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstname: parts[0], lastname: null };
  }

  // firstname is the first part, lastname is everything else joined
  return {
    firstname: parts[0],
    lastname: parts.slice(1).join(" "),
  };
}

/**
 * Check if a string looks like a date/timestamp that shouldn't be used as a name.
 * Examples: "Jan-08 07:45 pm", "2024-01-08", "January 8, 2024"
 */
function looksLikeDateOrTimestamp(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  // Date patterns: "jan-08", "jan 08", "january 8", "2024-01-08", "01/08/2024"
  const datePatterns = [
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s\-]?\d{1,2}/i,
    /^\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}/,
    /^\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4}/,
    /\d{1,2}:\d{2}/, // Time patterns: "07:45", "7:45 pm"
  ];
  return datePatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Generate a fallback person name from interview metadata.
 * Uses filename, title, or timestamp as fallback.
 * Avoids using date/timestamp strings as person names.
 */
export function generateFallbackPersonName(
  metadata: InterviewMetadataForPeople,
): string {
  if (metadata.fileName) {
    const nameFromFile = metadata.fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();

    // Don't use filename if it looks like a date/timestamp
    if (nameFromFile.length > 0 && !looksLikeDateOrTimestamp(nameFromFile)) {
      return nameFromFile;
    }
  }
  if (
    metadata.interviewTitle &&
    !metadata.interviewTitle.includes("Interview -") &&
    !looksLikeDateOrTimestamp(metadata.interviewTitle)
  ) {
    return metadata.interviewTitle;
  }
  // Final fallback: generic participant name (not a date)
  return `Participant ${new Date().toISOString().split("T")[0]}`;
}

/**
 * Humanize a person_key or identifier into a readable name.
 * Converts underscores/hyphens to spaces and title-cases.
 */
export function humanizeKey(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const capitalized = cleaned
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
  if (!capitalized.length) return null;
  return capitalized;
}

/**
 * Sanitize a person_key from BAML output.
 * Returns the trimmed value or fallback if empty/invalid.
 */
export function sanitizePersonKey(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length) return trimmed;
  }
  return fallback;
}

/**
 * Coerce a value to a string or null.
 * Used for normalizing BAML output fields.
 */
export function coerceString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

/**
 * Source of a resolved person name.
 */
export type NameResolutionSource =
  | "display"
  | "inferred"
  | "metadata"
  | "person_key"
  | "fallback";

/**
 * Normalized participant data extracted from BAML output.
 */
export interface NormalizedParticipant {
  person_key: string;
  speaker_label: string | null; // AssemblyAI speaker label (e.g., "SPEAKER A")
  role: string | null;
  display_name: string | null;
  inferred_name: string | null;
  organization: string | null;
  summary: string | null;
  segments: string[];
  personas: string[];
  facets: PersonFacetInput[];
  scales: PersonScaleInput[];
}

/**
 * Resolve a display name from multiple candidate sources.
 * Priority: display_name > inferred_name > person_key > metadata > fallback
 */
export function resolveName(
  participant: NormalizedParticipant,
  index: number,
  metadata: InterviewMetadataForPeople,
): { name: string; source: NameResolutionSource } {
  const candidates: Array<{
    value: string | null | undefined;
    source: NameResolutionSource;
  }> = [
    { value: participant.display_name, source: "display" },
    { value: participant.inferred_name, source: "inferred" },
    {
      value: participant.person_key
        ? humanizeKey(participant.person_key)
        : null,
      source: "person_key",
    },
    { value: metadata.participantName, source: "metadata" },
    { value: metadata.interviewerName, source: "metadata" },
  ];
  for (const candidate of candidates) {
    if (typeof candidate.value === "string") {
      const trimmed = candidate.value.trim();
      if (trimmed.length) {
        return { name: trimmed, source: candidate.source };
      }
    }
  }
  return { name: `Participant ${index + 1}`, source: "fallback" };
}
