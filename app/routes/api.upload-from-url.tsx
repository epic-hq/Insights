import type { UUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import type { importFromUrlTask } from "~/../src/trigger/interview/importFromUrl";
import { getServerClient } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";

type UrlPayloadItem = {
  url: string;
  title?: string;
  personId?: string;
};

function isUrlPayloadItem(value: unknown): value is UrlPayloadItem {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.url === "string";
}

/**
 * Upload from URL API
 *
 * Creates interview records upfront so the frontend can immediately track
 * progress via Supabase realtime, then triggers the Trigger.dev task to
 * download, upload, and process the media.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const ctx = context.get(userContext);
  const supabase = ctx?.supabase ?? getServerClient(request).client;
  const userId = ctx?.claims?.sub ?? null;

  try {
    const formData = await request.formData();
    const projectId = formData.get("projectId") as UUID;
    const url = formData.get("url") as string;
    const title = formData.get("title") as string | null;
    const personId = formData.get("personId") as string | null;
    const urlsPayload = formData.get("urls");

    const parsedItems: Array<{
      url: string;
      title?: string;
      personId?: string;
    }> = [];
    if (typeof urlsPayload === "string" && urlsPayload.trim()) {
      try {
        const payload = JSON.parse(urlsPayload) as unknown;
        if (Array.isArray(payload)) {
          for (const item of payload) {
            if (typeof item === "string") {
              parsedItems.push({ url: item.trim() });
              continue;
            }
            if (isUrlPayloadItem(item)) {
              parsedItems.push({
                url: item.url.trim(),
                ...(typeof item.title === "string" && item.title.trim()
                  ? { title: item.title.trim() }
                  : {}),
                ...(typeof item.personId === "string" && item.personId.trim()
                  ? { personId: item.personId.trim() }
                  : {}),
              });
            }
          }
        }
      } catch (parseError) {
        consola.warn(
          "[upload-from-url] Failed to parse urls payload",
          parseError,
        );
        return Response.json(
          { error: "Invalid URLs payload" },
          { status: 400 },
        );
      }
    }

    const fallbackItem =
      typeof url === "string" && url.trim()
        ? [
            {
              url: url.trim(),
              ...(title ? { title } : {}),
              ...(personId ? { personId } : {}),
            },
          ]
        : [];
    const requestedItems = parsedItems.length > 0 ? parsedItems : fallbackItem;
    const urlItems = requestedItems.filter((item) => {
      try {
        const parsedUrl = new URL(item.url);
        return (
          parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
        );
      } catch {
        return false;
      }
    });

    consola.info("[upload-from-url] Received request", {
      projectId,
      urlCount: urlItems.length,
      firstUrl: urlItems[0]?.url,
    });

    if (!projectId || urlItems.length === 0) {
      return Response.json(
        { error: "At least one valid URL and projectId are required" },
        { status: 400 },
      );
    }

    // Get account ID from project
    const { data: projectRow, error: projectError } = await supabase
      .from("projects")
      .select("account_id")
      .eq("id", projectId)
      .single();

    if (projectError || !projectRow?.account_id) {
      consola.error(
        "[upload-from-url] Unable to resolve project account",
        projectId,
        projectError,
      );
      return Response.json(
        { error: "Unable to resolve project account" },
        { status: 404 },
      );
    }

    const accountId = projectRow.account_id;

    // Create interview records upfront so the frontend can track progress
    // via Supabase realtime subscriptions immediately
    const interviewIds: string[] = [];
    for (const item of urlItems) {
      const timestamp = Date.now();
      const r2Key = `interviews/${projectId}/import-${timestamp}.mp4`;
      const defaultTitle =
        item.title ||
        `Imported from URL - ${new Date().toISOString().slice(0, 10)}`;

      const { data: interview, error: insertError } = await supabase
        .from("interviews")
        .insert({
          account_id: accountId,
          project_id: projectId,
          title: defaultTitle,
          participant_pseudonym: "Unknown participant",
          status: "uploading",
          source_type: "video_url",
          media_url: r2Key,
          original_filename: `url-import-${timestamp}.mp4`,
          created_by: userId,
        })
        .select("id")
        .single();

      if (insertError || !interview) {
        consola.error(
          "[upload-from-url] Failed to create interview record",
          insertError,
        );
        return Response.json(
          { error: "Failed to create interview record" },
          { status: 500 },
        );
      }

      interviewIds.push(interview.id);
      consola.info("[upload-from-url] Created interview record", {
        interviewId: interview.id,
        url: item.url,
      });
    }

    // Attach interviewId to each URL item for the Trigger.dev task
    const urlItemsWithIds = urlItems.map((item, index) => ({
      ...item,
      interviewId: interviewIds[index],
    }));

    consola.info("[upload-from-url] Triggering importFromUrlTask", {
      projectId,
      accountId,
      urlCount: urlItemsWithIds.length,
    });

    const handle = await tasks.trigger<typeof importFromUrlTask>(
      "interview.import-from-url",
      {
        urls: urlItemsWithIds,
        projectId,
        accountId,
        userId: userId || null,
      },
    );

    consola.info("[upload-from-url] Task triggered successfully", {
      runId: handle.id,
      publicToken: handle.publicAccessToken,
    });

    return Response.json({
      success: true,
      message:
        urlItems.length > 1
          ? `Import queued for ${urlItems.length} URLs. They will be processed one by one in the background.`
          : "Import queued. The video/audio will be downloaded, transcribed, and processed. This may take a few minutes.",
      urlCount: urlItems.length,
      interviewId: interviewIds[0] ?? null,
      interviewIds,
      triggerRunId: handle.id,
      publicRunToken: handle.publicAccessToken ?? null,
    });
  } catch (error) {
    consola.error("[upload-from-url] Error triggering import task", error);
    return Response.json(
      { error: (error as Error).message || "Unknown error" },
      { status: 500 },
    );
  }
}
