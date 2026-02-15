import type { LoaderFunctionArgs } from "react-router";
import { getAllPostSlugs } from "~/lib/cms/payload.server";

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

	// Define your public pages here
	const staticPages = [
		// Homepage - Highest priority
		{ path: "/", priority: 1.0, changefreq: "weekly" },

		// Marketing pages - High priority for SEO
		{ path: "/customer-discovery", priority: 1.0, changefreq: "weekly" },
		{ path: "/customer-discovery-for-consultants", priority: 0.9, changefreq: "weekly" },

		// Blog index
		{ path: "/blog", priority: 0.8, changefreq: "daily" },

		// Sign up - High conversion priority
		{ path: "/sign-up", priority: 0.8, changefreq: "monthly" },

		// Auth pages - Lower priority
		{ path: "/login", priority: 0.7, changefreq: "monthly" },

		// Add more public pages as needed
	];

	// Fetch blog posts from CMS
	let blogPages: Array<{ path: string; priority: number; changefreq: string }> = [];
	try {
		const postSlugs = await getAllPostSlugs();
		blogPages = postSlugs.map((slug) => ({
			path: `/blog/${slug}`,
			priority: 0.7,
			changefreq: "monthly",
		}));
	} catch (error) {
		console.error("Failed to fetch blog posts for sitemap:", error);
		// Continue without blog posts if CMS is unavailable
	}

	const pages = [...staticPages, ...blogPages];
	const lastmod = new Date().toISOString().split("T")[0];

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
	.map(
		(page) => `  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
	)
	.join("\n")}
</urlset>`;

	return new Response(sitemap, {
		status: 200,
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "public, max-age=3600", // Cache for 1 hour
		},
	});
}
