/**
 * Read-only public view of an interview for share links.
 * Excludes user notes, edit controls, and team comments.
 * Uses simplified components that don't depend on authenticated context.
 */
import { Calendar, Clock, FileText, Quote, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";
import { LogoBrand } from "~/components/branding";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { MediaPlayer } from "~/components/ui/MediaPlayer";

interface PublicInterviewViewProps {
  interview: {
    id: string;
    title: string | null;
    interview_date: string | null;
    duration_sec: number | null;
    key_takeaways: string | null;
    media_url: string | null;
    thumbnail_url: string | null;
    media_type: string | null;
    source_type: string | null;
    created_at: string;
    conversation_analysis: unknown;
  };
  evidence: Array<{
    id: string;
    gist: string | null;
    quote: string | null;
    anchor_start?: number | null;
    anchor_end?: number | null;
    created_at: string;
  }>;
  participants: Array<{
    id: string | number;
    role: string | null;
    display_name: string | null;
    people: {
      id: string;
      name: string | null;
      segment: string | null;
    } | null;
  }>;
  teamName: string | null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Parse key takeaways from conversation_analysis
function parseKeyTakeaways(
  conversationAnalysis: unknown,
): Array<{ priority: string; summary: string; evidenceSnippets: string[] }> {
  if (!conversationAnalysis || typeof conversationAnalysis !== "object") {
    return [];
  }

  const analysis = conversationAnalysis as Record<string, unknown>;
  const keyTakeaways = analysis.key_takeaways;

  if (!Array.isArray(keyTakeaways)) {
    return [];
  }

  return keyTakeaways
    .filter(
      (t): t is { priority?: string; summary?: string; evidence?: string[] } =>
        typeof t === "object" && t !== null,
    )
    .map((t) => ({
      priority: String(t.priority || "medium"),
      summary: String(t.summary || ""),
      evidenceSnippets: Array.isArray(t.evidence)
        ? t.evidence.filter((e): e is string => typeof e === "string")
        : [],
    }))
    .filter((t) => t.summary);
}

function badgeVariantForPriority(
  priority: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (priority.toLowerCase()) {
    case "high":
      return "destructive";
    case "medium":
      return "default";
    case "low":
      return "secondary";
    default:
      return "outline";
  }
}

export function PublicInterviewView({
  interview,
  evidence,
  participants,
  teamName,
}: PublicInterviewViewProps) {
  const keyTakeaways = parseKeyTakeaways(interview.conversation_analysis);

  // Get linked participants with names
  const linkedParticipants = participants.filter((p) => p.people?.name);

  // Sort evidence by timestamp
  const sortedEvidence = [...evidence].sort((a, b) => {
    const aStart = a.anchor_start ?? Infinity;
    const bStart = b.anchor_start ?? Infinity;
    return aStart - bStart;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <LogoBrand />
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <span>Shared Content</span>
              {teamName && (
                <>
                  <span>•</span>
                  <span>by {teamName}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title & Metadata */}
        <div className="mb-8 space-y-4">
          <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
            {interview.title || "Untitled Interview"}
          </h1>

          {/* Participants */}
          {linkedParticipants.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {linkedParticipants.length === 1
                  ? "Participant:"
                  : "Participants:"}
              </span>
              {linkedParticipants.map((p) => (
                <Badge key={p.id} variant="secondary">
                  {p.people?.name || p.display_name || "Unknown"}
                  {p.people?.segment &&
                    p.people.segment !== "Unknown" &&
                    ` (${p.people.segment})`}
                </Badge>
              ))}
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            {interview.interview_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(interview.interview_date)}
              </span>
            )}
            {interview.duration_sec && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatDuration(interview.duration_sec)}
              </span>
            )}
            {evidence.length > 0 && (
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                {evidence.length} evidence points
              </span>
            )}
          </div>
        </div>

        {/* Media Player */}
        {interview.media_url && (
          <div className="mb-8">
            <MediaPlayer
              mediaUrl={interview.media_url}
              thumbnailUrl={interview.thumbnail_url}
              mediaType={
                interview.media_type as
                  | "audio"
                  | "video"
                  | "voice_memo"
                  | "interview"
                  | null
              }
              className="max-w-xl"
            />
          </div>
        )}

        {/* Key Takeaways */}
        {keyTakeaways.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Key Takeaways
            </h2>
            <div className="rounded-lg border bg-muted/40 p-4">
              <ul className="space-y-3">
                {keyTakeaways.map((takeaway, index) => (
                  <li key={`takeaway-${index}`} className="flex gap-3">
                    <Badge
                      variant={badgeVariantForPriority(takeaway.priority)}
                      className="mt-0.5 shrink-0 uppercase"
                    >
                      {takeaway.priority}
                    </Badge>
                    <div className="space-y-1">
                      <Streamdown className="prose prose-sm max-w-none text-foreground leading-snug [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {takeaway.summary}
                      </Streamdown>
                      {takeaway.evidenceSnippets.length > 0 && (
                        <p className="text-muted-foreground text-sm italic">
                          &ldquo;{takeaway.evidenceSnippets[0]}&rdquo;
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* AI Summary (key_takeaways field) */}
        {interview.key_takeaways && (
          <section className="mb-8">
            <h2 className="mb-4 font-semibold text-lg">AI Summary</h2>
            <div className="rounded-lg border bg-muted/40 p-4">
              <Streamdown className="prose prose-sm max-w-none text-foreground">
                {interview.key_takeaways}
              </Streamdown>
            </div>
          </section>
        )}

        {/* Evidence Timeline (Simplified) */}
        {sortedEvidence.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
              <Quote className="h-5 w-5 text-blue-500" />
              Key Moments
            </h2>
            <div className="space-y-4">
              {sortedEvidence.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border bg-card p-4 shadow-sm"
                >
                  {item.anchor_start != null && (
                    <div className="mb-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {formatTimestamp(item.anchor_start)}
                      </Badge>
                    </div>
                  )}
                  {item.gist && (
                    <p className="mb-2 font-medium text-foreground text-sm">
                      {item.gist}
                    </p>
                  )}
                  {item.quote && (
                    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground text-sm italic">
                      &ldquo;{item.quote}&rdquo;
                    </blockquote>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer CTA */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h3 className="mb-2 font-semibold text-foreground text-lg">
            Want more insights and AI chat?
          </h3>
          <p className="mb-6 text-muted-foreground">
            Create a free account and join the team to unlock full access.
          </p>
          <Button size="lg" asChild>
            <a href="/sign-up?ref=share">Get Started Free</a>
          </Button>
          <p className="mt-6 text-muted-foreground text-xs">
            Powered by Upsight - AI-powered conversation intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}
