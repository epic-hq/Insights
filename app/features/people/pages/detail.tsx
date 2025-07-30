import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { getPersonById } from "~/features/people/db"
import MiniPersonaCard from "~/features/personas/components/MiniPersonaCard"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.person?.name || "Person"} | Insights` },
		{ name: "description", content: "Person details and interview history" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { personId } = params

	if (!personId) {
		throw new Response("Person ID is required", { status: 400 })
	}

	try {
		const person = await getPersonById({
			supabase,
			accountId,
			id: personId,
		})

		if (!person) {
			throw new Response("Person not found", { status: 404 })
		}

		return { person }
	} catch {
		throw new Response("Failed to load person", { status: 500 })
	}
}

export default function PersonDetail() {
	const { person } = useLoaderData<typeof loader>()

	const interviews = person.interview_people || []
	// Get personas from junction table - people_personas contains the relationship data
	const people_personas = person.people_personas || []
	const primaryPersona = people_personas.length > 0 ? people_personas[0] : null
	const persona = primaryPersona?.personas

	return (
		<div className="mx-auto max-w-4xl">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-3xl text-gray-900">{person.name}</h1>

					<div className="mt-2 flex flex-wrap items-center gap-2">
						{person.segment && <Badge variant="secondary">{person.segment}</Badge>}
					</div>
					<Avatar className="h-16 w-16">
						<AvatarImage src={person.image_url} />
						<AvatarFallback>NA</AvatarFallback>
					</Avatar>
				</div>
				<div className="flex gap-2">
					<Button asChild variant="outline">
						<Link to={`/people/${person.id}/edit`}>Edit</Link>
					</Button>
				</div>
			</div>

			{/* Persona Section */}
			<label className="font-medium text-gray-500 text-sm">Persona</label>
			{persona && (
				<div className="mb-8">
					{/* <h2 className="mb-4 font-semibold text-gray-900 text-lg">Persona</h2> */}
					<MiniPersonaCard persona={persona} className="max-w-md" />
				</div>
			)}

			<div className="grid gap-8 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<div className="rounded-lg border bg-white p-6">
						{/* <h2 className="mb-4 font-semibold text-xl">Details</h2> */}

						{/* Email field not available in current schema */}

						{/* {person.segment && (
							<div className="mb-4">
								<label className="font-medium text-gray-500 text-sm">Segment</label>
								<div className="mt-1 text-gray-900">{person.segment}</div>
							</div>
						)} */}

						{person.description && (
							<div className="mb-4">
								<label className="font-medium text-gray-500 text-sm">Description</label>
								<div className="mt-1 whitespace-pre-wrap text-gray-900">{person.description}</div>
							</div>
						)}
					</div>

					{interviews.length > 0 && (
						<div className="mt-8 rounded-lg border bg-white p-6">
							<h2 className="mb-4 font-semibold text-xl">Interview History</h2>
							<div className="space-y-4">
								{interviews.map((interviewPerson) => (
									<div key={interviewPerson.interviews.id} className="border-blue-500 border-l-4 pl-4">
										<Link
											to={`/interviews/${interviewPerson.interviews.id}`}
											className="font-medium text-blue-600 hover:text-blue-800"
										>
											{interviewPerson.interviews.title}
										</Link>
										{interviewPerson.interviews.interview_date && (
											<div className="text-gray-600 text-sm">
												{new Date(interviewPerson.interviews.interview_date).toLocaleDateString()}
											</div>
										)}
										{interviewPerson.interviews.duration_min && (
											<div className="text-gray-500 text-sm">
												Duration: {interviewPerson.interviews.duration_min} minutes
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="space-y-6">
					<div className="rounded-lg border bg-white p-6">
						<h3 className="mb-4 font-semibold">Statistics</h3>
						<div className="space-y-3">
							<div>
								<label className="font-medium text-gray-500 text-sm">Total Interviews</label>
								<div className="mt-1 font-bold text-2xl text-gray-900">{interviews.length}</div>
							</div>

							{interviews.length > 0 && (
								<div>
									<label className="font-medium text-gray-500 text-sm">Latest Interview</label>
									<div className="mt-1 text-gray-900 text-sm">
										{new Date(
											Math.max(
												...interviews.map((ip) =>
													new Date(ip.interviews.interview_date || ip.interviews.created_at).getTime()
												)
											)
										).toLocaleDateString()}
									</div>
								</div>
							)}

							<div>
								<label className="font-medium text-gray-500 text-sm">Added</label>
								<div className="mt-1 text-gray-900 text-sm">{new Date(person.created_at).toLocaleDateString()}</div>
							</div>

							{person.updated_at && (
								<div>
									<label className="font-medium text-gray-500 text-sm">Last Updated</label>
									<div className="mt-1 text-gray-900 text-sm">{new Date(person.updated_at).toLocaleDateString()}</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
