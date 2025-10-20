/**
 * Payload CMS Client
 *
 * Handles all API calls to Payload CMS for blog posts and other content.
 */

import { stringify } from "qs-esm"
import { getServerEnv } from "~/env.server"

// Payload CMS Where clause type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Where = Record<string, any>

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
	const { limit = 10, page = 1 } = options || {}
	const env = getServerEnv()

	const queryString = stringify(
		{
			limit,
			page,
			sort: "-publishedAt",
		},
		{ addQueryPrefix: true }
	)

	const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/posts${queryString}`, {
		headers: getHeaders(),
	})

	return handleResponse<PayloadResponse<PayloadPost>>(response)
}

/**
 * Fetch a single blog post by slug
 */
export async function getPostBySlug(slug: string): Promise<PayloadPost | null> {
	const env = getServerEnv()

	const where: Where = {
		slug: { equals: slug },
	}

	const queryString = stringify(
		{
			where,
			limit: 1,
		},
		{ addQueryPrefix: true }
	)

	const url = `${env.PAYLOAD_CMS_URL}/api/posts${queryString}`

	const response = await fetch(url, {
		headers: getHeaders(),
	})

	if (!response.ok) {
		const errorText = await response.text()
		console.error("Payload CMS error:", response.status, errorText)
		throw new Error(`Failed to fetch post: ${response.status}`)
	}

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

	const where: Where = {
		or: [{ title: { contains: query } }, { excerpt: { contains: query } }],
	}

	const queryString = stringify(
		{
			where,
			limit,
			sort: "-publishedAt",
		},
		{ addQueryPrefix: true }
	)

	const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/posts${queryString}`, {
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

	const queryString = stringify(
		{
			limit: 1000,
		},
		{ addQueryPrefix: true }
	)

	const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/posts${queryString}`, {
		headers: getHeaders(),
	})

	const data = await handleResponse<PayloadResponse<PayloadPost>>(response)
	return data.docs.map((post) => post.slug)
}
