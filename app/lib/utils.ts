import type { SupabaseClient } from "@supabase/supabase-js"
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { z } from "zod"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

function isUUID(str: string): boolean {
	const uuidSchema = z.string().uuid()
	return uuidSchema.safeParse(str).success
}

const parseIdParamsSchema = z.object({
	idOrSlug: z.string(),
	supabase: z.any(), // SupabaseClient type is not directly supported by zod
	type: z.enum(["account", "project"]),
	userId: z.string().optional(),
	accountId: z.string().optional(),
})

export async function parseIdFromParams({
	idOrSlug,
	supabase,
	type,
	userId,
	accountId,
}: {
	idOrSlug: string
	supabase: SupabaseClient
	type: "account" | "project"
	userId?: string
	accountId?: string
}) {
	// Validate inputs
	const validation = parseIdParamsSchema.safeParse({
		idOrSlug,
		supabase,
		type,
		userId,
		accountId,
	})
	if (!validation.success) {
		throw new Error("Invalid input parameters")
	}

	if (isUUID(idOrSlug)) {
		const table = type === "account" ? "accounts" : "projects"
		const { data, error } = await supabase.from(table).select("*").eq("id", idOrSlug).single()
		if (error || !data) {
			return { data: null, error: error || new Error("No data found") }
		}
		return { data, error: null }
	}
	// Handle invalid UUID case
	return { data: null, error: new Error("Invalid UUID") }
}
