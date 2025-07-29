import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
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
		<div className="space-y-6 px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">People</h1>
					<p className="text-muted-foreground">Manage research participants, contacts, and interview subjects.</p>
				</div>
				<Button asChild>
					<Link to="/people/new">Add Person</Link>
				</Button>
			</div>

			{people.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<h3 className="mb-2 font-semibold text-lg">No people yet</h3>
						<p className="mb-4 text-muted-foreground">
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
						<Card key={person.id} className="transition-shadow hover:shadow-md">
							<CardHeader>
								<div className="flex items-center gap-3">
									<Avatar className="h-12 w-12">
										<AvatarFallback className="bg-primary text-primary-foreground">
											{getInitials(person.name)}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1">
										<CardTitle className="text-lg">
											<Link to={`/people/${person.id}`} className="hover:underline">
												{person.name}
											</Link>
										</CardTitle>
										{person.segment && <CardDescription>{person.segment}</CardDescription>}
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{person.people_personas && person.people_personas.length > 0 && (
										<div className="text-sm">
											<span className="font-medium">Persona:</span>{" "}
											<Badge variant="outline" className="ml-1">
												{person.people_personas[0].personas?.name || "Unknown"}
											</Badge>
										</div>
									)}
									{person.segment && (
										<div className="text-sm">
											<span className="font-medium">Segment:</span> {person.segment}
										</div>
									)}
									{person.description && (
										<div className="text-sm">
											<span className="font-medium">Description:</span> {person.description}
										</div>
									)}
									{person.age && (
										<div className="text-sm">
											<span className="font-medium">Age:</span> {person.age}
										</div>
									)}
									<div className="text-muted-foreground text-sm">
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
