import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router-dom"
import ProjectStatusScreen from "~/features/onboarding/components/ProjectStatusScreen"
import { getProjectById } from "~/features/projects/db"
import { userContext } from "~/server/user-context"
import { getProjectContextGeneric } from "~/features/questions/db"

export const meta: MetaFunction = () => {
  return [{ title: "Project Overview | Insights" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext)
  const supabase = ctx.supabase
  const accountId = params.accountId
  const projectId = params.projectId

  if (!accountId || !projectId) {
    throw new Response("Account ID and Project ID are required", { status: 400 })
  }

  const { data: project } = await getProjectById({ supabase, id: projectId })

  // Load merged project context (target_orgs, roles, research_goal, etc.)
  let projectContext: any = null
  try {
    projectContext = await getProjectContextGeneric(supabase, projectId)
  } catch (_) {
    // non-fatal
  }

  // Load project sections server-side to avoid client fetches
  const { data: projectSections } = await supabase
    .from("project_sections")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  return {
    accountId,
    projectId,
    projectName: project?.name || "Project",
    icp: project?.description || "",
    projectSections: projectSections || [],
    projectContext,
  }
}

export default function ProjectIndex() {
  const { accountId, projectId, projectName, icp, projectSections } = useLoaderData<typeof loader>()
  return (
    <ProjectStatusScreen
      projectName={projectName}
      icp={icp}
      accountId={accountId}
      projectId={projectId}
      projectSections={projectSections}
    />
  )
}
