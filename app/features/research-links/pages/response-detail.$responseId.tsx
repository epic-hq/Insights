/**
 * Individual response detail page
 * Shows full response with all answers, person info, and video if recorded
 */
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Calendar, CheckCircle, Clock, Mail, User, Video } from "lucide-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getServerClient } from "~/lib/supabase/client.server";
import { createR2PresignedUrl } from "~/utils/r2.server";
import { createRouteDefinitions } from "~/utils/route-definitions";
import { ResearchLinkQuestionSchema } from "../schemas";
import { extractAnswer } from "../utils";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Response" }];
	return [
		{ title: `Response from ${data.response.email}` },
		{ name: "description", content: `Response detail for ${data.list.name}` },
	];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
	const { accountId, projectId, listId, responseId } = params;
	if (!accountId || !projectId || !listId || !responseId) {
		throw new Response("Missing route parameters", { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	// Fetch the list
	const { data: list, error: listError } = await supabase
		.from("research_links")
		.select("id, name, slug, questions")
		.eq("account_id", accountId)
		.eq("id", listId)
		.maybeSingle();

	if (listError) {
		throw new Response(listError.message, { status: 500 });
	}
	if (!list) {
		throw new Response("Ask link not found", { status: 404 });
	}

	// Fetch the response with person data
	const { data: response, error: responseError } = await supabase
		.from("research_link_responses")
		.select("*, person:people(id, name, primary_email, title, default_organization:organizations!default_organization_id(name))")
		.eq("id", responseId)
		.eq("research_link_id", listId)
		.maybeSingle();

	if (responseError) {
		throw new Response(responseError.message, { status: 500 });
	}
	if (!response) {
		throw new Response("Response not found", { status: 404 });
	}

	// Generate signed URL for video if exists
	let videoSignedUrl: string | null = null;
	if (response.video_url) {
		const presigned = createR2PresignedUrl({
			key: response.video_url,
			expiresInSeconds: 3600,
			responseContentType: "video/webm",
		});
		videoSignedUrl = presigned?.url ?? null;
	}

	const questionsResult = ResearchLinkQuestionSchema.array().safeParse(list.questions);

	return {
		accountId,
		projectId,
		listId,
		list,
		response,
		questions: questionsResult.success ? questionsResult.data : [],
		videoSignedUrl,
	};
}

export default function ResponseDetailPage() {
	const { accountId, projectId, listId, list, response, questions, videoSignedUrl } = useLoaderData<typeof loader>();

	const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);
	const person = response.person as {
		id: string;
		name: string | null;
		primary_email: string | null;
		title: string | null;
		company: string | null;
	} | null;

	return (
		<PageContainer className="max-w-3xl space-y-6">
			{/* Header */}
			<div className="space-y-4">
				<Button asChild variant="ghost" size="sm" className="-ml-2">
					<Link to={routes.ask.responses(listId)}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to responses
					</Link>
				</Button>

				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<h1 className="font-semibold text-2xl">Response from</h1>
						<p className="text-lg text-muted-foreground">{response.email}</p>
					</div>
					<Badge variant={response.completed ? "default" : "secondary"} className="shrink-0">
						{response.completed ? (
							<>
								<CheckCircle className="mr-1 h-3 w-3" /> Complete
							</>
						) : (
							<>
								<Clock className="mr-1 h-3 w-3" /> In progress
							</>
						)}
					</Badge>
				</div>
			</div>

			{/* Metadata */}
			<div className="flex flex-wrap gap-4 text-muted-foreground text-sm">
				<div className="flex items-center gap-1.5">
					<Calendar className="h-4 w-4" />
					{response.created_at
						? formatDistanceToNow(new Date(response.created_at), {
								addSuffix: true,
							})
						: "Unknown"}
				</div>
				<div className="flex items-center gap-1.5">
					<Mail className="h-4 w-4" />
					<a href={`mailto:${response.email}`} className="hover:text-foreground hover:underline">
						{response.email}
					</a>
				</div>
				{person && (
					<Link
						to={routes.people.detail(person.id)}
						className="flex items-center gap-1.5 hover:text-foreground hover:underline"
					>
						<User className="h-4 w-4" />
						{person.name || response.email}
						{person.title && <span className="opacity-70">· {person.title}</span>}
					</Link>
				)}
			</div>

			{/* Video Response */}
			{videoSignedUrl && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Video className="h-4 w-4" />
							Video Response
						</CardTitle>
					</CardHeader>
					<CardContent>
						<video src={videoSignedUrl} controls className="aspect-video w-full rounded-lg bg-black" />
					</CardContent>
				</Card>
			)}

			{/* Answers */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Responses</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					{questions.map((question, index) => {
						const answer = extractAnswer(response, question);
						return (
							<div key={question.id} className="space-y-2">
								<div className="flex items-start gap-2">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground/70 text-xs">
										{index + 1}
									</span>
									<p className="text-muted-foreground text-sm">{question.prompt}</p>
								</div>
								<div className="ml-8">
									{answer ? (
										<p className="whitespace-pre-wrap font-medium text-foreground">{answer}</p>
									) : (
										<p className="text-muted-foreground/60 text-sm italic">No response</p>
									)}
								</div>
							</div>
						);
					})}
				</CardContent>
			</Card>

			{/* Person Card */}
			{person && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<User className="h-4 w-4" />
							Linked Person
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<p className="font-medium">{person.name || response.email}</p>
								{person.title && (
									<p className="text-muted-foreground text-sm">
										{person.title}
										{(person as any).default_organization?.name && ` at ${(person as any).default_organization?.name}`}
									</p>
								)}
								{person.primary_email && <p className="text-muted-foreground text-sm">{person.primary_email}</p>}
							</div>
							<Button asChild variant="outline" size="sm">
								<Link to={routes.people.detail(person.id)}>View Profile</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</PageContainer>
	);
}
