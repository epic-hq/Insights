import { Download, ExternalLink, ListTodo } from "lucide-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getServerClient } from "~/lib/supabase/client.server";
import { createRouteDefinitions } from "~/utils/route-definitions";
import { ResearchLinkResponsesDataTable } from "../components/ResearchLinkResponsesDataTable";
import { getResearchLinkWithResponses } from "../db";
import { ResearchLinkQuestionSchema } from "../schemas";
import { buildResponsesCsv } from "../utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Ask link responses" },
    {
      name: "description",
      content: "Review and export responses from your Ask link.",
    },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { accountId, projectId, listId } = params;
  if (!accountId || !projectId || !listId) {
    throw new Response("Missing route parameters", { status: 400 });
  }
  const { client: supabase } = getServerClient(request);
  const { list, listError, responses, responsesError } =
    await getResearchLinkWithResponses({
      supabase,
      accountId,
      listId,
    });
  if (listError) {
    throw new Response(listError.message, { status: 500 });
  }
  if (responsesError) {
    throw new Response(responsesError.message, { status: 500 });
  }
  if (!list) {
    throw new Response("Ask link not found", { status: 404 });
  }
  const questionsResult = ResearchLinkQuestionSchema.array().safeParse(
    list.questions,
  );
  const origin = new URL(request.url).origin;
  return {
    accountId,
    projectId,
    list,
    responses: responses ?? [],
    questions: questionsResult.success ? questionsResult.data : [],
    publicUrl: `${origin}/ask/${list.slug}`,
  };
}

export default function ResearchLinkResponsesPage() {
  const { accountId, projectId, list, responses, questions, publicUrl } =
    useLoaderData<typeof loader>();
  const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);

  const handleExport = () => {
    const csv = buildResponsesCsv(questions, responses);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${list.slug || "research-link"}-responses.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-3xl">Ask link responses</h1>
            <Badge variant={list.is_live ? "default" : "secondary"}>
              {list.is_live ? "Live" : "Draft"}
            </Badge>
          </div>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Review captured emails and context, then export to share with your
            team or seed outreach.
          </p>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-primary text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            {publicUrl}
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={routes.ask.edit(list.id)}>Edit link</Link>
          </Button>
          <Button onClick={handleExport} disabled={responses.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {responses.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardHeader>
            <CardTitle>No responses yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground text-sm">
            <p>Share your Ask link to start collecting responses.</p>
            <div className="flex items-center gap-2 text-xs">
              <ListTodo className="h-4 w-4" /> {publicUrl}
            </div>
          </CardContent>
        </Card>
      ) : (
        <ResearchLinkResponsesDataTable
          questions={questions}
          responses={responses}
        />
      )}
    </PageContainer>
  );
}
