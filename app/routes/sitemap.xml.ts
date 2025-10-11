import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  const base = process.env.CMS_PUBLIC_URL || `${origin}/cms`;
  let urls: string[] = [];

  try {
    const response = await fetch(
      `${base}/api/posts?where[status][equals]=published&limit=500`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      console.error("[sitemap] failed to fetch published posts", response.statusText);
    } else {
      const data = await response.json();
      urls = (data?.docs ?? [])
        .filter((post: { slug?: string }) => typeof post?.slug === "string" && post.slug.length > 0)
        .map((post: { slug: string }) => `${origin}/blog/${post.slug}`);
    }
  } catch (error) {
    console.error("[sitemap] unexpected error fetching published posts", error);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.map(u => `<url><loc>${u}</loc></url>`).join("")}
  </urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
export default function Sitemap() { return null; }
