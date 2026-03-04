// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
	INTENTIONAL_NOINDEX_PATHS,
	canonicalUrl,
	indexRobotsMeta,
	isIntentionalNoindexPath,
	noindexRobotsMeta,
} from "./seo";

describe("marketing seo helpers", () => {
	it("builds canonical URLs consistently", () => {
		expect(canonicalUrl("/")).toBe("https://getupsight.com");
		expect(canonicalUrl("pricing")).toBe("https://getupsight.com/pricing");
		expect(canonicalUrl("/blog/post")).toBe("https://getupsight.com/blog/post");
	});

	it("exposes robots policies for indexable and noindex pages", () => {
		expect(indexRobotsMeta()).toEqual({ name: "robots", content: "index,follow" });
		expect(noindexRobotsMeta()).toEqual({ name: "robots", content: "noindex,nofollow" });
	});

	it("documents intentional noindex routes", () => {
		expect(INTENTIONAL_NOINDEX_PATHS).toContain("/index2");
		expect(isIntentionalNoindexPath("/index2")).toBe(true);
		expect(isIntentionalNoindexPath("/blog")).toBe(false);
	});
});
