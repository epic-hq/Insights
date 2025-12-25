import { ExternalLink, ListTodo, UsersRound } from "lucide-react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { getServerClient } from "~/lib/supabase/client.server"
import { createRouteDefinitions } from "~/utils/route-definitions"
import { getResearchLinks } from "../db"
import { ResearchLinkQuestionSchema } from "../schemas"

export const meta: MetaFunction = () => {
	return [
		{ title: "Research links" },
		{ name: "description", content: "Design, publish, and review research response links." },
	]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const accountId = params.accountId
	if (!accountId) {
		throw new Response("Account id required", { status: 400 })
	}
	const { client: supabase } = getServerClient(request)
	const { data, error } = await getResearchLinks({ supabase, accountId })
	if (error) {
		throw new Response(error.message, { status: 500 })
	}
	const origin = new URL(request.url).origin
	return { accountId, origin, lists: data ?? [] }
}

interface LoaderData {
	accountId: string
	origin: string
	lists: Array<{
		id: string
		name: string
		slug: string
		description: string | null
		hero_title: string | null
		hero_subtitle: string | null
		hero_cta_label: string | null
		hero_cta_helper: string | null
		redirect_url: string | null
		calendar_url: string | null
		questions: unknown
		allow_chat: boolean
		default_response_mode: "form" | "chat"
		is_live: boolean
		updated_at: string
		research_link_responses?: Array<{ count: number | null }>
	}>
}

export default function ResearchLinksIndexPage() {
	const { accountId, origin, lists } = useLoaderData<LoaderData>()
	const routes = createRouteDefinitions(`/a/${accountId}`)

	return (
		<PageContainer className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-2">
					<h1 className="font-semibold text-3xl">Research links</h1>
					<p className="max-w-2xl text-muted-foreground text-sm">
						Spin up lightweight, typeform-style experiences to capture emails and context from research participants.
					</p>
				</div>
				<Button asChild>
					<Link to={routes.researchLinks.new()}>New research link</Link>
				</Button>
			</div>

			{lists.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/40 p-12 text-center">
					<ListTodo className="mx-auto h-10 w-10 text-muted-foreground" />
					<h2 className="mt-4 font-semibold text-xl">Create your first research link</h2>
					<p className="mx-auto mt-2 max-w-lg text-muted-foreground text-sm">
						Define the headline, capture the questions you care about, and share the public link to start collecting
						responses.
					</p>
					<Button asChild className="mt-4">
						<Link to={routes.researchLinks.new()}>Create research link</Link>
					</Button>
				</div>
			) : (
				<div className="grid gap-4 lg:grid-cols-2">
					{lists.map((list) => {
						const questionsResult = ResearchLinkQuestionSchema.array().safeParse(list.questions)
						const questions = questionsResult.success ? questionsResult.data : []
						const responsesCount = list.research_link_responses?.[0]?.count ?? 0
						const publicUrl = `${origin}${routes.researchLinks.public(list.slug)}`
						return (
							<Card key={list.id} className="flex flex-col border-muted/70">
								<CardHeader className="space-y-3">
									<div className="flex items-center gap-2">
										<Badge variant={list.is_live ? "default" : "secondary"}>{list.is_live ? "Live" : "Draft"}</Badge>
										<span className="text-muted-foreground text-xs">
											Last updated {new Date(list.updated_at).toLocaleDateString()}
										</span>
									</div>
									<div>
										<h2 className="font-semibold text-xl">{list.name}</h2>
										{list.description ? <p className="mt-1 text-muted-foreground text-sm">{list.description}</p> : null}
									</div>
								</CardHeader>
								<CardContent className="flex flex-1 flex-col justify-between space-y-4">
									<div className="space-y-2 text-sm">
										<p className="flex items-center gap-2 text-muted-foreground">
											<UsersRound className="h-4 w-4" /> {responsesCount}{" "}
											{responsesCount === 1 ? "response" : "responses"}
										</p>
										<p className="flex items-center gap-2 text-muted-foreground">
											<ListTodo className="h-4 w-4" /> {questions.length}{" "}
											{questions.length === 1 ? "question" : "questions"}
										</p>
										<a
											href={publicUrl}
											target="_blank"
											rel="noreferrer"
											className="flex items-center gap-2 font-medium text-primary text-sm hover:underline"
										>
											<ExternalLink className="h-4 w-4" />
											{publicUrl}
										</a>
									</div>
									<div className="flex flex-wrap gap-2">
										<Button asChild variant="outline">
											<Link to={routes.researchLinks.edit(list.id)}>Edit</Link>
										</Button>
										<Button asChild variant="secondary">
											<Link to={routes.researchLinks.responses(list.id)}>View responses</Link>
										</Button>
									</div>
								</CardContent>
							</Card>
						)
					})}
				</div>
			)}
		</PageContainer>
	)
}
