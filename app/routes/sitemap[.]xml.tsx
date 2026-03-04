import type { LoaderFunctionArgs } from "react-router";
import { buildSitemapXml, getPublicSitemapEntries } from "~/lib/seo/public-sitemap";

/**
 * Dynamic Sitemap Generator
 *
 * This route generates a sitemap.xml dynamically.
 * Access at: /sitemap.xml
 *
 * Note: There's also a static sitemap.xml in /public/sitemap.xml
 * This dynamic version can be used if you need to generate URLs programmatically.
 */

export async function loader({ request }: LoaderFunctionArgs) {
	const baseUrl = new URL(request.url).origin;
	const lastmod = new Date().toISOString().split("T")[0];
	const entries = await getPublicSitemapEntries();
	const sitemap = buildSitemapXml(baseUrl, entries, lastmod);

	return new Response(sitemap, {
		status: 200,
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "public, max-age=3600", // Cache for 1 hour
		},
	});
}
