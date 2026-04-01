import { describe, expect, it } from "vitest";
import {
	DEFAULT_EVIDENCE_LINK_THRESHOLD,
	DEFAULT_THEME_DEDUP_THRESHOLD,
	getProjectAnalysisSettings,
} from "./analysisSettings";

describe("getProjectAnalysisSettings", () => {
	it("returns stricter defaults when project settings are missing", () => {
		expect(getProjectAnalysisSettings(null)).toEqual({
			theme_dedup_threshold: DEFAULT_THEME_DEDUP_THRESHOLD,
			evidence_link_threshold: DEFAULT_EVIDENCE_LINK_THRESHOLD,
		});
	});

	it("reads configured analysis thresholds from project settings", () => {
		expect(
			getProjectAnalysisSettings({
				analysis: {
					theme_dedup_threshold: 0.9,
					evidence_link_threshold: 0.6,
				},
			})
		).toEqual({
			theme_dedup_threshold: 0.9,
			evidence_link_threshold: 0.6,
		});
	});

	it("clamps invalid values into supported ranges", () => {
		expect(
			getProjectAnalysisSettings({
				analysis: {
					theme_dedup_threshold: 1.2,
					evidence_link_threshold: "0.1",
				},
			})
		).toEqual({
			theme_dedup_threshold: 0.95,
			evidence_link_threshold: 0.2,
		});
	});
});
