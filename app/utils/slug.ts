/**
 * Slug generation utilities using nanoid with BASE58 alphabet.
 * BASE58 excludes 0, O, I, l to avoid ambiguity.
 */
import { customAlphabet } from "nanoid/non-secure"

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

/**
 * Generate a 6-character random slug using BASE58 alphabet.
 * Example output: 'f3GkQp', 'aBc123', etc.
 */
export const generateSlug = customAlphabet(BASE58, 6)

/**
 * Generate a public slug for a project.
 * Returns a unique 6-character BASE58 slug.
 */
export function generatePublicSlug(): string {
	return generateSlug()
}
