/**
 * Read-only public view of an interview for share links.
 * Includes transcript with speaker diarization, conversation timeline, and notes.
 * Uses simplified components that don't depend on authenticated context.
 */
import {
  Calendar,
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileText,
  Layers,
  Lock,
  MessageSquare,
  Pencil,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { LogoBrand } from "~/components/branding";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { MediaPlayer } from "~/components/ui/MediaPlayer";
import { Timeline } from "~/components/ui/timeline";
import { normalizeTranscriptUtterances } from "~/utils/transcript/normalizeUtterances";
import { TranscriptResults } from "./TranscriptResults";

// Transcript data structure from loader
interface TranscriptData {
  fullTranscript: string | null;
  speakerTranscripts: Array<{
    speaker?: string;
    text?: string;
    start?: number;
    end?: number;
    start_time?: number;
    end_time?: number;
    confidence?: number;
  }>;
  audio_duration?: number | null;
  topicDetection: unknown;
  chapters?: Array<{
    start_ms: number;
    end_ms?: number;
    summary?: string;
    title?: string;
  }>;
}

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
    observations_and_notes: string | null;
  };
  transcriptData?: TranscriptData;
  evidence: Array<{
    id: string;
    gist: string | null;
    verbatim: string | null;
    anchors: Array<{ start_ms?: number; end_ms?: number }> | null;
    created_at: string;
    topic?: string | null;
  }>;
  participants: Array<{
    id: string | number;
    role: string | null;
    transcript_key?: string | null;
    display_name: string | null;
    people: {
      id: string;
      name: string | null;
      segment: string | null;
    } | null;
  }>;
  teamName: string | null;
  shareUrl?: string;
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
  transcriptData,
  evidence,
  participants,
  teamName,
  shareUrl,
}: PublicInterviewViewProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const keyTakeaways = parseKeyTakeaways(interview.conversation_analysis);

  // Copy share link to clipboard
  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // Helper to extract anchor start time from anchors JSONB
  const getAnchorStart = (
    anchors: Array<{ start_ms?: number; end_ms?: number }> | null,
  ): number | null => {
    if (!anchors || !Array.isArray(anchors) || anchors.length === 0)
      return null;
    const first = anchors[0];
    if (typeof first?.start_ms === "number") return first.start_ms / 1000;
    return null;
  };

  // Build conversation timeline from evidence topics (like PlayByPlayTimeline)
  const buildTopicGroups = () => {
    type TopicGroup = {
      topic: string;
      firstEvidence: (typeof evidence)[0];
      firstSeconds: number | null;
      count: number;
    };
    const byTopic = new Map<string, TopicGroup>();

    for (const item of evidence) {
      const topic = item.topic;
      if (!topic || topic.trim().length === 0) continue;
      const seconds = getAnchorStart(item.anchors);
      const existing = byTopic.get(topic);
      if (!existing) {
        byTopic.set(topic, {
          topic,
          firstEvidence: item,
          firstSeconds: seconds,
          count: 1,
        });
      } else {
        existing.count += 1;
        if (
          (seconds !== null && existing.firstSeconds === null) ||
          (seconds !== null &&
            existing.firstSeconds !== null &&
            seconds < existing.firstSeconds)
        ) {
          existing.firstEvidence = item;
          existing.firstSeconds = seconds;
        }
      }
    }

    return Array.from(byTopic.values()).sort((a, b) => {
      const aKey =
        a.firstSeconds ?? new Date(a.firstEvidence.created_at).getTime() / 1000;
      const bKey =
        b.firstSeconds ?? new Date(b.firstEvidence.created_at).getTime() / 1000;
      return aKey - bKey;
    });
  };

  const topicGroups = buildTopicGroups();
  const displayedTopics = timelineExpanded
    ? topicGroups
    : topicGroups.slice(0, 5);

  // Convert speaker transcripts to utterances format for TranscriptResults
  const audioDurationSec =
    transcriptData?.audio_duration ?? interview.duration_sec ?? null;

  const transcriptUtterances = normalizeTranscriptUtterances(
    transcriptData?.speakerTranscripts || [],
    { audioDurationSec },
  );

  const hasTranscript =
    transcriptUtterances.length > 0 || !!transcriptData?.fullTranscript;

  // Get linked participants with names
  const linkedParticipants = participants.filter((p) => p.people?.name);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <LogoBrand />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <span>Shared Content</span>
                {teamName && (
                  <>
                    <span>•</span>
                    <span>by {teamName}</span>
                  </>
                )}
              </div>
              {shareUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyShareLink}
                  className="flex items-center gap-2"
                >
                  {linkCopied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>
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

        {/* Conversation Lenses Teaser */}
        <section className="mb-8">
          <Card className="overflow-hidden border-dashed">
            <CardHeader className="bg-muted/20 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-indigo-500" />
                Conversation Lenses
              </CardTitle>
            </CardHeader>
            <CardContent className="py-6">
              <div className="flex flex-col items-center justify-center text-center">
                <Lock className="mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="mb-2 font-medium text-foreground">
                  Unlock AI-powered analysis frameworks
                </p>
                <p className="mb-4 max-w-md text-muted-foreground text-sm">
                  Apply Sales BANT, Empathy Maps, Customer Journey, and more to
                  extract structured insights from this conversation.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/sign-up?ref=share-lenses">
                    Create Free Account to View
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Conversation Timeline (Topics from Evidence) */}
        {topicGroups.length > 0 && (
          <section className="mb-8">
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                  Conversation Timeline
                  <Badge variant="secondary" className="ml-2">
                    {topicGroups.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-4 py-2">
                  <Timeline
                    items={displayedTopics.map(
                      ({ topic, firstEvidence, firstSeconds, count }) => ({
                        id: firstEvidence.id,
                        title: (
                          <div className="flex items-center justify-between gap-2">
                            <span className="line-clamp-1 font-medium text-foreground">
                              {topic}
                            </span>
                            <div className="flex items-center gap-2">
                              {firstSeconds !== null && (
                                <span className="flex shrink-0 rounded bg-background/5 px-1.5 py-0.5 font-medium text-[#FF8A66] text-[10px] uppercase tracking-wide">
                                  {formatTimestamp(firstSeconds)}
                                </span>
                              )}
                              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70">
                                {count}
                              </span>
                            </div>
                          </div>
                        ),
                        status: "default" as const,
                      }),
                    )}
                    showTimestamps={false}
                    variant="compact"
                  />
                </div>
                {topicGroups.length > 5 && (
                  <div className="flex justify-center border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1 text-muted-foreground text-sm"
                      onClick={() => setTimelineExpanded(!timelineExpanded)}
                    >
                      {timelineExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Show {topicGroups.length - 5} more
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* User Notes */}
        {interview.observations_and_notes && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
              <Pencil className="h-5 w-5 text-purple-500" />
              Notes
            </h2>
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
                {interview.observations_and_notes}
              </div>
            </div>
          </section>
        )}

        {/* Transcript - Lazy Loaded */}
        {hasTranscript && (
          <section className="mb-8">
            {!transcriptExpanded ? (
              <div className="rounded-lg border bg-background/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                    <div>
                      <h3 className="font-medium text-foreground">
                        Interview Transcript
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {transcriptUtterances.length > 0
                          ? "Full transcript with speaker breakdown available"
                          : "Raw transcript available"}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setTranscriptExpanded(true)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Load Transcript
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-background/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-5 w-5 text-green-500" />
                      <div>
                        <h3 className="font-medium text-foreground">
                          Interview Transcript
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {transcriptUtterances.length > 0
                            ? "Full transcript with speaker breakdown"
                            : "Raw transcript"}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setTranscriptExpanded(false)}
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <ChevronUp className="h-4 w-4" />
                      Hide
                    </Button>
                  </div>
                </div>
                <TranscriptResults
                  data={{
                    id: interview.id,
                    text: transcriptData?.fullTranscript || "",
                    words: [],
                    language_code: "en",
                    confidence: 0,
                    audio_duration: audioDurationSec || 0,
                    utterances: transcriptUtterances,
                    iab_categories_result:
                      transcriptData?.topicDetection as any,
                    sentiment_analysis_results: [],
                  }}
                  rawTranscript={transcriptData?.fullTranscript || undefined}
                  participants={participants.map((p) => ({
                    id:
                      typeof p.id === "string" ? parseInt(p.id, 10) || 0 : p.id,
                    role: p.role,
                    transcript_key: p.transcript_key ?? null,
                    display_name: p.display_name,
                    people: p.people
                      ? {
                          id: p.people.id,
                          name: p.people.name,
                          segment: p.people.segment,
                        }
                      : undefined,
                  }))}
                />
              </div>
            )}
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
