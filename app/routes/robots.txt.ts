import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  const siteOrigin = (process.env.SITE_ORIGIN ?? origin).replace(/\/$/, "");
  const body = `User-agent: *
Allow: /
Sitemap: ${siteOrigin}/sitemap.xml
`;
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
}
export default function Robots() { return null; }
