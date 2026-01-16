/**
 * My Responses page - shows survey responses for the logged-in user
 * Users can see their past survey submissions even if they're not part of the project
 */
import { formatDistanceToNow } from "date-fns"
import { Calendar, CheckCircle2, ClipboardList, Inbox } from "lucide-react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { type ResearchLinkQuestion, ResearchLinkQuestionSchema } from "~/features/research-links/schemas"
import { getServerClient } from "~/lib/supabase/client.server"

export const meta: MetaFunction = () => {
	return [{ title: "My Responses | UpSight" }, { name: "description", content: "View your survey responses" }]
}

type ResponseItem = {
	id: string
	surveyName: string
	accountName: string
	completedAt: string
	questions: ResearchLinkQuestion[]
	answers: Record<string, string | string[] | boolean | null>
	slug: string
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)

	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user || !user.email) {
		return { responses: [] }
	}

	// Query responses with research_links (accounts is in a different schema, so we fetch it separately)
	const { data: rawResponses, error: queryError } = await supabase
		.from("research_link_responses")
		.select(
			`
      id,
      responses,
      completed,
      created_at,
      research_links!inner (
        id,
        name,
        slug,
        questions,
        account_id
      )
    `
		)
		.eq("email", user.email.toLowerCase())
		.eq("completed", true)
		.order("created_at", { ascending: false })

	if (queryError) {
		return { responses: [] }
	}

	// Get unique account IDs to fetch account names
	const accountIds = [
		...new Set(
			rawResponses?.map((r) => {
				const link = r.research_links as unknown as { account_id: string }
				return link.account_id
			}) ?? []
		),
	]

	// Fetch account names from accounts schema
	const { data: accountsData } = await supabase
		.schema("accounts")
		.from("accounts")
		.select("id, name")
		.in("id", accountIds)

	const accountMap = new Map(accountsData?.map((a) => [a.id, a.name]) ?? [])

	const responses: ResponseItem[] = (rawResponses ?? []).map((r) => {
		const link = r.research_links as unknown as {
			id: string
			name: string
			slug: string
			questions: unknown
			account_id: string
		}

		// Parse questions from JSONB
		const questionsResult = ResearchLinkQuestionSchema.array().safeParse(link.questions)

		return {
			id: r.id,
			surveyName: link.name,
			accountName: accountMap.get(link.account_id) ?? "Unknown",
			completedAt: r.created_at,
			questions: questionsResult.success ? questionsResult.data : [],
			answers: (r.responses ?? {}) as Record<string, string | string[] | boolean | null>,
			slug: link.slug,
		}
	})

	return { responses }
}

function formatAnswer(answer: string | string[] | boolean | null, question: ResearchLinkQuestion): string {
	if (answer === null || answer === undefined) return "—"
	if (typeof answer === "boolean") return answer ? "Yes" : "No"
	if (Array.isArray(answer)) return answer.join(", ")
	if (question.type === "likert" && question.likertScale) {
		return `${answer}/${question.likertScale}`
	}
	return String(answer)
}

export default function MyResponsesPage() {
	const { responses } = useLoaderData<typeof loader>()

	return (
		<PageContainer className="max-w-4xl">
			<div className="mb-6">
				<h1 className="font-semibold text-2xl">My Responses</h1>
				<p className="mt-1 text-muted-foreground">Surveys and feedback you&apos;ve submitted</p>
			</div>

			{responses.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-12">
						<div className="rounded-full bg-muted p-4">
							<Inbox className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="mt-4 font-medium text-lg">No responses yet</h3>
						<p className="mt-1 text-center text-muted-foreground text-sm">
							When you complete surveys, they&apos;ll appear here.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{responses.map((response) => (
						<Card key={response.id}>
							<CardHeader className="pb-3">
								<div className="flex items-start justify-between">
									<div>
										<CardTitle className="flex items-center gap-2 text-lg">
											<ClipboardList className="h-5 w-5 text-muted-foreground" />
											{response.surveyName}
										</CardTitle>
										<p className="mt-1 text-muted-foreground text-sm">From {response.accountName}</p>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="secondary" className="gap-1">
											<CheckCircle2 className="h-3 w-3" />
											Completed
										</Badge>
										<span className="flex items-center gap-1 text-muted-foreground text-xs">
											<Calendar className="h-3 w-3" />
											{formatDistanceToNow(new Date(response.completedAt), {
												addSuffix: true,
											})}
										</span>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{response.questions.map((question) => {
										const answer = response.answers[question.id]
										return (
											<div key={question.id} className="rounded-lg border bg-muted/30 p-3">
												<p className="font-medium text-sm">{question.prompt}</p>
												<p className="mt-1 text-muted-foreground text-sm">{formatAnswer(answer, question)}</p>
											</div>
										)
									})}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</PageContainer>
	)
}
