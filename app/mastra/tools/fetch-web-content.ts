import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"

const MAX_CONTENT_LENGTH = 50000

function extractTextContent(html: string): string {
	// Remove script and style tags with their content
	let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
	text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
	text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")

	// Remove HTML tags but keep content
	text = text.replace(/<[^>]+>/g, " ")

	// Decode common HTML entities
	text = text
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&mdash;/g, "—")
		.replace(/&ndash;/g, "–")

	// Normalize whitespace
	text = text.replace(/\s+/g, " ").trim()

	return text
}

function extractMetadata(html: string): Record<string, string | null> {
	const metadata: Record<string, string | null> = {}

	// Title
	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
	metadata.title = titleMatch ? titleMatch[1].trim() : null

	// Meta description
	const descMatch =
		html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
	metadata.description = descMatch ? descMatch[1].trim() : null

	// Open Graph
	const ogTitleMatch =
		html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
	metadata.ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : null

	const ogDescMatch =
		html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
	metadata.ogDescription = ogDescMatch ? ogDescMatch[1].trim() : null

	const ogImageMatch =
		html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
	metadata.ogImage = ogImageMatch ? ogImageMatch[1].trim() : null

	// Canonical URL
	const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
	metadata.canonicalUrl = canonicalMatch ? canonicalMatch[1].trim() : null

	return metadata
}

function extractLinks(html: string, baseUrl: string): Array<{ href: string; text: string }> {
	const links: Array<{ href: string; text: string }> = []
	const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi

	for (const match of html.matchAll(linkRegex)) {
		const href = match[1]
		const text = match[2].trim()

		if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
			let absoluteHref = href
			if (href.startsWith("//")) {
				absoluteHref = `https:${href}`
			} else if (href.startsWith("/")) {
				try {
					const base = new URL(baseUrl)
					absoluteHref = `${base.origin}${href}`
				} catch {
					absoluteHref = href
				}
			} else if (!href.startsWith("http")) {
				try {
					absoluteHref = new URL(href, baseUrl).href
				} catch {
					absoluteHref = href
				}
			}

			links.push({ href: absoluteHref, text: text || absoluteHref })
		}
	}

	// Deduplicate by href
	const seen = new Set<string>()
	return links.filter((link) => {
		if (seen.has(link.href)) return false
		seen.add(link.href)
		return true
	})
}

function extractMediaUrls(html: string): Array<{ type: string; url: string }> {
	const media: Array<{ type: string; url: string }> = []

	// Video sources
	const videoPatterns = [
		/<video[^>]+src=["']([^"']+)["']/gi,
		/<source[^>]+src=["']([^"']+)["'][^>]*type=["']video\/[^"']+["']/gi,
		/<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/gi,
	]

	for (const pattern of videoPatterns) {
		for (const match of html.matchAll(pattern)) {
			if (match[1] && (match[1].startsWith("http") || match[1].startsWith("//"))) {
				media.push({
					type: "video",
					url: match[1].startsWith("//") ? `https:${match[1]}` : match[1],
				})
			}
		}
	}

	// Audio sources
	const audioPatterns = [
		/<audio[^>]+src=["']([^"']+)["']/gi,
		/<source[^>]+src=["']([^"']+)["'][^>]*type=["']audio\/[^"']+["']/gi,
	]

	for (const pattern of audioPatterns) {
		for (const match of html.matchAll(pattern)) {
			if (match[1] && (match[1].startsWith("http") || match[1].startsWith("//"))) {
				media.push({
					type: "audio",
					url: match[1].startsWith("//") ? `https:${match[1]}` : match[1],
				})
			}
		}
	}

	// Deduplicate
	const seen = new Set<string>()
	return media.filter((m) => {
		if (seen.has(m.url)) return false
		seen.add(m.url)
		return true
	})
}

export const fetchWebContentTool = createTool({
	id: "fetchWebContent",
	description:
		"Fetch and parse content from a webpage URL. Returns the page title, description, text content, links, and any embedded media URLs. Useful for extracting information from web pages.",
	inputSchema: z.object({
		url: z.string().url().describe("The URL of the webpage to fetch."),
		includeLinks: z
			.boolean()
			.nullish()
			.transform((val) => val ?? false)
			.describe("Whether to extract and return links from the page. Default: false"),
		includeMedia: z
			.boolean()
			.nullish()
			.transform((val) => val ?? false)
			.describe("Whether to extract and return media URLs (video/audio) from the page. Default: false"),
		maxContentLength: z
			.number()
			.nullish()
			.transform((val) => val ?? MAX_CONTENT_LENGTH)
			.describe(`Maximum length of text content to return. Default: ${MAX_CONTENT_LENGTH}`),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		url: z.string(),
		metadata: z.record(z.string(), z.string().nullable()).nullable(),
		textContent: z.string().nullable(),
		links: z
			.array(
				z.object({
					href: z.string(),
					text: z.string(),
				})
			)
			.nullable(),
		media: z
			.array(
				z.object({
					type: z.string(),
					url: z.string(),
				})
			)
			.nullable(),
		error: z.string().optional(),
	}),
	execute: async (input) => {
		const { url, includeLinks = false, includeMedia = false, maxContentLength = MAX_CONTENT_LENGTH } = input

		try {
			consola.info(`[fetchWebContent] Fetching: ${url}`)

			const response = await fetch(url, {
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; UpsightBot/1.0)",
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				},
			})

			if (!response.ok) {
				return {
					success: false,
					error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
					url,
					metadata: null,
					textContent: null,
					links: null,
					media: null,
				}
			}

			const contentType = response.headers.get("content-type") || ""
			if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
				return {
					success: false,
					error: `URL does not return HTML content (got: ${contentType})`,
					url,
					metadata: null,
					textContent: null,
					links: null,
					media: null,
				}
			}

			const html = await response.text()
			const metadata = extractMetadata(html)
			let textContent = extractTextContent(html)

			if (textContent.length > maxContentLength) {
				textContent = `${textContent.slice(0, maxContentLength)}... [truncated]`
			}

			const result: {
				success: boolean
				url: string
				metadata: Record<string, string | null>
				textContent: string
				links: Array<{ href: string; text: string }> | null
				media: Array<{ type: string; url: string }> | null
			} = {
				success: true,
				url,
				metadata,
				textContent,
				links: null,
				media: null,
			}

			if (includeLinks) {
				result.links = extractLinks(html, url).slice(0, 50) // Limit to 50 links
			}

			if (includeMedia) {
				result.media = extractMediaUrls(html)
			}

			consola.info(`[fetchWebContent] Successfully fetched ${url}, content length: ${textContent.length}`)
			return result
		} catch (error) {
			consola.error(`[fetchWebContent] Error fetching ${url}:`, error)
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
				url,
				metadata: null,
				textContent: null,
				links: null,
				media: null,
			}
		}
	},
})
