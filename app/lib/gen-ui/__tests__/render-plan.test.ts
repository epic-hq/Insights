import { describe, expect, it } from "vitest";
import { applySurfaceMessage, createEmptySurface } from "../a2ui";
import { buildRenderPlan } from "../render-plan";

describe("render-plan", () => {
	it("walks from rootId and ignores orphaned nodes", () => {
		let surface = createEmptySurface("s1");
		surface = applySurfaceMessage(surface, {
			type: "surfaceUpdate",
			surfaceId: "s1",
			rootId: "root",
			components: [
				{
					id: "root",
					component: {
						Stack: {
							children: { explicitList: ["card-a", "card-b"] },
						},
					},
				},
				{ id: "card-a", component: { StatCard: { dataBinding: "/data/a" } } },
				{ id: "card-b", component: { StatCard: { dataBinding: "/data/b" } } },
				{ id: "orphan", component: { StatCard: { dataBinding: "/data/orphan" } } },
			],
		});

		const plan = buildRenderPlan(surface);
		expect(plan.map((entry) => entry.node.id)).toEqual(["root", "card-a", "card-b"]);
		expect(plan[0]?.depth).toBe(0);
		expect(plan[1]?.depth).toBe(1);
	});

	it("expands template children into per-item render nodes", () => {
		let surface = createEmptySurface("s2");
		surface = applySurfaceMessage(surface, {
			type: "surfaceUpdate",
			surfaceId: "s2",
			rootId: "root",
			components: [
				{
					id: "root",
					component: {
						List: {
							children: {
								template: {
									dataBinding: "/data/items",
									componentId: "row",
								},
							},
						},
					},
				},
				{ id: "row", component: { StatCard: { dataBinding: "@item" } } },
			],
		});
		surface = applySurfaceMessage(surface, {
			type: "dataModelUpdate",
			surfaceId: "s2",
			data: {
				data: {
					items: [{ name: "one" }, { name: "two" }, { name: "three" }],
				},
			},
		});

		const plan = buildRenderPlan(surface);
		expect(plan).toHaveLength(4);
		expect(plan.map((entry) => entry.node.id)).toEqual(["root", "row", "row", "row"]);
		expect(plan.slice(1).map((entry) => entry.dataScopePath)).toEqual([
			"/data/items/0",
			"/data/items/1",
			"/data/items/2",
		]);
		expect(plan.slice(1).map((entry) => entry.actionComponentId)).toEqual([
			"row@/data/items/0",
			"row@/data/items/1",
			"row@/data/items/2",
		]);
	});

	it("guards against graph cycles", () => {
		let surface = createEmptySurface("s3");
		surface = applySurfaceMessage(surface, {
			type: "surfaceUpdate",
			surfaceId: "s3",
			rootId: "a",
			components: [
				{
					id: "a",
					component: { Wrapper: { children: { explicitList: ["b"] } } },
				},
				{
					id: "b",
					component: { Wrapper: { children: { explicitList: ["a"] } } },
				},
			],
		});

		const plan = buildRenderPlan(surface);
		expect(plan.map((entry) => entry.node.id)).toEqual(["a", "b"]);
	});
});
