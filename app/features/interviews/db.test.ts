import { describe, expect, it } from "vitest";
import { isValidInterviewUuid } from "./db";

describe("isValidInterviewUuid", () => {
	it("accepts valid UUIDs", () => {
		expect(isValidInterviewUuid("0d9b1a5d-1f4d-45b7-ba83-99c0cf5aaa20")).toBe(true);
	});

	it("rejects malformed UUIDs", () => {
		expect(isValidInterviewUuid("0d9b1a5d-1f4d-45b7-ba83-99c0cf5axxaa20")).toBe(false);
	});
});
