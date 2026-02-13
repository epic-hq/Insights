import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { UserMetadata } from "~/server/user-context";
import type { Database, UserSettings } from "~/types";

const INTERNAL_PERSON_TYPE = "internal";

type PeopleRow = Database["public"]["Tables"]["people"]["Row"] & {
  person_type?: string | null;
  user_id?: string | null;
};

type PeopleInsert = Database["public"]["Tables"]["people"]["Insert"] & {
  person_type?: string | null;
  user_id?: string | null;
};

type PeopleUpdate = Database["public"]["Tables"]["people"]["Update"] & {
  person_type?: string | null;
  user_id?: string | null;
};

type AuthUserInfo = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type InternalPersonProfile = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  imageUrl: string | null;
  title: string | null;
  role: string | null;
  company: string | null;
  industry: string | null;
};

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function parseFullName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function buildInternalProfile({
  userSettings,
  userMetadata,
  authUser,
}: {
  userSettings?: UserSettings | null;
  userMetadata?: UserMetadata | null;
  authUser?: AuthUserInfo | null;
}): InternalPersonProfile {
  const settingsName = [userSettings?.first_name, userSettings?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const metadataName =
    userMetadata?.name ||
    readMetadataString(authUser?.user_metadata, "full_name");
  const email =
    userSettings?.email ||
    userMetadata?.email ||
    authUser?.email ||
    readMetadataString(authUser?.user_metadata, "email");

  const fallbackName = email ? email.split("@")[0] : "Team Member";
  const fullName = settingsName || metadataName || fallbackName;
  const { firstName, lastName } = parseFullName(fullName);

  return {
    firstName,
    lastName,
    fullName,
    email: email || null,
    imageUrl:
      userSettings?.image_url ||
      userMetadata?.avatar_url ||
      readMetadataString(authUser?.user_metadata, "avatar_url") ||
      readMetadataString(authUser?.user_metadata, "picture") ||
      null,
    title: userSettings?.title || null,
    role: userSettings?.role || null,
    company: userSettings?.company_name || null,
    industry: userSettings?.industry || null,
  };
}

function applyProfileUpdates({
  profile,
  current,
  allowNullUpdates,
}: {
  profile: InternalPersonProfile;
  current?: PeopleRow | null;
  allowNullUpdates: boolean;
}): PeopleUpdate {
  const update: PeopleUpdate = {
    person_type: INTERNAL_PERSON_TYPE,
  };

  const setIfChanged = (field: keyof PeopleUpdate, value: string | null) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0 && trimmed !== (current as any)?.[field]) {
        update[field] = trimmed as any;
        return;
      }
      if (allowNullUpdates && trimmed.length === 0) {
        update[field] = null;
      }
    } else if (allowNullUpdates && value === null) {
      update[field] = null;
    }
  };

  setIfChanged("firstname", profile.firstName);
  setIfChanged("lastname", profile.lastName);
  setIfChanged("primary_email", profile.email);
  setIfChanged("image_url", profile.imageUrl);
  setIfChanged("title", profile.title);
  setIfChanged("role", profile.role);

  return update;
}

