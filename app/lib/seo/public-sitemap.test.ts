// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildSitemapXml, getIntentionalNoindexPaths } from "./public-sitemap";

describe("public sitemap source of truth", () => {
	it("keeps intentional noindex paths out of sitemap policy", () => {
		expect(getIntentionalNoindexPaths()).toContain("/index2");
	});

	it("renders sitemap xml entries", () => {
		const xml = buildSitemapXml(
			"https://getupsight.com",
			[
				{ path: "/", priority: 1.0, changefreq: "weekly" },
				{ path: "/blog", priority: 0.9, changefreq: "weekly" },
			],
			"2026-03-04"
		);

		expect(xml).toContain("<loc>https://getupsight.com/</loc>");
		expect(xml).toContain("<loc>https://getupsight.com/blog</loc>");
		expect(xml).toContain("<lastmod>2026-03-04</lastmod>");
	});
});
