import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	buildDataUpdate,
	buildDismiss,
	buildSingleComponentSurface,
	isA2UIToolPayload,
	withA2UI,
} from "../tool-helpers";

describe("tool-helpers", () => {
	describe("buildSingleComponentSurface", () => {
		it("produces 3 messages: surfaceUpdate → dataModelUpdate → beginRendering", () => {
			const payload = buildSingleComponentSurface({
				surfaceId: "thread-123",
				componentType: "InterviewPrompts",
				data: { title: "Test", prompts: [] },
			});

			expect(payload.__a2ui).toBe(true);
			expect(payload.surfaceId).toBe("thread-123");
			expect(payload.messages).toHaveLength(3);
			expect(payload.messages[0].type).toBe("surfaceUpdate");
			expect(payload.messages[1].type).toBe("dataModelUpdate");
			expect(payload.messages[2].type).toBe("beginRendering");
		});

		it("uses componentType as root component key", () => {
			const payload = buildSingleComponentSurface({
				surfaceId: "s1",
				componentType: "BANTScorecard",
				data: { scores: {} },
			});

			const surfaceUpdate = payload.messages[0];
			if (surfaceUpdate.type === "surfaceUpdate") {
				expect(surfaceUpdate.components[0].component).toHaveProperty("BANTScorecard");
			}
		});

		it("places data under /data path in data model", () => {
			const testData = { title: "Interview", prompts: [{ id: "1", text: "Q1" }] };
			const payload = buildSingleComponentSurface({
				surfaceId: "s1",
				componentType: "InterviewPrompts",
				data: testData,
			});

			const dataUpdate = payload.messages[1];
			if (dataUpdate.type === "dataModelUpdate") {
				expect(dataUpdate.data).toEqual({ data: testData });
			}
		});
	});

	describe("buildDataUpdate", () => {
		it("produces a single dataModelUpdate message", () => {
			const payload = buildDataUpdate({
				surfaceId: "s1",
				data: { prompts: [{ id: "1", text: "Updated" }] },
			});

			expect(payload.__a2ui).toBe(true);
			expect(payload.messages).toHaveLength(1);
			expect(payload.messages[0].type).toBe("dataModelUpdate");
		});
	});

	describe("buildDismiss", () => {
		it("produces a deleteSurface message", () => {
			const payload = buildDismiss("s1");
			expect(payload.messages).toHaveLength(1);
			expect(payload.messages[0].type).toBe("deleteSurface");
		});
	});

	describe("isA2UIToolPayload", () => {
		it("detects valid A2UI payloads", () => {
			const result = {
				success: true,
				a2ui: buildSingleComponentSurface({
					surfaceId: "s1",
					componentType: "Test",
					data: {},
				}),
			};
			expect(isA2UIToolPayload(result)).toBe(true);
		});

		it("rejects non-A2UI payloads", () => {
			expect(isA2UIToolPayload(null)).toBe(false);
			expect(isA2UIToolPayload({})).toBe(false);
			expect(isA2UIToolPayload({ a2ui: {} })).toBe(false);
			expect(isA2UIToolPayload({ a2ui: { __a2ui: false } })).toBe(false);
		});
	});

	describe("withA2UI (Mastra passthrough proof)", () => {
		const baseSchema = z.object({
			success: z.boolean(),
			message: z.string(),
		});

		it("plain z.object strips unknown keys (simulates Mastra bug)", () => {
			const output = {
				success: true,
				message: "done",
				a2ui: { __a2ui: true, surfaceId: "s1", messages: [] },
			};

			const result = baseSchema.safeParse(output);
			expect(result.success).toBe(true);
			if (result.success) {
				// Zod strips the a2ui field!
				expect(result.data).not.toHaveProperty("a2ui");
			}
		});

		it("withA2UI preserves the a2ui field through Zod safeParse", () => {
			const extendedSchema = withA2UI(baseSchema);
			const a2uiPayload = buildSingleComponentSurface({
				surfaceId: "s1",
				componentType: "InterviewPrompts",
				data: { title: "Test" },
			});

			const output = {
				success: true,
				message: "done",
				a2ui: a2uiPayload,
			};

			const result = extendedSchema.safeParse(output);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveProperty("a2ui");
				expect(result.data.a2ui?.__a2ui).toBe(true);
				expect(result.data.a2ui?.surfaceId).toBe("s1");
				expect(result.data.a2ui?.messages).toHaveLength(3);
			}
		});

		it("withA2UI still works when a2ui is omitted", () => {
			const extendedSchema = withA2UI(baseSchema);
			const output = { success: true, message: "no ui" };

			const result = extendedSchema.safeParse(output);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.a2ui).toBeUndefined();
			}
		});
	});
});