export async function resolveInternalPerson({
  supabase,
  accountId,
  projectId,
  userId,
  userSettings,
  userMetadata,
  authUser,
  allowNullUpdates = false,
}: {
  supabase: SupabaseClient<Database>;
  accountId: string;
  projectId?: string | null;
  userId: string;
  userSettings?: UserSettings | null;
  userMetadata?: UserMetadata | null;
  authUser?: AuthUserInfo | null;
  allowNullUpdates?: boolean;
}): Promise<{ id: string; name: string | null } | null> {
  if (!userId) return null;

  let resolvedSettings = userSettings;
  if (!resolvedSettings) {
    const { data, error } = await supabase
      .from("user_settings")
      .select(
        "first_name, last_name, title, role, company_name, industry, email, image_url",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      consola.warn("[resolveInternalPerson] Failed to load user_settings", {
        userId,
        error: error.message,
      });
    } else if (data) {
      resolvedSettings = data as UserSettings;
    }
  }

  const profile = buildInternalProfile({
    userSettings: resolvedSettings,
    userMetadata,
    authUser,
  });

  const { data: existingByUser, error: existingByUserError } = await supabase
    .from("people")
    .select(
      "id, name, firstname, lastname, primary_email, image_url, title, role, person_type, user_id",
    )
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingByUserError) {
    consola.warn(
      "[resolveInternalPerson] Failed to lookup internal person by user_id",
      {
        userId,
        error: existingByUserError.message,
      },
    );
  }

  const existingRow = (existingByUser as PeopleRow | null) ?? null;

  if (existingRow?.id) {
    const update = applyProfileUpdates({
      profile,
      current: existingRow,
      allowNullUpdates,
    });
    update.user_id = userId;

    if (Object.keys(update).length > 1) {
      const { error: updateError } = await supabase
        .from("people")
        .update(update)
        .eq("id", existingRow.id);
      if (updateError) {
        consola.warn(
          "[resolveInternalPerson] Failed to update internal person",
          {
            personId: existingRow.id,
            error: updateError.message,
          },
        );
      }
    }

    return { id: existingRow.id, name: existingRow.name ?? profile.fullName };
  }

  const findByEmail = async () => {
    if (!profile.email) return null;
    const { data } = await supabase
      .from("people")
      .select(
        "id, name, firstname, lastname, primary_email, image_url, title, role, person_type, user_id",
      )
      .eq("account_id", accountId)
      .eq("primary_email", profile.email)
      .maybeSingle();
    return (data as PeopleRow | null) ?? null;
  };

  const findByName = async () => {
    if (!profile.fullName) return null;
    const { data } = await supabase
      .from("people")
      .select(
        "id, name, firstname, lastname, primary_email, image_url, title, role, person_type, user_id",
      )
      .eq("account_id", accountId)
      .eq("name", profile.fullName)
      .maybeSingle();
    return (data as PeopleRow | null) ?? null;
  };

  const attachExisting = async (row: PeopleRow | null) => {
    if (!row?.id) return null;
    const update = applyProfileUpdates({
      profile,
      current: row,
      allowNullUpdates,
    });
    update.user_id = userId;
    const { error: updateError } = await supabase
      .from("people")
      .update(update)
      .eq("id", row.id);
    if (updateError) {
      consola.warn("[resolveInternalPerson] Failed to attach user to person", {
        personId: row.id,
        error: updateError.message,
      });
    }
    return { id: row.id, name: row.name ?? profile.fullName };
  };

  const existingByEmail = await findByEmail();
  if (existingByEmail) {
    return await attachExisting(existingByEmail);
  }

  const existingByName = await findByName();
  if (existingByName) {
    return await attachExisting(existingByName);
  }

  const insertPayload: PeopleInsert = {
    account_id: accountId,
    project_id: projectId ?? null,
    user_id: userId,
    person_type: INTERNAL_PERSON_TYPE,
    firstname: profile.firstName,
    lastname: profile.lastName,
    primary_email: profile.email,
    image_url: profile.imageUrl,
    title: profile.title,
    role: profile.role,
  };

  const { data: created, error: createError } = await supabase
    .from("people")
    .insert(insertPayload)
    .select("id, name")
    .single();

  if (createError || !created) {
    if (createError?.code === "23505") {
      const fallback = (await findByEmail()) || (await findByName());
      if (fallback) return await attachExisting(fallback);
    }

    consola.warn("[resolveInternalPerson] Failed to create internal person", {
      accountId,
      userId,
      error: createError?.message,
    });
    return null;
  }

  return { id: created.id, name: created.name ?? profile.fullName };
}

export async function ensureInterviewInterviewerLink({
  supabase,
  accountId,
  projectId,
  interviewId,
  userId,
  userSettings,
  userMetadata,
  authUser,
}: {
  supabase: SupabaseClient<Database>;
  accountId: string;
  projectId?: string | null;
  interviewId: string;
  userId: string;
  userSettings?: UserSettings | null;
  userMetadata?: UserMetadata | null;
  authUser?: AuthUserInfo | null;
}): Promise<{ personId: string; personName: string | null } | null> {
  const internalPerson = await resolveInternalPerson({
    supabase,
    accountId,
    projectId,
    userId,
    userSettings,
    userMetadata,
    authUser,
  });

  if (!internalPerson) return null;

  const { error: linkError } = await supabase.from("interview_people").upsert(
    {
      interview_id: interviewId,
      person_id: internalPerson.id,
      project_id: projectId ?? null,
      role: "interviewer",
      display_name: internalPerson.name,
    },
    { onConflict: "interview_id,person_id" },
  );

  if (linkError) {
    consola.warn(
      "[ensureInterviewInterviewerLink] Failed to link internal person",
      {
        interviewId,
        personId: internalPerson.id,
        error: linkError.message,
      },
    );
    return null;
  }

  return { personId: internalPerson.id, personName: internalPerson.name };
}
