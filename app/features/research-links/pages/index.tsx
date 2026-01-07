import { ExternalLink, Link2, ListTodo, UsersRound, Video } from "lucide-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { getServerClient } from "~/lib/supabase/client.server";
import { createRouteDefinitions } from "~/utils/route-definitions";
import { getResearchLinks } from "../db";
import { ResearchLinkQuestionSchema } from "../schemas";

export const meta: MetaFunction = () => {
  return [
    { title: "Ask" },
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

export default function ResearchLinksIndexPage() {
  const { accountId, projectId, origin, lists } = useLoaderData<LoaderData>();
  const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl">Ask</h1>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Create shareable links to collect responses from participants using
            your interview prompts.
          </p>
        </div>
        <Button asChild>
          <Link to={routes.ask.new()}>New Ask link</Link>
        </Button>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-12 text-center">
          <Link2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-semibold text-xl">
            Create your first Ask link
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground text-sm">
            Define the headline, select questions from your prompts, and share
            the link to start collecting responses.
          </p>
          <Button asChild className="mt-4">
            <Link to={routes.ask.new()}>Create Ask link</Link>
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
              <Card key={list.id} className="flex flex-col border-muted/70">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-xl">{list.name}</h2>
                      {list.description ? (
                        <p className="mt-1 text-muted-foreground text-sm">
                          {list.description}
                        </p>
                      ) : null}
                    </div>
                    {list.walkthrough_video_url && (
                      <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-muted/50">
                        <Video className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    {/* Responses row - count + View responses together */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground text-sm">
                        <UsersRound className="h-4 w-4" /> {responsesCount}{" "}
                        {responsesCount === 1 ? "response" : "responses"}
                      </span>
                      <Button asChild variant="secondary" size="sm">
                        <Link to={routes.ask.responses(list.id)}>
                          View responses
                        </Link>
                      </Button>
                    </div>
                    {/* Questions row - count + Edit together */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground text-sm">
                        <ListTodo className="h-4 w-4" /> {questions.length}{" "}
                        {questions.length === 1 ? "question" : "questions"}
                      </span>
                      <Button asChild variant="outline" size="sm">
                        <Link to={routes.ask.edit(list.id)}>Edit</Link>
                      </Button>
                    </div>
                    {/* Public URL */}
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 font-medium text-primary text-sm hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="truncate">{publicUrl}</span>
                    </a>
                  </div>
                  {/* Footer with badge and date */}
                  <div className="flex items-center gap-2 border-t pt-3">
                    <Badge
                      variant={list.is_live ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {list.is_live ? "Live" : "Draft"}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      Updated {new Date(list.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
