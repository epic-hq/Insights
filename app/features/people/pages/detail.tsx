import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { motion } from "framer-motion"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getPersonById } from "~/features/people/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.person?.name || "Person"} | Insights` },
		{ name: "description", content: "Person details and interview history" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	
	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const personId = params.personId

	if (!accountId || !projectId || !personId) {
		throw new Response("Account ID, Project ID, and Person ID are required", { status: 400 })
	}

	try {
		const person = await getPersonById({
			supabase,
			accountId,
			projectId,
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
  const { projectPath } = useCurrentProject()
  const routes = useProjectRoutes(projectPath || "")

  const interviews = person.interview_people || []
  const people_personas = person.people_personas || []
  const primaryPersona = people_personas.length > 0 ? people_personas[0] : null
  const persona = primaryPersona?.personas
  const themeColor = persona?.color_hex || "#6366f1"
  const name = person.name || "Unnamed Person"
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  return (
    <div className="mx-auto max-w-4xl py-8">
      <motion.div
        className="relative mb-8 flex flex-col items-center rounded-xl border border-border bg-background p-8 shadow-md"
        style={{ borderColor: themeColor }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Persona color accent bar */}
        <div className="absolute left-0 top-0 h-1 w-full rounded-t-xl" style={{ backgroundColor: themeColor }} />
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-2" style={{ borderColor: themeColor }}>
              {person.image_url && <AvatarImage src={person.image_url} alt={name} />}
              <AvatarFallback className="bg-primary text-primary-foreground" style={{ backgroundColor: themeColor }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-bold text-3xl text-foreground mb-2">{name}</h1>
              {persona?.name && (
                <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: themeColor + '22', color: themeColor }}>
                  {persona.name}
                </span>
              )}
              {person.segment && (
                <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">{person.segment}</span>
              )}
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to={routes.people.edit(person.id)}>Edit</Link>
          </Button>
        </div>
        {person.description && (
          <p className="mt-4 w-full max-w-2xl text-center text-muted-foreground text-base whitespace-pre-wrap">
            {person.description}
          </p>
        )}
      </motion.div>
      {/* Persona Section (optional, could be expanded for more personas) */}
      {/* Interview History & Stats */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {interviews.length > 0 && (
            <motion.div
              className="rounded-xl border bg-white p-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <h2 className="mb-4 font-semibold text-xl">Interview History</h2>
              <div className="space-y-4">
                {interviews.map((interviewPerson) => (
                  <motion.div
                    key={interviewPerson.interviews.id}
                    className="border-l-4 pl-4"
                    style={{ borderColor: themeColor }}
                    whileHover={{ scale: 1.01, backgroundColor: themeColor + '0A' }}
                  >
                    <Link
                      to={routes.interviews.detail(interviewPerson.interviews.id)}
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
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
        <div className="space-y-6">
          <motion.div
            className="rounded-xl border bg-white p-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
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
          </motion.div>
        </div>
      </div>
    </div>
  )
}
