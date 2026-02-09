/**
 * Computes default values for custom lenses (product impact, customer service,
 * pessimistic) from conversation analysis and empathy map data.
 */
import { useMemo } from "react";
import type { ConversationAnalysisForDisplay } from "../lib/parseConversationAnalysis.server";
import type { EmpathyMap } from "../lib/processEmpathyMap.server";

export type CustomLensDefaults = Record<
  string,
  { summary?: string; notes?: string; highlights?: string[] }
>;

export function useCustomLensDefaults(
  conversationAnalysis: ConversationAnalysisForDisplay | null,
  empathyMap: EmpathyMap,
  interview: {
    high_impact_themes: unknown;
    observations_and_notes: string | null;
    open_questions_and_next_steps: string | null;
  },
): CustomLensDefaults {
  return useMemo(() => {
    const firstNonEmpty = (...values: Array<string | null | undefined>) => {
      for (const value of values) {
        if (typeof value === "string" && value.trim().length > 0)
          return value.trim();
      }
      return undefined;
    };

    const highImpactThemes = Array.isArray(interview.high_impact_themes)
      ? (interview.high_impact_themes as string[]).filter(
          (item) => typeof item === "string" && item.trim().length > 0,
        )
      : [];

    const engineeringRecommendation = (
      conversationAnalysis?.recommendations ?? []
    ).find((rec) =>
      /(tech|engineering|product|integration)/i.test(
        `${rec.focusArea} ${rec.action} ${rec.rationale}`,
      ),
    );

    const empathyPains = empathyMap.pains
      .map((item) => item.text)
      .filter((text): text is string => Boolean(text?.trim()));
    const empathyFeels = empathyMap.feels
      .map((item) => item.text)
      .filter((text): text is string => Boolean(text?.trim()));
    const empathyGains = empathyMap.gains
      .map((item) => item.text)
      .filter((text): text is string => Boolean(text?.trim()));

    const openQuestions = (conversationAnalysis?.openQuestions ?? []).filter(
      (item) => item && item.trim().length > 0,
    );
    const nervousTakeaway = conversationAnalysis?.keyTakeaways.find(
      (takeaway) => takeaway.priority === "low",
    );

    return {
      productImpact: {
        summary: firstNonEmpty(
          highImpactThemes[0],
          engineeringRecommendation?.action,
          conversationAnalysis?.keyTakeaways.find(
            (takeaway) => takeaway.priority === "high",
          )?.summary,
        ),
        notes: firstNonEmpty(
          engineeringRecommendation
            ? `${engineeringRecommendation.focusArea}: ${engineeringRecommendation.action}`
            : undefined,
          interview.observations_and_notes ?? undefined,
        ),
        highlights: highImpactThemes.slice(0, 4),
      },
      customerService: {
        summary: firstNonEmpty(
          empathyPains[0],
          empathyGains[0],
          conversationAnalysis?.summary ?? undefined,
        ),
        notes: firstNonEmpty(empathyFeels[0], empathyGains[1]),
        highlights: empathyPains.slice(0, 4),
      },
      pessimistic: {
        summary: firstNonEmpty(
          openQuestions[0],
          interview.open_questions_and_next_steps ?? undefined,
        ),
        notes: firstNonEmpty(openQuestions[1], nervousTakeaway?.summary),
        highlights: openQuestions.slice(0, 4),
      },
    };
  }, [
    conversationAnalysis?.keyTakeaways,
    conversationAnalysis?.openQuestions,
    conversationAnalysis?.recommendations,
    conversationAnalysis?.summary,
    empathyMap.feels,
    empathyMap.gains,
    empathyMap.pains,
    interview.high_impact_themes,
    interview.observations_and_notes,
    interview.open_questions_and_next_steps,
  ]);
}
