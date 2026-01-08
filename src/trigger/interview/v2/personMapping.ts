import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/../supabase/types";
import {
  isPlaceholderPerson,
  normalizeSpeakerLabel,
  upsertPersonWithCompanyAwareConflict,
} from "~/features/interviews/peopleNormalization.server";

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
    const payload: PersonUpsertPayload = {
      account_id: accountId,
      project_id: projectId,
      firstname: baseName.split(" ")[0] || null,
      lastname: baseName.split(" ").slice(1).join(" ") || null,
      company: raw.organization || "", // DB has NOT NULL default ''
      role: raw.role ?? null,
    };

    const upserted = await upsertPersonWithCompanyAwareConflict(
      db,
      payload,
      null,
    );

    personIdByKey.set(raw.person_key, upserted.id);
    if (transcriptKey) speakerLabelByPersonId.set(upserted.id, transcriptKey);
    mapped.push({
      personId: upserted.id,
      personKey: raw.person_key,
      transcriptKey,
      name: upserted.name,
      role: raw.role ?? null,
    });
  }

  return { mapped, personIdByKey, speakerLabelByPersonId };
}
