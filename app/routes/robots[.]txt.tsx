import type { LoaderFunctionArgs } from "react-router"

/**
 * Dynamic Robots.txt Generator
 * 
 * This route generates robots.txt dynamically.
 * Access at: /robots.txt
 * 
 * Note: There's also a static robots.txt in /public/robots.txt
 * This dynamic version can be used if you need environment-specific rules.
 */

export async function loader({ request }: LoaderFunctionArgs) {
	const baseUrl = new URL(request.url).origin
	const isDev = process.env.NODE_ENV === "development"

	// In development, disallow all crawling
	// In production, allow with specific rules
	const robotsTxt = isDev
		? `# Development Environment - No Crawling
User-agent: *
Disallow: /
`
		: `# Insights - Robots.txt
User-agent: *
Allow: /

# Disallow private/authenticated routes
Disallow: /a/
Disallow: /api/
Disallow: /auth/

# Allow public pages
Allow: /auth/login
Allow: /auth/register

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml
`

	return new Response(robotsTxt, {
		status: 200,
		headers: {
			"Content-Type": "text/plain",
			"Cache-Control": "public, max-age=86400", // Cache for 24 hours
		},
	})
}
