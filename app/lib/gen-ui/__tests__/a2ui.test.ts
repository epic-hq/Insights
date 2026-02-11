import { describe, expect, it } from "vitest";
import { type A2UIMessage, a2uiMessageSchema, applySurfaceMessage, createEmptySurface } from "../a2ui";

describe("a2ui", () => {
	describe("createEmptySurface", () => {
		it("creates an empty surface with the given ID", () => {
			const surface = createEmptySurface("test-surface");
			expect(surface.surfaceId).toBe("test-surface");
			expect(surface.components.size).toBe(0);
			expect(surface.rootId).toBeNull();
			expect(surface.dataModel).toEqual({});
			expect(surface.ready).toBe(false);
		});
	});

	describe("applySurfaceMessage", () => {
		it("applies a surfaceUpdate — adds components", () => {
			const surface = createEmptySurface("s1");
			const msg: A2UIMessage = {
				type: "surfaceUpdate",
				surfaceId: "s1",
				rootId: "root",
				components: [
					{ id: "root", component: { Column: { children: { explicitList: ["greeting"] } } } },
					{ id: "greeting", component: { Text: { text: { literalString: "Hello" } } } },
				],
			};

			const next = applySurfaceMessage(surface, msg);
			expect(next.components.size).toBe(2);
			expect(next.rootId).toBe("root");
			expect(next.components.get("root")).toBeDefined();
			expect(next.components.get("greeting")).toBeDefined();
		});

		it("applies a dataModelUpdate — merges data", () => {
			const surface = createEmptySurface("s1");
			const msg: A2UIMessage = {
				type: "dataModelUpdate",
				surfaceId: "s1",
				data: { user: { name: "Alice" } },
			};

			const next = applySurfaceMessage(surface, msg);
			expect(next.dataModel).toEqual({ user: { name: "Alice" } });

			// Apply another update — should merge
			const next2 = applySurfaceMessage(next, {
				type: "dataModelUpdate",
				surfaceId: "s1",
				data: { cart: { total: 19.98 } },
			});
			expect(next2.dataModel).toEqual({
				user: { name: "Alice" },
				cart: { total: 19.98 },
			});
		});

		it("applies beginRendering — sets ready flag", () => {
			const surface = createEmptySurface("s1");
			expect(surface.ready).toBe(false);

			const next = applySurfaceMessage(surface, {
				type: "beginRendering",
				surfaceId: "s1",
			});
			expect(next.ready).toBe(true);
		});

		it("applies deleteSurface — resets to empty", () => {
			let surface = createEmptySurface("s1");
			surface = applySurfaceMessage(surface, {
				type: "surfaceUpdate",
				surfaceId: "s1",
				rootId: "root",
				components: [{ id: "root", component: { Text: {} } }],
			});
			expect(surface.components.size).toBe(1);

			const next = applySurfaceMessage(surface, {
				type: "deleteSurface",
				surfaceId: "s1",
			});
			expect(next.components.size).toBe(0);
			expect(next.rootId).toBeNull();
			expect(next.ready).toBe(false);
		});

		it("incrementally updates existing components by ID", () => {
			let surface = createEmptySurface("s1");
			surface = applySurfaceMessage(surface, {
				type: "surfaceUpdate",
				surfaceId: "s1",
				rootId: "root",
				components: [{ id: "root", component: { Text: { text: { literalString: "v1" } } } }],
			});

			// Update the same component ID
			surface = applySurfaceMessage(surface, {
				type: "surfaceUpdate",
				surfaceId: "s1",
				components: [{ id: "root", component: { Text: { text: { literalString: "v2" } } } }],
			});

			expect(surface.components.size).toBe(1);
			const root = surface.components.get("root");
			expect((root?.component as any).Text.text.literalString).toBe("v2");
		});
	});

	describe("a2uiMessageSchema", () => {
		it("parses a valid surfaceUpdate", () => {
			const result = a2uiMessageSchema.safeParse({
				type: "surfaceUpdate",
				surfaceId: "s1",
				components: [{ id: "root", component: { Text: {} } }],
			});
			expect(result.success).toBe(true);
		});

		it("parses a valid dataModelUpdate", () => {
			const result = a2uiMessageSchema.safeParse({
				type: "dataModelUpdate",
				surfaceId: "s1",
				data: { foo: "bar" },
			});
			expect(result.success).toBe(true);
		});

		it("rejects invalid message type", () => {
			const result = a2uiMessageSchema.safeParse({
				type: "invalidType",
				surfaceId: "s1",
			});
			expect(result.success).toBe(false);
		});
	});
});
