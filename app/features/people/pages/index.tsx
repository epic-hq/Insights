import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { Button } from "~/components/ui/button"
import EnhancedPersonCard from "~/features/people/components/EnhancedPersonCard"
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
  <div className="flex flex-col items-center justify-center py-12">
    <h3 className="mb-2 font-semibold text-lg">No people yet</h3>
    <p className="mb-4 text-muted-foreground">
      Add your first person to start tracking research participants and contacts.
    </p>
    <Button asChild>
      <Link to="/people/new">Add Person</Link>
    </Button>
  </div>
) : (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {people.map((person) => (
      <EnhancedPersonCard
        key={person.id}
        person={{
          ...person,
          people_personas: (person.people_personas || []).map(pp => ({
            personas: pp.personas
              ? {
                  name: pp.personas.name,
                  color_hex: pp.personas.color_hex || undefined,
                }
              : undefined,
          })),
        }}
      />
    ))}
  </div>
)}
		</div>
	)
}
