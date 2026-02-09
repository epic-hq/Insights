/**
 * Maps evidence items to transcript utterance positions.
 * Used by the EvidenceVerificationDrawer to highlight evidence
 * within transcript context.
 */
import type { NormalizedUtterance } from "~/utils/transcript/normalizeUtterances";

interface EvidenceAnchor {
  start_ms?: number | null;
  startMs?: number | null;
  start_seconds?: number | null;
  startSeconds?: number | null;
  start_sec?: number | null;
  start?: number | string | null;
  start_time?: number | string | null;
  end_ms?: number | null;
  endMs?: number | null;
  end_seconds?: number | null;
  endSeconds?: number | null;
  end_sec?: number | null;
  end?: number | string | null;
  end_time?: number | string | null;
}

export interface EvidenceTimeRange {
  evidenceId: string;
  startSec: number;
  endSec: number | null;
}

/**
 * Extract start/end seconds from an evidence anchor, handling multiple formats.
 */
function parseAnchorTime(
  raw: number | string | null | undefined,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 500 ? raw / 1000 : raw;
  }
  if (typeof raw === "string") {
    if (raw.endsWith("ms")) {
      return Number.parseFloat(raw.replace("ms", "")) / 1000;
    }
    if (raw.includes(":")) {
      const parts = raw.split(":").map((p) => Number.parseFloat(p));
      if (parts.length === 2 && parts.every((p) => Number.isFinite(p))) {
        return parts[0] * 60 + parts[1];
      }
    }
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? (num > 500 ? num / 1000 : num) : null;
  }
  return null;
}

/**
 * Extract time range from an evidence item's anchors array.
 */
export function extractEvidenceTimeRange(
  evidenceId: string,
  anchors: unknown,
): EvidenceTimeRange | null {
  const arr = Array.isArray(anchors) ? (anchors as EvidenceAnchor[]) : [];
  const anchor = arr.find((a) => a && typeof a === "object");
  if (!anchor) return null;

  const startSec = parseAnchorTime(
    anchor.start_ms ??
      anchor.startMs ??
      anchor.start_seconds ??
      anchor.startSeconds ??
      anchor.start_sec ??
      anchor.start ??
      anchor.start_time,
  );

  if (startSec === null) return null;

  const endSec = parseAnchorTime(
    anchor.end_ms ??
      anchor.endMs ??
      anchor.end_seconds ??
      anchor.endSeconds ??
      anchor.end_sec ??
      anchor.end ??
      anchor.end_time,
  );

  return { evidenceId, startSec, endSec };
}

/**
 * Find which utterance indices overlap with a given evidence time range.
 */
export function findOverlappingUtterances(
  range: EvidenceTimeRange,
  utterances: NormalizedUtterance[],
): number[] {
  const indices: number[] = [];
  const end = range.endSec ?? range.startSec + 5; // default 5s window

  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    // Overlap check: utterance overlaps if it starts before range ends AND ends after range starts
    if (u.start < end + 0.5 && u.end > range.startSec - 0.5) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Build a map of utterance index → evidence IDs that reference it.
 * Used for highlighting all evidence across the full transcript.
 */
export function buildUtteranceEvidenceMap(
  evidenceItems: Array<{ id: string; anchors: unknown }>,
  utterances: NormalizedUtterance[],
): Map<number, string[]> {
  const map = new Map<number, string[]>();

  for (const item of evidenceItems) {
    const range = extractEvidenceTimeRange(item.id, item.anchors);
    if (!range) continue;

    const indices = findOverlappingUtterances(range, utterances);
    for (const idx of indices) {
      const existing = map.get(idx);
      if (existing) {
        existing.push(item.id);
      } else {
        map.set(idx, [item.id]);
      }
    }
  }

  return map;
}

/**
 * Find the best utterance index to scroll to for a given evidence item.
 */
export function findBestUtteranceIndex(
  range: EvidenceTimeRange,
  utterances: NormalizedUtterance[],
): number {
  // Find the utterance whose start is closest to the evidence start
  let bestIdx = 0;
  let bestDist = Infinity;

  for (let i = 0; i < utterances.length; i++) {
    const dist = Math.abs(utterances[i].start - range.startSec);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}
