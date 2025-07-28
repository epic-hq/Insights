import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { getPeople } from "~/features/people/db"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = () => {
	return [{ title: "People" }, { name: "description", content: "Manage research participants and contacts" }]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { data: people, error } = await getPeople({ supabase, accountId })

	if (error) {
		throw new Response("Error loading people", { status: 500 })
	}

	return { people: people || [] }
}

export default function PeopleIndexPage() {
	const { people } = useLoaderData<typeof loader>()

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">People</h1>
					<p className="text-muted-foreground">
						Manage research participants, contacts, and interview subjects.
					</p>
				</div>
				<Button asChild>
					<Link to="/people/new">Add Person</Link>
				</Button>
			</div>

			{people.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<h3 className="text-lg font-semibold mb-2">No people yet</h3>
						<p className="text-muted-foreground mb-4">
							Add your first person to start tracking research participants and contacts.
						</p>
						<Button asChild>
							<Link to="/people/new">Add Person</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{people.map((person) => (
						<Card key={person.id} className="hover:shadow-md transition-shadow">
							<CardHeader>
								<div className="flex items-center gap-3">
									<Avatar className="h-12 w-12">
										<AvatarFallback className="bg-primary text-primary-foreground">
											{getInitials(person.name)}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1">
										<CardTitle className="text-lg">
											<Link
												to={`/people/${person.id}`}
												className="hover:underline"
											>
												{person.name}
											</Link>
										</CardTitle>
										{person.job_title && (
											<CardDescription>{person.job_title}</CardDescription>
										)}
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{person.company && (
										<div className="text-sm">
											<span className="font-medium">Company:</span> {person.company}
										</div>
									)}
									{person.location && (
										<div className="text-sm">
											<span className="font-medium">Location:</span> {person.location}
										</div>
									)}
									{person.age && (
										<div className="text-sm">
											<span className="font-medium">Age:</span> {person.age}
										</div>
									)}
									<div className="text-sm text-muted-foreground">
										Added {new Date(person.created_at).toLocaleDateString()}
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
