import { buildAuthoritativeMultipartParts, parseMultipartUploadPartsXml } from "./r2.server";

describe("parseMultipartUploadPartsXml", () => {
	it("parses uploaded multipart parts from R2 XML", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
			<ListPartsResult>
				<Part>
					<PartNumber>2</PartNumber>
					<LastModified>2026-03-17T00:52:50.000Z</LastModified>
					<ETag>"etag-two"</ETag>
					<Size>10485760</Size>
				</Part>
				<Part>
					<PartNumber>1</PartNumber>
					<LastModified>2026-03-17T00:52:30.000Z</LastModified>
					<ETag>"etag-one"</ETag>
					<Size>10485760</Size>
				</Part>
			</ListPartsResult>`;

		expect(parseMultipartUploadPartsXml(xml)).toEqual([
			{ PartNumber: 1, ETag: '"etag-one"' },
			{ PartNumber: 2, ETag: '"etag-two"' },
		]);
	});
});

describe("buildAuthoritativeMultipartParts", () => {
	it("prefers R2-listed etags over client placeholders", () => {
		const result = buildAuthoritativeMultipartParts({
			requestedParts: [
				{ partNumber: 1, etag: "part-1" },
				{ partNumber: 2, etag: "part-2" },
			],
			listedParts: [
				{ PartNumber: 1, ETag: '"real-etag-1"' },
				{ PartNumber: 2, ETag: '"real-etag-2"' },
			],
		});

		expect(result).toEqual({
			success: true,
			parts: [
				{ PartNumber: 1, ETag: '"real-etag-1"' },
				{ PartNumber: 2, ETag: '"real-etag-2"' },
			],
		});
	});

	it("reports missing multipart parts before completion", () => {
		const result = buildAuthoritativeMultipartParts({
			requestedParts: [
				{ partNumber: 1, etag: "part-1" },
				{ partNumber: 2, etag: "part-2" },
			],
			listedParts: [{ PartNumber: 1, ETag: '"real-etag-1"' }],
		});

		expect(result).toEqual({
			success: false,
			missingPartNumbers: [2],
		});
	});
});
