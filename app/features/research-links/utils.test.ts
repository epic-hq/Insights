/**
 * Tests for research-links utility functions — media type detection,
 * R2 key identification, CSV export, and answer extraction.
 */

import { describe, expect, it } from "vitest";
import type { ResearchLinkResponse } from "../../types";
import type { ResearchLinkQuestion } from "./schemas";
import { buildResponsesCsv, extractAnswer, getMediaType, isR2Key } from "./utils";

function createResponse(responses: ResearchLinkResponse["responses"], email = ""): ResearchLinkResponse {
	return {
		id: "response-1",
		research_link_id: "link-1",
		email,
		completed: false,
		created_at: new Date().toISOString(),
		evidence_count: null,
		evidence_extracted: null,
		evidence_id: null,
		person_id: null,
		personalized_survey_id: null,
		phone: null,
		response_mode: "form",
		responses,
		updated_at: new Date().toISOString(),
		utm_params: null,
		video_url: null,
	};
}

describe("getMediaType", () => {
	it("should detect image extensions", () => {
		const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"];
		for (const ext of imageExts) {
			expect(getMediaType(`photo.${ext}`)).toBe("image");
			expect(getMediaType(`PHOTO.${ext.toUpperCase()}`)).toBe("image");
		}
	});

	it("should detect video extensions", () => {
		const videoExts = ["mp4", "webm", "mov", "avi", "mkv", "ogv"];
		for (const ext of videoExts) {
			expect(getMediaType(`video.${ext}`)).toBe("video");
		}
	});

	it("should detect audio extensions", () => {
		const audioExts = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"];
		for (const ext of audioExts) {
			expect(getMediaType(`audio.${ext}`)).toBe("audio");
		}
	});

	it("should detect media type from full URLs", () => {
		expect(getMediaType("https://example.com/uploads/photo.jpg")).toBe("image");
		expect(getMediaType("https://cdn.example.com/video.mp4?token=abc")).toBe("video");
		expect(getMediaType("https://storage.example.com/audio.opus?expires=123")).toBe("audio");
	});

	it("should detect media type from R2 keys", () => {
		expect(getMediaType("uploads/abc123/image.png")).toBe("image");
		expect(getMediaType("media/question-video.webm")).toBe("video");
	});

	it("should return unknown for unrecognized extensions", () => {
		expect(getMediaType("document.pdf")).toBe("unknown");
		expect(getMediaType("file.txt")).toBe("unknown");
		expect(getMediaType("noextension")).toBe("unknown");
		expect(getMediaType("")).toBe("unknown");
	});
});

describe("isR2Key", () => {
	it("should return true for R2 storage keys", () => {
		expect(isR2Key("uploads/abc123/image.png")).toBe(true);
		expect(isR2Key("media/video.mp4")).toBe(true);
		expect(isR2Key("question-media/abc.webm")).toBe(true);
	});

	it("should return false for HTTP URLs", () => {
		expect(isR2Key("http://example.com/image.png")).toBe(false);
		expect(isR2Key("https://cdn.example.com/video.mp4")).toBe(false);
	});

	it("should return false for data URIs", () => {
		expect(isR2Key("data:image/png;base64,abc123")).toBe(false);
	});
});

describe("extractAnswer", () => {
	const makeQuestion = (id: string): ResearchLinkQuestion => ({
		id,
		prompt: "Test",
		hidden: false,
		required: false,
		type: "short_text",
		placeholder: null,
		helperText: null,
		options: null,
		allowOther: true,
		likertScale: null,
		likertLabels: null,
		imageOptions: null,
		mediaUrl: null,
		videoUrl: null,
	});

	it("should extract a string answer", () => {
		const response = createResponse({ q1: "Hello" });
		expect(extractAnswer(response, makeQuestion("q1"))).toBe("Hello");
	});

	it("should join array answers with comma", () => {
		const response = createResponse({ q1: ["A", "B", "C"] });
		expect(extractAnswer(response, makeQuestion("q1"))).toBe("A, B, C");
	});

	it("should return Yes/No for booleans", () => {
		const responseTrue = createResponse({ q1: true });
		expect(extractAnswer(responseTrue, makeQuestion("q1"))).toBe("Yes");

		const responseFalse = createResponse({ q1: false });
		expect(extractAnswer(responseFalse, makeQuestion("q1"))).toBe("No");
	});

	it("should return empty string for missing answers", () => {
		const response = createResponse({});
		expect(extractAnswer(response, makeQuestion("q1"))).toBe("");
	});

	it("should return empty string for null responses", () => {
		const response = createResponse(null);
		expect(extractAnswer(response, makeQuestion("q1"))).toBe("");
	});
});

describe("buildResponsesCsv", () => {
	const questions: ResearchLinkQuestion[] = [
		{
			id: "q1",
			prompt: "Favorite color",
			hidden: false,
			required: false,
			type: "short_text",
			placeholder: null,
			helperText: null,
			options: null,
			allowOther: true,
			likertScale: null,
			likertLabels: null,
			imageOptions: null,
			mediaUrl: null,
			videoUrl: null,
		},
	];

	it("should produce CSV with headers", () => {
		const csv = buildResponsesCsv(questions, []);
		expect(csv).toBe("Email,Favorite color");
	});

	it("should include response rows", () => {
		const responses = [createResponse({ q1: "Blue" }, "a@b.com")];
		const csv = buildResponsesCsv(questions, responses);
		const lines = csv.split("\n");
		expect(lines).toHaveLength(2);
		expect(lines[1]).toBe("a@b.com,Blue");
	});

	it("should escape commas in values", () => {
		const responses = [createResponse({ q1: "Red, Blue" }, "a@b.com")];
		const csv = buildResponsesCsv(questions, responses);
		expect(csv).toContain('"Red, Blue"');
	});
});
