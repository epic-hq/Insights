import { describe, expect, it } from "vitest";
import {
	buildHowtoContractPatchText,
	buildHowtoFallbackResponse,
	evaluateHowtoResponseContract,
} from "./howto-contract";

describe("howto-contract", () => {
	it("marks incomplete responses as failing contract", () => {
		const quality = evaluateHowtoResponseContract("Do this first.");
		expect(quality.passes).toBe(false);
		expect(quality.isNonEmpty).toBe(true);
		expect(quality.missingSections.length).toBeGreaterThan(0);
	});

	it("patches missing sections and links into response", () => {
		const seed = "Start with a narrow test.";
		const patch = buildHowtoContractPatchText(seed, "acct-1", "project-1");
		expect(patch).toBeTruthy();

		const merged = `${seed}${patch ?? ""}`;
		const quality = evaluateHowtoResponseContract(merged);
		expect(quality.passes).toBe(true);
	});

	it("generates fallback that satisfies contract", () => {
		const fallback = buildHowtoFallbackResponse("acct-1", "project-1");
		const quality = evaluateHowtoResponseContract(fallback);
		expect(quality.passes).toBe(true);
	});
});
