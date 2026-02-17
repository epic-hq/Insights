/**
 * Types for the Insights "By Theme" story-driven page (Phase A).
 *
 * ── Signal Level Criteria ──
 * Computed in themes.tsx loader by sorting all themes by signal_strength (descending):
 *   "high"   → top 33%    → badge "High Signal"  (red)     — strongest patterns
 *   "medium" → middle 33% → badge "Investigate"   (yellow)  — moderate, worth digging in
 *   "low"    → bottom 33% → badge "Monitor"       (green)   — weakest, keep an eye on
 * signal_strength = evidence_count × person_count
 *
 * ── Trend Criteria ──
 * Computed in db.ts getTrendingData() comparing last 14 days vs prior 14 days:
 *   "growing" → recent > prior × 1.2       → badge "↑ Growing"  — accelerating
 *   "fading"  → recent < prior × 0.8       → badge "↓ Fading"   — decelerating
 *   "stable"  → else (or no prior window)  → badge "→ Stable"   — steady state
 * If all data was bulk-uploaded (no prior window), defaults to "stable".
 *
 * ── Weak Signal Criteria ──
 * signal_level === "low" AND evidence_count >= 3 → blind spot (low breadth, needs validation)
 */
import type { InsightView } from "~/types";

export interface ThemeSignal {
  /** evidence_count × person_count */
  signal_strength: number;
  /** Top 33% = "high", middle = "medium", bottom = "low" */
  signal_level: "high" | "medium" | "low";
  /** 14-day window comparison: "growing" | "stable" | "fading" */
  trend: "growing" | "stable" | "fading";
  breadth: { covered: number; total: number };
  top_voices: Array<{ id: string; name: string; title: string | null }>;
}

export type ThemeWithSignal = InsightView &
  ThemeSignal & {
    evidence_count: number;
    person_count: number;
  };

export interface WeakSignal {
  theme: ThemeWithSignal;
  reason: string;
}

export interface SuggestedAction {
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
  cta: string;
  href?: string;
}
