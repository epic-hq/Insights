import { getAllCaseStudySlugs, getAllPostSlugs } from "~/lib/cms/payload.server";
import { INTENTIONAL_NOINDEX_PATHS, isIntentionalNoindexPath } from "~/features/marketing/seo";

export interface SitemapUrlEntry {
	path: string;
	priority: number;
	changefreq: "daily" | "weekly" | "monthly" | "yearly";
}

const STATIC_PUBLIC_SITEMAP_ENTRIES: SitemapUrlEntry[] = [
	{ path: "/", priority: 1.0, changefreq: "weekly" },
	{ path: "/customer-discovery", priority: 1.0, changefreq: "weekly" },
	{ path: "/customer-discovery-for-consultants", priority: 0.9, changefreq: "weekly" },
	{ path: "/pricing", priority: 0.9, changefreq: "weekly" },
	{ path: "/blog", priority: 0.9, changefreq: "weekly" },
	{ path: "/case-studies", priority: 0.8, changefreq: "weekly" },
	{ path: "/about", priority: 0.7, changefreq: "monthly" },
	{ path: "/privacy", priority: 0.4, changefreq: "yearly" },
	{ path: "/terms", priority: 0.4, changefreq: "yearly" },
	{ path: "/sign-up", priority: 0.7, changefreq: "monthly" },
];

function normalizePath(path: string): string {
	if (path === "/") return "/";
	if (!path.startsWith("/")) return `/${path}`;
	return path;
}

function dedupeEntries(entries: SitemapUrlEntry[]): SitemapUrlEntry[] {
	const seen = new Set<string>();
	const deduped: SitemapUrlEntry[] = [];
	for (const entry of entries) {
		const key = normalizePath(entry.path);
		if (isIntentionalNoindexPath(key)) continue;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push({ ...entry, path: key });
	}
	return deduped;
}

export async function getPublicSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [blogSlugsResult, caseStudySlugsResult] = await Promise.allSettled([getAllPostSlugs(), getAllCaseStudySlugs()]);

	const blogSlugs = blogSlugsResult.status === "fulfilled" ? blogSlugsResult.value : [];
	const caseStudySlugs = caseStudySlugsResult.status === "fulfilled" ? caseStudySlugsResult.value : [];

	const blogEntries: SitemapUrlEntry[] = blogSlugs.map((slug) => ({
		path: `/blog/${slug}`,
		priority: 0.7,
		changefreq: "monthly",
	}));

	const caseStudyEntries: SitemapUrlEntry[] = caseStudySlugs.map((slug) => ({
		path: `/case-studies/${slug}`,
		priority: 0.7,
		changefreq: "monthly",
	}));

	return dedupeEntries([...STATIC_PUBLIC_SITEMAP_ENTRIES, ...blogEntries, ...caseStudyEntries]);
}

export function getIntentionalNoindexPaths(): readonly string[] {
	return INTENTIONAL_NOINDEX_PATHS;
}

export function buildSitemapXml(domain: string, entries: SitemapUrlEntry[], lastmod: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map(
		(entry) => `  <url>
    <loc>${domain}${normalizePath(entry.path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
	)
	.join("\n")}
</urlset>`;
}
