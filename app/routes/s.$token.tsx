/**
 * Public share route for viewing interviews without authentication.
 * Validates share token, checks expiration, and renders read-only view.
 */
import consola from "consola";
import type { ComponentProps } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { PublicInterviewView } from "~/features/interviews/components/PublicInterviewView";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { createR2PresignedUrl, getR2KeyFromPublicUrl } from "~/utils/r2.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || "error" in data) {
    return [{ title: "Share Not Found | Upsight" }];
  }
  return [
    {
      title: `${data.interview?.title || "Shared Interview"} | Upsight`,
    },
    {
      name: "description",
      content: data.interview?.key_takeaways || "View shared interview",
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { token } = params;

  if (!token) {
    throw new Response("Share token required", { status: 400 });
  }

  // Use admin client to bypass RLS for token lookup
  const supabase = createSupabaseAdminClient();

  // Fetch interview by share token
  const { data: interview, error } = await supabase
    .from("interviews")
    .select(
      `
      id,
      title,
      interview_date,
      duration_sec,
      key_takeaways,
      status,
      media_url,
      thumbnail_url,
      media_type,
      source_type,
      file_extension,
      created_at,
      share_enabled,
      share_expires_at,
      conversation_analysis,
      transcript_formatted,
      project_id,
      account_id
    `,
    )
    .eq("share_token", token)
    .single();

  if (error || !interview) {
    consola.warn("[public-share] Interview not found for token", { token });
    throw new Response("This share link is not valid", { status: 404 });
  }

  // Validate sharing is enabled
  if (!interview.share_enabled) {
    consola.warn("[public-share] Sharing disabled for interview", {
      interviewId: interview.id,
    });
    throw new Response("This share link has been disabled", { status: 403 });
  }

  // Check expiration
  if (
    interview.share_expires_at &&
    new Date(interview.share_expires_at) < new Date()
  ) {
    consola.warn("[public-share] Share link expired", {
      interviewId: interview.id,
      expiresAt: interview.share_expires_at,
    });
    throw new Response("This share link has expired", { status: 410 });
  }

  // Generate fresh presigned URL for media (1 hour expiry)
  let freshMediaUrl = interview.media_url;
  if (interview.media_url) {
    try {
      const r2Key = getR2KeyFromPublicUrl(interview.media_url);
      if (r2Key) {
        const presignedResult = createR2PresignedUrl({
          key: r2Key,
          expiresInSeconds: 60 * 60, // 1 hour
        });
        if (presignedResult) {
          freshMediaUrl = presignedResult.url;
        }
      }
    } catch (e) {
      consola.warn("[public-share] Failed to generate presigned URL", e);
      // Keep original URL as fallback
    }
  }

  // Fetch evidence for this interview (only fields needed for public view)
  const { data: evidence } = await supabase
    .from("evidence")
    .select("id, gist, quote, anchor_start, anchor_end, created_at")
    .eq("interview_id", interview.id)
    .order("anchor_start", { ascending: true, nullsFirst: false });

  // Fetch participants (without sensitive info)
  const { data: participants } = await supabase
    .from("interview_people")
    .select(
      `
      id,
      role,
      display_name,
      people (
        id,
        name,
        segment
      )
    `,
    )
    .eq("interview_id", interview.id);

  // Get account name for branding
  const { data: account } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", interview.account_id)
    .single();

  consola.info("[public-share] Serving public interview", {
    interviewId: interview.id,
    token,
  });

  return {
    interview: {
      ...interview,
      media_url: freshMediaUrl,
      // Explicitly exclude sensitive fields by not including them
    },
    evidence: evidence || [],
    participants: participants || [],
    teamName: account?.name || null,
  };
}

export default function PublicSharePage() {
  const data = useLoaderData<typeof loader>();

  // Type assertions needed due to Supabase's complex inferred types
  return (
    <PublicInterviewView
      interview={data.interview as PublicInterviewViewProps["interview"]}
      evidence={data.evidence as PublicInterviewViewProps["evidence"]}
      participants={
        data.participants as PublicInterviewViewProps["participants"]
      }
      teamName={data.teamName}
    />
  );
}

// Props type for the component
type PublicInterviewViewProps = ComponentProps<typeof PublicInterviewView>;
