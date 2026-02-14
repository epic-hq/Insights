import { describe, expect, it } from "vitest";
import { shouldExecuteStep, errorMessage } from "./state";
import type { WorkflowState, WorkflowStep } from "./types";

// =============================================================================
// shouldExecuteStep — pure function, no DB
// =============================================================================
describe("shouldExecuteStep", () => {
	const baseState: WorkflowState = {
		interviewId: "test-id",
		completedSteps: [],
		currentStep: "upload",
		lastUpdated: new Date().toISOString(),
	};

	it("executes step when no resume point and step not completed", () => {
		expect(shouldExecuteStep("upload", undefined, baseState)).toBe(true);
		expect(shouldExecuteStep("evidence", undefined, baseState)).toBe(true);
		expect(shouldExecuteStep("finalize", undefined, baseState)).toBe(true);
	});

	it("skips steps before the resume point", () => {
		expect(shouldExecuteStep("upload", "evidence", baseState)).toBe(false);
		expect(shouldExecuteStep("evidence", "evidence", baseState)).toBe(true);
		expect(shouldExecuteStep("insights", "evidence", baseState)).toBe(true);
	});

	it("skips already completed steps", () => {
		const state: WorkflowState = {
			...baseState,
			completedSteps: ["upload", "evidence"],
		};
		expect(shouldExecuteStep("upload", undefined, state)).toBe(false);
		expect(shouldExecuteStep("evidence", undefined, state)).toBe(false);
		expect(shouldExecuteStep("insights", undefined, state)).toBe(true);
	});

	it("re-executes a completed step when resumeFrom targets it", () => {
		const state: WorkflowState = {
			...baseState,
			completedSteps: ["upload", "evidence"],
		};
		// Resuming from "evidence" should re-run it even though it's completed
		expect(shouldExecuteStep("evidence", "evidence", state)).toBe(true);
	});

	it("respects full step order", () => {
		const steps: WorkflowStep[] = [
			"upload",
			"evidence",
			"enrich-person",
			"insights",
			"personas",
			"answers",
			"finalize",
		];

		// Resume from "insights" — only insights and later should execute
		for (const step of steps) {
			const expected =
				steps.indexOf(step) >= steps.indexOf("insights");
			expect(shouldExecuteStep(step, "insights", baseState)).toBe(expected);
		}
	});

	it("handles resumeFrom at the first step", () => {
		expect(shouldExecuteStep("upload", "upload", baseState)).toBe(true);
		expect(shouldExecuteStep("evidence", "upload", baseState)).toBe(true);
	});

	it("handles resumeFrom at the last step", () => {
		expect(shouldExecuteStep("upload", "finalize", baseState)).toBe(false);
		expect(shouldExecuteStep("answers", "finalize", baseState)).toBe(false);
		expect(shouldExecuteStep("finalize", "finalize", baseState)).toBe(true);
	});
});

// =============================================================================
// errorMessage — pure function
// =============================================================================
describe("errorMessage", () => {
	it("extracts message from Error instances", () => {
		expect(errorMessage(new Error("test error"))).toBe("test error");
	});

	it("converts non-Error values to string", () => {
		expect(errorMessage("string error")).toBe("string error");
		expect(errorMessage(42)).toBe("42");
		expect(errorMessage(null)).toBe("null");
		expect(errorMessage(undefined)).toBe("undefined");
	});

	it("handles objects", () => {
		expect(errorMessage({ code: "FAIL" })).toBe("[object Object]");
	});
});
