import {
  Copy,
  ExternalLink,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  Video,
} from "lucide-react";
import { useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { PageContainer } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { getServerClient } from "~/lib/supabase/client.server";
import { createRouteDefinitions } from "~/utils/route-definitions";
import { QRCodeButton } from "../components/QRCodeButton";
import { QRCodeModal } from "../components/QRCodeModal";
import { getResearchLinks } from "../db";
import { ResearchLinkQuestionSchema } from "../schemas";

export const meta: MetaFunction = () => {
  return [
    { title: "Surveys" },
    {
      name: "description",
      content: "Create shareable links to collect responses from participants.",
    },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { accountId, projectId } = params;
  if (!accountId) {
    throw new Response("Account id required", { status: 400 });
  }
  if (!projectId) {
    throw new Response("Project id required", { status: 400 });
  }
  const { client: supabase } = getServerClient(request);
  const { data, error } = await getResearchLinks({
    supabase,
    accountId,
    projectId,
  });
  if (error) {
    throw new Response(error.message, { status: 500 });
  }
  const origin = new URL(request.url).origin;
  return { accountId, projectId, origin, lists: data ?? [] };
}

interface LoaderData {
  accountId: string;
  projectId: string;
  origin: string;
  lists: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    hero_title: string | null;
    hero_subtitle: string | null;
    hero_cta_label: string | null;
    hero_cta_helper: string | null;
    redirect_url: string | null;
    calendar_url: string | null;
    questions: unknown;
    allow_chat: boolean;
    allow_video: boolean;
    default_response_mode: "form" | "chat";
    is_live: boolean;
    updated_at: string;
    walkthrough_video_url: string | null;
    research_link_responses?: Array<{ count: number | null }>;
  }>;
}

interface AskLinkCardProps {
  list: LoaderData["lists"][0];
  questions: Array<{ id: string; prompt: string }>;
  responsesCount: number;
  publicUrl: string;
  routes: ReturnType<typeof createRouteDefinitions>;
}

function AskLinkCard({
  list,
  questions,
  responsesCount,
  publicUrl,
  routes,
}: AskLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deleteFetcher = useFetcher();
  const isDeleting = deleteFetcher.state !== "idle";

  const copyUrl = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openQRModal = () => {
    setIsQRModalOpen(true);
  };

  const handleDelete = () => {
    deleteFetcher.submit(null, {
      method: "POST",
      action: `${routes.ask.index()}/api/delete-survey/${list.id}`,
    });
    setIsDeleteOpen(false);
  };

  return (
    <>
      <Card className="group relative flex flex-col transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{list.name}</CardTitle>
                <Badge
                  variant={list.is_live ? "default" : "secondary"}
                  className="text-xs"
                >
                  {list.is_live ? "Live" : "Draft"}
                </Badge>
              </div>
              {list.description && (
                <CardDescription className="line-clamp-2">
                  {list.description}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-1">
              <QRCodeButton url={publicUrl} onClick={openQRModal} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={routes.ask.edit(list.id)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyUrl}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open link
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setIsDeleteOpen(true)}
                    className="text-destructive focus:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col justify-between pt-0">
          {/* Stats row */}
          <div className="flex items-center gap-4 text-muted-foreground text-sm">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              {responsesCount} {responsesCount === 1 ? "response" : "responses"}
            </span>
            <span>·</span>
            <span>{questions.length} questions</span>
            {list.walkthrough_video_url && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  <Video className="h-4 w-4" />
                  Video
                </span>
              </>
            )}
          </div>

          {/* URL and actions */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={copyUrl}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-muted-foreground">
                {copied ? "Copied!" : list.slug}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={routes.ask.edit(list.id)}>Edit</Link>
              </Button>
              <Button asChild size="sm">
                <Link to={routes.ask.responses(list.id)}>View responses</Link>
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 text-muted-foreground text-xs">
            Updated {new Date(list.updated_at).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>

      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        url={publicUrl}
        title={list.name}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete survey</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{list.name}" and all its responses.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function ResearchLinksIndexPage() {
  const { accountId, projectId, origin, lists } = useLoaderData<LoaderData>();
  const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl">Surveys</h1>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Create shareable links to collect responses from participants using
            your interview prompts.
          </p>
        </div>
        <Button asChild>
          <Link to={routes.ask.new()}>New survey</Link>
        </Button>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-12 text-center">
          <Link2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-semibold text-xl">
            Create your first survey
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground text-sm">
            Define the headline, select questions from your prompts, and share
            the link to start collecting responses.
          </p>
          <Button asChild className="mt-4">
            <Link to={routes.ask.new()}>New survey</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lists.map((list) => {
            const questionsResult =
              ResearchLinkQuestionSchema.array().safeParse(list.questions);
            const questions = questionsResult.success
              ? questionsResult.data
              : [];
            const responsesCount =
              list.research_link_responses?.[0]?.count ?? 0;
            const publicUrl = `${origin}${routes.ask.public(list.slug)}`;
            return (
              <AskLinkCard
                key={list.id}
                list={list}
                questions={questions}
                responsesCount={responsesCount}
                publicUrl={publicUrl}
                routes={routes}
              />
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
