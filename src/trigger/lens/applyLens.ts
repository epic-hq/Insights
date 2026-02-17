/**
 * Apply a single conversation lens to an interview
 *
 * Uses the generic ApplyConversationLens BAML function that works with any template.
 * The template definition from the database drives the extraction - no hardcoded logic.
 * Results are stored in conversation_lens_analyses.analysis_data as flexible JSONB.
 * Next steps are created as real tasks in the tasks table.
 */

import { metadata, task } from "@trigger.dev/sdk";
import consola from "consola";

import { createTask } from "~/features/tasks/db";
import {
  runBamlWithBilling,
  systemBillingContext,
} from "~/lib/billing/instrumented-baml.server";
import type { TaskStatus } from "~/features/tasks/types";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { workflowRetryConfig } from "../interview/v2/config";

// Progress stages for lens application
const LENS_STAGES = {
  loading: { percent: 10, label: "Loading interview data..." },
  extracting: { percent: 40, label: "Extracting insights with AI..." },
  enriching: { percent: 70, label: "Enriching entities..." },
  tasks: { percent: 85, label: "Creating tasks..." },
  saving: { percent: 95, label: "Saving results..." },
  complete: { percent: 100, label: "Analysis complete!" },
} as const;

function setLensProgress(
  stage: keyof typeof LENS_STAGES,
  templateName?: string,
) {
  const { percent, label } = LENS_STAGES[stage];
  metadata.set("progressPercent", percent);
  metadata.set(
    "stageLabel",
    templateName ? `${templateName}: ${label}` : label,
  );
  metadata.set("stage", stage);
}

export type ApplyLensPayload = {
  interviewId: string;
  templateKey: string;
  accountId: string;
  projectId?: string | null;
  computedBy?: string | null;
  customInstructions?: string | null;
};

function toUuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(trimmed) ? trimmed : null;
}

/**
 * Map lens template category to task cluster
 */
function mapCategoryToCluster(category: string | null): string {
  switch (category) {
    case "sales":
      return "Sales";
    case "research":
      return "Research";
    case "product":
      return "Product";
    default:
      // Use capitalized category or default to "General"
      return category
        ? category.charAt(0).toUpperCase() + category.slice(1)
        : "General";
  }
}

/**
 * Map next_step status to task status
 */
function mapNextStepStatusToTaskStatus(status: string | null): TaskStatus {
  switch (status) {
    case "pending":
      return "todo";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "done";
    default:
      return "todo"; // Default to todo for new items
  }
}

/**
 * Map next_step priority to task priority (1=Now, 2=Next, 3=Later)
 */
function mapPriorityToTaskPriority(priority: string | null): 1 | 2 | 3 {
  switch (priority) {
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 2; // Default to "Next" priority
  }
}

type InterviewParticipant = {
  person_id: string;
  display_name: string | null;
  role: string | null;
};

/**
 * Build interview context string for BAML prompts
 */
function buildInterviewContext(interview: {
  title?: string | null;
  interview_date?: string | null;
  duration_sec?: number | null;
}): string {
  const parts: string[] = [];
  if (interview.title) parts.push(`Title: ${interview.title}`);
  if (interview.interview_date) parts.push(`Date: ${interview.interview_date}`);
  if (interview.duration_sec)
    parts.push(`Duration: ${Math.round(interview.duration_sec / 60)} minutes`);
  return parts.join("\n") || "No context available";
}

function normalizeKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeExtractionSections(
  templateDefinition: any,
  extraction: any,
): any {
  const templateSections = Array.isArray(templateDefinition?.sections)
    ? templateDefinition.sections
    : [];
  if (templateSections.length === 0 || !extraction || typeof extraction !== "object") {
    return extraction;
  }

  const sourceSections = Array.isArray(extraction.sections) ? extraction.sections : [];
  const templateSectionByNormalized = new Map<string, any>();
  const templateSectionByField = new Map<string, string>();
  const mergedSections = new Map<string, { section_key: string; summary?: string; fields: any[] }>();
  const unmatchedSections: any[] = [];

  for (const sectionDef of templateSections) {
    if (!sectionDef?.section_key) continue;
    templateSectionByNormalized.set(normalizeKey(sectionDef.section_key), sectionDef);
    for (const fieldDef of sectionDef.fields || []) {
      if (fieldDef?.field_key) {
        templateSectionByField.set(fieldDef.field_key, sectionDef.section_key);
      }
    }
    mergedSections.set(sectionDef.section_key, {
      section_key: sectionDef.section_key,
      fields: (sectionDef.fields || []).map((fieldDef: any) => ({
        field_key: fieldDef.field_key,
        value: null,
        confidence: null,
        evidence_ids: [],
      })),
    });
  }

  for (const section of sourceSections) {
    const target =
      templateSectionByNormalized.get(normalizeKey(section?.section_key)) || null;
    if (!target) {
      unmatchedSections.push(section);
      continue;
    }
    const existing = mergedSections.get(target.section_key) || {
      section_key: target.section_key,
      fields: [],
    };
    const fieldMap = new Map((existing.fields || []).map((field: any) => [field.field_key, field]));
    for (const field of section?.fields || []) {
      if (!field?.field_key) continue;
      fieldMap.set(field.field_key, field);
    }
    mergedSections.set(target.section_key, {
      section_key: target.section_key,
      summary:
        typeof section?.summary === "string" && section.summary.trim()
          ? section.summary
          : existing.summary,
      fields: Array.from(fieldMap.values()),
    });
  }

  for (const section of unmatchedSections) {
    for (const field of section?.fields || []) {
      const ownerKey = templateSectionByField.get(field?.field_key);
      if (!ownerKey) continue;
      const existing = mergedSections.get(ownerKey);
      if (!existing) continue;
      const fieldMap = new Map((existing.fields || []).map((f: any) => [f.field_key, f]));
      fieldMap.set(field.field_key, field);
      mergedSections.set(ownerKey, {
        ...existing,
        fields: Array.from(fieldMap.values()),
      });
    }
  }

  return {
    ...extraction,
    sections: templateSections.map((sectionDef: any) => {
      const merged = mergedSections.get(sectionDef.section_key);
      return (
        merged || {
          section_key: sectionDef.section_key,
          fields: [],
        }
      );
    }),
  };
}

/**
 * Find the best matching task using keyword similarity
 * Returns the task if a good match is found (>= 2 key words match)
 */
