/**
 * Unit tests for API key generation, hashing, and validation.
 * Tests pure functions without database dependencies.
 */

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateRawApiKey, hashApiKey, keyDisplayPrefix } from "../api-keys.server";

describe("API Key Generation", () => {
	describe("generateRawApiKey", () => {
		it("starts with upsk_ prefix", () => {
			const key = generateRawApiKey();
			expect(key.startsWith("upsk_")).toBe(true);
		});

		it("has correct total length (5 prefix + 64 hex chars = 69)", () => {
			const key = generateRawApiKey();
			expect(key.length).toBe(69);
		});

		it("generates unique keys on each call", () => {
			const keys = new Set(Array.from({ length: 100 }, () => generateRawApiKey()));
			expect(keys.size).toBe(100);
		});

		it("hex portion contains only valid hex characters", () => {
			const key = generateRawApiKey();
			const hex = key.slice(5); // remove "upsk_"
			expect(hex).toMatch(/^[0-9a-f]{64}$/);
		});
	});

	describe("hashApiKey", () => {
		it("returns a 64-character hex string (SHA-256)", () => {
			const hash = hashApiKey("upsk_test123");
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});

		it("produces deterministic output", () => {
			const key = "upsk_abc123def456";
			expect(hashApiKey(key)).toBe(hashApiKey(key));
		});

		it("produces different hashes for different keys", () => {
			const hash1 = hashApiKey("upsk_key_one");
			const hash2 = hashApiKey("upsk_key_two");
			expect(hash1).not.toBe(hash2);
		});
	});

	describe("keyDisplayPrefix", () => {
		it("returns prefix + first 8 chars of hex", () => {
			const key = "upsk_a1b2c3d4e5f6g7h8rest_of_key";
			expect(keyDisplayPrefix(key)).toBe("upsk_a1b2c3d4");
		});

		it("works with real generated keys", () => {
			const key = generateRawApiKey();
			const prefix = keyDisplayPrefix(key);
			expect(prefix.startsWith("upsk_")).toBe(true);
			expect(prefix.length).toBe(13); // 5 + 8
			expect(key.startsWith(prefix)).toBe(true);
		});
	});
});
