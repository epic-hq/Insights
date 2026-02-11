import { describe, expect, it } from "vitest"
import { parseJsonPointer, resolveBinding, resolvePointer, resolveTemplateData } from "../data-binding"

describe("data-binding", () => {
	const dataModel = {
		user: { name: "Alice", email: "alice@example.com" },
		cart: {
			items: [
				{ name: "Widget", price: 9.99, quantity: 2 },
				{ name: "Gadget", price: 19.99, quantity: 1 },
			],
			total: 29.97,
		},
		tags: ["featured", "sale"],
	}

	describe("parseJsonPointer", () => {
		it("parses empty pointer", () => {
			expect(parseJsonPointer("")).toEqual([])
			expect(parseJsonPointer("/")).toEqual([])
		})

		it("parses simple path", () => {
			expect(parseJsonPointer("/user/name")).toEqual(["user", "name"])
		})

		it("parses array index path", () => {
			expect(parseJsonPointer("/cart/items/0")).toEqual(["cart", "items", "0"])
		})

		it("handles tilde escaping", () => {
			expect(parseJsonPointer("/a~1b")).toEqual(["a/b"])
			expect(parseJsonPointer("/a~0b")).toEqual(["a~b"])
		})

		it("throws on invalid pointer", () => {
			expect(() => parseJsonPointer("no-slash")).toThrow("Invalid JSON Pointer")
		})
	})

	describe("resolvePointer", () => {
		it("resolves object property", () => {
			expect(resolvePointer(dataModel, "/user/name")).toBe("Alice")
		})

		it("resolves nested property", () => {
			expect(resolvePointer(dataModel, "/cart/total")).toBe(29.97)
		})

		it("resolves array index", () => {
			expect(resolvePointer(dataModel, "/cart/items/0/name")).toBe("Widget")
			expect(resolvePointer(dataModel, "/tags/1")).toBe("sale")
		})

		it("returns undefined for missing path", () => {
			expect(resolvePointer(dataModel, "/nonexistent")).toBeUndefined()
			expect(resolvePointer(dataModel, "/user/age")).toBeUndefined()
		})

		it("returns undefined for out-of-bounds array index", () => {
			expect(resolvePointer(dataModel, "/tags/5")).toBeUndefined()
		})

		it("returns the whole model for empty pointer", () => {
			expect(resolvePointer(dataModel, "")).toEqual(dataModel)
		})
	})

	describe("resolveBinding", () => {
		it("resolves literal string", () => {
			expect(resolveBinding({ literalString: "Hello" }, dataModel)).toBe("Hello")
		})

		it("resolves literal number", () => {
			expect(resolveBinding({ literalNumber: 42 }, dataModel)).toBe(42)
		})

		it("resolves literal bool", () => {
			expect(resolveBinding({ literalBool: true }, dataModel)).toBe(true)
		})

		it("resolves path binding", () => {
			expect(resolveBinding({ path: "/user/name" }, dataModel)).toBe("Alice")
		})

		it("returns undefined for missing binding", () => {
			expect(resolveBinding(undefined, dataModel)).toBeUndefined()
		})
	})

	describe("resolveTemplateData", () => {
		it("resolves array data for templates", () => {
			const items = resolveTemplateData(dataModel, "/cart/items")
			expect(items).toHaveLength(2)
			expect((items[0] as any).name).toBe("Widget")
		})

		it("returns empty array for non-array path", () => {
			expect(resolveTemplateData(dataModel, "/user/name")).toEqual([])
		})

		it("returns empty array for missing path", () => {
			expect(resolveTemplateData(dataModel, "/nonexistent")).toEqual([])
		})
	})
})
