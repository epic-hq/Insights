/**
 * Tests for audio processing and formatting utilities.
 */
import { describe, expect, it } from "vitest"
import { deduplicateEvidence, downsampleTo16kPCM16, formatDuration, formatMs } from "./audio"

describe("downsampleTo16kPCM16", () => {
	it("should downsample 48kHz to 16kHz (3:1 ratio)", () => {
		// 48 samples at 48kHz = 1ms of audio
		// Should produce 16 samples at 16kHz
		const input = new Float32Array(48)
		for (let i = 0; i < 48; i++) {
			input[i] = Math.sin((2 * Math.PI * 440 * i) / 48000) // 440Hz sine
		}

		const output = downsampleTo16kPCM16(input, 48000)
		expect(output).not.toBeNull()
		expect(output!.length).toBe(16)
	})

	it("should return null for empty input", () => {
		const input = new Float32Array(0)
		const output = downsampleTo16kPCM16(input, 48000)
		expect(output).toBeNull()
	})

	it("should return null for input too short to produce output", () => {
		// 2 samples at 48kHz -> floor(2/3) = 0 output samples
		const input = new Float32Array(2)
		const output = downsampleTo16kPCM16(input, 48000)
		expect(output).toBeNull()
	})

	it("should clamp output to Int16 range", () => {
		// Values at +1.0 and -1.0 should map to near +-32767
		const input = new Float32Array([1.0, -1.0, 1.0, -1.0, 1.0, -1.0])
		const output = downsampleTo16kPCM16(input, 48000)
		expect(output).not.toBeNull()

		for (let i = 0; i < output!.length; i++) {
			expect(output![i]).toBeGreaterThanOrEqual(-32767)
			expect(output![i]).toBeLessThanOrEqual(32767)
		}
	})

	it("should handle values exceeding +-1.0 by clamping", () => {
		const input = new Float32Array([2.0, -2.0, 1.5])
		const output = downsampleTo16kPCM16(input, 16000) // 1:1 ratio
		expect(output).not.toBeNull()
		// 2.0 * 32767 = 65534, clamped to 32767
		expect(output![0]).toBe(32767)
		// -2.0 * 32767 = -65534, clamped to -32767
		expect(output![1]).toBe(-32767)
	})

	it("should preserve silence (zeros)", () => {
		const input = new Float32Array(48).fill(0)
		const output = downsampleTo16kPCM16(input, 48000)
		expect(output).not.toBeNull()
		for (let i = 0; i < output!.length; i++) {
			expect(output![i]).toBe(0)
		}
	})

	it("should handle 1:1 ratio (same sample rate)", () => {
		const input = new Float32Array([0.5, -0.5, 0.25])
		const output = downsampleTo16kPCM16(input, 16000)
		expect(output).not.toBeNull()
		expect(output!.length).toBe(3)
		expect(output![0]).toBe(Math.round(0.5 * 32767))
		expect(output![1]).toBe(Math.round(-0.5 * 32767))
	})
})

describe("formatDuration", () => {
	it("should format 0ms as 00:00", () => {
		expect(formatDuration(0)).toBe("00:00")
	})

	it("should format seconds correctly", () => {
		expect(formatDuration(5000)).toBe("00:05")
		expect(formatDuration(30000)).toBe("00:30")
		expect(formatDuration(59000)).toBe("00:59")
	})

	it("should format minutes correctly", () => {
		expect(formatDuration(60000)).toBe("01:00")
		expect(formatDuration(90000)).toBe("01:30")
		expect(formatDuration(600000)).toBe("10:00")
	})

	it("should handle large values", () => {
		expect(formatDuration(3600000)).toBe("60:00") // 1 hour
		expect(formatDuration(5400000)).toBe("90:00") // 1.5 hours
	})

	it("should truncate partial seconds", () => {
		expect(formatDuration(1500)).toBe("00:01") // 1.5s -> 1s
		expect(formatDuration(999)).toBe("00:00") // 999ms -> 0s
	})
})

describe("formatMs", () => {
	it("should return --:-- for null", () => {
		expect(formatMs(null)).toBe("--:--")
	})

	it("should return --:-- for undefined", () => {
		expect(formatMs(undefined)).toBe("--:--")
	})

	it("should format 0ms as 0:00", () => {
		expect(formatMs(0)).toBe("0:00")
	})

	it("should format timestamps correctly", () => {
		expect(formatMs(5000)).toBe("0:05")
		expect(formatMs(65000)).toBe("1:05")
		expect(formatMs(600000)).toBe("10:00")
	})

	it("should not zero-pad minutes", () => {
		expect(formatMs(60000)).toBe("1:00")
		expect(formatMs(120000)).toBe("2:00")
	})
})

describe("deduplicateEvidence", () => {
	const makeEvidence = (gist: string, verbatim: string) => ({
		gist,
		verbatim,
		chunk: "test chunk",
	})

	it("should return all items when existing is empty", () => {
		const incoming = [makeEvidence("a", "b"), makeEvidence("c", "d")]
		const result = deduplicateEvidence([], incoming)
		expect(result).toHaveLength(2)
	})

	it("should filter out duplicates based on gist+verbatim", () => {
		const existing = [makeEvidence("a", "b")]
		const incoming = [makeEvidence("a", "b"), makeEvidence("c", "d")]
		const result = deduplicateEvidence(existing, incoming)
		expect(result).toHaveLength(1)
		expect(result[0].gist).toBe("c")
	})

	it("should return empty when all items are duplicates", () => {
		const existing = [makeEvidence("a", "b"), makeEvidence("c", "d")]
		const incoming = [makeEvidence("a", "b"), makeEvidence("c", "d")]
		const result = deduplicateEvidence(existing, incoming)
		expect(result).toHaveLength(0)
	})

	it("should treat same gist with different verbatim as distinct", () => {
		const existing = [makeEvidence("a", "version1")]
		const incoming = [makeEvidence("a", "version2")]
		const result = deduplicateEvidence(existing, incoming)
		expect(result).toHaveLength(1)
	})

	it("should handle empty incoming array", () => {
		const existing = [makeEvidence("a", "b")]
		const result = deduplicateEvidence(existing, [])
		expect(result).toHaveLength(0)
	})
})