function findBestMatchingTask(
  description: string,
  tasks: Array<{ id: string; title: string }>,
): { id: string; title: string } | null {
  if (!description || tasks.length === 0) return null;

  const normalizedDesc = description.toLowerCase().trim();
  // Extract key words (length > 4 to skip common words like "the", "and", etc.)
  const keyWords = normalizedDesc.split(/\s+/).filter((w) => w.length > 4);

  let bestMatch: { id: string; title: string } | null = null;
  let bestScore = 0;

  for (const task of tasks) {
    const taskTitle = task.title?.toLowerCase() || "";
    let score = 0;
    for (const word of keyWords) {
      if (taskTitle.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = task;
    }
  }

  // Require at least 2 matching key words for a valid match
  return bestScore >= 2 ? bestMatch : null;
}

/**
 * Match a name string to interview participants
 * Returns the matched participant or null
 */
function matchNameToParticipant(
  name: string | null | undefined,
  participants: InterviewParticipant[],
): InterviewParticipant | null {
  if (!name || participants.length === 0) return null;

  const nameLower = name.toLowerCase().trim();

  // Try exact match first
  const exactMatch = participants.find(
    (p) => p.display_name?.toLowerCase().trim() === nameLower,
  );
  if (exactMatch) return exactMatch;

  // Try partial match (name contains or is contained by)
  const partialMatch = participants.find(
    (p) =>
      p.display_name?.toLowerCase().includes(nameLower) ||
      nameLower.includes(p.display_name?.toLowerCase() || ""),
  );
  if (partialMatch) return partialMatch;

  // Try first name match
  const firstName = nameLower.split(" ")[0];
  if (firstName.length > 2) {
    const firstNameMatch = participants.find((p) =>
      p.display_name?.toLowerCase().startsWith(firstName),
    );
    if (firstNameMatch) return firstNameMatch;
  }

  return null;
}

/**
 * Post-process extraction result to match entity names to people records
 */
function enrichEntitiesWithPeople(
  result: any,
  participants: InterviewParticipant[],
): any {
  if (!result?.entities || participants.length === 0) return result;

  // Process each entity type
  for (const entityResult of result.entities || []) {
    if (!entityResult.items) continue;

    entityResult.items = entityResult.items.map((item: any, idx: number) => {
      // Try to match name field to participants
      const matched = matchNameToParticipant(item.name, participants);
      return {
        ...item,
        person_id: matched?.person_id || null,
        entity_key: `${entityResult.entity_type}-${idx}`,
        candidate_name: matched ? null : item.name,
      };
    });
  }

  return result;
}

/**
 * Parse a full name into first/last components
 */
function parseFullName(name: string): {
  firstName: string | null;
  lastName: string | null;
} {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Create or find People records from stakeholders and link to interview
 * CRM-style: stakeholders mentioned in conversations become People records
 */
async function resolveStakeholdersToPeople({
  client,
  result,
  accountId,
  projectId,
  interviewId,
}: {
  client: any;
  result: any;
  accountId: string;
  projectId: string | null;
  interviewId: string;
}): Promise<{ createdPeopleIds: string[]; linkedPeopleIds: string[] }> {
  const createdPeopleIds: string[] = [];
  const linkedPeopleIds: string[] = [];

  // Find stakeholders entity
  const stakeholdersEntity = (result.entities || []).find(
    (e: any) => e.entity_type === "stakeholders",
  );
  const stakeholders = stakeholdersEntity?.stakeholders || [];

  if (stakeholders.length === 0) {
    return { createdPeopleIds, linkedPeopleIds };
  }

  consola.info(
    `[applyLens] Resolving ${stakeholders.length} stakeholders to People records`,
  );

  for (let i = 0; i < stakeholders.length; i++) {
    const stakeholder = stakeholders[i];
    const name = stakeholder.name?.trim();

    if (!name) continue;

    // Skip if already matched to a person
    if (stakeholder.person_id) {
      linkedPeopleIds.push(stakeholder.person_id);
      continue;
    }

    // Try to find existing person by name or email in this account
    let personId: string | null = null;

    // Search by email first (most reliable)
    if (stakeholder.email) {
      const { data: byEmail } = await client
        .from("people")
        .select("id")
        .eq("account_id", accountId)
        .eq("primary_email", stakeholder.email.toLowerCase())
        .maybeSingle();
      if (byEmail) personId = byEmail.id;
    }

    // Search by name if no email match
    if (!personId) {
      const { data: byName } = await client
        .from("people")
        .select("id")
        .eq("account_id", accountId)
        .eq("name", name)
        .maybeSingle();
      if (byName) personId = byName.id;
    }

    // Create new person if not found
    if (!personId) {
      const { firstName, lastName } = parseFullName(name);
      const { data: created, error: createError } = await client
        .from("people")
        .insert({
          account_id: accountId,
          project_id: projectId,
          firstname: firstName,
          lastname: lastName,
          title: stakeholder.role || null,
          primary_email: stakeholder.email?.toLowerCase() || null,
          company: stakeholder.organization || "", // DB has NOT NULL default ''
          contact_info: {
            stakeholder_labels: stakeholder.labels || [],
            influence: stakeholder.influence || null,
            source: "lens_extraction",
          },
        })
        .select("id")
        .single();

      if (createError) {
        consola.warn(
          `[applyLens] Failed to create person for "${name}":`,
          createError.message,
        );
        continue;
      }

      personId = created.id;
      createdPeopleIds.push(personId);
      consola.info(`[applyLens] Created person "${name}" (${personId})`);
    } else {
      linkedPeopleIds.push(personId);
    }

    // Update stakeholder with person_id
    stakeholder.person_id = personId;

    // Link to interview via interview_people
    const roleLabel = stakeholder.labels?.includes("champion")
      ? "champion"
      : stakeholder.labels?.includes("blocker")
        ? "blocker"
        : stakeholder.labels?.includes("economic_buyer")
          ? "decision_maker"
          : stakeholder.role || "stakeholder";

    const { error: linkError } = await client.from("interview_people").upsert(
      {
        interview_id: interviewId,
        person_id: personId,
        project_id: projectId,
        role: roleLabel,
        display_name: name,
      },
      { onConflict: "interview_id,person_id" },
    );

    if (linkError) {
      consola.warn(
        `[applyLens] Failed to link person "${name}" to interview:`,
        linkError.message,
      );
    }
  }

  return { createdPeopleIds, linkedPeopleIds };
}

export const applyLensTask = task({
  id: "lens.apply-lens",
  retry: workflowRetryConfig,
  run: async (payload: ApplyLensPayload) => {
    const {
      interviewId,
      templateKey,
      accountId,
      projectId,
      computedBy,
      customInstructions,
    } = payload;
    const computedByUserId = toUuidOrNull(computedBy);
    const client = createSupabaseAdminClient();

    consola.info(
      `[applyLens] Applying ${templateKey} to interview ${interviewId}`,
    );
    setLensProgress("loading");

    // 1. Load template definition from database
    type TemplateRow = {
      template_key: string;
      template_name: string;
      template_definition: any;
      category: string | null;
      is_active: boolean;
    };

    const { data: template, error: templateError } = (await (client as any)
      .from("conversation_lens_templates")
      .select(
        "template_key, template_name, template_definition, category, is_active",
      )
      .eq("template_key", templateKey)
      .single()) as { data: TemplateRow | null; error: any };

    if (templateError || !template) {
      throw new Error(`Template not found: ${templateKey}`);
    }

    if (!template.is_active) {
      consola.warn(
        `[applyLens] Template ${templateKey} is not active, skipping`,
      );
      return { skipped: true, reason: "template_inactive" };
    }

    // 2. Load interview
    type InterviewRow = {
      id: string;
      title: string | null;
      interview_date: string | null;
      duration_sec: number | null;
      lens_visibility: string | null;
      project_id: string | null;
    };

    const { data: interview, error: interviewError } = (await (client as any)
      .from("interviews")
      .select(
        "id, title, interview_date, duration_sec, lens_visibility, project_id",
      )
      .eq("id", interviewId)
      .single()) as { data: InterviewRow | null; error: any };

    if (interviewError) {
      consola.error(
        `[applyLens] Supabase error loading interview:`,
        interviewError,
      );
      throw new Error(
        `Failed to load interview ${interviewId}: ${interviewError.message}`,
      );
    }
    if (!interview) {
      throw new Error(`Interview not found: ${interviewId}`);
    }

    // Skip if private
    if (interview.lens_visibility === "private") {
      consola.info(`[applyLens] Skipping private interview ${interviewId}`);
      return { skipped: true, reason: "private" };
    }

    // 3. Load evidence (interview evidence + survey evidence from same project)
    type EvidenceRow = {
      id: string;
      gist: string | null;
      verbatim: string | null;
      chunk: string | null;
      anchors: any | null;
      created_at: string;
    };

    const { data: interviewEvidence, error: evidenceError } = (await (
      client as any
    )
      .from("evidence")
      .select("id, gist, verbatim, chunk, anchors, created_at")
      .eq("interview_id", interviewId)
      .is("deleted_at", null)
      .eq("is_archived", false)
      .order("created_at", { ascending: true })) as {
      data: EvidenceRow[] | null;
      error: any;
    };

    if (evidenceError) {
      throw new Error(`Failed to load evidence: ${evidenceError.message}`);
    }

    // Also load survey evidence for the same project (if projectId is available)
    let surveyEvidence: EvidenceRow[] = [];
    const effectiveProject = projectId || interview.project_id;
    if (effectiveProject) {
      const { data: surveyEv } = (await (client as any)
        .from("evidence")
        .select("id, gist, verbatim, chunk, anchors, created_at")
        .eq("project_id", effectiveProject)
        .not("research_link_response_id", "is", null)
        .is("interview_id", null)
        .is("deleted_at", null)
        .eq("is_archived", false)
        .order("created_at", { ascending: true })
        .limit(100)) as { data: EvidenceRow[] | null; error: any };

      surveyEvidence = surveyEv || [];
      if (surveyEvidence.length > 0) {
        consola.info(
          `[applyLens] Including ${surveyEvidence.length} survey evidence records`,
        );
      }
    }

    // Combine interview and survey evidence
    const evidence = [...(interviewEvidence || []), ...surveyEvidence];

    if (!evidence || evidence.length === 0) {
      consola.warn(
        `[applyLens] No evidence for interview ${interviewId}, storing empty analysis`,
      );
      await (client as any).from("conversation_lens_analyses").upsert(
        {
          interview_id: interviewId,
          template_key: templateKey,
          account_id: accountId,
          project_id: projectId,
          analysis_data: { sections: [], entities: [], recommendations: [] },
          confidence_score: 0,
          auto_detected: true,
          status: "completed",
          processed_at: new Date().toISOString(),
          processed_by: computedByUserId,
        },
        { onConflict: "interview_id,template_key" },
      );
      return { templateKey, success: true, evidenceCount: 0 };
    }

    // 4. Load interview participants for person matching
    type ParticipantRow = {
      person_id: string;
      role: string | null;
      people: {
        id: string;
        name: string | null;
      } | null;
    };

    const { data: participantData } = (await (client as any)
      .from("interview_people")
      .select("person_id, role, people(id, name)")
      .eq("interview_id", interviewId)) as {
      data: ParticipantRow[] | null;
      error: any;
    };

    const participants: InterviewParticipant[] = (participantData || []).map(
      (p) => ({
        person_id: p.person_id,
        display_name: p.people?.name || null,
        role: p.role,
      }),
    );

    consola.info(
      `[applyLens] Loaded ${participants.length} participants for person matching`,
    );

    // 5. Call the generic BAML function
    setLensProgress("extracting", template.template_name);
    const evidenceJson = JSON.stringify(evidence);
    const interviewContext = buildInterviewContext(interview);
    const templateDefinition = JSON.stringify(template.template_definition);

    let extraction: any = null;
    try {
      consola.info(
        `[applyLens] Calling ApplyConversationLens for ${template.template_name}`,
      );
      const billingCtx = systemBillingContext(
        accountId,
        "lens_application",
        projectId || undefined,
      );
      const { result } = await runBamlWithBilling(
        billingCtx,
        {
          functionName: "ApplyConversationLens",
          traceName: `lens.${templateKey}`,
          input: {
            templateName: template.template_name,
            evidenceCount: evidence.length,
            interviewContext,
            hasCustomInstructions: !!customInstructions,
          },
          metadata: {
            interviewId,
            templateKey,
            accountId,
            projectId,
          },
          resourceType: "lens_analysis",
          resourceId: `${interviewId}:${templateKey}`,
          bamlCall: (client) =>
            client.ApplyConversationLens(
              templateDefinition,
              template.template_name,
              evidenceJson,
              interviewContext,
              customInstructions || null,
            ),
        },
        `lens:${interviewId}:${templateKey}`,
      );
      extraction = result;
    } catch (error) {
      consola.error(
        `[applyLens] BAML extraction failed for ${templateKey}:`,
        error,
      );
      // Store failed status
      await (client as any).from("conversation_lens_analyses").upsert(
        {
          interview_id: interviewId,
          template_key: templateKey,
          account_id: accountId,
          project_id: projectId,
          analysis_data: {},
          confidence_score: 0,
          auto_detected: true,
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
          processed_at: new Date().toISOString(),
          processed_by: computedByUserId,
        },
        { onConflict: "interview_id,template_key" },
      );
      throw error;
    }

    // 6. Enrich entities with person matching
    setLensProgress("enriching", template.template_name);
    const normalizedExtraction = normalizeExtractionSections(
      template.template_definition,
      extraction,
    );
    const enrichedResult = enrichEntitiesWithPeople(
      normalizedExtraction,
      participants,
    );

    // 6.5 Resolve stakeholders to People records (CRM-style)
    const effectiveProjectId = projectId || interview.project_id;
    const { createdPeopleIds, linkedPeopleIds } =
      await resolveStakeholdersToPeople({
        client,
        result: enrichedResult,
        accountId,
        projectId: effectiveProjectId,
        interviewId,
      });

    if (createdPeopleIds.length > 0 || linkedPeopleIds.length > 0) {
      consola.info(
        `[applyLens] People: ${createdPeopleIds.length} created, ${linkedPeopleIds.length} linked`,
      );
    }

    // 7. Create tasks from next_steps (if projectId is available)
    setLensProgress("tasks", template.template_name);
    const createdTaskIds: string[] = [];

    if (effectiveProjectId) {
      // Extract next_steps from entities
      const nextStepsEntity = (enrichedResult.entities || []).find(
        (e: any) => e.entity_type === "next_steps",
      );
      const nextSteps = nextStepsEntity?.next_steps || [];

      if (nextSteps.length > 0) {
        const cluster = mapCategoryToCluster(template.category);
        consola.info(
          `[applyLens] Found ${nextSteps.length} next_steps, checking for duplicates`,
        );

        // Fetch existing tasks for this interview to link or create
        const { data: existingTasks } = await (client as any)
          .from("tasks")
          .select("id, title, tags")
          .eq("project_id", effectiveProjectId)
          .contains("tags", [`interview:${interviewId}`]);

        // Build map of normalized title -> task for exact lookup
        const existingTaskMap = new Map<
          string,
          { id: string; title: string }
        >();
        // Also build a list of tasks for this specific lens (for fuzzy matching)
        const lensSpecificTasks: Array<{ id: string; title: string }> = [];
        const usedTaskIds = new Set<string>();

        for (const t of existingTasks || []) {
          const normalized = t.title?.toLowerCase().trim();
          if (normalized) {
            existingTaskMap.set(normalized, t);
          }
          // Check if this task is from the current lens
          if (t.tags?.includes(`lens:${templateKey}`)) {
            lensSpecificTasks.push(t);
          }
        }

        consola.info(
          `[applyLens] Found ${existingTasks?.length || 0} existing tasks (${lensSpecificTasks.length} for this lens)`,
        );

        // Track task_id for each next_step (by index)
        const taskIdByIndex: (string | null)[] = [];

        for (let i = 0; i < nextSteps.length; i++) {
          const nextStep = nextSteps[i];
          const title = nextStep.description || "Untitled task";
          const normalizedTitle = title.toLowerCase().trim();

          // 1. Try exact title match first
          const exactMatch = existingTaskMap.get(normalizedTitle);
          if (exactMatch && !usedTaskIds.has(exactMatch.id)) {
            consola.info(
              `[applyLens] Exact match: "${title}" -> (${exactMatch.id})`,
            );
            taskIdByIndex.push(exactMatch.id);
            usedTaskIds.add(exactMatch.id);
            continue;
          }

          // 2. Try fuzzy match against lens-specific tasks
          const fuzzyMatch = findBestMatchingTask(
            title,
            lensSpecificTasks.filter((t) => !usedTaskIds.has(t.id)),
          );
          if (fuzzyMatch) {
            consola.info(
              `[applyLens] Fuzzy match: "${title}" -> "${fuzzyMatch.title}" (${fuzzyMatch.id})`,
            );
            taskIdByIndex.push(fuzzyMatch.id);
            usedTaskIds.add(fuzzyMatch.id);
            continue;
          }

          // 3. Try fuzzy match against all interview tasks
          const broadFuzzyMatch = findBestMatchingTask(
            title,
            (existingTasks || []).filter((t: any) => !usedTaskIds.has(t.id)),
          );
          if (broadFuzzyMatch) {
            consola.info(
              `[applyLens] Broad fuzzy match: "${title}" -> "${broadFuzzyMatch.title}" (${broadFuzzyMatch.id})`,
            );
            taskIdByIndex.push(broadFuzzyMatch.id);
            usedTaskIds.add(broadFuzzyMatch.id);
            continue;
          }

          // 4. No match found, create new task
          try {
            const task = await createTask({
              supabase: client as any,
              accountId,
              projectId: effectiveProjectId,
              userId: computedByUserId,
              data: {
                title,
                description: nextStep.owner
                  ? `Owner: ${nextStep.owner}${nextStep.due_date ? ` | Due: ${nextStep.due_date}` : ""}`
                  : null,
                cluster,
                status: mapNextStepStatusToTaskStatus(nextStep.status),
                priority: mapPriorityToTaskPriority(nextStep.priority),
                due_date: nextStep.due_date || null,
                tags: [
                  "ai-generated",
                  `lens:${templateKey}`,
                  `interview:${interviewId}`,
                ],
                // Store reference back to evidence
                reason: nextStep.evidence_ids?.length
                  ? `Evidence: ${nextStep.evidence_ids.join(", ")}`
                  : null,
              },
            });
            createdTaskIds.push(task.id);
            taskIdByIndex.push(task.id);
            usedTaskIds.add(task.id);
            existingTaskMap.set(normalizedTitle, task); // Add to map to prevent duplicates within same run
            consola.info(
              `[applyLens] Created task "${task.title}" (${task.id})`,
            );
          } catch (taskError) {
            consola.error(
              `[applyLens] Failed to create task for next_step:`,
              taskError,
            );
            taskIdByIndex.push(null);
          }
        }

        // Update next_steps with task_ids (correctly mapped by index)
        if (nextStepsEntity) {
          nextStepsEntity.next_steps = nextSteps.map(
            (ns: any, idx: number) => ({
              ...ns,
              task_id: taskIdByIndex[idx] || null,
            }),
          );
        }
      }
    }

    // 8. Store result - the BAML result format matches what we store
    setLensProgress("saving", template.template_name);
    const analysisData = {
      sections: enrichedResult.sections || [],
      entities: enrichedResult.entities || [],
      recommendations: enrichedResult.recommendations || [],
      hygiene: enrichedResult.hygiene || [],
      processing_notes: enrichedResult.processing_notes,
      created_task_ids: createdTaskIds.length > 0 ? createdTaskIds : undefined,
      created_people_ids:
        createdPeopleIds.length > 0 ? createdPeopleIds : undefined,
    };

    const { error: upsertError } = await (client as any)
      .from("conversation_lens_analyses")
      .upsert(
        {
          interview_id: interviewId,
          template_key: templateKey,
          account_id: accountId,
          project_id: projectId,
          analysis_data: analysisData,
          confidence_score: enrichedResult.overall_confidence || 0.5,
          auto_detected: true,
          status: "completed",
          processed_at: new Date().toISOString(),
          processed_by: computedByUserId,
        },
        { onConflict: "interview_id,template_key" },
      );

    if (upsertError) {
      throw new Error(`Failed to store analysis: ${upsertError.message}`);
    }

    setLensProgress("complete", template.template_name);
    const taskInfo =
      createdTaskIds.length > 0
        ? `, ${createdTaskIds.length} tasks created`
        : "";
    consola.success(
      `[applyLens] ✓ Applied ${templateKey} to ${interviewId} (confidence: ${(enrichedResult.overall_confidence || 0.5).toFixed(2)}${taskInfo})`,
    );

    return {
      templateKey,
      success: true,
      evidenceCount: evidence.length,
      confidenceScore: enrichedResult.overall_confidence || 0.5,
      createdTaskIds: createdTaskIds.length > 0 ? createdTaskIds : undefined,
    };
  },
});
