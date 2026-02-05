/**
 * Sources (Notes & Files) page
 *
 * Combined view of notes and uploaded files, separated from the main Conversations page.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import consola from "consola";
import { formatDistance } from "date-fns";
import {
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HelpCircle,
  Search,
  StickyNote,
  Table,
  Upload,
} from "lucide-react";
import { useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { PageContainer } from "~/components/layout/PageContainer";
import { QuickNoteDialog } from "~/components/notes/QuickNoteDialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useCurrentProject } from "~/contexts/current-project-context";
import NoteCard from "~/features/interviews/components/NoteCard";
import { getInterviews } from "~/features/interviews/db";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { userContext } from "~/server/user-context";
import type { InterviewWithPeople } from "~/types";

export const meta: MetaFunction = () => {
  return [
    { title: "Notes & Files | Insights" },
    { name: "description", content: "Notes and uploaded files" },
  ];
};

export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  const accountId = params.accountId;
  const projectId = params.projectId;

  if (!accountId || !projectId) {
    throw new Response("Account ID and Project ID are required", {
      status: 400,
    });
  }

  const [interviewsResult, assetsResult] = await Promise.all([
    getInterviews({ supabase, accountId, projectId }),
    supabase
      .from("project_assets")
      .select(
        "id, title, asset_type, row_count, column_count, status, source_type, created_at, updated_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  const { data: rows, error } = interviewsResult as {
    data: InterviewWithPeople[] | null;
    error: PostgrestError | null;
  };
  const { data: assets, error: assetsError } = assetsResult;

  if (error) {
    consola.error("Sources notes query error:", error);
    throw new Response(`Error fetching notes: ${error.message}`, {
      status: 500,
    });
  }

  if (assetsError) {
    consola.warn("Sources assets query error:", assetsError);
  }

  // Filter to only notes and voice memos
  const notes = (rows || [])
    .filter(
      (item) => item.source_type === "note" || item.media_type === "voice_memo",
    )
    .map((interview) => {
      const primaryParticipant = interview.interview_people?.[0];
      const participant = primaryParticipant?.people;

      return {
        ...interview,
        participant: participant?.name || interview.title || "Unknown",
        role: primaryParticipant?.role || "participant",
        persona: participant?.segment || "No segment",
        date: interview.interview_date || interview.created_at || "",
        duration: interview.duration_sec
          ? `${Math.round((interview.duration_sec / 60) * 10) / 10} min`
          : "Unknown",
        evidenceCount: interview.evidence_count || 0,
      };
    });

  const projectAssets = (assets || []).map((asset) => ({
    id: asset.id,
    title: asset.title || "Untitled",
    asset_type: asset.asset_type,
    row_count: asset.row_count,
    column_count: asset.column_count,
    status: asset.status,
    source_type: asset.source_type,
    created_at: asset.created_at,
    updated_at: asset.updated_at,
  }));

  return { notes, projectAssets };
}

export default function SourcesIndex() {
  const { notes, projectAssets } = useLoaderData<typeof loader>();
  const { projectPath, projectId } = useCurrentProject();
  const routes = useProjectRoutes(projectPath);
  const [sourceTab, setSourceTab] = useState<"notes" | "files">("notes");
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  const filteredAssets = fileSearchQuery
    ? projectAssets.filter((asset) =>
        asset.title.toLowerCase().includes(fileSearchQuery.toLowerCase()),
      )
    : projectAssets;

  const handleSaveNote = async (note: {
    title: string;
    content: string;
    noteType: string;
    associations: Record<string, unknown>;
    tags: string[];
  }) => {
    const pathParts = projectPath?.split("/").filter(Boolean) || [];
    const extractedProjectId = pathParts[2];

    if (!extractedProjectId) {
      console.error("No project ID found in path:", projectPath);
      throw new Error("Project ID is required");
    }

    const response = await fetch("/api/notes/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: extractedProjectId,
        title: note.title,
        content: note.content,
        noteType: note.noteType,
        associations: note.associations,
        tags: note.tags,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Failed to save note:", errorData);
      throw new Error(
        errorData.details || errorData.error || "Failed to save note",
      );
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Header */}
      <div className="border-border border-b bg-card px-6 py-8">
        <PageContainer size="lg" padded={false} className="max-w-6xl">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h1 className="flex items-center gap-2 font-semibold text-3xl text-foreground">
                  <FolderOpen />
                  Notes & Files
                </h1>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full text-sm sm:w-auto"
                  onClick={() => setNoteDialogOpen(true)}
                >
                  <StickyNote className="h-4 w-4" />
                  New Note
                </Button>
                <Button
                  asChild
                  variant="default"
                  className="w-full text-sm sm:w-auto"
                >
                  <Link to={routes.interviews.upload()}>
                    <Upload className="h-4 w-4" />
                    Upload File
                  </Link>
                </Button>
              </div>
            </div>

            {/* Tab Toggle */}
            <div className="flex items-center justify-start">
              <ToggleGroup
                type="single"
                value={sourceTab}
                onValueChange={(v) => {
                  if (v === "notes" || v === "files") {
                    setSourceTab(v);
                  }
                }}
                size="sm"
                className="w-full sm:w-auto"
              >
                <ToggleGroupItem
                  value="notes"
                  className="flex-1 gap-1.5 sm:flex-initial"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Notes
                  {notes.length > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
                      {notes.length}
                    </span>
                  )}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="files"
                  className="flex-1 gap-1.5 sm:flex-initial"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Files
                  {projectAssets.length > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
                      {projectAssets.length}
                    </span>
                  )}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </PageContainer>
      </div>

      {/* Main Content */}
      <PageContainer size="lg" padded={false} className="max-w-6xl px-6 py-12">
        {sourceTab === "files" ? (
          <>
            {/* Search bar for files */}
            {projectAssets.length > 0 && (
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="relative max-w-sm flex-1">
                  <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search files..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="ml-auto flex cursor-help items-center gap-2">
                      <span className="font-medium text-foreground">
                        How to use Files
                      </span>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-120 bg-accent text-foreground"
                    align="end"
                    sideOffset={8}
                  >
                    <p className="mb-3">
                      Files store spreadsheets, tables, and documents you've
                      shared with the AI assistant. You can:
                    </p>
                    <ul className="space-y-1">
                      <li>
                        • <strong>Import contacts</strong> and survey results
                        and add them to the internal CRM
                      </li>
                      <li>
                        • <strong>Ask questions</strong> — "What trends do you
                        see in my customer list?"
                      </li>
                      <li>
                        • <strong>Cross-reference</strong> — "Compare this data
                        with our interview findings"
                      </li>
                      <li>
                        • <strong>Edit inline</strong> — Click any file to view
                        and edit the data directly and it becomes immediately
                        usably by Uppy
                      </li>
                    </ul>
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground text-sm">
                  {filteredAssets.length} of {projectAssets.length} files
                </span>
              </div>
            )}
            {projectAssets.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto max-w-md">
                  <div className="mb-6 flex justify-center">
                    <div className="rounded-full bg-gray-100 p-6 dark:bg-gray-800">
                      <FileSpreadsheet className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                    </div>
                  </div>
                  <h3 className="mb-3 font-semibold text-gray-900 text-xl dark:text-white">
                    No files yet
                  </h3>
                  <p className="mb-8 text-gray-600 dark:text-gray-400">
                    Paste spreadsheet data into the chat or upload files to see
                    them here.
                  </p>
                </div>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  No files match "{fileSearchQuery}"
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {filteredAssets.map((asset) => (
                  <Link
                    key={asset.id}
                    to={routes.assets.detail(asset.id)}
                    className="flex items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      {asset.asset_type === "table" ? (
                        <Table className="h-5 w-5 text-primary" />
                      ) : (
                        <FileText className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-foreground">
                        {asset.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                        <span className="capitalize">{asset.asset_type}</span>
                        {asset.row_count && asset.column_count && (
                          <>
                            <span>•</span>
                            <span>
                              {asset.row_count} rows × {asset.column_count} cols
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>
                          {formatDistance(
                            new Date(asset.created_at),
                            new Date(),
                            { addSuffix: true },
                          )}
                        </span>
                      </div>
                      {asset.status && asset.status !== "ready" && (
                        <span className="mt-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                          {asset.status}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : notes.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto max-w-md">
              <div className="mb-6 flex justify-center">
                <div className="rounded-full bg-gray-100 p-6 dark:bg-gray-800">
                  <StickyNote className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                </div>
              </div>
              <h3 className="mb-3 font-semibold text-gray-900 text-xl dark:text-white">
                No notes yet
              </h3>
              <p className="mb-8 text-gray-600 dark:text-gray-400">
                Capture quick observations, field notes, or meeting summaries.
              </p>
              <Button className="gap-2" onClick={() => setNoteDialogOpen(true)}>
                <StickyNote className="h-4 w-4" />
                Create Your First Note
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </PageContainer>

      {/* Quick Note Dialog */}
      <QuickNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        onSave={handleSaveNote}
        availablePeople={[]}
        availableOrgs={[]}
        availableOpportunities={[]}
      />
    </div>
  );
}
