/**
 * Timestamp Mapping Utilities
 *
 * Pure utility functions for extracting and resolving timestamps from
 * transcript data. Used to anchor evidence snippets to specific times
 * in the source media.
 *
 * These functions are stateless and have no database dependencies.
 */

export type WordTimelineEntry = { text: string; start: number };
export type SegmentTimelineEntry = { text: string; start: number | null };

/**
 * Coerce various timestamp formats to seconds.
 * Handles milliseconds (>500 assumed to be ms), "NNNms" strings, and "mm:ss" format.
 */
export function coerceSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 500 ? value / 1000 : value;
  }
  if (typeof value === "string") {
    if (value.endsWith("ms")) {
      const ms = Number.parseFloat(value.replace("ms", ""));
      return Number.isFinite(ms) ? ms / 1000 : null;
    }
    if (value.includes(":")) {
      const parts = value.split(":").map((part) => Number.parseFloat(part));
      if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
        return parts[0] * 60 + parts[1];
      }
    }
    const numeric = Number.parseFloat(value);
    if (Number.isFinite(numeric)) {
      return numeric > 500 ? numeric / 1000 : numeric;
    }
  }
  return null;
}

/**
 * Normalize text to lowercase tokens for fuzzy matching.
 * Strips punctuation and splits on whitespace.
 */
export function normalizeTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s']/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Normalize text for search by lowercasing, replacing smart quotes,
 * and collapsing whitespace.
 */
export function normalizeForSearchText(
  value: string | null | undefined,
): string {
  if (!value || typeof value !== "string") return "";
  const replaced = value
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\u00A0/g, " ");
  return replaced.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Build word-level timeline from transcript data.
 * Extracts individual word timing from ASR word-level data.
 */
export function buildWordTimeline(
  transcriptData: Record<string, unknown>,
): WordTimelineEntry[] {
  const wordsRaw = Array.isArray((transcriptData as any).words)
    ? ((transcriptData as any).words as any[])
    : [];
  const timeline: WordTimelineEntry[] = [];
  for (const word of wordsRaw) {
    if (!word || typeof word !== "object") continue;
    const text =
      typeof word.text === "string" ? word.text.trim().toLowerCase() : "";
    if (!text) continue;
    const start = coerceSeconds(
      (word as any).start ?? (word as any).start_ms ?? (word as any).startTime,
    );
    if (start === null) continue;
    timeline.push({ text, start });
  }
  return timeline;
}

/**
 * Build segment-level timeline from transcript data.
 * Extracts timing from utterances, segments, sentences, or speaker_transcripts.
 */
export function buildSegmentTimeline(
  transcriptData: Record<string, unknown>,
): SegmentTimelineEntry[] {
  // Include speaker_transcripts since that's where sanitized AssemblyAI utterances are stored
  const sources = [
    "utterances",
    "segments",
    "sentences",
    "speaker_transcripts",
  ] as const;
  const timeline: SegmentTimelineEntry[] = [];
  for (const key of sources) {
    const items = Array.isArray((transcriptData as any)[key])
      ? ((transcriptData as any)[key] as any[])
      : [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const text =
        typeof item.text === "string"
          ? item.text
          : typeof item.gist === "string"
            ? item.gist
            : null;
      if (!text) continue;
      const start = coerceSeconds(
        item.start ?? item.start_ms ?? item.startTime,
      );
      timeline.push({ text, start });
    }
  }
  return timeline;
}

/**
 * Find the start time (in seconds) for a text snippet.
 *
 * Uses a multi-stage fallback strategy:
 * 1. Word-level token matching (most precise)
 * 2. Segment-level substring matching
 * 3. Ratio estimation based on character position in full transcript
 */
export function findStartSecondsForSnippet({
  snippet,
  wordTimeline,
  segmentTimeline,
  fullTranscript,
  durationSeconds,
}: {
  snippet: string;
  wordTimeline: WordTimelineEntry[];
  segmentTimeline: SegmentTimelineEntry[];
  fullTranscript?: string;
  durationSeconds: number | null;
}): number | null {
  const normalizedTokens = normalizeTokens(snippet);
  const searchTokens = normalizedTokens.slice(
    0,
    Math.min(4, normalizedTokens.length),
  );

  // Stage 1: Word-level token matching
  if (searchTokens.length && wordTimeline.length) {
    const window = searchTokens.length;
    for (let i = 0; i <= wordTimeline.length - window; i++) {
      let matches = true;
      for (let j = 0; j < window; j++) {
        if (wordTimeline[i + j]?.text !== searchTokens[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return wordTimeline[i].start;
      }
    }
  }

  // Stage 2: Segment-level exact substring matching
  const normalizedSnippet = normalizeForSearchText(snippet);
  const snippetSample = normalizedSnippet.slice(0, 160);
  if (snippetSample && segmentTimeline.length) {
    for (const segment of segmentTimeline) {
      if (!segment.text) continue;
      const segmentNormalized = normalizeForSearchText(segment.text);
      if (segmentNormalized.includes(snippetSample)) {
        const start = segment.start;
        if (start !== null) return start;
      }
    }
  }

  // Stage 2b: Fuzzy word overlap matching for paraphrased evidence
  // LLMs may generate evidence text that doesn't appear verbatim but shares key words
  if (normalizedTokens.length >= 3 && segmentTimeline.length) {
    const snippetWordSet = new Set(normalizedTokens);
    let bestMatch: { start: number; score: number } | null = null;

    for (const segment of segmentTimeline) {
      if (!segment.text || segment.start === null) continue;
      const segmentTokens = normalizeTokens(segment.text);
      if (segmentTokens.length < 3) continue;

      // Count overlapping words
      let overlap = 0;
      for (const token of segmentTokens) {
        if (snippetWordSet.has(token)) overlap++;
      }

      // Require at least 40% of snippet words to match
      const score = overlap / normalizedTokens.length;
      if (score >= 0.4 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { start: segment.start, score };
      }
    }

    if (bestMatch) {
      return bestMatch.start;
    }
  }

  // Stage 3: Ratio estimation from full transcript position
  if (durationSeconds && fullTranscript) {
    const transcriptNormalized = normalizeForSearchText(fullTranscript);
    const index = transcriptNormalized.indexOf(snippetSample);
    if (index >= 0) {
      const ratio = transcriptNormalized.length
        ? index / transcriptNormalized.length
        : 0;
      const estimated = durationSeconds * ratio;
      return Number.isFinite(estimated)
        ? Math.max(0, Math.min(durationSeconds, estimated))
        : null;
    }
  }

  return null;
}
