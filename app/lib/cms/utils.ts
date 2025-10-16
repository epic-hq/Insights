/**
 * Client-safe CMS utility functions
 * 
 * These functions can be used on both client and server
 */

import type { PayloadImage } from "~/lib/cms/payload.server"

/**
 * Helper to format image URL
 */
export function getImageUrl(image: PayloadImage | undefined): string | null {
	if (!image) return null
	
	// Handle URL field
	if (image.url) {
		// If URL is relative, prepend CMS URL
		if (image.url.startsWith("/")) {
			return `https://upsight-cms.vercel.app${image.url}`
		}
		return image.url
	}
	
	// Handle filename field (fallback)
	if (image.filename) {
		return `https://upsight-cms.vercel.app/api/media/file/${image.filename}`
	}

	return null
}

/**
 * Helper to format date
 */
export function formatDate(dateString: string): string {
	const date = new Date(dateString)
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	})
}

/**
 * Helper to get reading time estimate
 * Handles both string content and rich text objects from Payload CMS
 */
export function getReadingTime(content: string | any): number {
	const wordsPerMinute = 200
	
	// If content is not a string, try to extract text from rich text object
	let textContent = ""
	
	if (typeof content === "string") {
		textContent = content
	} else if (content && typeof content === "object") {
		// Handle Payload CMS rich text (Lexical format)
		textContent = extractTextFromRichText(content)
	}
	
	// Strip HTML tags if present
	const plainText = textContent.replace(/<[^>]*>/g, " ")
	const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length
	
	return Math.max(1, Math.ceil(wordCount / wordsPerMinute))
}

/**
 * Extract plain text from Payload CMS rich text object
 */
function extractTextFromRichText(richText: any): string {
	if (!richText) return ""
	
	// Handle Lexical format (root with children)
	if (richText.root && Array.isArray(richText.root.children)) {
		return extractTextFromNodes(richText.root.children)
	}
	
	// Handle array of nodes directly
	if (Array.isArray(richText)) {
		return extractTextFromNodes(richText)
	}
	
	// Fallback to string conversion
	return String(richText)
}

/**
 * Recursively extract text from Lexical nodes
 */
function extractTextFromNodes(nodes: any[]): string {
	let text = ""
	
	for (const node of nodes) {
		if (!node) continue
		
		// Text node
		if (node.text) {
			text += node.text + " "
		}
		
		// Node with children
		if (node.children && Array.isArray(node.children)) {
			text += extractTextFromNodes(node.children) + " "
		}
	}
	
	return text
}

/**
 * Convert Lexical rich text to HTML
 * This should only be called on the server (in loaders)
 */
export function lexicalToHtml(content: any): string {
	if (!content) return ""
	
	// If already a string, return it
	if (typeof content === "string") return content
	
	// Use custom converter - works on both server and client
	if (content.root && Array.isArray(content.root.children)) {
		return convertNodesToHtml(content.root.children)
	}
	
	return ""
}

/**
 * Convert Lexical nodes to HTML
 */
function convertNodesToHtml(nodes: any[]): string {
	let html = ""
	
	for (const node of nodes) {
		if (!node) continue
		
		switch (node.type) {
			case "paragraph": {
				const content = node.children ? convertNodesToHtml(node.children) : ""
				html += `<p>${content}</p>`
				break
			}
			case "heading": {
				const tag = node.tag || "h2"
				const content = node.children ? convertNodesToHtml(node.children) : ""
				html += `<${tag}>${content}</${tag}>`
				break
			}
			case "text": {
				let text = node.text || ""
				
				// Escape HTML entities
				text = text
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;")
					.replace(/"/g, "&quot;")
					.replace(/'/g, "&#039;")
				
				// Handle formatting with proper nesting
				const format = node.format || 0
				
				// Apply formatting in order: code, bold, italic, underline, strikethrough
				if (format & 16) text = `<code>${text}</code>` // Code (highest priority)
				if (format & 1) text = `<strong>${text}</strong>` // Bold
				if (format & 2) text = `<em>${text}</em>` // Italic
				if (format & 8) text = `<u>${text}</u>` // Underline
				if (format & 4) text = `<s>${text}</s>` // Strikethrough
				
				html += text
				break
			}
			case "linebreak":
				html += "<br />"
				break
			case "link": {
				const url = node.fields?.url || node.url || "#"
				const target = node.fields?.newTab ? ' target="_blank" rel="noopener noreferrer"' : ""
				const content = node.children ? convertNodesToHtml(node.children) : ""
				html += `<a href="${url}"${target}>${content}</a>`
				break
			}
			case "list": {
				const listTag = node.listType === "number" || node.tag === "ol" ? "ol" : "ul"
				const content = node.children ? convertNodesToHtml(node.children) : ""
				html += `<${listTag}>${content}</${listTag}>`
				break
			}
			case "listitem": {
				const content = node.children ? convertNodesToHtml(node.children) : ""
				html += `<li>${content}</li>`
				break
			}
			case "quote": {
				const content = node.children ? convertNodesToHtml(node.children) : ""
				html += `<blockquote>${content}</blockquote>`
				break
			}
			case "block": {
				// Handle custom blocks
				const content = node.children ? convertNodesToHtml(node.children) : ""
				html += `<div>${content}</div>`
				break
			}
			case "upload": {
				// Handle image uploads from Payload CMS
				if (node.value?.url) {
					const imageUrl = node.value.url.startsWith("http") 
						? node.value.url 
						: `https://upsight-cms.vercel.app${node.value.url}`
					const alt = node.value?.alt || ""
					const caption = node.fields?.caption || ""
					html += `<figure><img src="${imageUrl}" alt="${alt}" />`
					if (caption) html += `<figcaption>${caption}</figcaption>`
					html += "</figure>"
				}
				break
			}
			case "horizontalrule":
				html += "<hr />"
				break
			default:
				// For unknown types, just process children
				if (node.children && Array.isArray(node.children)) {
					html += convertNodesToHtml(node.children)
				} else if (node.text) {
					// Fallback for text nodes
					html += node.text
				}
				break
		}
	}
	
	return html
}
