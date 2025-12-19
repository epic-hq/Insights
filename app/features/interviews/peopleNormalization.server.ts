import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/../supabase/types"

type PeopleInsert = Database["public"]["Tables"]["people"]["Insert"]

function computeNameHash(payload: PeopleInsert): string {
	const first = (payload.firstname ?? "").trim()
	const last = (payload.lastname ?? "").trim()
	const full = first && last ? `${first} ${last}` : first || last || ""
	return full.trim().toLowerCase()
}

/**
 * Normalize speaker labels to a consistent "SPEAKER X" format.
 */
export function normalizeSpeakerLabel(label: string | null): string | null {
	if (!label) return null

	const trimmed = label.trim()

	// Match "A" or "Speaker A" or "SPEAKER A"
	const singleLetter = trimmed.match(/^(?:SPEAKER\s+)?([A-Z])$/i)
	if (singleLetter) {
		return `SPEAKER ${singleLetter[1].toUpperCase()}`
	}

	// Match "Speaker 1" -> "SPEAKER A"
	const numbered = trimmed.match(/^SPEAKER[\s_-]?(\d+)$/i)
	if (numbered) {
		const num = Number.parseInt(numbered[1], 10)
		if (!Number.isNaN(num) && num >= 1 && num <= 26) {
			return `SPEAKER ${String.fromCharCode(64 + num)}`
		}
	}

	return trimmed.toUpperCase()
}

/**
 * Heuristic to skip placeholder participants emitted by ASR/LLM.
 */
export function isPlaceholderPerson(name: string): boolean {
	if (!name) return true
	return /^participant\s*\d+$/i.test(name.trim()) || /^speaker\s+[A-Z]$/i.test(name.trim())
}

/**
 * Upsert person with company-aware conflict target and optional person_type.
 */
export async function upsertPersonWithCompanyAwareConflict(
	db: SupabaseClient<Database>,
	payload: PeopleInsert,
	personType?: PeopleInsert["person_type"]
) {
	// Normalize company so ON CONFLICT hits the plain (account_id, name_hash, company) index
	// and matches the expression index (COALESCE(lower(company), '')).
	const normalizedCompanyRaw =
		typeof payload.company === "string" && payload.company.trim().length > 0 ? payload.company.trim() : ""
	const normalizedCompany = normalizedCompanyRaw.toLowerCase()

	const insertPayload: PeopleInsert = {
		...payload,
		company: normalizedCompany,
		person_type: personType ?? payload.person_type ?? null,
	}

	const { data, error } = await db
		.from("people")
		.upsert(insertPayload, { onConflict: "account_id,name_hash,company" })
		.select("id, name")
		.single()

	if (error || !data?.id) {
		if ((error as any)?.code === "23505") {
			// Duplicate constraint hit; fetch existing row by name_hash/company
			const nameHash = computeNameHash(insertPayload)
			const { data: existing } = await db
				.from("people")
				.select("id, name")
				.eq("account_id", insertPayload.account_id!)
				.eq("name_hash", nameHash)
				.eq("company", normalizedCompany)
				.single()
			if (existing?.id) {
				return { id: existing.id, name: existing.name ?? null }
			}
		}
		if ((error as any)?.code === "42P10") {
			throw new Error(
				"Missing unique index on people(account_id,name_hash,company). Apply the company-aware migration and retry."
			)
		}
		throw new Error(error?.message || "Failed to upsert person")
	}

	return { id: data.id, name: data.name ?? null }
}
