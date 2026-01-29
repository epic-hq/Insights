import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/../supabase/types";

type PeopleInsert = Database["public"]["Tables"]["people"]["Insert"];

function computeNameHash(payload: PeopleInsert): string {
  const first = (payload.firstname ?? "").trim();
  const last = (payload.lastname ?? "").trim();
  const full = first && last ? `${first} ${last}` : first || last || "";
  return full.trim().toLowerCase();
}

/**
 * Normalize speaker labels to a consistent "SPEAKER X" format.
 */
export function normalizeSpeakerLabel(label: string | null): string | null {
  if (!label) return null;

  const trimmed = label.trim();

  // Match "A" or "Speaker A" or "SPEAKER A"
  const singleLetter = trimmed.match(/^(?:SPEAKER\s+)?([A-Z])$/i);
  if (singleLetter) {
    return `SPEAKER ${singleLetter[1].toUpperCase()}`;
  }

  // Match "Speaker 1" -> "SPEAKER A"
  const numbered = trimmed.match(/^SPEAKER[\s_-]?(\d+)$/i);
  if (numbered) {
    const num = Number.parseInt(numbered[1], 10);
    if (!Number.isNaN(num) && num >= 1 && num <= 26) {
      return `SPEAKER ${String.fromCharCode(64 + num)}`;
    }
  }

  return trimmed.toUpperCase();
}

/**
 * Heuristic to skip placeholder participants emitted by ASR/LLM.
 */
export function isPlaceholderPerson(name: string): boolean {
  if (!name) return true;
  return (
    /^participant\s*\d+$/i.test(name.trim()) ||
    /^speaker\s+[A-Z]$/i.test(name.trim())
  );
}

/**
 * Upsert person with company-aware conflict handling and optional person_type.
 * Uses try-insert-then-find pattern since the unique index includes email.
 */
export async function upsertPersonWithCompanyAwareConflict(
  db: SupabaseClient<Database>,
  payload: PeopleInsert,
  personType?: PeopleInsert["person_type"],
) {
  // Normalize company for consistent matching
  const normalizedCompanyRaw =
    typeof payload.company === "string" && payload.company.trim().length > 0
      ? payload.company.trim()
      : "";
  const normalizedCompany = normalizedCompanyRaw.toLowerCase() || null;

  // Normalize email for consistent matching
  const normalizedEmail =
    typeof payload.primary_email === "string" &&
    payload.primary_email.trim().length > 0
      ? payload.primary_email.trim().toLowerCase()
      : null;

  const insertPayload: PeopleInsert = {
    ...payload,
    company: normalizedCompany,
    primary_email: normalizedEmail,
    person_type: personType ?? payload.person_type ?? null,
  };

  // Try insert first
  const { data, error } = await db
    .from("people")
    .insert(insertPayload)
    .select("id, name")
    .single();

  if (error) {
    // Handle unique constraint violation (duplicate person)
    if ((error as { code?: string })?.code === "23505") {
      const nameHash = computeNameHash(insertPayload);

      // Find existing by name_hash, company, and email (matching the unique index)
      let findQuery = db
        .from("people")
        .select("id, name")
        .eq("account_id", insertPayload.account_id!)
        .eq("name_hash", nameHash);

      // Match company (null or value)
      if (normalizedCompany) {
        findQuery = findQuery.ilike("company", normalizedCompany);
      } else {
        findQuery = findQuery.is("company", null);
      }

      // Match email (null or value)
      if (normalizedEmail) {
        findQuery = findQuery.ilike("primary_email", normalizedEmail);
      } else {
        findQuery = findQuery.is("primary_email", null);
      }

      const { data: existing, error: findError } = await findQuery
        .limit(1)
        .single();

      if (findError || !existing?.id) {
        // Try broader search without email constraint for interview participants
        const { data: broadMatch } = await db
          .from("people")
          .select("id, name")
          .eq("account_id", insertPayload.account_id!)
          .eq("name_hash", nameHash)
          .ilike("company", normalizedCompany || "")
          .limit(1)
          .single();

        if (broadMatch?.id) {
          return { id: broadMatch.id, name: broadMatch.name ?? null };
        }

        throw new Error(
          `Person already exists but could not be found: ${insertPayload.firstname} ${insertPayload.lastname}`,
        );
      }

      return { id: existing.id, name: existing.name ?? null };
    }

    throw new Error(error.message || "Failed to insert person");
  }

  return { id: data.id, name: data.name ?? null };
}
