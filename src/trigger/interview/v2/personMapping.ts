import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/../supabase/types";
import {
  isPlaceholderPerson,
  normalizeSpeakerLabel,
} from "~/features/interviews/peopleNormalization.server";
import { resolveOrCreatePerson } from "~/lib/people/resolution.server";

export type RawPerson = {
  person_key: string;
  speaker_label: string | null;
  person_name?: string | null;
  inferred_name?: string | null;
  display_name?: string | null;
  role?: string | null;
  organization?: string | null;
  summary?: string | null;
  segments?: string[];
  personas?: string[];
  facets?: any[];
  scales?: any[];
};

export type MappedPerson = {
  personId: string;
  personKey: string;
  transcriptKey: string | null;
  name: string | null;
  role: string | null;
};

type PersonUpsertPayload = Database["public"]["Tables"]["people"]["Insert"];

export async function mapRawPeopleToInterviewLinks({
  db,
  rawPeople,
  accountId,
  projectId,
}: {
  db: SupabaseClient<Database>;
  rawPeople: RawPerson[];
  accountId: string;
  projectId: string | null;
}): Promise<{
  mapped: MappedPerson[];
  personIdByKey: Map<string, string>;
  speakerLabelByPersonId: Map<string, string>;
}> {
  const mapped: MappedPerson[] = [];
  const personIdByKey = new Map<string, string>();
  const speakerLabelByPersonId = new Map<string, string>();

  for (const raw of rawPeople) {
    const baseName =
      raw.person_name?.trim() ||
      raw.inferred_name?.trim() ||
      raw.display_name?.trim() ||
      "";

    if (isPlaceholderPerson(baseName)) {
      consola.info(
        `[personMapping] Skipping placeholder person "${baseName}" (${raw.person_key})`,
      );
      continue;
    }

    const transcriptKey = normalizeSpeakerLabel(raw.speaker_label);

    // Use shared resolution module for consistent person matching across all paths
    const result = await resolveOrCreatePerson(db, accountId, projectId, {
      name: baseName,
      firstname: baseName.split(" ")[0] || undefined,
      lastname: baseName.split(" ").slice(1).join(" ") || undefined,
      company: raw.organization || undefined,
      role: raw.role || undefined,
      person_type: raw.role === "interviewer" ? "internal" : null,
      source: "baml_extraction",
    });

    personIdByKey.set(raw.person_key, result.person.id);
    if (transcriptKey)
      speakerLabelByPersonId.set(result.person.id, transcriptKey);
    mapped.push({
      personId: result.person.id,
      personKey: raw.person_key,
      transcriptKey,
      name: result.person.name,
      role: raw.role ?? null,
    });

    consola.debug(
      `[personMapping] Resolved ${raw.person_key} → ${result.person.id} (${result.matchedBy})`,
    );
  }

  return { mapped, personIdByKey, speakerLabelByPersonId };
}
