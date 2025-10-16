/**
 * Payload CMS Client
 *
 * Handles all API calls to Payload CMS for blog posts and other content.
 */

import { getServerEnv } from "~/env.server"

// Types based on Payload CMS structure
export interface PayloadImage {
	id: string
	url: string
	alt?: string
	width?: number
	height?: number
	filename?: string
}

export interface PayloadAuthor {
	id: string
	name: string
	email?: string
	bio?: string
	avatar?: PayloadImage
}

export interface PayloadPost {
	id: string
	title: string
	slug: string
	content: any // Lexical rich text object
	excerpt?: string
	featured_image?: PayloadImage
	heroImage?: PayloadImage // New field from CMS
	author?: PayloadAuthor
	populatedAuthors?: PayloadAuthor[] // Populated authors array
	publishedAt: string
	updatedAt: string
	createdAt: string
	status?: "draft" | "published"
	meta?: {
		title?: string
		description?: string
		image?: PayloadImage
	}
	seo?: {
		title?: string
		description?: string
		keywords?: string
		image?: PayloadImage
	}
	categories?: Array<{
		id: string
		name: string
		slug: string
	}>
	tags?: string[]
	// Case study specific fields
	company?: string
	industry?: string
	results?: string
}

export interface PayloadResponse<T> {
	docs: T[]
	totalDocs: number
	limit: number
	totalPages: number
	page: number
	pagingCounter: number
	hasPrevPage: boolean
	hasNextPage: boolean
	prevPage: number | null
	nextPage: number | null
}

// Helper to build headers
function getHeaders(): HeadersInit {
	return {
		"Content-Type": "application/json",
	}
}

// Helper to handle API errors
async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const error = await response.text()
		throw new Error(`Payload CMS API error: ${response.status} - ${error}`)
	}

	return response.json()
}

/**
 * Fetch all blog posts with pagination
 */
export async function getPosts(options?: {
	limit?: number
	page?: number
	status?: "draft" | "published"
}): Promise<PayloadResponse<PayloadPost>> {
	const { limit = 10, page = 1, status = "published" } = options || {}
	const env = getServerEnv()

	const params = new URLSearchParams({
		limit: limit.toString(),
		page: page.toString(),
		where: JSON.stringify({ status: { equals: status } }),
		sort: "-publishedAt", // Sort by newest first
	})

	const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/posts?${params}`, {
		headers: getHeaders(),
	})

	return handleResponse<PayloadResponse<PayloadPost>>(response)
}

/**
 * Fetch a single blog post by slug
 */
export async function getPostBySlug(slug: string): Promise<PayloadPost | null> {
	const env = getServerEnv()
	const params = new URLSearchParams({
		where: JSON.stringify({
			slug: { equals: slug },
			status: { equals: "published" },
		}),
		limit: "1",
	})

	const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/posts?${params}`, {
		headers: getHeaders(),
	})

	const data = await handleResponse<PayloadResponse<PayloadPost>>(response)

	return data.docs[0] || null
}

/**
 * Fetch a single blog post by ID
 */
export async function getPostById(id: string): Promise<PayloadPost> {
	const env = getServerEnv()
	const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/posts/${id}`, {
		headers: getHeaders(),
	})

	return handleResponse<PayloadPost>(response)
}

/**
 * Fetch recent posts for sidebar/related posts
 */
export async function getRecentPosts(limit = 5): Promise<PayloadPost[]> {
	const data = await getPosts({ limit, page: 1 })
	return data.docs
}

/**
 * Search posts by query
 */
export async function searchPosts(query: string, limit = 10): Promise<PayloadPost[]> {
	const env = getServerEnv()
	const params = new URLSearchParams({
		where: JSON.stringify({
			or: [
				{ title: { contains: query } },
				{ excerpt: { contains: query } },
				{ content: { contains: query } },
			],
			status: { equals: "published" },
		}),
		limit: limit.toString(),
		sort: "-publishedAt",
	})

	const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/posts?${params}`, {
		headers: getHeaders(),
	})

	const data = await handleResponse<PayloadResponse<PayloadPost>>(response)
	return data.docs
}

/**
 * Get all post slugs for sitemap generation
 */
export async function getAllPostSlugs(): Promise<string[]> {
	const env = getServerEnv()
	const params = new URLSearchParams({
		limit: "1000", // Get all posts
		where: JSON.stringify({ status: { equals: "published" } }),
	})

	const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/posts?${params}`, {
		headers: getHeaders(),
	})

	const data = await handleResponse<PayloadResponse<PayloadPost>>(response)
	return data.docs.map((post) => post.slug)
}

